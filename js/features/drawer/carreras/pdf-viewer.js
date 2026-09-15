// ═════════════════════════════════════════════════════════════════
// pdf-viewer.js
//
// Visor de PDFs compartido por todas las pantallas de carrera.
// Réplica funcional de pdf_viewer_screen.dart: carga el PDF vía
// Google Docs Viewer embebido, reintenta automáticamente si la
// carga no termina dentro del tiempo límite, y muestra una pantalla
// de error con botón de reintento manual tras agotar los intentos.
//
// A diferencia de Flutter, aquí no es una ruta del router: se abre
// como un overlay de pantalla completa superpuesto sobre lo que
// esté visible (equivalente al push de Navigator en Flutter) y se
// cierra eliminándose del DOM, sin tocar el hash actual — así
// cualquier pantalla de carrera puede abrirlo sin que el router
// necesite saber nada de PDFs ni de las URLs que recibe.
//
// Simplificación consciente en compartir/descargar: Flutter descarga
// el PDF a un archivo temporal con HttpClient y usa share_plus /
// copia a la carpeta de Descargas. En el navegador no hay acceso al
// sistema de archivos ni a la Web Share API con archivos arbitrarios
// de forma confiable entre navegadores, así que "Compartir" usa la
// Web Share API nativa con la URL (o la copia al portapapeles como
// respaldo), y "Descargar" abre el PDF en una pestaña nueva para que
// el usuario lo guarde con los controles nativos del visor del
// navegador.
// ═════════════════════════════════════════════════════════════════

/** Tiempo de espera por intento antes de asumir que la carga falló. */
const TIMEOUT_MS = 4000;

/** Número máximo de reintentos automáticos antes de mostrar error. */
const MAX_INTENTOS = 3;

/**
 * Abre el visor de PDF a pantalla completa.
 * @param {{ titulo: string, url: string }} datos
 */
export function abrirPdfViewer({ titulo, url }) {
  const overlay = document.createElement('div');
  overlay.className = 'pdf-viewer';
  overlay.innerHTML = `
    <div class="pdf-viewer__barra">
      <button class="pdf-viewer__cerrar" aria-label="Cerrar">‹</button>
      <span class="pdf-viewer__titulo">${titulo}</span>
      <div class="pdf-viewer__acciones">
        <button class="pdf-viewer__accion" id="pdf-compartir" aria-label="Compartir">📤</button>
        <button class="pdf-viewer__accion" id="pdf-descargar" aria-label="Descargar">⬇️</button>
      </div>
    </div>

    <div class="pdf-viewer__cuerpo">
      <iframe class="pdf-viewer__frame" title="${titulo}"></iframe>

      <div class="pdf-viewer__error">
        <span class="pdf-viewer__error-icono">⚠️</span>
        <p class="pdf-viewer__error-titulo">No se pudo cargar el PDF</p>
        <p class="pdf-viewer__error-subtitulo">Verifica tu conexión e intenta de nuevo.</p>
        <button class="pdf-viewer__reintentar">Reintentar</button>
      </div>

      <div class="pdf-viewer__carga">
        <div class="pdf-viewer__spinner"></div>
        <p>Cargando PDF…</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const iframe = overlay.querySelector('.pdf-viewer__frame');
  const carga = overlay.querySelector('.pdf-viewer__carga');
  const error = overlay.querySelector('.pdf-viewer__error');

  let intentos = 0;
  let timeoutId = null;

  const urlVisor = () =>
    `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;

  function cargar() {
    carga.classList.add('visible');
    error.classList.remove('visible');
    iframe.classList.remove('oculto');

    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      if (intentos < MAX_INTENTOS) {
        intentos++;
        cargar();
        return;
      }
      carga.classList.remove('visible');
      error.classList.add('visible');
      iframe.classList.add('oculto');
    }, TIMEOUT_MS);

    iframe.src = urlVisor();
  }

  iframe.addEventListener('load', () => {
    clearTimeout(timeoutId);
    intentos = 0;
    carga.classList.remove('visible');
  });

  overlay.querySelector('.pdf-viewer__cerrar').addEventListener('click', () => {
    clearTimeout(timeoutId);
    overlay.remove();
  });

  overlay.querySelector('.pdf-viewer__reintentar').addEventListener('click', () => {
    intentos = 0;
    cargar();
  });

  overlay.querySelector('#pdf-compartir').addEventListener('click', () => compartirPdf(titulo, url));
  overlay.querySelector('#pdf-descargar').addEventListener('click', () => descargarPdf(url, titulo));

  cargar();
}

/** Comparte la URL del PDF vía Web Share API, o la copia al portapapeles como respaldo. */
async function compartirPdf(titulo, url) {
  if (navigator.share) {
    try {
      await navigator.share({ title: titulo, url });
    } catch {
      // El usuario canceló el share sheet — no es un error.
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // Silencioso: sin Web Share API ni portapapeles disponible no
    // hay nada más que ofrecer en este navegador.
  }
}

/** Abre el PDF en una pestaña nueva para que el usuario lo guarde con los controles del navegador. */
function descargarPdf(url) {
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.target = '_blank';
  enlace.rel = 'noopener';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
}