// fondos-historia.js
// Puerto de fondos_historia.dart.
//
// Catálogo de fondos disponibles para el editor de historias de
// texto (y, más adelante, para "Diseño" — por eso vive en su
// propio archivo, igual que en el Dart original).
//
// Cada fondo es sólido (1 color) o degradado diagonal (2 colores,
// topLeft → bottomRight, igual que el LinearGradient(begin:
// topLeft, end: bottomRight) del Dart original).

export const FONDOS_HISTORIA = [
  // ── Sólidos ──────────────────────────────────────────────────
  { id: 'rojo',      colores: ['#E53935'] },
  { id: 'naranja',   colores: ['#FF9800'] },
  { id: 'amarillo',  colores: ['#FDD835'] },
  { id: 'verde',     colores: ['#4CAF50'] },
  { id: 'esmeralda', colores: ['#17A398'] },
  { id: 'cian',      colores: ['#00BCD4'] },
  { id: 'azul',      colores: ['#2E9BFF'] },
  { id: 'indigo',    colores: ['#4E6BFF'] },
  { id: 'morado',    colores: ['#9C27B0'] },
  { id: 'rosa',      colores: ['#E91E8C'] },
  { id: 'cafe',      colores: ['#6D4C41'] },
  { id: 'negro',     colores: ['#1C1C1E'] },
  { id: 'gris',      colores: ['#757575'] },
  { id: 'blanco',    colores: ['#F5F5F5'] },

  // ── Degradados ───────────────────────────────────────────────
  { id: 'atardecer', colores: ['#FF9800', '#E91E8C'] },
  { id: 'oceano',    colores: ['#2E9BFF', '#00E5FF'] },
  { id: 'aurora',    colores: ['#9C27B0', '#E91E8C'] },
  { id: 'fuego',     colores: ['#E53935', '#FDD835'] },
  { id: 'bosque',    colores: ['#1B5E20', '#8BC34A'] },
  { id: 'noche',     colores: ['#1C1C1E', '#4E6BFF'] },
  { id: 'algodon',   colores: ['#FFB6C1', '#B39DDB'] },
  { id: 'menta',     colores: ['#17A398', '#FDD835'] },
];

export function esDegradado(fondo) {
  return fondo.colores.length > 1;
}

/** CSS background listo para style.background — sólido o degradado
 * diagonal, equivalente al .decoration del Dart original. */
export function cssFondo(fondo) {
  return esDegradado(fondo)
    ? `linear-gradient(135deg, ${fondo.colores[0]}, ${fondo.colores[1]})`
    : fondo.colores[0];
}

/** Color representativo para donde no se puede pintar un gradiente
 * — mismo criterio que .colorPrincipal en el Dart original. */
export function colorPrincipal(fondo) {
  return fondo.colores[0];
}

// OJO — discrepancia encontrada en el Dart original: el comentario
// de _fondoIndex dice "arranca en esmeralda" pero el número fijo
// (20) en realidad cae en 'algodon' dentro de la lista (esmeralda
// es el índice 4). Aquí se busca por id en vez de hardcodear un
// número, así que el default de este puerto SÍ arranca en
// esmeralda (lo que dice la intención, no el número). Avisar si en
// realidad quieres reproducir el comportamiento actual de la app
// (con el desfase) en vez de la intención original del comentario.
export const INDICE_FONDO_DEFAULT =
  FONDOS_HISTORIA.findIndex((f) => f.id === 'esmeralda');