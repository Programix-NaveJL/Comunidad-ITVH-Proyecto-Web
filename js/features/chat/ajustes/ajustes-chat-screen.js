// ═════════════════════════════════════════════════════════════════
// ajustes-chat-screen.js
// Ubicación: js/features/chat/ajustes/ajustes-chat-screen.js
// Estilos:   css/chat/ajustes-chat.css
//
// ═════════════════════════════════════════════════════════════════
// PROPÓSITO
// ═════════════════════════════════════════════════════════════════
// Pestaña "Ajustes" de JaguarChat. Puerto web de
// configuracion_screen.dart (ConfiguracionScreen): archivados,
// notificaciones push, cuenta de Google, copias de seguridad en
// Google Drive y cierre de sesión.
//
// Se monta desde jaguar-chat-principal.js cuando la sección
// "ajustes" asoma por primera vez:
//
//   import('./ajustes/ajustes-chat-screen.js').then(({ render }) => render(panel));
//
// ═════════════════════════════════════════════════════════════════
// RESPONSABILIDADES
// ═════════════════════════════════════════════════════════════════
//   1. CHATS: acceso a "Chats archivados" con badge de conteo. La
//      lista de archivados se muestra como una vista interna del
//      propio panel (con su flecha de regreso) y permite desarchivar.
//   2. NOTIFICACIONES: activar / desactivar las notificaciones push
//      de este navegador (Firebase Cloud Messaging vía push-web.js).
//   3. CUENTA DE GOOGLE: vincular / desvincular. Es requisito para
//      las copias de seguridad.
//   4. COPIAS DE SEGURIDAD: fecha y tamaño del último backup,
//      "Respaldar ahora" y "Restaurar conversaciones" (Google Drive,
//      formato v2 compatible con la app móvil).
//   5. CERRAR SESIÓN: quita el token push de este navegador,
//      desconecta Google, cierra sesión en Supabase y lleva a
//      /login. El historial local se conserva.
//
// ═════════════════════════════════════════════════════════════════
// DEPENDENCIAS — contrato que este archivo espera de cada una
// ═════════════════════════════════════════════════════════════════
//   chat-repository.js (../chat-repository.js — AJUSTAR RUTA si difiere)
//     • contarArchivados()      → Promise<number>
//     • obtenerArchivados()     → Promise<Array<{ otroUsuarioId,
//                                  otroNombre, otroAvatarUrl,
//                                  ultimoMensaje }>>
//     • toggleArchivado(id)     → Promise<void>
//
//   Servicio de backup (../chat-google-backup-service.js — AJUSTAR
//   RUTA si difiere)
//     • cuentaGoogleGuardada()  → { email, foto } | null
//     • vincularGoogle()        → Promise<{ email, foto }>
//     • desvincularGoogle()     → Promise<void>
//     • respaldarEnGoogleDrive()→ Promise<number>  (bytes subidos)
//     • restaurarDesdeGoogleDrive() → Promise<void>
//     • mensajeErrorGoogle(err) → string legible para el usuario
//
//   push-web.js (js/core/push-web.js)
//     • activarNotificacionesWeb(uid)   → Promise<string | null>
//         (pide permiso, obtiene el token FCM y lo guarda en
//          push_tokens; null si no se pudo, ya avisó con un toast)
//     • reactivarSiHayPermiso(uid)      → Promise<string | null>
//     • desactivarNotificacionesWeb()   → Promise<void>
//
// ═════════════════════════════════════════════════════════════════
// DIFERENCIAS INTENCIONALES RESPECTO A FLUTTER
// ═════════════════════════════════════════════════════════════════
//   • "Chats archivados" no es una pantalla aparte (Navigator.push):
//     es una vista dentro del mismo panel, así se conserva el layout
//     y el pill de navegación de JaguarChat.
//   • Los AlertDialog se sustituyen por un modal propio (confirmar()).
//   • Los SnackBar se sustituyen por mostrarToast() del proyecto.
//   • La fecha y el tamaño del último backup viven en localStorage,
//     con clave POR USUARIO (uid), para que dos cuentas en el mismo
//     navegador no vean el backup de la otra.
//   • Como el panel se mantiene vivo entre visitas a la pestaña, los
//     metadatos (p. ej. el conteo de archivados) se refrescan cada
//     vez que la pestaña vuelve a mostrarse.
//
// ═════════════════════════════════════════════════════════════════
// NOTIFICACIONES PUSH — cómo se decide el estado
// ═════════════════════════════════════════════════════════════════
//   El navegador expone Notification.permission ('default' |
//   'granted' | 'denied'). Eso solo dice si el sitio TIENE permiso,
//   no si ESTA cuenta quiere recibir avisos, así que además se guarda
//   un indicador por usuario en localStorage (CLAVE_PUSH):
//
//     no soportado                 → fila deshabilitada.
//     denied                       → fila deshabilitada + instrucciones
//                                    (solo el usuario puede
//                                    desbloquearlo desde el candado).
//     default, o granted sin marca → "Activar notificaciones".
//     granted + marca              → "Activadas" + botón Desactivar.
//
//   Desactivar borra el token de push_tokens y de FCM, pero el
//   navegador NO permite revocar el permiso por código: sigue en
//   'granted' y por eso hace falta la marca.
//
//   Con la marca puesta y el permiso concedido, al montar la pantalla
//   se vuelve a registrar el token en segundo plano (puede rotar, y
//   además reengancha el aviso en primer plano tras recargar).
//
// ═════════════════════════════════════════════════════════════════
// CAMBIOS
// ═════════════════════════════════════════════════════════════════
//   - Archivo nuevo.
//   - Corregido import: chat-repository.js exporta funciones sueltas
//     (contarArchivados, obtenerArchivados, toggleArchivado), no un
//     objeto ChatRepository — causaba SyntaxError al cargar el módulo.
//   - Sección NOTIFICACIONES: activar / desactivar push web. Al
//     cerrar sesión se quita el token de este navegador para que el
//     siguiente usuario no reciba los avisos de esta cuenta.

