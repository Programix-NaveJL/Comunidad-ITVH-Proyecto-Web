// Pantalla raíz de la aplicación tras iniciar sesión.
//
// Contiene el encabezado con el logo y el avatar del usuario, el
// selector de pestañas (Comunidad, Mi Perfil, Market, Jaguares,
// UbicaTec y, si corresponde, Admin) y el Drawer lateral de
// navegación secundaria. Cada pestaña muestra por ahora un marcador
// de posición: se reemplaza por el módulo real conforme se vaya
// construyendo (Social, Perfil, Marketplace, Chat, Mapa, Admin).
//
// También gestiona la suscripción en tiempo real a la tabla
// notificaciones y muestra un banner emergente cuando llega una
// fila nueva dirigida al usuario autenticado.
//
// NUEVO: también engancha aquí el arranque/detención de
// realtime-service.js del módulo JaguarChat (ver bloque
// "SINCRONIZACIÓN EN TIEMPO REAL DE JAGUARCHAT" más abajo).

import { registrarRuta, navegarA } from '../../core/router.js';
import { mostrarToast } from '../../core/toast.js';
import { inicializarTema, obtenerTema, alternarTema } from '../../core/theme.js';
import { supabaseClient } from '../../core/supabase-client.js';
import { renderMarcadorPosicion } from './placeholder.js';
import { resolverUrlPerfil } from '../../core/perfil-utils.js';
import { render as renderPantallaPrincipal } from '../social/pantalla-principal.js';
import * as realtimeService from '../chat/servicios/realtime-service.js';
import * as presenceService from '../chat/servicios/presence-service.js';

const PESTANAS_BASE = [
  { id: 'comunidad', etiqueta: 'Comunidad', icono: '👥' },
  { id: 'perfil',    etiqueta: 'Mi Perfil', icono: '👤' },
  { id: 'market',    etiqueta: 'Market',    icono: '🏷️' },
  { id: 'jaguares',  etiqueta: 'Jaguares',  icono: '💬' },
  { id: 'ubicatec',  etiqueta: 'UbicaTec',  icono: '🗺️' },
];
const PESTANA_ADMIN = { id: 'admin', etiqueta: 'Admin', icono: '🛡️' };

// Estado del módulo. Se reinicia en cada render() porque el archivo
// se importa una sola vez pero el usuario puede salir de /home y
// volver a entrar.
let pestanaActiva = 'comunidad';
let esAdmin = false;
let perfil = null;
let canalNotificaciones = null;
let temporizadorBanner = null;

// Bandera para no registrar el listener de auth de
// realtime-service.js más de una vez si render() se vuelve a llamar
// (por ejemplo, si el usuario sale de /home y vuelve a entrar sin
// recargar la página — el módulo de JS sigue siendo el mismo
// singleton, así que sin esta bandera se apilarían listeners
// duplicados en cada re-render).
let realtimeAuthListenerRegistrado = false;

// Rutas del Drawer. Todas apuntan al marcador de posición por ahora;
// se reemplazan una por una conforme se construya cada pantalla real,
// sin necesidad de tocar este archivo. '/plantel', '/oferta-educativa',
// '/donaciones', '/soporte', '/ajustes' y '/notificaciones' ya NO se
// registran aquí — cada uno tiene su propio módulo real que se
// autoregistra al importarse (js/features/drawer/ y
// js/features/social/notificaciones.js). No queda ninguna ruta de
// Drawer pendiente de placeholder por ahora.

async function render(contenedor) {
  inicializarTema();
  pestanaActiva = 'comunidad';
  esAdmin = false;
  perfil = null;

  contenedor.innerHTML = plantillaShell();

  await Promise.all([cargarPerfil(), verificarSiEsAdmin()]);
  suscribirNotificaciones();
  suscribirRealtimeChat();

  activarInteracciones(contenedor);
}

// Registra la pantalla raíz bajo '/home'. Sin esta línea, el router
// no encuentra ninguna función asociada a esa ruta y cae al
// fallback (rutaInicial = '/login'), que es lo que producía el bug
// de quedarse en el login tras un inicio de sesión exitoso.
registrarRuta('/home', render);

