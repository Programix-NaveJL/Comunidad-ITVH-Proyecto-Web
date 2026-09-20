// galeria-multimedia.js
// Ubicación: js/features/social/publicaciones/tarjeta-publicaciones/galeria-multimedia.js
//
// ═══════════════════════════════════════════════════════════════
// PROPÓSITO
// ═══════════════════════════════════════════════════════════════
// Puerto de galeria_multimedia.dart. Cuadrícula de medios de una
// publicación, estilo Facebook: 1 medio = cuadro completo; 2 =
// columnas iguales; 3 = uno grande + dos apilados; 4+ = grid 2x2
// con overlay "+N" en la última celda si sobran más de 4.
//
// ═══════════════════════════════════════════════════════════════
// RESPONSABILIDADES
// ═══════════════════════════════════════════════════════════════
//   - renderGaleriaMultimedia(medios): arma el HTML de la galería.
//   - activarGaleriaMultimedia(contenedor, onMedioTap): engancha los
//     clicks de cada celda (abre visor-media.js), formatea la
//     duración de los videos y registra cada video para autoplay
//     por visibilidad (ver video-autoplay.js).
//
// A diferencia del Dart, las proporciones (lado = ancho/2, altura
// total de 3 = ancho*0.65, etc.) se resuelven con `aspect-ratio` en
// CSS en vez de medir el ancho del contenedor en JS — ver
// galeria-multimedia.css, cada layout tiene su aspect-ratio
// equivalente calculado a partir de las mismas proporciones del
// Dart original.
//
// DIFERENCIA DE PLATAFORMA — miniatura de video: el Dart inicializa
// un VideoPlayerController solo para tomar el primer frame y la
// duración (sin autoplay/audio). En web se logra con un <video
// preload="metadata" muted playsinline>, escuchando 'loadedmetadata'
// para pintar la duración — el navegador ya muestra el primer frame
// solo. Mismo criterio ya usado en notificaciones.js para miniaturas
// de video (<video>+<canvas>), aquí no hace falta <canvas> porque no
// se necesita una imagen estática, solo el frame visible del <video>.
//
// ═══════════════════════════════════════════════════════════════
// CAMBIOS
// ═══════════════════════════════════════════════════════════════
//   - AUTOPLAY ESTILO FACEBOOK: los videos se reproducen solos (en
//     mute) al quedar a la vista y se pausan al salir. La lógica
//     vive en video-autoplay.js; aquí solo se registra cada celda
//     de video en activarGaleriaMultimedia().
//   - Cada celda de video incluye ahora un botón de sonido
//     (.galeria-medios__silencio, 🔇/🔊). Su click NO abre el visor.
//   - Al tocar una celda (abrir el visor) se pausa el video que esté
//     sonando en el feed, para que no suene debajo del visor.

import { resolverUrlMedio } from '../../../../core/perfil-utils.js';
import { registrarVideoAutoplay, pausarVideoActivo } from './video-autoplay.js';

/**
 * Arma el HTML de la galería. Debe insertarse en el DOM y luego
 * pasarse a activarGaleriaMultimedia() para enganchar los clicks y
 * las duraciones de video.
 *
 * @param {Array<Object>} medios - filas de publicacion_medios (con tipo_medio, url/cdn_url).
 */
export function renderGaleriaMultimedia(medios) {
  const n = medios.length;
  if (n === 0) return '';

  if (n === 1) {
    return `
      <div class="galeria-medios galeria-medios--1">
        ${celda(medios, 0)}
      </div>
    `;
  }

  if (n === 2) {
    return `
      <div class="galeria-medios galeria-medios--2">
        ${celda(medios, 0, { gapDerecha: true })}
        ${celda(medios, 1)}
      </div>
    `;
  }

  if (n === 3) {
    return `
      <div class="galeria-medios galeria-medios--3">
        <div class="galeria-medios__izq">${celda(medios, 0, { gapDerecha: true })}</div>
        <div class="galeria-medios__der">
          ${celda(medios, 1, { gapAbajo: true })}
          ${celda(medios, 2)}
        </div>
      </div>
    `;
  }

  // 4 o más
  const restantes = n - 4;
  return `
    <div class="galeria-medios galeria-medios--4mas">
      ${celda(medios, 0, { gapDerecha: true, gapAbajo: true })}
      ${celda(medios, 1, { gapAbajo: true })}
      ${celda(medios, 2, { gapDerecha: true })}
      ${celda(medios, 3, {
        extraLabel: restantes > 0 ? `+${restantes}` : null,
        extraLabelIndex: n > 4 ? 4 : null,
      })}
    </div>
  `;
}

function celda(medios, index, { gapDerecha = false, gapAbajo = false, extraLabel = null, extraLabelIndex = null } = {}) {
  const medio = medios[index];
  const url = resolverUrlMedio(medio);
  const esVideo = medio.tipo_medio === 'video';
  const indiceClick = extraLabelIndex ?? index;

  const margen = `${gapDerecha ? 'margin-right:2px;' : ''}${gapAbajo ? 'margin-bottom:2px;' : ''}`;

  return `
    <div class="galeria-medios__celda" style="${margen}" data-medio-idx="${index}" data-click-idx="${indiceClick}">
      ${
        esVideo
          ? `<video class="galeria-medios__video" src="${url}" preload="metadata" muted playsinline></video>
             <div class="galeria-medios__video-overlay">
               <span class="galeria-medios__play">▶️</span>
               <span class="galeria-medios__badge galeria-medios__badge--tipo">🎥 VIDEO</span>
               <span class="galeria-medios__badge galeria-medios__badge--duracion" hidden></span>
             </div>
             <button type="button" class="galeria-medios__silencio" data-silencio aria-label="Activar sonido">🔇</button>`
          : `<img class="galeria-medios__img" src="${url}" alt="" loading="lazy" onerror="this.classList.add('galeria-medios__img--error')" />`
      }
      ${
        extraLabel
          ? `<div class="galeria-medios__extra"><span>${extraLabel}</span></div>`
          : ''
      }
    </div>
  `;
}

/**
 * Engancha los clicks de cada celda (abre visor-media.js en el
 * índice correspondiente), formatea la duración de los videos una
 * vez que el navegador la conoce (evento 'loadedmetadata') y
 * registra cada video para autoplay por visibilidad.
 *
 * @param {HTMLElement} contenedor - el elemento donde se insertó el HTML de renderGaleriaMultimedia().
 * @param {(indice: number) => void} onMedioTap
 */
export function activarGaleriaMultimedia(contenedor, onMedioTap) {
  contenedor.querySelectorAll('.galeria-medios__celda').forEach((celdaEl) => {
    celdaEl.addEventListener('click', () => {
      // Antes de abrir el visor, se calla el video que esté sonando en el feed.
      pausarVideoActivo();
      onMedioTap(Number(celdaEl.dataset.clickIdx));
    });

    const video = celdaEl.querySelector('.galeria-medios__video');
    if (!video) return;

    const badgeDuracion = celdaEl.querySelector('.galeria-medios__badge--duracion');
    video.addEventListener('loadedmetadata', () => {
      if (!badgeDuracion || Number.isNaN(video.duration)) return;
      badgeDuracion.textContent = formatearDuracion(video.duration);
      badgeDuracion.hidden = false;
    });

    registrarVideoAutoplay(celdaEl);
  });
}

function formatearDuracion(segundosTotales) {
  const m = Math.floor(segundosTotales / 60).toString().padStart(2, '0');
  const s = Math.floor(segundosTotales % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}