import { supabaseClient } from '../../../core/supabase-client.js';
import { navegarA } from '../../../core/router.js';
import { mostrarToast } from '../../../core/toast.js';
import {
  activarNotificacionesWeb,
  reactivarSiHayPermiso,
  desactivarNotificacionesWeb,
} from '../../../core/push-web.js';
import {
  contarArchivados,
  obtenerArchivados,
  toggleArchivado,
} from '../chat-repository.js';
import {
  cuentaGoogleGuardada,
  vincularGoogle,
  desvincularGoogle,
  respaldarEnGoogleDrive,
  restaurarDesdeGoogleDrive,
  mensajeErrorGoogle,
} from '../chat-google-backup-service.js';

const CLAVE_FECHA = 'jaguarchat_backup_ultima_fecha';
const CLAVE_TAMANIO = 'jaguarchat_backup_tamanio_bytes';
const CLAVE_PUSH = 'jaguarchat_push_activo';

// ─────────────────────────────────────────────────────────────────
// ESTADO DEL MÓDULO (se reinicia en cada render())
// ─────────────────────────────────────────────────────────────────
let panelActual = null;
let raiz = null;
let uid = null;
let vista = 'principal'; // 'principal' | 'archivados'

let totalArchivados = 0;
let ultimoBackup = null;   // Date | null
let tamanioBackup = 0;     // bytes
let cuentaGoogle = null;   // { email, foto } | null

let permisoNotif = 'default'; // 'default' | 'granted' | 'denied' | 'no-soportado'
let notifActiva = false;      // permiso concedido + esta cuenta la activó
let activandoNotif = false;

let vinculando = false;
let haciendoBackup = false;
let restaurando = false;

