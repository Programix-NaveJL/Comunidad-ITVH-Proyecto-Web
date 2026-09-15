// bottom-sheet.js
// Ruta real sugerida: js/core/bottom-sheet.js
//
// Shell reutilizable de hoja inferior (backdrop + panel con manija
// arrastrable + altura ajustable). Es la utilidad nueva compartida
// que reemplaza, para las hojas "grandes" del feed (comentarios,
// etiquetados, reacciones), al .feed-hoja-overlay simple ya usado
// en crear-publicacion.js/pantalla-principal.js — ese overlay
// simple sigue existiendo tal cual para sus propios usos (menús de
// opciones cortos), este archivo no lo reemplaza ni lo toca.
//
// Equivalente web de showModalBottomSheet + DraggableScrollableSheet
// combinados: en Flutter son dos piezas separadas (el modal/backdrop
// por un lado, el arrastre de altura por otro), pero el navegador no
// tiene un modal nativo de hoja inferior, así que aquí se resuelven
// juntos en una sola utilidad.
//
// El panel sigue el tema activo directamente vía var(--color-surface)
// en bottom-sheet.css — no necesita que quien lo abre le diga si el
// tema actual es oscuro o claro.
//
// Responsabilidad de quien llama a abrirHojaInferior():
//   - Insertar su propio contenido dentro del elemento `cuerpo`
//     devuelto (header, lista scrolleable, footer fijo, etc.) — este
//     módulo no impone ninguna estructura interna, solo el
//     contenedor + el comportamiento del sheet (abrir/cerrar/arrastrar).
//   - Si su contenido tiene un input que abre el teclado en móvil
//     (como el composer de hoja-comentarios.js), resolver ese ajuste
//     por su cuenta — este shell no replica el AnimatedPadding de
//     Flutter, que reacciona a MediaQuery.viewInsets.bottom.

const UMBRAL_CIERRE_ARRASTRE = 0.6; // si al soltar la altura queda por debajo de minChildSize * este factor, se cierra

/**
 * Abre una hoja inferior arrastrable con backdrop.
 *
 * @param {Object} opciones
 * @param {number} [opciones.initialChildSize] - fracción (0-1) de la altura del viewport con la que abre.
 * @param {number} [opciones.maxChildSize] - fracción máxima a la que se puede arrastrar hacia arriba.
 * @param {number} [opciones.minChildSize] - fracción mínima antes de cerrarse al soltar el arrastre.
 * @param {() => void} [opciones.onCerrar] - callback disparado cuando la hoja termina de cerrarse.
 * @returns {{overlay: HTMLElement, sheet: HTMLElement, cuerpo: HTMLElement, cerrar: () => void}}
 */
export function abrirHojaInferior({
  initialChildSize = 0.6,
  maxChildSize = 0.95,
  minChildSize = 0.3,
  onCerrar = null,
} = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'hoja-inferior-overlay';

  const sheet = document.createElement('div');
  sheet.className = 'hoja-inferior';
  sheet.style.height = `${initialChildSize * 100}vh`;

  const manijaZona = document.createElement('div');
  manijaZona.className = 'hoja-inferior__manija-zona';
  manijaZona.innerHTML = '<div class="hoja-inferior__manija"></div>';

  const cuerpo = document.createElement('div');
  cuerpo.className = 'hoja-inferior__cuerpo';

  sheet.appendChild(manijaZona);
  sheet.appendChild(cuerpo);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  document.body.classList.add('hoja-inferior-abierta');

  let cerrada = false;

  function cerrar() {
    if (cerrada) return;
    cerrada = true;
    overlay.classList.remove('visible');
    sheet.classList.remove('visible');
    window.removeEventListener('mousemove', moverArrastre);
    window.removeEventListener('touchmove', moverArrastre);
    window.removeEventListener('mouseup', soltarArrastre);
    window.removeEventListener('touchend', soltarArrastre);
    setTimeout(() => {
      overlay.remove();
      document.body.classList.remove('hoja-inferior-abierta');
    }, 220);
    onCerrar?.();
  }

  overlay.addEventListener('click', (evento) => {
    if (evento.target === overlay) cerrar();
  });

  // ── Arrastre del handle: mismo comportamiento que
  // DraggableScrollableSheet — cambia la altura en vivo mientras se
  // arrastra, y al soltar, se ajusta a maxChildSize/minChildSize o
  // se cierra si quedó por debajo del umbral.
  let arrastrando = false;
  let alturaInicioPx = 0;
  let yInicio = 0;

  function puntoY(evento) {
    return evento.touches ? evento.touches[0].clientY : evento.clientY;
  }

  function iniciarArrastre(evento) {
    arrastrando = true;
    yInicio = puntoY(evento);
    alturaInicioPx = sheet.getBoundingClientRect().height;
    sheet.classList.add('hoja-inferior--arrastrando');
  }

  function moverArrastre(evento) {
    if (!arrastrando) return;
    const deltaY = puntoY(evento) - yInicio;
    const nuevaAlturaPx = Math.max(0, alturaInicioPx - deltaY);
    const nuevaFraccion = Math.min(maxChildSize, nuevaAlturaPx / window.innerHeight);
    sheet.style.height = `${nuevaFraccion * 100}vh`;
  }

  function soltarArrastre() {
    if (!arrastrando) return;
    arrastrando = false;
    sheet.classList.remove('hoja-inferior--arrastrando');

    const fraccionActual = sheet.getBoundingClientRect().height / window.innerHeight;
    if (fraccionActual < minChildSize * UMBRAL_CIERRE_ARRASTRE) {
      cerrar();
      return;
    }
    const fraccionFinal = Math.min(maxChildSize, Math.max(minChildSize, fraccionActual));
    sheet.style.height = `${fraccionFinal * 100}vh`;
  }

  manijaZona.addEventListener('mousedown', iniciarArrastre);
  manijaZona.addEventListener('touchstart', iniciarArrastre, { passive: true });
  window.addEventListener('mousemove', moverArrastre);
  window.addEventListener('touchmove', moverArrastre, { passive: true });
  window.addEventListener('mouseup', soltarArrastre);
  window.addEventListener('touchend', soltarArrastre);

  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    sheet.classList.add('visible');
  });

  return { overlay, sheet, cuerpo, cerrar };
}