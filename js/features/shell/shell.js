// ═════════════════════════════════════════════════════════════════
// shell.js — Pantalla raíz de la aplicación (ruta '/home')
//
// Ubicación: js/features/shell/shell.js
// Estilos:   css/shell.css
//
// ¿QUÉ ES?
// El "marco" que aparece justo después de iniciar sesión y dentro del
// cual viven todas las secciones de la app. Equivale a Feed.dart
// (FeedTab) en la versión Flutter.
//
// ¿QUÉ CONTIENE?
//   • Cabecera pegajosa: botón ☰, logo y avatar del usuario.
//   • Selector de pestañas: Comunidad, Mi Perfil, Market, Jaguares,
//     UbicaTec y, solo para administradores, Admin.
//   • Drawer (menú lateral): panel deslizante en móvil/tablet y
//     columna fija a la izquierda en escritorio (≥1100px; eso lo
//     resuelve solo el CSS, aquí no hay lógica de escritorio).
//   • Banner emergente de notificaciones en tiempo real.
//   • Arranque/detención del tiempo real de JaguarChat (mensajes y
//     presencia "en línea").
//   • Deslizar con el dedo para cambiar de pestaña (solo táctil).
//
// CÓMO FUNCIONAN LAS PESTAÑAS
// Cada pestaña es un <section class="shell-panel"> que se monta UNA
// sola vez, la primera vez que se muestra (import dinámico), y luego
// solo se oculta/muestra. Así conserva su estado y su posición de
// scroll al cambiar de pestaña.
//
// CÓMO SE CONSERVA EL SHELL AL NAVEGAR (FIX)
// Antes, cada vez que el usuario salía de '/home' (perfil de otro
// usuario, buscador, notificaciones...) y volvía, el router llamaba
// otra vez a render() y este hacía contenedor.innerHTML =
// plantillaShell(): se destruía todo, se reiniciaba la pestaña y el
// feed volvía a descargar todas las publicaciones.
//
// Ahora el nodo raíz (.shell) se guarda en memoria (shellRaiz). Al
// volver a '/home' se reinserta ese mismo nodo en lugar de
// reconstruirlo. Quitar un nodo del DOM NO elimina sus listeners ni
// su estado, así que las tarjetas, reacciones, scroll infinito y
// pestañas ya montadas quedan exactamente como estaban. Solo se
// reconstruye desde cero la primera vez, o si cambió el usuario
// (o se cerró sesión).
//
// Además se recuerda la posición de scroll: la del shell completo
// (al salir de /home) y la de cada pestaña (al cambiar entre ellas),
// porque el que scrollea es `window` y es compartido por todas.
//
// CAMBIOS RECIENTES
//   • SWIPE CON CARRILES ANIDADOS: Market (.market-pager) y JaguarChat
//     (.jchat-pager) ahora tienen su propio carril horizontal con
//     scroll-snap para deslizar entre sus subpantallas. Como
//     activarSwipePestanas() ignoraba cualquier elemento con scroll
//     horizontal propio, el gesto que empezaba dentro de esas dos
//     pestañas dejaba de cambiar de pestaña del shell. Ahora esos
//     carriles se tratan aparte: se quedan con el gesto mientras
//     pueden moverse y, cuando el usuario está en su PRIMERA
//     subpantalla y desliza hacia la derecha (o en la ÚLTIMA y
//     desliza hacia la izquierda), el gesto pasa al shell y cambia
//     de pestaña. Ver activarSwipePestanas().
//
// ORDEN DEL ARCHIVO
//   1. Imports
//   2. Constantes y estado del módulo
//   3. Punto de entrada (render)
//   4. Plantillas HTML
//   5. Perfil y administrador
//   6. Pestañas
//   7. Notificaciones y banner
//   8. Tiempo real de JaguarChat
//   9. Interacciones (drawer, tema, compartir, cabecera, swipe)
// ═════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────────
// 1. IMPORTS
// ─────────────────────────────────────────────────────────────────
import { registrarRuta, navegarA } from '../../core/router.js';
import { mostrarToast } from '../../core/toast.js';
import { inicializarTema, obtenerTema, alternarTema } from '../../core/theme.js';
import { supabaseClient } from '../../core/supabase-client.js';
import { renderMarcadorPosicion } from './placeholder.js';
import { resolverUrlPerfil } from '../../core/perfil-utils.js';
import {
  render as renderPantallaPrincipal,
  alVolver as alVolverAComunidad,
} from '../social/pantalla-principal.js';
import * as realtimeService from '../chat/servicios/realtime-service.js';
import * as presenceService from '../chat/servicios/presence-service.js';


// ─────────────────────────────────────────────────────────────────
// 2. CONSTANTES Y ESTADO DEL MÓDULO
// ─────────────────────────────────────────────────────────────────

// Pestañas que ve cualquier usuario. El orden aquí es el orden en la
// barra y también el orden del deslizamiento con el dedo.
const PESTANAS_BASE = [
  { id: 'comunidad', etiqueta: 'Comunidad', icono: '👥' },
  { id: 'perfil',    etiqueta: 'Mi Perfil', icono: '👤' },
  { id: 'market',    etiqueta: 'Market',    icono: '🏷️' },
  { id: 'jaguares',  etiqueta: 'Jaguares',  icono: '💬' },
  { id: 'ubicatec',  etiqueta: 'UbicaTec',  icono: '🗺️' },
];

