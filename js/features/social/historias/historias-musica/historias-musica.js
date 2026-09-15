// historias-musica.js
// Ruta real: js/features/social/historias/historias-musica/historias-musica.js
//
// Puerto de historias_musica.dart (EditarHistoriaMusicaScreen). Al
// entrar, abre de inmediato el selector de canciones (seleccionar-
// musica.js, como hoja modal). Elegida la canción, el usuario elige
// sus 15 segundos dentro del preview de hasta 30s (selector de
// fragmento con "waveform" arrastrable) y decide entre 2 formatos
// visuales de fondo:
//   • Vinilo  — disco completo girando con la carátula incrustada
//               circular en el centro (label del disco).
//   • Tarjeta — carátula cuadrada al frente con el disco asomando
//               girando por detrás.
//
// Debajo del arte se muestra título/artista SOLO como vista previa
// en pantalla — igual que en el Dart, VerHistoria ya dibuja ese
// texto en vivo leyendo track_titulo/track_artista de Supabase
// (ver mapearPistaASupabase en pista-musical.js), así que hornearlo
// aquí también lo duplicaría.
//
// DIFERENCIA DE PLATAFORMA — RepaintBoundary → dos capas, mismo
// criterio que historias-texto.js:
//   1. VISTA EN VIVO: disco/carátula animados con CSS (rotación
//      continua vía @keyframes + animation-play-state), sin canvas.
//   2. CAPTURA (al tocar OK): se vuelve a dibujar el arte —fondo
//      difuminado + disco o carátula+disco— en un <canvas> oculto de
//      1080×1920 (mismo estándar de historia 9:16 que historias-
//      texto.js), congelado en un ángulo fijo (0°) sin importar en
//      qué punto de la rotación se tocó OK — es una imagen estática
//      de fondo, no se nota la diferencia de ángulo en el resultado.
//
// DIFERENCIA DE PLATAFORMA — carátula por <canvas>: dibujar una
// imagen de red en canvas y luego exportarla (toBlob) requiere que
// el servidor de esa imagen mande cabeceras CORS permisivas o el
// canvas queda "tainted" y la captura falla en silencio. Se intenta
// cargar con crossOrigin="anonymous"; si falla, se cae a un fondo
// sólido sin la carátula (mismo criterio de "degradar con gracia"
// que ya usa notificaciones.js para sus miniaturas de video).
//
// DIFERENCIA DE PLATAFORMA — Random(seed) de Dart: no existe un PRNG
// con seed en JS estándar; se usa un generador mulberry32 propio
// (ver seededRandom) para que el mismo track_id siempre genere el
// mismo "waveform" falso, igual que el original.
//
// A DÓNDE LLEVA: abrirPublicarHistoria() con el PNG capturado más
// trackElegido (ya mapeado a columnas de Supabase) y trackInicioMs.

import { registrarRuta } from '../../../../core/router.js';
import { mostrarToast } from '../../../../core/toast.js';
import { abrirPublicarHistoria } from '../publicar-historia.js';
import { abrirSeleccionarMusica } from '../servicio-musica/seleccionar-musica.js';
import { mapearPistaASupabase } from '../servicio-musica/pista-musical.js';

const DURACION_FRAGMENTO_MS = 15000;
const ANCHO_CANVAS = 1080;
const ALTO_CANVAS = 1920; // 9:16 — misma ASUNCIÓN que historias-texto.js

