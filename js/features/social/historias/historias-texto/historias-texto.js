// historias-texto.js
// Ruta real: js/features/social/historias/historias-texto/historias-texto.js
//
// Puerto de historias_texto.dart (EditarHistoriaTextoScreen). Status
// de texto estilo WhatsApp: fondo (sólido o degradado) + texto
// centrado, fuente elegible, música opcional.
//
// DIFERENCIA DE PLATAFORMA — RepaintBoundary → <canvas>: el Dart
// original captura el widget tree (fondo + texto) directo con
// RenderRepaintBoundary.toImage(). En web no existe ese mecanismo,
// así que aquí se separan dos capas:
//   1. VISTA EN VIVO (mientras se edita): un <div> con
//      background = cssFondo(fondo) + un <textarea> centrado —
//      HTML/CSS normal, cero canvas.
//   2. CAPTURA (al tocar "compartir"): se vuelve a dibujar el mismo
//      fondo + texto en un <canvas> oculto de 1080×1920 (formato
//      estándar de historia, 9:16 — ver ASUNCIÓN en capturarComoPng),
//      con su propio wrap de texto por ancho (ctx.measureText).
//   Esto significa que el wrap de línea del <textarea> en pantalla
//   y el wrap del PNG final se calculan por separado — pueden
//   diferir en casos límite (palabras muy largas, fuentes con
//   métricas raras). Si se nota desalineado en pruebas reales, avisar.
//
// DIFERENCIA DE PLATAFORMA — <textarea> en vez de TextField
// arrastrable-no-arrastrable: se usa <textarea> (no contenteditable)
// para que su .value entregue directo el texto con saltos de línea
// reales, sin tener que parsear <br>/<div> del DOM — más simple y
// más fiel al wrap manual que hace capturarComoPng().
//
// MÚSICA: ya conectado a seleccionar-musica.js (ver
// servicio-musica/). trackElegido guarda la PistaMusical tal cual
// (camelCase) para mostrarla en el chip — el mapeo a las columnas
// reales de Supabase (track_titulo/track_artista/...) se hace justo
// antes de llamar a abrirPublicarHistoria(), vía
// mapearPistaASupabase(), nunca antes (el chip y el resto de la UI
// siguen leyendo .titulo/.artista/.cover como siempre).
//
// PENDIENTE — cierre por gesto/botón físico atrás del navegador:
// no se intercepta popstate para forzar el diálogo de "¿Descartar
// historia?" si hay texto sin publicar (el Dart sí lo hace vía
// PopScope). Por ahora solo el botón ✕ dispara la confirmación.

import { registrarRuta, navegarA } from '../../../../core/router.js';
import { mostrarToast } from '../../../../core/toast.js';
import {
  FONDOS_HISTORIA,
  cssFondo,
  colorPrincipal,
  INDICE_FONDO_DEFAULT,
} from './fondos-historia.js';
import { FUENTES_HISTORIA, cargarFuente, cssFont } from './fuentes-historia.js';
import { abrirPublicarHistoria } from '../publicar-historia.js';
import { abrirSeleccionarMusica } from '../servicio-musica/seleccionar-musica.js';
import { mapearPistaASupabase } from '../servicio-musica/pista-musical.js';

const MAX_CARACTERES = 200;
const ANCHO_CANVAS = 1080;
const ALTO_CANVAS = 1920; // 9:16 — ver ASUNCIÓN en capturarComoPng
const FONT_SIZE_BASE = 56; // equivalente visual al fontSize:30 del TextField Dart, escalado al lienzo — ver ASUNCIÓN

