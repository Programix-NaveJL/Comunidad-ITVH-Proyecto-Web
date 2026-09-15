// ═════════════════════════════════════════════════════════════════
// db-service.js
//
// Capa de acceso a IndexedDB para JaguarChat web. Cumple el mismo
// rol que Pantallas/JaguarChat/Chats/servicios/isar_service.dart en
// la app móvil: almacenamiento LOCAL y PERSISTENTE del navegador,
// fuente de verdad de chats y mensajes en este dispositivo/navegador
// (igual de "frágil" que Isar en móvil — si el usuario borra los
// datos del sitio, pierde el historial, tal como en móvil si
// desinstala la app).
//
// IndexedDB no tiene streams nativos como Isar (`.watch()`), así que
// este módulo implementa un sistema de suscripción manual: cada
// escritura (put/delete) notifica a quien esté escuchando esa tabla,
// que vuelve a consultar y emite el resultado fresco. chat-
// repository.js construye watchChats()/watchTotalNoLeidos() encima
// de esto para imitar el patrón `.listen()` de Dart.
//
// Tablas:
//   • chats    — keyPath: otroUsuarioId (igual que
//                @Index(unique:true) en Chat.otroUsuarioId).
//   • mensajes — keyPath: mensajeId, con índice no-único sobre
//                chatOtroUsuarioId (para listar mensajes de una
//                conversación) y un índice compuesto
//                [chatOtroUsuarioId+timestamp] para paginar
//                ordenado por fecha, igual que
//                .chatOtroUsuarioIdEqualTo().sortByTimestampDesc()
//                en mensaje_repository.dart.
// ═════════════════════════════════════════════════════════════════

const NOMBRE_DB = 'jaguarchat';
const VERSION_DB = 1;

export const TABLA_CHATS = 'chats';
export const TABLA_MENSAJES = 'mensajes';

let promesaDb = null;
const listeners = {
  [TABLA_CHATS]: new Set(),
  [TABLA_MENSAJES]: new Set(),
};

function abrirDb() {
  return new Promise((resolve, reject) => {
    const peticion = indexedDB.open(NOMBRE_DB, VERSION_DB);

    peticion.onupgradeneeded = () => {
      const db = peticion.result;

      if (!db.objectStoreNames.contains(TABLA_CHATS)) {
        db.createObjectStore(TABLA_CHATS, { keyPath: 'otroUsuarioId' });
      }

      if (!db.objectStoreNames.contains(TABLA_MENSAJES)) {
        const store = db.createObjectStore(TABLA_MENSAJES, { keyPath: 'mensajeId' });
        store.createIndex('porChat', 'chatOtroUsuarioId', { unique: false });
        store.createIndex('porChatYFecha', ['chatOtroUsuarioId', 'timestamp'], { unique: false });
      }
    };

    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

function obtenerDb() {
  if (!promesaDb) promesaDb = abrirDb();
  return promesaDb;
}

function notificar(tabla) {
  listeners[tabla]?.forEach((cb) => cb());
}

// ── Suscripción a cambios ──────────────────────────────────────────

/**
 * Se suscribe a cambios en una tabla. Devuelve una función para
 * cancelar la suscripción. No emite de inmediato — quien llama debe
 * pedir el dato actual por su cuenta antes de suscribirse (mismo
 * criterio que fireImmediately, implementado en chat-repository.js).
 */
export function suscribir(tabla, callback) {
  listeners[tabla].add(callback);
  return () => listeners[tabla].delete(callback);
}

// ── CRUD genérico ───────────────────────────────────────────────────

export async function obtenerTodos(tabla) {
  const db = await obtenerDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(tabla, 'readonly');
    const peticion = tx.objectStore(tabla).getAll();
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

export async function obtenerPorId(tabla, id) {
  const db = await obtenerDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(tabla, 'readonly');
    const peticion = tx.objectStore(tabla).get(id);
    peticion.onsuccess = () => resolve(peticion.result ?? null);
    peticion.onerror = () => reject(peticion.error);
  });
}

export async function guardar(tabla, valor) {
  const db = await obtenerDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(tabla, 'readwrite');
    tx.objectStore(tabla).put(valor);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notificar(tabla);
}

export async function eliminarPorId(tabla, id) {
  const db = await obtenerDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(tabla, 'readwrite');
    tx.objectStore(tabla).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notificar(tabla);
}

/** Elimina varias filas por id en una sola transacción. */
export async function eliminarVarios(tabla, ids) {
  if (ids.length === 0) return;
  const db = await obtenerDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(tabla, 'readwrite');
    const store = tx.objectStore(tabla);
    ids.forEach((id) => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  notificar(tabla);
}

// ── Consultas por índice (usadas por mensajes) ─────────────────────

/** Todas las filas cuyo índice [nombreIndice] coincide con [valor]. */
export async function obtenerPorIndice(tabla, nombreIndice, valor) {
  const db = await obtenerDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(tabla, 'readonly');
    const peticion = tx.objectStore(tabla).index(nombreIndice).getAll(valor);
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

/**
 * Recorre un índice con un IDBKeyRange, en la dirección indicada
 * ('next' o 'prev'), hasta [limite] resultados (o todos si es null).
 * Es el equivalente a .sortByTimestampDesc().limit(n) de Isar, ya
 * que getAll() por sí solo no permite ordenar ni limitar sobre un
 * rango de un índice compuesto.
 */
export async function consultarConCursor(tabla, nombreIndice, rango, { direccion = 'next', limite = null } = {}) {
  const db = await obtenerDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(tabla, 'readonly');
    const indice = tx.objectStore(tabla).index(nombreIndice);
    const resultados = [];
    const peticion = indice.openCursor(rango, direccion);
    peticion.onsuccess = (evento) => {
      const cursor = evento.target.result;
      if (!cursor || (limite !== null && resultados.length >= limite)) {
        resolve(resultados);
        return;
      }
      resultados.push(cursor.value);
      cursor.continue();
    };
    peticion.onerror = () => reject(peticion.error);
  });
}