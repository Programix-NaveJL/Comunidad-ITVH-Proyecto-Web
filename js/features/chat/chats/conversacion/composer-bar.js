// ═════════════════════════════════════════════════════════════════
// composer-bar.js
// Ubicación: js/features/chat/chats/conversacion/composer-bar.js
//
// Réplica web de pantallas_ui/conversacion/composer_bar.dart. Se
// monta UNA sola vez (montarComposerBar) y expone un controlador con
// métodos para actualizar su estado desde afuera (respuesta activa,
// contexto adjunto, enviando) — el <textarea> nunca se destruye
// entre actualizaciones, para no perder el foco/texto escrito cada
// vez que llega un mensaje nuevo (a diferencia de la zona de
// mensajes, que sí se reconstruye completa en cada cambio).
//
// DIFERENCIA DE PLATAFORMA (grabación de audio): `record` (AAC) se
// reemplaza por MediaRecorder (Opus/.webm) — ver nota igual en
// storage-service.js/subirAudioChat.
// ═════════════════════════════════════════════════════════════════

import { escaparHtml, iconoContexto, labelContexto } from './conversacion-sheets.js';
import { montarPanelEmojisStickers } from '../panel-emojis-stickers.js';
import * as chatMediaService from '../../chat-media-service.js';
import { mostrarToast } from '../../../../core/toast.js';

const UMBRAL_CANCELAR_GRABACION = 120;

