// perfil-publico.js
// Ruta real: js/features/perfil/perfil-publico.js
//
// Puerto de PerfilPublico.dart (v12). Pantalla de perfil de OTRO
// usuario: info + stats + seguir/mensaje + redes + destacadas +
// grid de publicaciones (visible para cualquiera, sin necesidad de
// seguir — mismo criterio que el Dart desde su v7).
//
// DIFERENCIA DE PLATAFORMA — ruta: el hash del router SÍ puede
// llevar el id del usuario como parámetro posicional normal (a
// diferencia de mi-perfil-feed-detalle.js, que necesita el patrón
// de "dato pendiente" porque carga un arreglo completo). Aquí basta
// con navegarA(`/perfil-publico/${usuarioId}`) — de hecho
// tarjeta-publicacion.js YA navega así en su TODO de irAlPerfil().
//
// DIFERENCIA DE PLATAFORMA — helpers de UI: el Dart duplica sus
// propios _AvatarConHistoria/_Stat/_BotonRed/_InsigniasRow porque
// en Flutter cada Widget vive en su propio árbol. Aquí no hace
// falta duplicar nada: se reutilizan renderAvatar/renderStatCol/
// renderBotonRed/renderInsigniasRow/formatContador, los mismos que
// ya usa mi-perfil-header.js — mismo criterio de "una sola fuente
// de verdad" que ya sigue el resto del port.
//
// DIFERENCIA DE PLATAFORMA — al tocar un post del grid: el Dart usa
// una pantalla propia (_FeedListaScreen, lista completa arrancando
// en el índice tocado). Aquí se reutiliza directo
// ver-publicacion.js (post + comentarios inline) — ya existe,
// cubre el caso de uso real, y evita duplicar la lógica de
// mi-perfil-feed-detalle.js para un tercer lugar. Avisar si de
// verdad se necesita la lista completa en vez de la vista de un
// solo post.
//
// PENDIENTE EXPLÍCITO — "Mensaje": el Dart abre ConversacionScreen
// directo (no hace falta crear el chat de antemano). Mientras el
// módulo de chat no esté conectado aquí, este botón es un stub con
// toast "próximamente" — buscar "TODO PENDIENTE" en este archivo.
//
// Historias Destacadas: YA PORTADO. Se reutiliza el mismo módulo
// compartido de destacadas/seccion-destacadas.js que usa
// mi-perfil-screen.js, aquí con editable:false (sin "+ Nueva" ni
// pulsación larga para editar/eliminar — modo solo lectura, igual
// que SeccionDestacadasPublica en el Dart). Al igual que el Dart,
// el contenedor de la sección solo se pinta si hay al menos una
// colección — si _destacadas está vacío no se muestra ni la tarjeta
// ni el header "☆ Destacadas".
//
// PENDIENTE / A CONFIRMAR — mostrarSeguidoresSheet(): el Dart le
// pasa también puedeVer (gatea la lista si no sigues a la persona)
// y nombreUsuario. En el JS solo he visto uso con
// {usuarioId, tipo, uid} (en mi-perfil-screen.js). Aquí se llama
// igual con esos 3 — si seguidores-sheet.js ya soporta puedeVer,
// avisar para agregarlo (por ahora la lista se mostraría siempre,
// sin gatear por "siguiendo").

import { supabaseClient } from '../../core/supabase-client.js';
import { registrarRuta, navegarA } from '../../core/router.js';
import { mostrarToast } from '../../core/toast.js';
import { resolverUrlPerfil, resolverUrlMedio } from '../../core/perfil-utils.js';
import { formatContador, renderStatCol, renderBotonRed, renderInsigniasRow, renderAvatar, abrirFotoCompleta, montarMiniaturaVideo } from './mi-perfil/mi-perfil-widgets.js';
import { mostrarSeguidoresSheet, TipoLista } from './seguidores-sheet.js';
import { abrirVerHistorias } from '../social/historias/ver-historias/ver-historia.js';
import { abrirPublicacion } from '../social/publicaciones/ver-publicacion.js';
import { renderSeccionDestacadas, activarSeccionDestacadas } from './destacadas/seccion-destacadas.js';
import { abrirVerDestacada } from './destacadas/ver-destacada.js';

