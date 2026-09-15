// hoja-etiquetados.js
// Ruta real sugerida: js/features/social/publicaciones/tarjeta-publicaciones/hoja-etiquetados.js
//
// Puerto de hoja_etiquetados.dart. Hoja inferior con el listado
// COMPLETO de personas etiquetadas en una publicación — a diferencia
// de la línea de la tarjeta, que solo muestra 2 nombres + "y N más".
// Se abre desde tarjeta-publicacion.js al tocar "y N personas más".
//
// Widget "tonto" en el Dart original (StatelessWidget): recibe la
// lista de perfiles ya cargada y solo pinta + navega. Aquí se
// mantiene igual de simple, usando el shell compartido de
// js/core/bottom-sheet.js para el backdrop/manija/arrastre.
//
// DEPENDENCIA PENDIENTE — irAPerfilPublico: mismo criterio
// placeholder que el resto del proyecto (ver nota en
// item-comentario.js) mientras no se porta perfil-helper.js.

import { navegarA } from '../../../../core/router.js';
import { resolverUrlPerfil } from '../../../../core/perfil-utils.js';
import { abrirHojaInferior } from '../../../../core/bottom-sheet.js';

/**
 * Abre la hoja inferior con el listado completo de etiquetados.
 *
 * @param {Object} opciones
 * @param {Array<Object>} opciones.etiquetados - perfiles {id, nombre, nombre_usuario, cdn_foto_perfil}.
 * @param {?string} [opciones.uid]
 * @param {?Function} [opciones.onMiPerfilTap]
 */
export function abrirHojaEtiquetados({ etiquetados, uid = null, onMiPerfilTap = null }) {
  const { sheet, cuerpo, cerrar } = abrirHojaInferior({ initialChildSize: 0.45, maxChildSize: 0.85, minChildSize: 0.25 });
  sheet.classList.add('hoja-etiquetados');

  cuerpo.innerHTML = `
    <div class="hoja-etiquetados__header">
      <span class="hoja-etiquetados__icono">👥</span>
      <p class="hoja-etiquetados__titulo">
        ${etiquetados.length} ${etiquetados.length === 1 ? 'persona etiquetada' : 'personas etiquetadas'}
      </p>
    </div>
    <div class="hoja-etiquetados__divisor"></div>
    <div class="hoja-etiquetados__lista">
      ${etiquetados.map((p) => renderFilaPersona(p, uid)).join('')}
    </div>
  `;

  cuerpo.querySelectorAll('[data-usuario-id]').forEach((el) => {
    el.addEventListener('click', () => {
      cerrar();
      irAlPerfil(el.dataset.usuarioId, uid, onMiPerfilTap);
    });
  });
}

function renderFilaPersona(perfil, uid) {
  const foto = resolverUrlPerfil(perfil);
  const id = perfil.id ?? '';
  const esPropio = id === uid;

  return `
    <div class="hoja-etiquetados__fila" data-usuario-id="${id}">
      <div class="hoja-etiquetados__avatar">
        ${foto ? `<img src="${foto}" alt="" />` : '<span>👤</span>'}
      </div>
      <div class="hoja-etiquetados__info">
        <p class="hoja-etiquetados__nombre">${escaparHtml(perfil.nombre ?? '')}${esPropio ? ' (Tú)' : ''}</p>
        <p class="hoja-etiquetados__usuario">@${escaparHtml(perfil.nombre_usuario ?? '')}</p>
      </div>
    </div>
  `;
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// Mismo placeholder de navegación a perfil ya usado en el resto del
// proyecto (ver item-comentario.js) mientras no se porta
// perfil-helper.js / el módulo Mi Perfil.
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