// Solo se agrega a la barra si el usuario está en tabla_admins
// (ver verificarSiEsAdmin). El nivel real (moderador/admin) lo
// resuelve después el propio panel.
const PESTANA_ADMIN = { id: 'admin', etiqueta: 'Admin', icono: '🛡️' };

// Estado del módulo. Este archivo se importa una sola vez, pero el
// usuario puede salir de /home y volver a entrar sin recargar la
// página. Por eso parte del estado (marcado abajo) se CONSERVA entre
// llamadas a render() y solo se reinicia al construir el shell de nuevo.
let pestanaActiva = 'comunidad';
let esAdmin = false;
let perfil = null;                // fila de `perfiles` del usuario actual
let canalNotificaciones = null;   // canal Realtime de notificaciones
let temporizadorBanner = null;    // timeout que oculta el banner

// ── Conservación del shell entre navegaciones ───────────────────
let shellRaiz = null;        // nodo .shell guardado en memoria
let uidShell = null;         // usuario dueño de ese shell
let scrollShell = null;      // {el, top}: qué elemento scrolleaba y cuánto
let scrollPorPestana = {};   // scroll recordado por pestaña

// Evita registrar más de una vez el listener de auth de
// realtime-service.js. Si el usuario sale de /home y vuelve a entrar
// sin recargar, este módulo sigue siendo el mismo singleton y, sin
// esta bandera, se apilarían listeners duplicados en cada render().
let realtimeAuthListenerRegistrado = false;

// ── Scroll: detección del elemento que realmente scrollea ────────
// No se asume que sea `window`. Según el CSS, el que scrollea puede
// ser el documento, <body>, #app, .shell, .shell-contenido o un
// panel. Además, cuando el router vacía #app al navegar, el
// contenido desaparece y el navegador pone scrollTop = 0 en ese
// elemento: la posición hay que guardarla ANTES de que eso pase
// (con el listener), no al salir.

/** Elementos que podrían ser el contenedor con scroll vertical. */
function candidatosScroll() {
  const lista = [document.scrollingElement || document.documentElement];
  for (let el = shellRaiz; el; el = el.parentElement) lista.push(el);
  shellRaiz?.querySelectorAll('.shell-contenido, .shell-panel').forEach((e) => lista.push(e));
  return lista;
}

/** Devuelve {el, top} del contenedor que está scrolleado ahora mismo. */
function leerScroll() {
  const el = candidatosScroll().find((e) => e.scrollTop > 0);
  return el ? { el, top: el.scrollTop } : { el: null, top: 0 };
}

// Se guarda mientras el shell está visible. Se registra UNA sola vez,
// en fase de CAPTURA: los eventos 'scroll' de elementos no burbujean
// hasta window, pero la captura sí los ve. No se guarda mientras se
// restaura (restaurandoScroll): la página aún puede ser más corta de
// lo normal y los valores intermedios NO son la posición del usuario.
let restaurandoScroll = false;

window.addEventListener('scroll', () => {
  if (shellRaiz?.isConnected && !restaurandoScroll) scrollShell = leerScroll();
}, { passive: true, capture: true });

// El navegador intenta restaurar el scroll por su cuenta al navegar
// con "atrás"/"adelante", sobre una página que aún está vacía. Se
// desactiva: aquí lo restauramos nosotros.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

/**
 * Restaura una posición {el, top} obtenida con leerScroll(),
 * reintentando frame a frame hasta que la página tenga altura
 * suficiente (las tarjetas con imágenes pueden tardar unos frames en
 * recuperar su tamaño al reinsertarse el nodo). Máximo ~1 segundo. Si
 * el usuario toca la pantalla mientras tanto, se cancela.
 */
function restaurarScroll(pos) {
  const top = pos?.top ?? 0;

  if (!top) {
    candidatosScroll().forEach((e) => { e.scrollTop = 0; });
    return;
  }

  const el = pos.el ?? (document.scrollingElement || document.documentElement);
  restaurandoScroll = true;
  let intentos = 0;

  const terminar = () => {
    restaurandoScroll = false;
    scrollShell = leerScroll();
    window.removeEventListener('touchstart', terminar);
    window.removeEventListener('wheel', terminar);
  };
  window.addEventListener('touchstart', terminar, { passive: true, once: true });
  window.addEventListener('wheel', terminar, { passive: true, once: true });

  const intentar = () => {
    if (!restaurandoScroll) return; // el usuario tomó el control
    el.scrollTop = top;
    if (Math.abs(el.scrollTop - top) <= 2 || ++intentos >= 60) {
      terminar();
      return;
    }
    requestAnimationFrame(intentar);
  };
  requestAnimationFrame(intentar);
}

// Nota sobre las rutas del Drawer: '/plantel', '/oferta-educativa',
// '/donaciones', '/soporte', '/ajustes' y '/notificaciones' NO se
// registran aquí. Cada una tiene su propio módulo, que se
// autoregistra al importarse (js/features/drawer/ y
// js/features/social/notificaciones.js). El único registro de este
// archivo es '/home'.


// ─────────────────────────────────────────────────────────────────
// 3. PUNTO DE ENTRADA
// ─────────────────────────────────────────────────────────────────

