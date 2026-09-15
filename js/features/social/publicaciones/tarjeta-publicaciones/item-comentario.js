// item-comentario.js
// Ruta real sugerida: js/features/social/publicaciones/tarjeta-publicaciones/item-comentario.js
//
// Puerto de item_comentario.dart. Pinta un comentario raíz con su
// bloque de respuestas colapsable — reutilizado por hoja-comentarios.js
// para cada elemento de su lista.
//
// A diferencia del resto de archivos "tontos" del proyecto
// (galeria-multimedia.js, pill-button.js), este exporta el patrón
// render()+activar() ya usado ahí: renderItemComentario() arma el
// HTML de un ítem (útil para .map().join('') si hoja-comentarios.js
// necesita insertar varios de una vez), y activarItemComentario()
// engancha las interacciones de un ítem YA insertado en el DOM,
// incluyendo montar el botón de reacción real (montarBotonReaccion
// de reacciones.js) sobre cada slot vacío del comentario y de cada
// respuesta.
//
// DEPENDENCIA PENDIENTE — TextoConMenciones / irAPerfilPublico:
// perfil_helper.dart (que expone ambos en el Dart original) todavía
// no se ha compartido ni portado. Mientras tanto:
//   - El contenido del comentario se pinta con un resaltado visual
//     simple de "@usuario" (span azul, sin datos de perfil real),
//     SIN navegación al tocarlo — placeholder documentado aquí
//     mismo (ver renderTextoConMenciones más abajo), a reemplazar en
//     cuanto se porte perfil-helper.js con la resolución real de
//     usuario_id por nombre de usuario.
//   - Ir al perfil de un autor (avatar/nombre) sí navega, usando el
//     mismo criterio placeholder ya usado en pantalla-principal.js y
//     shell.js: navegarA('/perfil-publico/:id') con un TODO — ese
//     patrón ya está establecido en el proyecto, no es una
//     invención nueva de este archivo.

import { navegarA } from '../../../../core/router.js';
import { resolverUrlPerfil } from '../../../../core/perfil-utils.js';
import { montarBotonReaccion } from './reacciones.js';

const REGEX_MENCION = /@([a-zA-Z0-9_.]+)/g;

/**
 * Arma el HTML de un comentario raíz + su bloque (colapsado) de
 * respuestas. No engancha ninguna interacción todavía — para eso,
 * una vez insertado en el DOM, llamar a activarItemComentario() con
 * el elemento raíz devuelto por
 * contenedor.querySelector(`[data-comentario-id="${id}"]`).
 *
 * @param {Object} comentario - fila de 'comentarios' con 'perfiles', 'mi_reaccion', 'total_likes' ya resueltos.
 * @param {Array<Object>} respuestas - respuestas de este comentario (mismo shape).
 * @param {Object} opciones
 * @param {(fechaIso: ?string) => string} opciones.tiempoBuilder
 */
export function renderItemComentario(comentario, respuestas, { tiempoBuilder }) {
  return `
    <div class="comentario-item" data-comentario-id="${comentario.id}">
      ${renderFilaComentario(comentario, { tiempoBuilder, esRespuesta: false })}
      ${
        respuestas.length > 0
          ? `
        <div class="comentario-item__respuestas-zona">
          <button class="comentario-item__toggle-respuestas" data-toggle-respuestas>
            Ver ${respuestas.length} ${respuestas.length === 1 ? 'respuesta' : 'respuestas'}
          </button>
          <div class="comentario-item__respuestas" hidden>
            ${respuestas.map((r) => renderFilaComentario(r, { tiempoBuilder, esRespuesta: true })).join('')}
          </div>
        </div>
      `
          : ''
      }
    </div>
  `;
}

