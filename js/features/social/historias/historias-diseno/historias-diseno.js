// historias-diseno.js
// Ruta real: js/features/social/historias/historias-diseno/historias-diseno.js
//
// Puerto de EditarHistoriaDiseno.dart (v12) — colage de hasta 6 fotos
// con 6 plantillas ajustables + música opcional.
//
// ADAPTACIONES OBLIGADAS respecto al Dart (mismo criterio que las
// notas de seleccionar-media.js): el navegador no puede leer ni
// paginar la galería del dispositivo como photo_manager, así que:
//   • Fase 1 YA NO ES un grid con miniaturas del device — es
//     <input type="file" multiple accept="image/*"> (mismo criterio
//     que "Elegir de mi dispositivo" en seleccionar-media.js). El
//     orden de `seleccionadas` es el orden en que el picker nativo
//     devuelve los archivos (normalmente el orden de tap del
//     usuario, aunque el navegador no lo garantiza formalmente).
//   • `_HojaSeleccionarFoto` (grid con scroll infinito para llenar/
//     reemplazar una celda en Fase 2) se sustituye por un
//     <input type="file"> de UN solo archivo: no existe forma de
//     reabrir "la misma galería" filtrada dentro de una hoja modal
//     en la web, así que cada agregar/reemplazar celda abre el
//     picker nativo de nuevo.
//   • El pellizco/arrastre por celda (ScaleGestureDetector) se hace
//     con Pointer Events (mouse y touch a la vez, sin ramas
//     separadas) + rueda del mouse como equivalente desktop del
//     pellizco.
//   • La captura final (RenderRepaintBoundary → PNG) se hace
//     dibujando cada celda en un <canvas> de 1080×1920 (9:16) y
//     exportando con toBlob('image/png'). El pan/zoom de cada celda
//     se guarda como FRACCIÓN del tamaño de la celda (no en píxeles
//     de pantalla) para que el canvas de exportación reproduzca
//     exactamente lo que se ve, sin importar el tamaño de pantalla
//     en el que se editó.
//
// Todo lo demás — las 6 plantillas, su estructura de filas/columnas,
// el mínimo de 1 / máximo de 6 fotos, reemplazo de celdas ya
// ocupadas, música opcional que NO se hornea en el PNG — se porta
// igual que en el Dart.
//
// TODO INTEGRACIÓN (ajustar si el nombre/ruta real difiere):
//   • Música: se asume que
//     '../servicio-musica/seleccionar-musica.js' exporta
//     `abrirSeleccionarMusica()` y resuelve
//     { track: {titulo, artista}, inicioMs } | null — mismo
//     contrato que SeleccionarMusicaScreen.abrirComoHoja en el Dart.
//   • Publicar: se asume que '../publicar-historia.js' exporta
//     `abrirPublicarHistoria({ blob, extension, trackElegido,
//     trackInicioMs })` y resuelve `true` si se publicó — mismo
//     contrato que PublicarHistoriaScreen del Dart.

import { registrarRuta, navegarA } from '../../../../core/router.js';
import { mapearPistaASupabase } from '../servicio-musica/pista-musical.js';

const MAX_FOTOS = 6;
const ANCHO_SALIDA = 1080;
const ALTO_SALIDA = 1920;

// ── Plantillas — misma estructura que _estructuraPlantilla en Dart:
// lista de filas, cada una con su número de columnas y su peso de
// altura (flex).
const PLANTILLAS = {
  dosFilas: [{ columnas: 1, flex: 1 }, { columnas: 1, flex: 1 }],
  tresFilas: [{ columnas: 1, flex: 1 }, { columnas: 1, flex: 1 }, { columnas: 1, flex: 1 }],
  unaArribaDosAbajo: [{ columnas: 1, flex: 1 }, { columnas: 2, flex: 2 }],
  cuadro2x2: [{ columnas: 2, flex: 1 }, { columnas: 2, flex: 1 }],
  cinco: [{ columnas: 2, flex: 1 }, { columnas: 1, flex: 1 }, { columnas: 2, flex: 1 }],
  seis: [{ columnas: 2, flex: 1 }, { columnas: 2, flex: 1 }, { columnas: 2, flex: 1 }],
};

const ORDEN_PLANTILLAS = ['dosFilas', 'tresFilas', 'unaArribaDosAbajo', 'cuadro2x2', 'cinco', 'seis'];

function celdasPlantilla(nombre) {
  return PLANTILLAS[nombre].reduce((s, f) => s + f.columnas, 0);
}