let chatsArchivados = [];
let cargandoArchivados = false;

function reiniciarEstado() {
  vista = 'principal';
  totalArchivados = 0;
  ultimoBackup = null;
  tamanioBackup = 0;
  cuentaGoogle = null;
  permisoNotif = 'default';
  notifActiva = false;
  activandoNotif = false;
  vinculando = false;
  haciendoBackup = false;
  restaurando = false;
  chatsArchivados = [];
  cargandoArchivados = false;
}

// ─────────────────────────────────────────────────────────────────
// PUNTO DE ENTRADA
// ─────────────────────────────────────────────────────────────────

export async function render(panel) {
  reiniciarEstado();
  panelActual = panel;
  panel.innerHTML = '<div class="jca-root" id="jca-root"></div>';
  raiz = panel.querySelector('#jca-root');

  raiz.addEventListener('click', alClick);
  observarVisibilidad(panel);

  const { data: { session } } = await supabaseClient.auth.getSession();
  uid = session?.user?.id ?? null;

  await cargarMetadatos();
  pintar();

  // Si esta cuenta ya había activado las notificaciones, se vuelve a
  // registrar el token en segundo plano (sin preguntar de nuevo).
  if (notifActiva && uid) {
    reactivarSiHayPermiso(uid).catch(() => { /* ya avisó push-web.js */ });
  }
}

// El panel sigue vivo mientras el usuario está en otra sección de
// JaguarChat (jaguar-chat-principal.js solo alterna la clase
// .visible). Cuando vuelve a mostrarse se refrescan los metadatos:
// el conteo de archivados pudo cambiar desde la pestaña Chats.
function observarVisibilidad(panel) {
  new MutationObserver(() => {
    if (panel.classList.contains('visible')) refrescarAlMostrar();
  }).observe(panel, { attributes: true, attributeFilter: ['class'] });
}

async function refrescarAlMostrar() {
  if (vista !== 'principal' || vinculando || haciendoBackup || restaurando || activandoNotif) return;
  await cargarMetadatos();
  if (vista === 'principal') pintar();
}

// ─────────────────────────────────────────────────────────────────
// CARGA DE DATOS
// ─────────────────────────────────────────────────────────────────

function claveUsuario(base) {
  return `${base}_${uid ?? ''}`;
}

function leerLocal(clave) {
  try { return localStorage.getItem(clave); } catch { return null; }
}

function escribirLocal(clave, valor) {
  try { localStorage.setItem(clave, valor); } catch { /* almacenamiento no disponible */ }
}

// Permiso actual del navegador para notificaciones. 'no-soportado'
// cubre navegadores sin Notification o sin service workers (las
// push web necesitan ambos), y contextos no seguros (http fuera de
// localhost).
function leerPermisoNotif() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'no-soportado';
  return Notification.permission;
}

function refrescarEstadoNotif() {
  permisoNotif = leerPermisoNotif();
  notifActiva = permisoNotif === 'granted' && leerLocal(claveUsuario(CLAVE_PUSH)) === '1';
}

async function cargarMetadatos() {
  const fechaRaw = leerLocal(claveUsuario(CLAVE_FECHA));
  const fecha = fechaRaw ? new Date(fechaRaw) : null;
  ultimoBackup = fecha && !Number.isNaN(fecha.getTime()) ? fecha : null;
  tamanioBackup = Number(leerLocal(claveUsuario(CLAVE_TAMANIO)) || 0);
  cuentaGoogle = cuentaGoogleGuardada();
  refrescarEstadoNotif();

  try {
    totalArchivados = await contarArchivados();
  } catch (error) {
    console.error('ajustes-chat – contarArchivados:', error);
    totalArchivados = 0;
  }
}

function guardarMetadatosBackup(bytes) {
  ultimoBackup = new Date();
  tamanioBackup = bytes;
  escribirLocal(claveUsuario(CLAVE_FECHA), ultimoBackup.toISOString());
  escribirLocal(claveUsuario(CLAVE_TAMANIO), String(bytes));
}

