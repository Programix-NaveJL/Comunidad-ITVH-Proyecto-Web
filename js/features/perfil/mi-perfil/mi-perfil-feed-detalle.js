// mi-perfil-feed-detalle.js
// Ruta real: js/features/perfil/mi-perfil/mi-perfil-feed-detalle.js
//
// Puerto de mi_perfil_feed_detalle.dart. Pantalla que se abre al
// tocar una publicación del grid en "Mi Perfil": header de perfil
// simplificado (sin botón de editar ni contorno de historia — los
// DEFAULTS de renderPerfilHeaderCard ya dan exactamente eso, no
// hizo falta tocar mi-perfil-header.js) + lista completa de las
// publicaciones propias, con scroll automático hasta la tocada.
//
// DIFERENCIA DE PLATAFORMA — cómo se llega aquí: el router de hash
// solo puede pasar strings como parámetros (mismo motivo ya
// documentado en ver-publicacion.js), así que en vez de codificar
// el arreglo completo de publicaciones en la URL, este archivo
// sigue el MISMO patrón de "dato pendiente en memoria" que ya usa
// ver-publicacion.js: quien quiera abrir esta pantalla llama a
// abrirFeedDetalle(datos) en vez de navegarA('/mi-perfil/feed')
// directo.
//
// DIFERENCIA DE PLATAFORMA — scroll al índice inicial: el Dart
// calcula un offset en píxeles a mano (indiceInicial * 420.0) sobre
// un ScrollController, una estimación que se desalinea si alguna
// tarjeta mide distinto. Aquí, una vez insertadas todas las
// tarjetas reales en el DOM, se usa scrollIntoView() sobre el
// elemento de esa publicación — exacto siempre, sin estimar nada.
//
// Quién la usa:
//   • mi-perfil-screen.js -> abrirFeedDesde() (hoy stub con toast,
//     pendiente de conectar a abrirFeedDetalle() de aquí — ver nota
//     al final de este archivo).

import { registrarRuta, navegarA } from '../../../core/router.js';
import { resolverUrlPerfil } from '../../../core/perfil-utils.js';
import { renderPerfilHeaderCard, activarPerfilHeaderCard } from './mi-perfil-header.js';
import { abrirFotoCompleta } from './mi-perfil-widgets.js';
import { mostrarSeguidoresSheet, TipoLista } from '../seguidores-sheet.js';
import { renderTarjetaPublicacion, activarTarjetaPublicacion } from '../../social/publicaciones/tarjeta-publicaciones/tarjeta-publicacion.js';

let datosPendientes = null;

/**
 * @param {Object} opciones
 * @param {Object} opciones.perfil - fila de 'perfiles' + total_seguidores/total_seguidos ya calculados (mismo shape que arma mi-perfil-screen.js en cargarPerfil()).
 * @param {Array} opciones.publicaciones
 * @param {number} [opciones.indiceInicial]
 * @param {string} opciones.uid - id del dueño del perfil (para abrir seguidores/seguidos).
 * @param {() => void} [opciones.onRefresh] - se llama cuando una tarjeta necesita refrescar la lista (p.ej. tras eliminar una publicación).
 */
export function abrirFeedDetalle({ perfil, publicaciones, indiceInicial = 0, uid, onRefresh = null }) {
  datosPendientes = { perfil, publicaciones, indiceInicial, uid, onRefresh };
  navegarA('/mi-perfil-feed');
}

registrarRuta('/mi-perfil-feed', render);

function render(contenedor) {
  if (!datosPendientes) {
    contenedor.innerHTML = `
      <div class="mpfd-error">
        <p>No se encontraron las publicaciones.</p>
        <button data-mpfd-volver>Regresar</button>
      </div>
    `;
    contenedor.querySelector('[data-mpfd-volver]').addEventListener('click', () => window.history.back());
    return;
  }

  const { perfil: p, publicaciones, indiceInicial, uid, onRefresh } = datosPendientes;
  datosPendientes = null; // se consume una sola vez, igual que en ver-publicacion.js

  const nombre = p.nombre ?? '';
  const usuario = p.nombre_usuario ?? '';

  contenedor.innerHTML = `
    <div class="mpfd-screen">
      <header class="mpfd-topbar">
        <button class="mpfd-volver" data-mpfd-volver aria-label="Regresar">‹</button>
        <span class="mpfd-titulo">${usuario ? `@${escaparHtml(usuario)}` : escaparHtml(nombre)}</span>
      </header>

      <div class="mpfd-lista">
        <div class="mp-tarjeta mpfd-header-tarjeta" id="mpfd-header-zona"></div>

        <div class="mp-tarjeta mpfd-publicaciones-header">
          <span>▤</span> Publicaciones
        </div>

        <div id="mpfd-publicaciones"></div>
      </div>
    </div>
  `;

  contenedor.querySelector('[data-mpfd-volver]').addEventListener('click', () => window.history.back());

  // ── Header simplificado ───────────────────────────────────────
  const headerZona = contenedor.querySelector('#mpfd-header-zona');
  headerZona.innerHTML = renderPerfilHeaderCard({
    fotoUrl: resolverUrlPerfil(p),
    totalPosts: publicaciones.length,
    seguidores: p.total_seguidores ?? 0,
    seguidos: p.total_seguidos ?? 0,
    nombre,
    usuario,
    bio: p.presentacion ?? '',
    carrera: p.carrera ?? '',
    semestre: p.semestre ?? null,
    igUrl: p.instagram_url ?? null,
    fbUrl: p.facebook_url ?? null,
    ttUrl: p.tiktok_url ?? null,
    // mostrarAvatarConHistoria / mostrarBotonesAccion se dejan en
    // su default (false) — es justo el modo "simplificado" del Dart.
  });
  activarPerfilHeaderCard(headerZona, {
    onAvatarTap: () => abrirFotoCompleta(resolverUrlPerfil(p)),
    onSeguidoresTap: () => mostrarSeguidoresSheet({ usuarioId: uid, tipo: TipoLista.SEGUIDORES, uid }),
    onSeguidosTap: () => mostrarSeguidoresSheet({ usuarioId: uid, tipo: TipoLista.SEGUIDOS, uid }),
    onAbrirRed: abrirUrl,
    urlsRed: { ig: p.instagram_url, fb: p.facebook_url, tt: p.tiktok_url },
  });

  // ── Lista de publicaciones ────────────────────────────────────
  const elPublicaciones = contenedor.querySelector('#mpfd-publicaciones');
  elPublicaciones.innerHTML = publicaciones.map((post) => renderTarjetaPublicacion(post)).join('');

  publicaciones.forEach((post) => {
    const elTarjeta = elPublicaciones.querySelector(`[data-post-id="${post.id}"]`);
    if (!elTarjeta) return;
    activarTarjetaPublicacion(elTarjeta, post, {
      onRefresh,
      // Estamos parados sobre el propio perfil: si se toca el
      // autor (que siempre es uno mismo aquí), simplemente regresa
      // a la pestaña "Mi Perfil" en vez de navegar a ningún lado.
      onMiPerfilTap: () => window.history.back(),
    });
  });

  // ── Scroll a la publicación tocada ────────────────────────────
  if (indiceInicial > 0 && publicaciones[indiceInicial]) {
    const elObjetivo = elPublicaciones.querySelector(`[data-post-id="${publicaciones[indiceInicial].id}"]`);
    elObjetivo?.scrollIntoView({ block: 'start' });
  }
}

function abrirUrl(url) {
  if (!url) return;
  let final = url.trim();
  if (!final.startsWith('http')) final = `https://${final}`;
  window.open(final, '_blank', 'noopener');
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}