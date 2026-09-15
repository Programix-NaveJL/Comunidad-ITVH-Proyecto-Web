// r2-config.js — Comunidad ITVH
//
// Puerto directo de r2_config.dart. El cliente nunca conoce
// accountId/accessKey/secretKey de Cloudflare R2 — esas viven como
// secrets del lado del servidor en las Edge Functions de Supabase
// (generar-url-subida, eliminar-objeto-r2). Este archivo solo sabe
// a dónde llamar y qué buckets/dominios públicos existen.

export const R2_CONFIG = {
  // ── Edge Functions (Supabase) ──────────────────────────────
  // Project ref: dlrhbxhrnznrhnvryzcl (Comunidad ITVH).
  edgeFunctionsUrl: 'https://dlrhbxhrnznrhnvryzcl.supabase.co/functions/v1',

  // ── Buckets ─────────────────────────────────────────────────
  bucketPerfil: 'itvh-perfil',
  bucketPublicaciones: 'itvh-publicaciones',
  bucketHistorias: 'itvh-historias',
  bucketMarketplace: 'itvh-marketplace',
  bucketCosasPerdidas: 'itvh-cosas-perdidas',
  bucketChat: 'itvh-chat',

  // ── Dominios públicos (CDN) ─────────────────────────────────
  dominioPerfil: 'https://pub-bed59bbfc8824b3389355204bb8eea16.r2.dev',
  dominioPublicaciones: 'https://pub-6dd77144cdc84f88849d25e112e0de2f.r2.dev',
  dominioHistorias: 'https://pub-c85b613af0f14622ad4a98206d4d96b7.r2.dev',
  dominioMarketplace: 'https://pub-261374b47f634564a80fabd7acc4b2a6.r2.dev',
  dominioCosasPerdidas: 'https://pub-fe0f395932e6493a89470ff88cc7ef43.r2.dev',
  dominioChat: 'https://pub-1241d74d85f94c2fbd2075cd0bc3ce04.r2.dev',
};