// ─────────────────────────────────────────────────────────────────
// PINTADO
// ─────────────────────────────────────────────────────────────────

function pintar() {
  if (!raiz) return;
  raiz.innerHTML = vista === 'archivados' ? plantillaArchivados() : plantillaPrincipal();
}

// Fila de acción dentro de una tarjeta: ícono, texto y, al final, un
// spinner (cargando), un `extra` (p. ej. el badge) o la flecha.
function fila({ accion, icono, etiqueta, cargando = false, deshabilitada = false, extra = '' }) {
  const final = cargando
    ? '<span class="jca-spinner" aria-hidden="true"></span>'
    : (extra || '<span class="jca-fila__flecha">›</span>');
  return `
    <button type="button" class="jca-fila" data-accion="${accion}"${deshabilitada ? ' disabled' : ''}>
      <span class="jca-fila__icono">${icono}</span>
      <span class="jca-fila__label">${etiqueta}</span>
      ${final}
    </button>
  `;
}

// Contenido de la tarjeta de NOTIFICACIONES y la nota que la sigue,
// según el estado (ver "NOTIFICACIONES PUSH" en la cabecera).
function bloqueNotificaciones() {
  if (permisoNotif === 'no-soportado') {
    return {
      tarjeta: fila({
        accion: 'notif-no-disponible',
        icono: '🔕',
        etiqueta: 'No disponibles en este navegador',
        deshabilitada: true,
        extra: '<span></span>',
      }),
      nota: 'Este navegador no admite notificaciones push. Prueba con Chrome, Edge o Firefox, y recuerda que necesitan una conexión segura (HTTPS).',
    };
  }

  if (permisoNotif === 'denied') {
    return {
      tarjeta: fila({
        accion: 'notif-bloqueadas',
        icono: '🔕',
        etiqueta: 'Bloqueadas en el navegador',
        deshabilitada: true,
        extra: '<span></span>',
      }),
      nota: 'Bloqueaste las notificaciones de este sitio. Para activarlas, pulsa el candado junto a la dirección, cambia "Notificaciones" a "Permitir" y recarga la página.',
    };
  }

  if (notifActiva) {
    return {
      tarjeta: `
        <div class="jca-cuenta">
          <span class="jca-cuenta__avatar">🔔</span>
          <span class="jca-cuenta__info">
            <span class="jca-cuenta__titulo">Notificaciones activadas</span>
            <span class="jca-cuenta__email">En este navegador</span>
          </span>
          <button type="button" class="jca-desvincular" data-accion="desactivar-notif">Desactivar</button>
        </div>
      `,
      nota: 'Recibirás avisos de mensajes, reacciones, comentarios y seguidores aunque tengas la pestaña en segundo plano.',
    };
  }

  return {
    tarjeta: fila({
      accion: 'activar-notif',
      icono: '🔔',
      etiqueta: 'Activar notificaciones',
      cargando: activandoNotif,
      deshabilitada: activandoNotif,
    }),
    nota: 'Te avisaremos de mensajes, reacciones, comentarios y seguidores aunque tengas la pestaña en segundo plano.',
  };
}