/**
 * Dibuja el shell dentro de `contenedor`. Lo llama el router cada vez
 * que se entra a '/home'.
 *
 * Dos caminos:
 *   A) Regreso a /home con el mismo usuario → se reinserta el nodo
 *      guardado (shellRaiz). No se recarga nada.
 *   B) Primera vez (o cambió el usuario) → se construye desde cero:
 *      pinta el HTML → carga perfil y admin en paralelo → arranca las
 *      suscripciones en tiempo real → conecta los eventos.
 */
async function render(contenedor) {
  // getSession() lee la sesión local (sin red), a diferencia de
  // getUser(), que hace una petición al servidor en cada llamada.
  // Así el regreso a /home es inmediato.
  const { data: { session } } = await supabaseClient.auth.getSession();
  const user = session?.user ?? null;

  // router.js NO espera a que render() termine. Si mientras se
  // resolvía la sesión el usuario ya navegó a otra pantalla, no hay
  // que pintar el shell encima de ella.
  if (!window.location.hash.startsWith('#/home')) return;

  // ── Camino A: reutilizar el shell ya construido ───────────────
  if (user && shellRaiz && uidShell === user.id) {
    // Se lee ANTES de insertar el nodo: el scroll de window podría
    // dispararse con otro valor durante el reflujo y pisar scrollShell.
    const scrollAlVolver = scrollShell;

    contenedor.innerHTML = '';
    contenedor.appendChild(shellRaiz);

    // Se restaura con reintentos: la página puede tardar unos frames
    // en recuperar su altura completa tras reinsertar el nodo.
    restaurarScroll(scrollAlVolver);

    // Solo se refresca lo barato (badge de notificaciones). Los
    // posts NO se tocan.
    if (pestanaActiva === 'comunidad') alVolverAComunidad();
    return;
  }

  // ── Camino B: construir desde cero ────────────────────────────
  inicializarTema();
  pestanaActiva = 'comunidad';
  esAdmin = false;
  perfil = null;
  scrollPorPestana = {};
  scrollShell = null;

  contenedor.innerHTML = plantillaShell();
  shellRaiz = contenedor.querySelector('.shell');
  uidShell = user?.id ?? null;

  await Promise.all([cargarPerfil(), verificarSiEsAdmin()]);
  suscribirNotificaciones();
  suscribirRealtimeChat();

  activarInteracciones(contenedor);
  activarMedidaCabecera(contenedor);
  activarSwipePestanas(contenedor);
}

// Registra la pantalla raíz bajo '/home'. Sin esta línea el router no
// encuentra ninguna función asociada a esa ruta y cae al fallback
// (rutaInicial = '/login'), que era lo que producía el bug de quedarse
// en el login tras un inicio de sesión exitoso.
registrarRuta('/home', render);


// ─────────────────────────────────────────────────────────────────
// 4. PLANTILLAS HTML
// ─────────────────────────────────────────────────────────────────

/**
 * HTML de la estructura completa del shell:
 *   .shell-cabecera  → header + barra de pestañas (pegajosa)
 *   .shell-contenido → un panel por pestaña (vacíos hasta montarse)
 *   overlay + drawer → menú lateral
 *   .shell-banner-zona → donde aparece el banner de notificación
 */
function plantillaShell() {
  return `
    <div class="shell">
      <div class="shell-cabecera">
        <header class="shell-header">
          <button class="shell-header__menu" id="btn-abrir-drawer" aria-label="Abrir menú">☰</button>
          <img
            class="shell-header__logo"
            id="logo-appbar"
            src="assets/img/appbar_modo_${obtenerTema() === 'dark' ? 'oscuro' : 'claro'}.png"
            alt="Comunidad ITVH"
          />
          <button class="shell-header__avatar" id="btn-avatar" aria-label="Mi perfil">
            <span id="avatar-contenido">${inicialAvatar()}</span>
          </button>
        </header>

        <nav class="shell-tabbar" id="shell-tabbar">
          ${PESTANAS_BASE.map(renderBotonPestana).join('')}
        </nav>
      </div>

      <main class="shell-contenido" id="shell-contenido">
        ${PESTANAS_BASE.map((p) => `<section class="shell-panel" data-panel="${p.id}"></section>`).join('')}
      </main>

      <div class="shell-drawer-overlay" id="drawer-overlay"></div>
      <aside class="shell-drawer" id="shell-drawer">
        ${plantillaDrawer()}
      </aside>

      <div class="shell-banner-zona" id="banner-zona"></div>
    </div>
  `;
}

/** HTML de un botón de la barra de pestañas (solo el ícono). */
function renderBotonPestana(p) {
  return `
    <button class="shell-tabbar__btn${p.id === 'comunidad' ? ' activa' : ''}" data-tab="${p.id}">
      <span class="shell-tabbar__icono">${p.icono}</span>
    </button>
  `;
}

/**
 * HTML del contenido del Drawer (menú lateral).
 * Secciones: PLANTEL (tile grande + dos chicos) → tarjetas de
 * comunidad (compartir, donaciones, sugerencias) → PLATAFORMAS
 * (SIE, SWS) → PREFERENCIAS (tema y ajustes) → pie.
 * Los `id` (btn-compartir, switch-tema, icono-tema, etiqueta-tema)
 * los usa activarInteracciones(): no cambiarlos sin actualizarla.
 */
