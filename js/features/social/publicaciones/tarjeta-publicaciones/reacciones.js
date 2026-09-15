// reacciones.js
// Ruta real sugerida: js/features/social/publicaciones/tarjeta-publicaciones/reacciones.js
//
// Puerto de reacciones.dart. Todo lo relacionado a reacciones
// compartidas entre publicaciones y comentarios: cualquier emoji,
// no un catálogo fijo. El campo 'tipo' en Supabase ES el emoji tal
// cual (constraint CHECK solo valida longitud).
//
// DIFERENCIAS DE PLATAFORMA:
//   • SharedPreferences (recientes) → localStorage, mismo criterio
//     que la caché del feed en pantalla-principal.js.
//   • emoji_picker_flutter (selector completo con categorías/
//     búsqueda/skin tones) no tiene equivalente nativo invocable
//     desde un navegador — el picker de emojis del sistema
//     operativo no se puede abrir programáticamente. Se arma un
//     grid propio con un catálogo curado por categoría (ver
//     CATALOGO_EMOJI abajo) + un buscador simple. NO replica el
//     catálogo completo de Unicode ni la búsqueda por nombre real
//     de emoji_picker_flutter — si se necesita cobertura completa,
//     candidato a integrar una librería JS de emoji picker más
//     adelante.
//   • La "fila flotante" que se autocorrige de posición (
//     _FilaFlotante en Dart, mide después de insertar) se replica
//     igual aquí: se inserta invisible, se mide el ancho real, se
//     corrige left si se sale de pantalla, y recién entonces se
//     hace visible.
//
// Uso desde otros módulos (tarjeta-publicacion.js, item-comentario.js):
//   import { montarBotonReaccion, tipoReaccionDesdeString, tipoReaccionAString } from './reacciones.js';
//   montarBotonReaccion(elementoContenedor, { reaccionActual, onSeleccionar, label });

const CLAVE_RECIENTES = 'reacciones_emojis_recientes';
const MAX_GUARDADOS = 20;
const LONG_PRESS_MS = 500;

export const CANTIDAD_FILA_RAPIDA = 6;
export const EMOJI_REACCION_RAPIDA = '👍';

const INICIALES = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// ═══════════════════════════════════════════════════════════════
// NORMALIZACIÓN BD <-> UI
// ═══════════════════════════════════════════════════════════════

export function tipoReaccionDesdeString(raw) {
  const limpio = raw?.trim();
  return limpio ? limpio : null;
}

export function tipoReaccionAString(tipo) {
  return tipo;
}

// ═══════════════════════════════════════════════════════════════
// EMOJIS RECIENTES — persistidos en localStorage
// ═══════════════════════════════════════════════════════════════

let cacheRecientes = null;

export const ReaccionesRecientes = {
  obtener() {
    if (cacheRecientes) return cacheRecientes;
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) || 'null');
      cacheRecientes = Array.isArray(guardado) && guardado.length > 0 ? guardado : [...INICIALES];
    } catch (error) {
      console.error('reacciones – leer recientes:', error);
      cacheRecientes = [...INICIALES];
    }
    return cacheRecientes;
  },

  obtenerParaFilaRapida() {
    return this.obtener().slice(0, CANTIDAD_FILA_RAPIDA);
  },

  registrar(emoji) {
    const actuales = this.obtener().filter((e) => e !== emoji);
    actuales.unshift(emoji);
    if (actuales.length > MAX_GUARDADOS) actuales.length = MAX_GUARDADOS;
    cacheRecientes = actuales;
    try {
      localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(actuales));
    } catch (error) {
      console.error('reacciones – guardar recientes:', error);
    }
  },
};

// ═══════════════════════════════════════════════════════════════
// BOTÓN DE REACCIÓN
// ═══════════════════════════════════════════════════════════════

/**
 * Pinta el botón de reacción dentro de `contenedor` (debe ya existir
 * en el DOM) y engancha sus interacciones. Tap corto: si no había
 * reacción, envía EMOJI_REACCION_RAPIDA; si ya había cualquiera, la
 * quita. Long-press (o mousedown sostenido): abre la fila rápida de
 * emojis recientes flotando sobre el botón.
 *
 * @param {HTMLElement} contenedor
 * @param {Object} opciones
 * @param {string|null} opciones.reaccionActual
 * @param {(tipo: string|null) => void} opciones.onSeleccionar
 * @param {string|number|null} [opciones.label]
 * @param {'normal'|'chico'} [opciones.tamano]
 */