function plantillaShell() {
  return `
    <div class="shell">
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

function renderBotonPestana(p) {
  return `
    <button class="shell-tabbar__btn${p.id === 'comunidad' ? ' activa' : ''}" data-tab="${p.id}">
      <span class="shell-tabbar__icono">${p.icono}</span>
    </button>
  `;
}

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
      <a class="drawer-tile drawer-tile--hero" href="#/plantel/historia" style="background-image:url('assets/img/drawer_imagen2.jpg')">
        <span class="drawer-tile__icono">📖</span>
        <span>
          <span class="drawer-tile__label">Un poco de historia</span>
          <span class="drawer-tile__subtitulo">Conoce nuestra trayectoria</span>
        </span>
      </a>
      <a class="drawer-tile drawer-tile--hero" href="#/oferta-educativa" style="background-image:url('assets/img/drawer_imagen3.jpg')">
        <span class="drawer-tile__icono">🎓</span>
        <span>
          <span class="drawer-tile__label">Oferta educativa</span>
          <span class="drawer-tile__subtitulo">Conoce nuestras carreras</span>
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

      <p class="drawer-seccion">COMUNIDAD</p>
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

function inicialAvatar() {
  const nombre = perfil?.nombre ?? '';
  return nombre ? nombre.trim().charAt(0).toUpperCase() : '';
}

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

function actualizarAvatar() {
  const contenedor = document.getElementById('avatar-contenido');
  if (!contenedor) return;
  const url = perfil ? resolverUrlPerfil(perfil) : '';
  contenedor.innerHTML = url ? `<img src="${url}" alt="" />` : inicialAvatar();
}

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

function agregarPestanaAdmin() {
  const barra = document.getElementById('shell-tabbar');
  const contenido = document.getElementById('shell-contenido');
  if (!barra || !contenido || barra.querySelector('[data-tab="admin"]')) return;

  barra.insertAdjacentHTML('beforeend', renderBotonPestana(PESTANA_ADMIN));
  contenido.insertAdjacentHTML('beforeend', `<section class="shell-panel" data-panel="admin"></section>`);
  barra.querySelector('[data-tab="admin"]').addEventListener('click', () => cambiarPestana('admin'));
}

function cambiarPestana(id) {
  if (id === pestanaActiva) return;
  pestanaActiva = id;

  document.querySelectorAll('.shell-tabbar__btn').forEach((btn) => {
    btn.classList.toggle('activa', btn.dataset.tab === id);
  });

  document.querySelectorAll('.shell-panel').forEach((panel) => {
    const activo = panel.dataset.panel === id;
    panel.classList.toggle('visible', activo);
    if (activo && !panel.dataset.montado) montarPanel(panel, id);
  });
}

// Monta el contenido de un panel la primera vez que se muestra.
// 'comunidad' ya tiene módulo real (js/features/social/pantalla-
// principal.js); el resto sigue en marcador de posición hasta que
// se construya cada uno (js/features/perfil/, marketplace/, etc.).
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

const [icono, titulo, subtitulo] = textos[id] ?? ['🚧', 'Próximamente', ''];
renderMarcadorPosicion(panel, { icono, titulo, subtitulo });
}

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

// ─────────────────────────────────────────────────────────────────
// SINCRONIZACIÓN EN TIEMPO REAL DE JAGUARCHAT (realtime-service.js)
//
// Réplica web de dónde arranca RealtimeService.instancia en
// main.dart: en Flutter, AuthGate llama a
// RealtimeService.instancia.iniciar() apenas hay una sesión válida
// (eventos signedIn / tokenRefreshed / initialSession), ANTES de que
// _AuthChecker confirme si la cuenta está activa o suspendida — y lo
// detiene en signedOut.
//
// shell.js es el punto equivalente en la web: solo se monta cuando
// ya hay sesión (ruta '/home', alcanzada tras login exitoso o sesión
// restaurada), así que aquí se engancha un listener de
// onAuthStateChange de supabase-js que replica ese mismo criterio de
// arranque/parada. supabase-js emite 'INITIAL_SESSION' de forma
// síncrona al registrar el listener si ya existe una sesión activa
// — ese único evento cubre tanto el login recién hecho como una
// sesión restaurada al recargar, así que basta con el listener,
// sin necesidad de una llamada manual adicional.
//
// CORRECCIÓN: antes había además una llamada inmediata a
// realtimeService.iniciar() aquí mismo, "por si acaso". Esa llamada
// y el evento 'INITIAL_SESSION' del listener terminaban
// disparándose casi en el mismo instante, y las dos ejecuciones
// concurrentes de iniciar() rompían el canal Realtime (ver el
// comentario de cabecera de realtime-service.js sobre el error
// "cannot add postgres_changes callbacks... after subscribe()").
// Se quitó esa llamada redundante; realtime-service.js además ahora
// serializa internamente cualquier llamada a iniciar()/detener()
// como blindaje adicional.
//
// IMPORTANTE — no mezclar con PresenceService: en Flutter,
// PresenceService.instancia.iniciarPresencia() arranca por separado,
// dentro de _AuthChecker, solo DESPUÉS de confirmar que la cuenta no
// está suspendida/expulsada. Cuando se construya presence-service.js
// para la web, su arranque debe ir en ese punto (después de validar
// estado_cuenta), nunca aquí junto con realtime-service.js.
// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
// SINCRONIZACIÓN EN TIEMPO REAL DE JAGUARCHAT (realtime + presencia)
// [...comentario existente sin cambios...]
//
// PENDIENTE: presence-service.js arranca aquí junto con
// realtime-service.js, bajo el mismo criterio de "sesión válida".
// En Dart, PresenceService espera además a que _AuthChecker confirme
// estado_cuenta activo — esa validación todavía no existe en ningún
// punto de la versión web, así que por ahora presence-service.js
// arranca sin ese filtro (una cuenta suspendida, si llegara a existir
// en la web, se mostraría "en línea" igual que cualquiera). Mover
// este arranque a después de esa validación en cuanto exista.
// ─────────────────────────────────────────────────────────────────
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
      realtimeService.detener();
      presenceService.detenerPresencia();
    }
  });
}

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

function ocultarBanner() {
  const banner = document.getElementById('banner-activo');
  if (!banner) return;
  banner.classList.remove('visible');
  setTimeout(() => banner.remove(), 300);
}

function activarInteracciones(contenedor) {
  contenedor.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => cambiarPestana(btn.dataset.tab));
  });

  const panelInicial = contenedor.querySelector('[data-panel="comunidad"]');
if (panelInicial) {
  panelInicial.classList.add('visible');
  montarPanel(panelInicial, 'comunidad');
}

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

  document.getElementById('switch-tema').addEventListener('change', () => {
    const nuevo = alternarTema();
    document.getElementById('icono-tema').textContent = nuevo === 'dark' ? '🌙' : '☀️';
    document.getElementById('etiqueta-tema').textContent = nuevo === 'dark' ? 'Modo oscuro' : 'Modo claro';
    document.getElementById('logo-appbar').src = `assets/img/appbar_modo_${nuevo === 'dark' ? 'oscuro' : 'claro'}.png`;
  });

  document.getElementById('btn-compartir').addEventListener('click', compartirApp);
}

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