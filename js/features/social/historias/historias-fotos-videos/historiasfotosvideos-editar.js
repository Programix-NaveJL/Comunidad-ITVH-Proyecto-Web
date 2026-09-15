// historiasfotosvideos-editar.js
// Ruta real sugerida: js/features/social/historias/historiasfotosvideos-editar.js
//
// Puerto de historiasfotosvideos_editar.dart (EditarHistoriaScreen,
// v2). Segunda pantalla del flujo "Crear historia": recibe el
// archivo (foto o video) elegido en seleccionar-media.js y permite
// decorarlo antes de publicarlo — texto arrastrable, descripción
// horneada estilo WhatsApp, recorte de encuadre (zoom/pan), toggle
// Ajustar/Cubrir, y recorte de duración para video. No es una ruta
// propia: se abre con abrirEditarHistoria({archivo}) desde
// seleccionar-media.js, igual que publicar-historia.js.
//
// PENDIENTE — música: igual que historias-texto.js, el botón
// "Música" y la pill superior solo muestran un toast "próximamente"
// — SeleccionarMusicaScreen/AudioPreviewService/pista_musical.dart
// (DeezerTrack) no están portados. trackElegido llega siempre null
// a abrirPublicarHistoria() hasta que se conecte.
//
// DIFERENCIA DE PLATAFORMA — InteractiveViewer (pinch-zoom 0.5x-4x +
// arrastre, con recorte duro a los límites del lienzo): no existe un
// widget web equivalente. Se arma a mano con CSS transform
// (translate + scale) sobre el contenedor del medio, dentro de un
// lienzo con overflow:hidden (el recorte duro). El pellizco de dos
// dedos se detecta con Touch Events (distancia entre los dos
// primeros toques); el arrastre con mouse/touch de un dedo. Se
// agregó también zoom con la rueda del mouse SOLO como atajo de
// prueba en escritorio — el Dart original no lo tiene, porque en
// móvil siempre hay pantalla táctil.
//
// DIFERENCIA DE PLATAFORMA — TrimViewer (franja de recorte de
// duración de video): no hay paquete equivalente en el navegador.
// Como el propio Dart aclara que el recorte de duración NO
// re-codifica el video (solo calcula videoInicioMs/videoFinMs que
// se procesan después en el pipeline de subida), aquí basta con una
// barra de tiempo simple: dos manijas arrastrables sobre una pista,
// sin necesidad de FFmpeg ni de ninguna librería de video.
//
// DIFERENCIA DE PLATAFORMA — RepaintBoundary → captura manual en
// <canvas>: en Flutter, _capturarComoPng() fotografía el árbol de
// widgets completo (imagen con su zoom/pan + texto arrastrable +
// descripción) de una sola vez. En web no hay una forma nativa de
// "fotografiar" un <div> tal cual se ve (no se usa ninguna librería
// tipo html2canvas en este proyecto), así que aquí se redibuja todo
// a mano en un <canvas> oculto al momento de publicar — misma
// técnica que ya usa historias-texto.js: se recalculan las mismas
// posiciones/tamaños relativos vistos en pantalla y se pintan en el
// mismo orden. Esto SOLO aplica a fotos; para video, igual que en el
// Dart, se sube el archivo original sin recorte de encuadre ni
// descripción horneada (el recorte de duración sí se aplica, vía
// videoInicioMs/videoFinMs).

import { mostrarToast } from '../../../core/toast.js';
import { abrirPublicarHistoria } from './publicar-historia.js';

const ACCENT = '#0A84FF';
const MAX_RECORTE_MS = 30000;
const COLORES_TEXTO = ['#FFFFFF', '#000000', '#0A84FF', '#FF453A', '#30D158', '#FFD60A', '#FF9F0A', '#BF5AF2'];
const EXTENSIONES_VIDEO = ['mp4', 'mov', 'avi', 'mkv'];