function render(contenedor) {
  const state = {
    track: null,
    inicioMs: 0,
    duracionPreviewMs: 30000,
    ventanaPos: 0.0,
    alturas: [],
    estilo: 'vinilo', // 'vinilo' | 'tarjeta'
    reproduciendo: false,
    imagenLista: false,
    publicando: false,
  };

  const audio = new Audio();
  audio.preload = 'auto';

  contenedor.innerHTML = plantilla();
  const els = {
    fondo:       contenedor.querySelector('[data-hm-fondo]'),
    arte:        contenedor.querySelector('[data-hm-arte]'),
    preview:     contenedor.querySelector('[data-hm-preview]'),
    spinner:     contenedor.querySelector('[data-hm-spinner]'),
    cerrar:      contenedor.querySelector('[data-hm-cerrar]'),
    ok:          contenedor.querySelector('[data-hm-ok]'),
    playPause:   contenedor.querySelector('[data-hm-play-pause]'),
    fragmento:   contenedor.querySelector('[data-hm-fragmento]'),
    estiloZona:  contenedor.querySelector('[data-hm-estilo]'),
  };

  // ── Selector de canción — se abre de inmediato al montar ──────
  (async () => {
    const resultado = await abrirSeleccionarMusica();
    if (!resultado) {
      window.history.back();
      return;
    }
    state.track = resultado.track;
    state.inicioMs = 0;
    state.ventanaPos = 0;
    state.duracionPreviewMs = 30000;
    state.alturas = generarWaveform(resultado.track.id);
    state.imagenLista = false;

    renderArte(els, state);
    renderEstilos(els, state);

    await precargarCover(state.track.cover);
    state.imagenLista = true;
    els.spinner.hidden = true;
    renderPreviewTexto(els, state);
    renderOk(els, state);

    await iniciarAudio();
  })();

  // ── Audio: reproduce y hace loop dentro del fragmento elegido ──

  async function iniciarAudio() {
    if (!state.track) return;
    try {
      audio.src = state.track.previewUrl;
      audio.currentTime = state.inicioMs / 1000;
      await audio.play();
      state.reproduciendo = true;
      renderControlesAudio(els, state);
      els.arte.classList.remove('hm-pausado');
    } catch (error) {
      console.error('historias-musica – audio:', error);
    }
  }

  audio.addEventListener('loadedmetadata', () => {
    if (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0) {
      state.duracionPreviewMs = audio.duration * 1000;
      renderFragmento(els, state, acciones);
    }
  });

  // Loop dentro de los 15s elegidos — equivalente al positionStream
  // del Dart, sobre el evento nativo 'timeupdate'.
  audio.addEventListener('timeupdate', () => {
    const finMs = state.inicioMs + DURACION_FRAGMENTO_MS;
    if (audio.currentTime * 1000 >= finMs) {
      audio.currentTime = state.inicioMs / 1000;
    }
  });

  function maxInicioMs() {
    return Math.max(0, state.duracionPreviewMs - DURACION_FRAGMENTO_MS);
  }

  // ── Waveform "falso" pero estable — mismo track_id siempre da
  // las mismas barras (ver nota de DIFERENCIA DE PLATAFORMA arriba).
  function generarWaveform(seed) {
    const rand = seededRandom(seed);
    return Array.from({ length: 48 }, () => clamp(0.18 + rand() * 0.75, 0.12, 1.0));
  }

  // ── Arrastrar el selector de fragmento ─────────────────────────
  async function onVentanaMovida(nuevaPos) {
    state.ventanaPos = clamp(nuevaPos, 0, 1);
    state.inicioMs = Math.round(state.ventanaPos * maxInicioMs());
    renderFragmento(els, state, acciones);

    audio.currentTime = state.inicioMs / 1000;
    if (audio.paused) {
      try {
        await audio.play();
        state.reproduciendo = true;
        els.arte.classList.remove('hm-pausado');
        renderControlesAudio(els, state);
      } catch (error) {
        console.error('historias-musica – reanudar:', error);
      }
    }
  }

  const acciones = {
    onVentanaMovida,
    async toggleAudio() {
      if (!audio.paused) {
        audio.pause();
        state.reproduciendo = false;
        els.arte.classList.add('hm-pausado');
      } else {
        try {
          await audio.play();
          state.reproduciendo = true;
          els.arte.classList.remove('hm-pausado');
        } catch (error) {
          console.error('historias-musica – toggleAudio:', error);
        }
      }
      renderControlesAudio(els, state);
    },
    cambiarEstilo(estilo) {
      if (state.estilo === estilo) return;
      state.estilo = estilo;
      renderArte(els, state);
      renderEstilos(els, state);
    },
  };

  els.cerrar.addEventListener('click', () => {
    audio.pause();
    window.history.back();
  });

  els.ok.addEventListener('click', () => confirmarYPublicar());

  // ── Captura + publicación ─────────────────────────────────────

  async function confirmarYPublicar() {
    if (!state.track || state.publicando || !state.imagenLista) return;

    state.publicando = true;
    audio.pause();
    els.arte.classList.add('hm-pausado');
    renderOk(els, state);

    const blob = await capturarComoPng(state);
    if (!blob) {
      state.publicando = false;
      renderOk(els, state);
      mostrarToast('No se pudo generar la imagen. Intenta de nuevo.', 'error');
      return;
    }

    const archivo = new File([blob], 'historia.png', { type: 'image/png' });

    const publicada = await abrirPublicarHistoria({
      archivo,
      trackElegido: mapearPistaASupabase(state.track),
      trackInicioMs: state.inicioMs,
    });

    if (publicada) {
      window.history.back();
      return;
    }

    state.publicando = false;
    renderOk(els, state);
    try {
      await audio.play();
      state.reproduciendo = true;
      els.arte.classList.remove('hm-pausado');
      renderControlesAudio(els, state);
    } catch (error) {
      console.error('historias-musica – reanudar tras cancelar:', error);
    }
  }

  renderFragmento(els, state, acciones);
}

