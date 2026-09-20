// ═════════════════════════════════════════════════════════════════
// chat-google-backup-service.js
// Ubicación: js/features/chat/chat-google-backup-service.js
//
// ═════════════════════════════════════════════════════════════════
// PROPÓSITO
// ═════════════════════════════════════════════════════════════════
// Réplica web de Pantallas/JaguarChat/Chats/backup_service.dart.
// Vincula una cuenta de Google, y respalda/restaura los chats y
// mensajes de IndexedDB (TABLA_CHATS/TABLA_MENSAJES, vía
// db-service.js) contra la carpeta privada 'appDataFolder' de
// Google Drive del usuario. El archivo cifrado es intercambiable
// con el que genera la app móvil (mismo formato: gzip → AES-256-CBC
// con clave derivada por HKDF a partir del uid de Supabase).
//
// ═════════════════════════════════════════════════════════════════
// DIFERENCIAS INTENCIONALES RESPECTO A FLUTTER
// ═════════════════════════════════════════════════════════════════
//   • google_sign_in (móvil) se reemplaza por Google Identity
//     Services (GIS) para la web, cargado dinámicamente desde
//     accounts.google.com/gsi/client — no requiere <script> en
//     index.html.
//   • No hay refresh token persistente (el flujo de token implícito
//     de GIS en el navegador no lo entrega de forma segura): cada
//     respaldo/restauración pide un access token, primero en modo
//     silencioso (prompt vacío) y si falla, en modo interactivo.
//   • googleapis (paquete Dart) se reemplaza por llamadas fetch()
//     directas a la API REST de Drive v3.
//   • package:encrypt y package:crypto se reemplazan por
//     crypto.subtle (Web Crypto API): la derivación de clave usa el
//     algoritmo nativo 'HKDF', que produce exactamente el mismo
//     resultado que el doble HMAC-SHA256 manual del lado Dart
//     (HKDF-Extract + HKDF-Expand de un solo bloque).
//   • GZipCodec (dart:io) se reemplaza por CompressionStream /
//     DecompressionStream('gzip') — mismo contenedor gzip estándar,
//     compatible en ambos sentidos.
//   • La foto/email de la cuenta vinculada se obtiene del endpoint
//     userinfo de Google (scope 'openid email profile'), no del
//     objeto de GoogleSignInAccount (que no existe en la web).
//
// ═════════════════════════════════════════════════════════════════
// REQUIERE CONFIGURAR ANTES DE USAR
// ═════════════════════════════════════════════════════════════════
//   1. Ese cliente ("Jaguar Chat Web Client") debe tener tu dominio
//      (y localhost si pruebas en local) en "Authorized JavaScript
//      origins", en Google Cloud Console → Credenciales.
//   2. La Google Drive API debe estar habilitada en el proyecto
//      (APIs y servicios → Biblioteca → Google Drive API).
//
// ═════════════════════════════════════════════════════════════════
// CAMBIOS
// ═════════════════════════════════════════════════════════════════
//   - Archivo nuevo.
//   - CLIENT_ID reemplazado con el valor real de "Jaguar Chat Web
//     Client" (Google Cloud Console, proyecto programix-navejl).

import { supabaseClient } from '../../core/supabase-client.js';
import {
  obtenerTodos as dbObtenerTodos,
  guardar,
  TABLA_CHATS,
  TABLA_MENSAJES,
} from './servicios/db-service.js';

// ── Configuración ────────────────────────────────────────────────

const CLIENT_ID = '773599655241-hbi4ku82lh3vrb5hh8apdmueensbp87a.apps.googleusercontent.com';

const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.appdata';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

const NOMBRE_ARCHIVO = 'jaguarchat_backup.enc';

const CLAVE_EMAIL = 'jaguarchat_backup_google_email';
const CLAVE_FOTO = 'jaguarchat_backup_google_foto';

// Misma sal/info que backup_service.dart — deben coincidir exacto,
// si no, los backups cifrados en un lado no se pueden leer en el otro.
const SAL_HKDF = 'jaguarchat-backup-v2';
const INFO_HKDF = 'aes-256-cbc-backup-key';