function plantillaDrawer() {
  return `
    <div class="drawer-contenido">
      <h2 class="drawer-titulo">Menú</h2>

      <p class="drawer-seccion">PLANTEL</p>
      <a class="drawer-tile drawer-tile--hero" href="#/plantel/conoce" style="background-image:url('assets/img/drawer_imagen1.jpg')">
        <span class="drawer-tile__icono">📍</span>
        <span>
          <span class="drawer-tile__label">Conoce el plantel</span>
          <span class="drawer-tile__subtitulo">Descubre nuestras instalaciones</span>
        </span>
      </a>
      <div class="drawer-fila">
        <a class="drawer-tile drawer-tile--hero drawer-tile--mini" href="#/plantel/historia" style="background-image:url('assets/img/drawer_imagen2.jpg')">
          <span class="drawer-tile__icono">📖</span>
          <span class="drawer-tile__label">Un poco de historia</span>
        </a>
        <a class="drawer-tile drawer-tile--hero drawer-tile--mini" href="#/oferta-educativa" style="background-image:url('assets/img/drawer_imagen3.jpg')">
          <span class="drawer-tile__icono">🎓</span>
          <span class="drawer-tile__label">Oferta educativa</span>
        </a>
      </div>

      <button class="drawer-tile" id="btn-compartir">
        <span class="drawer-tile__icono">📤</span>
        <span>
          <span class="drawer-tile__label">Comparte "Comunidad ITVH"</span>
          <span class="drawer-tile__subtitulo">Invita a otros a descubrir la app</span>
        </span>
      </button>
      <a class="drawer-tile" href="#/donaciones">
        <span class="drawer-tile__icono">☕</span>
        <span>
          <span class="drawer-tile__label">¿Nos invitas un café?</span>
          <span class="drawer-tile__subtitulo">Apoya el desarrollo de la app</span>
        </span>
      </a>
      <a class="drawer-tile" href="#/soporte">
        <span class="drawer-tile__icono">💬</span>
        <span>
          <span class="drawer-tile__label">¿Alguna sugerencia?</span>
          <span class="drawer-tile__subtitulo">Reporta un problema o envía tu opinión</span>
        </span>
      </a>

      <p class="drawer-seccion">PLATAFORMAS</p>
      <div class="drawer-plataformas">
        <a class="drawer-plataforma" href="https://villahermosa.sistemasie.app/cgi-bin/sie.pl?Opc=PINDEXESTUDIANTE&psie=villahermosa&dummy=0" target="_blank" rel="noopener">
          <img src="assets/img/sie_logo.png" alt="SIE" />
          <span>SIE</span>
        </a>
        <a class="drawer-plataforma" href="https://sws.villahermosa.tecnm.mx/inicio" target="_blank" rel="noopener">
          <img src="assets/img/sws_logo.png" alt="SWS" />
          <span>SWS</span>
        </a>
      </div>

      <p class="drawer-seccion">PREFERENCIAS</p>
      <div class="drawer-tile drawer-tile--tema">
        <span class="drawer-tile__icono" id="icono-tema">${obtenerTema() === 'dark' ? '🌙' : '☀️'}</span>
        <span class="drawer-tile__label" id="etiqueta-tema">${obtenerTema() === 'dark' ? 'Modo oscuro' : 'Modo claro'}</span>
        <label class="theme-switch">
          <input type="checkbox" id="switch-tema" ${obtenerTema() === 'dark' ? 'checked' : ''} />
          <span></span>
        </label>
      </div>
      <a class="drawer-tile" href="#/ajustes">
        <span class="drawer-tile__icono">⚙️</span>
        <span>
          <span class="drawer-tile__label">Ajustes</span>
          <span class="drawer-tile__subtitulo">Cuenta, notificaciones, privacidad</span>
        </span>
      </a>

      <div class="drawer-pie">
        <a href="https://programix-navejl.github.io/Programix-NaveJL-Pagina-Oficial/" target="_blank" rel="noopener">
          <p>Comunidad ITVH</p>
          <p class="drawer-pie__copy">Programix NaveJL © 2026</p>
        </a>
      </div>
    </div>
  `;
}


// ─────────────────────────────────────────────────────────────────
// 5. PERFIL Y ADMINISTRADOR
// ─────────────────────────────────────────────────────────────────

/** Primera letra del nombre en mayúscula; se usa si no hay foto. */
function inicialAvatar() {
  const nombre = perfil?.nombre ?? '';
  return nombre ? nombre.trim().charAt(0).toUpperCase() : '';
}

/** Lee la fila de `perfiles` del usuario y actualiza el avatar. */
async function cargarPerfil() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data, error } = await supabaseClient
    .from('perfiles')
    .select('nombre, nombre_usuario, cdn_foto_perfil, carrera, semestre')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('shell – error cargando perfil:', error);
    return;
  }
  perfil = data;
  actualizarAvatar();
}

/** Muestra la foto de perfil en el header (o la inicial si no hay). */
function actualizarAvatar() {
  const contenedor = document.getElementById('avatar-contenido');
  if (!contenedor) return;
  const url = perfil ? resolverUrlPerfil(perfil) : '';
  contenedor.innerHTML = url ? `<img src="${url}" alt="" />` : inicialAvatar();
}