function render(contenedor) {
  const state = {
    modo: 'escribiendo', // 'escribiendo' | 'fuente' | 'color'
    fuenteIndex: 0,
    fondoIndex: INDICE_FONDO_DEFAULT,
    trackElegido: null,
    trackInicioMs: 0,
    publicando: false,
  };

  contenedor.innerHTML = plantilla();
  const els = {
    lienzo:     contenedor.querySelector('[data-ht-lienzo]'),
    textarea:   contenedor.querySelector('[data-ht-texto]'),
    header:     contenedor.querySelector('[data-ht-header]'),
    panel:      contenedor.querySelector('[data-ht-panel]'),
    chipMusica: contenedor.querySelector('[data-ht-chip-musica]'),
    compartir:  contenedor.querySelector('[data-ht-compartir]'),
  };

  function cerrarPanel() {
    state.modo = 'escribiendo';
    renderHeader(els, state, acciones);
    renderPanel(els, state, acciones);
    els.textarea.focus();
  }

  const acciones = {
    abrirPanelFuente() {
      state.modo = 'fuente';
      els.textarea.blur();
      renderHeader(els, state, acciones);
      renderPanel(els, state, acciones);
    },
    abrirPanelColor() {
      state.modo = 'color';
      els.textarea.blur();
      renderHeader(els, state, acciones);
      renderPanel(els, state, acciones);
    },
    cerrarPanel,
    async abrirSelectorMusica() {
      const resultado = await abrirSeleccionarMusica();
      if (resultado) {
        state.trackElegido = resultado.track;
        state.trackInicioMs = resultado.inicioMs;
        renderHeader(els, state, acciones);
        renderChipMusica(els, state, acciones);
      }
    },
    quitarMusica() {
      state.trackElegido = null;
      renderHeader(els, state, acciones);
      renderChipMusica(els, state, acciones);
    },
    async confirmarCerrar() {
      if (els.textarea.value.trim() === '') {
        window.history.back();
        return;
      }
      const salir = await confirmarDescartar();
      if (salir) window.history.back();
    },
    async confirmarYPublicar() {
      const texto = els.textarea.value.trim();
      if (texto === '' || state.publicando) return;

      state.publicando = true;
      renderCompartir(els, state, acciones);

      const blob = await capturarComoPng({
        texto,
        fondo: FONDOS_HISTORIA[state.fondoIndex],
        fuente: FUENTES_HISTORIA[state.fuenteIndex],
      });

      if (!blob) {
        state.publicando = false;
        renderCompartir(els, state, acciones);
        mostrarToast('No se pudo generar la imagen. Intenta de nuevo.', 'error');
        return;
      }

      // abrirPublicarHistoria detecta tipo/extensión a partir de
      // archivo.name — un Blob crudo salido del canvas no trae ese
      // dato, así que se envuelve en un File con nombre explícito
      // antes de pasarlo (mismo criterio en historiasfotosvideos-
      // editar.js para su propia captura de PNG).
      const archivo = new File([blob], 'historia.png', { type: 'image/png' });

      const publicada = await abrirPublicarHistoria({
        archivo,
        trackElegido: state.trackElegido ? mapearPistaASupabase(state.trackElegido) : null,
        trackInicioMs: state.trackInicioMs,
      });

      state.publicando = false;
      renderCompartir(els, state, acciones);

      if (publicada) window.history.back();
    },
  };

  // ── Primer render + listeners (acciones ya está definido arriba) ──
  aplicarFondo(els, state);
  aplicarFuente(els, state);
  renderHeader(els, state, acciones);
  renderPanel(els, state, acciones);
  renderChipMusica(els, state, acciones);
  renderCompartir(els, state, acciones);
  autoresize(els.textarea);

  els.textarea.addEventListener('input', () => {
    autoresize(els.textarea);
    renderCompartir(els, state, acciones);
  });
  els.textarea.addEventListener('focus', () => {
    if (state.modo !== 'escribiendo') cerrarPanel();
  });
}

registrarRuta('/historia-texto', render);

// ═══════════════════════════════════════════════════════════════
// TEMPLATE
// ═══════════════════════════════════════════════════════════════

