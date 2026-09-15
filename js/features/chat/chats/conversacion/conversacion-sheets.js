// ═════════════════════════════════════════════════════════════════
// conversacion-sheets.js
// Ubicación: js/features/chat/chats/conversacion/conversacion-sheets.js
//
// Réplica web de pantallas_ui/conversacion/conversacion_sheets.dart.
// Agrupa: constantes compartidas, helpers de UI dinámica, el
// separador de fecha, el empty state, y todos los "bottom sheets"
// (implementados como overlays propios, mismo criterio que
// abrirMenuChat()/plantillaMenuChat() en chats-screen.js — ver nota
// de DIFERENCIAS INTENCIONALES ahí).
//
// conversacion-screen.js, burbuja-mensaje.js y composer-bar.js
// importan este archivo. Este archivo NO importa a ninguno de ellos.
// ═════════════════════════════════════════════════════════════════

export const EMOJIS_RAPIDOS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// ── Tipos de contexto (equivalente a TipoContexto en Dart) ────────
export const TipoContexto = { OBJETO_PERDIDO: 'objeto_perdido', MARKETPLACE: 'marketplace' };

// ── Helpers de UI dinámica según tipo de contexto ──────────────────

export function iconoContexto(contextoTipo) {
  return contextoTipo === 'marketplace' ? '🏪' : '🔍';
}

export function labelContexto(contextoTipo) {
  return contextoTipo === 'marketplace' ? 'Marketplace' : 'Objeto perdido';
}

export function hintContexto(contextoTipo) {
  return contextoTipo === 'marketplace' ? 'Ver publicación →' : 'Ver reporte →';
}

// ── Ícono según tipo de mensaje, para preview de respuesta ─────────

export function iconoTipoMensaje(tipo) {
  switch (tipo) {
    case 'imagen':
      return '📷';
    case 'video':
      return '🎥';
    case 'audio':
      return '🎤';
    case 'documento':
      return '📄';
    case 'sticker':
      return '😊';
    default:
      return '💬';
  }
}

export function formatearDuracion(ms) {
  const totalSeg = Math.floor((ms || 0) / 1000);
  const minutos = Math.floor(totalSeg / 60);
  const segundos = String(totalSeg % 60).padStart(2, '0');
  return `${minutos}:${segundos}`;
}

export function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// ── Separador de fecha ─────────────────────────────────────────────

export function plantillaFechaSeparador(fechaIso) {
  return `<div class="conv-fecha-sep"><span>${etiquetaFecha(fechaIso)}</span></div>`;
}

function etiquetaFecha(fechaIso) {
  const fecha = new Date(fechaIso);
  const ahora = new Date();
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const diaFecha = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

  if (diaFecha.getTime() === hoy.getTime()) return 'Hoy';
  if (diaFecha.getTime() === ayer.getTime()) return 'Ayer';

  const diffDias = Math.floor((ahora - fecha) / 86400000);
  if (diffDias < 7) {
    const dia = new Intl.DateTimeFormat('es-MX', { weekday: 'long' }).format(fecha);
    return dia.charAt(0).toUpperCase() + dia.slice(1);
  }
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(fecha);
}

// ── Empty state ─────────────────────────────────────────────────────