const SELECT_PERFIL_PUBLICO = [
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

export function abrirPerfilPublico(usuarioId) {
  navegarA(`/perfil-publico/${usuarioId}`);
}

registrarRuta('/perfil-publico', render);

async function render(contenedor, usuarioId) {
  if (!usuarioId) {
    contenedor.innerHTML = `<div class="pp-error"><p>Perfil no encontrado.</p></div>`;
    return;
  }

  const estado = {
    perfil: null,
    publicaciones: [],
    susHistorias: [],
    insignias: [],
    destacadas: [],
    cargando: true,
    siguiendo: false,
    cargandoFollow: false,
    susHistoriasVistas: false,
    totalSeguidores: 0,
    totalSeguidos: 0,
  };

  contenedor.innerHTML = `<div class="pp-screen" id="pp-root"></div>`;
  const root = contenedor.querySelector('#pp-root');

  const { data: userData } = await supabaseClient.auth.getUser();
  const uid = userData?.user?.id ?? null;

  function pintarCargando() {
    root.innerHTML = `
      <header class="pp-topbar"><button class="pp-volver" data-pp-volver aria-label="Regresar">‹</button></header>
      <div class="pp-cargando"><span class="btn-spinner"></span></div>
    `;
    root.querySelector('[data-pp-volver]').addEventListener('click', () => window.history.back());
  }

  async function cargarTodo() {
    estado.cargando = true;
    pintarCargando();
    await Promise.all([
      cargarPerfil(),
      cargarEstadoFollow(),
      cargarConteos(),
      cargarHistorias(),
      cargarInsignias(),
      cargarPublicaciones(),
      cargarDestacadas(),
    ]);
    estado.cargando = false;
    pintar();
  }

  async function cargarPerfil() {
    try {
      const { data, error } = await supabaseClient.from('perfiles').select(SELECT_PERFIL_PUBLICO).eq('id', usuarioId).single();
      if (error) throw error;
      estado.perfil = data;
    } catch (error) {
      console.error('perfil-publico – perfil:', error);
    }
  }

  async function cargarEstadoFollow() {
    if (!uid) return;
    try {
      const { data, error } = await supabaseClient
        .from('seguidores')
        .select('id')
        .eq('seguidor_id', uid)
        .eq('seguido_id', usuarioId)
        .maybeSingle();
      if (error) throw error;
      estado.siguiendo = data != null;
    } catch (error) {
      console.error('perfil-publico – estado follow:', error);
    }
  }

  async function cargarConteos() {
    try {
      const { data: seguidoresRaw } = await supabaseClient.from('seguidores').select('id').eq('seguido_id', usuarioId);
      const { data: seguidosRaw } = await supabaseClient.from('seguidores').select('id').eq('seguidor_id', usuarioId);
      estado.totalSeguidores = (seguidoresRaw ?? []).length;
      estado.totalSeguidos = (seguidosRaw ?? []).length;
    } catch (error) {
      console.error('perfil-publico – conteos:', error);
    }
  }

  async function cargarHistorias() {
    try {
      const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabaseClient
        .from('historias')
        .select(`
          id, media_url, cdn_url, tipo, creado_en, autor_id, vistas,
          preview_url, track_titulo, track_artista, track_cover, track_inicio_ms
        `)
        .eq('autor_id', usuarioId)
        .gte('creado_en', hace24h)
        .order('creado_en', { ascending: true });
      if (error) throw error;

      const historias = data ?? [];
      let todasVistas = false;
      if (historias.length > 0 && uid) {
        const ids = historias.map((h) => h.id);
        const { data: vistasRaw } = await supabaseClient
          .from('historia_vistas')
          .select('historia_id')
          .eq('usuario_id', uid)
          .in('historia_id', ids);
        const vistasIds = new Set((vistasRaw ?? []).map((v) => v.historia_id));
        todasVistas = ids.every((id) => vistasIds.has(id));
      }
      estado.susHistorias = historias;
      estado.susHistoriasVistas = todasVistas;
    } catch (error) {
      console.error('perfil-publico – historias:', error);
    }
  }

  async function cargarInsignias() {
    try {
      const { data, error } = await supabaseClient
        .from('insignias')
        .select('tipo, otorgada_en')
        .eq('perfil_id', usuarioId)
        .order('otorgada_en', { ascending: true });
      if (error) throw error;
      estado.insignias = data ?? [];
    } catch (error) {
      console.error('perfil-publico – insignias:', error);
    }
  }

  // Mismo orden que mi-perfil-screen.js (creado_en ascendente) para
  // mantener consistencia entre las dos pantallas que usan este
  // mismo módulo de destacadas — el Dart compartido no impone un
  // orden, así que se sigue el criterio ya establecido en el port.
  async function cargarDestacadas() {
    try {
      const { data, error } = await supabaseClient
        .from('historias_destacadas')
        .select('id, nombre, portada_url, creado_en')
        .eq('autor_id', usuarioId)
        .order('creado_en', { ascending: true });
      if (error) throw error;
      estado.destacadas = data ?? [];
    } catch (error) {
      console.error('perfil-publico – destacadas:', error);
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
        .eq('autor_id', usuarioId)
        .order('creado_en', { ascending: false });
      if (error) throw error;

      const postIds = (data ?? []).map((p) => p.id);
      const misLikes = {};
      if (postIds.length > 0 && uid) {
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
      console.error('perfil-publico – publicaciones:', error);
    }
  }

  async function toggleFollow() {
    if (!uid || estado.cargandoFollow) return;
    estado.cargandoFollow = true;
    const antes = estado.siguiendo;
    estado.siguiendo = !antes;
    estado.totalSeguidores += antes ? -1 : 1;
    pintar();

    try {
      if (antes) {
        await supabaseClient.from('seguidores').delete().eq('seguidor_id', uid).eq('seguido_id', usuarioId);
      } else {
        await supabaseClient.from('seguidores').insert({ seguidor_id: uid, seguido_id: usuarioId });
      }
    } catch (error) {
      console.error('perfil-publico – toggle follow:', error);
      estado.siguiendo = antes;
      estado.totalSeguidores += antes ? 1 : -1;
    } finally {
      estado.cargandoFollow = false;
      pintar();
    }
  }

  function pintar() {
    if (estado.cargando) {
      pintarCargando();
      return;
    }

    const p = estado.perfil ?? {};
    const nombre = p.nombre ?? '';
    const usuario = p.nombre_usuario ?? '';
    const bio = p.presentacion ?? '';
    const carrera = p.carrera ?? '';
    const semestre = p.semestre ?? null;
    const fotoUrl = resolverUrlPerfil(p);
    const igUrl = p.instagram_url ?? null;
    const fbUrl = p.facebook_url ?? null;
    const ttUrl = p.tiktok_url ?? null;
    const hayRedes = Boolean(igUrl || fbUrl || ttUrl);
    const tieneHistoria = estado.susHistorias.length > 0 && estado.siguiendo;
    // Igual que el Dart (`if (_destacadas.isNotEmpty)`): la tarjeta
    // ni siquiera se pinta si no hay colecciones.
    const hayDestacadas = estado.destacadas.length > 0;

    root.innerHTML = `
      <header class="pp-topbar">
        <button class="pp-volver" data-pp-volver aria-label="Regresar">‹</button>
        <span class="pp-titulo">${usuario ? `@${escaparHtml(usuario)}` : escaparHtml(nombre)}</span>
      </header>

      <div class="mp-tarjeta pp-info-tarjeta">
        <div class="pp-fila-superior">
          <button class="pp-avatar-btn" data-pp-avatar aria-label="Ver avatar">
            ${renderAvatar({ fotoUrl, tieneHistoria, vistasTodas: estado.susHistoriasVistas, tam: 92 })}
          </button>
          <div class="pp-stats">
            ${renderStatCol({ valor: String(estado.publicaciones.length), label: 'Posts' })}
            <button class="mp-stat-btn" data-pp-seguidores>${renderStatCol({ valor: formatContador(estado.totalSeguidores), label: 'Seguidores' })}</button>
            <button class="mp-stat-btn" data-pp-seguidos>${renderStatCol({ valor: formatContador(estado.totalSeguidos), label: 'Siguiendo' })}</button>
          </div>
        </div>

        <p class="pp-nombre">${escaparHtml(nombre)}</p>
        ${usuario ? `<p class="pp-usuario">@${escaparHtml(usuario)}</p>` : ''}
        ${carrera ? `<p class="pp-carrera">🎓 ${escaparHtml(semestre != null ? `${carrera} · ${semestre}° sem.` : carrera)}</p>` : ''}

        ${renderInsigniasRow(estado.insignias)}

        ${bio ? `<p class="pp-bio">${escaparHtml(bio)}</p>` : ''}

        <div class="pp-acciones">
          ${
            estado.siguiendo
              ? `<button class="pp-btn-siguiendo" data-pp-follow ${estado.cargandoFollow ? 'disabled' : ''}>${estado.cargandoFollow ? '<span class="btn-spinner btn-spinner--sm"></span>' : '✓ Siguiendo'}</button>`
              : `<button class="pp-btn-seguir" data-pp-follow ${estado.cargandoFollow ? 'disabled' : ''}>${estado.cargandoFollow ? '<span class="btn-spinner btn-spinner--sm"></span>' : '+ Seguir'}</button>`
          }
          <button class="pp-btn-mensaje" data-pp-mensaje>💬 Mensaje</button>
        </div>

        ${hayRedes ? `<div class="pp-redes">${[igUrl ? renderBotonRed('instagram') : '', fbUrl ? renderBotonRed('facebook') : '', ttUrl ? renderBotonRed('tiktok') : ''].join('')}</div>` : ''}
      </div>

      ${hayDestacadas ? `<div class="mp-tarjeta mp-destacadas" id="pp-destacadas-zona"></div>` : ''}

      <div class="mp-tarjeta pp-publicaciones-header">
        <span>▦</span> Publicaciones
      </div>

      ${estado.publicaciones.length === 0 ? `
        <div class="pp-vacio">
          <span class="pp-vacio__icono">🖼️</span>
          <p>Aún no hay publicaciones</p>
        </div>
      ` : `<div class="mp-grid" id="pp-grid"></div>`}
    `;

    root.querySelector('[data-pp-volver]').addEventListener('click', () => window.history.back());
    root.querySelector('[data-pp-avatar]').addEventListener('click', () => onAvatarTap(fotoUrl));
    root.querySelector('[data-pp-seguidores]').addEventListener('click', () => mostrarSeguidoresSheet({ usuarioId, tipo: TipoLista.SEGUIDORES, uid }));
    root.querySelector('[data-pp-seguidos]').addEventListener('click', () => mostrarSeguidoresSheet({ usuarioId, tipo: TipoLista.SEGUIDOS, uid }));
    root.querySelector('[data-pp-follow]').addEventListener('click', toggleFollow);
    // TODO PENDIENTE: conectar con el módulo de chat cuando esté
    // listo — abrir directo la conversación 1 a 1 con
    // {otroUsuarioId: usuarioId, otroNombre: nombre, otroNombreUsuario: usuario, otroAvatarUrl: fotoUrl},
    // sin necesidad de crear el chat de antemano (se crea solo al
    // enviar el primer mensaje).
    root.querySelector('[data-pp-mensaje]').addEventListener('click', () => abrirConversacionDesdePerfil({ usuarioId, nombre, usuario, fotoUrl }));

    root.querySelectorAll('[data-red]').forEach((btn) => {
      const red = btn.dataset.red;
      const url = { instagram: igUrl, facebook: fbUrl, tiktok: ttUrl }[red];
      btn.addEventListener('click', () => abrirUrl(url));
    });

    if (hayDestacadas) pintarDestacadas();
    if (estado.publicaciones.length > 0) pintarGrid();
  }

  function pintarDestacadas() {
    const zona = root.querySelector('#pp-destacadas-zona');
    if (!zona) return;
    zona.innerHTML = renderSeccionDestacadas(estado.destacadas, { editable: false });
    activarSeccionDestacadas(zona, {
      destacadas: estado.destacadas,
      editable: false,
      onAbrirVerDestacada: ({ destacadaId, todasIds, indiceInicial }) => {
        abrirVerDestacada({ destacadaId, todasIds, indiceInicial, onIrAMiPerfil: () => {} });
      },
    });
  }

  function pintarGrid() {
    const grid = root.querySelector('#pp-grid');
    grid.innerHTML = estado.publicaciones.map((post, i) => {
      const medios = post.publicacion_medios ?? [];
      const primero = medios[0] ?? null;
      const esVideo = primero?.tipo_medio === 'video';
      const url = primero ? resolverUrlMedio(primero) : null;
      return `
        <button class="mp-celda" data-pp-post="${i}">
          ${
            esVideo && url
              ? `<div class="mp-celda__video-thumb" data-pp-video-thumb="${i}"></div><span class="mp-celda__play">▶️</span>`
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

    grid.querySelectorAll('[data-pp-video-thumb]').forEach((el) => {
      const i = Number(el.dataset.ppVideoThumb);
      const url = resolverUrlMedio(estado.publicaciones[i].publicacion_medios[0]);
      montarMiniaturaVideo(el, url);
    });

    // Se reutiliza ver-publicacion.js (post + comentarios inline)
    // en vez de una pantalla de lista propia — ver nota de cabecera.
    grid.querySelectorAll('[data-pp-post]').forEach((btn) => {
      const i = Number(btn.dataset.ppPost);
      btn.addEventListener('click', () => abrirPublicacion(estado.publicaciones[i], { onMiPerfilTap: () => window.history.back() }));
    });
  }

  function onAvatarTap(fotoUrl) {
    if (estado.susHistorias.length === 0 || !estado.siguiendo) {
      abrirFotoCompleta(fotoUrl);
      return;
    }
    mostrarHojaAvatar(fotoUrl);
  }

  function mostrarHojaAvatar(fotoUrl) {
    const overlay = document.createElement('div');
    overlay.className = 'pp-hoja-avatar-overlay';
    overlay.innerHTML = `
      <div class="pp-hoja-avatar">
        <button class="pp-hoja-avatar__item" data-pp-ver-foto>👤 Ver foto de perfil</button>
        <button class="pp-hoja-avatar__item pp-hoja-avatar__item--accent" data-pp-ver-historia>📖 Ver historia</button>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    function cerrar() {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
    }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
    overlay.querySelector('[data-pp-ver-foto]').addEventListener('click', () => { cerrar(); abrirFotoCompleta(fotoUrl); });
    overlay.querySelector('[data-pp-ver-historia]').addEventListener('click', () => { cerrar(); verHistoria(); });
  }

  function verHistoria() {
    if (estado.susHistorias.length === 0 || !estado.perfil) return;
    const grupo = {
      autor_id: usuarioId,
      nombre: estado.perfil.nombre ?? '',
      foto: resolverUrlPerfil(estado.perfil),
      esTuyo: false,
      stories: estado.susHistorias,
    };
    // Igual que en mi-perfil-screen.js: abrirVerHistorias() no
    // expone callback de cierre, así que el contorno del avatar no
    // se refresca hasta el próximo cargarTodo() — aceptable por ahora.
    abrirVerHistorias({ grupos: [grupo], indiceInicial: 0, onIrAMiPerfil: () => {} });
  }

  function abrirUrl(url) {
    if (!url) return;
    let final = url.trim();
    if (!final.startsWith('http')) final = `https://${final}`;
    window.open(final, '_blank', 'noopener');
  }

  async function abrirConversacionDesdePerfil({ usuarioId, nombre, usuario, fotoUrl }) {
  const overlay = document.createElement('div');
  overlay.className = 'conv-overlay-raiz';
  document.body.appendChild(overlay);

  window.history.pushState({ jaguarChatConversacion: true }, '');
  window.addEventListener('popstate', cerrarConversacionOverlay, { once: true });

  function cerrarConversacionOverlay() {
    overlay.remove();
  }

  try {
    const { render: renderConversacion } = await import('../chat/chats/conversacion/conversacion-screen.js');
    await renderConversacion(overlay, {
      otroUsuarioId: usuarioId,
      otroNombre: nombre,
      otroNombreUsuario: usuario || null,
      otroAvatarUrl: fotoUrl || null,
    });
  } catch (error) {
    console.error('perfil-publico – abrirConversacionDesdePerfil:', error);
    mostrarToast('No se pudo abrir la conversación', 'error');
    window.removeEventListener('popstate', cerrarConversacionOverlay);
    overlay.remove();
    window.history.back();
  }
}

  await cargarTodo();
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}
