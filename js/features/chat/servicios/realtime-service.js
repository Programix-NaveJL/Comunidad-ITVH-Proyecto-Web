// ═════════════════════════════════════════════════════════════════
// realtime-service.js
//
// Réplica web de
// Pantallas/JaguarChat/Chats/servicios/realtime_service.dart.
//
// Es lo que le da vida a mensaje-repository.js: escucha 3 tablas de
// Supabase Realtime y aplica los cambios localmente en IndexedDB.
//   • mensajes_pendientes (INSERT dirigido a mí)   → guardarRecibido
//   • mensajes_acciones   (INSERT dirigido a mí)   → aplicarAccionRemota
//   • mensaje_reacciones  (INSERT/UPDATE/DELETE)   → aplicarReaccionRemota
//
// Es un módulo singleton por diseño (igual que theme.js, toast.js,
// etc. en el proyecto): no hace falta una clase con instancia, el
// propio módulo de ES ya se importa una sola vez.
//
// Uso (por ejemplo desde shell.js al detectar sesión):
//   import * as realtimeService from './servicios/realtime-service.js';
//   await realtimeService.iniciar();
//   // ...al cerrar sesión:
//   await realtimeService.detener();
//
// CORRECCIÓN: iniciar()/detener() ahora pasan por una cola interna
// (`encolar`) que serializa cualquier invocación. Antes, si algo
// llamaba a iniciar() dos veces casi al mismo tiempo (por ejemplo,
// una llamada manual inmediata seguida del evento 'INITIAL_SESSION'
// de onAuthStateChange disparándose casi en el mismo instante), las
// dos ejecuciones se entrelazaban: la segunda `supabaseClient.
// channel('mensajes_pendientes:...')` reutilizaba el MISMO objeto de
// canal que la primera (supabase-js cachea canales por nombre de
// tema) que ya había hecho `.subscribe()`, y encadenar `.on(...)`
// sobre un canal ya suscrito lanza "cannot add `postgres_changes`
// callbacks... after `subscribe()`". Con la cola, una segunda
// llamada a iniciar() espera a que la primera termine por completo
// (incluyendo su propio `detener()` interno) antes de empezar la
// suya — nunca hay dos ejecuciones de iniciar/detener corriendo en
// paralelo.
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../../core/supabase-client.js';
import * as mensajeRepository from '../mensaje-repository.js';

let canalMensajes = null;
let canalAcciones = null;
let canalReacciones = null;
let iniciado = false;

// Lock en memoria: mensajeId → en proceso. Evita que dos
// invocaciones concurrentes de procesarMensaje() para la misma fila
// (una desde el callback del canal realtime, otra desde el catch-up
// de procesarPendientes()) corran en paralelo antes de que cualquiera
// de las dos haya terminado de escribir en IndexedDB o borrar la fila
// remota.
const procesando = new Set();

// Cola interna que serializa iniciar()/detener() (ver nota de
// cabecera). Cada llamada se encadena sobre la anterior con `.then`
// en vez de `await` directo, para que un rechazo de una tarea no
// rompa la cadena y bloquee para siempre las llamadas futuras.
let cadena = Promise.resolve();

function encolar(tarea) {
  cadena = cadena.then(tarea, tarea);
  return cadena;
}

export function iniciar() {
  return encolar(iniciarInterno);
}

export function detener() {
  return encolar(detenerInterno);
}

