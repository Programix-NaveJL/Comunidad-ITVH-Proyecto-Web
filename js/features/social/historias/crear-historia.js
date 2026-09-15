// crear-historia.js
// Ruta real sugerida: js/features/social/historias/crear-historia.js
//
// Puerto de "Crear Historias.dart". Coordinador ligero: es el punto
// de entrada del flujo de crear una historia — no tiene UI propia,
// abre seleccionar-media.js directamente, igual que el Dart
// original hace con SeleccionarMediaScreen.
//
// FLUJO COMPLETO (web):
//   abrirCrearHistoria()
//     → seleccionar-media.js   (paso 1: HUB Texto/Música/Diseño/Audio,
//                                o Cámara/Galería vía <input type="file">)
//       → publicar-historia.js (paso 2: subida a R2 + insert en Supabase)
//
// DIFERENCIA DE PLATAFORMA: el Dart intercala un paso de edición
// (EditarHistoriaScreen — recorte, texto sobre la imagen, preview)
// entre seleccionar el archivo y publicarlo. Ese archivo aún no se
// ha compartido/portado, así que por ahora seleccionar-media.js
// salta directo del archivo elegido a publicar-historia.js — ver el
// TODO correspondiente en seleccionar-media.js.
//
// USO desde pantalla-principal.js (botón "+" de historias) o, más
// adelante, desde Mi Perfil:
//   import { abrirCrearHistoria } from './historias/crear-historia.js';
//   const creada = await abrirCrearHistoria();
//   if (creada) cargarStories(); // refresca el carrusel

import { abrirSeleccionarMedia } from './seleccionar-media.js';

/**
 * Abre el flujo de creación de historia.
 *
 * @param {Object} [opciones]
 * @param {string} [opciones.titulo] - 'Agregar a historia' (desde el feed) o 'Crear historia' (desde Mi Perfil).
 * @returns {Promise<boolean>} true si se publicó una historia — equivalente al Navigator.push<bool> del Dart original.
 */
export function abrirCrearHistoria({ titulo = 'Agregar a historia' } = {}) {
  return abrirSeleccionarMedia({ titulo });
}