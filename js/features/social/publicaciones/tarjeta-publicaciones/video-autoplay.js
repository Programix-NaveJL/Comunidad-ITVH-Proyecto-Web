// video-autoplay.js
// Ubicación: js/features/social/publicaciones/tarjeta-publicaciones/video-autoplay.js
//
// ═══════════════════════════════════════════════════════════════
// PROPÓSITO
// ═══════════════════════════════════════════════════════════════
// Reproduce automáticamente (y en silencio) los videos del feed
// cuando quedan a la vista al hacer scroll, y los pausa cuando
// salen de pantalla — igual que el feed de Facebook/Instagram.
//
// ═══════════════════════════════════════════════════════════════
// RESPONSABILIDADES
// ═══════════════════════════════════════════════════════════════
//   1. Observar cada <video> registrado con un IntersectionObserver
//      (root = viewport). Funciona aunque quien scrollee sea un
//      contenedor interno (como el panel del feed en escritorio) y
//      no `window`, porque el observer descuenta el recorte de los
//      ancestros con overflow. Tampoco hace falta enganchar
//      listeners de scroll.
//   2. Reproducir SOLO UN video a la vez: el que tenga más píxeles
//      visibles entre los "candidatos" (con histéresis para que no
//      alterne entre dos videos casi igual de visibles).
//   3. Un video es candidato si se ve ≥50% de su área, o si ocupa
//      ≥50% de la altura del viewport (para videos más altos que la
//      pantalla, que nunca llegarían al 50% de su propia área).
//   4. Silencio global: los navegadores solo permiten autoplay si el
//      video está en mute. El botón 🔇/🔊 de cada video cambia el
//      estado para TODOS (como Facebook: si activas el sonido, los
//      siguientes videos siguen con sonido). Si el navegador rechaza
//      reproducir con sonido, se vuelve a mute y se reintenta.
//   5. Pausar cuando la pestaña del navegador se oculta
//      (visibilitychange) y reanudar al volver.
//   6. Respetar el "ahorro de datos" del navegador
//      (navigator.connection.saveData): en ese caso no se hace
//      autoplay y el video se comporta como antes (toque → visor).
//
// Como el observer reporta "no visible" cuando el panel se oculta
// (display:none al cambiar de pestaña) o se desconecta del DOM (el
// shell conserva el feed en memoria al navegar a otra pantalla), los
// videos se pausan solos en esos casos y se reanudan cuando el feed
// vuelve a mostrarse. No requiere ningún gancho en shell.js.
//
// ═══════════════════════════════════════════════════════════════
// CAMBIOS
// ═══════════════════════════════════════════════════════════════
//   - Archivo nuevo. Lo usa galeria-multimedia.js
//     (activarGaleriaMultimedia → registrarVideoAutoplay).
//
// API:
//   registrarVideoAutoplay(celdaEl) — registra el <video> de una celda.
//   pausarVideoActivo()             — pausa el que está sonando y no
//                                     lo reanuda hasta que salga de
//                                     pantalla y vuelva (se usa al
//                                     abrir el visor).
//   pausarAutoplay() / reanudarAutoplay() — corte global por si otro
//                                     módulo (visor, hojas) lo necesita.

const UMBRAL_RATIO = 0.5;            // % del área del video visible
const UMBRAL_ALTURA_VIEWPORT = 0.5;  // % de la altura del viewport que ocupa
const FACTOR_HISTERESIS = 1.15;      // el nuevo debe verse 15% más para "robar" el play

// video → { alturaVisible, pausadoManual }
// WeakMap para no retener videos de tarjetas que ya se quitaron del DOM.
const info = new WeakMap();
// Videos que ahora mismo cumplen el umbral de visibilidad.
const candidatos = new Set();

let observador = null;
let videoActivo = null;
let silenciado = true;
let pausadoGlobal = false;

// ═══════════════════════════════════════════════════════════════
// API PÚBLICA
// ═══════════════════════════════════════════════════════════════

/**
 * Registra el <video> de una celda de la galería para autoplay por
 * visibilidad y engancha su botón de silencio.
 *
 * @param {HTMLElement} celda - .galeria-medios__celda que contiene un .galeria-medios__video.
 */
