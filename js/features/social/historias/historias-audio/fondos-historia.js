// fondos-historia.js
// Ruta real: js/features/social/historias/historias-audio/fondos-historia.js
//
// Puerto de HistoriasAudio/fondos_historia.dart. Copia independiente
// de la que usa historias-texto/ — así lo decidió el Dart original
// (cada módulo con su propio archivo, pensado para poder divergir a
// futuro), así que se replica igual en vez de compartir un solo
// módulo entre ambas pantallas.

export const FONDOS_HISTORIA = [
  // ── Sólidos ────────────────────────────────────────────────────
  { id: 'rojo', colores: ['#E53935'] },
  { id: 'naranja', colores: ['#FF9800'] },
  { id: 'amarillo', colores: ['#FDD835'] },
  { id: 'verde', colores: ['#4CAF50'] },
  { id: 'esmeralda', colores: ['#17A398'] },
  { id: 'cian', colores: ['#00BCD4'] },
  { id: 'azul', colores: ['#2E9BFF'] },
  { id: 'indigo', colores: ['#4E6BFF'] },
  { id: 'morado', colores: ['#9C27B0'] },
  { id: 'rosa', colores: ['#E91E8C'] },
  { id: 'cafe', colores: ['#6D4C41'] },
  { id: 'negro', colores: ['#1C1C1E'] },
  { id: 'gris', colores: ['#757575'] },
  { id: 'blanco', colores: ['#F5F5F5'] },

  // ── Degradados ───────────────────────────────────────────────
  { id: 'atardecer', colores: ['#FF9800', '#E91E8C'] },
  { id: 'oceano', colores: ['#2E9BFF', '#00E5FF'] },
  { id: 'aurora', colores: ['#9C27B0', '#E91E8C'] },
  { id: 'fuego', colores: ['#E53935', '#FDD835'] },
  { id: 'bosque', colores: ['#1B5E20', '#8BC34A'] },
  { id: 'noche', colores: ['#1C1C1E', '#4E6BFF'] },
  { id: 'algodon', colores: ['#FFB6C1', '#B39DDB'] },
  { id: 'menta', colores: ['#17A398', '#FDD835'] },
];

export const INDICE_FONDO_DEFAULT = 0;

/** CSS background listo para usar — sólido o degradado diagonal (topLeft → bottomRight), igual que Instagram. */
export function cssFondo(fondo) {
  if (fondo.colores.length > 1) {
    return `linear-gradient(135deg, ${fondo.colores.join(', ')})`;
  }
  return fondo.colores[0];
}

/** Color representativo, para lugares donde no se puede pintar un degradado. */
export function colorPrincipal(fondo) {
  return fondo.colores[0];
}