function plantilla() {
  return `
    <div class="historia-texto">
      <div class="historia-texto__lienzo" data-ht-lienzo>
        <textarea
          class="historia-texto__texto"
          data-ht-texto
          maxlength="${MAX_CARACTERES}"
          placeholder="Escribe algo..."
          rows="1"
          autofocus
        ></textarea>
      </div>

      <div class="historia-texto__header" data-ht-header></div>
      <div class="historia-texto__panel" data-ht-panel></div>
      <div class="historia-texto__chip-musica" data-ht-chip-musica hidden></div>
      <button class="historia-texto__compartir" data-ht-compartir hidden aria-label="Compartir">
        ➜
      </button>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// RENDER — piezas dinámicas
// ═══════════════════════════════════════════════════════════════

function aplicarFondo(els, state) {
  const fondo = FONDOS_HISTORIA[state.fondoIndex];
  els.lienzo.style.background = cssFondo(fondo);
}

async function aplicarFuente(els, state) {
  const fuente = FUENTES_HISTORIA[state.fuenteIndex];
  await cargarFuente(fuente);
  els.textarea.style.fontFamily = fuente.cssFontFamily;
  els.textarea.style.fontWeight = fuente.fontWeight;
  els.textarea.style.fontStyle = fuente.fontStyle;
  els.textarea.style.letterSpacing = fuente.letterSpacing;
  els.textarea.style.fontSize = `${Math.round(30 * fuente.sizeMultiplier)}px`;
}

function renderHeader(els, state, acciones) {
  const fondo = FONDOS_HISTORIA[state.fondoIndex];

  if (state.modo === 'escribiendo') {
    els.header.innerHTML = `
      <button class="historia-texto__btn-circular" data-ht-cerrar aria-label="Cerrar">✕</button>
      <div class="historia-texto__header-derecha">
        <button class="historia-texto__btn-musica${state.trackElegido ? ' historia-texto__btn-musica--activo' : ''}" data-ht-musica aria-label="Música">🎵</button>
        <button class="historia-texto__btn-circular" data-ht-fuente aria-label="Fuente">Aa</button>
        <button class="historia-texto__btn-circular" data-ht-paleta aria-label="Fondo">🎨</button>
      </div>
    `;
    els.header.querySelector('[data-ht-cerrar]').addEventListener('click', acciones.confirmarCerrar);
    els.header.querySelector('[data-ht-musica]').addEventListener('click', acciones.abrirSelectorMusica);
    els.header.querySelector('[data-ht-fuente]').addEventListener('click', acciones.abrirPanelFuente);
    els.header.querySelector('[data-ht-paleta]').addEventListener('click', acciones.abrirPanelColor);
  } else if (state.modo === 'fuente') {
    els.header.innerHTML = `
      <button class="historia-texto__btn-ok" data-ht-ok>OK</button>
      <button class="historia-texto__btn-circular" data-ht-paleta aria-label="Fondo">🎨</button>
    `;
    els.header.querySelector('[data-ht-ok]').addEventListener('click', acciones.cerrarPanel);
    els.header.querySelector('[data-ht-paleta]').addEventListener('click', acciones.abrirPanelColor);
  } else {
    els.header.innerHTML = `
      <button class="historia-texto__btn-ok" data-ht-ok>OK</button>
      <button class="historia-texto__btn-circular" data-ht-fuente aria-label="Fuente">Aa</button>
    `;
    els.header.querySelector('[data-ht-ok]').addEventListener('click', acciones.cerrarPanel);
    els.header.querySelector('[data-ht-fuente]').addEventListener('click', acciones.abrirPanelFuente);
  }
}

function renderPanel(els, state, acciones) {
  if (state.modo === 'fuente') {
    els.panel.hidden = false;
    els.panel.innerHTML = `
      <div class="historia-texto__panel-scroll">
        ${FUENTES_HISTORIA.map((f, i) => `
          <button class="historia-texto__fuente-circulo${i === state.fuenteIndex ? ' historia-texto__fuente-circulo--sel' : ''}"
                  data-ht-fuente-idx="${i}"
                  style="font-family:${f.cssFontFamily};font-weight:${f.fontWeight};font-style:${f.fontStyle}">
            Aa
          </button>
        `).join('')}
      </div>
    `;
    els.panel.querySelectorAll('[data-ht-fuente-idx]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        state.fuenteIndex = Number(btn.dataset.htFuenteIdx);
        await aplicarFuente(els, state);
        renderPanel(els, state, acciones);
      });
    });
  } else if (state.modo === 'color') {
    els.panel.hidden = false;
    els.panel.innerHTML = `
      <div class="historia-texto__panel-scroll">
        ${FONDOS_HISTORIA.map((f, i) => `
          <button class="historia-texto__fondo-swatch${i === state.fondoIndex ? ' historia-texto__fondo-swatch--sel' : ''}"
                  data-ht-fondo-idx="${i}"
                  style="background:${cssFondo(f)}"
                  aria-label="${f.id}">
            ${i === state.fondoIndex ? '✓' : ''}
          </button>
        `).join('')}
      </div>
    `;
    els.panel.querySelectorAll('[data-ht-fondo-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.fondoIndex = Number(btn.dataset.htFondoIdx);
        aplicarFondo(els, state);
        renderHeader(els, state, acciones);
        renderPanel(els, state, acciones);
      });
    });
  } else {
    els.panel.hidden = true;
    els.panel.innerHTML = '';
  }
}

function renderChipMusica(els, state, acciones) {
  if (state.modo !== 'escribiendo' || !state.trackElegido) {
    els.chipMusica.hidden = true;
    els.chipMusica.innerHTML = '';
    return;
  }
  const t = state.trackElegido;
  els.chipMusica.hidden = false;
  els.chipMusica.innerHTML = `
    <span class="historia-texto__chip-texto">🎵 ${escaparHtml(`${t.titulo} • ${t.artista}`)}</span>
    <button class="historia-texto__chip-quitar" data-ht-quitar-musica aria-label="Quitar música">✕</button>
  `;
  els.chipMusica.querySelector('[data-ht-quitar-musica]').addEventListener('click', acciones.quitarMusica);
}

function renderCompartir(els, state, acciones) {
  const hayTexto = els.textarea.value.trim() !== '';
  els.compartir.hidden = state.modo !== 'escribiendo' || !hayTexto;
  els.compartir.disabled = state.publicando;
  els.compartir.textContent = state.publicando ? '…' : '➜';
  els.compartir.onclick = state.publicando ? null : acciones.confirmarYPublicar;
}

// ── auto-grow del textarea (equivalente a maxLines:null del Dart) ──
function autoresize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

// ═══════════════════════════════════════════════════════════════
// Diálogo "¿Descartar historia?"
// ═══════════════════════════════════════════════════════════════

function confirmarDescartar() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'historia-texto__confirmar-overlay';
    overlay.innerHTML = `
      <div class="historia-texto__confirmar-tarjeta">
        <p class="historia-texto__confirmar-titulo">¿Descartar historia?</p>
        <p class="historia-texto__confirmar-texto">Vas a perder el texto que escribiste.</p>
        <div class="historia-texto__confirmar-acciones">
          <button data-ht-seguir>Seguir editando</button>
          <button data-ht-descartar class="historia-texto__confirmar-descartar">Descartar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-ht-seguir]').addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });
    overlay.querySelector('[data-ht-descartar]').addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// Captura del lienzo → PNG (equivalente a _capturarComoPng del Dart)