export function registrarVideoAutoplay(celda) {
  const video = celda.querySelector('.galeria-medios__video');
  if (!video || info.has(video)) return;
  if (navigator.connection?.saveData) return;

  info.set(video, { alturaVisible: 0, pausadoManual: false });

  // La clase --reproduciendo oculta el ▶️ y muestra el botón de sonido.
  const marcar = (reproduciendo) => celda.classList.toggle('galeria-medios__celda--reproduciendo', reproduciendo);
  video.addEventListener('playing', () => marcar(true));
  video.addEventListener('pause', () => marcar(false));
  video.addEventListener('ended', () => marcar(false));

  const boton = celda.querySelector('.galeria-medios__silencio');
  if (boton) {
    const sincronizar = () => {
      boton.textContent = video.muted ? '🔇' : '🔊';
      boton.setAttribute('aria-label', video.muted ? 'Activar sonido' : 'Silenciar');
    };
    video.addEventListener('volumechange', sincronizar);
    sincronizar();
    boton.addEventListener('click', (evento) => {
      evento.stopPropagation(); // que no dispare el click de la celda (abrir visor)
      establecerSilencio(!video.muted);
    });
  }

  obtenerObservador().observe(video);
}

/**
 * Pausa el video que se esté reproduciendo y no lo reanuda solo
 * hasta que salga de pantalla y vuelva a entrar. Úsalo al abrir el
 * visor a pantalla completa.
 */
export function pausarVideoActivo() {
  if (!videoActivo) return;
  const datos = info.get(videoActivo);
  if (datos) datos.pausadoManual = true;
  videoActivo.pause();
  videoActivo = null;
}

/** Corte global del autoplay (p. ej. mientras hay una hoja o visor encima). */
export function pausarAutoplay() {
  pausadoGlobal = true;
  if (videoActivo) {
    videoActivo.pause();
    videoActivo = null;
  }
}

/** Reanuda el autoplay tras pausarAutoplay(). */
export function reanudarAutoplay() {
  pausadoGlobal = false;
  reevaluar();
}

// ═══════════════════════════════════════════════════════════════
// INTERNOS
// ═══════════════════════════════════════════════════════════════

function obtenerObservador() {
  if (observador) return observador;

  // Umbrales cada 5% para recibir actualizaciones mientras se scrollea.
  observador = new IntersectionObserver(alCambiarInterseccion, {
    threshold: Array.from({ length: 21 }, (_, i) => i / 20),
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (videoActivo) {
        videoActivo.pause();
        videoActivo = null;
      }
    } else {
      reevaluar();
    }
  });

  return observador;
}

function alCambiarInterseccion(entradas) {
  entradas.forEach((entrada) => {
    const video = entrada.target;
    const datos = info.get(video);
    if (!datos) return;

    const alturaViewport = entrada.rootBounds?.height || window.innerHeight;
    const alturaVisible = entrada.isIntersecting ? entrada.intersectionRect.height : 0;
    datos.alturaVisible = alturaVisible;

    const suficiente =
      entrada.isIntersecting &&
      (entrada.intersectionRatio >= UMBRAL_RATIO || alturaVisible >= alturaViewport * UMBRAL_ALTURA_VIEWPORT);

    if (suficiente) {
      candidatos.add(video);
    } else {
      candidatos.delete(video);
      datos.pausadoManual = false; // al salir de pantalla se "perdona" la pausa manual
    }
  });
  reevaluar();
}

function reevaluar() {
  if (document.hidden || pausadoGlobal) return;

  let mejor = null;
  let mejorAltura = 0;
  candidatos.forEach((video) => {
    const datos = info.get(video);
    if (!datos || datos.pausadoManual) return;
    if (datos.alturaVisible > mejorAltura) {
      mejor = video;
      mejorAltura = datos.alturaVisible;
    }
  });

  if (videoActivo && videoActivo !== mejor) {
    const datosActivo = info.get(videoActivo);
    const sigueValido = candidatos.has(videoActivo) && datosActivo && !datosActivo.pausadoManual;
    // Histéresis: si el activo sigue siendo válido y el otro no lo supera
    // claramente, se queda el activo (evita parpadeos entre dos videos).
    if (sigueValido && mejorAltura <= datosActivo.alturaVisible * FACTOR_HISTERESIS) return;
    videoActivo.pause();
    videoActivo = null;
  }

  if (mejor && mejor !== videoActivo) {
    videoActivo = mejor;
    reproducir(mejor);
  }
}

async function reproducir(video) {
  video.muted = silenciado;
  try {
    await video.play();
  } catch (error) {
    // Con sonido el navegador puede rechazar el autoplay → volver a mute y reintentar.
    if (error?.name === 'NotAllowedError' && !video.muted) {
      establecerSilencio(true);
      try {
        await video.play();
      } catch {
        /* sin permiso de reproducción: se queda pausado */
      }
    }
    // AbortError (pause() llegó antes de que resolviera play()): se ignora.
  }
}

function establecerSilencio(valor) {
  silenciado = valor;
  // Los videos de un feed conservado en memoria (desconectado del DOM) se
  // sincronizan en reproducir(), que siempre aplica `silenciado`.
  document.querySelectorAll('.galeria-medios__video').forEach((v) => {
    v.muted = valor;
  });
}