function plantillaPorDefecto(n) {
  switch (n) {
    case 1:
    case 4: return 'cuadro2x2';
    case 2: return 'dosFilas';
    case 3: return 'tresFilas';
    case 5: return 'cinco';
    default: return 'seis';
  }
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

registrarRuta('/historia-diseno', render);

function render(contenedor) {
  const estado = {
    seleccionadas: [],   // { file, url, escala, offsetXFrac, offsetYFrac }
    enPlantilla: false,
    plantilla: null,
    trackElegido: null,
    trackInicioMs: 0,
    publicando: false,
    hintVisible: true,
  };

  contenedor.innerHTML = `<div class="historia-diseno" id="hd-root"></div>`;
  const root = contenedor.querySelector('#hd-root');

  function renderFase() {
    root.innerHTML = estado.enPlantilla ? faseTemplateHtml(estado) : faseSeleccionHtml(estado);
    if (estado.enPlantilla) activarFasePlantilla(root, estado, renderFase);
    else activarFaseSeleccion(root, estado, renderFase);
  }

  renderFase();
}

// ══════════════════════════════════════════════════════════
// FASE 1 — Selección de fotos (input file en vez de galería propia)
// ══════════════════════════════════════════════════════════
function faseSeleccionHtml(estado) {
  const n = estado.seleccionadas.length;
  const subtitulo = n === 0
    ? 'Selecciona hasta 6 fotos para tu diseño'
    : n === 1
      ? '1 foto elegida — lista para continuar'
      : `${n} fotos elegidas — listo para continuar`;

  return `
    <div class="hd-header">
      <button class="hd-icono-btn" data-cerrar aria-label="Cerrar">✕</button>
      <p class="hd-titulo">Inicia tu diseño</p>
      <button class="hd-siguiente" data-siguiente ${n === 0 ? 'disabled' : ''}>Siguiente</button>
    </div>
    <p class="hd-subtitulo ${n > 0 ? 'hd-subtitulo--activo' : ''}">${subtitulo}</p>

    ${n === 0 ? `
      <div class="hd-vacio">
        <button class="hd-elegir-btn" data-elegir>🖼️ Elegir fotos de mi dispositivo</button>
        <p class="hd-vacio__nota">Hasta 6 fotos, en el orden en que las elijas</p>
      </div>
    ` : `
      <div class="hd-grid">
        ${estado.seleccionadas.map((f, i) => `
          <div class="hd-celda-sel">
            <img src="${f.url}" alt="" />
            <span class="hd-celda-sel__orden">${i + 1}</span>
            <button class="hd-celda-sel__quitar" data-quitar="${i}" aria-label="Quitar">✕</button>
          </div>
        `).join('')}
        ${n < MAX_FOTOS ? `<button class="hd-celda-agregar" data-elegir-mas>+</button>` : ''}
      </div>
    `}

    <input type="file" accept="image/*" multiple class="hd-input-oculto" data-input-fotos hidden />
  `;
}

function activarFaseSeleccion(root, estado, renderFase) {
  root.querySelector('[data-cerrar]').addEventListener('click', () => confirmarSalida(estado));
  root.querySelector('[data-siguiente]')?.addEventListener('click', () => {
    if (estado.seleccionadas.length === 0) return;
    estado.plantilla = estado.plantilla || plantillaPorDefecto(estado.seleccionadas.length);
    estado.enPlantilla = true;
    renderFase();
  });

  const input = root.querySelector('[data-input-fotos]');
  const disparar = () => input.click();
  root.querySelector('[data-elegir]')?.addEventListener('click', disparar);
  root.querySelector('[data-elegir-mas]')?.addEventListener('click', disparar);

  input.addEventListener('change', () => {
    const restante = MAX_FOTOS - estado.seleccionadas.length;
    const archivos = Array.from(input.files ?? []).slice(0, restante);
    archivos.forEach((file) => {
      estado.seleccionadas.push({ file, url: URL.createObjectURL(file), escala: 1, offsetXFrac: 0, offsetYFrac: 0 });
    });
    input.value = '';
    renderFase();
  });

  root.querySelectorAll('[data-quitar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.quitar);
      URL.revokeObjectURL(estado.seleccionadas[i].url);
      estado.seleccionadas.splice(i, 1);
      renderFase();
    });
  });
}

