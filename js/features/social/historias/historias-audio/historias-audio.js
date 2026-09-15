// historias-audio.js
// Ruta real: js/features/social/historias/historias-audio/historias-audio.js
//
// Puerto de historias_audio.dart (EditarHistoriaAudioScreen). El
// usuario graba un mensaje de voz sobre un fondo de color/degradado,
// igual que el estado de voz de WhatsApp. Un solo toque sobre el
// micrófono arranca/detiene la grabación (máx. 60s); al detenerse,
// pasa a modo preview (reproducir/regrabar) antes de publicar.
//
// DIFERENCIA DE PLATAFORMA — record/just_audio → MediaRecorder/
// <audio>: el navegador no tiene un formato de grabación tan
// controlable como AudioEncoder.aacLc de record. Se usa
// MediaRecorder sobre el stream de getUserMedia({audio:true}), que
// en la gran mayoría de navegadores produce audio/webm (Opus) — el
// archivo resultante es .webm, no .m4a. publicar-historia.js ya
// asume esto en su flujo de audioConFondo (ver storage-service.js).
//
// DIFERENCIA DE PLATAFORMA — Directory.systemTemp / File → Blob en
// memoria: no hay sistema de archivos temporal en el navegador; el
// audio grabado se mantiene como Blob en el estado del módulo hasta
// que se publica o se descarta (regrabar), sin escribir a disco.
//
// DIFERENCIA DE PLATAFORMA — Permission.microphone → getUserMedia:
// el navegador combina "pedir permiso" y "obtener el stream" en una
// sola llamada; un catch distingue el rechazo del usuario de otros
// errores (dispositivo sin micrófono, etc.).
//
// ONDA DE VOZ REAL: mientras se graba, un AnalyserNode (Web Audio
// API) sobre el stream del micrófono muestrea la amplitud cada
// MUESTRA_INTERVALO_MS y la guarda en state.muestras — no es una
// animación decorativa, las barras responden al volumen real de la
// voz grabada. Al detener la grabación, ese arreglo completo se
// "downsamplea" a un número fijo de barras (BARRAS_ESTATICAS) para
// pintar una onda estática tipo nota de voz de WhatsApp durante el
// preview, con las barras ya reproducidas resaltadas según el avance
// de audioPreviewEl.currentTime.
//
// El pulso animado alrededor del botón de micrófono mientras se
// graba se resuelve con una animación CSS infinita (clase
// .historia-audio__mic--grabando en historia-audio.css) en vez de un
// AnimationController — no hay necesidad de tocarlo desde JS más
// allá de agregar/quitar la clase. El disco girando durante la
// publicación (.historia-audio__disco-girando) es el mismo criterio:
// solo una clase CSS con @keyframes, sin lógica de animación en JS.

import { registrarRuta, navegarA } from '../../../../core/router.js';
import { mostrarToast } from '../../../../core/toast.js';
import { FONDOS_HISTORIA } from './fondos-historia.js';
import { abrirPublicarHistoriaAudioConFondo } from '../publicar-historia.js';

const MAX_DURACION_SEGUNDOS = 60;
const MUESTRA_INTERVALO_MS = 100;
const BARRAS_VIVAS = 32; // ventana visible mientras se graba (scroll)
const BARRAS_ESTATICAS = 40; // barras fijas del preview ya grabado
const ACCENT = '#0A84FF';

