// ═════════════════════════════════════════════════════════════════
// burbuja-mensaje.js
// Ubicación: js/features/chat/chats/conversacion/burbuja-mensaje.js
//
// Réplica web de pantallas_ui/conversacion/burbuja_mensaje.dart.
// Genera el HTML de UNA burbuja (texto, imagen, audio, sticker,
// eliminado, cita de respuesta, reacciones) y activa sus listeners
// (long-press → menú, swipe-to-reply, tap en audio, tap en imagen).
//
// DIFERENCIA INTENCIONAL: la "colita" curva estilo Telegram
// (BurbujaColaClipper, con Bezier) se reemplaza por el truco CSS
// habitual de chat bubbles (un border-radius asimétrico en la
// esquina del emisor) — visualmente muy similar, sin necesitar
// clip-path/canvas. Ver conversacion.css, clases .conv-bubble--cola-*.
// ═════════════════════════════════════════════════════════════════

import {
  iconoTipoMensaje,
  iconoContexto,
  labelContexto,
  hintContexto,
  formatearDuracion,
  escaparHtml,
} from './conversacion-sheets.js';
import { mostrarImagenVisor } from '../imagen-visor-screen.js';

const UMBRAL_RESPONDER = 60;
const MAX_ARRASTRE = 76;

/**
 * Devuelve el HTML de una burbuja + la envuelve en su wrapper de
 * swipe-to-reply. `callbacks`: { onLongPress, onReintentar,
 * onTapReaccion, onTapRespuesta }.
 */
export function plantillaBurbuja(mensaje, { esMio, esUltimoDelGrupo, miId, otroNombre, destacado }) {
  const claseDestacado = destacado ? ' conv-bubble-fila--destacado' : '';

  if (mensaje.eliminado) {
    return `
      <div class="conv-bubble-fila conv-bubble-fila--${esMio ? 'mio' : 'otro'}${claseDestacado}" data-mensaje-id="${mensaje.mensajeId}">
        <div class="conv-bubble conv-bubble--eliminado">🚫 Mensaje eliminado</div>
      </div>
    `;
  }

  if (mensaje.tipo === 'sticker') {
    return `
      <div class="conv-bubble-fila conv-bubble-fila--${esMio ? 'mio' : 'otro'}${claseDestacado}" data-mensaje-id="${mensaje.mensajeId}" data-swipe="1">
        ${plantillaStickerContenido(mensaje)}
        ${plantillaReacciones(mensaje, esMio, miId)}
      </div>
    `;
  }

  const hora = formatearHora(mensaje.timestamp);
  const esFallido = mensaje.estado === 'fallido';
  const tieneRespuesta = !!mensaje.respuestaAMensajeId;
  const tieneContexto = !!mensaje.contextoDescripcion;
  const esImagen = mensaje.tipo === 'imagen';
  const esAudio = mensaje.tipo === 'audio';
  const tieneCaption = esImagen && !!mensaje.contenido;

  const claseCola = esUltimoDelGrupo ? '' : ' conv-bubble--sin-cola';
  const claseTipo = esMio ? (esFallido ? 'conv-bubble--mio-fallido' : 'conv-bubble--mio') : 'conv-bubble--otro';

  return `
    <div class="conv-bubble-fila conv-bubble-fila--${esMio ? 'mio' : 'otro'}${claseDestacado}" data-mensaje-id="${mensaje.mensajeId}" data-swipe="1">
      <div class="conv-bubble ${claseTipo}${claseCola}${esImagen ? ' conv-bubble--imagen' : ''}" data-reintentar="${esFallido && esMio ? '1' : ''}">
        ${tieneRespuesta ? plantillaCitaRespuesta(mensaje, esMio, miId, otroNombre) : ''}
        ${tieneContexto ? plantillaCardContexto(mensaje, esMio) : ''}
        ${esImagen ? plantillaImagenContenido(mensaje, hora, esMio, !tieneCaption) : ''}
        ${esAudio ? plantillaAudioContenido(mensaje, hora, esMio) : ''}
        ${
          tieneCaption
            ? `<p class="conv-bubble__texto conv-bubble__texto--caption">${escaparHtml(mensaje.contenido)}${plantillaHoraInline(hora, mensaje, esMio)}</p>`
            : !esImagen && !esAudio
              ? `<p class="conv-bubble__texto">${escaparHtml(mensaje.contenido || '')}${plantillaHoraInline(hora, mensaje, esMio)}</p>`
              : ''
        }
      </div>
      ${plantillaReacciones(mensaje, esMio, miId)}
    </div>
  `;
}