// ══════════════════════════════════════════════════════════
// FASE 2 — Plantilla / colage ajustable
// ══════════════════════════════════════════════════════════
function faseTemplateHtml(estado) {
  return `
    <div class="hd-header hd-header--plantilla">
      <button class="hd-icono-btn" data-volver aria-label="Regresar">‹</button>
      <div class="hd-header__acciones">
        <button class="hd-icono-btn ${estado.trackElegido ? 'hd-icono-btn--activo' : ''}" data-musica aria-label="Música">🎵</button>
        <button class="hd-ok-btn" data-confirmar ${estado.publicando ? 'disabled' : ''}>
          ${estado.publicando ? '<span class="hd-spinner"></span>' : 'OK'}
        </button>
      </div>
    </div>

    <div class="hd-lienzo-wrap">
      <div class="hd-lienzo" id="hd-lienzo"></div>
      ${estado.hintVisible ? `<div class="hd-hint">Arrastra y usa la rueda/pellizco para ajustar · toca para cambiar la foto</div>` : ''}
    </div>

    ${estado.trackElegido ? `
      <div class="hd-pildora-musica">
        🎵 <span>${estado.trackElegido.titulo} — ${estado.trackElegido.artista}</span>
        <button data-quitar-musica aria-label="Quitar música">✕</button>
      </div>
    ` : ''}

    <div class="hd-plantillas">
      ${ORDEN_PLANTILLAS.map((p) => `
        <button class="hd-plantilla-btn ${p === estado.plantilla ? 'hd-plantilla-btn--activo' : ''}" data-plantilla="${p}">
          ${previewPlantillaSvg(p, p === estado.plantilla)}
        </button>
      `).join('')}
    </div>

    <input type="file" accept="image/*" class="hd-input-oculto" data-input-celda hidden />
  `;
}

function previewPlantillaSvg(nombre, activo) {
  const filas = PLANTILLAS[nombre];
  const color = activo ? '#fff' : 'rgba(255,255,255,0.6)';
  const totalFlex = filas.reduce((s, f) => s + f.flex, 0);
  let y = 0;
  const rects = [];
  filas.forEach((fila) => {
    const alto = (36 / totalFlex) * fila.flex;
    const ancho = 36 / fila.columnas;
    for (let c = 0; c < fila.columnas; c++) {
      rects.push(`<rect x="${c * ancho + 1}" y="${y + 1}" width="${ancho - 2}" height="${alto - 2}" rx="1.5" fill="${color}" />`);
    }
    y += alto;
  });
  return `<svg viewBox="0 0 36 36" width="26" height="26">${rects.join('')}</svg>`;
}

function activarFasePlantilla(root, estado, renderFase) {
  root.querySelector('[data-volver]').addEventListener('click', () => {
    estado.enPlantilla = false;
    renderFase();
  });

  root.querySelector('[data-musica]').addEventListener('click', async () => {
    try {
      const { abrirSeleccionarMusica } = await import('../servicio-musica/seleccionar-musica.js');
      const resultado = await abrirSeleccionarMusica();
      if (!resultado) return;
      estado.trackElegido = resultado.track;
      estado.trackInicioMs = resultado.inicioMs;
      renderFase();
    } catch (e) {
      console.error('historias-diseno – música no disponible:', e);
    }
  });
  root.querySelector('[data-quitar-musica]')?.addEventListener('click', () => {
    estado.trackElegido = null;
    estado.trackInicioMs = 0;
    renderFase();
  });

  root.querySelectorAll('[data-plantilla]').forEach((btn) => {
    btn.addEventListener('click', () => {
      estado.plantilla = btn.dataset.plantilla;
      renderFase();
    });
  });

  const inputCelda = root.querySelector('[data-input-celda]');
  let idxPendiente = null; // null = agregar al final; número = reemplazar esa celda
  inputCelda.addEventListener('change', () => {
    const file = inputCelda.files?.[0];
    inputCelda.value = '';
    if (!file) return;
    const nuevaFoto = { file, url: URL.createObjectURL(file), escala: 1, offsetXFrac: 0, offsetYFrac: 0 };
    if (idxPendiente != null) {
      URL.revokeObjectURL(estado.seleccionadas[idxPendiente].url);
      estado.seleccionadas[idxPendiente] = nuevaFoto;
    } else {
      estado.seleccionadas.push(nuevaFoto);
    }
    renderFase();
  });

  function abrirSelectorCelda(idxParaReemplazar) {
    const capacidad = celdasPlantilla(estado.plantilla);
    if (idxParaReemplazar == null && estado.seleccionadas.length >= capacidad) return;
    idxPendiente = idxParaReemplazar ?? null;
    inputCelda.click();
  }

  function ocultarHint() {
    if (!estado.hintVisible) return;
    estado.hintVisible = false;
    root.querySelector('.hd-hint')?.remove();
  }

  root.querySelector('[data-confirmar]').addEventListener('click', () => confirmarYPublicar(estado, renderFase));

  pintarLienzo(root, estado, abrirSelectorCelda, ocultarHint);
}

