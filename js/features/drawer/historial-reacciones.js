// historial-reacciones.js
// Ruta real sugerida: js/features/drawer/historial-reacciones.js
//
// Puerto de historial_reacciones.dart. Lista de publicaciones a las
// que el usuario reaccionó, agrupada por fecha (Hoy / Esta semana /
// Anteriores). Reemplaza el placeholder que dejó ajustes.js en
// '/historial-reacciones' — este archivo se autoregistra en esa
// misma ruta, así que hay que quitar el registrarRuta placeholder
// de ajustes.js para no duplicarla (ver nota al final de ese
// archivo).
//
// DIFERENCIA DE PLATAFORMA — miniatura de video: video_thumbnail
// (Dart) genera un frame real a partir del .mp4. En web no hay
// paquete equivalente; se replica con un <video> fuera de pantalla
// + <canvas> para capturar el primer frame, mismo criterio ya usado
// en notificaciones.js para sus miniaturas de video.
//
// NAVEGACIÓN A LA PUBLICACIÓN: ya con ver-publicacion.js portado,
// al tocar un item se refetchea la publicación completa (necesitamos
// datos frescos, no los del join de "reacciones" que solo trae lo
// que había al momento de reaccionar) y se abre con
// abrirPublicacion(), que deja el post listo en memoria antes de
// navegar a la ruta '/publicacion'.

import { supabaseClient } from '../../core/supabase-client.js';
import { registrarRuta } from '../../core/router.js';
import { mostrarToast } from '../../core/toast.js';
import { resolverUrlMedio, resolverUrlPerfil } from '../../core/perfil-utils.js';
import { tipoReaccionDesdeString, EMOJI_REACCION_RAPIDA } from '../social/publicaciones/tarjeta-publicaciones/reacciones.js';
import { abrirPublicacion as abrirVerPublicacion } from '../social/publicaciones/ver-publicacion.js';

registrarRuta('/historial-reacciones', render);

let items = [];
let cargando = true;
let contenedorActual = null;

async function render(contenedor) {
  contenedorActual = contenedor;
  items = [];
  cargando = true;

  contenedor.innerHTML = plantillaBase();
  contenedor.querySelector('#hr-volver').addEventListener('click', () => window.history.back());

  await cargar();
}

