// ═════════════════════════════════════════════════════════════════
// presence-service.js
//
// Réplica web de
// Pantallas/JaguarChat/Chats/servicios/presence_service.dart.
//
// Servicio de presencia en línea usando Supabase Realtime Presence.
// No requiere columna "last_seen" en la BD: Supabase detecta la
// desconexión automáticamente (heartbeat interno del canal).
//
// Es un módulo singleton por diseño (igual que theme.js, toast.js,
// db-service.js, realtime-service.js): el propio módulo de ES ya se
// importa una sola vez, no hace falta una clase con instancia.
//
// Flujo (idéntico al de Dart):
// 1. Al confirmar que la cuenta está activa (ver nota de arranque
//    más abajo) se llama iniciarPresencia(), que une al usuario al
//    canal compartido "presencia-global" y hace track() de su
//    propio uid.
// 2. Cualquier otro cliente conectado al mismo canal recibe los
//    eventos join/leave/sync en tiempo real.
// 3. Se mantiene un Set<string> local con los uids en línea; en vez
//    de un Stream de Dart, se expone con el mismo patrón manual de
//    suscripción que usan las funciones watchX() de db-service.js:
//    suscribir(cb) — emite el estado actual de inmediato y en cada
//    cambio, y devuelve una función para cancelar la suscripción.
// 4. Al cerrar sesión se llama detenerPresencia() para dejar de
//    aparecer conectado.
//
// ARRANQUE — dónde se llama iniciarPresencia()/detenerPresencia():
// en Flutter, iniciarPresencia() se llama desde _AuthCheckerState en
// main.dart, junto a registrarTokenPush(), es decir SOLO después de
// confirmar que la cuenta no está suspendida/expulsada — y
// detenerPresencia() se llama en AuthGate junto con
// RealtimeService.detener() al recibir signedOut. Del lado web esto
// significa que su arranque NO va junto al de realtime-service.js en
// shell.js (ver comentario en ese archivo) — debe esperar a la
// validación de estado_cuenta contra la tabla perfiles.
//
// Igual que realtime-service.js, iniciar()/detener() se serializan
// con una cola interna para blindar contra invocaciones concurrentes
// que podrían intentar re-trackear/re-suscribir el mismo canal a la
// vez.
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../../core/supabase-client.js';

const NOMBRE_CANAL = 'presencia-global';

let canal = null;
let yaIniciado = false;

// Set local con los uids actualmente en línea, equivalente a
// _usuariosEnLinea en Dart.
const usuariosEnLinea = new Set();

// Suscriptores del estado de presencia (equivalente al
// StreamController<Set<String>> de Dart). Cada callback recibe un
// Set<string> con una copia inmutable del estado actual.
const suscriptores = new Set();

// Cola interna que serializa iniciarPresencia()/detenerPresencia(),
// mismo criterio que realtime-service.js.
let cadena = Promise.resolve();

function encolar(tarea) {
  cadena = cadena.then(tarea, tarea);
  return cadena;
}

export function iniciarPresencia() {
  return encolar(iniciarPresenciaInterno);
}

export function detenerPresencia() {
  return encolar(detenerPresenciaInterno);
}

async function iniciarPresenciaInterno() {
  if (yaIniciado) return;

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const uid = user?.id;
  if (!uid) {
    console.warn('presence-service: no hay uid, no se inicia');
    return;
  }

  canal = supabaseClient.channel(NOMBRE_CANAL);

  canal
    .on('presence', { event: 'sync' }, actualizarDesdePresenceState)
    .on('presence', { event: 'join' }, actualizarDesdePresenceState)
    .on('presence', { event: 'leave' }, actualizarDesdePresenceState)
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await canal.track({
          uid,
          conectado_desde: new Date().toISOString(),
        });
      }
    });

  yaIniciado = true;
}

// Reconstruye usuariosEnLinea a partir de canal.presenceState() y
// notifica a los suscriptores. presenceState() en supabase-js
// devuelve un objeto { [presenceKey]: Presence[] }, donde cada
// Presence trae el payload de track() ya mezclado en el propio
// objeto (no anidado bajo .payload como en el cliente de Dart) —
// por eso aquí se lee presencia.uid directamente.
function actualizarDesdePresenceState() {
  if (!canal) return;
  const estado = canal.presenceState();

  usuariosEnLinea.clear();
  for (const clave of Object.keys(estado)) {
    for (const presencia of estado[clave]) {
      if (presencia.uid) usuariosEnLinea.add(presencia.uid);
    }
  }

  notificarSuscriptores();
}

function notificarSuscriptores() {
  const snapshot = new Set(usuariosEnLinea);
  suscriptores.forEach((cb) => cb(snapshot));
}

/**
 * Se suscribe al estado de presencia. Emite el estado actual de
 * inmediato (mismo patrón "emite ya + emite en cada cambio" que las
 * funciones watchX() de db-service.js, para que la UI no parpadee
 * mientras llega el primer evento real) y en cada cambio posterior.
 * Devuelve una función para cancelar la suscripción.
 */
export function suscribir(cb) {
  suscriptores.add(cb);
  cb(new Set(usuariosEnLinea));
  return () => suscriptores.delete(cb);
}

/** Snapshot inmediato del estado actual, sin suscribirse. */
export function obtenerEnLineaActual() {
  return new Set(usuariosEnLinea);
}

export function estaEnLinea(uid) {
  return usuariosEnLinea.has(uid);
}

async function detenerPresenciaInterno() {
  if (canal) {
    await canal.untrack();
    await supabaseClient.removeChannel(canal);
    canal = null;
  }
  yaIniciado = false;
  usuariosEnLinea.clear();
  notificarSuscriptores();
}