/**
 * Comprueba si el usuario está en tabla_admins y, de ser así, agrega
 * la pestaña Admin. Ocultar la pestaña NO protege nada: la seguridad
 * real la dan las políticas RLS de Supabase.
 */
async function verificarSiEsAdmin() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data, error } = await supabaseClient
    .from('tabla_admins')
    .select('id')
    .eq('perfil_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('shell – error verificando admin:', error);
    return;
  }

  esAdmin = Boolean(data);
  if (esAdmin) agregarPestanaAdmin();
}

/**
 * Agrega al DOM el botón y el panel de la pestaña Admin. Si ya
 * existen no hace nada. Nota: activarInteracciones() también engancha
 * clic a todos los [data-tab]; el botón queda con dos listeners, pero
 * es inofensivo porque cambiarPestana() ignora la pestaña ya activa.
 */
function agregarPestanaAdmin() {
  const barra = document.getElementById('shell-tabbar');
  const contenido = document.getElementById('shell-contenido');
  if (!barra || !contenido || barra.querySelector('[data-tab="admin"]')) return;

  barra.insertAdjacentHTML('beforeend', renderBotonPestana(PESTANA_ADMIN));
  contenido.insertAdjacentHTML('beforeend', `<section class="shell-panel" data-panel="admin"></section>`);
  barra.querySelector('[data-tab="admin"]').addEventListener('click', () => cambiarPestana('admin'));
}


// ─────────────────────────────────────────────────────────────────
// 6. PESTAÑAS
// ─────────────────────────────────────────────────────────────────

/**
 * Cambia a la pestaña `id`: recuerda el scroll de la pestaña que se
 * deja, marca el botón activo, muestra su panel, oculta los demás y,
 * si es la primera vez, monta su contenido. Al final restaura el
 * scroll que esa pestaña tenía la última vez.
 */
function cambiarPestana(id) {
  if (id === pestanaActiva) return;

  // El scroll es de `window` y lo comparten todas las pestañas:
  // se guarda el de la que se abandona antes de ocultarla.
  scrollPorPestana[pestanaActiva] = leerScroll();
  pestanaActiva = id;

  document.querySelectorAll('.shell-tabbar__btn').forEach((btn) => {
    btn.classList.toggle('activa', btn.dataset.tab === id);
  });

  document.querySelectorAll('.shell-panel').forEach((panel) => {
    const activo = panel.dataset.panel === id;
    panel.classList.toggle('visible', activo);
    if (activo && !panel.dataset.montado) montarPanel(panel, id);
  });

  // Se restaura después de que el panel ya es visible.
  restaurarScroll(scrollPorPestana[id]);
}

/**
 * Carga el módulo real de una pestaña la primera vez que se muestra.
 * Todas las pestañas menos Comunidad se importan de forma perezosa,
 * así no se paga el costo de Market, Chat, Mapa, etc. hasta que el
 * usuario entra a ellas.
 */
function montarPanel(panel, id) {
  panel.dataset.montado = '1';

  if (id === 'comunidad') {
    renderPantallaPrincipal(panel);
    return;
  }
  if (id === 'perfil') {
    import('../perfil/mi-perfil/mi-perfil-screen.js').then(({ render }) => render(panel));
    return;
  }
  if (id === 'market') {
    import('../marketplace/marketplace-screen.js').then(({ render }) => render(panel));
    return;
  }
  if (id === 'jaguares') {
    import('../chat/jaguar-chat-principal.js').then(({ render }) => render(panel));
    return;
  }
  if (id === 'ubicatec') {
    import('../mapa/ubicatecnm.js').then(({ render }) => render(panel));
    return;
  }
  if (id === 'admin') {
    import('../admin/panel-admin.js').then(({ render }) => render(panel));
    return;
  }

  // Ninguna pestaña conocida: marcador de posición genérico.
  renderMarcadorPosicion(panel, { icono: '🚧', titulo: 'Próximamente', subtitulo: '' });
}


// ─────────────────────────────────────────────────────────────────
// 7. NOTIFICACIONES Y BANNER
// ─────────────────────────────────────────────────────────────────

/**
 * Se suscribe (Supabase Realtime) a los INSERT de la tabla
 * `notificaciones` dirigidos al usuario actual. Cada fila nueva
 * dispara el banner emergente. Si ya había un canal, lo reemplaza.
 *
 * Nota: el banner vive dentro del shell. Mientras el shell está
 * fuera del DOM (el usuario está en otra pantalla) no se ve; al
 * volver, el banner ya habrá desaparecido por su temporizador.
 */
