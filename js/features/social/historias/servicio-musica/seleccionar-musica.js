// seleccionar-musica.js
// Ruta real: js/features/social/historias/servicio-musica/seleccionar-musica.js
//
// Puerto de seleccionar_musica_screen.dart v6 (sin selector de
// fragmento: elegir una canción — fila, flecha del carrusel, o
// mini-player — cierra la hoja de inmediato con inicioMs: 0; el
// recorte de 15s se hace después, en historias-musica.js, con su
// propio selector de fragmento sobre el preview ya elegido).
//
// Uso desde quien abra el selector (p. ej. historias-musica.js):
//
//   const resultado = await abrirSeleccionarMusica();
//   if (!resultado) { /* el usuario cerró sin elegir */ }
//   // resultado = { track: PistaMusical, inicioMs: 0 }
//
// DIFERENCIA DE PLATAFORMA — PageView con puntos de página: se
// reemplaza por un scroll horizontal con scroll-snap + puntitos
// actualizados al vuelo con el evento 'scroll' (sin librería).
//
// DIFERENCIA DE PLATAFORMA — StreamBuilder<PlayerState>: se
// reemplaza por audioPreviewService.suscribir(cb), como ya se
// documenta en ese archivo.

import { abrirHojaInferior } from '../../../../core/bottom-sheet.js';
import { audioPreviewService } from './audio-preview-service.js';
import { buscarCanciones, obtenerTendencias } from './musica-service.js';

const DEBOUNCE_BUSQUEDA_MS = 450;

// Chips temáticos — son términos de búsqueda de texto, no un filtro
// real de la API (mismo criterio que el Dart original).
const CHIPS_ESTADO_ANIMO = ['Feliz', 'Fiesta', 'Romántico', 'Triste', 'Motivación', 'Relax', 'Nostalgia', 'Energía'];
const CHIPS_GENERO = ['Pop', 'Reggaetón', 'Rock', 'Bachata', 'Corridos', 'Cumbia', 'Balada', 'Rap'];

/**
 * Abre el selector de música como hoja inferior modal.
 * @returns {Promise<?{ track: import('./pista-musical.js').PistaMusical, inicioMs: number }>}
 *   null si el usuario cierra la hoja sin elegir ninguna canción.
 */
export function abrirSeleccionarMusica() {
  return new Promise((resolve) => {
    let resuelto = false;

    const { sheet, cuerpo, cerrar } = abrirHojaInferior({
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      onCerrar: () => {
        if (!resuelto) resolve(null);
      },
    });
    sheet.classList.add('seleccionar-musica');

    montarPantalla(cuerpo, {
      onSeleccionar: (resultado) => {
        resuelto = true;
        audioPreviewService.detener();
        cerrar();
        resolve(resultado);
      },
    });
  });
}

