// mencion-autocomplete.js
// Ruta real sugerida: js/features/social/publicaciones/mencion-autocomplete.js
//
// Puerto de mencion_autocomplete.dart. Lógica compartida para el
// autocompletado de @menciones al escribir comentarios/respuestas —
// usada por hoja-comentarios.js (y, más adelante, por
// ver-publicacion.js y el selector de "Etiquetar personas" de
// crear-publicacion.js, que hoy sigue con su búsqueda local
// provisional; cuando se conecte aquí, usará
// buscarPerfilesMencion(query, {incluirNombreYCarrera: true})).
//
// DIFERENCIA DE PLATAFORMA — TextEditingValue: Flutter puede
// devolver texto + posición del cursor como un solo valor
// (TextEditingValue) para asignarlo de golpe al controller. El DOM
// no tiene ese equivalente: aplicarMencionSeleccionada() devuelve
// {texto, cursorPos} y quien la use debe asignar el input.value y
// LUEGO fijar input.selectionStart/selectionEnd con cursorPos (ver
// ejemplo de uso en el docstring de la función).

import { supabaseClient } from '../../../core/supabase-client.js';
import { resolverUrlPerfil } from '../../../core/perfil-utils.js';

/**
 * Busca perfiles que coincidan con `query` (case-insensitive).
 *
 * Por defecto (uso normal de @menciones en comentarios) busca solo
 * por PREFIJO de nombre_usuario, igual que siempre, y devuelve hasta
 * 5 resultados.
 *
 * @param {string} query - puede venir vacío justo después de escribir "@"; en ese caso no se busca nada.
 * @param {Object} [opciones]
 * @param {boolean} [opciones.incluirNombreYCarrera] - si es true, además de nombre_usuario (por prefijo) también busca coincidencias parciales en `nombre` y `carrera`, y devuelve hasta 8 resultados. Pensado para "Etiquetar personas" (buscar "Isaac" o "ISC" y no solo el @usuario exacto) — las @menciones en comentarios NO activan esto.
 */
export async function buscarPerfilesMencion(query, { incluirNombreYCarrera = false } = {}) {
  if (!query) return [];
  try {
    const consultaBase = supabaseClient
      .from('perfiles')
      .select('id, nombre, nombre_usuario, cdn_foto_perfil, carrera');

    const { data, error } = incluirNombreYCarrera
      ? await consultaBase
          .or(`nombre_usuario.ilike.${query}%,nombre.ilike.%${query}%,carrera.ilike.%${query}%`)
          .limit(8)
      : await consultaBase.ilike('nombre_usuario', `${query}%`).limit(5);

    if (error) throw error;
    return data ?? [];
  } catch (error) {
    console.error('mencion-autocomplete – buscarPerfilesMencion:', error);
    return [];
  }
}

/**
 * Devuelve el fragmento de texto que sigue al último "@" activo
 * antes del cursor (sin espacios/saltos de línea de por medio), o
 * null si el cursor no está dentro de una mención en construcción.
 *
 * Ej: "hola @jua" con cursor al final → "jua"
 *     "hola @jua " con cursor al final → null (ya cerró con espacio)
 */
export function detectarQueryMencion(texto, cursorPos) {
  if (cursorPos <= 0 || cursorPos > texto.length) return null;
  const antes = texto.slice(0, cursorPos);
  const idxArroba = antes.lastIndexOf('@');
  if (idxArroba === -1) return null;
  const fragmento = antes.slice(idxArroba + 1);
  if (fragmento.includes(' ') || fragmento.includes('\n')) return null;
  return fragmento;
}

/**
 * Índice donde empieza el "@" de la mención activa (ver
 * detectarQueryMencion). Se necesita por separado para saber qué
 * rango de texto reemplazar al seleccionar una sugerencia.
 */
export function indiceArrobaActiva(texto, cursorPos) {
  if (cursorPos <= 0 || cursorPos > texto.length) return null;
  const antes = texto.slice(0, cursorPos);
  const idxArroba = antes.lastIndexOf('@');
  if (idxArroba === -1) return null;
  const fragmento = antes.slice(idxArroba + 1);
  if (fragmento.includes(' ') || fragmento.includes('\n')) return null;
  return idxArroba;
}

/**
 * Reemplaza la mención en construcción (desde `inicioArroba` hasta
 * `cursorPos`) por "@nombre_usuario " completo.
 *
 * @returns {{texto: string, cursorPos: number}} el nuevo texto y la
 * posición donde debe quedar el cursor (justo después del espacio
 * insertado). Uso típico:
 *   const { texto, cursorPos } = aplicarMencionSeleccionada({...});
 *   input.value = texto;
 *   input.setSelectionRange(cursorPos, cursorPos);
 */
export function aplicarMencionSeleccionada({ texto, inicioArroba, cursorPos, nombreUsuario }) {
  const antes = texto.slice(0, inicioArroba);
  const despues = texto.slice(cursorPos);
  const insertado = `@${nombreUsuario} `;
  const nuevoTexto = `${antes}${insertado}${despues}`;
  return { texto: nuevoTexto, cursorPos: (antes + insertado).length };
}

// ═══════════════════════════════════════════════════════════════
// PANEL DE SUGERENCIAS — equivalente de PanelSugerenciasMencion
// ═══════════════════════════════════════════════════════════════

/**
 * Arma el HTML del panel de sugerencias que se muestra arriba del
 * campo de texto mientras el usuario escribe una @mención. Devuelve
 * cadena vacía si no hay nada que mostrar (ni sugerencias ni
 * cargando) — el caller debe limpiar/objetar el contenedor en ese
 * caso, igual que SizedBox.shrink() en el Dart original.
 *
 * @param {Array<Object>} sugerencias - perfiles {id, nombre, nombre_usuario, cdn_foto_perfil}.
 * @param {Object} [opciones]
 * @param {boolean} [opciones.cargando]
 */
export function renderPanelMenciones(sugerencias, { cargando = false } = {}) {
  if (!cargando && sugerencias.length === 0) return '';

  if (cargando) {
    return `
      <div class="panel-menciones">
        <div class="panel-menciones__spinner"><span class="btn-spinner"></span></div>
      </div>
    `;
  }

  return `
    <div class="panel-menciones">
      ${sugerencias
        .map((p, i) => {
          const foto = resolverUrlPerfil(p);
          return `
            <div class="panel-menciones__item" data-sugerencia-idx="${i}">
              <div class="panel-menciones__avatar">
                ${foto ? `<img src="${foto}" alt="" />` : '<span>👤</span>'}
              </div>
              <div class="panel-menciones__info">
                <p class="panel-menciones__nombre">${escaparHtml(p.nombre ?? '')}</p>
                <p class="panel-menciones__usuario">@${escaparHtml(p.nombre_usuario ?? '')}</p>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

/**
 * Engancha los clicks del panel devuelto por renderPanelMenciones(),
 * ya insertado en el DOM. `sugerencias` debe ser exactamente el
 * mismo arreglo (mismo orden) que se le pasó a esa función, ya que
 * el panel referencia cada ítem por índice.
 *
 * @param {HTMLElement} contenedor
 * @param {Array<Object>} sugerencias
 * @param {(perfil: Object) => void} onSeleccionar
 */
export function activarPanelMenciones(contenedor, sugerencias, onSeleccionar) {
  contenedor.querySelectorAll('[data-sugerencia-idx]').forEach((el) => {
    el.addEventListener('click', () => {
      const perfil = sugerencias[Number(el.dataset.sugerenciaIdx)];
      if (perfil) onSeleccionar(perfil);
    });
  });
}