// ── Dibuja las celdas de la plantilla activa como capas <img>
// posicionadas por porcentaje (no canvas — el canvas se usa solo al
// exportar el PNG final). Cada celda con foto es arrastrable/
// zoomeable vía Pointer Events; un toque sin arrastre reemplaza la
// foto de esa celda.
function pintarLienzo(root, estado, abrirSelectorCelda, onPrimerGesto) {
  const lienzo = root.querySelector('#hd-lienzo');
  const filas = PLANTILLAS[estado.plantilla];
  const totalFlex = filas.reduce((s, f) => s + f.flex, 0);

  lienzo.innerHTML = '';
  let yAcumPct = 0;
  let idx = 0;

  filas.forEach((fila) => {
    const altoPct = (100 / totalFlex) * fila.flex;
    const anchoPct = 100 / fila.columnas;
    for (let c = 0; c < fila.columnas; c++) {
      const miIdx = idx++;
      const celda = document.createElement('div');
      celda.className = 'hd-celda';
      celda.style.left = `${c * anchoPct}%`;
      celda.style.top = `${yAcumPct}%`;
      celda.style.width = `${anchoPct}%`;
      celda.style.height = `${altoPct}%`;

      const foto = estado.seleccionadas[miIdx];
      if (foto) {
        celda.appendChild(construirCeldaAjustable(foto, () => abrirSelectorCelda(miIdx), onPrimerGesto));
      } else {
        const btn = document.createElement('button');
        btn.className = 'hd-celda__vacia';
        btn.textContent = '+';
        btn.addEventListener('click', () => abrirSelectorCelda(null));
        celda.appendChild(btn);
      }
      lienzo.appendChild(celda);
    }
    yAcumPct += altoPct;
  });
}

// ── Celda ajustable: arrastre (mouse+touch vía Pointer Events) +
// zoom con rueda del mouse o pellizco de dos dedos. Un tap simple
// (sin desplazamiento) dispara `onCambiar`. offsetXFrac/offsetYFrac
// se guardan como fracción del tamaño de la celda (no píxeles), y se
// aplican con `translate(%)` — en CSS un translate por porcentaje es
// relativo a la caja del propio elemento, así que el mismo valor de
// fracción se ve igual sin importar el tamaño real de pantalla, y se
// puede reutilizar tal cual al exportar al canvas final.
function construirCeldaAjustable(foto, onCambiar, onPrimerGesto) {
  const wrap = document.createElement('div');
  wrap.className = 'hd-celda-ajustable';

  const img = document.createElement('img');
  img.src = foto.url;
  img.draggable = false;
  wrap.appendChild(img);

  function aplicarTransform() {
    img.style.transform = `translate(${foto.offsetXFrac * 100}%, ${foto.offsetYFrac * 100}%) scale(${foto.escala})`;
  }
  aplicarTransform();

  function reclampOffset() {
    const maxFrac = (foto.escala - 1) / 2;
    foto.offsetXFrac = clamp(foto.offsetXFrac, -maxFrac, maxFrac);
    foto.offsetYFrac = clamp(foto.offsetYFrac, -maxFrac, maxFrac);
  }

  let moved = false;
  let inicioX = 0;
  let inicioY = 0;
  let offsetXFracInicio = 0;
  let offsetYFracInicio = 0;
  let rectInicio = null;
  const pointers = new Map();
  let distanciaInicioPinch = 0;
  let escalaInicioPinch = 1;

  function iniciarDrag(x, y) {
    moved = false;
    inicioX = x;
    inicioY = y;
    offsetXFracInicio = foto.offsetXFrac;
    offsetYFracInicio = foto.offsetYFrac;
    rectInicio = wrap.getBoundingClientRect();
  }

  wrap.addEventListener('pointerdown', (e) => {
    wrap.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    onPrimerGesto?.();
    if (pointers.size === 1) {
      iniciarDrag(e.clientX, e.clientY);
    } else if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      distanciaInicioPinch = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      escalaInicioPinch = foto.escala;
    }
  });

  wrap.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      const distancia = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      foto.escala = clamp(escalaInicioPinch * (distancia / distanciaInicioPinch), 1, 3);
      reclampOffset();
      aplicarTransform();
      return;
    }

    if (!rectInicio) return;
    const dx = (e.clientX - inicioX) / rectInicio.width;
    const dy = (e.clientY - inicioY) / rectInicio.height;
    if (Math.abs(e.clientX - inicioX) > 3 || Math.abs(e.clientY - inicioY) > 3) moved = true;
    const maxFrac = (foto.escala - 1) / 2;
    foto.offsetXFrac = clamp(offsetXFracInicio + dx, -maxFrac, maxFrac);
    foto.offsetYFrac = clamp(offsetYFracInicio + dy, -maxFrac, maxFrac);
    aplicarTransform();
  });

  function soltar(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      if (!moved) onCambiar();
    } else if (pointers.size === 1) {
      // quedó un dedo tras soltar el segundo del pellizco: retoma el
      // arrastre desde su posición actual, sin salto.
      const [restante] = [...pointers.values()];
      iniciarDrag(restante.x, restante.y);
    }
  }
  wrap.addEventListener('pointerup', soltar);
  wrap.addEventListener('pointercancel', soltar);

  // Zoom con rueda del mouse — equivalente desktop del pellizco.
  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    onPrimerGesto?.();
    foto.escala = clamp(foto.escala - e.deltaY * 0.001, 1, 3);
    reclampOffset();
    aplicarTransform();
  }, { passive: false });

  wrap.addEventListener('dblclick', () => {
    foto.escala = 1;
    foto.offsetXFrac = 0;
    foto.offsetYFrac = 0;
    aplicarTransform();
  });

  return wrap;
}

