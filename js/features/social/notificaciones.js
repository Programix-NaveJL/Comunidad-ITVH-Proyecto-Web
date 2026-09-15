// Pantalla de notificaciones, accesible desde el ícono de campana en
// el encabezado del feed social ("Comunidad").
//
// Responsabilidades:
//   1. Lista de notificaciones del usuario (sin las de tipo
//      'mensaje' — esas viven en JaguarChat con su propio badge),
//      agrupadas por fecha ("Hoy", "Ayer", "Sábado 20 julio").
//   2. Barra de filtros por categoría (Todas / Reacciones /
//      Comentarios / Menciones / Seguimientos), 100% en cliente
//      sobre la lista ya cargada — no dispara ninguna query nueva.
//   3. Al tocar una notificación: la marca como leída y navega a la
//      publicación/historia/perfil correspondiente.
//   4. Auto-marcado de leídas al SALIR de la pantalla (no al
//      entrar), para que el usuario alcance a ver el punto azul /
//      contador de "sin leer" mientras está parado aquí.
//
// Nota de implementación: este router (js/core/router.js) no expone
// un hook explícito de "salida de pantalla" (no hay equivalente a
// dispose() de Flutter), así que el auto-marcado al salir se dispara
// escuchando el primer 'hashchange' hacia fuera de '/notificaciones'.
// Si en el futuro el router agrega un mecanismo de limpieza nativo,
// esto se puede simplificar.
//
// Miniaturas de video: sin el paquete video_thumbnail de Flutter, se
// genera un frame real dibujando un <video preload="metadata"> sobre
// un <canvas> oculto (ver generarMiniaturaVideo). Si el navegador
// bloquea el canvas por CORS (el bucket de medios no manda los
// headers adecuados), se cae al ícono de "reproducir" genérico, igual
// que el estado de error del código Flutter original.
//
// NAVEGACIÓN A LA PUBLICACIÓN: para like/comentario/respuesta/
// like_comentario/mencion/etiqueta se refetchea la publicación
// completa y se abre con abrirPublicacion() de ver-publicacion.js,
// que deja el post listo en memoria antes de navegar a '/publicacion'
// (el router de hash no puede cargar un objeto completo desde la
// URL). Historia/perfil/marketplace siguen pendientes de sus propios
// módulos.
//
// NAVEGACIÓN A LA HISTORIA: like_historia/comentario_historia YA
// RESUELTO. No existe (ni tiene sentido crear) una ruta '/historia/:id'
// — ver-historia.js trabaja con grupos completos en memoria
// (abrirVerHistorias({grupos, indiceInicial})), no con navegación por
// URL a una sola historia. El destinatario de estas notificaciones es
// siempre el AUTOR de la historia (alguien reaccionó/comentó en LA
// TUYA), así que abrirHistoriaDeNotificacion() carga tus propias
// historias activas (últimas 24h, mismo query que cargarMisHistorias
// en mi-perfil-screen.js), ubica el índice de la historia tocada y
// llama a abrirVerHistorias con ese grupo — si la historia ya expiró
// (pasaron las 24h), se avisa con un toast en vez de fallar en
// silencio.

import { supabaseClient } from '../../core/supabase-client.js';
import { registrarRuta, navegarA } from '../../core/router.js';
import { mostrarToast } from '../../core/toast.js';
import { resolverUrlMedio, resolverUrlHistoria, resolverUrlPerfil } from '../../core/perfil-utils.js';
import { abrirPublicacion as abrirVerPublicacion } from './publicaciones/ver-publicacion.js';
import { abrirVerHistorias } from './historias/ver-historias/ver-historia.js';

registrarRuta('/notificaciones', render);

const ACCENT = '#007AFF';

const CATEGORIAS = [
  { id: 'todas', etiqueta: 'Todas' },
  { id: 'reacciones', etiqueta: 'Reacciones' },
  { id: 'comentarios', etiqueta: 'Comentarios' },
  { id: 'menciones', etiqueta: 'Menciones' },
  { id: 'seguimientos', etiqueta: 'Seguimientos' },
];

const TIPOS_POR_CATEGORIA = {
  reacciones: ['like', 'like_comentario', 'like_historia'],
  comentarios: ['comentario', 'respuesta', 'comentario_historia'],
  menciones: ['mencion', 'etiqueta'],
  seguimientos: ['seguidor'],
};

