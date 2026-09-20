// mi-perfil-screen.js
// Ruta real: js/features/perfil/mi-perfil/mi-perfil-screen.js
//
// Puerto de mi_perfil_screen.dart. Pantalla "Mi Perfil": header +
// destacadas + grid de publicaciones (3 columnas).
//
// DIFERENCIA DE PLATAFORMA — cómo se monta: en el Dart es una
// Screen con Navigator propio. En el port web, "Mi Perfil" es una
// PESTAÑA DEL SHELL (ver shell.js → montarPanel), no una ruta con
// URL propia — por eso este archivo exporta un render(contenedor)
// normal en vez de usar registrarRuta(), mismo criterio que
// pantalla-principal.js para la pestaña "Comunidad".
//
// DEPENDENCIAS AÚN NO PORTADAS — quedan como stub (toast
// "próximamente") hasta que se porten esos archivos. Buscar
// "TODO PENDIENTE" en este archivo para ubicarlas exactas:
//   • SeguidoresSheet.dart     → lista de seguidores/seguidos
//     (el que me pasaste es el .dart original, no un JS ya portado)
//   • mi_perfil_feed_detalle.dart → feed completo al tocar un post
//   • editar_perfil.dart       → navega a '/perfil/editar', ruta
//     que shell.js ya asume pero que aún nadie registra
//
// Historias Destacadas: YA PORTADO. Reemplaza el stub anterior
// (pintarDestacadasStub) por el carrusel real de
// destacadas/seccion-destacadas.js, en modo editable (con "+ Nueva"
// y pulsación larga para editar/eliminar). El orden con el que se
// consultan aquí (creado_en descendente — colección más reciente
// primero) es una decisión propia de este archivo, ya que el Dart
// compartido de SeccionDestacadas no incluye la consulta que arma la
// lista `destacadas` que recibe el widget — avisar si el orden real
// del proyecto es otro.

import { supabaseClient } from '../../../core/supabase-client.js';
import { navegarA } from '../../../core/router.js';
import { resolverUrlPerfil, resolverUrlMedio } from '../../../core/perfil-utils.js';
import { renderPerfilHeaderCard, activarPerfilHeaderCard } from './mi-perfil-header.js';
import { abrirFotoCompleta, montarMiniaturaVideo } from './mi-perfil-widgets.js';
import { abrirVerHistorias } from '../../social/historias/ver-historias/ver-historia.js';
import { mostrarSeguidoresSheet, TipoLista } from '../seguidores-sheet.js';
import { abrirFeedDetalle } from './mi-perfil-feed-detalle.js';
import { renderSeccionDestacadas, activarSeccionDestacadas } from '../destacadas/seccion-destacadas.js';
import { abrirSeleccionarHistoriasDestacada } from '../destacadas/seleccionar-historias-destacada.js';
import { abrirVerDestacada } from '../destacadas/ver-destacada.js';

const SELECT_MI_PERFIL = [
  'id',
  'nombre',
  'nombre_usuario',
  'cdn_foto_perfil',
  'carrera',
  'semestre',
  'presentacion',
  'facebook_url',
  'instagram_url',
  'tiktok_url',
  'total_seguidores',
  'total_seguidos',
  'estado_cuenta',
  'creado_en',
].join(', ');

