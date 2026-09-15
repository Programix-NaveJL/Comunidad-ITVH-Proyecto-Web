// js/features/ubicatecnm/ubicatecnm.js
//
// Hub principal de "UbicaTecNM". Equivalente web de ubicatecnm.dart.
//
// render(contenedor) — punto de entrada que monta shell.js como una
// sección más (no es ruta de nivel superior del router: vive
// embebida dentro del shell, igual que Marketplace/Mi Perfil).
//
// Al tocar "Mapa interactivo del ITVH" se reemplaza el contenido de
// `contenedor` por mapa-interactivo.js (equivalente del
// Navigator.push del Dart, pero dentro del mismo contenedor en vez
// de una ruta nueva); su botón "‹" hace lo inverso y vuelve a pintar
// este hub llamando render(contenedor) de nuevo.
//
// SUSTITUCIONES respecto al Dart original:
//   • youtube_player_flutter → YouTube IFrame API oficial
//     (https://www.youtube.com/iframe_api), construida de forma
//     lazy igual que en el Dart: antes del tap solo se muestra la
//     miniatura (img.youtube.com, sin costo) con shimmer mientras
//     carga; al tocar se instancia un YT.Player con autoplay=1. Un
//     solo video activo a la vez: al reproducir uno, los demás
//     players se destruyen (player.destroy()) y sus tarjetas vuelven
//     a su miniatura (mismo criterio que el ValueNotifier<String?>
//     compartido).
//   • AnimatedScale + HapticFeedback (_PressScale) → clase CSS
//     .ubica-press con :active { transform: scale(0.97) } — sin
//     haptic, no hay equivalente en navegador de escritorio/web.
//   • AnimationController con anillos de pulso → animación CSS pura
//     (@keyframes) en dos pseudo-elementos, ver ubicatecnm.css.
//
// ═══════════════════════════════════════════════════════════════
// FALLBACK "VIDEO NO DISPONIBLE PARA INSERTAR"
// ═══════════════════════════════════════════════════════════════
// Algunos videos tienen la opción "Permitir insertar" desactivada
// por su dueño en YouTube Studio (o son age-restricted, o fueron
// baneados de embed por Content ID). En esos casos YouTube no deja
// reproducir el video dentro de un <iframe> aunque sí funcione en
// youtube.com directo — y pinta su propia pantalla fea de "Este
// video no está disponible" dentro del iframe.
//
// Usamos la YouTube IFrame API real (YT.Player + evento onError)
// para detectar esto de forma confiable y reemplazar esa tarjeta
// por nuestro propio fallback: "Ver en YouTube" con el estilo de la
// app, en vez de dejar que se vea el diseño default de YouTube.
//
// Códigos de error de la IFrame API (los que nos importan):
//   2   → parámetro inválido en la URL del embed
//   5   → error del reproductor HTML5
//   100 → video no encontrado (borrado o privado)
//   101 / 150 → el dueño desactivó "permitir insertar" para ese
//               video (o es age-restricted) — el más común.

const ACENTO = '#0A84FF';

const VIDEOS_RECREATIVOS = [
    //https://www.youtube.com/watch?v=yaiVJRymK4A
  { titulo: 'Recorrido virtual por el ITVH', videoId: 'yaiVJRymK4A' },
  { titulo: 'Conoce nuestro programa', videoId: '5Ujpf2XjdX8' },
  { titulo: 'Primer día de clases agosto 2023', videoId: 'IlX-h0N-LDs' },
];

let raizPanel = null;
let videoActivoId = null;

// videoId → instancia de YT.Player actualmente montada (para poder
// destruirla al cambiar de video o al salir del hub).
const playersActivos = new Map();

export async function render(contenedor) {
  // Si veníamos de otra visita a este hub (p. ej. volvimos del mapa
  // y regresamos), limpiamos players huérfanos antes de repintar.
  destruirTodosLosPlayers();

  raizPanel = contenedor;
  videoActivoId = null;

  contenedor.innerHTML = plantillaBase();
  activarInteracciones(contenedor);
}

function plantillaBase() {
  return `
    <div class="ubica-hub">
      <div class="ubica-hub__titulo-zona">
        <h1 class="ubica-hub__titulo">UbicaTecNM</h1>
        <h1 class="ubica-hub__titulo ubica-hub__titulo--acento">Campus Villahermosa</h1>
      </div>

      <button class="ubica-hub__boton-mapa ubica-press" data-abrir-mapa>
        <span class="ubica-hub__mapa-icono-zona">
          <span class="ubica-hub__pulso"></span>
          <span class="ubica-hub__pulso ubica-hub__pulso--retraso"></span>
          <span class="ubica-hub__mapa-icono">🗺️</span>
        </span>
        <span class="ubica-hub__mapa-texto">
          <span class="ubica-hub__mapa-titulo">Mapa interactivo del ITVH</span>
          <span class="ubica-hub__mapa-subtitulo">Ubica edificios, accesos y áreas del campus</span>
        </span>
        <span class="ubica-hub__mapa-flecha">›</span>
      </button>

      <div class="ubica-hub__videos-zona">
        <h2 class="ubica-hub__videos-titulo">Videos recreativos</h2>
        <p class="ubica-hub__videos-subtitulo">Conoce el campus a través de estos recorridos</p>

        <div class="ubica-hub__videos-lista">
          ${VIDEOS_RECREATIVOS.map(plantillaTarjetaVideo).join('')}
        </div>
      </div>
    </div>
  `;
}

