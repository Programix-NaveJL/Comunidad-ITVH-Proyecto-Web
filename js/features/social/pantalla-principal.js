// Pantalla principal del feed social ("Comunidad Tecnológica"),
// contenido real de la pestaña "Comunidad" del shell.
//
// A diferencia de los módulos del Drawer, esta pantalla NO se
// autoregistra en el router: no vive en una ruta propia, sino que
// shell.js la monta directamente dentro del panel de la pestaña
// "comunidad" (ver montarPanel() en shell.js). Por eso exporta
// render(panel) en vez de llamar a registrarRuta().
//
// Responsabilidades:
//   1. Encabezado con el título y accesos a búsqueda de usuarios
//      (/buscador-usuarios) y notificaciones (/notificaciones, con
//      badge de no leídas — excluye tipo 'mensaje', ese contador
//      vive en JaguarChat).
//   2. Composer ("¿Qué está pasando en el plantel?") + carrusel de
//      historias, agrupadas por autor con silenciados al final.
//   3. Feed de publicaciones paginado por cursor (creado_en) con
//      scroll infinito, caché local (localStorage) para pintar de
//      inmediato al reabrir, y suscripción realtime a cambios de
//      total_reacciones/total_comentarios.
//
// Cada publicación se pinta con la tarjeta real de
// publicaciones/tarjeta-publicaciones/tarjeta-publicacion.js
// (galería, reacciones por emoji, comentarios, etiquetados, menú de
// opciones) — ya no con un stand-in.
//
// FIX DE RENDIMIENTO APLICADO: renderPosts() ya NO reconstruye el
// HTML completo de la lista en cada llamada. Antes, cada vez que se
// cargaba una página nueva por scroll infinito, se volvían a montar
// TODAS las tarjetas ya visibles además de las nuevas — y como cada
// tarjeta dispara sus propios fetches de reacciones/comentarios/
// etiquetados al montarse (ver tarjeta-publicacion.js → init()), el
// número de requests crecía cuadráticamente con cada scroll, hasta
// generar miles de peticiones y tumbar la pestaña con
// ERR_INSUFFICIENT_RESOURCES. Ahora se lleva un registro
// (idsRenderizados) de qué posts ya están montados y activados, y
// solo se insertan/activan los posts nuevos que aún no estaban en el
// DOM. Un refresh completo (pull-to-refresh, reabrir la pestaña)
// limpia ese registro y vuelve a montar todo desde cero, como antes.
//
// ASUNCIONES marcadas explícitamente (avisar si alguna no aplica):
//   - Scroll infinito: se asume que el panel recibido (la propia
//     <section class="shell-panel">) es el contenedor que scrollea
//     (overflow-y:auto), y se le engancha el listener de scroll
//     directamente a él. Si en shell.css el que scrollea es
//     .shell-contenido o la ventana completa, hay que mover el
//     listener de panel.addEventListener('scroll', ...) al elemento
//     correcto.
//   - Navegación a pantallas que aún no existen (crear historia, ver
//     historia): se deja un mostrarToast() de "en construcción" en
//     vez de romper con una ruta 404, con un TODO señalando dónde
//     conectar la navegación real.
//   - "Mantener presionado" sobre una historia ajena (long-press en
//     Flutter) se simula con un temporizador de ~500ms sobre
//     mousedown/touchstart, ya que el navegador no tiene un evento
//     nativo equivalente.
//
// FIX APLICADO: gruposParaVisorPropio() ahora filtra por las
// últimas 24h (igual que hace la RPC get_feed_stories para las
// historias ajenas) — antes traía TODAS las historias que el
// usuario hubiera subido desde que existe su cuenta.

import { supabaseClient } from '../../core/supabase-client.js';
import { navegarA } from '../../core/router.js';
import { mostrarToast } from '../../core/toast.js';
import { obtenerTema } from '../../core/theme.js';
import { renderTarjetaPublicacion, activarTarjetaPublicacion } from './publicaciones/tarjeta-publicaciones/tarjeta-publicacion.js';
import { abrirSeleccionarMedia } from './historias/seleccionar-media.js';
import { abrirVerHistorias } from './historias/ver-historias/ver-historia.js';

const POSTS_PAGE_SIZE = 10;
const CACHE_MAX_POSTS = 20;
const CACHE_KEY_PREFIX = 'feed_posts_';
const LONG_PRESS_MS = 500;
const HISTORIAS_VENTANA_MS = 24 * 60 * 60 * 1000;

