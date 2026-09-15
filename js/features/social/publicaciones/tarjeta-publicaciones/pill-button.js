// pill-button.js
// Ruta real sugerida: js/features/social/publicaciones/tarjeta-publicaciones/pill-button.js
//
// Puerto de pill_button.dart. Widget puramente visual: ícono +
// etiqueta numérica opcional sobre un fondo redondeado tipo
// "píldora". Se usa en la barra de acciones de tarjeta_publicacion
// (comentar, ver reacciones) y en cualquier otra pantalla del feed
// que necesite el mismo estilo de botón.
//
// A diferencia del Dart (StatelessWidget), este archivo exporta una
// función que arma el HTML — el proyecto ya usa ese patrón de
// "template functions" en el resto de pantallas (ver
// plantillaMiniatura en crear-publicacion.js). Quien lo use debe
// agregar el listener de click aparte si necesita que sea
// interactivo, igual que en Flutter donde PillBtn se envuelve en
// GestureDetector desde tarjeta_publicacion.dart.

/**
 * @param {Object} opciones
 * @param {string} opciones.icono - Carácter/emoji del ícono (el proyecto usa emojis como íconos en vez de un icon font, ver pantalla-principal.js).
 * @param {string|number|null} [opciones.label] - Etiqueta numérica opcional junto al ícono.
 * @param {string} [opciones.claseExtra] - Clase(s) adicionales, ej. 'pill-btn--activa'.
 */
export function pillBtn({ icono, label = null, claseExtra = '' }) {
  const tieneLabel = label !== null && label !== undefined;
  return `
    <span class="pill-btn${tieneLabel ? ' pill-btn--con-label' : ''} ${claseExtra}">
      <span class="pill-btn__icono">${icono}</span>
      ${tieneLabel ? `<span class="pill-btn__label">${label}</span>` : ''}
    </span>
  `;
}