// Tipos de notificación cuyo tap debe abrir el detalle de una
// publicación (vía ver-publicacion.js).
const TIPOS_DE_PUBLICACION = ['like', 'comentario', 'respuesta', 'like_comentario', 'mencion', 'etiqueta'];

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// Estado del módulo. Se reinicia en cada render().
let uidActual = null;
let notificaciones = [];
let cargando = true;
let marcandoTodas = false;
let filtroActivo = 'todas';
let canal = null;
let listenerSalida = null;

async function render(contenedor) {
  uidActual = null;
  notificaciones = [];
  cargando = true;
  marcandoTodas = false;
  filtroActivo = 'todas';

  contenedor.innerHTML = plantillaBase();
  activarInteracciones(contenedor);
  renderLista(contenedor);

  registrarSalida();

  const { data } = await supabaseClient.auth.getUser();
  uidActual = data?.user?.id ?? null;
  if (!uidActual) {
    cargando = false;
    renderLista(contenedor);
    return;
  }

  await cargar(contenedor);
  suscribirRealtime(contenedor);
}

function plantillaBase() {
  return `
    <div class="notif">
      <header class="notif-header">
        <button class="notif-volver" id="notif-volver" aria-label="Regresar">‹</button>
        <h1>Notificaciones</h1>
        <button class="notif-leer-todo" id="notif-leer-todo" hidden>Leer todo</button>
      </header>
      <div class="notif-filtros" id="notif-filtros"></div>
      <div class="notif-lista" id="notif-lista"></div>
    </div>
  `;
}

// ── Carga y realtime ──────────────────────────────────────────────

async function cargar(contenedor) {
  try {
    const { data, error } = await supabaseClient
  .from('notificaciones')
  .select(
    'id, tipo, leida, creado_en, contenido, ' +
      'origen_id, publicacion_id, historia_id, ' +
      'perfiles!notificaciones_origen_id_fkey(nombre, nombre_usuario, cdn_foto_perfil), ' +
      'publicaciones!notificaciones_publicacion_id_fkey(publicacion_medios(url, cdn_url, orden)), ' +
      'historias!notificaciones_historia_id_fkey(media_url, cdn_url)'
  )
  .eq('destinatario_id', uidActual)
  .neq('tipo', 'mensaje')
  .order('creado_en', { ascending: false })
  .limit(100);
    if (error) throw error;

    notificaciones = (data ?? []).map(normalizarNotificacion);
  } catch (error) {
    console.error('notificaciones – cargar:', error);
  } finally {
    cargando = false;
    renderLista(contenedor);
  }
}

function normalizarNotificacion(fila) {
  const perfil = fila.perfiles ?? {};
  const pub = fila.publicaciones ?? null;
  const historia = fila.historias ?? null;

  let thumbUrl = null;
  if (pub?.publicacion_medios?.length) {
    const medios = [...pub.publicacion_medios].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    thumbUrl = resolverUrlMedio(medios[0]) || null;
  }
  if (!thumbUrl && historia) {
    thumbUrl = resolverUrlHistoria(historia) || null;
  }

  return {
    id: fila.id,
    tipo: fila.tipo,
    leida: Boolean(fila.leida),
    // Igual que el fix v8 del Dart original: se guarda como objeto
    // Date de JS, que ya interpreta el sufijo 'Z' de Supabase (UTC)
    // y expone año/mes/día en hora local del navegador al usarlo.
    creadoEn: fila.creado_en ? new Date(fila.creado_en) : new Date(),
    origenId: fila.origen_id ?? null,
    remitenteNombre: perfil.nombre ?? null,
    remitenteUsuario: perfil.nombre_usuario ?? null,
    remitenteFotoUrl: perfil.nombre ? resolverUrlPerfil(perfil) : '',
    publicacionId: fila.publicacion_id ?? null,
    historiaId: fila.historia_id ?? null,
    contenido: fila.contenido ?? null,
    thumbUrl,
  };
}