// Estado del módulo. Se reinicia cada vez que render() se llama
// (primera vez que se muestra la pestaña "Comunidad").
let uidActual = null;
let posts = [];
let stories = [];
let loadingPosts = true;
let loadingStories = true;
let cargandoMas = false;
let hayMasPosts = true;
let cursorPosts = null;
let miNombre = null;
let miFoto = null;
let yoTengoStory = false;
let yoViMisHistorias = false;
let notificacionesNoLeidas = 0;
let historiasVistas = new Set();
let autoresSilenciados = new Set();
let seguidosCache = null;
let postsChannel = null;
let panelActual = null;

// Ids de posts que ya fueron insertados y activados en el DOM —
// evita que renderPosts() vuelva a montar/activar tarjetas que no
// cambiaron (ver FIX DE RENDIMIENTO arriba).
let idsRenderizados = new Set();

export async function render(panel) {
  panelActual = panel;
  uidActual = null;
  posts = [];
  stories = [];
  loadingPosts = true;
  loadingStories = true;
  cargandoMas = false;
  hayMasPosts = true;
  cursorPosts = null;
  miNombre = null;
  miFoto = null;
  yoTengoStory = false;
  yoViMisHistorias = false;
  notificacionesNoLeidas = 0;
  historiasVistas = new Set();
  autoresSilenciados = new Set();
  seguidosCache = null;
  idsRenderizados = new Set();
  postsChannel?.unsubscribe();
  postsChannel = null;

  panel.innerHTML = plantillaBase();
  activarInteracciones(panel);
  window.removeEventListener('scroll', onScroll);
  window.addEventListener('scroll', onScroll);

  const { data } = await supabaseClient.auth.getUser();
  uidActual = data?.user?.id ?? null;
  if (!uidActual) return;

  await cargarTodo({ refresh: true });
  suscribirRealtime();
}