function renderFilaComentario(item, { tiempoBuilder, esRespuesta }) {
  const perfil = item.perfiles ?? {};
  const foto = resolverUrlPerfil(perfil);
  const autorId = item.autor_id ?? '';
  const tiempoTxt = tiempoBuilder(item.creado_en) + (item.editado_en ? ' · editado' : '');

  const claseFila = esRespuesta ? 'comentario-item__fila comentario-item__fila--respuesta' : 'comentario-item__fila';
  const tamanoAvatar = esRespuesta ? 'chico' : 'normal';

  return `
    <div class="${claseFila}" data-item-id="${item.id}">
      <div class="comentario-item__avatar comentario-item__avatar--${tamanoAvatar}" data-ir-perfil="${autorId}">
        ${foto ? `<img src="${foto}" alt="" />` : '<span>👤</span>'}
      </div>
      <div class="comentario-item__cuerpo">
        <div class="comentario-item__burbuja">
          <p class="comentario-item__nombre" data-ir-perfil="${autorId}">${escaparHtml(perfil.nombre ?? '')}</p>
          <p class="comentario-item__texto">${renderTextoConMenciones(item.contenido ?? '')}</p>
        </div>
        <div class="comentario-item__acciones">
          <span class="comentario-item__tiempo">${tiempoTxt}</span>
          <span class="comentario-item__reaccion-slot" data-reaccion-slot></span>
          <button class="comentario-item__accion" data-responder>Responder</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Resaltado visual de menciones "@usuario" dentro de un comentario.
 * Placeholder mientras se porta perfil-helper.js (ver nota de
 * DEPENDENCIA PENDIENTE al inicio del archivo): NO resuelve ni
 * navega a ningún perfil todavía, solo pinta el token en azul.
 */
function renderTextoConMenciones(texto) {
  return escaparHtml(texto).replace(REGEX_MENCION, '<span class="comentario-item__mencion">@$1</span>');
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

/**
 * Engancha las interacciones de un ítem de comentario YA insertado
 * en el DOM (el comentario raíz y, si las tiene, sus respuestas):
 * toggle de "ver respuestas", botones de reacción reales, responder,
 * editar/eliminar (solo si el ítem es del usuario actual), y
 * navegación de avatar/nombre al perfil del autor.
 *
 * @param {HTMLElement} elRaiz - elemento devuelto por renderItemComentario(), ya en el DOM.
 * @param {Object} comentario
 * @param {Array<Object>} respuestas
 * @param {Object} opciones
 * @param {?string} opciones.uid
 * @param {?Function} opciones.onMiPerfilTap
 * @param {(item: Object, tipo: ?string) => void} opciones.onLike
 * @param {(item: Object) => void} opciones.onResponder
 * @param {(item: Object) => void} opciones.onEditar
 * @param {(item: Object) => void} opciones.onEliminar
 */
export function activarItemComentario(elRaiz, comentario, respuestas, opciones) {
  const { uid, onMiPerfilTap, onLike, onResponder, onEditar, onEliminar } = opciones;

  const itemsPorId = new Map([[comentario.id, comentario], ...respuestas.map((r) => [r.id, r])]);

  elRaiz.querySelectorAll('[data-item-id]').forEach((filaEl) => {
    const id = filaEl.dataset.itemId;
    const item = itemsPorId.get(id);
    if (!item) return;
    activarFila(filaEl, item, { uid, onMiPerfilTap, onLike, onResponder, onEditar, onEliminar });
  });

  const toggleBtn = elRaiz.querySelector('[data-toggle-respuestas]');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const zona = elRaiz.querySelector('.comentario-item__respuestas');
      const abierta = !zona.hidden;
      zona.hidden = abierta;
      toggleBtn.textContent = abierta
        ? `Ver ${respuestas.length} ${respuestas.length === 1 ? 'respuesta' : 'respuestas'}`
        : 'Ocultar respuestas';
    });
  }
}

function activarFila(filaEl, item, { uid, onMiPerfilTap, onLike, onResponder, onEditar, onEliminar }) {
  const autorId = item.autor_id ?? '';
  const esMio = uid != null && autorId === uid;

  filaEl.querySelectorAll('[data-ir-perfil]').forEach((el) => {
    el.addEventListener('click', () => irAlPerfil(el.dataset.irPerfil, uid, onMiPerfilTap));
  });

  filaEl.querySelector('[data-responder]')?.addEventListener('click', () => onResponder(item));

  const slotReaccion = filaEl.querySelector('[data-reaccion-slot]');
  if (slotReaccion) {
    montarBotonReaccion(slotReaccion, {
      reaccionActual: item.mi_reaccion ?? null,
      onSeleccionar: (tipo) => onLike(item, tipo),
      label: item.total_likes > 0 ? item.total_likes : null,
      tamano: 'chico',
    });
  }

  if (esMio) {
    const acciones = filaEl.querySelector('.comentario-item__acciones');
    acciones.insertAdjacentHTML(
      'beforeend',
      `
        <button class="comentario-item__accion" data-editar>Editar</button>
        <button class="comentario-item__accion comentario-item__accion--peligro" data-eliminar>Eliminar</button>
      `
    );
    acciones.querySelector('[data-editar]').addEventListener('click', () => onEditar(item));
    acciones.querySelector('[data-eliminar]').addEventListener('click', () => onEliminar(item));
  }
}

// Mismo criterio placeholder ya usado en pantalla-principal.js y
// shell.js para navegación a perfiles: ruta '/perfil-publico/:id'
// aún no tiene módulo real (js/features/perfil/ vacío). Para el
// perfil propio, usa onMiPerfilTap si el caller lo da (igual que en
// el Dart original) o cae al mismo placeholder de "editar perfil"
// que usa el botón de avatar del shell.
function irAlPerfil(usuarioId, uid, onMiPerfilTap) {
  if (!usuarioId) return;
  if (usuarioId === uid) {
    if (onMiPerfilTap) {
      onMiPerfilTap();
    } else {
      navegarA('/perfil/editar'); // TODO: pendiente módulo Mi Perfil
    }
  } else {
    navegarA(`/perfil-publico/${usuarioId}`); // TODO: pendiente módulo Mi Perfil
  }
}