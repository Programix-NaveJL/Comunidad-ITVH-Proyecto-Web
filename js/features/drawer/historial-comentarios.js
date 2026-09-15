// historial-comentarios.js
// Ruta real sugerida: js/features/drawer/historial-comentarios.js
//
// Puerto de historial_comentarios.dart. Lista de comentarios (y
// respuestas) que el usuario ha dejado, agrupada por fecha (Hoy /
// Esta semana / Anteriores). Reemplaza el placeholder que dejó
// ajustes.js en '/historial-comentarios' — este archivo se
// autoregistra en esa misma ruta (ver nota al final de ese
// archivo).
//
// Misma nota de plataforma que historial-reacciones.js para la
// miniatura de video: <video> fuera de pantalla + <canvas> para
// capturar el primer frame, en vez de video_thumbnail.
//
// NAVEGACIÓN A LA PUBLICACIÓN: ya con ver-publicacion.js portado,
// al tocar un item se refetchea la publicación completa (el join de
// "comentarios" solo trae lo que había al momento de comentar) y se
// abre con abrirPublicacion(), que deja el post listo en memoria
// antes de navegar a la ruta '/publicacion'.

import { supabaseClient } from '../../core/supabase-client.js';
import { registrarRuta } from '../../core/router.js';
import { mostrarToast } from '../../core/toast.js';
import { resolverUrlMedio, resolverUrlPerfil } from '../../core/perfil-utils.js';
import { abrirPublicacion as abrirVerPublicacion } from '../social/publicaciones/ver-publicacion.js';

registrarRuta('/historial-comentarios', render);

let items = [];
let cargando = true;
let contenedorActual = null;

async function render(contenedor) {
  contenedorActual = contenedor;
  items = [];
  cargando = true;

  contenedor.innerHTML = plantillaBase();
  contenedor.querySelector('#hc-volver').addEventListener('click', () => window.history.back());

  await cargar();
}