function plantillaBase() {
  return `
    <div class="feed">
      <header class="feed-appbar">
        <div class="feed-appbar__titulo">
          <span class="feed-appbar__t1">Comunidad</span>
          <span class="feed-appbar__t2">Tecnológica</span>
        </div>
        <div class="feed-appbar__acciones">
          <button class="feed-appbar__btn" id="feed-buscar" aria-label="Buscar usuarios">🔍</button>
          <button class="feed-appbar__btn feed-appbar__btn--notif" id="feed-notif" aria-label="Notificaciones">
            🔔
            <span class="feed-appbar__badge" id="feed-notif-badge" hidden>0</span>
          </button>
        </div>
      </header>

      <div class="feed-superior">
        <div class="feed-composer" id="feed-composer">
          <div class="feed-composer__avatar" id="feed-mi-avatar-composer"><span>👤</span></div>
          <div class="feed-composer__input" id="feed-composer-input">¿Qué está pasando en el plantel?</div>
          <button class="feed-composer__imagen" id="feed-composer-imagen" aria-label="Adjuntar imagen">🖼️</button>
        </div>
        <div class="feed-historias" id="feed-historias"></div>
      </div>

      <div class="feed-divisor"></div>

      <div class="feed-posts" id="feed-posts"></div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// CARGA COMPLETA (perfil + notif + historias + posts en paralelo)
// ═══════════════════════════════════════════════════════════════

async function cargarTodo({ refresh = false } = {}) {
  if (refresh) {
    cursorPosts = null;
    hayMasPosts = true;
  }

  await Promise.all([cargarMiPerfil(), cargarNotificaciones()]);
  await Promise.all([cargarStories(), cargarPosts({ refresh })]);
}

async function cargarNotificaciones() {
  if (!uidActual) return;
  try {
    const { data, error } = await supabaseClient
      .from('notificaciones')
      .select('id')
      .eq('destinatario_id', uidActual)
      .eq('leida', false)
      .neq('tipo', 'mensaje');
    if (error) throw error;
    notificacionesNoLeidas = (data ?? []).length;
    renderBadgeNotif();
  } catch (error) {
    console.error('pantalla-principal – notif:', error);
  }
}

async function cargarMiPerfil() {
  if (!uidActual) return;
  try {
    const { data, error } = await supabaseClient
      .from('perfiles')
      .select('nombre, cdn_foto_perfil')
      .eq('id', uidActual)
      .maybeSingle();
    if (error) throw error;
    miNombre = data?.nombre ?? null;
    miFoto = data?.cdn_foto_perfil ?? null;
    renderAvatarComposer();
  } catch (error) {
    console.error('pantalla-principal – perfil:', error);
  }
}

// ═══════════════════════════════════════════════════════════════
// HISTORIAS
// ═══════════════════════════════════════════════════════════════

async function cargarStories() {
  if (!uidActual) return;
  try {
    const { data, error } = await supabaseClient.rpc('get_feed_stories', { p_uid: uidActual });
    if (error) throw error;

    const historias = data?.historias ?? [];
    const silenciados = new Set(data?.silenciados ?? []);
    const vistasIds = new Set(data?.vistas ?? []);

    const porAutor = new Map();
    let yoTengo = false;
    const misIds = [];

    for (const h of historias) {
      const aid = h.autor_id;
      if (aid === uidActual) {
        yoTengo = true;
        misIds.push(h.id);
        continue;
      }
      if (!porAutor.has(aid)) {
        porAutor.set(aid, {
          autor_id: aid,
          esTuyo: false,
          nombre: h.perfiles?.nombre ?? '',
          usuario: h.perfiles?.nombre_usuario ?? '',
          foto: h.perfiles?.cdn_foto_perfil ?? null,
          stories: [],
        });
      }
      porAutor.get(aid).stories.push(h);
    }

    for (const grupo of porAutor.values()) {
      const ids = grupo.stories.map((h) => h.id);
      grupo.todasVistas = ids.length > 0 && ids.every((id) => vistasIds.has(id));
    }

    const yoViTodas = misIds.length > 0 && misIds.every((id) => vistasIds.has(id));

    const normales = [];
    const alFinal = [];
    for (const grupo of porAutor.values()) {
      (silenciados.has(grupo.autor_id) ? alFinal : normales).push(grupo);
    }

    stories = [...normales, ...alFinal];
    yoTengoStory = yoTengo;
    yoViMisHistorias = yoViTodas;
    historiasVistas = vistasIds;
    autoresSilenciados = silenciados;
    loadingStories = false;
    renderHistorias();
  } catch (error) {
    console.error('pantalla-principal – stories (RPC):', error);
    loadingStories = false;
    renderHistorias();
  }
}

async function verMisHistorias() {
  const grupos = await gruposParaVisorPropio();
  abrirVerHistorias({ grupos, indiceInicial: 0, onIrAMiPerfil: () => navegarA('/perfil/editar') });
}

// abrirVerHistorias espera un arreglo de "grupos" con la misma forma
// que usa el carrusel (stories[], autor_id, nombre, foto). Para "mis
// historias" se trae la lista real de historias propias directo de
// la tabla `historias` (get_feed_stories no las incluye — esa RPC
// solo devuelve el conteo/estado de "yoTengoStory"/"yoViMisHistorias"
// para las historias del propio usuario, no las filas completas con
// su media/track).
//
// FIX: se agrega .gte('creado_en', hace24h) — antes esta consulta
// no tenía ningún límite de fecha y traía absolutamente todas las
// historias que el usuario hubiera subido alguna vez. La ventana de
// 24h aquí debe coincidir con la misma ventana que usa la RPC
// get_feed_stories para las historias ajenas y con la vigencia real
// de una "historia" (Instagram-style).
async function gruposParaVisorPropio() {
  try {
    const hace24h = new Date(Date.now() - HISTORIAS_VENTANA_MS).toISOString();
    const { data, error } = await supabaseClient
      .from('historias')
      .select('*')
      .eq('autor_id', uidActual)
      .gte('creado_en', hace24h)
      .order('creado_en', { ascending: true });
    if (error) throw error;
    return [{ esTuyo: true, autor_id: uidActual, nombre: miNombre, foto: miFoto, stories: data ?? [] }];
  } catch (error) {
    console.error('pantalla-principal – gruposParaVisorPropio:', error);
    return [{ esTuyo: true, autor_id: uidActual, nombre: miNombre, foto: miFoto, stories: [] }];
  }
}

async function crearHistoria() {
  abrirSeleccionarMedia({ titulo: 'Agregar a historia' });
}

function verHistoriaAjena(grupo) {
  const indice = stories.findIndex((g) => g.autor_id === grupo.autor_id);
  abrirVerHistorias({
    grupos: stories,
    indiceInicial: indice === -1 ? 0 : indice,
    onIrAMiPerfil: () => navegarA('/perfil/editar'),
  });
}

async function silenciarAutor(autorId) {
  autoresSilenciados = new Set([...autoresSilenciados, autorId]);
  const idx = stories.findIndex((g) => g.autor_id === autorId);
  if (idx !== -1) {
    const [grupo] = stories.splice(idx, 1);
    stories.push(grupo);
  }
  renderHistorias();

  try {
    const { error } = await supabaseClient
      .from('historias_silenciadas')
      .upsert({ usuario_id: uidActual, autor_silenciado_id: autorId });
    if (error) throw error;
  } catch (error) {
    console.error('pantalla-principal – silenciar autor:', error);
  }
}

async function reactivarAutor(autorId) {
  autoresSilenciados = new Set([...autoresSilenciados].filter((id) => id !== autorId));
  const normales = stories.filter((g) => !autoresSilenciados.has(g.autor_id));
  const alFinal = stories.filter((g) => autoresSilenciados.has(g.autor_id));
  stories = [...normales, ...alFinal];
  renderHistorias();

  try {
    const { error } = await supabaseClient
      .from('historias_silenciadas')
      .delete()
      .eq('usuario_id', uidActual)
      .eq('autor_silenciado_id', autorId);
    if (error) throw error;
  } catch (error) {
    console.error('pantalla-principal – reactivar autor:', error);
  }
}

function mostrarOpcionesHistoria(grupo) {
  const yaSilenciado = autoresSilenciados.has(grupo.autor_id);
  const overlay = document.createElement('div');
  overlay.className = 'feed-hoja-overlay';
  overlay.innerHTML = `
    <div class="feed-hoja">
      <div class="feed-hoja__manija"></div>
      <button class="feed-hoja__item" data-accion="perfil">
        <span>👤</span> Ver perfil
      </button>
      ${
        yaSilenciado
          ? `<button class="feed-hoja__item" data-accion="reactivar">
               <span>🔊</span> Reactivar historia
               ${grupo.nombre ? `<small>Volverás a ver las historias de ${grupo.nombre}</small>` : ''}
             </button>`
          : `<button class="feed-hoja__item" data-accion="silenciar">
               <span>🔇</span> Silenciar
               ${grupo.nombre ? `<small>No verás las historias de ${grupo.nombre} primero</small>` : ''}
             </button>`
      }
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (evento) => {
    if (evento.target === overlay) { overlay.remove(); return; }
    const accion = evento.target.closest('[data-accion]')?.dataset.accion;
    if (!accion) return;
    overlay.remove();
    if (accion === 'perfil') navegarA(`/perfil-publico/${grupo.autor_id}`); // TODO: pendiente módulo Mi Perfil
    if (accion === 'silenciar') silenciarAutor(grupo.autor_id);
    if (accion === 'reactivar') reactivarAutor(grupo.autor_id);
  });
}