async function iniciarInterno() {
  // Llamada directa a la versión interna (no a la exportada) para no
  // encolar una segunda tarea dentro de esta misma tarea — eso
  // provocaría un candado circular, ya que la cola solo avanza
  // cuando la tarea actual termina.
  await detenerInterno();

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const miId = user?.id;
  if (!miId) return;

  iniciado = true;

  canalMensajes = supabaseClient
    .channel(`mensajes_pendientes:${miId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'mensajes_pendientes', filter: `destinatario_id=eq.${miId}` },
      (payload) => procesarMensaje(payload.new, miId)
    )
    .subscribe();

  // Ediciones/eliminaciones de mensajes que el otro usuario ya tenía
  // entregados (y por lo tanto ya no están en mensajes_pendientes).
  canalAcciones = supabaseClient
    .channel(`mensajes_acciones:${miId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'mensajes_acciones', filter: `destinatario_id=eq.${miId}` },
      (payload) => procesarAccion(payload.new)
    )
    .subscribe();

  // Reacciones que la OTRA persona hace en cualquiera de mis chats.
  // Filtrado por chat_otro_usuario_id (no por usuario_id): esa columna
  // guarda, desde la perspectiva de quien reacciona, el id del otro
  // participante — así este canal recibe eventos sin importar en cuál
  // de mis conversaciones ocurrió la reacción.
  canalReacciones = supabaseClient
    .channel(`mensaje_reacciones:${miId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'mensaje_reacciones', filter: `chat_otro_usuario_id=eq.${miId}` },
      procesarReaccion
    )
    .subscribe();

  await esperar(500);
  await procesarPendientes();
  await procesarAccionesPendientes();
}

export async function procesarPendientes() {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const miId = user?.id;
  if (!miId) return;

  try {
    const { data: pendientes, error } = await supabaseClient
      .from('mensajes_pendientes')
      .select()
      .eq('destinatario_id', miId)
      .neq('remitente_id', miId)
      .order('creado_en', { ascending: true });

    if (error) throw error;
    for (const fila of pendientes ?? []) {
      await procesarMensaje(fila, miId);
    }
  } catch (e) {
    console.error('realtime-service – procesarPendientes:', e);
  }
}

/**
 * Procesa acciones (editar/eliminar) que llegaron mientras la
 * pestaña estaba cerrada o el canal Realtime no estaba suscrito.
 */
export async function procesarAccionesPendientes() {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const miId = user?.id;
  if (!miId) return;

  try {
    const { data: pendientes, error } = await supabaseClient
      .from('mensajes_acciones')
      .select()
      .eq('destinatario_id', miId)
      .order('creado_en', { ascending: true });

    if (error) throw error;
    for (const fila of pendientes ?? []) {
      await procesarAccion(fila);
    }
  } catch (e) {
    console.error('realtime-service – procesarAccionesPendientes:', e);
  }
}

async function procesarMensaje(fila, miId) {
  const mensajeId = fila.id;
  const remitenteId = fila.remitente_id;

  if (remitenteId === miId) return;

  // Lock: si esta misma fila ya se está procesando en otra
  // invocación concurrente (canal realtime vs. catch-up de
  // procesarPendientes), no arrancar una segunda.
  if (procesando.has(mensajeId)) return;
  procesando.add(mensajeId);

  try {
    // Idempotencia: si el mensaje ya se guardó localmente antes
    // (reproceso duplicado de la misma fila), no se vuelve a
    // incrementar noLeidos — solo se limpia la cola remota, por si
    // ese reproceso anterior no alcanzó a borrarla.
    const yaGuardado = await mensajeRepository.existeMensaje(mensajeId);
    if (yaGuardado) {
      try {
        await supabaseClient.from('mensajes_pendientes').delete().eq('id', mensajeId);
      } catch {
        /* no pasa nada */
      }
      return;
    }

    const contenidoRaw = fila.contenido ?? '';
    const tipo = fila.tipo ?? 'texto';
    const mediaUrl = fila.media_url ?? null;
    const timestamp = fila.creado_en ? new Date(fila.creado_en) : new Date();

    let otroNombre = 'Usuario';
    let otroNombreUsuario = null;
    let otroAvatarUrl = null;

    try {
      const { data: perfil, error } = await supabaseClient
        .from('perfiles')
        .select('nombre, nombre_usuario, cdn_foto_perfil')
        .eq('id', remitenteId)
        .single();
      if (error) throw error;

      otroNombre = perfil?.nombre ?? 'Usuario';
      otroNombreUsuario = perfil?.nombre_usuario ?? null;
      otroAvatarUrl = perfil?.cdn_foto_perfil ?? null;
    } catch {
      /* se guarda igual con el nombre por defecto */
    }

    await mensajeRepository.guardarRecibido({
      mensajeId,
      remitenteId,
      contenidoRaw,
      tipo,
      mediaUrlRemota: mediaUrl,
      timestamp,
      otroNombre,
      otroNombreUsuario,
      otroAvatarUrl,
      contextoDescripcion: fila.contexto_descripcion ?? null,
      contextoImagenUrl: fila.contexto_imagen_url ?? null,
      contextoLugar: fila.contexto_lugar ?? null,
      contextoObjetoId: fila.contexto_objeto_id ?? null,
      contextoTipo: fila.contexto_tipo ?? null,
      respuestaAMensajeId: fila.respuesta_a_id ?? null,
      respuestaAContenido: fila.respuesta_a_contenido ?? null,
      respuestaATipo: fila.respuesta_a_tipo ?? null,
      respuestaAEmisorId: fila.respuesta_a_emisor_id ?? null,
    });

    try {
      await supabaseClient.from('mensajes_pendientes').delete().eq('id', mensajeId);
    } catch {
      /* no pasa nada */
    }
  } finally {
    procesando.delete(mensajeId);
  }
}

/**
 * Aplica una edición/eliminación remota a la copia local y borra la
 * fila de la cola, igual que con mensajes nuevos.
 */
async function procesarAccion(fila) {
  const { id, mensaje_id: mensajeId, accion, nuevo_contenido: nuevoContenido } = fila;

  try {
    await mensajeRepository.aplicarAccionRemota({ mensajeId, accion, nuevoContenido });
  } catch (e) {
    console.error('realtime-service – procesarAccion:', e);
  }

  try {
    await supabaseClient.from('mensajes_acciones').delete().eq('id', id);
  } catch {
    /* no pasa nada */
  }
}

/**
 * Aplica en IndexedDB un evento de reacción llegado por Realtime.
 * Cubre los tres tipos de evento sobre mensaje_reacciones: INSERT
 * (reacción nueva), UPDATE (cambio de emoji) y DELETE (reacción
 * quitada).
 */
async function procesarReaccion(payload) {
  try {
    if (payload.eventType === 'DELETE') {
      const anterior = payload.old;
      const mensajeId = anterior?.mensaje_id;
      const usuarioId = anterior?.usuario_id;
      if (!mensajeId || !usuarioId) return;
      await mensajeRepository.aplicarReaccionRemota({ mensajeId, usuarioId, emoji: null });
      return;
    }

    const fila = payload.new;
    await mensajeRepository.aplicarReaccionRemota({
      mensajeId: fila.mensaje_id,
      usuarioId: fila.usuario_id,
      emoji: fila.emoji,
    });
  } catch (e) {
    console.error('realtime-service – procesarReaccion:', e);
  }
}

async function detenerInterno() {
  if (canalMensajes) supabaseClient.removeChannel(canalMensajes);
  if (canalAcciones) supabaseClient.removeChannel(canalAcciones);
  if (canalReacciones) supabaseClient.removeChannel(canalReacciones);
  canalMensajes = null;
  canalAcciones = null;
  canalReacciones = null;
  iniciado = false;
}

export function estaIniciado() {
  return iniciado;
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}