function suscribirRealtime(contenedor) {
  if (!uidActual) return;
  canal = supabaseClient
    .channel(`notificaciones-${uidActual}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `destinatario_id=eq.${uidActual}` },
      () => cargar(contenedor)
    )
    .subscribe();
}

// Marca el primer 'hashchange' que saca al usuario de esta pantalla
// como el momento de auto-marcar todo como leído (ver nota de
// implementación al inicio del archivo).
function registrarSalida() {
  if (listenerSalida) window.removeEventListener('hashchange', listenerSalida);

  listenerSalida = () => {
    if (!location.hash.startsWith('#/notificaciones')) {
      marcarTodasLeidasSilencioso();
      canal?.unsubscribe();
      window.removeEventListener('hashchange', listenerSalida);
      listenerSalida = null;
    }
  };
  window.addEventListener('hashchange', listenerSalida);
}

// ── Marcar leídas ──────────────────────────────────────────────

async function marcarLeida(contenedor, id) {
  try {
    const { error } = await supabaseClient.from('notificaciones').update({ leida: true }).eq('id', id);
    if (error) throw error;
    const n = notificaciones.find((x) => x.id === id);
    if (n) n.leida = true;
    renderLista(contenedor);
  } catch (error) {
    console.error('notificaciones – marcarLeida:', error);
  }
}

// Usado por el botón "Leer todo": acción global sin importar la
// pestaña activa, con setState (actualiza la UI de inmediato).
async function marcarTodasLeidas(contenedor) {
  if (!uidActual || marcandoTodas) return;
  if (!notificaciones.some((n) => !n.leida)) return;

  marcandoTodas = true;
  renderHeader(contenedor);

  try {
    const { error } = await supabaseClient
      .from('notificaciones')
      .update({ leida: true })
      .eq('destinatario_id', uidActual)
      .eq('leida', false);
    if (error) throw error;
    notificaciones.forEach((n) => (n.leida = true));
    renderLista(contenedor);
  } catch (error) {
    console.error('notificaciones – marcarTodas:', error);
  } finally {
    marcandoTodas = false;
    renderHeader(contenedor);
  }
}

// Usado al salir de la pantalla (ver registrarSalida): sin tocar el
// DOM, solo dispara el UPDATE en Supabase.
async function marcarTodasLeidasSilencioso() {
  if (!uidActual) return;
  if (!notificaciones.some((n) => !n.leida)) return;
  try {
    await supabaseClient
      .from('notificaciones')
      .update({ leida: true })
      .eq('destinatario_id', uidActual)
      .eq('leida', false);
  } catch (error) {
    console.error('notificaciones – marcarTodas al salir:', error);
  }
}

// ── Navegación al tocar una notificación ──────────────────────────

// Refetch fresco de la publicación: el join que trae la lista de
// notificaciones solo carga publicacion_medios (para la miniatura),
// no la publicación completa que necesita ver-publicacion.js.
// yo_di_like se manda en false como valor provisional — la propia
// tarjeta-publicacion.js/controlador de ver-publicacion.js resuelve
// el estado real de "me gusta" al activarse.
async function abrirPublicacionDeNotificacion(publicacionId) {
  try {
    const { data, error } = await supabaseClient
      .from('publicaciones')
      .select(
        `id, contenido, tipo, creado_en, total_reacciones,
        total_comentarios, autor_id,
        perfiles!publicaciones_autor_id_fkey(nombre, nombre_usuario, cdn_foto_perfil),
        publicacion_medios(url, cdn_url, tipo_medio, orden)`
      )
      .eq('id', publicacionId)
      .maybeSingle();
    if (error || !data) {
      mostrarToast('No se pudo abrir la publicación.', 'error');
      return;
    }

    const medios = [...(data.publicacion_medios ?? [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    abrirVerPublicacion({ ...data, publicacion_medios: medios, yo_di_like: false });
  } catch (error) {
    console.error('notificaciones – abrirPublicacionDeNotificacion:', error);
    mostrarToast('No se pudo abrir la publicación.', 'error');
  }
}

// El destinatario de like_historia/comentario_historia es siempre el
// AUTOR de la historia (uidActual) — no hace falta origenId para
// esto. Se cargan sus historias activas (últimas 24h, mismo criterio
// que cargarMisHistorias en mi-perfil-screen.js), se ubica el índice
// de la historia tocada dentro de ese arreglo y se abre el visor
// real ahí mismo. Si la historia ya expiró, se avisa en vez de
// fallar en silencio (mismo criterio que el estado de error de
// ver-destacada.js).
async function abrirHistoriaDeNotificacion(historiaId) {
  if (!uidActual) return;
  try {
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseClient
      .from('historias')
      .select(`
        id, media_url, cdn_url, tipo, creado_en, autor_id, vistas,
        preview_url, track_titulo, track_artista, track_cover, track_inicio_ms
      `)
      .eq('autor_id', uidActual)
      .gte('creado_en', hace24h)
      .order('creado_en', { ascending: true });
    if (error) throw error;

    const historias = data ?? [];
    const indice = historias.findIndex((h) => h.id === historiaId);
    if (indice === -1) {
      mostrarToast('Esta historia ya no está disponible.', 'error');
      return;
    }

    const { data: perfil } = await supabaseClient
      .from('perfiles')
      .select('nombre, cdn_foto_perfil')
      .eq('id', uidActual)
      .single();

    const grupo = {
      autor_id: uidActual,
      nombre: perfil?.nombre ?? '',
      foto: resolverUrlPerfil(perfil ?? {}),
      esTuyo: true,
      stories: historias,
    };
    abrirVerHistorias({ grupos: [grupo], indiceInicial: indice, onIrAMiPerfil: () => {} });
  } catch (error) {
    console.error('notificaciones – abrirHistoriaDeNotificacion:', error);
    mostrarToast('No se pudo abrir la historia.', 'error');
  }
}

async function onTap(contenedor, n) {
  if (!n.leida) await marcarLeida(contenedor, n.id);

  switch (n.tipo) {
    case 'seguidor':
      if (n.origenId) navegarA(`/perfil-publico/${n.origenId}`);
      break;
    case 'like':
    case 'comentario':
    case 'respuesta':
    case 'like_comentario':
    case 'mencion':
    case 'etiqueta':
      if (n.publicacionId) abrirPublicacionDeNotificacion(n.publicacionId);
      break;
    case 'like_historia':
    case 'comentario_historia':
      if (n.historiaId) abrirHistoriaDeNotificacion(n.historiaId);
      break;
    case 'verificado_emprendedor':
      navegarA('/marketplace-publicar'); // TODO: pendiente módulo Marketplace
      break;
    default:
      break;
  }
}

function onPerfilTap(n) {
  if (!n.origenId) return;
  navegarA(`/perfil-publico/${n.origenId}`);
}

// ── Texto, ícono y tiempo ──────────────────────────────────────

function coincideCategoria(n, filtro) {
  if (filtro === 'todas') return true;
  return (TIPOS_POR_CATEGORIA[filtro] ?? []).includes(n.tipo);
}

function texto(n) {
  const nombre = (n.remitenteNombre ?? '').split(' ')[0] || 'Alguien';
  switch (n.tipo) {
    case 'like': return `${nombre} reaccionó a tu publicación.`;
    case 'comentario': return `${nombre} comentó en tu publicación.`;
    case 'respuesta': return `${nombre} respondió a tu comentario.`;
    case 'seguidor': return `${nombre} comenzó a seguirte.`;
    case 'like_comentario': return `${nombre} reaccionó a tu comentario.`;
    case 'like_historia': return `${nombre} reaccionó a tu historia.`;
    case 'comentario_historia': return `${nombre} comentó en tu historia.`;
    case 'verificado_emprendedor': return '¡Felicidades! Ya eres Emprendedor Verificado. Ya puedes publicar en el Marketplace.';
    case 'mencion': return `${nombre} te mencionó en un comentario.`;
    case 'etiqueta': {
      const acompanantes = parseInt(n.contenido ?? '0', 10) || 0;
      if (acompanantes <= 0) return `${nombre} te etiquetó en una publicación.`;
      const sufijo = acompanantes === 1 ? '1 persona más' : `${acompanantes} personas más`;
      return `${nombre} te etiquetó a ti y ${sufijo}.`;
    }
    default: return 'Tienes una nueva notificación.';
  }
}

function iconoInfo(tipo) {
  switch (tipo) {
    case 'like':
    case 'like_comentario':
    case 'like_historia':
      return { icono: '❤️', color: '#FF453A' };
    case 'comentario':
    case 'respuesta':
    case 'comentario_historia':
      return { icono: '💬', color: '#0A84FF' };
    case 'seguidor':
      return { icono: '➕', color: '#30D158' };
    case 'verificado_emprendedor':
      return { icono: '🏪', color: '#FFD60A' };
    case 'mencion':
      return { icono: '@', color: '#0A84FF' };
    case 'etiqueta':
      return { icono: '🏷️', color: '#FF9500' };
    default:
      return { icono: '🔔', color: '#636366' };
  }
}

function tiempoDesde(fecha) {
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

function etiquetaDia(fecha) {
  const ahora = new Date();
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const dia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const diffDias = Math.round((hoy - dia) / 86400000);

  if (diffDias === 0) return 'Hoy';
  if (diffDias === 1) return 'Ayer';

  const nombreDia = DIAS_SEMANA[(fecha.getDay() + 6) % 7]; // getDay(): 0=domingo
  const nombreMes = MESES[fecha.getMonth()];
  return `${nombreDia} ${fecha.getDate()} ${nombreMes}`;
}

function agruparPorFecha(lista) {
  const grupos = new Map();
  for (const n of lista) {
    const etiqueta = etiquetaDia(n.creadoEn);
    if (!grupos.has(etiqueta)) grupos.set(etiqueta, []);
    grupos.get(etiqueta).push(n);
  }
  return grupos;
}

// ── Render ──────────────────────────────────────────────────────

function renderHeader(contenedor) {
  const noLeidas = notificaciones.filter((n) => !n.leida).length;
  const boton = contenedor.querySelector('#notif-leer-todo');
  if (!boton) return;
  boton.hidden = noLeidas === 0;
  boton.disabled = marcandoTodas;
  boton.innerHTML = marcandoTodas ? '<span class="btn-spinner" style="width:14px;height:14px;border-width:2px;"></span>' : 'Leer todo';
}

function renderFiltros(contenedor) {
  const zona = contenedor.querySelector('#notif-filtros');
  if (!zona) return;
  zona.innerHTML = CATEGORIAS.map(
    (c) => `<button class="notif-filtro${c.id === filtroActivo ? ' activo' : ''}" data-filtro="${c.id}">${c.etiqueta}</button>`
  ).join('');
}

function renderLista(contenedor) {
  renderHeader(contenedor);
  renderFiltros(contenedor);

  const zona = contenedor.querySelector('#notif-lista');
  if (!zona) return;

  if (cargando) {
    zona.innerHTML = `<div class="notif-spinner-zona"><span class="btn-spinner"></span></div>`;
    return;
  }

  const filtradas = notificaciones.filter((n) => coincideCategoria(n, filtroActivo));

  if (filtradas.length === 0) {
    zona.innerHTML = plantillaEstadoVacio(filtroActivo);
    return;
  }

  const noLeidas = notificaciones.filter((n) => !n.leida).length;
  const grupos = agruparPorFecha(filtradas);

  let html = '';
  if (noLeidas > 0) {
    html += `<p class="notif-contador">${noLeidas} sin leer</p>`;
  }
  for (const [etiqueta, items] of grupos) {
    html += `<p class="notif-encabezado-dia">${etiqueta}</p>`;
    html += `<div class="notif-grupo">${items.map(plantillaItem).join('')}</div>`;
  }
  zona.innerHTML = html;

  // Genera en segundo plano las miniaturas de video reales (ver
  // generarMiniaturaVideo) para las notificaciones que las necesiten.
  zona.querySelectorAll('[data-video-thumb]').forEach((el) => {
    generarMiniaturaVideo(el.dataset.videoThumb).then((dataUrl) => {
      if (!dataUrl) return;
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = '';
      el.innerHTML = '';
      el.appendChild(img);
    });
  });
}

function plantillaEstadoVacio(filtro) {
  const textos = {
    todas: ['Sin notificaciones', 'Cuando alguien interactúe contigo, verás las notificaciones aquí.'],
    reacciones: ['Sin reacciones', 'Aquí verás cuando alguien reaccione a tus publicaciones, comentarios o historias.'],
    comentarios: ['Sin comentarios', 'Aquí verás los comentarios y respuestas en tus publicaciones e historias.'],
    menciones: ['Sin menciones', 'Aquí verás cuando alguien te mencione o te etiquete en una publicación.'],
    seguimientos: ['Sin seguidores nuevos', 'Aquí verás cuando alguien nuevo comience a seguirte.'],
  };
  const [titulo, subtitulo] = textos[filtro] ?? textos.todas;
  return `
    <div class="notif-vacio">
      <span class="notif-vacio__icono">🔔</span>
      <p class="notif-vacio__titulo">${titulo}</p>
      <p class="notif-vacio__subtitulo">${subtitulo}</p>
    </div>
  `;
}

function plantillaItem(n) {
  const { icono, color } = iconoInfo(n.tipo);
  const tieneRemitente = Boolean(n.remitenteNombre);
  const tieneMedia = Boolean(n.thumbUrl);
  const esDePublicacion = Boolean(n.publicacionId) && !n.historiaId;
  const mostrarPlaceholderTexto = !tieneMedia && esDePublicacion;
  const mostrarThumb = tieneMedia || mostrarPlaceholderTexto;
  const esVideo = tieneMedia && n.thumbUrl.toLowerCase().includes('.mp4');

  let miniaturaHtml = '';
  if (mostrarThumb) {
    if (!tieneMedia) {
      miniaturaHtml = `<div class="notif-thumb notif-thumb--placeholder">📄</div>`;
    } else if (esVideo) {
      miniaturaHtml = `<div class="notif-thumb" data-video-thumb="${n.thumbUrl}">▶️</div>`;
    } else {
      miniaturaHtml = `<div class="notif-thumb"><img src="${n.thumbUrl}" alt="" loading="lazy" /></div>`;
    }
  }

  const textoHtml = tieneRemitente
    ? `<span class="notif-item__remitente">${n.remitenteNombre}</span>${escaparHtml(texto(n).replace((n.remitenteNombre.split(' ')[0]), ''))}`
    : texto(n);

  return `
    <div class="notif-item${n.leida ? '' : ' no-leida'}" data-id="${n.id}">
      <div class="notif-item__avatar" data-perfil="${n.origenId ?? ''}">
        ${n.remitenteFotoUrl ? `<img src="${n.remitenteFotoUrl}" alt="" />` : `<span>${tieneRemitente ? '👤' : icono}</span>`}
        <span class="notif-item__badge" style="background:${color}">${icono}</span>
      </div>
      <div class="notif-item__cuerpo">
        <p class="notif-item__texto" data-perfil="${n.origenId ?? ''}">${textoHtml}</p>
        <p class="notif-item__tiempo">${tiempoDesde(n.creadoEn)}</p>
      </div>
      ${n.leida ? '' : '<span class="notif-item__punto"></span>'}
      ${miniaturaHtml}
    </div>
  `;
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ── Miniatura de video real vía <video> + <canvas> ────────────────
//
// Sin video_thumbnail (paquete nativo de Flutter): se carga el video
// oculto, se espera el primer frame decodificado y se dibuja sobre
// un canvas para extraer un JPEG en memoria. Si el bucket no manda
// headers CORS permisivos, drawImage/toDataURL lanzan un error de
// "canvas tainted" — se resuelve null y el ítem se queda con el
// ícono de "reproducir" genérico (mismo fallback que _error en Dart).
function generarMiniaturaVideo(url) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = url;
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const limpiar = () => video.remove();

    video.addEventListener('loadeddata', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 92;
        canvas.height = Math.round(92 * ((video.videoHeight || 1) / (video.videoWidth || 1)));
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      } catch (error) {
        resolve(null);
      } finally {
        limpiar();
      }
    });
    video.addEventListener('error', () => {
      resolve(null);
      limpiar();
    });

    video.load();
  });
}

// ── Interacciones ──────────────────────────────────────────────

function activarInteracciones(contenedor) {
  contenedor.querySelector('#notif-volver').addEventListener('click', () => window.history.back());
  contenedor.querySelector('#notif-leer-todo').addEventListener('click', () => marcarTodasLeidas(contenedor));

  contenedor.querySelector('#notif-filtros').addEventListener('click', (evento) => {
    const btn = evento.target.closest('[data-filtro]');
    if (!btn || btn.dataset.filtro === filtroActivo) return;
    filtroActivo = btn.dataset.filtro;
    renderLista(contenedor);
  });

  contenedor.querySelector('#notif-lista').addEventListener('click', (evento) => {
    const perfilEl = evento.target.closest('[data-perfil]');
    if (perfilEl && perfilEl.dataset.perfil) {
      const n = notificaciones.find((x) => String(x.id) === evento.target.closest('[data-id]')?.dataset.id);
      if (n) onPerfilTap(n);
      return;
    }
    const item = evento.target.closest('[data-id]');
    if (item) {
      const n = notificaciones.find((x) => String(x.id) === item.dataset.id);
      if (n) onTap(contenedor, n);
    }
  });
}