// ═══════════════════════════════════════════════════════════════
// POSTS — paginados con cursor + caché local
// ═══════════════════════════════════════════════════════════════

// NOTA: 'foto_perfil' no existe como columna en la tabla perfiles
// de este proyecto (migrado a R2, solo cdn_foto_perfil vive ahí) —
// pedirla en el join rompe el select completo con error 42703.
const SELECT_POST = `
  id, contenido, tipo, creado_en,
  total_reacciones, total_comentarios, autor_id,
  perfiles!publicaciones_autor_id_fkey(nombre, nombre_usuario, cdn_foto_perfil),
  publicacion_medios(url, cdn_url, tipo_medio, orden)
`;

async function cargarPosts({ refresh = false } = {}) {
  if (!uidActual) { loadingPosts = false; renderPosts(); return; }

  try {
    if (refresh) mostrarCacheLocal();

    let query = supabaseClient.from('publicaciones').select(SELECT_POST);
    if (!refresh && cursorPosts) query = query.lt('creado_en', cursorPosts);

    const { data, error } = await query.order('creado_en', { ascending: false }).limit(POSTS_PAGE_SIZE);
    if (error) throw error;

    const nuevos = data ?? [];
    // La tarjeta real (tarjeta-publicacion.js) resuelve por su cuenta
    // reacciones/comentarios/etiquetados al montarse — ya no hace
    // falta el batch adicional que traía 'yo_di_like'/'etiquetados'
    // solo para el stand-in anterior.
    const nuevoCursor = nuevos.length > 0 ? nuevos[nuevos.length - 1].creado_en : cursorPosts;

    if (refresh) {
      posts = nuevos;
      idsRenderizados = new Set(); // refresh completo → repintar todo desde cero
    } else {
      const idsExistentes = new Set(posts.map((p) => p.id));
      posts = [...posts, ...nuevos.filter((p) => !idsExistentes.has(p.id))];
    }
    hayMasPosts = nuevos.length === POSTS_PAGE_SIZE;
    cursorPosts = nuevoCursor;
    loadingPosts = false;
    renderPosts();

    if (refresh) persistirCacheLocal();
  } catch (error) {
    console.error('pantalla-principal – cargarPosts:', error);
    loadingPosts = false;
    renderPosts();
  }
}