function plantillaPrincipal() {
  const ocupado = haciendoBackup || restaurando;
  const notif = bloqueNotificaciones();

  const bloqueCuenta = cuentaGoogle
    ? `
      <div class="jca-cuenta">
        <span class="jca-cuenta__avatar">
          ${cuentaGoogle.foto ? `<img src="${esc(cuentaGoogle.foto)}" alt="" referrerpolicy="no-referrer" />` : '👤'}
        </span>
        <span class="jca-cuenta__info">
          <span class="jca-cuenta__titulo">Google Drive</span>
          <span class="jca-cuenta__email">${esc(cuentaGoogle.email)}</span>
        </span>
        <button type="button" class="jca-desvincular" data-accion="desvincular">Desvincular</button>
      </div>
    `
    : fila({
        accion: 'vincular',
        icono: '👤',
        etiqueta: 'Vincular cuenta de Google',
        cargando: vinculando,
        deshabilitada: vinculando,
      });

  return `
    <section class="jca-bloque">
      <p class="jca-seccion">CHATS</p>
      <div class="jca-tarjeta">
        ${fila({
          accion: 'abrir-archivados',
          icono: '🗃️',
          etiqueta: 'Chats archivados',
          extra: totalArchivados > 0 ? `<span class="jca-badge">${totalArchivados}</span>` : '',
        })}
      </div>
    </section>

    <section class="jca-bloque">
      <p class="jca-seccion">
        NOTIFICACIONES
        <span class="jca-seccion__sub">Avisos push en este navegador</span>
      </p>
      <div class="jca-tarjeta">${notif.tarjeta}</div>
      <p class="jca-nota">${notif.nota}</p>
    </section>

    <section class="jca-bloque">
      <p class="jca-seccion">
        CUENTA DE GOOGLE
        <span class="jca-seccion__sub">Necesaria para las copias de seguridad</span>
      </p>
      <div class="jca-tarjeta">${bloqueCuenta}</div>
    </section>

    <section class="jca-bloque">
      <p class="jca-seccion">
        COPIAS DE SEGURIDAD
        <span class="jca-seccion__sub">Se guardan en tu Google Drive privado</span>
      </p>
      <div class="jca-tarjeta">
        <div class="jca-respaldo-info">
          <span class="jca-respaldo-info__icono">☁️</span>
          <span class="jca-respaldo-info__texto">
            <span class="jca-respaldo-info__titulo">
              ${ultimoBackup ? `Último backup: ${formatearFecha(ultimoBackup)}` : 'Sin backup todavía'}
            </span>
            ${tamanioBackup > 0 ? `<span class="jca-respaldo-info__tamanio">${formatearBytes(tamanioBackup)}</span>` : ''}
          </span>
        </div>
        <div class="jca-divisor"></div>
        ${fila({ accion: 'respaldar', icono: '📤', etiqueta: 'Respaldar ahora', cargando: haciendoBackup, deshabilitada: ocupado })}
        <div class="jca-divisor"></div>
        ${fila({ accion: 'restaurar', icono: '🔄', etiqueta: 'Restaurar conversaciones', cargando: restaurando, deshabilitada: ocupado })}
      </div>
      <p class="jca-nota">
        Las copias se guardan cifradas en el espacio privado de la app en tu
        Google Drive. El formato es compatible con JaguarChat móvil.
      </p>
    </section>

    <button type="button" class="jca-peligro" data-accion="cerrar-sesion">
      <span class="jca-peligro__icono">🚪</span>
      <span>Cerrar sesión</span>
    </button>
  `;
}

function plantillaArchivados() {
  let cuerpo;

  if (cargandoArchivados) {
    cuerpo = '<div class="jca-vacio"><span class="jca-spinner" aria-hidden="true"></span></div>';
  } else if (chatsArchivados.length === 0) {
    cuerpo = `
      <div class="jca-vacio">
        <span class="jca-vacio__icono">🗃️</span>
        <p>Sin chats archivados</p>
      </div>
    `;
  } else {
    cuerpo = chatsArchivados.map((chat) => {
      const nombre = chat.otroNombre || 'Usuario';
      const inicial = nombre.trim().charAt(0).toUpperCase() || '?';
      return `
        <div class="jca-chat">
          <div class="jca-chat__avatar">
            ${chat.otroAvatarUrl ? `<img src="${esc(chat.otroAvatarUrl)}" alt="" />` : esc(inicial)}
          </div>
          <div class="jca-chat__info">
            <p class="jca-chat__nombre">${esc(nombre)}</p>
            <p class="jca-chat__preview">${esc(chat.ultimoMensaje || 'Sin mensajes')}</p>
          </div>
          <button type="button" class="jca-chat__desarchivar" data-accion="desarchivar" data-id="${esc(chat.otroUsuarioId)}">
            Desarchivar
          </button>
        </div>
      `;
    }).join('');
  }

  return `
    <div class="jca-subheader">
      <button type="button" class="jca-volver" data-accion="volver-archivados" aria-label="Regresar">‹</button>
      <h2 class="jca-subheader__titulo">Archivados</h2>
    </div>
    <div class="jca-tarjeta jca-tarjeta--lista">${cuerpo}</div>
  `;
}