function render(contenedor) {
  const state = {
    estado: 'idle', // 'idle' | 'grabando' | 'grabado'
    fondoIndex: 0,
    audioBlob: null,
    audioUrl: null,
    duracionMs: 0,
    reproduciendo: false,
    publicando: false,
    muestras: [], // amplitud (0–1) muestreada durante toda la grabación
    muestrasEstaticas: null, // downsample fijo, calculado al detener
  };

  let mediaRecorder = null;
  let mediaStream = null;
  let chunks = [];
  let inicioGrabacion = null;
  let timerGrabacion = null;
  let audioPreviewEl = null;

  let audioCtx = null;
  let analyser = null;
  let datosAnalyser = null;

  contenedor.innerHTML = plantilla();
  const els = {
    fondo: contenedor.querySelector('[data-ha-fondo]'),
    central: contenedor.querySelector('[data-ha-central]'),
    selectorFondo: contenedor.querySelector('[data-ha-selector-fondo]'),
    barraInferior: contenedor.querySelector('[data-ha-barra-inferior]'),
  };

  aplicarFondo();
  renderCentral();
  renderSelectorFondo();
  renderBarraInferior();

  contenedor.querySelector('[data-ha-cerrar]').addEventListener('click', () => {
    limpiar();
    window.history.back();
  });

  // ── Fondo ────────────────────────────────────────────────────

  function aplicarFondo() {
    els.fondo.style.background = cssFondoInline(FONDOS_HISTORIA[state.fondoIndex]);
  }

  function cssFondoInline(fondo) {
    return fondo.colores.length > 1 ? `linear-gradient(135deg, ${fondo.colores.join(', ')})` : fondo.colores[0];
  }

  // ── Grabación ────────────────────────────────────────────────

  async function iniciarGrabacion() {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      console.error('historias-audio – getUserMedia:', error);
      mostrarToast('Se necesita permiso de micrófono', 'error');
      return;
    }

    chunks = [];
    try {
      mediaRecorder = new MediaRecorder(mediaStream);
    } catch (error) {
      console.error('historias-audio – MediaRecorder:', error);
      mostrarToast('Este navegador no puede grabar audio', 'error');
      detenerStream();
      return;
    }

    mediaRecorder.ondataavailable = (evento) => {
      if (evento.data.size > 0) chunks.push(evento.data);
    };

    iniciarAnalizadorAmplitud();

    mediaRecorder.start();
    inicioGrabacion = Date.now();
    state.estado = 'grabando';
    state.duracionMs = 0;
    state.muestras = [];
    renderCentral();
    renderSelectorFondo();
    renderBarraInferior();

    timerGrabacion = setInterval(() => {
      state.duracionMs = Date.now() - inicioGrabacion;
      state.muestras.push(leerAmplitud());
      renderCentral();
      if (state.duracionMs / 1000 >= MAX_DURACION_SEGUNDOS) detenerGrabacion();
    }, MUESTRA_INTERVALO_MS);
  }

  function detenerGrabacion() {
    if (state.estado !== 'grabando' || !mediaRecorder) return;
    clearInterval(timerGrabacion);
    detenerAnalizadorAmplitud();

    mediaRecorder.onstop = () => {
      state.audioBlob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      state.audioUrl = URL.createObjectURL(state.audioBlob);
      state.muestrasEstaticas = downsample(state.muestras, BARRAS_ESTATICAS);
      state.estado = 'grabado';
      detenerStream();
      renderCentral();
      renderSelectorFondo();
      renderBarraInferior();
    };
    mediaRecorder.stop();
  }

  function detenerStream() {
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  function toggleGrabacion() {
    if (state.estado === 'idle') iniciarGrabacion();
    else if (state.estado === 'grabando') detenerGrabacion();
  }

  // ── Amplitud en vivo (Web Audio AnalyserNode) ─────────────────
  //
  // No se conecta el analyser a audioCtx.destination — solo lee el
  // stream, nunca lo reproduce, para no generar eco del propio
  // micrófono.
  function iniciarAnalizadorAmplitud() {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const fuente = audioCtx.createMediaStreamSource(mediaStream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      datosAnalyser = new Uint8Array(analyser.frequencyBinCount);
      fuente.connect(analyser);
    } catch (error) {
      console.error('historias-audio – analyser:', error);
      analyser = null;
    }
  }

  function detenerAnalizadorAmplitud() {
    audioCtx?.close().catch(() => {});
    audioCtx = null;
    analyser = null;
    datosAnalyser = null;
  }

  /** Amplitud RMS normalizada (0–1, amplificada un poco para que se
   * note visualmente) del frame de audio actual. */
  function leerAmplitud() {
    if (!analyser || !datosAnalyser) return 0;
    analyser.getByteTimeDomainData(datosAnalyser);
    let suma = 0;
    for (let i = 0; i < datosAnalyser.length; i++) {
      const v = (datosAnalyser[i] - 128) / 128;
      suma += v * v;
    }
    const rms = Math.sqrt(suma / datosAnalyser.length);
    return Math.min(1, rms * 4);
  }

  /** Reduce un arreglo de muestras a [cantidad] barras promediando
   * por tramos — mismo criterio que un waveform de nota de voz. */
  function downsample(muestras, cantidad) {
    if (muestras.length === 0) return new Array(cantidad).fill(0.05);
    const resultado = [];
    const tamanoTramo = muestras.length / cantidad;
    for (let i = 0; i < cantidad; i++) {
      const inicio = Math.floor(i * tamanoTramo);
      const fin = Math.max(inicio + 1, Math.floor((i + 1) * tamanoTramo));
      const tramo = muestras.slice(inicio, fin);
      const promedio = tramo.reduce((a, b) => a + b, 0) / tramo.length;
      resultado.push(promedio);
    }
    return resultado;
  }

  // ── Preview local ────────────────────────────────────────────

  function togglePreview() {
    if (!state.audioUrl) return;

    if (!audioPreviewEl) {
      audioPreviewEl = new Audio(state.audioUrl);
      audioPreviewEl.addEventListener('play', () => {
        state.reproduciendo = true;
        renderCentral();
      });
      audioPreviewEl.addEventListener('pause', () => {
        state.reproduciendo = false;
        renderCentral();
      });
      audioPreviewEl.addEventListener('timeupdate', () => {
        if (state.reproduciendo) renderCentral();
      });
      audioPreviewEl.addEventListener('ended', () => {
        audioPreviewEl.currentTime = 0;
        state.reproduciendo = false;
        renderCentral();
      });
    }

    if (state.reproduciendo) audioPreviewEl.pause();
    else audioPreviewEl.play().catch((error) => console.error('historias-audio – preview:', error));
  }

  function regrabar() {
    audioPreviewEl?.pause();
    audioPreviewEl = null;
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    state.estado = 'idle';
    state.audioBlob = null;
    state.audioUrl = null;
    state.duracionMs = 0;
    state.reproduciendo = false;
    state.muestras = [];
    state.muestrasEstaticas = null;
    renderCentral();
    renderSelectorFondo();
    renderBarraInferior();
  }

  // ── Publicar ─────────────────────────────────────────────────

  async function irAPublicar() {
    if (!state.audioBlob || state.publicando) return;
    audioPreviewEl?.pause();

    state.publicando = true;
    renderBarraInferior();

    const publicada = await abrirPublicarHistoriaAudioConFondo({
      audioBlob: state.audioBlob,
      coloresFondo: FONDOS_HISTORIA[state.fondoIndex].colores,
    });

    state.publicando = false;

    if (publicada) {
      limpiar();
      window.history.back();
    } else {
      renderBarraInferior();
    }
  }

  function limpiar() {
    clearInterval(timerGrabacion);
    detenerStream();
    detenerAnalizadorAmplitud();
    audioPreviewEl?.pause();
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  }

  // ── Render ───────────────────────────────────────────────────

  function renderCentral() {
    if (state.estado === 'idle') {
      els.central.innerHTML = botonMic(false);
    } else if (state.estado === 'grabando') {
      const vivas = state.muestras.slice(-BARRAS_VIVAS);
      const relleno = new Array(Math.max(0, BARRAS_VIVAS - vivas.length)).fill(0.04);
      els.central.innerHTML = `
        ${botonMic(true)}
        <div class="historia-audio__onda">${barrasHtml([...relleno, ...vivas], vivas.length + relleno.length)}</div>
        <p class="historia-audio__tiempo">${formatearDuracion(state.duracionMs)}</p>
      `;
    } else {
      const total = state.muestrasEstaticas?.length ?? BARRAS_ESTATICAS;
      const duracionTotalSeg = audioPreviewEl?.duration || state.duracionMs / 1000 || 1;
      const progresoSeg = state.reproduciendo ? audioPreviewEl?.currentTime ?? 0 : 0;
      const activas = Math.round((progresoSeg / duracionTotalSeg) * total);

      els.central.innerHTML = `
        <button class="historia-audio__preview-btn" data-ha-preview aria-label="Reproducir">
          ${state.reproduciendo ? '⏸️' : '▶️'}
        </button>
        <div class="historia-audio__onda historia-audio__onda--estatica">${barrasHtml(state.muestrasEstaticas ?? [], activas)}</div>
        <p class="historia-audio__tiempo historia-audio__tiempo--chico">${formatearDuracion(state.duracionMs)}</p>
      `;
      els.central.querySelector('[data-ha-preview]').addEventListener('click', togglePreview);
    }

    els.central.querySelector('[data-ha-mic]')?.addEventListener('click', toggleGrabacion);
  }

  /** Dibuja cada muestra como una barra vertical; las primeras
   * [activas] barras se pintan resaltadas (grabadas/ya reproducidas),
   * el resto en tono apagado. */
  function barrasHtml(muestras, activas) {
    return muestras
      .map((amp, i) => {
        const alturaPct = Math.round(15 + Math.min(1, amp) * 85);
        const activa = i < activas;
        return `<span class="historia-audio__barra${activa ? ' historia-audio__barra--activa' : ''}" style="height:${alturaPct}%"></span>`;
      })
      .join('');
  }

  function botonMic(grabando) {
    return `
      <button class="historia-audio__mic${grabando ? ' historia-audio__mic--grabando' : ''}" data-ha-mic aria-label="${grabando ? 'Detener' : 'Grabar'}">
        ${grabando ? '⏹️' : '🎙️'}
      </button>
    `;
  }

  function renderSelectorFondo() {
    const habilitado = state.estado !== 'grabando';
    els.selectorFondo.classList.toggle('historia-audio__selector-fondo--deshabilitado', !habilitado);
    els.selectorFondo.innerHTML = FONDOS_HISTORIA.map(
      (f, i) => `
        <button class="historia-audio__swatch${i === state.fondoIndex ? ' historia-audio__swatch--sel' : ''}"
                data-ha-fondo-idx="${i}"
                style="background:${cssFondoInline(f)}"
                aria-label="${f.id}"></button>
      `
    ).join('');

    if (habilitado) {
      els.selectorFondo.querySelectorAll('[data-ha-fondo-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          state.fondoIndex = Number(btn.dataset.haFondoIdx);
          aplicarFondo();
          renderSelectorFondo();
        });
      });
    }
  }

  function renderBarraInferior() {
    if (state.estado !== 'grabado') {
      els.barraInferior.innerHTML = `
        <p class="historia-audio__hint">
          ${state.estado === 'grabando' ? 'Toca para detener' : 'Toca el micrófono para grabar'}
        </p>
      `;
      return;
    }

    if (state.publicando) {
      els.barraInferior.innerHTML = `
        <div class="historia-audio__publicando">
          <span class="historia-audio__disco-girando" aria-hidden="true"></span>
          <span class="historia-audio__publicando-texto">Publicando...</span>
        </div>
      `;
      return;
    }

    els.barraInferior.innerHTML = `
      <button class="historia-audio__btn-regrabar" data-ha-regrabar>↻ Regrabar</button>
      <button class="historia-audio__btn-siguiente" data-ha-siguiente>Siguiente</button>
    `;
    els.barraInferior.querySelector('[data-ha-regrabar]').addEventListener('click', regrabar);
    els.barraInferior.querySelector('[data-ha-siguiente]').addEventListener('click', irAPublicar);
  }
}

registrarRuta('/historia-audio', render);

function plantilla() {
  return `
    <div class="historia-audio">
      <div class="historia-audio__fondo" data-ha-fondo></div>

      <header class="historia-audio__header">
        <button class="historia-audio__cerrar" data-ha-cerrar aria-label="Cerrar">✕</button>
        <p class="historia-audio__titulo">Audio</p>
        <span class="historia-audio__spacer"></span>
      </header>

      <div class="historia-audio__central" data-ha-central></div>

      <div class="historia-audio__selector-fondo" data-ha-selector-fondo></div>
      <div class="historia-audio__barra-inferior" data-ha-barra-inferior></div>
    </div>
  `;
}

function formatearDuracion(ms) {
  const totalSeg = Math.floor(ms / 1000);
  const m = Math.floor(totalSeg / 60).toString().padStart(2, '0');
  const s = (totalSeg % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}