async function cargarMasPosts() {
  if (cargandoMas || !hayMasPosts) return;
  cargandoMas = true;
  renderPosts();
  await cargarPosts();
  cargandoMas = false;
  renderPosts();
}

async function traerPostsNuevos() {
  if (!uidActual) return;
  try {
    const { data, error } = await supabaseClient
      .from('publicaciones')
      .select(SELECT_POST)
      .order('creado_en', { ascending: false })
      .limit(POSTS_PAGE_SIZE);
    if (error) throw error;

    const recientes = data ?? [];
    const idsExistentes = new Set(posts.map((p) => p.id));
    const nuevos = recientes.filter((p) => !idsExistentes.has(p.id));
    if (nuevos.length === 0) return;

    posts = [...nuevos, ...posts];
    renderPosts();
    persistirCacheLocal();
  } catch (error) {
    console.error('pantalla-principal – traer posts nuevos:', error);
  }
}

function claveCache() {
  return `${CACHE_KEY_PREFIX}${uidActual ?? ''}`;
}

function mostrarCacheLocal() {
  try {
    const cached = localStorage.getItem(claveCache());
    if (cached) {
      posts = JSON.parse(cached);
      idsRenderizados = new Set(); // datos vienen "frescos" de caché → montar todo
      loadingPosts = false;
      renderPosts();
    }
  } catch (error) {
    console.error('pantalla-principal – cache read:', error);
  }
}

function persistirCacheLocal() {
  if (posts.length === 0) return;
  try {
    localStorage.setItem(claveCache(), JSON.stringify(posts.slice(0, CACHE_MAX_POSTS)));
  } catch (error) {
    console.error('pantalla-principal – cache write:', error);
  }
}