function plantillaHoraInline(hora, mensaje, esMio) {
  return `<span class="conv-bubble__hora">${mensaje.editado ? '<i>editado</i> ' : ''}${hora}${esMio ? plantillaIconoEstado(mensaje.estado) : ''}</span>`;
}

function plantillaIconoEstado(estado) {
  switch (estado) {
    case 'enviando':
      return ' <span class="conv-icono-estado conv-spinner-mini"></span>';
    case 'entregado':
      return ' <span class="conv-icono-estado">✓✓</span>';
    case 'fallido':
      return ' <span class="conv-icono-estado conv-icono-estado--error">⚠️</span>';
    default:
      return '';
  }
}

function plantillaCitaRespuesta(mensaje, esMio, miId, otroNombre) {
  const esTexto = mensaje.respuestaATipo === 'texto';
  const nombreAutor = mensaje.respuestaAEmisorId === miId ? 'Tú' : otroNombre;
  return `
    <div class="conv-cita" data-ir-a-respuesta="${mensaje.respuestaAMensajeId}">
      <p class="conv-cita__nombre">${escaparHtml(nombreAutor)}</p>
      <p class="conv-cita__texto">
        ${!esTexto ? `${iconoTipoMensaje(mensaje.respuestaATipo)} ` : ''}${escaparHtml(mensaje.respuestaAContenido || '')}
      </p>
    </div>
  `;
}

function plantillaCardContexto(mensaje, esMio) {
  const tipo = mensaje.contextoTipo;
  const esMarketplace = tipo === 'marketplace';
  return `
    <div class="conv-card-contexto" data-objeto-id="${mensaje.contextoObjetoId || ''}" data-es-marketplace="${esMarketplace ? '1' : ''}">
      ${mensaje.contextoImagenUrl ? `<img class="conv-card-contexto__img" src="${mensaje.contextoImagenUrl}" alt="" />` : ''}
      <div class="conv-card-contexto__cuerpo">
        <p class="conv-card-contexto__tag">${iconoContexto(tipo)} ${labelContexto(tipo)}</p>
        <p class="conv-card-contexto__desc">${escaparHtml(mensaje.contextoDescripcion)}</p>
        ${mensaje.contextoLugar ? `<p class="conv-card-contexto__lugar">${esMarketplace ? '💲' : '📍'} ${escaparHtml(mensaje.contextoLugar)}</p>` : ''}
        <p class="conv-card-contexto__hint">${hintContexto(tipo)}</p>
      </div>
    </div>
  `;
}

function plantillaImagenContenido(mensaje, hora, esMio, mostrarHoraSobreImagen) {
  const url = mensaje.mediaUrlRemota;
  if (!url) return `<div class="conv-imagen-rota">🖼️</div>`;
  return `
    <div class="conv-imagen-contenido" data-imagen-url="${url}">
      <img src="${url}" alt="" loading="lazy" />
      ${mostrarHoraSobreImagen ? `<span class="conv-imagen-hora">${mensaje.editado ? '<i>editado</i> ' : ''}${hora}${esMio ? plantillaIconoEstado(mensaje.estado) : ''}</span>` : ''}
    </div>
  `;
}

