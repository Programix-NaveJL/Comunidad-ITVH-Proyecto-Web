// ═════════════════════════════════════════════════════════════════
// seccion-destacadas.js
//
// Widget compartido para la sección de "historias destacadas" del
// perfil. Se usa tanto en mi-perfil-screen.js (modo editable, con
// botón "+ Nueva" y pulsación larga para editar/eliminar) como en
// perfil-publico.js (modo solo lectura), igual que
// SeccionDestacadasPropia/SeccionDestacadasPublica en Flutter.
//
// En vez de duplicar dos componentes casi idénticos (como hace el
// Dart con dos clases), aquí es un único módulo render()+activar()
// con la bandera `editable` decidiendo qué partes se muestran y qué
// interacciones se activan.
//
// NOTA DE INTEGRACIÓN: renderSeccionDestacadas() ya NO dibuja su
// propia "tarjeta flotante" (sin box-shadow/border/radius propios).
// mi-perfil-screen.js ya inserta este HTML dentro de
// #mp-destacadas-zona, que trae las clases "mp-tarjeta mp-destacadas"
// y esas son las que dan el fondo/sombra/esquinas — replicar esa
// decoración aquí otra vez pintaría una tarjeta dentro de otra.
// Pendiente confirmar que perfil-publico.js siga el mismo patrón
// (su contenedor de destacadas también debe ser ya una tarjeta) —
// se confirma en cuanto se comparta ese archivo.
//
// PENDIENTE A CONFIRMAR (no bloquea el resto del módulo):
//   • La "pulsación larga" de Flutter (long-press) se implementó con
//     pointerdown + temporizador de 500ms, ya que el navegador no
//     tiene un gesto equivalente nativo. Ajustar el tiempo si se
//     siente muy corto/largo en pruebas reales.
//   • El diálogo de confirmación para eliminar (confirmarEliminarDestacada
//     más abajo) se implementó localmente en este archivo. Si el
//     proyecto ya tiene un helper de confirmación compartido (p. ej.
//     el que usa ajustes.js para "eliminar cuenta"), lo ideal sería
//     reemplazar esta implementación por ese helper para no duplicar
//     estilos de diálogo.
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../../core/supabase-client.js';
import { abrirHojaInferior } from '../../../core/bottom-sheet.js';
import { mostrarToast } from '../../../core/toast.js';

const MAX_COLECCIONES_DEFAULT = 4;

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// ── Render ──────────────────────────────────────────────────────

export function renderSeccionDestacadas(destacadas, opciones = {}) {
  const {
    editable = false,
    mostrarHeader = true,
    maxColecciones = MAX_COLECCIONES_DEFAULT,
  } = opciones;

  const puedeAgregar = editable && destacadas.length < maxColecciones;

  const header = mostrarHeader
    ? `
      <div class="destacadas-header">
        <span class="destacadas-header-icono">☆</span>
        <span class="destacadas-header-texto">Destacadas</span>
      </div>`
    : '';

  const itemNueva = puedeAgregar
    ? `
      <button type="button" class="destacada-item destacada-item--nueva" data-accion="nueva">
        <span class="destacada-avatar destacada-avatar--nueva">
          <span class="destacada-icono-mas">+</span>
        </span>
        <span class="destacada-nombre">Nueva</span>
      </button>`
    : '';

  const itemsHtml = destacadas
    .map((d) => {
      const nombre = escaparHtml(d.nombre);
      const portada = d.portada_url || '';
      return `
      <button type="button" class="destacada-item" data-id="${d.id}">
        <span class="destacada-avatar">
          ${
            portada
              ? `<img src="${portada}" alt="${nombre}" class="destacada-avatar-img"
                    onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                 <span class="destacada-avatar-fallback" style="display:none;">🔖</span>`
              : `<span class="destacada-avatar-fallback">🔖</span>`
          }
        </span>
        <span class="destacada-nombre">${nombre}</span>
      </button>`;
    })
    .join('');

  return `
    ${header}
    <div class="destacadas-carrusel">
      ${itemNueva}
      ${itemsHtml}
    </div>`;
}

// ── Activar ─────────────────────────────────────────────────────

/**
 * @param {HTMLElement} elRaiz - elemento donde se insertó el HTML de renderSeccionDestacadas
 * @param {Object} opciones
 * @param {Array}   opciones.destacadas
 * @param {boolean} opciones.editable
 * @param {Function} opciones.onRecargar - () => void, llamado tras crear/editar/eliminar
 * @param {Function} opciones.onAbrirSeleccionar - (opcionesEdicion) => void
 *        opcionesEdicion: {} para nueva, o { destacadaId, nombreInicial, portadaUrlInicial, seleccionInicial } para editar
 * @param {Function} opciones.onAbrirVerDestacada - ({ destacadaId, todasIds, indiceInicial }) => void
 */