// ── Estado del módulo ────────────────────────────────────────────

let uidCache = null;
let gisListo = null;
let tokenActual = null;
let tokenExpiraEn = 0; // epoch ms

// Se suscribe apenas se importa el módulo, así cuentaGoogleGuardada()
// (que debe ser síncrona, igual que en ajustes-chat-screen.js) ya
// tiene el uid disponible para cuando se le llama tras el primer
// await de la pantalla que la usa.
supabaseClient.auth.onAuthStateChange((_evento, session) => {
  uidCache = session?.user?.id ?? null;
});
supabaseClient.auth.getSession().then(({ data }) => {
  uidCache = data?.session?.user?.id ?? null;
});

// ─────────────────────────────────────────────────────────────────
// CUENTA DE GOOGLE
// ─────────────────────────────────────────────────────────────────

function claveUsuario(base) {
  return `${base}_${uidCache ?? ''}`;
}

function leerLocal(clave) {
  try { return localStorage.getItem(clave); } catch { return null; }
}

function escribirLocal(clave, valor) {
  try { localStorage.setItem(clave, valor); } catch { /* almacenamiento no disponible */ }
}

function borrarLocal(clave) {
  try { localStorage.removeItem(clave); } catch { /* almacenamiento no disponible */ }
}

function guardarCuenta(email, foto) {
  escribirLocal(claveUsuario(CLAVE_EMAIL), email);
  if (foto) escribirLocal(claveUsuario(CLAVE_FOTO), foto);
  else borrarLocal(claveUsuario(CLAVE_FOTO));
}

function borrarCuenta() {
  borrarLocal(claveUsuario(CLAVE_EMAIL));
  borrarLocal(claveUsuario(CLAVE_FOTO));
}

/** Cuenta vinculada guardada localmente, o null. Síncrona a propósito. */
export function cuentaGoogleGuardada() {
  const email = leerLocal(claveUsuario(CLAVE_EMAIL));
  if (!email) return null;
  return { email, foto: leerLocal(claveUsuario(CLAVE_FOTO)) };
}

// ─────────────────────────────────────────────────────────────────
// GOOGLE IDENTITY SERVICES (carga + token)
// ─────────────────────────────────────────────────────────────────

function cargarGis() {
  if (gisListo) return gisListo;
  gisListo = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('no-se-pudo-cargar-google'));
    document.head.appendChild(script);
  });
  return gisListo;
}

// Envuelve initTokenClient/requestAccessToken (basados en callback)
// en una promesa de un solo uso.
function solicitarToken(prompt) {
  return new Promise((resolve, reject) => {
    try {
      const cliente = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        prompt,
        callback: (resp) => {
          if (resp?.error) reject(new Error(resp.error));
          else resolve(resp);
        },
        error_callback: (err) => reject(new Error(err?.type || 'popup-cerrado')),
      });
      cliente.requestAccessToken({ prompt });
    } catch (error) {
      reject(error);
    }
  });
}

function guardarToken(resp) {
  tokenActual = resp.access_token;
  tokenExpiraEn = Date.now() + (Number(resp.expires_in) || 3500) * 1000;
}

/**
 * Devuelve un access token vigente. Primero intenta reusar el actual
 * o pedir uno silencioso (equivalente a
 * attemptLightweightAuthentication() en Dart); si falla y
 * `interactivo` es true, cae a un flujo con consentimiento visible.
 */
async function obtenerAccessToken({ interactivo }) {
  if (tokenActual && Date.now() < tokenExpiraEn - 60_000) return tokenActual;

  await cargarGis();

  try {
    const resp = await solicitarToken('');
    guardarToken(resp);
    return tokenActual;
  } catch (errorSilencioso) {
    if (!interactivo) throw errorSilencioso;
    const resp = await solicitarToken('consent');
    guardarToken(resp);
    return tokenActual;
  }
}

async function obtenerPerfilGoogle(token) {
  const resp = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`userinfo-${resp.status}`);
  return resp.json();
}