function plantillaBase() {
  return `
    <div class="historial-reacciones">
      <header class="historial-reacciones__header">
        <button class="historial-reacciones__volver" id="hr-volver" aria-label="Regresar">‹</button>
        <h1>Mis reacciones</h1>
      </header>
      <div class="historial-reacciones__cuerpo" id="hr-cuerpo"></div>
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
      .from('reacciones')
      .select(
        'id, tipo, creado_en, publicacion_id, ' +
          'publicaciones!reacciones_publicacion_id_fkey(' +
          'contenido, autor_id, tipo, total_reacciones, total_comentarios, ' +
          'perfiles!publicaciones_autor_id_fkey(nombre, nombre_usuario, cdn_foto_perfil), ' +
          'publicacion_medios(url, cdn_url, tipo_medio, orden)' +
          ')'
      )
      .eq('usuario_id', uid)
      .order('creado_en', { ascending: false })
      .limit(200);
    if (error) throw error;

    items = (data ?? []).map(mapearItemReaccion);
  } catch (error) {
    console.error('historial-reacciones – cargar:', error);
  } finally {
    cargando = false;
    renderCuerpo();
  }
}

function mapearItemReaccion(fila) {
  const pub = fila.publicaciones ?? {};
  const perfil = pub.perfiles ?? {};

  const medios = [...(pub.publicacion_medios ?? [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const primerMedio = medios[0] ?? null;
  const thumbUrl = primerMedio ? resolverUrlMedio(primerMedio) : null;
  const esVideo = primerMedio?.tipo_medio === 'video';

  const postData = { ...pub, id: fila.publicacion_id, publicacion_medios: medios };
  const emoji = tipoReaccionDesdeString(fila.tipo) ?? EMOJI_REACCION_RAPIDA;

  return {
    id: fila.id,
    emoji,
    creadoEn: fila.creado_en ? new Date(fila.creado_en) : new Date(),
    publicacionId: fila.publicacion_id,
    publicacionContenido: pub.contenido ?? null,
    autorNombre: perfil.nombre ?? null,
    autorFotoUrl: resolverUrlPerfil(perfil) || null,
    thumbUrl: thumbUrl || null,
    thumbEsVideo: esVideo,
    postData,
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

// Refetch fresco: el join de "reacciones" trae los datos de la
// publicación tal como estaban cuando se reaccionó, y pueden estar
// desactualizados (likes/comentarios nuevos, medios editados, etc).
// yo_di_like se manda en false como valor provisional — la propia
// tarjeta-publicacion.js/controlador de ver-publicacion.js resuelve
// el estado real de "me gusta" al activarse.
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
    console.error('historial-reacciones – abrirPublicacion:', error);
    mostrarToast('No se pudo abrir la publicación.', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════

function renderCuerpo() {
  const cuerpo = contenedorActual?.querySelector('#hr-cuerpo');
  if (!cuerpo) return;

  if (cargando) {
    cuerpo.innerHTML = `<div class="historial-reacciones__spinner"><span class="btn-spinner"></span></div>`;
    return;
  }

  if (items.length === 0) {
    cuerpo.innerHTML = renderEstadoVacio('🤍', 'No has reaccionado a ninguna publicación aún.');
    return;
  }

  const grupos = agruparPorFecha(items);
  cuerpo.innerHTML = grupos
    .map(
      ([titulo, lista]) => `
        <p class="historial-reacciones__seccion">${titulo}</p>
        <div class="historial-reacciones__grupo">
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
  const miniatura = item.thumbUrl
    ? item.thumbEsVideo
      ? `<div class="historial-reacciones__thumb" data-video-thumb data-url="${item.thumbUrl}"></div>`
      : `<img class="historial-reacciones__thumb" src="${item.thumbUrl}" alt="" onerror="this.outerHTML='<div class=&quot;historial-reacciones__thumb historial-reacciones__thumb--vacio&quot;>📝</div>'" />`
    : `<div class="historial-reacciones__thumb historial-reacciones__thumb--vacio">📝</div>`;

  return `
    <div class="historial-reacciones__tile" data-item-id="${item.id}">
      <div class="historial-reacciones__avatar">${avatar}</div>
      <div class="historial-reacciones__textos">
        <p class="historial-reacciones__encabezado">
          <strong>${item.emoji}&nbsp;&nbsp;Reaccionaste a una publicación</strong>${item.autorNombre ? ` de ${item.autorNombre}` : ''}
        </p>
        ${item.publicacionContenido ? `<p class="historial-reacciones__extracto">${escaparHtml(item.publicacionContenido)}</p>` : ''}
        <p class="historial-reacciones__tiempo">${tiempoRelativo(item.creadoEn)}</p>
      </div>
      ${miniatura}
    </div>
  `;
}

function renderEstadoVacio(icono, mensaje) {
  return `
    <div class="historial-reacciones__vacio">
      <span class="historial-reacciones__vacio-icono">${icono}</span>
      <p class="historial-reacciones__vacio-titulo">Sin actividad</p>
      <p class="historial-reacciones__vacio-mensaje">${mensaje}</p>
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
      celda.innerHTML = `<img src="${dataUrl}" alt="" /><span class="historial-reacciones__thumb-play">▶️</span>`;
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

    const limpiar = () => resolve(null);
    video.addEventListener('error', limpiar);

    video.addEventListener('loadeddata', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = Math.round((120 * video.videoHeight) / video.videoWidth) || 120;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      } catch (error) {
        console.error('historial-reacciones – capturar frame:', error);
        resolve(null);
      }
    });
  });
}