export async function render(contenedor) {
  const estado = {
    perfil: null,
    publicaciones: [],
    misHistorias: [],
    insignias: [],
    destacadas: [],
    cargando: true,
    yoViMisHistorias: false,
  };

  contenedor.innerHTML = `<div class="mp-screen" id="mp-root"></div>`;
  const root = contenedor.querySelector('#mp-root');

  const { data: userData } = await supabaseClient.auth.getUser();
  const uid = userData?.user?.id ?? null;
  if (!uid) return;

  function pintarCargando() {
    root.innerHTML = `<div class="mp-cargando"><span class="btn-spinner"></span></div>`;
  }

  async function cargarTodo() {
    estado.cargando = true;
    pintarCargando();
    await Promise.all([
      cargarPerfil(),
      cargarPublicaciones(),
      cargarMisHistorias(),
      cargarInsignias(),
      cargarDestacadas(),
    ]);
    estado.cargando = false;
    pintar();
  }

  async function cargarPerfil() {
    try {
      const { data: perfil, error } = await supabaseClient.from('perfiles').select(SELECT_MI_PERFIL).eq('id', uid).single();
      if (error) throw error;
      const { data: seguidoresRaw } = await supabaseClient.from('seguidores').select('id').eq('seguido_id', uid);
      const { data: seguidosRaw } = await supabaseClient.from('seguidores').select('id').eq('seguidor_id', uid);
      estado.perfil = {
        ...perfil,
        total_seguidores: (seguidoresRaw ?? []).length,
        total_seguidos: (seguidosRaw ?? []).length,
      };
    } catch (error) {
      console.error('mi-perfil-screen – perfil:', error);
    }
  }

  async function cargarInsignias() {
    try {
      const { data, error } = await supabaseClient
        .from('insignias')
        .select('tipo, otorgada_en')
        .eq('perfil_id', uid)
        .order('otorgada_en', { ascending: true });
      if (error) throw error;
      estado.insignias = data ?? [];
    } catch (error) {
      console.error('mi-perfil-screen – insignias:', error);
    }
  }

  async function cargarPublicaciones() {
    try {
      const { data, error } = await supabaseClient
        .from('publicaciones')
        .select(`
          id, contenido, tipo, creado_en,
          total_reacciones, total_comentarios, autor_id,
          perfiles!publicaciones_autor_id_fkey(nombre, nombre_usuario, cdn_foto_perfil),
          publicacion_medios(url, cdn_url, tipo_medio, orden)
        `)
        .eq('autor_id', uid)
        .order('creado_en', { ascending: false });
      if (error) throw error;

      const postIds = (data ?? []).map((p) => p.id);
      const misLikes = {};
      if (postIds.length > 0) {
        const { data: likesRaw } = await supabaseClient
          .from('reacciones')
          .select('publicacion_id')
          .eq('usuario_id', uid)
          .eq('tipo', 'like')
          .in('publicacion_id', postIds);
        (likesRaw ?? []).forEach((l) => { misLikes[l.publicacion_id] = true; });
      }

      estado.publicaciones = (data ?? []).map((p) => ({
        ...p,
        publicacion_medios: [...(p.publicacion_medios ?? [])].sort((a, b) => a.orden - b.orden),
        yo_di_like: Boolean(misLikes[p.id]),
      }));
    } catch (error) {
      console.error('mi-perfil-screen – publicaciones:', error);
    }
  }

  async function cargarMisHistorias() {
    try {
      const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabaseClient
        .from('historias')
        .select(`
          id, media_url, cdn_url, tipo, creado_en, autor_id, vistas,
          preview_url, track_titulo, track_artista, track_cover, track_inicio_ms
        `)
        .eq('autor_id', uid)
        .gte('creado_en', hace24h)
        .order('creado_en', { ascending: true });
      if (error) throw error;

      const historias = data ?? [];
      let todasVistas = false;
      if (historias.length > 0) {
        const ids = historias.map((h) => h.id);
        const { data: vistasRaw } = await supabaseClient
          .from('historia_vistas')
          .select('historia_id')
          .eq('usuario_id', uid)
          .in('historia_id', ids);
        const vistasIds = new Set((vistasRaw ?? []).map((v) => v.historia_id));
        todasVistas = ids.every((id) => vistasIds.has(id));
      }
      estado.misHistorias = historias;
      estado.yoViMisHistorias = todasVistas;
    } catch (error) {
      console.error('mi-perfil-screen – mis historias:', error);
    }
  }

  async function cargarDestacadas() {
    try {
      const { data, error } = await supabaseClient
        .from('historias_destacadas')
        .select('id, nombre, portada_url, creado_en')
        .eq('autor_id', uid)
        .order('creado_en', { ascending: true });
      if (error) throw error;
      estado.destacadas = data ?? [];
    } catch (error) {
      console.error('mi-perfil-screen – destacadas:', error);
    }
  }

  function pintar() {
    if (estado.cargando) {
      pintarCargando();
      return;
    }

    const p = estado.perfil ?? {};
    root.innerHTML = `
      <header class="mp-topbar">
        <div class="mp-topbar__titulo">
          <span>Mi</span><span class="mp-topbar__acento">Perfil</span>
        </div>
        <button class="mp-topbar__ajustes" data-mp-ajustes aria-label="Ajustes">⚙️</button>
      </header>

      <div class="mp-tarjeta mp-tarjeta--header" id="mp-header-zona"></div>

      <div class="mp-tarjeta mp-destacadas" id="mp-destacadas-zona"></div>

      <div class="mp-tarjeta mp-publicaciones-header">
        <span>▦</span> Publicaciones
      </div>

      ${estado.publicaciones.length === 0 ? `
        <div class="mp-vacio">
          <span class="mp-vacio__icono">🖼️</span>
          <p>Aún no tienes publicaciones</p>
        </div>
      ` : `<div class="mp-grid" id="mp-grid"></div>`}
    `;

    const headerZona = root.querySelector('#mp-header-zona');
    headerZona.innerHTML = renderPerfilHeaderCard({
      fotoUrl: resolverUrlPerfil(p),
      mostrarAvatarConHistoria: true,
      tieneHistoria: estado.misHistorias.length > 0,
      vistasTodas: estado.yoViMisHistorias,
      totalPosts: estado.publicaciones.length,
      seguidores: p.total_seguidores ?? 0,
      seguidos: p.total_seguidos ?? 0,
      nombre: p.nombre ?? '',
      usuario: p.nombre_usuario ?? '',
      bio: p.presentacion ?? '',
      carrera: p.carrera ?? '',
      semestre: p.semestre ?? null,
      insignias: estado.insignias,
      igUrl: p.instagram_url ?? null,
      fbUrl: p.facebook_url ?? null,
      ttUrl: p.tiktok_url ?? null,
      mostrarBotonesAccion: true,
    });
    activarPerfilHeaderCard(headerZona, {
      onAvatarTap: () => onAvatarTap(resolverUrlPerfil(p)),
      onSeguidoresTap: abrirSeguidores,
      onSeguidosTap: abrirSeguidos,
      onAbrirRed: abrirUrl,
      // TODO PENDIENTE: apuntar a la pantalla real cuando se porte
      // editar_perfil.dart y se registre esta ruta.
      onEditarTap: () => navegarA('/perfil/editar'),
      urlsRed: { ig: p.instagram_url, fb: p.facebook_url, tt: p.tiktok_url },
    });

    pintarDestacadas();
    if (estado.publicaciones.length > 0) pintarGrid();

    root.querySelector('[data-mp-ajustes]').addEventListener('click', () => navegarA('/ajustes'));
  }

  function pintarDestacadas() {
    const zona = root.querySelector('#mp-destacadas-zona');
    zona.innerHTML = renderSeccionDestacadas(estado.destacadas, { editable: true });
    activarSeccionDestacadas(zona, {
      destacadas: estado.destacadas,
      editable: true,
      onRecargar: recargarDestacadas,
      onAbrirSeleccionar: (opcionesEdicion) => {
        abrirSeleccionarHistoriasDestacada({
          ...opcionesEdicion,
          onGuardado: recargarDestacadas,
        });
      },
      onAbrirVerDestacada: ({ destacadaId, todasIds, indiceInicial }) => {
        abrirVerDestacada({ destacadaId, todasIds, indiceInicial, onIrAMiPerfil: () => {} });
      },
    });
  }

  async function recargarDestacadas() {
    await cargarDestacadas();
    pintarDestacadas();
  }

  function pintarGrid() {
    const grid = root.querySelector('#mp-grid');
    grid.innerHTML = estado.publicaciones.map((post, i) => {
      const medios = post.publicacion_medios ?? [];
      const primero = medios[0] ?? null;
      const esVideo = primero?.tipo_medio === 'video';
      const url = primero ? resolverUrlMedio(primero) : null;
      return `
        <button class="mp-celda" data-mp-post="${i}">
          ${
            esVideo && url
              ? `<div class="mp-celda__video-thumb" data-mp-video-thumb="${i}"></div><span class="mp-celda__play">▶️</span>`
              : esVideo
                ? `<div class="mp-celda__placeholder"></div>`
                : url
                  ? `<img src="${url}" alt="" />`
                  : `<div class="mp-celda__placeholder"><span>📄</span></div>`
          }
          ${medios.length > 1 ? `<span class="mp-celda__multi">🖇️</span>` : ''}
        </button>
      `;
    }).join('');

    grid.querySelectorAll('[data-mp-video-thumb]').forEach((el) => {
      const i = Number(el.dataset.mpVideoThumb);
      const url = resolverUrlMedio(estado.publicaciones[i].publicacion_medios[0]);
      montarMiniaturaVideo(el, url);
    });

    grid.querySelectorAll('[data-mp-post]').forEach((btn) => {
      btn.addEventListener('click', () => abrirFeedDesde(Number(btn.dataset.mpPost)));
    });
  }

  // ── Acciones ─────────────────────────────────────────────────

  function onAvatarTap(fotoUrl) {
    if (estado.misHistorias.length === 0) {
      abrirFotoCompleta(fotoUrl);
      return;
    }
    mostrarHojaAvatar(fotoUrl);
  }

  // Mini action-sheet propio (solo 2 opciones) — no amerita el shell
  // completo de bottom-sheet.js para un menú tan corto.
  function mostrarHojaAvatar(fotoUrl) {
    const overlay = document.createElement('div');
    overlay.className = 'mp-hoja-avatar-overlay';
    overlay.innerHTML = `
      <div class="mp-hoja-avatar">
        <button class="mp-hoja-avatar__item" data-mp-ver-foto>👤 Ver foto de perfil</button>
        <button class="mp-hoja-avatar__item mp-hoja-avatar__item--accent" data-mp-ver-historia>📖 Ver mi historia</button>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    function cerrar() {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
    }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
    overlay.querySelector('[data-mp-ver-foto]').addEventListener('click', () => { cerrar(); abrirFotoCompleta(fotoUrl); });
    overlay.querySelector('[data-mp-ver-historia]').addEventListener('click', () => { cerrar(); verMiHistoria(); });
  }

  function verMiHistoria() {
    if (estado.misHistorias.length === 0 || !estado.perfil) return;
    const grupo = {
      autor_id: uid,
      nombre: estado.perfil.nombre ?? '',
      foto: resolverUrlPerfil(estado.perfil),
      esTuyo: true,
      stories: estado.misHistorias,
    };
    // NOTA: abrirVerHistorias() no expone un callback de cierre, así
    // que a diferencia del Dart (que refresca _misHistorias al
    // volver del visor), aquí el contorno del avatar no se actualiza
    // hasta el próximo cargarTodo(). Aceptable por ahora.
    abrirVerHistorias({ grupos: [grupo], indiceInicial: 0, onIrAMiPerfil: () => {} });
  }

    // DESPUÉS:
  function abrirSeguidores() {
    mostrarSeguidoresSheet({
      usuarioId: uid,
      tipo: TipoLista.SEGUIDORES,
      uid,
    });
  }

function abrirSeguidos() {
  mostrarSeguidoresSheet({
    usuarioId: uid,
    tipo: TipoLista.SEGUIDOS,
    uid,
  });
}

  function abrirFeedDesde(indice) {
  abrirFeedDetalle({ perfil: estado.perfil, publicaciones: estado.publicaciones, indiceInicial: indice, uid, onRefresh: cargarTodo });
}

  function abrirUrl(url) {
    if (!url) return;
    let final = url.trim();
    if (!final.startsWith('http')) final = `https://${final}`;
    window.open(final, '_blank', 'noopener');
  }

  await cargarTodo();
}