function plantillaAudioContenido(mensaje, hora, esMio) {
  const duracion = formatearDuracion(mensaje.mediaDuracionMs);
  return `
    <div class="conv-audio" data-audio-url="${mensaje.mediaUrlRemota || ''}">
      <button class="conv-audio__play">▶️</button>
      <div class="conv-audio__cuerpo">
        <div class="conv-audio__barra"><div class="conv-audio__progreso"></div></div>
        <div class="conv-audio__meta">
          <span>🎙️ <span class="conv-audio__duracion">${duracion}</span></span>
          <span>${hora}${esMio ? plantillaIconoEstado(mensaje.estado) : ''}</span>
        </div>
      </div>
    </div>
  `;
}

function plantillaStickerContenido(mensaje) {
  const hora = formatearHora(mensaje.timestamp);
  return `
    <div class="conv-sticker">
      ${mensaje.mediaUrlRemota ? `<img src="${mensaje.mediaUrlRemota}" alt="" />` : `<div class="conv-imagen-rota">🖼️</div>`}
      <span class="conv-sticker__hora">${hora}</span>
    </div>
  `;
}

function plantillaReacciones(mensaje, esMio, miId) {
  const reacciones = mensaje.reacciones || {};
  const entradas = Object.entries(reacciones);
  if (entradas.length === 0) return '';

  const agrupadas = {};
  for (const [usuarioId, emoji] of entradas) {
    (agrupadas[emoji] ??= []).push(usuarioId);
  }

  return `
    <div class="conv-reacciones conv-reacciones--${esMio ? 'mio' : 'otro'}">
      ${Object.entries(agrupadas)
        .map(([emoji, usuarios]) => {
          const esMiReaccion = usuarios.includes(miId);
          return `
            <button class="conv-reaccion${esMiReaccion ? ' conv-reaccion--mia' : ''}" data-reaccion-emoji="${emoji}">
              <span>${emoji}</span>${usuarios.length > 1 ? `<span class="conv-reaccion__contador">${usuarios.length}</span>` : ''}
            </button>
          `;
        })
        .join('')}
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────
// Activación de listeners sobre una fila ya insertada en el DOM.
// ─────────────────────────────────────────────────────────────────

export function activarBurbuja(fila, mensaje, callbacks) {
  const { onLongPress, onReintentar, onTapReaccion, onTapRespuesta, onTapImagen } = callbacks;

  // ── Long-press (mantener presionado) → menú ─────────────────
  activarPulsacionLarga(fila, () => onLongPress?.(mensaje));

  // ── Swipe-to-reply ───────────────────────────────────────────
  if (fila.dataset.swipe === '1' && !mensaje.eliminado) {
    activarSwipeToReply(fila, () => onTapRespuesta && callbacks.onResponder?.(mensaje));
  }

  // ── Tap en burbuja fallida → reintentar ──────────────────────
  const bubble = fila.querySelector('.conv-bubble[data-reintentar="1"]');
  bubble?.addEventListener('click', () => onReintentar?.(mensaje));

  // ── Tap en cita de respuesta → ir al mensaje original ────────
  fila.querySelector('[data-ir-a-respuesta]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    onTapRespuesta?.(fila.querySelector('[data-ir-a-respuesta]').dataset.irARespuesta);
  });

  // ── Tap en imagen → visor ────────────────────────────────────
  fila.querySelector('[data-imagen-url]')?.addEventListener('click', () => {
    const url = fila.querySelector('[data-imagen-url]').dataset.imagenUrl;
    onTapImagen?.(url) ?? mostrarImagenVisor(url);
  });

  // ── Reacciones (tap en un chip existente) ────────────────────
  fila.querySelectorAll('[data-reaccion-emoji]').forEach((btn) => {
    btn.addEventListener('click', () => onTapReaccion?.(mensaje, btn.dataset.reaccionEmoji));
  });

  // ── Audio: play/pausa + seek ──────────────────────────────────
  const audioEl = fila.querySelector('.conv-audio');
  if (audioEl) activarAudioBurbuja(audioEl, mensaje);
}

function activarPulsacionLarga(elemento, callback, duracionMs = 500) {
  let timer = null;
  let movido = false;
  const iniciar = () => {
    movido = false;
    timer = setTimeout(() => {
      if (!movido) callback();
    }, duracionMs);
  };
  const cancelar = () => {
    clearTimeout(timer);
    timer = null;
  };
  const marcarMovido = () => {
    movido = true;
    cancelar();
  };
  elemento.addEventListener('mousedown', iniciar);
  elemento.addEventListener('mouseup', cancelar);
  elemento.addEventListener('mouseleave', cancelar);
  elemento.addEventListener('touchstart', iniciar, { passive: true });
  elemento.addEventListener('touchend', cancelar);
  elemento.addEventListener('touchmove', marcarMovido);
  elemento.addEventListener('contextmenu', (e) => e.preventDefault());
}

function activarSwipeToReply(fila, onResponder) {
  let inicioX = null;
  let dx = 0;
  let disparado = false;
  const contenido = fila.firstElementChild;

  const onStart = (clientX) => {
    inicioX = clientX;
    disparado = false;
  };
  const onMove = (clientX) => {
    if (inicioX == null) return;
    dx = Math.max(0, Math.min(MAX_ARRASTRE, clientX - inicioX));
    contenido.style.transform = `translateX(${dx}px)`;
    if (!disparado && dx >= UMBRAL_RESPONDER) {
      disparado = true;
      if (navigator.vibrate) navigator.vibrate(15);
    }
  };
  const onEnd = () => {
    if (disparado) onResponder();
    contenido.style.transition = 'transform 200ms ease-out';
    contenido.style.transform = 'translateX(0)';
    setTimeout(() => (contenido.style.transition = ''), 200);
    inicioX = null;
    dx = 0;
  };

  fila.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX), { passive: true });
  fila.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX), { passive: true });
  fila.addEventListener('touchend', onEnd);

  let arrastrandoMouse = false;
  fila.addEventListener('mousedown', (e) => {
    arrastrandoMouse = true;
    onStart(e.clientX);
  });
  window.addEventListener('mousemove', (e) => {
    if (arrastrandoMouse) onMove(e.clientX);
  });
  window.addEventListener('mouseup', () => {
    if (arrastrandoMouse) {
      arrastrandoMouse = false;
      onEnd();
    }
  });
}

function activarAudioBurbuja(contenedor, mensaje) {
  const url = contenedor.dataset.audioUrl;
  if (!url) return;

  const btn = contenedor.querySelector('.conv-audio__play');
  const barra = contenedor.querySelector('.conv-audio__barra');
  const progreso = contenedor.querySelector('.conv-audio__progreso');
  const duracionEl = contenedor.querySelector('.conv-audio__duracion');

  let audio = null;
  let cargado = false;

  function asegurarAudio() {
    if (audio) return audio;
    audio = new Audio(url);
    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return;
      progreso.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
      duracionEl.textContent = formatearDuracion(audio.currentTime * 1000);
    });
    audio.addEventListener('ended', () => {
      btn.textContent = '▶️';
      audio.currentTime = 0;
      progreso.style.width = '0%';
      duracionEl.textContent = formatearDuracion(mensaje.mediaDuracionMs);
    });
    cargado = true;
    return audio;
  }

  btn.addEventListener('click', () => {
    asegurarAudio();
    if (audio.paused) {
      audio.play();
      btn.textContent = '⏸️';
    } else {
      audio.pause();
      btn.textContent = '▶️';
    }
  });

  barra.addEventListener('click', (e) => {
    asegurarAudio();
    const rect = barra.getBoundingClientRect();
    const proporcion = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    if (audio.duration) audio.currentTime = audio.duration * proporcion;
    else if (cargado) audio.addEventListener('loadedmetadata', () => (audio.currentTime = audio.duration * proporcion), { once: true });
  });
}

function formatearHora(timestampIso) {
  return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }).format(
    new Date(timestampIso)
  );
}