function suscribirNotificaciones() {
  supabaseClient.auth.getUser().then(({ data }) => {
    const user = data?.user;
    if (!user) return;

    if (canalNotificaciones) {
      supabaseClient.removeChannel(canalNotificaciones);
      canalNotificaciones = null;
    }

    canalNotificaciones = supabaseClient
      .channel(`feed-notif-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `destinatario_id=eq.${user.id}` },
        (payload) => enriquecerYMostrarBanner(payload.new)
      )
      .subscribe();
  });
}

/**
 * Completa una notificación con el nombre y la foto de quien la
 * originó (fila de `perfiles` según `origen_id`) y muestra el banner.
 */
async function enriquecerYMostrarBanner(fila) {
  let nombre = 'Alguien';
  let fotoUrl = '';

  if (fila?.origen_id) {
    const { data } = await supabaseClient
      .from('perfiles')
      .select('nombre, cdn_foto_perfil')
      .eq('id', fila.origen_id)
      .maybeSingle();
    if (data) {
      nombre = (data.nombre ?? '').split(' ')[0] || 'Alguien';
      fotoUrl = resolverUrlPerfil(data);
    }
  }

  mostrarBanner({ nombre, fotoUrl, texto: textoNotificacion(fila?.tipo, nombre) });
}

/** Texto del banner según el tipo de notificación. */
function textoNotificacion(tipo, nombre) {
  const textos = {
    like: `${nombre} reaccionó a tu publicación`,
    comentario: `${nombre} comentó en tu publicación`,
    respuesta: `${nombre} respondió a tu comentario`,
    seguidor: `${nombre} comenzó a seguirte`,
    like_comentario: `${nombre} reaccionó a tu comentario`,
    like_historia: `${nombre} reaccionó a tu historia`,
    comentario_historia: `${nombre} comentó en tu historia`,
  };
  return textos[tipo] ?? 'Tienes una nueva notificación';
}

/**
 * Muestra el banner estilo iOS durante 8 segundos. Al tocarlo se
 * cierra y lleva a '/notificaciones'. Solo hay un banner a la vez:
 * uno nuevo reemplaza al anterior.
 */
function mostrarBanner({ nombre, fotoUrl, texto }) {
  const zona = document.getElementById('banner-zona');
  if (!zona) return;

  clearTimeout(temporizadorBanner);
  zona.innerHTML = `
    <div class="shell-banner" id="banner-activo">
      <div class="shell-banner__avatar">${fotoUrl ? `<img src="${fotoUrl}" alt="" />` : '<span>👤</span>'}</div>
      <div class="shell-banner__texto">
        <p class="shell-banner__titulo">Notificación</p>
        <p class="shell-banner__cuerpo">${texto}</p>
      </div>
    </div>
  `;

  const banner = document.getElementById('banner-activo');
  requestAnimationFrame(() => banner.classList.add('visible'));
  banner.addEventListener('click', () => {
    ocultarBanner();
    navegarA('/notificaciones');
  });

  temporizadorBanner = setTimeout(ocultarBanner, 8000);
}

/** Desliza el banner hacia arriba y lo quita del DOM. */
function ocultarBanner() {
  const banner = document.getElementById('banner-activo');
  if (!banner) return;
  banner.classList.remove('visible');
  setTimeout(() => banner.remove(), 300);
}


// ─────────────────────────────────────────────────────────────────
// 8. TIEMPO REAL DE JAGUARCHAT (mensajes + presencia)
// ─────────────────────────────────────────────────────────────────

/**
 * Arranca y detiene realtime-service.js y presence-service.js según
 * el estado de la sesión de Supabase.
 *
 * ORIGEN. Réplica web de dónde arranca RealtimeService.instancia en
 * main.dart. En Flutter, AuthGate lo inicia apenas hay una sesión
 * válida (signedIn / tokenRefreshed / initialSession), ANTES de que
 * _AuthChecker confirme si la cuenta está activa o suspendida, y lo
 * detiene en signedOut.
 *
 * POR QUÉ AQUÍ. shell.js solo se monta cuando ya hay sesión (ruta
 * '/home', tras login o sesión restaurada), así que es el punto
 * equivalente. supabase-js emite 'INITIAL_SESSION' de forma síncrona
 * al registrar el listener si ya existe una sesión, y ese único
 * evento cubre tanto un login recién hecho como una sesión restaurada
 * al recargar. Por eso basta con el listener; no hace falta llamar a
 * iniciar() a mano.
 *
 * CORRECCIÓN (historial). Antes había además una llamada inmediata a
 * realtimeService.iniciar() "por si acaso". Esa llamada y el evento
 * 'INITIAL_SESSION' se disparaban casi a la vez, y las dos ejecuciones
 * concurrentes rompían el canal Realtime (error "cannot add
 * postgres_changes callbacks... after subscribe()"; ver el comentario
 * de cabecera de realtime-service.js). Se quitó esa llamada y además
 * realtime-service.js ahora serializa iniciar()/detener() por dentro.
 *
 * CIERRE DE SESIÓN. En SIGNED_OUT también se descarta el shell
 * guardado en memoria (shellRaiz), para que el siguiente usuario que
 * inicie sesión no vea el feed ni las pestañas del anterior.
 *
 * PRESENCIA (diferencia intencional con Flutter). En Dart,
 * PresenceService.iniciarPresencia() arranca aparte, dentro de
 * _AuthChecker, solo DESPUÉS de confirmar que estado_cuenta es
 * activo. Esa validación todavía no existe en la versión web, así que
 * presence-service.js arranca aquí junto con realtime-service.js: una
 * cuenta suspendida, si llegara a existir en la web, se vería "en
 * línea" como cualquiera.
 * PENDIENTE: mover el arranque de presencia a después de esa
 * validación en cuanto exista.
 */
function suscribirRealtimeChat() {
  if (realtimeAuthListenerRegistrado) return;
  realtimeAuthListenerRegistrado = true;

  supabaseClient.auth.onAuthStateChange((evento, sesion) => {
    const eventosSesionValida = ['SIGNED_IN', 'TOKEN_REFRESHED', 'INITIAL_SESSION'];

    if (sesion && eventosSesionValida.includes(evento)) {
      realtimeService.iniciar();
      presenceService.iniciarPresencia();
      return;
    }

    if (evento === 'SIGNED_OUT') {
      // Descartar el shell conservado: el próximo login lo reconstruye.
      shellRaiz = null;
      uidShell = null;
      scrollShell = null;
      scrollPorPestana = {};

      realtimeService.detener();
      presenceService.detenerPresencia();
    }
  });
}


// ─────────────────────────────────────────────────────────────────
// 9. INTERACCIONES
// ─────────────────────────────────────────────────────────────────

/**
 * Conecta los eventos del shell (solo se llama al construirlo desde
 * cero; al reutilizar el nodo guardado los listeners ya siguen ahí):
 *   • clic en los botones de pestaña
 *   • montaje inicial de la pestaña Comunidad
 *   • abrir/cerrar el Drawer (☰ y overlay; en escritorio el CSS lo
 *     deja fijo, estos eventos simplemente no se usan)
 *   • clic en el avatar → editar perfil
 *   • interruptor de tema claro/oscuro
 *   • botón "Comparte Comunidad ITVH"
 */
function activarInteracciones(contenedor) {
  contenedor.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => cambiarPestana(btn.dataset.tab));
  });

  // Comunidad es la pestaña inicial: se muestra y se monta de inmediato.
  const panelInicial = contenedor.querySelector('[data-panel="comunidad"]');
  if (panelInicial) {
    panelInicial.classList.add('visible');
    montarPanel(panelInicial, 'comunidad');
  }

  // Drawer: abrir con ☰, cerrar con el overlay o al tocar cualquier
  // enlace/botón del menú (excepto el interruptor de tema).
  const overlay = document.getElementById('drawer-overlay');
  const drawer = document.getElementById('shell-drawer');
  const abrirDrawer = () => { drawer.classList.add('abierto'); overlay.classList.add('visible'); };
  const cerrarDrawer = () => { drawer.classList.remove('abierto'); overlay.classList.remove('visible'); };

  document.getElementById('btn-abrir-drawer').addEventListener('click', abrirDrawer);
  overlay.addEventListener('click', cerrarDrawer);
  drawer.querySelectorAll('a, button').forEach((el) => {
    el.addEventListener('click', () => { if (el.id !== 'switch-tema') cerrarDrawer(); });
  });

  document.getElementById('btn-avatar').addEventListener('click', () => navegarA('/perfil/editar'));

  // Tema: alterna claro/oscuro y sincroniza ícono, etiqueta y logo.
  document.getElementById('switch-tema').addEventListener('change', () => {
    const nuevo = alternarTema();
    document.getElementById('icono-tema').textContent = nuevo === 'dark' ? '🌙' : '☀️';
    document.getElementById('etiqueta-tema').textContent = nuevo === 'dark' ? 'Modo oscuro' : 'Modo claro';
    document.getElementById('logo-appbar').src = `assets/img/appbar_modo_${nuevo === 'dark' ? 'oscuro' : 'claro'}.png`;
  });

  document.getElementById('btn-compartir').addEventListener('click', compartirApp);
}

/**
 * Guarda la altura real de la cabecera pegajosa (header + pestañas)
 * en la variable CSS --shell-cabecera-alto, y la mantiene al día si
 * cambia (rotar el teléfono, cambiar el tamaño de la ventana...).
 * Sirve para que otros elementos pegajosos que viven dentro de una
 * pestaña (p. ej. el encabezado del feed) se coloquen justo debajo:
 *     top: var(--shell-cabecera-alto, 0px);
 */
function activarMedidaCabecera(contenedor) {
  const cabecera = contenedor.querySelector('.shell-cabecera');
  if (!cabecera) return;

  const medir = () => {
    document.documentElement.style.setProperty('--shell-cabecera-alto', `${cabecera.offsetHeight}px`);
  };
  medir();
  new ResizeObserver(medir).observe(cabecera);
}

/**
 * Comparte la app: usa el menú nativo de compartir si el navegador lo
 * tiene (móvil); si no, copia el texto al portapapeles.
 */
async function compartirApp() {
  const texto =
    'Descarga "Comunidad ITVH". La app exclusiva del Tec de Villahermosa.\n\n' +
    'Android: https://play.google.com/store/apps/details?id=com.programixnavejl.comunidad_tecnm\n\n' +
    'iOS (en su versión web): https://programix-navejl.github.io/Comunidad-ITVH-Proyecto-Web/\n\n';

  if (navigator.share) {
    try { await navigator.share({ text: texto }); } catch { /* el usuario canceló, no es un error */ }
    return;
  }

  try {
    await navigator.clipboard.writeText(texto);
    mostrarToast('Enlace copiado al portapapeles', 'success');
  } catch {
    mostrarToast('No se pudo compartir en este navegador', 'error');
  }
}

/**
 * Deslizar el dedo hacia los lados sobre el contenido cambia a la
 * pestaña siguiente o anterior (solo pantallas táctiles).
 *
 * Un gesto cuenta solo si es claramente horizontal y lo bastante
 * largo. Se ignora cuando:
 *   • empieza a menos de 24px del borde (gesto "atrás" del navegador);
 *   • el Drawer está abierto;
 *   • empieza sobre inputs, mapas, o elementos con scroll horizontal
 *     propio (carruseles, chips...);
 *   • el elemento (o un ancestro) tiene el atributo data-no-swipe,
 *     útil para carruseles hechos con JavaScript.
 *
 * CARRILES ANIDADOS (Market y JaguarChat). Sus carriles horizontales
 * (.market-pager, .jchat-pager) tienen scroll-snap propio para pasar
 * entre subpantallas, así que NO se ignoran sin más: el carril se
 * queda con el gesto mientras pueda moverse, y solo se lo cede al
 * shell cuando ya está en un extremo:
 *   • en su PRIMERA subpantalla + deslizar a la derecha → pestaña
 *     anterior del shell;
 *   • en su ÚLTIMA subpantalla + deslizar a la izquierda → pestaña
 *     siguiente del shell.
 * Si el carril se movió durante el gesto, el shell no interviene.
 */
function activarSwipePestanas(contenedor) {
  const zona = contenedor.querySelector('#shell-contenido');
  if (!zona) return;

  const UMBRAL_X = 70;      // distancia horizontal mínima (px); súbelo para exigir un deslizamiento más largo
  const MARGEN_BORDE = 24;  // zona de los bordes de pantalla que se ignora (px)
  // Carriles horizontales propios de las pestañas Market y Jaguares.
  const PAGERS_ANIDADOS = '.market-pager, .jchat-pager';
  let inicio = null;        // punto donde empezó el toque actual

  // Analiza el elemento donde empezó el toque:
  //   • ignorar → el gesto le pertenece a ese elemento (input, mapa,
  //     carrusel con scroll horizontal propio...), el shell no actúa.
  //   • pager   → carril anidado (Market/Jaguares) más cercano, si lo hay.
  const analizarToque = (el) => {
    let pager = null;
    while (el && el !== zona) {
      if (el.matches?.(PAGERS_ANIDADOS)) {
        if (!pager) pager = el; // el más interno
      } else {
        if (el.matches?.('input, textarea, select, [contenteditable="true"], [data-no-swipe], canvas, .leaflet-container, .mapboxgl-map, .gm-style')) {
          return { ignorar: true, pager: null };
        }
        if (el.scrollWidth > el.clientWidth + 1) {
          const ox = getComputedStyle(el).overflowX;
          if (ox === 'auto' || ox === 'scroll') return { ignorar: true, pager: null };
        }
      }
      el = el.parentElement;
    }
    return { ignorar: false, pager };
  };

  zona.addEventListener('touchstart', (e) => {
    inicio = null;
    if (e.touches.length !== 1) return;
    if (document.getElementById('shell-drawer')?.classList.contains('abierto')) return;
    const t = e.touches[0];
    if (t.clientX < MARGEN_BORDE || t.clientX > window.innerWidth - MARGEN_BORDE) return;

    const { ignorar, pager } = analizarToque(e.target);
    if (ignorar) return;

    inicio = {
      x: t.clientX,
      y: t.clientY,
      pager,
      pagerIzq: pager ? pager.scrollLeft : 0, // dónde estaba el carril al empezar el gesto
    };
  }, { passive: true });

  zona.addEventListener('touchend', (e) => {
    if (!inicio) return;
    const toque = inicio;
    inicio = null;

    const t = e.changedTouches[0];
    const dx = t.clientX - toque.x;
    const dy = t.clientY - toque.y;

    // Solo cuenta si es claramente horizontal.
    if (Math.abs(dx) < UMBRAL_X || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    // Si empezó dentro de un carril anidado, el carril tiene prioridad:
    // el shell solo actúa si el carril estaba en un extremo y no se movió.
    if (toque.pager) {
      const pager = toque.pager;
      const maximo = pager.scrollWidth - pager.clientWidth;
      const seMovio = Math.abs(pager.scrollLeft - toque.pagerIzq) > 2;
      const enPrimera = toque.pagerIzq <= 1;
      const enUltima = toque.pagerIzq >= maximo - 1;

      if (seMovio) return;
      if (dx > 0 && !enPrimera) return;
      if (dx < 0 && !enUltima) return;
    }

    // Izquierda → pestaña siguiente; derecha → anterior.
    const ids = [...document.querySelectorAll('.shell-tabbar__btn')].map((b) => b.dataset.tab);
    const i = ids.indexOf(pestanaActiva);
    const destino = ids[dx < 0 ? i + 1 : i - 1];
    if (!destino) return;

    cambiarPestana(destino);

    // Fundido suave del panel que entra (ver .shell-panel--entra en el CSS).
    const panel = document.querySelector(`.shell-panel[data-panel="${destino}"]`);
    if (panel) {
      panel.classList.add('shell-panel--entra');
      panel.addEventListener('animationend', () => panel.classList.remove('shell-panel--entra'), { once: true });
    }
  }, { passive: true });

  zona.addEventListener('touchcancel', () => { inicio = null; }, { passive: true });
}