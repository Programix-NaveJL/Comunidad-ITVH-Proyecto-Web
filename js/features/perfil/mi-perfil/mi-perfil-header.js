// mi-perfil-header.js
// Ruta real: js/features/perfil/mi-perfil/mi-perfil-header.js
//
// Puerto de mi_perfil_header.dart (PerfilHeaderCard). Tarjeta de
// información de perfil: avatar (con o sin contorno de historia),
// stats, nombre/usuario, carrera/semestre, insignias, bio, redes
// sociales y botón "Editar perfil" (solo perfil propio).
//
// Mismo patrón render()+activar() que el resto del proyecto:
// renderPerfilHeaderCard(datos) arma el HTML; activarPerfilHeaderCard()
// engancha las interacciones sobre el elemento ya insertado.
//
// Reutilizado por mi-perfil-screen.js (perfil propio: con botón y
// contorno de historia) y mi-perfil-feed-detalle.js (perfil visto
// desde una publicación: sin botón ni contorno).
//
// NOTA — "Compartir" (v12 del Dart): se quitó del original porque
// compartir perfil aún no está implementado; "Editar perfil" ocupa
// todo el ancho. Mismo criterio aquí — no se agrega un botón de
// compartir hasta que el Dart lo tenga de vuelta.

import { formatContador, renderStatCol, renderBotonRed, renderInsigniasRow, renderAvatar } from './mi-perfil-widgets.js';

/**
 * @param {Object} datos
 * @param {string} datos.fotoUrl
 * @param {boolean} [datos.mostrarAvatarConHistoria]
 * @param {boolean} [datos.tieneHistoria]
 * @param {boolean} [datos.vistasTodas]
 * @param {number} datos.totalPosts
 * @param {number} datos.seguidores
 * @param {number} datos.seguidos
 * @param {string} datos.nombre
 * @param {string} datos.usuario
 * @param {string} datos.bio
 * @param {string} datos.carrera
 * @param {number|null} [datos.semestre]
 * @param {Array} [datos.insignias]
 * @param {string|null} [datos.igUrl]
 * @param {string|null} [datos.fbUrl]
 * @param {string|null} [datos.ttUrl]
 * @param {boolean} [datos.mostrarBotonesAccion]
 */
export function renderPerfilHeaderCard(datos) {
  const {
    fotoUrl,
    mostrarAvatarConHistoria = false,
    tieneHistoria = false,
    vistasTodas = false,
    totalPosts,
    seguidores,
    seguidos,
    nombre,
    usuario,
    bio,
    carrera,
    semestre = null,
    insignias = [],
    igUrl = null,
    fbUrl = null,
    ttUrl = null,
    mostrarBotonesAccion = false,
  } = datos;

  const avatarHtml = renderAvatar({
    fotoUrl,
    tieneHistoria: mostrarAvatarConHistoria && tieneHistoria,
    vistasTodas,
    tam: 92,
  });

  const carreraTexto = semestre != null ? `${carrera} · ${semestre}° sem.` : carrera;

  const redesHtml = [igUrl ? renderBotonRed('instagram') : '', fbUrl ? renderBotonRed('facebook') : '', ttUrl ? renderBotonRed('tiktok') : ''].join('');
  const hayRedes = Boolean(igUrl || fbUrl || ttUrl);

  return `
    <div class="mp-header">
      <div class="mp-header__fila-superior">
        <button class="mp-header__avatar-btn" data-mp-avatar aria-label="Ver avatar">${avatarHtml}</button>
        <div class="mp-header__stats">
          ${renderStatCol({ valor: String(totalPosts), label: 'Posts' })}
          <button class="mp-stat-btn" data-mp-seguidores>${renderStatCol({ valor: formatContador(seguidores), label: 'Seguidores' })}</button>
          <button class="mp-stat-btn" data-mp-seguidos>${renderStatCol({ valor: formatContador(seguidos), label: 'Seguidos' })}</button>
        </div>
      </div>

      <p class="mp-header__nombre">${escaparHtml(nombre)}</p>
      ${usuario ? `<p class="mp-header__usuario">@${escaparHtml(usuario)}</p>` : ''}

      ${carrera ? `<p class="mp-header__carrera">🎓 ${escaparHtml(carreraTexto)}</p>` : ''}

      ${renderInsigniasRow(insignias)}

      ${bio ? `<p class="mp-header__bio">${escaparHtml(bio)}</p>` : ''}

      ${hayRedes ? `<div class="mp-header__redes">${redesHtml}</div>` : ''}

      ${mostrarBotonesAccion ? `<button class="mp-header__btn-editar" data-mp-editar>Editar perfil</button>` : ''}
    </div>
  `;
}

/**
 * @param {HTMLElement} elRaiz - el elemento .mp-header ya insertado en el DOM.
 * @param {Object} callbacks
 * @param {() => void} callbacks.onAvatarTap
 * @param {() => void} callbacks.onSeguidoresTap
 * @param {() => void} callbacks.onSeguidosTap
 * @param {(url: string) => void} callbacks.onAbrirRed
 * @param {() => void} [callbacks.onEditarTap]
 * @param {{ig?: string, fb?: string, tt?: string}} [callbacks.urlsRed]
 */
export function activarPerfilHeaderCard(elRaiz, { onAvatarTap, onSeguidoresTap, onSeguidosTap, onAbrirRed, onEditarTap, urlsRed = {} }) {
  elRaiz.querySelector('[data-mp-avatar]')?.addEventListener('click', onAvatarTap);
  elRaiz.querySelector('[data-mp-seguidores]')?.addEventListener('click', onSeguidoresTap);
  elRaiz.querySelector('[data-mp-seguidos]')?.addEventListener('click', onSeguidosTap);
  elRaiz.querySelector('[data-mp-editar]')?.addEventListener('click', onEditarTap);

  elRaiz.querySelectorAll('[data-red]').forEach((btn) => {
    const red = btn.dataset.red;
    const urlKey = { instagram: 'ig', facebook: 'fb', tiktok: 'tt' }[red];
    const url = urlsRed[urlKey];
    btn.addEventListener('click', () => onAbrirRed(url));
  });
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}