// ── Exporta el colage a un <canvas> de 1080×1920 replicando el
// mismo pan/zoom relativo (offsetXFrac/offsetYFrac, escala) que se
// ve en pantalla, y entrega el PNG a publicar-historia.js.
async function confirmarYPublicar(estado, renderFase) {
  if (estado.publicando || estado.seleccionadas.length === 0) return;
  estado.publicando = true;
  renderFase();

  try {
    const canvas = document.createElement('canvas');
    canvas.width = ANCHO_SALIDA;
    canvas.height = ALTO_SALIDA;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const filas = PLANTILLAS[estado.plantilla];
    const totalFlex = filas.reduce((s, f) => s + f.flex, 0);
    let yAcum = 0;
    let idx = 0;

    for (const fila of filas) {
      const altoCelda = (ALTO_SALIDA / totalFlex) * fila.flex;
      const anchoCelda = ANCHO_SALIDA / fila.columnas;
      for (let c = 0; c < fila.columnas; c++) {
        const foto = estado.seleccionadas[idx];
        idx++;
        if (foto) {
          const img = await cargarImagen(foto.url);
          const cx = c * anchoCelda;
          const cy = yAcum;

          ctx.save();
          ctx.beginPath();
          ctx.rect(cx, cy, anchoCelda, altoCelda);
          ctx.clip();

          const escalaBase = Math.max(anchoCelda / img.width, altoCelda / img.height);
          const escalaFinal = escalaBase * foto.escala;
          const wDibujo = img.width * escalaFinal;
          const hDibujo = img.height * escalaFinal;
          const dx = cx + (anchoCelda - wDibujo) / 2 + foto.offsetXFrac * anchoCelda;
          const dy = cy + (altoCelda - hDibujo) / 2 + foto.offsetYFrac * altoCelda;

          ctx.drawImage(img, dx, dy, wDibujo, hDibujo);
          ctx.restore();
        }
      }
      yAcum += altoCelda;
    }

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No se pudo generar el PNG');

        const { abrirPublicarHistoria } = await import('../publicar-historia.js');
    const publicado = await abrirPublicarHistoria({
      archivo: blob,
      extension: 'png',
      trackElegido: estado.trackElegido ? mapearPistaASupabase(estado.trackElegido) : null,
      trackInicioMs: estado.trackInicioMs,
    });

    if (publicado) navegarA('/');
  } catch (e) {
    console.error('historias-diseno – error al publicar:', e);
  } finally {
    estado.publicando = false;
    renderFase();
  }
}

function cargarImagen(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function confirmarSalida(estado) {
  if (estado.seleccionadas.length === 0) {
    navegarA('/');
    return;
  }
  if (window.confirm('¿Deseas descartar el diseño?')) navegarA('/');
}