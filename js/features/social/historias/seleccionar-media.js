// seleccionar-media.js
// Ruta real: js/features/social/historias/seleccionar-media.js
//
// Puerto MUY simplificado de SeleccionarTipoHistoria.dart
// (SeleccionarMediaScreen). El Dart original es, en su mayoría, una
// galería in-app hecha con photo_manager: grid con miniaturas reales
// del dispositivo agrupadas por fecha, scrubber lateral arrastrable,
// selector de álbum, selección múltiple con orden numerado, precarga
// de thumbnails y paginación infinita.
//
// NINGUNA de esas piezas tiene equivalente web: un sitio no puede
// leer ni listar la galería de fotos del dispositivo, solo puede
// invocar el selector nativo del sistema operativo vía
// <input type="file"> (una ventana aparte que el navegador no puede
// personalizar — sin álbumes, sin grid propio, sin scrubber). Por
// eso esta pantalla se reduce a:
//   • El HUB de 4 íconos (Texto/Música/Diseño/Audio) — se porta tal
//     cual, es UI normal.
//   • Un botón "Cámara" (<input type="file" capture="environment">,
//     misma idea que _buildCeldaCamara) y un botón "Elegir de mi
//     dispositivo" (<input type="file" multiple>, en vez del grid
//     completo) — mismo criterio ya usado en crear-publicacion.js.
// Todo lo demás del Dart original (_fotosPorFecha, _cargarGaleria/
// _cargarMasFotos, _abrirSelectorAlbum, _ScrubberState/_buildScrubber,
// _CeldaFoto, _thumbCache, selección múltiple con orden, tooltip de
// "mantén presionado") no tiene traducción posible y se omite.
//
// Cámara/galería → historiasfotosvideos-editar.js: cada archivo
// elegido pasa por el editor real (recorte, texto, descripción)
// antes de publicarse, uno tras otro si se eligieron varios — mismo
// criterio que _publicarSeleccionados() del Dart original. Import
// dinámico porque historiasfotosvideos-editar.js es pesado (canvas,
// gestos de zoom/pan) y no hace falta cargarlo hasta que el usuario
// realmente elige un archivo.
//
// "Texto" → historias-texto.js ('/historia-texto').
// "Música" → historias-musica.js ('/historia-musica').
// Diseño/Audio siguen en placeholder hasta que se porten
// historias-diseno.js / historias-audio.js.

import { navegarA } from '../../../core/router.js';
import { mostrarToast } from '../../../core/toast.js';

/**
 * Abre la pantalla de selección de historia a pantalla completa.
 *
 * @param {Object} [opciones]
 * @param {string} [opciones.titulo]
 * @returns {Promise<boolean>} true si se publicó alguna historia
 * directo desde este overlay (cámara/galería). Si el usuario elige
 * "Texto"/"Música" (o cualquier otro hub que navegue a una pantalla
 * propia), este overlay se cierra y resuelve `false` de inmediato —
 * la confirmación real de que se publicó llega después por el
 * evento global 'historia:publicada' (ver publicar-historia.js),
 * igual que 'publicacion:creada' en crear-publicacion.js.
 */