// ═══════════════════════════════════════════════════════════════

async function capturarComoPng({ texto, fondo, fuente }) {
  try {
    await cargarFuente(fuente);

    const canvas = document.createElement('canvas');
    canvas.width = ANCHO_CANVAS;
    canvas.height = ALTO_CANVAS;
    const ctx = canvas.getContext('2d');

    // ── Fondo ──────────────────────────────────────────────────
    if (fondo.colores.length > 1) {
      const grad = ctx.createLinearGradient(0, 0, ANCHO_CANVAS, ALTO_CANVAS);
      grad.addColorStop(0, fondo.colores[0]);
      grad.addColorStop(1, fondo.colores[1]);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = fondo.colores[0];
    }
    ctx.fillRect(0, 0, ANCHO_CANVAS, ALTO_CANVAS);

    // ── Texto ──────────────────────────────────────────────────
    // ASUNCIÓN: 1080×1920 (9:16) como lienzo fijo — Flutter captura
    // a la resolución real de pantalla del dispositivo (variable);
    // aquí se usa un tamaño estándar de historia en su lugar.
    const font = cssFont(fuente, FONT_SIZE_BASE);
    const maxWidth = ANCHO_CANVAS * 0.86; // ~7% de márgen por lado, análogo al padding:28 del Dart
    dibujarTextoCentrado(ctx, texto, {
      font,
      color: '#FFFFFF',
      lineHeightMultiplier: 1.3,
      maxWidth,
      canvasWidth: ANCHO_CANVAS,
      canvasHeight: ALTO_CANVAS,
    });

    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  } catch (e) {
    console.error('historias-texto – error captura:', e);
    return null;
  }
}

function dibujarTextoCentrado(ctx, texto, { font, color, lineHeightMultiplier, maxWidth, canvasWidth, canvasHeight }) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const match = font.match(/(\d+)px/);
  const fontSizePx = match ? parseInt(match[1], 10) : 56;
  const lineHeightPx = fontSizePx * lineHeightMultiplier;

  // Respeta saltos de línea explícitos (Enter) y además envuelve
  // cada párrafo por ancho — equivalente a TextField(maxLines: null).
  const parrafos = texto.split('\n');
  const lineas = [];
  for (const parrafo of parrafos) {
    if (parrafo === '') { lineas.push(''); continue; }
    const palabras = parrafo.split(' ');
    let actual = '';
    for (const palabra of palabras) {
      const candidata = actual ? `${actual} ${palabra}` : palabra;
      if (ctx.measureText(candidata).width > maxWidth && actual) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = candidata;
      }
    }
    lineas.push(actual);
  }

  const alturaTotal = lineas.length * lineHeightPx;
  let y = (canvasHeight - alturaTotal) / 2 + lineHeightPx / 2;
  for (const linea of lineas) {
    ctx.fillText(linea, canvasWidth / 2, y);
    y += lineHeightPx;
  }
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}