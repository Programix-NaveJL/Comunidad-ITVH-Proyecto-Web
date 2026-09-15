// fuentes-historia.js
// Puerto de fuentes_historia.dart.
//
// DIFERENCIA DE PLATAFORMA: en Flutter, google_fonts descarga e
// integra la tipografía directo — .aplicar() devuelve un TextStyle
// ya resuelto. En web no hay paquete equivalente: cada fuente se
// carga como hoja de Google Fonts (<link rel="stylesheet">) la
// primera vez que se usa, y se espera document.fonts.ready antes
// de dibujarla en el <canvas> de captura (ver historias-texto.js)
// para que no se dibuje con el fallback del sistema por una carga
// a medias.
//
// ASUNCIÓN — fuente 'clasica': el Dart original usa fontFamily:
// null (la fuente del sistema/la que ya tenga configurada el resto
// de la app). Aquí se puso un stack genérico de sans-serif del
// sistema como placeholder — AJUSTAR a la fuente base real del
// proyecto si ya tienes una definida en tu CSS global.

export const FUENTES_HISTORIA = [
  {
    id: 'clasica',
    etiqueta: 'Clásica',
    // AJUSTAR: reemplazar por el font-family base real del proyecto si difiere.
    cssFontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    googleFontsHref: null,
    fontWeight: 600,
    fontStyle: 'normal',
    letterSpacing: 'normal',
    sizeMultiplier: 1,
  },
  {
    id: 'redondeada',
    etiqueta: 'Redondeada',
    cssFontFamily: "'Poppins', sans-serif",
    googleFontsHref: 'https://fonts.googleapis.com/css2?family=Poppins:wght@600&display=swap',
    fontWeight: 600,
    fontStyle: 'normal',
    letterSpacing: 'normal',
    sizeMultiplier: 1,
  },
  {
    id: 'impacto',
    etiqueta: 'Impacto',
    cssFontFamily: "'Bebas Neue', sans-serif",
    googleFontsHref: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap',
    fontWeight: 400,
    fontStyle: 'normal',
    letterSpacing: 'normal',
    sizeMultiplier: 1.15,
  },
  {
    id: 'elegante',
    etiqueta: 'Elegante',
    cssFontFamily: "'Playfair Display', serif",
    googleFontsHref: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital@1&display=swap',
    fontWeight: 400,
    fontStyle: 'italic',
    letterSpacing: 'normal',
    sizeMultiplier: 1,
  },
  {
    id: 'manuscrita',
    etiqueta: 'Manuscrita',
    cssFontFamily: "'Permanent Marker', cursive",
    googleFontsHref: 'https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap',
    fontWeight: 400,
    fontStyle: 'normal',
    letterSpacing: 'normal',
    sizeMultiplier: 0.85,
  },
  {
    id: 'condensada',
    etiqueta: 'Condensada',
    cssFontFamily: "'Oswald', sans-serif",
    googleFontsHref: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400&display=swap',
    fontWeight: 400,
    fontStyle: 'normal',
    letterSpacing: '0.6px',
    sizeMultiplier: 1,
  },
  {
    id: 'maquina',
    etiqueta: 'Máquina',
    cssFontFamily: "'Roboto Mono', monospace",
    googleFontsHref: 'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@500&display=swap',
    fontWeight: 500,
    fontStyle: 'normal',
    letterSpacing: 'normal',
    sizeMultiplier: 1,
  },
];

const _cargadas = new Set();

/**
 * Inyecta el <link> de Google Fonts de [fuente] (si no se ha
 * cargado ya) y espera a que el navegador termine de resolverla.
 * Para 'clasica' (sin googleFontsHref) solo espera document.fonts.ready.
 */
export async function cargarFuente(fuente) {
  if (fuente.googleFontsHref && !_cargadas.has(fuente.id)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = fuente.googleFontsHref;
    document.head.appendChild(link);
    _cargadas.add(fuente.id);
  }
  await document.fonts.ready;
}

/** Shorthand CSS font para usar en canvas ctx.font — ej.
 * "italic 400 56px 'Playfair Display', serif". */
export function cssFont(fuente, sizePx) {
  const tamano = Math.round(sizePx * fuente.sizeMultiplier);
  return `${fuente.fontStyle} ${fuente.fontWeight} ${tamano}px ${fuente.cssFontFamily}`;
}