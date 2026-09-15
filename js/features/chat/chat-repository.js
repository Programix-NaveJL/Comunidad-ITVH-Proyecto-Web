// ═════════════════════════════════════════════════════════════════
// chat-repository.js
//
// Réplica web de Pantallas/JaguarChat/Chats/chat_repository.dart.
// Capa de datos de la LISTA de chats (no de los mensajes dentro de
// uno — eso es mensaje-repository.js). Guarda/lee la tabla 'chats'
// de IndexedDB vía db-service.js: preview del último mensaje, no
// leídos, fijado, silenciado, archivado.
//
// watchChats()/watchTotalNoLeidos() imitan el patrón de Isar
// `.watch(fireImmediately: true)`: llaman al callback de inmediato
// con el estado actual y de nuevo cada vez que algo cambia. Se usan
// así (igual que en Dart, cambiando .listen() por watchChats()):
//
//   const cancelar = watchChats((chats) => { ...actualizar UI... });
//   // más adelante, al desmontar la pantalla:
//   cancelar();
// ═════════════════════════════════════════════════════════════════

import {
  TABLA_CHATS,
  TABLA_MENSAJES,
  suscribir,
  obtenerTodos as dbObtenerTodos,
  obtenerPorId,
  guardar,
  eliminarPorId,
  eliminarVarios,
  obtenerPorIndice,
} from './servicios/db-service.js';
import { crearChat } from './chat-model.js';

// ── Orden ────────────────────────────────────────────────────────
// Fijados primero, luego por fecha descendente — igual que
// watchChats() en Dart.
function ordenarChats(chats) {
  return [...chats].sort((a, b) => {
    if (a.fijado !== b.fijado) return a.fijado ? -1 : 1;
    if (!a.ultimaFecha && !b.ultimaFecha) return 0;
    if (!a.ultimaFecha) return 1;
    if (!b.ultimaFecha) return -1;
    return new Date(b.ultimaFecha) - new Date(a.ultimaFecha);
  });
}

// ── Streams ──────────────────────────────────────────────────────

/** Solo chats NO archivados, fijados primero, luego por fecha. */
export function watchChats(callback) {
  const emitir = async () => {
    const todos = await dbObtenerTodos(TABLA_CHATS);
    callback(ordenarChats(todos.filter((c) => !c.archivado)));
  };
  emitir();
  return suscribir(TABLA_CHATS, emitir);
}

/**
 * Suma total de mensajes no leídos entre todos los chats visibles
 * (excluye archivados, igual que watchChats). Pensado para el badge
 * del tab de Jaguares en el shell.
 */
export function watchTotalNoLeidos(callback) {
  const emitir = async () => {
    const todos = await dbObtenerTodos(TABLA_CHATS);
    const total = todos
      .filter((c) => !c.archivado)
      .reduce((suma, c) => suma + c.noLeidos, 0);
    callback(total);
  };
  emitir();
  return suscribir(TABLA_CHATS, emitir);
}

// ── Escritura ────────────────────────────────────────────────────

export async function actualizarPreview({
  otroUsuarioId,
  otroNombre,
  otroNombreUsuario = null,
  otroAvatarUrl = null,
  ultimoMensaje = null,
  fecha = null,
  incrementarNoLeidos = false,
}) {
  const existente = await obtenerPorId(TABLA_CHATS, otroUsuarioId);
  const chat = existente ?? crearChat({ otroUsuarioId });

  chat.otroUsuarioId = otroUsuarioId;
  chat.otroNombre = otroNombre;
  chat.otroNombreUsuario = otroNombreUsuario;
  chat.otroAvatarUrl = otroAvatarUrl;

  if (ultimoMensaje != null) chat.ultimoMensaje = ultimoMensaje;
  if (fecha != null) chat.ultimaFecha = new Date(fecha).toISOString();
  if (incrementarNoLeidos) chat.noLeidos = (chat.noLeidos ?? 0) + 1;

  await guardar(TABLA_CHATS, chat);
}

/**
 * Pisa SOLO el texto del último mensaje mostrado en la lista de
 * chats — no toca fecha, no-leídos, ni datos del otro usuario. Si
 * el chat todavía no existe (caso raro) no hace nada.
 */
export async function actualizarUltimoMensajeTexto({ otroUsuarioId, texto }) {
  const chat = await obtenerPorId(TABLA_CHATS, otroUsuarioId);
  if (!chat) return;
  chat.ultimoMensaje = texto;
  await guardar(TABLA_CHATS, chat);
}

export async function marcarComoLeido(otroUsuarioId) {
  const chat = await obtenerPorId(TABLA_CHATS, otroUsuarioId);
  if (!chat || chat.noLeidos === 0) return;
  chat.noLeidos = 0;
  await guardar(TABLA_CHATS, chat);
}

export async function toggleFijado(otroUsuarioId) {
  const chat = await obtenerPorId(TABLA_CHATS, otroUsuarioId);
  if (!chat) return;
  chat.fijado = !chat.fijado;
  await guardar(TABLA_CHATS, chat);
}

export async function toggleSilenciado(otroUsuarioId) {
  const chat = await obtenerPorId(TABLA_CHATS, otroUsuarioId);
  if (!chat) return;
  chat.silenciado = !chat.silenciado;
  await guardar(TABLA_CHATS, chat);
}

// ← archivar / desarchivar (igual que WhatsApp)
export async function toggleArchivado(otroUsuarioId) {
  const chat = await obtenerPorId(TABLA_CHATS, otroUsuarioId);
  if (!chat) return;
  chat.archivado = !chat.archivado;
  // Igual que el fix de jul 2026 en Dart: NO se resetea noLeidos al
  // archivar. Se preserva el conteo real; watchTotalNoLeidos ya
  // excluye archivados del total visible, así que el badge global
  // no se ve afectado mientras el chat esté archivado.
  await guardar(TABLA_CHATS, chat);
}

// ← cuántos chats hay archivados (para el badge en Configuración)
export async function contarArchivados() {
  const todos = await dbObtenerTodos(TABLA_CHATS);
  return todos.filter((c) => c.archivado).length;
}

// ← lista completa de archivados para la pantalla de archivados
export async function obtenerArchivados() {
  const todos = await dbObtenerTodos(TABLA_CHATS);
  const archivados = todos.filter((c) => c.archivado);
  archivados.sort((a, b) => {
    if (!a.ultimaFecha && !b.ultimaFecha) return 0;
    if (!a.ultimaFecha) return 1;
    if (!b.ultimaFecha) return -1;
    return new Date(b.ultimaFecha) - new Date(a.ultimaFecha);
  });
  return archivados;
}

export async function eliminarChat(otroUsuarioId, { borrarMensajes = true } = {}) {
  await eliminarPorId(TABLA_CHATS, otroUsuarioId);

  if (borrarMensajes) {
    const mensajes = await obtenerPorIndice(TABLA_MENSAJES, 'porChat', otroUsuarioId);
    await eliminarVarios(TABLA_MENSAJES, mensajes.map((m) => m.mensajeId));
  }
}

// ── Lecturas puntuales ───────────────────────────────────────────

export async function obtenerChat(otroUsuarioId) {
  return obtenerPorId(TABLA_CHATS, otroUsuarioId);
}

export async function obtenerTodos() {
  return dbObtenerTodos(TABLA_CHATS);
}