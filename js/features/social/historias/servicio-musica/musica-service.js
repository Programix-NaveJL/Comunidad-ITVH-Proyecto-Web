// musica-service.js
// Ruta real: js/features/social/historias/servicio-musica/musica-service.js
//
// Puerto de musica_service.dart (ya migrado ahí de Deezer a iTunes
// Search API — se mantiene el mismo criterio aquí, incluida la nota
// de que iTunes no requiere API key y permite CORS desde el
// navegador, así que se llama directo con fetch sin backend propio).
//
// iTunes no tiene endpoint de "trending" real — igual que en el
// Dart, se simula buscando un término genérico como sustituto.

import { crearPistaMusical } from './pista-musical.js';

const TIMEOUT_MS = 8000;
const BASE_URL = 'https://itunes.apple.com/search';

async function buscarEnItunes(termino, limite = 25) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${BASE_URL}?term=${encodeURIComponent(termino)}&entity=song&media=music&limit=${limite}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];

    const data = await res.json();
    const resultados = Array.isArray(data?.results) ? data.results : [];

    return resultados.filter((t) => Boolean(t.previewUrl)).map(mapearDesdeItunes);
  } catch (error) {
    console.error('musica-service:', error);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function buscarCanciones(query) {
  const termino = (query ?? '').trim();
  if (!termino) return [];
  return buscarEnItunes(termino);
}

// iTunes no tiene "trending" oficial — mismo fallback que el Dart:
// un término popular fijo como sustituto de tendencias reales.
export async function obtenerTendencias() {
  return buscarEnItunes('top hits 2025');
}

function mapearDesdeItunes(t) {
  // artworkUrl100 -> se reemplaza 100x100 por 250x250 para mejor calidad.
  const cover = (t.artworkUrl100 ?? '').replace('100x100', '250x250');

  return crearPistaMusical({
    id: Number(t.trackId) || 0,
    titulo: t.trackName ?? '',
    artista: t.artistName ?? '',
    cover,
    previewUrl: t.previewUrl ?? '',
    duracion: Math.round((Number(t.trackTimeMillis) || 0) / 1000),
  });
}