function suscribirRealtime() {
  if (!uidActual) return;
  postsChannel = supabaseClient
    .channel(`feed_posts_${uidActual}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'publicaciones' },
      (payload) => {
        const actualizado = payload.new;
        const idx = posts.findIndex((p) => p.id === actualizado.id);
        if (idx !== -1) {
          // Se actualiza el arreglo en memoria (para que la caché
          // local y una futura re-carga queden con el dato correcto),
          // pero SIN volver a llamar a renderPosts(): cada tarjeta ya
          // mantiene su propio total de reacciones/comentarios
          // actualizado mediante sus propios fetches, y reconstruir
          // toda la lista aquí las volvería a montar de golpe
          // (parpadeo + refetch innecesario) solo por el cambio de un
          // post.
          posts[idx] = {
            ...posts[idx],
            total_reacciones: actualizado.total_reacciones,
            total_comentarios: actualizado.total_comentarios,
          };
        }
      }
    )
    .subscribe();
}

// ═══════════════════════════════════════════════════════════════
// SCROLL INFINITO — ver ASUNCIÓN sobre el contenedor al inicio
// ═══════════════════════════════════════════════════════════════

function onScroll() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const clientHeight = window.innerHeight;
  const scrollHeight = document.documentElement.scrollHeight;
  if (scrollTop + clientHeight >= scrollHeight - 300 && !cargandoMas && hayMasPosts) {
    cargarMasPosts();
  }
}

// ═══════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════

function renderBadgeNotif() {
  const badge = panelActual?.querySelector('#feed-notif-badge');
  if (!badge) return;
  badge.hidden = notificacionesNoLeidas === 0;
  badge.textContent = notificacionesNoLeidas > 99 ? '99+' : String(notificacionesNoLeidas);
}

function renderAvatarComposer() {
  const el = panelActual?.querySelector('#feed-mi-avatar-composer');
  if (!el) return;
  el.innerHTML = miFoto ? `<img src="${miFoto}" alt="" />` : '<span>👤</span>';
}

function renderHistorias() {
  const zona = panelActual?.querySelector('#feed-historias');
  if (!zona) return;

  if (loadingStories) {
    zona.innerHTML = `<div class="feed-historias__spinner"><span class="btn-spinner"></span></div>`;
    return;
  }

  const anilloTuyo = yoTengoStory
    ? (yoViMisHistorias ? 'vista' : 'activo')
    : 'sin-historia';

  let html = `
    <div class="feed-historia-celda" data-tu-historia>
      <div class="feed-historia-avatar feed-historia-avatar--${anilloTuyo}" data-abrir-mi-historia>
        <div class="feed-historia-avatar__img">${miFoto ? `<img src="${miFoto}" alt="" />` : '<span>👤</span>'}</div>
        <button class="feed-historia-mas" data-crear-historia aria-label="Crear historia">+</button>
      </div>
      <span class="feed-historia-nombre">Tu historia</span>
    </div>
  `;

  stories.forEach((grupo, idx) => {
    const anillo = grupo.todasVistas ? 'vista' : 'activo';
    const silenciado = autoresSilenciados.has(grupo.autor_id);
    const primerNombre = (grupo.nombre ?? '').split(' ')[0] ?? '';
    html += `
      <div class="feed-historia-celda" data-story-idx="${idx}">
        <div class="feed-historia-avatar feed-historia-avatar--${anillo}${silenciado ? ' feed-historia-avatar--silenciado' : ''}">
          <div class="feed-historia-avatar__img">${grupo.foto ? `<img src="${grupo.foto}" alt="" />` : '<span>👤</span>'}</div>
        </div>
        <span class="feed-historia-nombre">${primerNombre}</span>
      </div>
    `;
  });

  zona.innerHTML = html;
}

// FIX DE RENDIMIENTO: ya no se hace zona.innerHTML = html con TODA
// la lista en cada llamada. Ahora se insertan y activan únicamente
// los posts cuyo id todavía no está en idsRenderizados — el resto de
// las tarjetas ya montadas se quedan intactas (con sus listeners y
// su estado de reacciones/comentarios ya cargado, sin volver a
// hacer fetch). El pie de la lista (spinner "cargando más" / marca
// de "fin") sí se reemplaza en cada llamada, ya que es barato y
// necesita reflejar hayMasPosts/cargandoMas al día.
function renderPosts() {
  const zona = panelActual?.querySelector('#feed-posts');
  if (!zona) return;

  if (loadingPosts && posts.length === 0) {
    idsRenderizados = new Set();
    zona.innerHTML = `<div class="feed-posts__spinner"><span class="btn-spinner"></span></div>`;
    return;
  }
  if (posts.length === 0) {
    idsRenderizados = new Set();
    zona.innerHTML = `
      <div class="feed-vacio">
        <span class="feed-vacio__icono">👥</span>
        <p class="feed-vacio__titulo">Aún no hay publicaciones</p>
        <p class="feed-vacio__subtitulo">Crea tu primera publicación y sigue a compañeros</p>
      </div>
    `;
    return;
  }

  const isDark = obtenerTema() === 'dark';

  // Si la zona está vacía o fue limpiada (refresh completo / primera
  // carga), no hay nada que preservar: se monta todo desde cero.
  if (idsRenderizados.size === 0) {
    zona.innerHTML = posts.map((post) => renderTarjetaPublicacion(post, { isDark })).join('');
    posts.forEach((post) => {
      idsRenderizados.add(post.id);
      const elTarjeta = zona.querySelector(`[data-post-id="${post.id}"]`);
      if (!elTarjeta) return;
      activarTarjetaPublicacion(elTarjeta, post, {
        isDark,
        onRefresh: () => cargarPosts({ refresh: true }),
        onMiPerfilTap: null, // TODO: pendiente módulo Mi Perfil — conectar cuando exista
      });
    });
  } else {
    // Se recorre `posts` en su orden real y se inserta cada post
    // nuevo justo en su posición correcta (antes del siguiente post
    // ya montado que le sigue) en vez de simplemente agregarlo al
    // final. Esto respeta tanto el caso de scroll infinito (posts
    // nuevos al final, traídos por cargarMasPosts) como el caso de
    // traerPostsNuevos() (posts nuevos antepuestos al inicio, cuando
    // el propio usuario publica algo).
    const pieAnterior = zona.querySelector('.feed-posts__spinner, .feed-posts__fin');
    pieAnterior?.remove();

    let cursor = zona.firstElementChild;
    posts.forEach((post) => {
      if (idsRenderizados.has(post.id)) {
        // Ya está montado: avanza el cursor hasta encontrarlo (por si
        // el orden real difiere ligeramente) y sigue desde ahí.
        while (cursor && cursor.dataset.postId !== String(post.id)) {
          cursor = cursor.nextElementSibling;
        }
        if (cursor) cursor = cursor.nextElementSibling;
        return;
      }

      const contenedorTemporal = document.createElement('div');
      contenedorTemporal.innerHTML = renderTarjetaPublicacion(post, { isDark });
      const elTarjeta = contenedorTemporal.firstElementChild;
      zona.insertBefore(elTarjeta, cursor); // cursor === null → se inserta al final

      idsRenderizados.add(post.id);
      activarTarjetaPublicacion(elTarjeta, post, {
        isDark,
        onRefresh: () => cargarPosts({ refresh: true }),
        onMiPerfilTap: null,
      });
    });
  }

  // Pie de la lista: spinner de "cargando más" o marca de fin.
  const pie = document.createElement('div');
  pie.className = hayMasPosts ? 'feed-posts__spinner' : 'feed-posts__fin';
  if (hayMasPosts) pie.innerHTML = `<span class="btn-spinner"></span>`;
  zona.appendChild(pie);
}

// ═══════════════════════════════════════════════════════════════
// INTERACCIONES
// ═══════════════════════════════════════════════════════════════

function activarInteracciones(panel) {
  panel.querySelector('#feed-buscar').addEventListener('click', () => navegarA('/buscador-usuarios'));
  panel.querySelector('#feed-notif').addEventListener('click', () => {
    navegarA('/notificaciones');
    // Al volver de notificaciones se asume que el usuario las vio;
    // se refresca el contador (mismo comportamiento que en Dart).
  });

  panel.querySelector('#feed-composer-input').addEventListener('click', abrirCrearPublicacion);
  panel.querySelector('#feed-composer-imagen').addEventListener('click', abrirCrearPublicacion);

  const zonaHistorias = panel.querySelector('#feed-historias');
  zonaHistorias.addEventListener('click', (evento) => {
    if (evento.target.closest('[data-crear-historia]')) {
      crearHistoria();
      return;
    }
    if (evento.target.closest('[data-abrir-mi-historia]')) {
      yoTengoStory ? verMisHistorias() : crearHistoria();
      return;
    }
    const celda = evento.target.closest('[data-story-idx]');
    if (celda) {
      const grupo = stories[Number(celda.dataset.storyIdx)];
      if (grupo) verHistoriaAjena(grupo);
    }
  });

  // Long-press (simulado) para abrir el menú de opciones de una
  // historia ajena — ver nota de ASUNCIONES al inicio del archivo.
  let longPressTimer = null;
  const iniciarLongPress = (evento) => {
    const celda = evento.target.closest('[data-story-idx]');
    if (!celda) return;
    longPressTimer = setTimeout(() => {
      const grupo = stories[Number(celda.dataset.storyIdx)];
      if (grupo) mostrarOpcionesHistoria(grupo);
    }, LONG_PRESS_MS);
  };
  const cancelarLongPress = () => clearTimeout(longPressTimer);
  zonaHistorias.addEventListener('mousedown', iniciarLongPress);
  zonaHistorias.addEventListener('touchstart', iniciarLongPress, { passive: true });
  ['mouseup', 'mouseleave', 'touchend', 'touchmove'].forEach((ev) =>
    zonaHistorias.addEventListener(ev, cancelarLongPress)
  );

  // El feed de publicaciones (#feed-posts) ya no necesita un listener
  // delegado propio: cada tarjeta (tarjeta-publicacion.js) engancha
  // sus propias interacciones (autor, reacciones, comentarios,
  // galería, opciones) al activarse en renderPosts().
}

function abrirCrearPublicacion() {
  navegarA('/crear-publicacion');
}

// Web-equivalente de Navigator.push<bool>().then((creada) { if
// (creada) _traerPostsNuevos(); }): crear-publicacion.js dispara
// este evento en window justo antes de volver, en vez de depender
// de un valor de retorno de la navegación. Solo antepone lo nuevo
// al feed — no recarga todo, para no perder scroll ni paginación.
window.addEventListener('publicacion:creada', () => {
  if (panelActual) traerPostsNuevos();
});