/**
 * Abre el editor de historia (foto o video) a pantalla completa.
 *
 * @param {Object} opciones
 * @param {File} opciones.archivo - archivo elegido en seleccionar-media.js.
 * @returns {Promise<boolean>} true si la historia se publicó.
 */
export function abrirEditarHistoria({ archivo }) {
  return new Promise((resolve) => {
    const extension = (archivo?.name?.split('.').pop() ?? '').toLowerCase();
    const esVideo = (archivo?.type || '').startsWith('video/') || EXTENSIONES_VIDEO.includes(extension);
    const urlObjeto = URL.createObjectURL(archivo);

    const state = {
      texto: '',
      colorTexto: '#FFFFFF',
      tamanoTexto: 24,
      posTexto: { x: 0.5, y: 0.45 },
      descripcion: '',
      modoCubrir: false,
      zoom: 1,
      pan: { x: 0, y: 0 },
      inicioMs: 0,
      finMs: 0,
      duracionMs: null,
      publicando: false,
    };

    const overlay = document.createElement('div');
    overlay.className = 'editar-historia-overlay';
    overlay.innerHTML = plantilla(esVideo);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const elLienzo = overlay.querySelector('[data-eh-lienzo]');
    const elMedio = overlay.querySelector('[data-eh-medio]');
    const elFondoBlur = overlay.querySelector('[data-eh-fondo-blur]');
    const elTextoZona = overlay.querySelector('[data-eh-texto-zona]');
    const elTextoBurbuja = overlay.querySelector('[data-eh-texto-burbuja]');
    const elDescripcionOverlay = overlay.querySelector('[data-eh-descripcion-overlay]');
    const elDescripcionInput = overlay.querySelector('[data-eh-descripcion-input]');
    const elTrimZona = overlay.querySelector('[data-eh-trim]');
    const elCompartir = overlay.querySelector('[data-eh-compartir]');
    const elCubrirBtn = overlay.querySelector('[data-eh-cubrir]');
    const elPillMusica = overlay.querySelector('[data-eh-pill-musica]');
    const elBtnTexto = overlay.querySelector('[data-eh-btn-texto]');
    const elBtnMusica = overlay.querySelector('[data-eh-btn-musica]');
    const elBtnCerrar = overlay.querySelector('[data-eh-cerrar]');

    let videoEl = null;
    let cerrado = false;

    function cerrar(resultado) {
      if (cerrado) return;
      cerrado = true;
      videoEl?.pause();
      overlay.classList.remove('visible');
      setTimeout(() => {
        overlay.remove();
        URL.revokeObjectURL(urlObjeto);
      }, 200);
      resolve(resultado);
    }

    // ── Preview del medio (imagen o video) ──────────────────────
    if (esVideo) {
      videoEl = document.createElement('video');
      videoEl.className = 'editar-historia__video';
      videoEl.src = urlObjeto;
      videoEl.loop = true;
      videoEl.playsInline = true;
      elMedio.appendChild(videoEl);
      videoEl.addEventListener('loadedmetadata', () => {
        // Mismo criterio que el Dart: el default del recorte se
        // calcula con la duración REAL del video (clip completo si
        // dura menos de 30s, primeros 30s si dura más) — nunca un
        // valor fijo que pudiera no coincidir con el video real.
        const duracionMs = videoEl.duration * 1000;
        state.duracionMs = duracionMs;
        state.inicioMs = 0;
        state.finMs = duracionMs > MAX_RECORTE_MS ? MAX_RECORTE_MS : duracionMs;
        renderTrim();
        videoEl.play().catch(() => {});
      });
    } else {
      const img = document.createElement('img');
      img.className = 'editar-historia__imagen';
      img.src = urlObjeto;
      elMedio.appendChild(img);

      const imgBlur = document.createElement('img');
      imgBlur.src = urlObjeto;
      elFondoBlur.appendChild(imgBlur);
    }

    aplicarTransformMedio();
    aplicarModoCubrir();
    if (!esVideo) activarZoomPan();
    activarArrastreTexto();

    // ── Interacciones fijas ──────────────────────────────────────
    elBtnCerrar.addEventListener('click', () => cerrar(false));

    elCubrirBtn.addEventListener('click', () => {
      state.modoCubrir = !state.modoCubrir;
      aplicarModoCubrir();
      elCubrirBtn.classList.toggle('editar-historia__btn-circular--activo', state.modoCubrir);
      elCubrirBtn.textContent = state.modoCubrir ? '🌫️' : '⛶';
    });

    elBtnMusica.addEventListener('click', abrirMusicaPlaceholder);
    elPillMusica.addEventListener('click', abrirMusicaPlaceholder);
    elBtnTexto.addEventListener('click', abrirEditorTexto);

    elDescripcionInput.addEventListener('input', () => {
      state.descripcion = elDescripcionInput.value;
      renderDescripcionOverlay();
    });

    elCompartir.addEventListener('click', confirmarYPublicar);

    function abrirMusicaPlaceholder() {
      // TODO: pendiente SeleccionarMusicaScreen/AudioPreviewService/
      // pista_musical.dart — ver nota de DIFERENCIA DE PLATAFORMA al
      // inicio del archivo (mismo criterio que historias-texto.js).
      mostrarToast('Selector de música — próximamente', 'error');
    }

    // ── Editor de texto (hoja modal) ─────────────────────────────
    function abrirEditorTexto() {
      const modal = document.createElement('div');
      modal.className = 'editar-historia-texto-modal-overlay';
      modal.innerHTML = `
        <div class="editar-historia-texto-modal">
          <div class="editar-historia-texto-modal__manija"></div>
          <textarea
            class="editar-historia-texto-modal__textarea"
            data-eh-modal-textarea
            maxlength="120"
            rows="3"
            placeholder="Escribe algo para tu historia..."
          >${escaparHtml(state.texto)}</textarea>
          <div class="editar-historia-texto-modal__tamano">
            <span class="editar-historia-texto-modal__tamano-icono editar-historia-texto-modal__tamano-icono--chico">A</span>
            <input type="range" min="14" max="52" value="${state.tamanoTexto}" data-eh-modal-tamano />
            <span class="editar-historia-texto-modal__tamano-icono editar-historia-texto-modal__tamano-icono--grande">A</span>
          </div>
          <p class="editar-historia-texto-modal__label">Color del texto</p>
          <div class="editar-historia-texto-modal__colores">
            ${COLORES_TEXTO.map(
              (c) => `
              <button
                class="editar-historia-texto-modal__color${c === state.colorTexto ? ' editar-historia-texto-modal__color--sel' : ''}"
                data-eh-modal-color="${c}"
                style="background:${c}"
                aria-label="Color ${c}"
              ></button>
            `
            ).join('')}
          </div>
          <button class="editar-historia-texto-modal__listo" data-eh-modal-listo>Listo</button>
        </div>
      `;
      document.body.appendChild(modal);
      requestAnimationFrame(() => modal.classList.add('visible'));

      const elTextarea = modal.querySelector('[data-eh-modal-textarea]');
      const elTamano = modal.querySelector('[data-eh-modal-tamano]');
      let colorSel = state.colorTexto;
      let tamanoSel = state.tamanoTexto;

      elTextarea.focus();
      elTextarea.setSelectionRange(elTextarea.value.length, elTextarea.value.length);

      elTamano.addEventListener('input', () => {
        tamanoSel = Number(elTamano.value);
      });

      modal.querySelectorAll('[data-eh-modal-color]').forEach((btn) => {
        btn.addEventListener('click', () => {
          colorSel = btn.dataset.ehModalColor;
          modal.querySelectorAll('[data-eh-modal-color]').forEach((b) => b.classList.remove('editar-historia-texto-modal__color--sel'));
          btn.classList.add('editar-historia-texto-modal__color--sel');
        });
      });

      function cerrarModal() {
        modal.classList.remove('visible');
        setTimeout(() => modal.remove(), 150);
      }

      modal.querySelector('[data-eh-modal-listo]').addEventListener('click', () => {
        state.texto = elTextarea.value;
        state.colorTexto = colorSel;
        state.tamanoTexto = tamanoSel;
        renderTextoBurbuja();
        cerrarModal();
      });

      modal.addEventListener('click', (evento) => {
        if (evento.target === modal) cerrarModal();
      });
    }

    // ── Texto arrastrable — render + posicionamiento ─────────────

    function renderTextoBurbuja() {
      const hayTexto = state.texto.trim() !== '';
      elTextoZona.hidden = !hayTexto;
      if (!hayTexto) return;
      elTextoBurbuja.textContent = state.texto;
      elTextoBurbuja.style.color = state.colorTexto;
      elTextoBurbuja.style.fontSize = `${state.tamanoTexto}px`;
      posicionarTexto();
    }

    function posicionarTexto() {
      elTextoBurbuja.style.left = `${state.posTexto.x * 100}%`;
      elTextoBurbuja.style.top = `${state.posTexto.y * 100}%`;
    }

    function activarArrastreTexto() {
      let arrastrando = false;
      let origen = null;
      let posOrigen = null;

      function puntoXY(evento) {
        if (evento.touches) return { x: evento.touches[0].clientX, y: evento.touches[0].clientY };
        return { x: evento.clientX, y: evento.clientY };
      }

      function iniciar(evento) {
        if (elTextoZona.hidden) return;
        arrastrando = true;
        origen = puntoXY(evento);
        posOrigen = { ...state.posTexto };
      }

      function mover(evento) {
        if (!arrastrando) return;
        const p = puntoXY(evento);
        const rect = elLienzo.getBoundingClientRect();
        const deltaX = (p.x - origen.x) / rect.width;
        const deltaY = (p.y - origen.y) / rect.height;
        state.posTexto = {
          x: Math.min(0.92, Math.max(0.08, posOrigen.x + deltaX)),
          y: Math.min(0.92, Math.max(0.04, posOrigen.y + deltaY)),
        };
        posicionarTexto();
      }

      function soltar() {
        arrastrando = false;
      }

      elTextoZona.addEventListener('mousedown', iniciar);
      elTextoZona.addEventListener('touchstart', iniciar, { passive: true });
      window.addEventListener('mousemove', mover);
      window.addEventListener('touchmove', mover, { passive: true });
      window.addEventListener('mouseup', soltar);
      window.addEventListener('touchend', soltar);
    }

    // ── Descripción horneada, estilo WhatsApp ────────────────────

    function renderDescripcionOverlay() {
      const hay = state.descripcion.trim() !== '';
      elDescripcionOverlay.hidden = !hay;
      if (hay) elDescripcionOverlay.textContent = state.descripcion;
    }

    // ── Ajustar/Cubrir ────────────────────────────────────────────

    function aplicarModoCubrir() {
      if (esVideo) {
        // Para video no hay truco de blur (el Dart tampoco lo usa
        // aquí): Cubrir simplemente cambia el ajuste del propio
        // <video> de "contener" a "llenar recortando bordes".
        if (videoEl) videoEl.style.objectFit = state.modoCubrir ? 'cover' : 'contain';
        return;
      }
      elFondoBlur.hidden = !state.modoCubrir;
    }

    // ── Zoom/pan del medio — ver DIFERENCIA DE PLATAFORMA arriba ──

    function aplicarTransformMedio() {
      elMedio.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;
    }

    function activarZoomPan() {
      const pointers = new Map();
      let lastDist = null;
      let zoomStart = 1;
      let dragOrigin = null;
      let panStart = null;

      function distanciaEntrePointers() {
        const [a, b] = pointers.values();
        return Math.hypot(a.x - b.x, a.y - b.y);
      }

      elLienzo.addEventListener(
        'touchstart',
        (e) => {
          for (const t of e.touches) pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
          if (pointers.size === 2) {
            lastDist = distanciaEntrePointers();
            zoomStart = state.zoom;
          } else if (pointers.size === 1) {
            const [p] = pointers.values();
            dragOrigin = { x: p.x, y: p.y };
            panStart = { ...state.pan };
          }
        },
        { passive: true }
      );

      elLienzo.addEventListener(
        'touchmove',
        (e) => {
          for (const t of e.touches) pointers.set(t.identifier, { x: t.clientX, y: t.clientY });
          if (pointers.size === 2 && lastDist != null) {
            const dist = distanciaEntrePointers();
            state.zoom = Math.min(4, Math.max(0.5, zoomStart * (dist / lastDist)));
            aplicarTransformMedio();
          } else if (pointers.size === 1 && dragOrigin) {
            const [p] = pointers.values();
            state.pan = {
              x: panStart.x + (p.x - dragOrigin.x),
              y: panStart.y + (p.y - dragOrigin.y),
            };
            aplicarTransformMedio();
          }
        },
        { passive: true }
      );

      const limpiarPointers = (e) => {
        for (const t of e.changedTouches) pointers.delete(t.identifier);
        if (pointers.size < 2) lastDist = null;
        if (pointers.size === 0) dragOrigin = null;
      };
      elLienzo.addEventListener('touchend', limpiarPointers);
      elLienzo.addEventListener('touchcancel', limpiarPointers);

      // Arrastre con mouse (equivalente de un dedo) + rueda como
      // atajo de zoom SOLO para pruebas de escritorio — ver nota de
      // DIFERENCIA DE PLATAFORMA al inicio del archivo.
      let arrastrandoMouse = false;
      let mouseOrigin = null;
      let panOrigenMouse = null;

      elLienzo.addEventListener('mousedown', (e) => {
        if (e.target.closest('[data-eh-texto-zona]')) return;
        arrastrandoMouse = true;
        mouseOrigin = { x: e.clientX, y: e.clientY };
        panOrigenMouse = { ...state.pan };
      });
      window.addEventListener('mousemove', (e) => {
        if (!arrastrandoMouse) return;
        state.pan = {
          x: panOrigenMouse.x + (e.clientX - mouseOrigin.x),
          y: panOrigenMouse.y + (e.clientY - mouseOrigin.y),
        };
        aplicarTransformMedio();
      });
      window.addEventListener('mouseup', () => {
        arrastrandoMouse = false;
      });
      elLienzo.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.08 : 0.08;
          state.zoom = Math.min(4, Math.max(0.5, state.zoom + delta));
          aplicarTransformMedio();
        },
        { passive: false }
      );
    }

    // ── Recorte de duración de video — franja custom ─────────────

    function renderTrim() {
      if (!esVideo || !elTrimZona) return;
      elTrimZona.hidden = false;
      if (!elTrimZona.dataset.montado) {
        elTrimZona.dataset.montado = '1';
        elTrimZona.innerHTML = `
          <div class="editar-historia__trim-pista" data-eh-trim-pista>
            <div class="editar-historia__trim-seleccion" data-eh-trim-sel></div>
            <div class="editar-historia__trim-manija editar-historia__trim-manija--inicio" data-eh-trim-inicio></div>
            <div class="editar-historia__trim-manija editar-historia__trim-manija--fin" data-eh-trim-fin></div>
          </div>
        `;
        activarArrastreTrim();
      }
      actualizarPosicionesTrim();
    }

    function actualizarPosicionesTrim() {
      if (!state.duracionMs) return;
      const sel = elTrimZona.querySelector('[data-eh-trim-sel]');
      const mInicio = elTrimZona.querySelector('[data-eh-trim-inicio]');
      const mFin = elTrimZona.querySelector('[data-eh-trim-fin]');
      const pIni = (state.inicioMs / state.duracionMs) * 100;
      const pFin = (state.finMs / state.duracionMs) * 100;
      sel.style.left = `${pIni}%`;
      sel.style.width = `${pFin - pIni}%`;
      mInicio.style.left = `${pIni}%`;
      mFin.style.left = `${pFin}%`;
    }

    function activarArrastreTrim() {
      const pista = elTrimZona.querySelector('[data-eh-trim-pista]');
      const mInicio = elTrimZona.querySelector('[data-eh-trim-inicio]');
      const mFin = elTrimZona.querySelector('[data-eh-trim-fin]');

      function puntoX(evento) {
        return evento.touches ? evento.touches[0].clientX : evento.clientX;
      }

      function iniciarArrastre(cual) {
        return () => {
          const mover = (ev) => {
            if (!state.duracionMs) return;
            const rect = pista.getBoundingClientRect();
            const frac = Math.min(1, Math.max(0, (puntoX(ev) - rect.left) / rect.width));
            const ms = frac * state.duracionMs;
            if (cual === 'inicio') {
              state.inicioMs = Math.min(ms, state.finMs - 1000);
              if (state.finMs - state.inicioMs > MAX_RECORTE_MS) state.finMs = state.inicioMs + MAX_RECORTE_MS;
            } else {
              state.finMs = Math.max(ms, state.inicioMs + 1000);
              if (state.finMs - state.inicioMs > MAX_RECORTE_MS) state.inicioMs = state.finMs - MAX_RECORTE_MS;
            }
            state.inicioMs = Math.max(0, state.inicioMs);
            state.finMs = Math.min(state.duracionMs, state.finMs);
            actualizarPosicionesTrim();
          };
          const soltar = () => {
            window.removeEventListener('mousemove', mover);
            window.removeEventListener('touchmove', mover);
            window.removeEventListener('mouseup', soltar);
            window.removeEventListener('touchend', soltar);
          };
          window.addEventListener('mousemove', mover);
          window.addEventListener('touchmove', mover, { passive: true });
          window.addEventListener('mouseup', soltar);
          window.addEventListener('touchend', soltar);
        };
      }

      mInicio.addEventListener('mousedown', iniciarArrastre('inicio'));
      mInicio.addEventListener('touchstart', iniciarArrastre('inicio'), { passive: true });
      mFin.addEventListener('mousedown', iniciarArrastre('fin'));
      mFin.addEventListener('touchstart', iniciarArrastre('fin'), { passive: true });
    }

    // ── Confirmar y publicar ──────────────────────────────────────

    async function confirmarYPublicar() {
      if (state.publicando) return;
      state.publicando = true;
      elCompartir.disabled = true;
      videoEl?.pause();

      let archivoFinal;
      if (esVideo) {
        // El video nunca se recaptura (no hay redibujo posible de un
        // <video> con audio en <canvas> sin perder el audio); se sube
        // el archivo original. Ni el recorte de encuadre (zoom/pan)
        // ni la descripción horneada aplican todavía a video — ver
        // nota de DIFERENCIA DE PLATAFORMA al inicio del archivo.
        // Solo el recorte de DURACIÓN (inicioMs/finMs) se procesa
        // después, en el pipeline de subida.
        archivoFinal = archivo;
      } else {
        // Para fotos SIEMPRE se captura el lienzo completo — no solo
        // cuando hay texto o descripción. El usuario pudo haber hecho
        // pinch-zoom/pan para recortar el encuadre, y ese recorte
        // solo queda aplicado de verdad si se redibuja; subir el
        // archivo original se saltaría cualquier ajuste hecho con
        // los dedos.
        const blob = await capturarComoPng();
        if (!blob) {
          state.publicando = false;
          elCompartir.disabled = false;
          mostrarToast('No se pudo generar la imagen. Intenta de nuevo.', 'error');
          return;
        }
        archivoFinal = new File([blob], 'historia.png', { type: 'image/png' });
      }

      const publicada = await abrirPublicarHistoria({
        archivo: archivoFinal,
        trackElegido: null,
        trackInicioMs: 0,
        videoInicioMs: esVideo ? Math.round(state.inicioMs) : null,
        videoFinMs: esVideo ? Math.round(state.finMs) : null,
      });

      if (publicada) {
        cerrar(true);
      } else {
        state.publicando = false;
        elCompartir.disabled = false;
        videoEl?.play().catch(() => {});
      }
    }

    // ── Captura del lienzo → PNG (equivalente a _capturarComoPng) ──

    async function capturarComoPng() {
      try {
        const cw = elLienzo.clientWidth;
        const ch = elLienzo.clientHeight;
        const factor = 2; // equivalente a pixelRatio: 2.0 del Dart

        const canvas = document.createElement('canvas');
        canvas.width = cw * factor;
        canvas.height = ch * factor;
        const ctx = canvas.getContext('2d');
        ctx.scale(factor, factor);

        // Fondo negro, igual que el Scaffold del Dart original.
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, cw, ch);

        const img = elMedio.querySelector('img.editar-historia__imagen');
        if (!img || !img.complete) return null;

        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        // "contain" del medio dentro del lienzo, igual que
        // BoxFit.contain — mismo cálculo que usa el CSS en vivo.
        const baseScale = Math.min(cw / iw, ch / ih);
        const bw = iw * baseScale;
        const bh = ih * baseScale;

        ctx.save();
        ctx.translate(cw / 2 + state.pan.x, ch / 2 + state.pan.y);
        ctx.scale(state.zoom, state.zoom);

        if (state.modoCubrir) {
          // Fondo desenfocado cover-fit, dentro del mismo árbol que
          // se pellizca/arrastra — igual que el Dart, donde el blur
          // vive dentro del mismo Stack afectado por el zoom exterior.
          const coverScale = Math.max(cw / iw, ch / ih);
          const cwImg = iw * coverScale;
          const chImg = ih * coverScale;
          ctx.save();
          ctx.filter = 'blur(22px)';
          ctx.drawImage(img, -cwImg / 2, -chImg / 2, cwImg, chImg);
          ctx.restore();
        }

        ctx.drawImage(img, -bw / 2, -bh / 2, bw, bh);
        ctx.restore();

        // Texto arrastrable — misma posición relativa (0–1) vista en
        // pantalla.
        if (state.texto.trim() !== '') {
          dibujarTextoArrastrable(ctx, state.posTexto.x * cw, state.posTexto.y * ch, cw);
        }

        // Descripción horneada, estilo WhatsApp — posición fija cerca
        // del borde inferior, igual que _buildOverlayDescripcion.
        if (state.descripcion.trim() !== '') {
          dibujarDescripcion(ctx, cw, ch);
        }

        return await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      } catch (e) {
        console.error('editar-historia – error captura:', e);
        return null;
      }
    }

    function dibujarTextoArrastrable(ctx, x, y, anchoLienzo) {
      const maxWidth = anchoLienzo * 0.85;
      ctx.font = `600 ${state.tamanoTexto}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const lineas = envolverTexto(ctx, state.texto, maxWidth);
      const lineHeight = state.tamanoTexto * 1.25;
      const padV = 6;
      const padH = 12;
      const anchoTexto = Math.max(...lineas.map((l) => ctx.measureText(l).width));
      const altoTotal = lineas.length * lineHeight;

      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      redondearRect(ctx, x - anchoTexto / 2 - padH, y - altoTotal / 2 - padV, anchoTexto + padH * 2, altoTotal + padV * 2, 8);
      ctx.fill();

      ctx.fillStyle = state.colorTexto;
      ctx.shadowColor = 'rgba(0,0,0,0.54)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      let yy = y - altoTotal / 2 + lineHeight / 2;
      for (const linea of lineas) {
        ctx.fillText(linea, x, yy);
        yy += lineHeight;
      }
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    function dibujarDescripcion(ctx, cw, ch) {
      const fontSize = 15;
      ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const maxWidth = cw - 48;
      const lineas = envolverTexto(ctx, state.descripcion, maxWidth);
      const lineHeight = fontSize * 1.3;
      const padV = 10;
      const padH = 14;
      const anchoTexto = Math.max(...lineas.map((l) => ctx.measureText(l).width));
      const altoTotal = lineas.length * lineHeight;
      // Mismo offset fijo desde el fondo del lienzo que
      // _buildOverlayDescripcion en el Dart original (200 en foto,
      // 290 en video — aunque para video esta función no se llama).
      const bottomOffset = 200;
      const cx = cw / 2;
      const cy = ch - bottomOffset - altoTotal / 2;

      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      redondearRect(ctx, cx - anchoTexto / 2 - padH, cy - altoTotal / 2 - padV, anchoTexto + padH * 2, altoTotal + padV * 2, 14);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0,0,0,0.54)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      let yy = cy - altoTotal / 2 + lineHeight / 2;
      for (const linea of lineas) {
        ctx.fillText(linea, cx, yy);
        yy += lineHeight;
      }
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// HELPERS DE CANVAS
// ═══════════════════════════════════════════════════════════════

function envolverTexto(ctx, texto, maxWidth) {
  const parrafos = texto.split('\n');
  const lineas = [];
  for (const parrafo of parrafos) {
    if (parrafo === '') {
      lineas.push('');
      continue;
    }
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
  return lineas;
}

function redondearRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE
// ═══════════════════════════════════════════════════════════════

function plantilla(esVideo) {
  return `
    <div class="editar-historia">
      <div class="editar-historia__lienzo" data-eh-lienzo>
        ${esVideo ? '' : '<div class="editar-historia__fondo-blur" data-eh-fondo-blur hidden></div>'}
        <div class="editar-historia__medio" data-eh-medio></div>

        <div class="editar-historia__texto-zona" data-eh-texto-zona hidden>
          <div class="editar-historia__texto-burbuja" data-eh-texto-burbuja></div>
        </div>

        <div class="editar-historia__descripcion-overlay" data-eh-descripcion-overlay hidden></div>
      </div>

      <div class="editar-historia__gradiente editar-historia__gradiente--arriba"></div>
      <div class="editar-historia__gradiente editar-historia__gradiente--abajo"></div>

      <button class="editar-historia__btn-circular editar-historia__volver" data-eh-cerrar aria-label="Cerrar">←</button>

      <div class="editar-historia__pill-musica-zona">
        <button class="editar-historia__pill-musica" data-eh-pill-musica>
          <span>🎵</span><span>Agregar música</span>
        </button>
      </div>

      <button class="editar-historia__btn-circular editar-historia__ajustar" data-eh-cubrir aria-label="Ajustar o cubrir">⛶</button>

      ${esVideo ? '<div class="editar-historia__trim" data-eh-trim hidden></div>' : ''}

      <div class="editar-historia__panel-inferior">
        <div class="editar-historia__herramientas">
          <button class="editar-historia__herramienta" data-eh-btn-musica>
            <span class="editar-historia__herramienta-circulo">🎵</span>
            <span>Música</span>
          </button>
          <button class="editar-historia__herramienta" data-eh-btn-texto>
            <span class="editar-historia__herramienta-circulo">Aa</span>
            <span>Texto</span>
          </button>
        </div>

        <div class="editar-historia__descripcion-campo">
          <input type="text" data-eh-descripcion-input maxlength="150" placeholder="Agrega una descripción..." autocomplete="off" />
        </div>

        <div class="editar-historia__audiencia-fila">
          <div class="editar-historia__audiencia-chip">
            <span>👤</span><span>Tu historia</span>
          </div>
          <button class="editar-historia__compartir" data-eh-compartir aria-label="Compartir">➜</button>
        </div>
      </div>
    </div>
  `;
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}