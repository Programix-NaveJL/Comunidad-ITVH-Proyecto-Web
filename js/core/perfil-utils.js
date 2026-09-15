// Puerto web de url_helper.dart.
//
// Durante la migración de Supabase Storage a Cloudflare R2, los
// archivos nuevos traen cdn_url/cdn_foto_perfil y los viejos solo
// tienen el path dentro de un bucket de Supabase Storage. Estas
// funciones abstraen esa prioridad para que el resto del código no
// necesite saber de dónde viene la URL final.
//
// Orden de resolución:
//   1. URL de R2 ya presente en el registro → se usa directo.
//   2. Path de Supabase Storage → se genera la URL pública del bucket.
//   3. Sin ninguna de las dos → cadena vacía; la UI debe mostrar placeholder.

import { supabaseClient } from './supabase-client.js';

export const BUCKETS_SB = {
  PERFIL: 'perfil',
  PUBLICACIONES: 'publicaciones',
  HISTORIAS: 'historias',
};

export function resolverUrl(cdnUrl, supabasePath, bucket) {
  if (cdnUrl) return cdnUrl;

  if (supabasePath) {
    const { data } = supabaseClient.storage.from(bucket).getPublicUrl(supabasePath);
    return data?.publicUrl ?? '';
  }

  return '';
}

/** Resuelve la URL de un medio de publicación (publicacion_medios). */
export function resolverUrlMedio(medio) {
  return resolverUrl(medio?.cdn_url, medio?.url, BUCKETS_SB.PUBLICACIONES);
}

/** Resuelve la URL de una historia (historias). */
export function resolverUrlHistoria(historia) {
  return resolverUrl(historia?.cdn_url, historia?.media_url, BUCKETS_SB.HISTORIAS);
}

/** Resuelve la URL de foto de perfil (perfiles). */
export function resolverUrlPerfil(perfil) {
  return resolverUrl(perfil?.cdn_foto_perfil, perfil?.foto_perfil, BUCKETS_SB.PERFIL);
}

/** Resuelve la URL de una imagen de marketplace (marketplace_imagenes). Solo R2, sin fallback. */
export function resolverUrlMarketplace(imagen) {
  return imagen?.r2_url ?? '';
}