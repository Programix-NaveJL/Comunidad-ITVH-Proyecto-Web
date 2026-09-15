// hoja-reacciones.js
// Ruta real sugerida: js/features/social/publicaciones/tarjeta-publicaciones/hoja-reacciones.js
//
// Puerto de hoja_reacciones.dart. Hoja inferior que lista a los
// usuarios que reaccionaron a una publicación, mostrando junto a
// cada nombre el emoji exacto que usó (cualquier emoji, no un
// catálogo cerrado — ver reacciones.js). El encabezado se queda
// genérico ("N reacciones"), sin desglosar por emoji.
//
// Dos puntos de entrada, replicando la separación del Dart original
// entre mostrarReaccionesSheet() (fetch + abre) y ReaccionesSheet
// (solo pinta con datos ya resueltos):
//   - abrirHojaConReacciones(): pinta la hoja con datos YA cargados.
//     Pensado para que tarjeta-publicacion.js lo reutilice cuando ya
//     hizo su propio fetch (evita repetir la consulta a Supabase).
//   - abrirHojaReacciones(): hace el fetch a Supabase y luego llama
//     a abrirHojaConReacciones(). Equivalente directo de
//     mostrarReaccionesSheet().
//
// DEPENDENCIA PENDIENTE — irAPerfilPublico: mismo criterio
// placeholder que el resto del proyecto (ver nota en
// item-comentario.js) mientras no se porta perfil-helper.js.

import { supabaseClient } from '../../../../core/supabase-client.js';
import { navegarA } from '../../../../core/router.js';
import { resolverUrlPerfil } from '../../../../core/perfil-utils.js';
import { abrirHojaInferior } from '../../../../core/bottom-sheet.js';
import { tipoReaccionDesdeString, EMOJI_REACCION_RAPIDA } from './reacciones.js';

/**
 * Pinta la hoja de reacciones con datos ya cargados (sin fetch).
 *
 * @param {Object} opciones
 * @param {Array<Object>} opciones.reacciones - filas {usuario_id, tipo, perfiles}.
 * @param {number} opciones.totalLikes
 * @param {?string} [opciones.uid]
 * @param {?Function} [opciones.onMiPerfilTap]
 */
export function abrirHojaConReacciones({ reacciones, totalLikes, uid = null, onMiPerfilTap = null }) {
  const { sheet, cuerpo, cerrar } = abrirHojaInferior({ initialChildSize: 0.45, maxChildSize: 0.85, minChildSize: 0.25 });
  sheet.classList.add('hoja-reacciones');

  cuerpo.innerHTML = `
    <div class="hoja-reacciones__header">
      <span class="hoja-reacciones__icono">❤️</span>
      <p class="hoja-reacciones__titulo">
        ${reacciones.length === 0 ? 'Sin reacciones aún' : `${totalLikes} ${totalLikes === 1 ? 'reacción' : 'reacciones'}`}
      </p>
    </div>
    <div class="hoja-reacciones__divisor"></div>
    ${
      reacciones.length === 0
        ? `
      <div class="hoja-reacciones__vacio">
        <span class="hoja-reacciones__vacio-icono">🤍</span>
        <p>Sé el primero en reaccionar</p>
      </div>
    `
        : `<div class="hoja-reacciones__lista">${reacciones.map((r) => renderFilaReaccion(r, uid)).join('')}</div>`
    }
  `;

  cuerpo.querySelectorAll('[data-usuario-id]').forEach((el) => {
    el.addEventListener('click', () => {
      cerrar();
      irAlPerfil(el.dataset.usuarioId, uid, onMiPerfilTap);
    });
  });
}

function renderFilaReaccion(reaccion, uid) {
  const perfil = reaccion.perfiles ?? {};
  const foto = resolverUrlPerfil(perfil);
  const userId = reaccion.usuario_id ?? '';
  const esPropio = userId === uid;
  // Emoji real que esa persona eligió; si el dato llegara vacío o
  // nulo (fila corrupta o de antes de esta migración), cae a
  // EMOJI_REACCION_RAPIDA como fallback visual en vez de romper la
  // fila.
  const emoji = tipoReaccionDesdeString(reaccion.tipo) ?? EMOJI_REACCION_RAPIDA;

  return `
    <div class="hoja-reacciones__fila" data-usuario-id="${userId}">
      <div class="hoja-reacciones__avatar">
        ${foto ? `<img src="${foto}" alt="" />` : '<span>👤</span>'}
      </div>
      <div class="hoja-reacciones__info">
        <p class="hoja-reacciones__nombre">${escaparHtml(perfil.nombre ?? '')}${esPropio ? ' (Tú)' : ''}</p>
        <p class="hoja-reacciones__usuario">@${escaparHtml(perfil.nombre_usuario ?? '')}</p>
      </div>
      <span class="hoja-reacciones__emoji">${emoji}</span>
    </div>
  `;
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

/**
 * Consulta TODAS las reacciones (cualquier tipo) de una publicación
 * y abre la hoja. Equivalente directo de mostrarReaccionesSheet().
 *
 * @param {Object} opciones
 * @param {Object} opciones.post - debe traer al menos 'id'.
 * @param {?string} [opciones.uid]
 * @param {?Function} [opciones.onMiPerfilTap]
 */
export async function abrirHojaReacciones({ post, uid = null, onMiPerfilTap = null }) {
  try {
    const { data, error } = await supabaseClient
      .from('reacciones')
      .select('usuario_id, tipo, perfiles!reacciones_usuario_id_fkey(id, nombre, nombre_usuario, cdn_foto_perfil)')
      .eq('publicacion_id', post.id);
    if (error) throw error;

    const reacciones = data ?? [];
    abrirHojaConReacciones({ reacciones, totalLikes: reacciones.length, uid, onMiPerfilTap });
  } catch (error) {
    console.error('hoja-reacciones – abrirHojaReacciones:', error);
  }
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