// ─────────────────────────────────────────────────────────────────
// INTERACCIONES (delegación: el contenido se repinta en cada cambio)
// ─────────────────────────────────────────────────────────────────

function alClick(evento) {
  const el = evento.target.closest('[data-accion]');
  if (!el || el.disabled) return;

  switch (el.dataset.accion) {
    case 'abrir-archivados': abrirArchivados(); break;
    case 'volver-archivados': cerrarArchivados(); break;
    case 'desarchivar': desarchivar(el.dataset.id); break;
    case 'activar-notif': activarNotificaciones(); break;
    case 'desactivar-notif': desactivarNotificaciones(); break;
    case 'vincular': vincularCuenta(); break;
    case 'desvincular': desvincularCuenta(); break;
    case 'respaldar': respaldarAhora(); break;
    case 'restaurar': restaurar(); break;
    case 'cerrar-sesion': cerrarSesionUsuario(); break;
    default: break;
  }
}

// ── Archivados ──────────────────────────────────────────────────

async function abrirArchivados() {
  vista = 'archivados';
  cargandoArchivados = true;
  chatsArchivados = [];
  pintar();
  panelActual.scrollTop = 0;

  try {
    chatsArchivados = await obtenerArchivados();
  } catch (error) {
    console.error('ajustes-chat – obtenerArchivados:', error);
    mostrarToast('No se pudieron cargar los chats archivados', 'error');
  }
  cargandoArchivados = false;
  if (vista === 'archivados') pintar();
}

async function cerrarArchivados() {
  vista = 'principal';
  await cargarMetadatos();
  pintar();
  panelActual.scrollTop = 0;
}

async function desarchivar(id) {
  if (!id) return;
  try {
    await toggleArchivado(id);
    chatsArchivados = await obtenerArchivados();
    totalArchivados = chatsArchivados.length;
    if (vista === 'archivados') pintar();
    mostrarToast('Chat desarchivado', 'success');
  } catch (error) {
    console.error('ajustes-chat – desarchivar:', error);
    mostrarToast('No se pudo desarchivar el chat', 'error');
  }
}

// ── Notificaciones push ─────────────────────────────────────────

// Debe dispararse desde un clic del usuario: el navegador solo deja
// mostrar el aviso de permiso tras una interacción. push-web.js se
// encarga del permiso, el service worker, el token y guardarlo en
// push_tokens; devuelve null (y avisa con su propio toast) si algo
// falla.
async function activarNotificaciones() {
  if (activandoNotif || !uid) return;
  activandoNotif = true;
  pintar();

  try {
    const token = await activarNotificacionesWeb(uid);
    if (token) {
      escribirLocal(claveUsuario(CLAVE_PUSH), '1');
      mostrarToast('Notificaciones activadas ✓', 'success');
    }
  } catch (error) {
    console.error('ajustes-chat – activar notificaciones:', error);
    mostrarToast('No se pudieron activar las notificaciones', 'error');
  } finally {
    activandoNotif = false;
    refrescarEstadoNotif();
    if (vista === 'principal') pintar();
  }
}