export function abrirSeleccionarMedia({ titulo = 'Agregar a historia' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'seleccionar-media-overlay';
    overlay.innerHTML = `
      <div class="seleccionar-media">
        <header class="seleccionar-media__header">
          <button class="seleccionar-media__icono-btn" data-cerrar aria-label="Cerrar">✕</button>
          <p class="seleccionar-media__titulo">${escaparHtml(titulo)}</p>
          <button class="seleccionar-media__icono-btn" data-ajustes aria-label="Ajustes">⚙️</button>
        </header>

        <div class="seleccionar-media__hub">
          <button class="sm-icono-hub" data-hub="texto">
            <span class="sm-icono-hub__circulo">✏️</span>
            <span class="sm-icono-hub__etiqueta">Texto</span>
          </button>
          <button class="sm-icono-hub" data-hub="musica">
            <span class="sm-icono-hub__circulo">🎵</span>
            <span class="sm-icono-hub__etiqueta">Música</span>
          </button>
          <button class="sm-icono-hub" data-hub="diseno">
            <span class="sm-icono-hub__circulo">🎨</span>
            <span class="sm-icono-hub__etiqueta">Diseño</span>
          </button>
          <button class="sm-icono-hub" data-hub="audio">
            <span class="sm-icono-hub__circulo">🎙️</span>
            <span class="sm-icono-hub__etiqueta">Audio</span>
          </button>
        </div>

        <div class="seleccionar-media__picker">
          <button class="seleccionar-media__opcion" data-camara>
            <span class="seleccionar-media__opcion-icono">📷</span>
            <span>Cámara</span>
          </button>
          <button class="seleccionar-media__opcion" data-galeria>
            <span class="seleccionar-media__opcion-icono">🖼️</span>
            <span>Elegir de mi dispositivo</span>
          </button>
        </div>

        <input type="file" accept="image/*,video/*" capture="environment" class="seleccionar-media__input-oculto" data-input-camara hidden />
        <input type="file" accept="image/*,video/*" multiple class="seleccionar-media__input-oculto" data-input-galeria hidden />
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    let resuelto = false;
    function cerrar(resultado) {
      if (resuelto) return;
      resuelto = true;
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
      resolve(resultado);
    }

    // Cierre inmediato (sin animación) usado al navegar a una
    // pantalla propia (ej. "Texto"/"Música"): evita que el overlay
    // se quede flotando encima de la nueva ruta mientras termina su
    // fade-out.
    function cerrarYNavegar(ruta) {
      if (resuelto) return;
      resuelto = true;
      overlay.remove();
      resolve(false);
      navegarA(ruta);
    }

    overlay.querySelector('[data-cerrar]').addEventListener('click', () => cerrar(false));
    overlay.querySelector('[data-ajustes]').addEventListener('click', () => {
      mostrarToast('Ajustes de historia — próximamente', 'error');
    });

    overlay.querySelectorAll('[data-hub]').forEach((boton) => {
      boton.addEventListener('click', () => abrirHub(boton.dataset.hub));
    });

    const inputCamara = overlay.querySelector('[data-input-camara]');
    const inputGaleria = overlay.querySelector('[data-input-galeria]');
    overlay.querySelector('[data-camara]').addEventListener('click', () => inputCamara.click());
    overlay.querySelector('[data-galeria]').addEventListener('click', () => inputGaleria.click());

    inputCamara.addEventListener('change', () => manejarArchivosElegidos(inputCamara.files));
    inputGaleria.addEventListener('change', () => manejarArchivosElegidos(inputGaleria.files));

    async function manejarArchivosElegidos(fileList) {
      const archivos = Array.from(fileList ?? []);
      if (archivos.length === 0) return;

      // Import dinámico: mismo criterio que antes, ahora apuntando
      // al editor real en vez de saltar directo a publicar.
      const { abrirEditarHistoria } = await import('./historiasfotosvideos-editar.js');

      let algunaPublicada = false;
      for (const archivo of archivos) {
        // eslint-disable-next-line no-await-in-loop
        const publicada = await abrirEditarHistoria({ archivo });
        if (publicada) algunaPublicada = true;
      }
      if (algunaPublicada) cerrar(true);
    }

    // (fragmento — dentro de abrirHub(), reemplaza el bloque final)

function abrirHub(tipo) {
  if (tipo === 'texto') { cerrarYNavegar('/historia-texto'); return; }
  if (tipo === 'musica') { cerrarYNavegar('/historia-musica'); return; }
  if (tipo === 'diseno') { cerrarYNavegar('/historia-diseno'); return; }
  if (tipo === 'audio') { cerrarYNavegar('/historia-audio'); return; }
}
  });
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}