export function activarSeccionDestacadas(elRaiz, opciones = {}) {
  const {
    destacadas = [],
    editable = false,
    onRecargar = () => {},
    onAbrirSeleccionar,
    onAbrirVerDestacada,
  } = opciones;

  const botonNueva = elRaiz.querySelector('[data-accion="nueva"]');
  if (botonNueva) {
    botonNueva.addEventListener('click', () => {
      onAbrirSeleccionar?.({});
    });
  }

  const todasIds = destacadas.map((d) => d.id);

  elRaiz.querySelectorAll('.destacada-item:not(.destacada-item--nueva)').forEach((item) => {
    const id = item.dataset.id;
    const destacada = destacadas.find((d) => d.id === id);
    if (!destacada) return;

    const indice = destacadas.indexOf(destacada);

    item.addEventListener('click', () => {
      onAbrirVerDestacada?.({ destacadaId: id, todasIds, indiceInicial: indice });
    });

    if (!editable) return;

    // Pulsación larga → abrir opciones (editar / eliminar)
    let temporizador = null;
    const iniciar = () => {
      temporizador = setTimeout(() => {
        mostrarOpcionesDestacada(destacada, { onRecargar, onAbrirSeleccionar });
      }, 500);
    };
    const cancelar = () => {
      if (temporizador) clearTimeout(temporizador);
    };
    item.addEventListener('pointerdown', iniciar);
    item.addEventListener('pointerup', cancelar);
    item.addEventListener('pointerleave', cancelar);
    item.addEventListener('pointercancel', cancelar);
  });
}

// ── Hoja de opciones (editar / eliminar) ────────────────────────

function mostrarOpcionesDestacada(destacada, { onRecargar, onAbrirSeleccionar }) {
  const { cuerpo, cerrar } = abrirHojaInferior({
    initialChildSize: 0.32,
    minChildSize: 0.24,
    maxChildSize: 0.4,
  });

  cuerpo.innerHTML = `
    <div class="destacadas-opciones">
      <div class="destacadas-opciones-titulo">${escaparHtml(destacada.nombre)}</div>
      <hr class="destacadas-opciones-divisor" />
      <button type="button" class="destacadas-opciones-item" data-accion="editar">
        ✏️ Editar historia destacada
      </button>
      <button type="button" class="destacadas-opciones-item destacadas-opciones-item--peligro" data-accion="eliminar">
        🗑️ Eliminar historia destacada
      </button>
    </div>`;

  cuerpo.querySelector('[data-accion="editar"]').addEventListener('click', async () => {
    cerrar();
    const { data: items, error } = await supabaseClient
      .from('historias_destacadas_items')
      .select('historia_id')
      .eq('destacada_id', destacada.id)
      .order('orden', { ascending: true });

    if (error) {
      mostrarToast('No se pudieron cargar las historias de la colección', 'error');
      return;
    }

    const seleccionInicial = (items || []).map((x) => x.historia_id);

    onAbrirSeleccionar?.({
      destacadaId: destacada.id,
      nombreInicial: destacada.nombre,
      portadaUrlInicial: destacada.portada_url,
      seleccionInicial,
    });
  });

  cuerpo.querySelector('[data-accion="eliminar"]').addEventListener('click', async () => {
    cerrar();
    const confirmar = await confirmarEliminarDestacada();
    if (!confirmar) return;

    try {
      await supabaseClient.from('historias_destacadas_items').delete().eq('destacada_id', destacada.id);
      await supabaseClient.from('historias_destacadas').delete().eq('id', destacada.id);
      onRecargar?.();
    } catch (e) {
      console.error('Destacadas – eliminar:', e);
      mostrarToast('No se pudo eliminar la colección', 'error');
    }
  });
}

// ── Diálogo de confirmación para eliminar ──────────────────────

function confirmarEliminarDestacada() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'destacadas-confirmar-overlay';
    overlay.innerHTML = `
      <div class="destacadas-confirmar-caja">
        <div class="destacadas-confirmar-titulo">Eliminar colección</div>
        <p class="destacadas-confirmar-texto">
          ¿Seguro que quieres eliminar esta colección? Las historias originales no se borrarán.
        </p>
        <div class="destacadas-confirmar-acciones">
          <button type="button" class="destacadas-confirmar-btn" data-accion="cancelar">Cancelar</button>
          <button type="button" class="destacadas-confirmar-btn destacadas-confirmar-btn--peligro" data-accion="eliminar">Eliminar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const cerrar = (resultado) => {
      overlay.remove();
      resolve(resultado);
    };

    overlay.querySelector('[data-accion="cancelar"]').addEventListener('click', () => cerrar(false));
    overlay.querySelector('[data-accion="eliminar"]').addEventListener('click', () => cerrar(true));
  });
}