function montarPantalla(cuerpo, { onSeleccionar }) {
  cuerpo.innerHTML = `
    <div class="sel-musica">
      <div class="sel-musica__buscador-zona">
        <div class="sel-musica__buscador">
          <span class="sel-musica__buscador-icono">🔍</span>
          <input type="text" class="sel-musica__buscador-input" id="sm-input" placeholder="Buscar canción o artista..." autocomplete="off" />
          <button class="sel-musica__buscador-limpiar" id="sm-limpiar" hidden aria-label="Limpiar">✕</button>
        </div>
      </div>
      <div class="sel-musica__chips-categoria" id="sm-chips-categoria"></div>
      <div class="sel-musica__cuerpo" id="sm-cuerpo"></div>
      <div class="sel-musica__mini-player-zona" id="sm-mini-player"></div>
    </div>
  `;

  const elInput = cuerpo.querySelector('#sm-input');
  const elLimpiar = cuerpo.querySelector('#sm-limpiar');
  const elChipsCategoria = cuerpo.querySelector('#sm-chips-categoria');
  const elCuerpoZona = cuerpo.querySelector('#sm-cuerpo');
  const elMiniPlayerZona = cuerpo.querySelector('#sm-mini-player');

  // ── Estado del módulo (closures, mismo criterio que hoja-comentarios.js) ──
  let categoria = 'sugerencias'; // 'sugerencias' | 'estadoAnimo' | 'genero'
  let trending = [];
  let resultados = [];
  let cargandoTrend = true;
  let cargandoBuscar = false;
  let chipActivo = null;
  let trackActivo = null;
  let debounceId = null;
  let paginaCarrusel = 0;

  const buscando = () => elInput.value.trim().length > 0;

  const desuscribirAudio = audioPreviewService.suscribir(() => {
    actualizarBotonesReproduccion();
    renderMiniPlayer();
  });

  // Si la hoja se cierra por swipe/backdrop, bottom-sheet.js ya llama
  // a onCerrar (arriba) — aquí solo liberamos la suscripción de audio
  // enganchándonos a ese mismo cierre a través del backdrop/manija;
  // como no hay hook de "dispose" explícito, se limpia también al
  // seleccionar (ver onSeleccionar más abajo) y se deja este listener
  // vivo mientras la hoja exista, igual que hace notificaciones.js
  // con su 'hashchange'.
  cuerpo.addEventListener('sel-musica:cerrar', desuscribirAudio, { once: true });

  cargarTendencias();

  // ── Buscador ─────────────────────────────────────────────────

  elInput.addEventListener('input', () => {
    elLimpiar.hidden = !buscando();
    clearTimeout(debounceId);

    if (!buscando()) {
      resultados = [];
      renderCuerpo();
      return;
    }

    debounceId = setTimeout(async () => {
      cargandoBuscar = true;
      renderCuerpo();
      resultados = await buscarCanciones(elInput.value);
      cargandoBuscar = false;
      renderCuerpo();
    }, DEBOUNCE_BUSQUEDA_MS);
  });

  elLimpiar.addEventListener('click', () => {
    elInput.value = '';
    elLimpiar.hidden = true;
    resultados = [];
    renderCuerpo();
  });

  // ── Carga de tendencias ──────────────────────────────────────

  async function cargarTendencias() {
    cargandoTrend = true;
    renderCuerpo();
    trending = await obtenerTendencias();
    cargandoTrend = false;
    renderCuerpo();
  }

  // ── Búsqueda por chip temático (mood/género) ─────────────────

  async function buscarPorChip(chip) {
    chipActivo = chip;
    cargandoBuscar = true;
    resultados = [];
    renderChipsCategoria();
    renderCuerpo();
    resultados = await buscarCanciones(chip);
    cargandoBuscar = false;
    renderCuerpo();
  }

  // ── Categoría (Sugerencias / Estado de ánimo / Género) ───────

  function cambiarCategoria(nueva) {
    if (categoria === nueva) return;
    categoria = nueva;
    chipActivo = null;
    resultados = [];
    elInput.value = '';
    elLimpiar.hidden = true;
    renderChipsCategoria();
    renderCuerpo();
  }

  // ── Reproducir/pausar preview + seleccionar canción ──────────

  async function onTapTrack(track) {
    trackActivo = track;
    renderCuerpo(); // para pintar el mini-visualizador en la fila activa
    await audioPreviewService.toggle(track.previewUrl);
  }

  function seleccionarTrack(track) {
    onSeleccionar({ track, inicioMs: 0 });
  }

  // ── Render: chips de categoría ────────────────────────────────

  function renderChipsCategoria() {
    if (buscando()) {
      elChipsCategoria.innerHTML = '';
      return;
    }
    const categorias = [
      { id: 'sugerencias', etiqueta: 'Sugerencias' },
      { id: 'estadoAnimo', etiqueta: 'Estado de ánimo' },
      { id: 'genero', etiqueta: 'Género' },
    ];
    elChipsCategoria.innerHTML = categorias
      .map(
        (c) =>
          `<button class="sel-musica__chip-categoria${c.id === categoria ? ' activo' : ''}" data-categoria="${c.id}">${c.etiqueta}</button>`
      )
      .join('');
    elChipsCategoria.querySelectorAll('[data-categoria]').forEach((btn) => {
      btn.addEventListener('click', () => cambiarCategoria(btn.dataset.categoria));
    });
  }

  // ── Render: cuerpo principal (decide qué mostrar) ────────────

  function renderCuerpo() {
    if (buscando()) {
      if (cargandoBuscar) {
        elCuerpoZona.innerHTML = plantillaShimmer();
        return;
      }
      if (resultados.length === 0) {
        elCuerpoZona.innerHTML = plantillaVacio(`Sin resultados para "${escaparHtml(elInput.value)}"`);
        return;
      }
      elCuerpoZona.innerHTML = plantillaLista(resultados);
      activarLista(elCuerpoZona, resultados);
      return;
    }

    if (categoria === 'sugerencias') {
      renderSugerencias();
      return;
    }

    // estadoAnimo / genero
    const chips = categoria === 'estadoAnimo' ? CHIPS_ESTADO_ANIMO : CHIPS_GENERO;
    elCuerpoZona.innerHTML = `
      <div class="sel-musica__chips-tematicos-zona">
        <div class="sel-musica__chips-tematicos">
          ${chips.map((c) => `<button class="sel-musica__chip-tematico${chipActivo === c ? ' activo' : ''}" data-chip="${c}">${c}</button>`).join('')}
        </div>
      </div>
      <div class="sel-musica__divisor"></div>
      <div class="sel-musica__resultados-tematicos" id="sm-resultados-tematicos"></div>
    `;
    elCuerpoZona.querySelectorAll('[data-chip]').forEach((btn) => {
      btn.addEventListener('click', () => buscarPorChip(btn.dataset.chip));
    });

    const zonaResultados = elCuerpoZona.querySelector('#sm-resultados-tematicos');
    if (chipActivo == null) {
      zonaResultados.innerHTML = plantillaVacio('Elige un estilo para ver canciones');
    } else if (cargandoBuscar) {
      zonaResultados.innerHTML = plantillaShimmer();
    } else if (resultados.length === 0) {
      zonaResultados.innerHTML = plantillaVacio(`Sin resultados para "${escaparHtml(chipActivo)}"`);
    } else {
      zonaResultados.innerHTML = plantillaLista(resultados);
      activarLista(zonaResultados, resultados);
    }
  }

  // ── Render: vista "Sugerencias" (carrusel + lista) ───────────

  function renderSugerencias() {
    if (cargandoTrend) {
      elCuerpoZona.innerHTML = plantillaShimmer();
      return;
    }
    if (trending.length === 0) {
      elCuerpoZona.innerHTML = plantillaVacio('No se pudieron cargar las sugerencias');
      return;
    }

    const destacadas = trending.slice(0, 5);
    const resto = trending.slice(5);

    elCuerpoZona.innerHTML = `
      <div class="sel-musica__carrusel-zona">
        <div class="sel-musica__carrusel" id="sm-carrusel">
          ${destacadas.map((t) => plantillaTarjetaDestacada(t)).join('')}
        </div>
        <div class="sel-musica__carrusel-puntos" id="sm-carrusel-puntos">
          ${destacadas.map((_, i) => `<span class="sel-musica__punto${i === paginaCarrusel ? ' activo' : ''}"></span>`).join('')}
        </div>
      </div>
      <div class="sel-musica__lista">
        ${resto.map((t) => plantillaItemCancion(t, trackActivo?.id === t.id)).join('')}
      </div>
    `;

    // Carrusel: tap para preview, botón de flecha para seleccionar.
    const elCarrusel = elCuerpoZona.querySelector('#sm-carrusel');
    elCuerpoZona.querySelectorAll('[data-destacada-id]').forEach((tarjeta) => {
      const track = destacadas.find((t) => String(t.id) === tarjeta.dataset.destacadaId);
      if (!track) return;
      tarjeta.addEventListener('click', (evento) => {
        if (evento.target.closest('[data-usar]')) return;
        onTapTrack(track);
      });
      tarjeta.querySelector('[data-usar]')?.addEventListener('click', (evento) => {
        evento.stopPropagation();
        seleccionarTrack(track);
      });
    });

    // Puntitos del carrusel según el scroll horizontal.
    if (elCarrusel) {
      let scrollTimeout = null;
      elCarrusel.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          const anchoTarjeta = elCarrusel.firstElementChild?.getBoundingClientRect().width ?? 1;
          const nuevaPagina = Math.round(elCarrusel.scrollLeft / anchoTarjeta);
          if (nuevaPagina !== paginaCarrusel) {
            paginaCarrusel = nuevaPagina;
            elCuerpoZona.querySelectorAll('#sm-carrusel-puntos .sel-musica__punto').forEach((punto, i) => {
              punto.classList.toggle('activo', i === paginaCarrusel);
            });
          }
        }, 80);
      });
    }

    activarLista(elCuerpoZona.querySelector('.sel-musica__lista'), resto);
  }

  // ── Plantillas ────────────────────────────────────────────────

  function plantillaTarjetaDestacada(track) {
    const fondo = track.cover ? `background-image: linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.75)), url('${track.cover}')` : '';
    return `
      <div class="sel-musica__tarjeta-destacada" data-destacada-id="${track.id}" style="${fondo}">
        <div class="sel-musica__tarjeta-destacada-info">
          <p class="sel-musica__tarjeta-destacada-titulo">${escaparHtml(track.titulo)}</p>
          <p class="sel-musica__tarjeta-destacada-artista">${escaparHtml(track.artista)}</p>
        </div>
        <button class="sel-musica__tarjeta-destacada-usar" data-usar aria-label="Usar esta canción">➜</button>
      </div>
    `;
  }

  function plantillaLista(lista) {
    return `<div class="sel-musica__lista">${lista.map((t) => plantillaItemCancion(t, trackActivo?.id === t.id)).join('')}</div>`;
  }

  function plantillaItemCancion(track, activo) {
    const cover = track.cover
      ? `<img src="${track.cover}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='🎵'" />`
      : '🎵';
    return `
      <div class="sel-musica__item${activo ? ' activo' : ''}" data-track-id="${track.id}">
        <div class="sel-musica__item-cover">${cover}</div>
        ${activo ? '<span class="sel-musica__mini-vis"><span></span><span></span><span></span></span>' : ''}
        <div class="sel-musica__item-textos">
          <p class="sel-musica__item-titulo">${escaparHtml(track.titulo)}</p>
          <p class="sel-musica__item-artista">${escaparHtml(track.artista)}</p>
        </div>
        <button class="sel-musica__item-play" data-play-btn data-track-id="${track.id}" aria-label="Reproducir preview">▶️</button>
      </div>
    `;
  }

  function plantillaShimmer() {
    return `
      <div class="sel-musica__shimmer">
        ${Array.from({ length: 8 })
          .map(
            (_, i) => `
          <div class="sel-musica__shimmer-fila" style="animation-delay:${i * 80}ms">
            <div class="sel-musica__shimmer-cover"></div>
            <div class="sel-musica__shimmer-textos">
              <div class="sel-musica__shimmer-linea sel-musica__shimmer-linea--larga"></div>
              <div class="sel-musica__shimmer-linea sel-musica__shimmer-linea--corta"></div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  }

  function plantillaVacio(mensaje) {
    return `
      <div class="sel-musica__vacio">
        <span class="sel-musica__vacio-icono">🎵</span>
        <p>${escaparHtml(mensaje)}</p>
      </div>
    `;
  }

  function activarLista(contenedor, lista) {
    if (!contenedor) return;
    contenedor.querySelectorAll('[data-track-id]').forEach((fila) => {
      const track = lista.find((t) => String(t.id) === fila.dataset.trackId);
      if (!track) return;
      fila.addEventListener('click', (evento) => {
        if (evento.target.closest('[data-play-btn]')) return;
        seleccionarTrack(track);
      });
      fila.querySelector('[data-play-btn]')?.addEventListener('click', (evento) => {
        evento.stopPropagation();
        onTapTrack(track);
      });
    });
  }

  // Actualiza solo los íconos de play/pause sin volver a pintar todo
  // (se llama en cada evento del audio — ver suscripción arriba).
  function actualizarBotonesReproduccion() {
    cuerpo.querySelectorAll('[data-play-btn]').forEach((btn) => {
      const esActivo = trackActivo != null && String(trackActivo.id) === btn.dataset.trackId;
      const sonando = esActivo && audioPreviewService.reproduciendo;
      btn.textContent = sonando ? '⏸️' : '▶️';
      btn.classList.toggle('sonando', sonando);
    });
    cuerpo.querySelectorAll('.sel-musica__mini-vis').forEach((vis) => {
      vis.classList.toggle('sonando', audioPreviewService.reproduciendo);
    });
  }

  // ── Render: mini-reproductor fijo abajo ──────────────────────

  function renderMiniPlayer() {
    if (!trackActivo) {
      elMiniPlayerZona.innerHTML = '';
      return;
    }
    const track = trackActivo;
    const sonando = audioPreviewService.reproduciendo;
    const cover = track.cover ? `<img src="${track.cover}" alt="" />` : '<div class="sel-musica__mini-player-cover-vacia">🎵</div>';

    elMiniPlayerZona.innerHTML = `
      <div class="sel-musica__mini-player" id="sm-mini-player-tap">
        <div class="sel-musica__mini-player-cover">${cover}</div>
        <div class="sel-musica__mini-player-textos">
          <p class="sel-musica__mini-player-titulo">${escaparHtml(track.titulo)}</p>
          <p class="sel-musica__mini-player-artista">${escaparHtml(track.artista)}</p>
        </div>
        <button class="sel-musica__mini-player-btn" id="sm-mini-player-toggle" aria-label="Reproducir/pausar">${sonando ? '⏸️' : '▶️'}</button>
        <button class="sel-musica__mini-player-btn" id="sm-mini-player-usar" aria-label="Usar esta canción">➜</button>
      </div>
    `;

    elMiniPlayerZona.querySelector('#sm-mini-player-tap').addEventListener('click', (evento) => {
      if (evento.target.closest('button')) return;
      seleccionarTrack(track);
    });
    elMiniPlayerZona.querySelector('#sm-mini-player-toggle').addEventListener('click', (evento) => {
      evento.stopPropagation();
      onTapTrack(track);
    });
    elMiniPlayerZona.querySelector('#sm-mini-player-usar').addEventListener('click', (evento) => {
      evento.stopPropagation();
      seleccionarTrack(track);
    });
  }

  renderChipsCategoria();
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}