function plantillaTarjetaVideo(video) {
  return `
    <article class="ubica-video" data-video-id="${video.videoId}">
      <div class="ubica-video__media ubica-press" data-video-miniatura>
        <img class="ubica-video__miniatura" src="https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg" alt="" loading="lazy" />
        <div class="ubica-video__overlay"></div>
        <div class="ubica-video__play">▶</div>
      </div>
      <p class="ubica-video__titulo">${escapar(video.titulo)}</p>
    </article>
  `;
}

// ─────────────────────────────────────────────────────────────
// Fallback visual cuando el embed falla
// ─────────────────────────────────────────────────────────────
function plantillaFallback(videoId, mensaje) {
  return `
    <div class="ubica-video__fallback">
      <p class="ubica-video__fallback-texto">${escapar(mensaje)}</p>
      <a
        class="ubica-video__fallback-boton ubica-press"
        href="https://www.youtube.com/watch?v=${videoId}"
        target="_blank"
        rel="noopener noreferrer"
      >Ver en YouTube ↗</a>
    </div>
  `;
}

function mensajeParaCodigoError(codigo) {
  switch (codigo) {
    case 101:
    case 150:
      return 'Este video no está disponible para reproducirse aquí.';
    case 100:
      return 'Este video ya no está disponible.';
    default:
      return 'No se pudo reproducir este video.';
  }
}

function activarInteracciones(contenedor) {
  contenedor.querySelector('[data-abrir-mapa]').addEventListener('click', async () => {
    destruirTodosLosPlayers();
    const { render: renderMapa } = await import('./mapa-interactivo.js');
    await renderMapa(contenedor, () => render(contenedor));
  });

  contenedor.querySelectorAll('.ubica-video').forEach((tarjeta) => {
    const videoId = tarjeta.dataset.videoId;
    tarjeta.querySelector('[data-video-miniatura]').addEventListener('click', () => reproducirVideo(tarjeta, videoId));
  });
}

// ═══════════════════════════════════════════════════════════════
// YouTube IFrame API — carga perezosa y única, aunque este módulo
// se vuelva a montar varias veces durante la sesión.
// ═══════════════════════════════════════════════════════════════
let promesaApiLista = null;

function cargarYoutubeIframeApi() {
  if (promesaApiLista) return promesaApiLista;

  promesaApiLista = new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT);
      return;
    }

    // onYouTubeIframeAPIReady es un callback global que la propia
    // API busca por nombre en window — puede que otra parte de la
    // app ya lo haya definido, así que encadenamos en vez de pisarlo.
    const anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof anterior === 'function') anterior();
      resolve(window.YT);
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
  });

  return promesaApiLista;
}

async function reproducirVideo(tarjeta, videoId) {
  // Detiene cualquier otro video que estuviera sonando — mismo
  // criterio que el ValueNotifier compartido en el Dart original.
  if (videoActivoId && videoActivoId !== videoId) {
    detenerOtrosVideos(videoId);
  }
  videoActivoId = videoId;

  const media = tarjeta.querySelector('.ubica-video__media');
  const idContenedor = `ubica-yt-${videoId}`;
  media.innerHTML = `<div id="${idContenedor}" class="ubica-video__iframe"></div>`;

  const YT = await cargarYoutubeIframeApi();

  // El usuario pudo haber cambiado de video (o salido del hub)
  // mientras esperábamos a que la API cargara — no montamos un
  // player huérfano si ya no es el video activo.
  if (videoActivoId !== videoId || !document.getElementById(idContenedor)) return;

  const player = new YT.Player(idContenedor, {
    videoId,
    host: 'https://www.youtube-nocookie.com',
    playerVars: {
      autoplay: 1,
      playsinline: 1,
      origin: window.location.origin,
    },
    events: {
      onError: (evento) => {
        console.error(`YouTube – error real reproduciendo ${videoId}: código ${evento.data}`);
        mostrarFallback(tarjeta, videoId, evento.data);
      },
    },
  });

  playersActivos.set(videoId, player);
}

function mostrarFallback(tarjeta, videoId, codigoError) {
  playersActivos.delete(videoId);
  if (videoActivoId === videoId) videoActivoId = null;

  const media = tarjeta.querySelector('.ubica-video__media');
  media.innerHTML = plantillaFallback(videoId, mensajeParaCodigoError(codigoError));
}

function detenerOtrosVideos(videoIdNuevo) {
  raizPanel.querySelectorAll('.ubica-video').forEach((tarjeta) => {
    if (tarjeta.dataset.videoId === videoIdNuevo) return;

    destruirPlayer(tarjeta.dataset.videoId);

    // Si esta tarjeta no tenía nada activo (ni player ni fallback
    // montado), no hace falta tocarla.
    const media = tarjeta.querySelector('.ubica-video__media');
    if (!media.querySelector('.ubica-video__iframe, .ubica-video__fallback')) return;

    media.innerHTML = `
      <img class="ubica-video__miniatura" src="https://img.youtube.com/vi/${tarjeta.dataset.videoId}/hqdefault.jpg" alt="" loading="lazy" />
      <div class="ubica-video__overlay"></div>
      <div class="ubica-video__play">▶</div>
    `;
    // No hace falta reactivar el listener de click: es el mismo
    // elemento .ubica-video__media de activarInteracciones, solo se
    // reemplazó su innerHTML — el listener original sigue vivo.
  });
}

function destruirPlayer(videoId) {
  const player = playersActivos.get(videoId);
  if (!player) return;
  try {
    player.destroy();
  } catch {
    // Si el iframe ya no existe en el DOM, destroy() puede tronar —
    // lo ignoramos, el objetivo (liberar el player) ya se cumplió.
  }
  playersActivos.delete(videoId);
}

function destruirTodosLosPlayers() {
  playersActivos.forEach((player) => {
    try {
      player.destroy();
    } catch {
      // ver nota en destruirPlayer
    }
  });
  playersActivos.clear();
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}