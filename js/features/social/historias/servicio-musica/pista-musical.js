// pista-musical.js
// Ruta real: js/features/social/historias/servicio-musica/pista-musical.js
//
// Puerto de pista_musical.dart. Modelo plano de una pista de música
// (antes de Deezer, ahora de iTunes Search API — ver
// musica-service.js). Sin clase: un objeto plano normalizado, mismo
// criterio que el resto del proyecto para "modelos" simples (ver por
// ejemplo cómo tarjeta-publicacion.js consume filas de Supabase
// directo sin envolverlas en clases).

/**
 * @typedef {Object} PistaMusical
 * @property {number} id
 * @property {string} titulo
 * @property {string} artista
 * @property {string} cover        - URL de la carátula (puede venir vacía).
 * @property {string} previewUrl   - URL del preview de audio (hasta ~30s).
 * @property {number} duracion     - duración del preview en segundos.
 */

/**
 * @param {Object} [datos]
 * @returns {PistaMusical}
 */
export function crearPistaMusical({ id = 0, titulo = '', artista = '', cover = '', previewUrl = '', duracion = 0 } = {}) {
  return { id, titulo, artista, cover, previewUrl, duracion };
}

/**
 * Convierte una PistaMusical (camelCase, la que usa toda la UI) a
 * las columnas exactas de la tabla `historias` en Supabase
 * (snake_case) — equivalente a DeezerTrack.toSupabaseMap() en el
 * Dart original. Se llama justo antes de abrirPublicarHistoria(),
 * nunca antes: el resto de la UI (chip, historias-musica.js) sigue
 * leyendo .titulo/.artista/.cover tal cual.
 *
 * @param {PistaMusical} pista
 * @returns {{track_id: number, track_titulo: string, track_artista: string, track_cover: string, preview_url: string}}
 */
export function mapearPistaASupabase(pista) {
  return {
    track_id: pista.id,
    track_titulo: pista.titulo,
    track_artista: pista.artista,
    track_cover: pista.cover,
    preview_url: pista.previewUrl,
  };
}