registrarRuta('/historia-musica', render);

// ═══════════════════════════════════════════════════════════════
// TEMPLATE
// ═══════════════════════════════════════════════════════════════

function plantilla() {
  return `
    <div class="historia-musica">
      <div class="historia-musica__fondo" data-hm-fondo></div>
      <div class="historia-musica__arte hm-pausado" data-hm-arte></div>
      <div class="historia-musica__spinner" data-hm-spinner><span class="btn-spinner"></span></div>
      <div class="historia-musica__preview" data-hm-preview hidden></div>

      <div class="historia-musica__header">
        <button class="historia-musica__btn-circular" data-hm-cerrar aria-label="Cerrar">✕</button>
        <button class="historia-musica__btn-ok" data-hm-ok disabled>OK</button>
      </div>

      <div class="historia-musica__controles">
        <button class="historia-musica__play-pause" data-hm-play-pause aria-label="Reproducir/pausar">▶️</button>
        <div class="historia-musica__fragmento" data-hm-fragmento></div>
      </div>

      <div class="historia-musica__estilos" data-hm-estilo></div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// RENDER — arte (vinilo / tarjeta)
// ═══════════════════════════════════════════════════════════════

function renderArte(els, state) {
  const track = state.track;
  if (!track) return;

  els.fondo.style.backgroundImage = track.cover ? `url('${track.cover}')` : '';
  els.fondo.classList.toggle('historia-musica__fondo--vacio', !track.cover);

  if (state.estilo === 'vinilo') {
    els.arte.innerHTML = `
      <div class="hm-vinilo">
        <div class="hm-vinilo__resplandor"></div>
        <div class="hm-vinilo__disco">
          <div class="hm-vinilo__surcos"></div>
          <div class="hm-vinilo__label">
            ${track.cover ? `<img src="${track.cover}" alt="" />` : '<span class="hm-vinilo__label-icono">🎵</span>'}
          </div>
          <div class="hm-vinilo__hoyo"></div>
        </div>
      </div>
    `;
  } else {
    els.arte.innerHTML = `
      <div class="hm-tarjeta">
        <div class="hm-tarjeta__disco">
          <div class="hm-tarjeta__surcos"></div>
        </div>
        <div class="hm-tarjeta__caratula">
          ${track.cover ? `<img src="${track.cover}" alt="" />` : '<span class="hm-tarjeta__caratula-icono">🎵</span>'}
        </div>
      </div>
    `;
  }
}

function renderPreviewTexto(els, state) {
  const track = state.track;
  if (!track) return;
  els.preview.hidden = false;
  els.preview.innerHTML = `
    <p class="historia-musica__preview-titulo">${escaparHtml(track.titulo)}</p>
    <p class="historia-musica__preview-artista">${escaparHtml(track.artista)}</p>
  `;
}

function renderEstilos(els, state) {
  els.estiloZona.innerHTML = `
    <button class="historia-musica__btn-estilo${state.estilo === 'vinilo' ? ' activo' : ''}" data-estilo="vinilo" aria-label="Estilo vinilo">💿</button>
    <button class="historia-musica__btn-estilo${state.estilo === 'tarjeta' ? ' activo' : ''}" data-estilo="tarjeta" aria-label="Estilo tarjeta">▫️</button>
  `;
}

function renderOk(els, state) {
  const habilitado = state.imagenLista && !state.publicando;
  els.ok.disabled = !habilitado;
  els.ok.classList.toggle('deshabilitado', !habilitado);
  els.ok.innerHTML = state.publicando ? '<span class="btn-spinner btn-spinner--chico"></span>' : 'OK';
}

function renderControlesAudio(els, state) {
  els.playPause.textContent = state.reproduciendo ? '⏸️' : '▶️';
}

// ═══════════════════════════════════════════════════════════════
// RENDER — selector de fragmento (waveform arrastrable)
// ═══════════════════════════════════════════════════════════════

function renderFragmento(els, state, acciones) {
  const fraccionVentana = clamp(DURACION_FRAGMENTO_MS / state.duracionPreviewMs, 0.05, 1.0);
  const finMs = state.inicioMs + DURACION_FRAGMENTO_MS;

  els.fragmento.innerHTML = `
    <p class="historia-musica__fragmento-tiempo">${formatSeg(Math.floor(state.inicioMs / 1000))} – ${formatSeg(Math.floor(finMs / 1000))}</p>
    <div class="historia-musica__barra" data-hm-barra>
      <div class="historia-musica__barras-fondo">
        ${state.alturas
          .map((h, i) => {
            const posFraccion = i / state.alturas.length;
            const enVentana = posFraccion >= state.ventanaPos * (1 - fraccionVentana) && posFraccion <= state.ventanaPos * (1 - fraccionVentana) + fraccionVentana;
            return `<div class="historia-musica__barrita${enVentana ? ' en-ventana' : ''}" style="height:${Math.round(h * 100)}%"></div>`;
          })
          .join('')}
      </div>
      <div class="historia-musica__ventana" style="left:${state.ventanaPos * (1 - fraccionVentana) * 100}%;width:${fraccionVentana * 100}%"></div>
    </div>
  `;

  const elBarra = els.fragmento.querySelector('[data-hm-barra]');
  activarDragFragmento(elBarra, fraccionVentana, acciones);

  els.playPause.onclick = acciones.toggleAudio;
}

function activarDragFragmento(elBarra, fraccionVentana, acciones) {
  let arrastrando = false;

  function calcularPosDesdeEvento(evento) {
    const rect = elBarra.getBoundingClientRect();
    const anchoVentanaPx = rect.width * fraccionVentana;
    const maxOffsetX = Math.max(0, rect.width - anchoVentanaPx);
    if (maxOffsetX <= 0) return 0;
    const x = evento.clientX - rect.left - anchoVentanaPx / 2;
    return clamp(x / maxOffsetX, 0, 1);
  }

  elBarra.addEventListener('pointerdown', (evento) => {
    arrastrando = true;
    elBarra.setPointerCapture(evento.pointerId);
    acciones.onVentanaMovida(calcularPosDesdeEvento(evento));
  });
  elBarra.addEventListener('pointermove', (evento) => {
    if (!arrastrando) return;
    acciones.onVentanaMovida(calcularPosDesdeEvento(evento));
  });
  elBarra.addEventListener('pointerup', () => {
    arrastrando = false;
  });
  elBarra.addEventListener('pointercancel', () => {
    arrastrando = false;
  });
}

// ═══════════════════════════════════════════════════════════════
// Precarga de carátula — evita capturar el canvas antes de que la
// imagen termine de bajar (equivalente a precacheImage del Dart).
// ═══════════════════════════════════════════════════════════════

function precargarCover(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve();
      return;
    }
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => {
      console.error('historias-musica – no se pudo precargar la carátula');
      resolve();
    };
    img.src = url;
  });
}

// ═══════════════════════════════════════════════════════════════
// Captura del lienzo → PNG (SOLO arte visual, sin texto — ver header)
// ═══════════════════════════════════════════════════════════════

async function capturarComoPng(state) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = ANCHO_CANVAS;
    canvas.height = ALTO_CANVAS;
    const ctx = canvas.getContext('2d');

    const cover = state.track.cover ? await cargarImagenParaCanvas(state.track.cover) : null;

    dibujarFondoDifuminado(ctx, cover);

    if (state.estilo === 'vinilo') {
      dibujarVinilCompleto(ctx, cover);
    } else {
      dibujarCaratulaConDisco(ctx, cover);
    }

    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  } catch (error) {
    console.error('historias-musica – error captura:', error);
    return null;
  }
}

// Intenta cargar la imagen con CORS habilitado (necesario para poder
// exportar el canvas después) — si el servidor de la carátula no
// manda las cabeceras adecuadas, se resuelve null y se sigue con un
// fondo sólido (ver nota de DIFERENCIA DE PLATAFORMA al inicio).
function cargarImagenParaCanvas(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function dibujarFondoDifuminado(ctx, cover) {
  if (!cover) {
    ctx.fillStyle = '#1C1C1E';
    ctx.fillRect(0, 0, ANCHO_CANVAS, ALTO_CANVAS);
    return;
  }
  // 'cover' fit, centrado — sin filtro de blur real (no disponible en
  // todos los navegadores para canvas 2D de forma consistente): se
  // aproxima oscureciendo con un overlay semitransparente, mismo
  // efecto visual que busca el difuminado del Dart.
  dibujarImagenCover(ctx, cover, 0, 0, ANCHO_CANVAS, ALTO_CANVAS);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, ANCHO_CANVAS, ALTO_CANVAS);
}

function dibujarImagenCover(ctx, img, x, y, w, h) {
  const escala = Math.max(w / img.width, h / img.height);
  const anchoDestino = img.width * escala;
  const altoDestino = img.height * escala;
  const dx = x + (w - anchoDestino) / 2;
  const dy = y + (h - altoDestino) / 2;
  ctx.drawImage(img, dx, dy, anchoDestino, altoDestino);
}

function dibujarVinilCompleto(ctx, cover) {
  const cx = ANCHO_CANVAS / 2;
  const cy = ALTO_CANVAS / 2;
  const diametro = ANCHO_CANVAS * 0.72;
  const radio = diametro / 2;

  dibujarDiscoConSurcos(ctx, cx, cy, radio);

  // Carátula como label circular incrustado.
  if (cover) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radio * 0.5, 0, Math.PI * 2);
    ctx.clip();
    dibujarImagenCover(ctx, cover, cx - radio * 0.5, cy - radio * 0.5, radio, radio);
    ctx.restore();
  } else {
    ctx.fillStyle = '#3A3A3C';
    ctx.beginPath();
    ctx.arc(cx, cy, radio * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hoyo central.
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(cx, cy, radio * 0.045, 0, Math.PI * 2);
  ctx.fill();
}

function dibujarCaratulaConDisco(ctx, cover) {
  const cx = ANCHO_CANVAS / 2;
  const cy = ALTO_CANVAS / 2;
  const ladoCaratula = ANCHO_CANVAS * 0.42;
  const radioDisco = ANCHO_CANVAS * 0.32;

  // Disco asomando por detrás, a la derecha.
  dibujarDiscoConSurcos(ctx, cx + ladoCaratula * 0.32, cy, radioDisco);

  // Carátula al frente, a la izquierda.
  const x = cx - ladoCaratula * 0.62;
  const y = cy - ladoCaratula / 2;
  if (cover) {
    ctx.save();
    redondearRect(ctx, x, y, ladoCaratula, ladoCaratula, 24);
    ctx.clip();
    dibujarImagenCover(ctx, cover, x, y, ladoCaratula, ladoCaratula);
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    redondearRect(ctx, x, y, ladoCaratula, ladoCaratula, 24);
    ctx.fill();
  }
}

// Disco negro con surcos concéntricos — sin ningún asset de imagen,
// mismo criterio que _VinilPainter del Dart (todo generado por código).
function dibujarDiscoConSurcos(ctx, cx, cy, radio) {
  const gradiente = ctx.createRadialGradient(cx, cy, 0, cx, cy, radio);
  gradiente.addColorStop(0, '#2C2C2E');
  gradiente.addColorStop(0.7, '#000000');
  gradiente.addColorStop(1, '#1C1C1E');
  ctx.fillStyle = gradiente;
  ctx.beginPath();
  ctx.arc(cx, cy, radio, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1.2;
  for (let r = radio * 0.4; r < radio * 0.95; r += radio * 0.08) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#3A3A3C';
  ctx.beginPath();
  ctx.arc(cx, cy, radio * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(cx, cy, radio * 0.03, 0, Math.PI * 2);
  ctx.fill();
}

function redondearRect(ctx, x, y, w, h, radio) {
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + w, y, x + w, y + h, radio);
  ctx.arcTo(x + w, y + h, x, y + h, radio);
  ctx.arcTo(x, y + h, x, y, radio);
  ctx.arcTo(x, y, x + w, y, radio);
  ctx.closePath();
}

// ═══════════════════════════════════════════════════════════════
// Utilidades
// ═══════════════════════════════════════════════════════════════

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function formatSeg(seg) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// PRNG con seed (mulberry32) — mismo criterio que Random(seed) de
// Dart: el mismo track_id siempre genera el mismo "waveform".
function seededRandom(seed) {
  let a = seed >>> 0 || 1;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}