export function montarComposerBar(contenedor, opciones) {
  const {
    miId,
    otroUsuarioId,
    otroNombre,
    otroNombreUsuario,
    otroAvatarUrl,
    contextoObjetoInicial,
    onEnviarTexto, // (texto) => Promise
  } = opciones;

  let respondiendoA = null;
  let contextoObjeto = contextoObjetoInicial || null;
  let mostrarContexto = !!contextoObjetoInicial;
  let enviando = false;
  let adjuntoDeshabilitado = false;
  let mostrarPanelEmojis = false;
  let grabando = false;
  let cancelarAlSoltar = false;
  let inicioGrabacion = null;
  let timerGrabacion = null;
  let mediaRecorder = null;
  let chunksAudio = [];

  contenedor.innerHTML = `
    <div class="conv-composer">
      <div class="conv-composer__respuesta-zona"></div>
      <div class="conv-composer__contexto-zona"></div>
      <div class="conv-composer__fila">
        <button class="conv-composer__adjuntar" id="conv-btn-adjuntar">📎</button>
        <div class="conv-composer__grabando-zona" id="conv-grabando-zona" style="display:none"></div>
        <div class="conv-composer__campo" id="conv-campo-texto-zona">
          <button class="conv-composer__emoji-toggle" id="conv-btn-emoji">🙂</button>
          <textarea id="conv-composer-input" class="conv-composer__textarea" rows="1" placeholder="Mensaje..."></textarea>
        </div>
        <button class="conv-composer__enviar" id="conv-btn-enviar">↑</button>
      </div>
      <div class="conv-composer__panel-zona" id="conv-panel-zona"></div>
    </div>
  `;

  const input = contenedor.querySelector('#conv-composer-input');
  const btnEnviar = contenedor.querySelector('#conv-btn-enviar');
  const btnAdjuntar = contenedor.querySelector('#conv-btn-adjuntar');
  const btnEmoji = contenedor.querySelector('#conv-btn-emoji');
  const campoTextoZona = contenedor.querySelector('#conv-campo-texto-zona');
  const grabandoZona = contenedor.querySelector('#conv-grabando-zona');
  const panelZona = contenedor.querySelector('#conv-panel-zona');
  const respuestaZona = contenedor.querySelector('.conv-composer__respuesta-zona');
  const contextoZona = contenedor.querySelector('.conv-composer__contexto-zona');

  // ── auto-resize del textarea ─────────────────────────────────
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(120, input.scrollHeight)}px`;
    renderBotonEnviar();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarTexto();
    }
  });
  input.addEventListener('focus', () => {
    if (mostrarPanelEmojis) alternarPanelEmojis(false);
  });

  function renderBotonEnviar() {
    const vacio = input.value.trim() === '';
    if ((vacio || grabando) && !enviando) {
      btnEnviar.innerHTML = grabando && cancelarAlSoltar ? '🗑️' : '🎤';
      btnEnviar.classList.toggle('conv-composer__enviar--cancelar', grabando && cancelarAlSoltar);
    } else {
      btnEnviar.innerHTML = enviando ? '<span class="conv-spinner-mini conv-spinner-mini--blanco"></span>' : '↑';
      btnEnviar.classList.remove('conv-composer__enviar--cancelar');
    }
  }

  async function enviarTexto() {
    const texto = input.value.trim();
    if (!texto || enviando) return;
    input.value = '';
    input.style.height = 'auto';
    const respuesta = respondiendoA;
    const contexto = mostrarContexto && !respuesta ? contextoObjeto : null;

    enviando = true;
    mostrarContexto = false;
    respondiendoA = null;
    renderRespuesta();
    renderContexto();
    renderBotonEnviar();

    try {
      await onEnviarTexto(texto, { respuesta, contexto });
    } finally {
      enviando = false;
      renderBotonEnviar();
    }
  }

  // ── Botón mic/enviar ──────────────────────────────────────────
  btnEnviar.addEventListener('click', () => {
    const vacio = input.value.trim() === '';
    if (!vacio && !grabando) enviarTexto();
  });

  let arrastreInicioX = 0;
  function iniciarPresion(clientX) {
    arrastreInicioX = clientX;
    iniciarGrabacion();
  }
  function moverPresion(clientX) {
    if (!grabando) return;
    const dx = Math.max(-200, Math.min(0, clientX - arrastreInicioX));
    cancelarAlSoltar = Math.abs(dx) >= UMBRAL_CANCELAR_GRABACION;
    grabandoZona.querySelector('.conv-grabando__deslizar')?.classList.toggle('conv-grabando__deslizar--activo', cancelarAlSoltar);
    renderBotonEnviar();
  }
  function soltarPresion() {
    if (grabando) detenerGrabacion();
  }

  let presionTimer = null;
  btnEnviar.addEventListener('mousedown', (e) => {
    if (input.value.trim() !== '') return;
    presionTimer = setTimeout(() => iniciarPresion(e.clientX), 200);
  });
  window.addEventListener('mousemove', (e) => moverPresion(e.clientX));
  window.addEventListener('mouseup', () => {
    clearTimeout(presionTimer);
    soltarPresion();
  });
  btnEnviar.addEventListener('touchstart', (e) => {
    if (input.value.trim() !== '') return;
    presionTimer = setTimeout(() => iniciarPresion(e.touches[0].clientX), 200);
  }, { passive: true });
  btnEnviar.addEventListener('touchmove', (e) => moverPresion(e.touches[0].clientX), { passive: true });
  btnEnviar.addEventListener('touchend', () => {
    clearTimeout(presionTimer);
    soltarPresion();
  });

  async function iniciarGrabacion() {
    if (grabando) return;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      mostrarToast('Se necesita acceso al micrófono', 'error');
      return;
    }

    chunksAudio = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksAudio.push(e.data);
    };

    grabando = true;
    cancelarAlSoltar = false;
    inicioGrabacion = Date.now();
    campoTextoZona.style.display = 'none';
    btnAdjuntar.style.display = 'none';
    grabandoZona.style.display = 'flex';
    renderGrabando(0);
    mediaRecorder.start();

    timerGrabacion = setInterval(() => renderGrabando(Date.now() - inicioGrabacion), 200);
    renderBotonEnviar();
  }

  function renderGrabando(ms) {
    const seg = Math.floor(ms / 1000);
    const min = String(Math.floor(seg / 60)).padStart(2, '0');
    const segStr = String(seg % 60).padStart(2, '0');
    grabandoZona.innerHTML = `
      <span class="conv-grabando__punto"></span>
      <span class="conv-grabando__tiempo">${min}:${segStr}</span>
      <span class="conv-grabando__deslizar">◀ Desliza para cancelar</span>
    `;
  }

  async function detenerGrabacion() {
    if (!grabando || !mediaRecorder) return;
    const duracionMs = Date.now() - inicioGrabacion;
    const cancelar = cancelarAlSoltar || duracionMs < 800;

    clearInterval(timerGrabacion);
    const stream = mediaRecorder.stream;
    const terminado = new Promise((resolve) => (mediaRecorder.onstop = resolve));
    mediaRecorder.stop();
    await terminado;
    stream.getTracks().forEach((t) => t.stop());

    grabando = false;
    campoTextoZona.style.display = '';
    btnAdjuntar.style.display = '';
    grabandoZona.style.display = 'none';
    renderBotonEnviar();

    if (cancelar) return;

    const blob = new Blob(chunksAudio, { type: mediaRecorder.mimeType || 'audio/webm' });
    try {
      await chatMediaService.enviarAudio({
        blob,
        duracionMs,
        otroUsuarioId,
        otroNombre,
        otroNombreUsuario,
        otroAvatarUrl,
      });
    } catch {
      mostrarToast('No se pudo enviar la nota de voz. Intenta de nuevo.', 'error');
    }
  }

  // ── Panel emojis/stickers ────────────────────────────────────
  function alternarPanelEmojis(forzar) {
    mostrarPanelEmojis = forzar ?? !mostrarPanelEmojis;
    btnEmoji.textContent = mostrarPanelEmojis ? '⌨️' : '🙂';
    if (mostrarPanelEmojis) {
      input.blur();
            montarPanelEmojisStickers(panelZona, {
        onEmojiSeleccionado: (emoji) => {
          const inicio = input.selectionStart ?? input.value.length;
          const fin = input.selectionEnd ?? input.value.length;
          input.value = input.value.slice(0, inicio) + emoji + input.value.slice(fin);
          input.focus();
          input.setSelectionRange(inicio + emoji.length, inicio + emoji.length);
          renderBotonEnviar();
        },
        onStickerSeleccionado: async (sticker) => {
          try {
            await chatMediaService.enviarStickerExistente({
              sticker,
              otroUsuarioId,
              otroNombre,
              otroNombreUsuario,
              otroAvatarUrl,
            });
          } catch {
            mostrarToast('No se pudo enviar el sticker. Intenta de nuevo.', 'error');
          }
        },
        onSubirStickerNuevo: async (file) => {
          try {
            await chatMediaService.enviarSticker({
              file,
              otroUsuarioId,
              otroNombre,
              otroNombreUsuario,
              otroAvatarUrl,
            });
          } catch {
            mostrarToast('No se pudo subir el sticker. Intenta de nuevo.', 'error');
          }
        },
      });
      panelZona.style.display = '';
    } else {
      panelZona.style.display = 'none';
      panelZona.innerHTML = '';
    }
  }
  btnEmoji.addEventListener('click', () => alternarPanelEmojis());

  // ── Adjuntar imagen ──────────────────────────────────────────
  const inputCamara = document.createElement('input');
  inputCamara.type = 'file';
  inputCamara.accept = 'image/*';
  inputCamara.capture = 'environment';
  inputCamara.style.display = 'none';

  const inputGaleria = document.createElement('input');
  inputGaleria.type = 'file';
  inputGaleria.accept = 'image/*';
  inputGaleria.style.display = 'none';

  contenedor.appendChild(inputCamara);
  contenedor.appendChild(inputGaleria);

  async function manejarArchivoElegido(file) {
    if (!file) return;
    const { mostrarCaptionSheet } = await import('./conversacion-sheets.js');
    const caption = await mostrarCaptionSheet(file);
    if (caption == null) return;
    try {
      await chatMediaService.enviarImagen({
        file,
        otroUsuarioId,
        otroNombre,
        otroNombreUsuario,
        otroAvatarUrl,
        caption: caption || null,
      });
    } catch {
      mostrarToast('No se pudo enviar la imagen. Intenta de nuevo.', 'error');
    }
  }

  inputCamara.addEventListener('change', () => manejarArchivoElegido(inputCamara.files[0]));
  inputGaleria.addEventListener('change', () => manejarArchivoElegido(inputGaleria.files[0]));

  btnAdjuntar.addEventListener('click', async () => {
    if (adjuntoDeshabilitado) return;
    const { mostrarOpcionesAdjunto } = await import('./conversacion-sheets.js');
    const opcion = await mostrarOpcionesAdjunto();
    if (opcion === 'camara') inputCamara.click();
    else if (opcion === 'galeria') inputGaleria.click();
  });

  // ── Render de zonas de respuesta / contexto ──────────────────
  function renderRespuesta() {
    if (!respondiendoA) {
      respuestaZona.innerHTML = '';
      return;
    }
    const esMio = respondiendoA.emisorId === miId;
    const nombreAutor = esMio ? 'Tú' : otroNombre;
    respuestaZona.innerHTML = `
      <div class="conv-preview-respuesta">
        <div class="conv-preview-respuesta__cuerpo">
          <p class="conv-preview-respuesta__nombre">↩️ ${escaparHtml(nombreAutor)}</p>
          <p class="conv-preview-respuesta__texto">${escaparHtml(respondiendoA.contenido || respondiendoA.tipo)}</p>
        </div>
        <button class="conv-preview-respuesta__cerrar" id="conv-cancelar-respuesta">✕</button>
      </div>
    `;
    respuestaZona.querySelector('#conv-cancelar-respuesta').addEventListener('click', () => {
      respondiendoA = null;
      renderRespuesta();
    });
  }

  function renderContexto() {
    if (!contextoObjeto || !mostrarContexto || respondiendoA) {
      contextoZona.innerHTML = '';
      return;
    }
    const tipo = contextoObjeto.tipo || 'objeto_perdido';
    contextoZona.innerHTML = `
      <div class="conv-card-contexto conv-card-contexto--composer">
        ${contextoObjeto.imagenUrl ? `<img class="conv-card-contexto__img" src="${contextoObjeto.imagenUrl}" alt="" />` : ''}
        <div class="conv-card-contexto__cuerpo">
          <p class="conv-card-contexto__tag">${iconoContexto(tipo)} ${labelContexto(tipo)}</p>
          <p class="conv-card-contexto__desc">${escaparHtml(contextoObjeto.descripcion)}</p>
        </div>
        <button class="conv-preview-respuesta__cerrar" id="conv-cerrar-contexto">✕</button>
      </div>
    `;
    contextoZona.querySelector('#conv-cerrar-contexto').addEventListener('click', () => {
      mostrarContexto = false;
      renderContexto();
    });
  }

  renderRespuesta();
  renderContexto();
  renderBotonEnviar();

  // ── Controlador expuesto ─────────────────────────────────────
  return {
    iniciarRespuesta(msg) {
      respondiendoA = msg;
      renderRespuesta();
      renderContexto();
      input.focus();
    },
    cancelarRespuesta() {
      respondiendoA = null;
      renderRespuesta();
    },
    actualizarAdjuntoDeshabilitado(valor) {
      adjuntoDeshabilitado = valor;
      btnAdjuntar.style.opacity = valor ? '0.4' : '1';
    },
    obtenerRespuestaActiva: () => respondiendoA,
  };
}