export function montarBotonReaccion(contenedor, { reaccionActual, onSeleccionar, label = null, tamano = 'normal' }) {
  const tieneReaccion = reaccionActual != null;
  const tieneLabel = label !== null && label !== undefined;

  contenedor.className =
    `reaction-btn reaction-btn--${tamano}` +
    (tieneReaccion ? ' reaction-btn--activa' : '') +
    (tieneLabel ? ' reaction-btn--con-label' : '');
  contenedor.innerHTML = `
    <span class="reaction-btn__icono">${tieneReaccion ? reaccionActual : '🤍'}</span>
    ${tieneLabel ? `<span class="reaction-btn__label">${label}</span>` : ''}
  `;

  let filaAbierta = null;
  let longPressTimer = null;

  const cerrarFila = () => {
    filaAbierta?.remove();
    filaAbierta = null;
  };

  const abrirFilaRapida = () => {
    if (filaAbierta) return;
    const recientes = ReaccionesRecientes.obtenerParaFilaRapida();
    const rect = contenedor.getBoundingClientRect();

    const overlay = document.createElement('div');
    overlay.className = 'reaction-fila-overlay';
    overlay.innerHTML = `
      <div class="reaction-fila" style="left:${rect.left}px; top:${rect.top - 64}px; opacity:0;">
        ${recientes.map((e) => `<button class="reaction-fila__emoji" data-emoji="${e}">${e}</button>`).join('')}
        <button class="reaction-fila__mas" data-abrir-completo aria-label="Más emojis">➕</button>
      </div>
    `;
    document.body.appendChild(overlay);
    filaAbierta = overlay;

    // Corrección de posición en dos pasadas (ver _FilaFlotante en
    // el Dart original): se mide el ancho real ya insertado y se
    // corrige `left` si se saldría de la pantalla, antes de
    // mostrarla.
    requestAnimationFrame(() => {
      const fila = overlay.querySelector('.reaction-fila');
      const anchoFila = fila.getBoundingClientRect().width;
      const maxLeft = window.innerWidth - anchoFila - 8;
      if (rect.left > maxLeft) fila.style.left = `${Math.max(8, maxLeft)}px`;
      fila.style.opacity = '1';
    });

    overlay.addEventListener('click', (evento) => {
      if (evento.target === overlay) {
        cerrarFila();
        return;
      }
      const emojiBtn = evento.target.closest('[data-emoji]');
      if (emojiBtn) {
        const emoji = emojiBtn.dataset.emoji;
        cerrarFila();
        ReaccionesRecientes.registrar(emoji);
        onSeleccionar(emoji);
        return;
      }
      if (evento.target.closest('[data-abrir-completo]')) {
        cerrarFila();
        abrirSelectorCompleto({
          onSeleccionar: (emoji) => {
            ReaccionesRecientes.registrar(emoji);
            onSeleccionar(emoji);
          },
        });
      }
    });
  };

  contenedor.addEventListener('click', () => {
    if (filaAbierta) {
      cerrarFila();
      return;
    }
    if (reaccionActual == null) {
      ReaccionesRecientes.registrar(EMOJI_REACCION_RAPIDA);
      onSeleccionar(EMOJI_REACCION_RAPIDA);
    } else {
      onSeleccionar(null);
    }
  });

  const iniciarLongPress = () => {
    longPressTimer = setTimeout(abrirFilaRapida, LONG_PRESS_MS);
  };
  const cancelarLongPress = () => clearTimeout(longPressTimer);
  contenedor.addEventListener('mousedown', iniciarLongPress);
  contenedor.addEventListener('touchstart', iniciarLongPress, { passive: true });
  ['mouseup', 'mouseleave', 'touchend', 'touchmove'].forEach((ev) =>
    contenedor.addEventListener(ev, cancelarLongPress)
  );
}

// ═══════════════════════════════════════════════════════════════
// SELECTOR COMPLETO — ver nota de DIFERENCIAS DE PLATAFORMA arriba
// ═══════════════════════════════════════════════════════════════

const CATALOGO_EMOJI = {
  Caritas: ['😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😜', '🤔', '😐', '😴', '🤩', '🥳', '😢', '😭', '😡', '🤯', '😱', '🥺'],
  Gestos: ['👍', '👎', '👏', '🙌', '🙏', '💪', '🤝', '✌️', '🤙', '👌', '🖐️', '✋', '🤟'],
  Corazones: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💕', '💯'],
  Reacciones: ['🔥', '✨', '🎉', '😮', '😢', '😂', '😡', '👀', '💀', '🦖'],
};

/**
 * Abre el selector completo de emojis en una hoja inferior.
 * Exportada por si otro punto del proyecto necesita a futuro dejar
 * elegir un emoji libre (mismo rol que mostrarSelectorEmojiCompleto
 * en el Dart original).
 */
export function abrirSelectorCompleto({ onSeleccionar }) {
  const frecuentes = ReaccionesRecientes.obtener().slice(0, 12);
  const categorias = { Frecuentes: frecuentes, ...CATALOGO_EMOJI };

  const overlay = document.createElement('div');
  overlay.className = 'reaction-fila-overlay';
  overlay.innerHTML = `
    <div class="emoji-selector">
      <div class="emoji-selector__manija"></div>
      <div class="emoji-selector__buscador">
        <input type="text" id="emoji-buscar-input" placeholder="Buscar emoji..." autocomplete="off" />
      </div>
      <div class="emoji-selector__grid" id="emoji-selector-grid">
        ${renderCategoriasEmoji(categorias)}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (evento) => {
    if (evento.target === overlay) {
      overlay.remove();
      return;
    }
    const btn = evento.target.closest('[data-emoji]');
    if (btn) {
      overlay.remove();
      onSeleccionar(btn.dataset.emoji);
    }
  });

  // Búsqueda simple sobre el catálogo curado — NO busca por nombre
  // real de emoji (el catálogo actual no tiene esa metadata). Si se
  // necesita búsqueda real, hay que agregar nombres/alias por emoji.
  const input = overlay.querySelector('#emoji-buscar-input');
  input.addEventListener('input', () => {
    const grid = overlay.querySelector('#emoji-selector-grid');
    if (!input.value.trim()) {
      grid.innerHTML = renderCategoriasEmoji(categorias);
      return;
    }
    grid.innerHTML = `<p class="emoji-selector__vacio">Búsqueda por nombre aún no disponible — usa las categorías de abajo</p>`;
  });
}

function renderCategoriasEmoji(categorias) {
  return Object.entries(categorias)
    .filter(([, emojis]) => emojis.length > 0)
    .map(
      ([nombre, emojis]) => `
        <div class="emoji-selector__categoria">
          <p class="emoji-selector__titulo">${nombre}</p>
          <div class="emoji-selector__fila">
            ${emojis.map((e) => `<button class="emoji-selector__item" data-emoji="${e}">${e}</button>`).join('')}
          </div>
        </div>
      `
    )
    .join('');
}