function plantillaBase() {
  return `
    <div class="historial-comentarios">
      <header class="historial-comentarios__header">
        <button class="historial-comentarios__volver" id="hc-volver" aria-label="Regresar">‹</button>
        <h1>Mis comentarios</h1>
      </header>
      <div class="historial-comentarios__cuerpo" id="hc-cuerpo"></div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// CARGA DE DATOS
// ═══════════════════════════════════════════════════════════════

async function cargar() {
  const { data: userData } = await supabaseClient.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return;

  cargando = true;
  renderCuerpo();

  try {
    const { data, error } = await supabaseClient
      .from('comentarios')
      .select(
        'id, contenido, creado_en, publicacion_id, parent_id, ' +
          'publicaciones!comentarios_publicacion_id_fkey(' +
          'contenido, autor_id, tipo, total_reacciones, total_comentarios, ' +
          'perfiles!publicaciones_autor_id_fkey(nombre, nombre_usuario, cdn_foto_perfil), ' +
          'publicacion_medios(url, cdn_url, tipo_medio, orden)' +
          ')'
      )
      .eq('autor_id', uid)
      .order('creado_en', { ascending: false })
      .limit(200);
    if (error) throw error;

    items = (data ?? []).map(mapearItemComentario);
  } catch (error) {
    console.error('historial-comentarios – cargar:', error);
  } finally {
    cargando = false;
    renderCuerpo();
  }
}

function mapearItemComentario(fila) {
  const pub = fila.publicaciones ?? {};
  const perfil = pub.perfiles ?? {};

  const medios = [...(pub.publicacion_medios ?? [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const primerMedio = medios[0] ?? null;
  const thumbUrl = primerMedio ? resolverUrlMedio(primerMedio) : null;
  const esVideo = primerMedio?.tipo_medio === 'video';

  return {
    id: fila.id,
    contenido: fila.contenido ?? '',
    creadoEn: fila.creado_en ? new Date(fila.creado_en) : new Date(),
    publicacionId: fila.publicacion_id,
    esRespuesta: fila.parent_id != null,
    publicacionContenido: pub.contenido ?? null,
    autorNombre: perfil.nombre ?? null,
    autorFotoUrl: resolverUrlPerfil(perfil) || null,
    thumbUrl: thumbUrl || null,
    thumbEsVideo: esVideo,
  };
}

// ═══════════════════════════════════════════════════════════════
// AGRUPACIÓN Y FORMATO
// ═══════════════════════════════════════════════════════════════

function agruparPorFecha(lista) {
  const hoy = [];
  const semana = [];
  const antiguas = [];
  const ahora = Date.now();

  for (const item of lista) {
    const diffHoras = (ahora - item.creadoEn.getTime()) / 3600000;
    if (diffHoras < 24) hoy.push(item);
    else if (diffHoras < 24 * 7) semana.push(item);
    else antiguas.push(item);
  }

  const grupos = [];
  if (hoy.length) grupos.push(['Hoy', hoy]);
  if (semana.length) grupos.push(['Esta semana', semana]);
  if (antiguas.length) grupos.push(['Anteriores', antiguas]);
  return grupos;
}

function tiempoRelativo(fecha) {
  const diffMs = Date.now() - fecha.getTime();
  const min = Math.floor(diffMs / 60000);
  const horas = Math.floor(diffMs / 3600000);
  const dias = Math.floor(diffMs / 86400000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  if (horas < 24) return `hace ${horas} h`;
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} d`;
  return `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
}

// ═══════════════════════════════════════════════════════════════
// NAVEGACIÓN A LA PUBLICACIÓN
// ═══════════════════════════════════════════════════════════════

// Refetch fresco: el join de "comentarios" trae los datos de la
// publicación tal como estaban cuando se comentó, y pueden estar
// desactualizados. yo_di_like se manda en false como valor
// provisional — la propia tarjeta-publicacion.js/controlador de
// ver-publicacion.js resuelve el estado real de "me gusta" al
// activarse.
async function abrirPublicacion(item) {
  try {
    const { data, error } = await supabaseClient
      .from('publicaciones')
      .select(
        `id, contenido, tipo, creado_en, total_reacciones,
        total_comentarios, autor_id,
        perfiles!publicaciones_autor_id_fkey(nombre, nombre_usuario, cdn_foto_perfil),
        publicacion_medios(url, cdn_url, tipo_medio, orden)`
      )
      .eq('id', item.publicacionId)
      .maybeSingle();
    if (error || !data) {
      mostrarToast('No se pudo abrir la publicación.', 'error');
      return;
    }

    const medios = [...(data.publicacion_medios ?? [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    abrirVerPublicacion({ ...data, publicacion_medios: medios, yo_di_like: false });
  } catch (error) {
    console.error('historial-comentarios – abrirPublicacion:', error);
    mostrarToast('No se pudo abrir la publicación.', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════

function renderCuerpo() {
  const cuerpo = contenedorActual?.querySelector('#hc-cuerpo');
  if (!cuerpo) return;

  if (cargando) {
    cuerpo.innerHTML = `<div class="historial-comentarios__spinner"><span class="btn-spinner"></span></div>`;
    return;
  }

  if (items.length === 0) {
    cuerpo.innerHTML = renderEstadoVacio('💬', 'No has comentado en ninguna publicación aún.');
    return;
  }

  const grupos = agruparPorFecha(items);
  cuerpo.innerHTML = grupos
    .map(
      ([titulo, lista]) => `
        <p class="historial-comentarios__seccion">${titulo}</p>
        <div class="historial-comentarios__grupo">
          ${lista.map(renderTile).join('')}
        </div>
      `
    )
    .join('');

  cuerpo.querySelectorAll('[data-item-id]').forEach((tile) => {
    tile.addEventListener('click', () => {
      const item = items.find((i) => i.id === tile.dataset.itemId);
      if (item) abrirPublicacion(item);
    });
  });

  activarMiniaturasVideo(cuerpo);
}

function renderTile(item) {
  const avatar = item.autorFotoUrl ? `<img src="${item.autorFotoUrl}" alt="" />` : '<span>👤</span>';
  const etiqueta = item.esRespuesta ? '↩︎ Respondiste' : '💬 Comentaste';

  const miniatura = item.thumbUrl
    ? item.thumbEsVideo
      ? `<div class="historial-comentarios__thumb" data-video-thumb data-url="${item.thumbUrl}"></div>`
      : `<img class="historial-comentarios__thumb" src="${item.thumbUrl}" alt="" onerror="this.remove()" />`
    : '';

  return `
    <div class="historial-comentarios__tile" data-item-id="${item.id}">
      <div class="historial-comentarios__avatar">${avatar}</div>
      <div class="historial-comentarios__textos">
        <p class="historial-comentarios__encabezado">
          <strong>${etiqueta} en una publicación</strong>${item.autorNombre ? ` de ${item.autorNombre}` : ''}
        </p>
        ${item.publicacionContenido ? `<p class="historial-comentarios__extracto">${escaparHtml(item.publicacionContenido)}</p>` : ''}
        <div class="historial-comentarios__burbuja">${escaparHtml(item.contenido)}</div>
        <p class="historial-comentarios__tiempo">${tiempoRelativo(item.creadoEn)}</p>
      </div>
      ${miniatura}
    </div>
  `;
}

function renderEstadoVacio(icono, mensaje) {
  return `
    <div class="historial-comentarios__vacio">
      <span class="historial-comentarios__vacio-icono">${icono}</span>
      <p class="historial-comentarios__vacio-titulo">Sin actividad</p>
      <p class="historial-comentarios__vacio-mensaje">${mensaje}</p>
    </div>
  `;
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════════
// MINIATURA DE VIDEO — <video> fuera de pantalla + <canvas>
// ═══════════════════════════════════════════════════════════════

function activarMiniaturasVideo(contenedor) {
  contenedor.querySelectorAll('[data-video-thumb]').forEach(async (celda) => {
    const url = celda.dataset.url;
    const dataUrl = await capturarPrimerFrame(url);
    if (dataUrl) {
      celda.innerHTML = `<img src="${dataUrl}" alt="" /><span class="historial-comentarios__thumb-play">▶️</span>`;
    }
  });
}

function capturarPrimerFrame(url) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = url;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    video.addEventListener('error', () => resolve(null));

    video.addEventListener('loadeddata', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = Math.round((120 * video.videoHeight) / video.videoWidth) || 120;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      } catch (error) {
        console.error('historial-comentarios – capturar frame:', error);
        resolve(null);
      }
    });
  });
}