async function desactivarNotificaciones() {
  const ok = await confirmar({
    titulo: 'Desactivar notificaciones',
    cuerpo: 'Dejarás de recibir avisos en este navegador. El permiso del navegador se conserva, así que podrás volver a activarlas cuando quieras.',
    accion: 'Desactivar',
    peligro: true,
  });
  if (!ok) return;

  try {
    // Borra el token de push_tokens y de FCM. No revoca el permiso
    // del navegador (eso solo lo puede hacer el usuario).
    await desactivarNotificacionesWeb();
    try { localStorage.removeItem(claveUsuario(CLAVE_PUSH)); } catch { /* sin almacenamiento */ }
    mostrarToast('Notificaciones desactivadas', 'success');
  } catch (error) {
    console.error('ajustes-chat – desactivar notificaciones:', error);
    mostrarToast('No se pudieron desactivar las notificaciones', 'error');
  }
  refrescarEstadoNotif();
  if (vista === 'principal') pintar();
}

// ── Cuenta de Google ────────────────────────────────────────────

async function vincularCuenta() {
  if (vinculando) return;
  vinculando = true;
  pintar();

  try {
    cuentaGoogle = await vincularGoogle();
    mostrarToast(`Cuenta vinculada: ${cuentaGoogle.email}`, 'success');
  } catch (error) {
    console.error('ajustes-chat – vincular Google:', error);
    cuentaGoogle = cuentaGoogleGuardada();
    mostrarToast(mensajeErrorGoogle(error) || 'No se pudo vincular la cuenta', 'error');
  } finally {
    vinculando = false;
    if (vista === 'principal') pintar();
  }
}

// Si no hay cuenta vinculada, la pide primero (igual que Flutter);
// si el usuario cancela o falla, la operación que la necesitaba se
// aborta.
async function asegurarCuenta() {
  if (cuentaGoogle) return true;
  await vincularCuenta();
  return Boolean(cuentaGoogle);
}

async function desvincularCuenta() {
  const ok = await confirmar({
    titulo: 'Desvincular cuenta',
    cuerpo: 'Ya no se harán copias de seguridad con esta cuenta. Tu backup anterior en Google Drive se conserva.',
    accion: 'Desvincular',
    peligro: true,
  });
  if (!ok) return;

  try {
    await desvincularGoogle();
    cuentaGoogle = null;
    mostrarToast('Cuenta desvinculada', 'success');
  } catch (error) {
    console.error('ajustes-chat – desvincular Google:', error);
    mostrarToast('No se pudo desvincular la cuenta', 'error');
  }
  if (vista === 'principal') pintar();
}

// ── Copias de seguridad ─────────────────────────────────────────

async function respaldarAhora() {
  if (haciendoBackup || restaurando) return;
  if (!(await asegurarCuenta())) return;

  haciendoBackup = true;
  pintar();

  try {
    const bytes = await respaldarEnGoogleDrive();
    guardarMetadatosBackup(bytes);
    mostrarToast('Backup guardado en Google Drive ✓', 'success');
  } catch (error) {
    console.error('ajustes-chat – respaldar:', error);
    mostrarToast(mensajeErrorGoogle(error) || 'Error al respaldar', 'error');
  } finally {
    haciendoBackup = false;
    if (vista === 'principal') pintar();
  }
}

async function restaurar() {
  if (haciendoBackup || restaurando) return;
  if (!(await asegurarCuenta())) return;

  const ok = await confirmar({
    titulo: 'Restaurar conversaciones',
    cuerpo: 'Se importarán los chats y mensajes del backup. Los datos actuales no se borrarán, solo se fusionarán. ¿Continuar?',
    accion: 'Restaurar',
    peligro: false,
  });
  if (!ok) return;

  restaurando = true;
  pintar();

  try {
    await restaurarDesdeGoogleDrive();
    mostrarToast('Conversaciones restauradas ✓', 'success');
  } catch (error) {
    console.error('ajustes-chat – restaurar:', error);
    mostrarToast(mensajeErrorGoogle(error) || 'Error al restaurar', 'error');
  } finally {
    restaurando = false;
    await cargarMetadatos();
    if (vista === 'principal') pintar();
  }
}