/** Inicia el flujo de vinculación (siempre interactivo/con consentimiento). */
export async function vincularGoogle() {
  await cargarGis();
  const resp = await solicitarToken('consent');
  guardarToken(resp);

  const perfil = await obtenerPerfilGoogle(tokenActual);
  guardarCuenta(perfil.email, perfil.picture ?? null);
  return { email: perfil.email, foto: perfil.picture ?? null };
}

/** Desvincula la cuenta: revoca el token en Google y limpia lo local. */
export async function desvincularGoogle() {
  if (tokenActual && window.google?.accounts?.oauth2) {
    try {
      await new Promise((resolve) => {
        window.google.accounts.oauth2.revoke(tokenActual, resolve);
      });
    } catch { /* si falla la revocación remota, igual limpiamos localmente */ }
  }
  tokenActual = null;
  tokenExpiraEn = 0;
  borrarCuenta();
}

// ─────────────────────────────────────────────────────────────────
// GOOGLE DRIVE (appDataFolder)
// ─────────────────────────────────────────────────────────────────

async function buscarArchivoBackup(token) {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${NOMBRE_ARCHIVO}'`,
    fields: 'files(id)',
  });
  const resp = await fetch(`${DRIVE_FILES}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`drive-list-${resp.status}`);
  const data = await resp.json();
  return data.files?.[0]?.id ?? null;
}

async function subirArchivoBackup(token, bytes, idExistente) {
  // Actualización: solo el contenido cambia, el nombre/carpeta ya existen.
  if (idExistente) {
    const resp = await fetch(`${DRIVE_UPLOAD}/${idExistente}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: bytes,
    });
    if (!resp.ok) throw new Error(`drive-update-${resp.status}`);
    return;
  }

  // Creación: multipart para mandar metadata (nombre + carpeta) y
  // contenido en una sola petición.
  const boundary = `jaguarchat_${Date.now()}`;
  const metadata = JSON.stringify({ name: NOMBRE_ARCHIVO, parents: ['appDataFolder'] });
  const cuerpo = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    bytes,
    `\r\n--${boundary}--`,
  ]);

  const resp = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: cuerpo,
  });
  if (!resp.ok) throw new Error(`drive-create-${resp.status}`);
}