export function plantillaEmptyConversacion(nombre) {
  return `
    <div class="conv-empty">
      <span class="conv-empty__icono">💬</span>
      <p class="conv-empty__texto">Inicia tu conversación<br />con ${escaparHtml(nombre)}</p>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────
// SHEETS (overlays propios — ver nota de cabecera)
// ─────────────────────────────────────────────────────────────────

function crearOverlay(htmlInterno) {
  const overlay = document.createElement('div');
  overlay.className = 'conv-sheet-overlay';
  overlay.innerHTML = htmlInterno;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));
  return overlay;
}

function cerrarOverlay(overlay) {
  overlay.classList.remove('visible');
  setTimeout(() => overlay.remove(), 200);
}

/**
 * Menú de opciones al mantener presionado un mensaje. Devuelve una
 * Promise que resuelve con la acción elegida ('responder', 'copiar',
 * 'editar', 'eliminar', 'guardar_sticker', o `emoji:<emoji>`) o null
 * si se cerró sin elegir nada.
 */
export function mostrarMenuMensaje({ esMio, esTexto, esSticker, miReaccionActual }) {
  return new Promise((resolve) => {
    const overlay = crearOverlay(`
      <div class="conv-menu-sheet">
        <div class="conv-sheet__manija"></div>
        <div class="conv-menu-sheet__emojis">
          ${EMOJIS_RAPIDOS.map(
            (e) => `
              <button class="conv-emoji-rapido${e === miReaccionActual ? ' seleccionado' : ''}" data-emoji="${e}">${e}</button>
            `
          ).join('')}
        </div>
        <hr class="conv-sheet__divisor" />
        <button class="conv-sheet__opcion" data-accion="responder"><span>↩️</span><span>Responder</span></button>
        ${
          esSticker
            ? `<button class="conv-sheet__opcion" data-accion="guardar_sticker"><span>🔖</span><span>Guardar sticker</span></button>`
            : ''
        }
        ${
          esTexto
            ? `<button class="conv-sheet__opcion" data-accion="copiar"><span>📋</span><span>Copiar</span></button>`
            : ''
        }
        ${
          esMio && esTexto
            ? `<button class="conv-sheet__opcion" data-accion="editar"><span>✏️</span><span>Editar</span></button>`
            : ''
        }
        ${
          esMio
            ? `<button class="conv-sheet__opcion conv-sheet__opcion--peligro" data-accion="eliminar"><span>🗑️</span><span>Eliminar</span></button>`
            : ''
        }
      </div>
    `);

    const resolverYCerrar = (valor) => {
      cerrarOverlay(overlay);
      resolve(valor);
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) resolverYCerrar(null);
    });
    overlay.querySelectorAll('[data-emoji]').forEach((btn) => {
      btn.addEventListener('click', () => resolverYCerrar(`emoji:${btn.dataset.emoji}`));
    });
    overlay.querySelectorAll('[data-accion]').forEach((btn) => {
      btn.addEventListener('click', () => resolverYCerrar(btn.dataset.accion));
    });
  });
}

/** Sheet para editar el texto de un mensaje. Resuelve con el nuevo texto o null si se canceló. */
export function mostrarEditarMensaje(textoInicial) {
  return new Promise((resolve) => {
    const overlay = crearOverlay(`
      <div class="conv-sheet-fondo conv-editar-sheet">
        <div class="conv-sheet__manija"></div>
        <p class="conv-sheet__titulo">Editar mensaje</p>
        <div class="conv-editar-sheet__fila">
          <textarea id="conv-editar-input" class="conv-textarea" rows="1">${escaparHtml(textoInicial)}</textarea>
          <button class="conv-boton-circular" id="conv-editar-confirmar">✓</button>
        </div>
      </div>
    `);

    const input = overlay.querySelector('#conv-editar-input');
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);

    const resolverYCerrar = (valor) => {
      cerrarOverlay(overlay);
      resolve(valor);
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) resolverYCerrar(null);
    });
    overlay.querySelector('#conv-editar-confirmar').addEventListener('click', () => resolverYCerrar(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        resolverYCerrar(input.value);
      }
    });
  });
}

/** Sheet de opciones de adjunto. Resuelve con 'camara' | 'galeria' | null. */
export function mostrarOpcionesAdjunto() {
  return new Promise((resolve) => {
    const overlay = crearOverlay(`
      <div class="conv-menu-sheet">
        <div class="conv-sheet__manija"></div>
        <button class="conv-sheet__opcion" data-opcion="camara"><span>📷</span><span>Tomar foto</span></button>
        <button class="conv-sheet__opcion" data-opcion="galeria"><span>🖼️</span><span>Elegir de la galería</span></button>
      </div>
    `);

    const resolverYCerrar = (valor) => {
      cerrarOverlay(overlay);
      resolve(valor);
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) resolverYCerrar(null);
    });
    overlay.querySelectorAll('[data-opcion]').forEach((btn) => {
      btn.addEventListener('click', () => resolverYCerrar(btn.dataset.opcion));
    });
  });
}

/** Sheet de preview + caption antes de enviar una imagen. Resuelve con el caption (string) o null si se canceló. */
export function mostrarCaptionSheet(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const overlay = crearOverlay(`
      <div class="conv-sheet-fondo conv-caption-sheet">
        <div class="conv-sheet__manija"></div>
        <img class="conv-caption-sheet__preview" src="${url}" alt="" />
        <div class="conv-editar-sheet__fila">
          <textarea id="conv-caption-input" class="conv-textarea" rows="1" placeholder="Agrega un comentario (opcional)..."></textarea>
          <button class="conv-boton-circular" id="conv-caption-confirmar">↑</button>
        </div>
      </div>
    `);

    const input = overlay.querySelector('#conv-caption-input');
    input.focus();

    const resolverYCerrar = (valor) => {
      URL.revokeObjectURL(url);
      cerrarOverlay(overlay);
      resolve(valor);
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) resolverYCerrar(null);
    });
    overlay
      .querySelector('#conv-caption-confirmar')
      .addEventListener('click', () => resolverYCerrar(input.value.trim()));
  });
}

/** Confirmación genérica de eliminar/reintentar (reemplaza los AlertDialog de Dart). */
export function mostrarConfirmacion({ titulo, mensaje, textoConfirmar, peligroso = false }) {
  return new Promise((resolve) => {
    const overlay = crearOverlay(`
      <div class="conv-confirm-dialogo">
        <p class="conv-confirm-dialogo__titulo">${escaparHtml(titulo)}</p>
        <p class="conv-confirm-dialogo__mensaje">${escaparHtml(mensaje)}</p>
        <div class="conv-confirm-dialogo__acciones">
          <button data-valor="false">Cancelar</button>
          <button data-valor="true" class="${peligroso ? 'conv-confirm-dialogo__peligro' : 'conv-confirm-dialogo__acento'}">${escaparHtml(textoConfirmar)}</button>
        </div>
      </div>
    `);

    const resolverYCerrar = (valor) => {
      cerrarOverlay(overlay);
      resolve(valor);
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) resolverYCerrar(false);
    });
    overlay.querySelectorAll('[data-valor]').forEach((btn) => {
      btn.addEventListener('click', () => resolverYCerrar(btn.dataset.valor === 'true'));
    });
  });
}