// ── Cerrar sesión ───────────────────────────────────────────────

async function cerrarSesionUsuario() {
  const ok = await confirmar({
    titulo: 'Cerrar sesión',
    cuerpo: '¿Estás seguro? Tu historial local se conservará en este navegador.',
    accion: 'Cerrar sesión',
    peligro: true,
  });
  if (!ok) return;

  try {
    // El token push se quita ANTES de cerrar sesión: borrarlo de
    // push_tokens requiere una sesión activa. Sin esto, el siguiente
    // usuario de este navegador seguiría recibiendo los avisos de
    // esta cuenta. La marca CLAVE_PUSH se conserva a propósito: si
    // la misma cuenta vuelve a entrar, se reactiva sola (ver render).
    // desactivarNotificacionesWeb() captura sus propios errores.
    if (notifActiva) await desactivarNotificacionesWeb();

    // Se suelta también la cuenta de Google: en un navegador compartido
    // no debe quedar vinculada a la sesión del siguiente usuario.
    await desvincularGoogle();
    await supabaseClient.auth.signOut();
    navegarA('/login');
  } catch (error) {
    console.error('ajustes-chat – cerrar sesión:', error);
    mostrarToast(`Error al cerrar sesión: ${error?.message ?? error}`, 'error');
  }
}

// ─────────────────────────────────────────────────────────────────
// MODAL DE CONFIRMACIÓN (equivalente al AlertDialog del Dart)
// ─────────────────────────────────────────────────────────────────

/**
 * Muestra un diálogo de confirmación y resuelve true/false.
 * `peligro` pinta el botón de confirmar en rojo (acciones
 * destructivas) o en el color de acento (neutrales). Se cierra con
 * Cancelar, tocando fuera o con Escape.
 */
function confirmar({ titulo, cuerpo, accion, peligro = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'jca-dialogo-overlay';
    overlay.innerHTML = `
      <div class="jca-dialogo" role="dialog" aria-modal="true">
        <h3 class="jca-dialogo__titulo">${esc(titulo)}</h3>
        <p class="jca-dialogo__cuerpo">${esc(cuerpo)}</p>
        <div class="jca-dialogo__acciones">
          <button type="button" class="jca-dialogo__btn" data-resp="no">Cancelar</button>
          <button type="button" class="jca-dialogo__btn jca-dialogo__btn--${peligro ? 'peligro' : 'primario'}" data-resp="si">${esc(accion)}</button>
        </div>
      </div>
    `;

    function cerrar(valor) {
      document.removeEventListener('keydown', alTecla);
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 150);
      resolve(valor);
    }
    function alTecla(evento) {
      if (evento.key === 'Escape') cerrar(false);
    }

    overlay.addEventListener('click', (evento) => {
      if (evento.target === overlay) { cerrar(false); return; }
      const resp = evento.target.closest('[data-resp]')?.dataset.resp;
      if (resp) cerrar(resp === 'si');
    });
    document.addEventListener('keydown', alTecla);

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    overlay.querySelector('[data-resp="no"]').focus();
  });
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

// Escapa texto para usarlo tanto en contenido como en atributos.
function esc(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Fecha relativa y amigable (igual que _formatearFecha del Dart):
 * "hoy a las HH:mm", el nombre del día si fue en la última semana, o
 * la fecha completa en cualquier otro caso.
 */
function formatearFecha(fecha) {
  const dias = Math.floor((Date.now() - fecha.getTime()) / 86400000);
  const hora = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

  if (dias < 1) return `hoy a las ${hora}`;
  if (dias < 7) return `${fecha.toLocaleDateString('es-MX', { weekday: 'long' })} ${hora}`;
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Tamaño en bytes → B, KB o MB. */
function formatearBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}