async function descargarArchivoBackup(token, id) {
  const resp = await fetch(`${DRIVE_FILES}/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`drive-download-${resp.status}`);
  return new Uint8Array(await resp.arrayBuffer());
}

// ─────────────────────────────────────────────────────────────────
// COMPRESIÓN (gzip, igual formato que GZipCodec de Dart)
// ─────────────────────────────────────────────────────────────────

async function comprimirGzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function descomprimirGzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ─────────────────────────────────────────────────────────────────
// CIFRADO (AES-256-CBC, clave derivada por HKDF — igual que Dart)
// ─────────────────────────────────────────────────────────────────

/**
 * Deriva la clave AES-256 a partir del uid de Supabase usando HKDF
 * nativo (Web Crypto). Con largo de salida de 32 bytes (un solo
 * bloque SHA-256), HKDF-Expand equivale exactamente al
 * HMAC(PRK, info || 0x01) que hace backup_service.dart a mano —
 * mismo resultado byte a byte con la misma sal e info.
 */
async function claveAESDesdeUid(uid) {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', enc.encode(uid), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(SAL_HKDF), info: enc.encode(INFO_HKDF) },
    material,
    256,
  );
  return crypto.subtle.importKey('raw', bits, 'AES-CBC', false, ['encrypt', 'decrypt']);
}

/** Cifra (PKCS7 vía Web Crypto) anteponiendo el IV aleatorio de 16 bytes. */
async function cifrarAES(uid, datos) {
  const key = await claveAESDesdeUid(uid);
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, datos));

  const salida = new Uint8Array(iv.length + cifrado.length);
  salida.set(iv, 0);
  salida.set(cifrado, iv.length);
  return salida;
}

async function descifrarAES(uid, datos) {
  if (datos.length < 17) throw new Error('backup-corrupto');
  const iv = datos.slice(0, 16);
  const cuerpo = datos.slice(16);
  try {
    const key = await claveAESDesdeUid(uid);
    const plano = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, cuerpo);
    return new Uint8Array(plano);
  } catch {
    throw new Error('backup-descifrado-fallido');
  }
}

// ─────────────────────────────────────────────────────────────────
// SERIALIZACIÓN (equivalente a Chat.toJson/fromJson y Mensaje.toJson/fromJson)
// ─────────────────────────────────────────────────────────────────

function chatABackup(c) {
  return {
    otroUsuarioId: c.otroUsuarioId,
    otroNombre: c.otroNombre,
    otroNombreUsuario: c.otroNombreUsuario ?? null,
    otroAvatarUrl: c.otroAvatarUrl ?? null,
    ultimoMensaje: c.ultimoMensaje ?? null,
    ultimaFecha: c.ultimaFecha ?? null,
    noLeidos: c.noLeidos ?? 0,
    fijado: c.fijado ?? false,
    silenciado: c.silenciado ?? false,
    archivado: c.archivado ?? false,
  };
}

// Defensivo con valores por defecto: igual que Chat.fromJson en Dart,
// para no romper la restauración si un backup viejo trae campos faltantes.
function chatDesdeBackup(j) {
  return {
    otroUsuarioId: j.otroUsuarioId,
    otroNombre: j.otroNombre ?? 'Usuario',
    otroNombreUsuario: j.otroNombreUsuario ?? null,
    otroAvatarUrl: j.otroAvatarUrl ?? null,
    ultimoMensaje: j.ultimoMensaje ?? null,
    ultimaFecha: j.ultimaFecha ?? null,
    noLeidos: Number(j.noLeidos ?? 0),
    fijado: Boolean(j.fijado ?? false),
    silenciado: Boolean(j.silenciado ?? false),
    archivado: Boolean(j.archivado ?? false),
  };
}

function mensajeABackup(m) {
  return {
    mensajeId: m.mensajeId,
    chatOtroUsuarioId: m.chatOtroUsuarioId,
    emisorId: m.emisorId,
    contenido: m.contenido ?? null,
    tipo: m.tipo,
    mediaUrlRemota: m.mediaUrlRemota ?? null,
    mediaNombreArchivo: m.mediaNombreArchivo ?? null,
    mediaTamanioBytes: m.mediaTamanioBytes ?? null,
    mediaDuracionMs: m.mediaDuracionMs ?? null,
    mediaAncho: m.mediaAncho ?? null,
    mediaAlto: m.mediaAlto ?? null,
    mediaThumbnailUrl: m.mediaThumbnailUrl ?? null,
    timestamp: m.timestamp,
    estado: m.estado,
    contextoDescripcion: m.contextoDescripcion ?? null,
    contextoImagenUrl: m.contextoImagenUrl ?? null,
    contextoLugar: m.contextoLugar ?? null,
    contextoObjetoId: m.contextoObjetoId ?? null,
    contextoTipo: m.contextoTipo ?? null,
    respuestaAMensajeId: m.respuestaAMensajeId ?? null,
    respuestaAContenido: m.respuestaAContenido ?? null,
    respuestaATipo: m.respuestaATipo ?? null,
    respuestaAEmisorId: m.respuestaAEmisorId ?? null,
    editado: m.editado ?? false,
    eliminado: m.eliminado ?? false,
    reaccionesRaw: m.reaccionesRaw ?? null,
  };
}

function mensajeDesdeBackup(j) {
  return {
    mensajeId: j.mensajeId,
    chatOtroUsuarioId: j.chatOtroUsuarioId,
    emisorId: j.emisorId,
    contenido: j.contenido ?? null,
    tipo: j.tipo ?? 'texto',
    mediaUrlRemota: j.mediaUrlRemota ?? null,
    mediaNombreArchivo: j.mediaNombreArchivo ?? null,
    mediaTamanioBytes: j.mediaTamanioBytes ?? null,
    mediaDuracionMs: j.mediaDuracionMs ?? null,
    mediaAncho: j.mediaAncho ?? null,
    mediaAlto: j.mediaAlto ?? null,
    mediaThumbnailUrl: j.mediaThumbnailUrl ?? null,
    timestamp: j.timestamp,
    estado: j.estado ?? 'recibido',
    contextoDescripcion: j.contextoDescripcion ?? null,
    contextoImagenUrl: j.contextoImagenUrl ?? null,
    contextoLugar: j.contextoLugar ?? null,
    contextoObjetoId: j.contextoObjetoId ?? null,
    contextoTipo: j.contextoTipo ?? null,
    respuestaAMensajeId: j.respuestaAMensajeId ?? null,
    respuestaAContenido: j.respuestaAContenido ?? null,
    respuestaATipo: j.respuestaATipo ?? null,
    respuestaAEmisorId: j.respuestaAEmisorId ?? null,
    editado: Boolean(j.editado ?? false),
    eliminado: Boolean(j.eliminado ?? false),
    reaccionesRaw: j.reaccionesRaw ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────
// BACKUP / RESTAURAR
// ─────────────────────────────────────────────────────────────────

/** Ejecuta el backup completo y devuelve el tamaño en bytes subido. */
export async function respaldarEnGoogleDrive() {
  const uid = uidCache;
  if (!uid) throw new Error('sin-sesion');

  const [chats, mensajes] = await Promise.all([
    dbObtenerTodos(TABLA_CHATS),
    dbObtenerTodos(TABLA_MENSAJES),
  ]);

  const payload = {
    version: 2,
    exportado_en: new Date().toISOString(),
    chats: chats.map(chatABackup),
    mensajes: mensajes.map(mensajeABackup),
  };

  const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
  const comprimido = await comprimirGzip(jsonBytes);
  const cifrado = await cifrarAES(uid, comprimido);

  const token = await obtenerAccessToken({ interactivo: true });
  const idExistente = await buscarArchivoBackup(token);
  await subirArchivoBackup(token, cifrado, idExistente);

  return cifrado.length;
}

/** Descarga el backup y fusiona chats/mensajes en IndexedDB (no borra nada). */
export async function restaurarDesdeGoogleDrive() {
  const uid = uidCache;
  if (!uid) throw new Error('sin-sesion');

  const token = await obtenerAccessToken({ interactivo: true });
  const id = await buscarArchivoBackup(token);
  if (!id) throw new Error('No se encontró ningún backup en Google Drive');

  const cifrado = await descargarArchivoBackup(token, id);
  const comprimido = await descifrarAES(uid, cifrado);
  const jsonStr = new TextDecoder().decode(await descomprimirGzip(comprimido));
  const payload = JSON.parse(jsonStr);

  const chats = (payload.chats ?? []).map(chatDesdeBackup);
  const mensajes = (payload.mensajes ?? []).map(mensajeDesdeBackup);

  for (const chat of chats) await guardar(TABLA_CHATS, chat);
  for (const mensaje of mensajes) await guardar(TABLA_MENSAJES, mensaje);
}

// ─────────────────────────────────────────────────────────────────
// MENSAJES DE ERROR LEGIBLES
// ─────────────────────────────────────────────────────────────────

export function mensajeErrorGoogle(err) {
  const msg = String(err?.message ?? err ?? '');

  if (msg === 'No se encontró ningún backup en Google Drive') return msg;
  if (msg === 'backup-descifrado-fallido') {
    return 'No se pudo descifrar el backup. Asegúrate de restaurar con la misma cuenta con la que se creó.';
  }
  if (msg === 'backup-corrupto') return 'Archivo de backup inválido o corrupto';
  if (msg === 'sin-sesion') return 'No se pudo vincular la cuenta';
  if (msg === 'no-se-pudo-cargar-google') return 'No se pudo cargar el inicio de sesión de Google, revisa tu conexión';
  if (msg.includes('popup') || msg === 'access_denied') return 'Se canceló el inicio de sesión con Google';
  if (msg.startsWith('drive-') || msg.startsWith('userinfo-')) return 'No se pudo conectar con Google Drive, intenta de nuevo';

  return 'No se pudo completar la operación con Google';
}