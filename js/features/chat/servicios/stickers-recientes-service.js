// ═════════════════════════════════════════════════════════════════
// stickers-recientes-service.js
// Ubicación: js/features/chat/servicios/stickers-recientes-service.js
//
// Réplica web de servicios/stickers_recientes_service.dart. Bandeja
// GLOBAL (no por conversación) de los últimos stickers usados, para
// la pestaña "Stickers" del panel de emojis/stickers del composer —
// igual que la bandeja de "recientes" de WhatsApp.
//
// Dart usa SharedPreferences con JSON. El equivalente web directo es
// localStorage (misma idea: clave-valor persistente y síncrono del
// navegador) — no es una simplificación, es el mismo mecanismo.
// ═════════════════════════════════════════════════════════════════

const CLAVE = 'stickers_recientes';
const MAXIMO = 30;

/** @typedef {{url: string, ancho: number|null, alto: number|null}} StickerReciente */

export function obtener() {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return [];
    const lista = JSON.parse(raw);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

/**
 * Agrega (o mueve al frente, si ya existía) un sticker recién
 * enviado. Recorta la lista al máximo permitido.
 * @param {StickerReciente} sticker
 */
export function agregar(sticker) {
  const actuales = obtener().filter((s) => s.url !== sticker.url);
  actuales.unshift(sticker);
  if (actuales.length > MAXIMO) actuales.length = MAXIMO;
  try {
    localStorage.setItem(CLAVE, JSON.stringify(actuales));
  } catch (e) {
    console.error('stickers-recientes-service – agregar:', e);
  }
}