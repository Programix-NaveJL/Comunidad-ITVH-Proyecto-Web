// ═════════════════════════════════════════════════════════════════
// plantel.js
//
// Pantallas informativas del Drawer sobre el plantel. "Conoce el
// plantel" y "Un poco de historia" comparten la ruta base '/plantel'
// porque el router solo indexa por el primer segmento del hash —
// este archivo despacha internamente según el segundo segmento
// (#/plantel/conoce, #/plantel/historia), igual que hacía el
// placeholder que reemplaza en shell.js.
//
// "Conoce el plantel" (definida en este archivo) es réplica
// funcional de conoce_plantel.dart: ficha rápida institucional,
// descripción, galería de fotos del campus (carrusel con miniaturas
// y puntos), misión/visión/valores, y contacto/ubicación con
// enlaces a teléfono, correo y mapa.
//
// "Un poco de historia" vive en historia.js (línea de tiempo con
// los hitos del ITVH) — este archivo solo despacha hacia allá según
// el segundo segmento del hash.
// ═════════════════════════════════════════════════════════════════

import { registrarRuta } from '../../core/router.js';
import { renderHistoriaPlantel } from './historia.js';

/** Fotos de la galería del campus, en el orden en que se muestran. */
const FOTOS_GALERIA = [
  { archivo: 'galeria_imagen1.jpeg', descripcion: 'Vista del campus del ITVH' },
  { archivo: 'galeria_imagen2.jpeg', descripcion: 'Instalaciones del plantel' },
  { archivo: 'galeria_imagen3.jpeg', descripcion: 'Áreas académicas del ITVH' },
  { archivo: 'galeria_imagen4.jpeg', descripcion: 'Espacios de aprendizaje' },
  { archivo: 'galeria_imagen5.jpeg', descripcion: 'Infraestructura del campus' },
  { archivo: 'galeria_imagen6.jpeg', descripcion: 'Exterior del ITVH' },
  { archivo: 'galeria_imagen7.jpeg', descripcion: 'Instituto Tecnológico de Villahermosa' },
];

/** Valores institucionales mostrados como chips. */
const VALORES = [
  'Honestidad', 'Responsabilidad', 'Respeto', 'Innovación',
  'Compromiso', 'Excelencia', 'Trabajo en equipo', 'Sustentabilidad',
];

/** Tiles de contacto: ícono, color de acento, título, subtítulo y enlace que abren. */
const CONTACTOS = [
  {
    icono: '📍', color: 'var(--color-danger)',
    titulo: 'Dirección',
    subtitulo: 'Carretera Villahermosa–Frontera km 3.5, Col. Tecnológico, C.P. 86010, Villahermosa, Tabasco, México.',
    href: 'https://maps.google.com/?q=Instituto+Tecnologico+de+Villahermosa',
  },
  {
    icono: '📞', color: 'var(--color-success)',
    titulo: 'Teléfono', subtitulo: '(993) 354-2020',
    href: 'tel:+529933542020',
  },
  {
    icono: '✉️', color: 'var(--color-primary-light)',
    titulo: 'Correo institucional', subtitulo: 'difusion@villahermosa.tecnm.mx',
    href: 'mailto:difusion@villahermosa.tecnm.mx',
  },
  {
    icono: '🌐', color: '#5856d6',
    titulo: 'Sitio web oficial', subtitulo: 'villahermosa.tecnm.mx',
    href: 'https://villahermosa.tecnm.mx',
  },
];

const URL_MAPA = 'https://maps.google.com/?q=Instituto+Tecnologico+de+Villahermosa';
const URL_SITIO_WEB = 'https://villahermosa.tecnm.mx';

/**
 * Despacha entre "Conoce el plantel" y "Un poco de historia" según
 * el segundo segmento del hash. Es la función que el router invoca
 * al entrar a '/plantel'.
 * @param {HTMLElement} contenedor
 * @param {string} [sub]
 */
export function renderPlantel(contenedor, sub) {
  if (sub === 'historia') {
    renderHistoriaPlantel(contenedor);
    return;
  }
  renderConocePlantel(contenedor);
}

/** Pinta la pantalla "Conoce el plantel" completa dentro de `contenedor`. */
function renderConocePlantel(contenedor) {
  contenedor.innerHTML = `
    <div class="plantel">
      <header class="plantel-hero">
        <button class="plantel-hero__volver" id="plantel-volver" aria-label="Regresar">‹</button>
        <img
          class="plantel-hero__logo"
          src="assets/img/logo_itvh.png"
          alt="Instituto Tecnológico de Villahermosa"
        />
        <p class="plantel-hero__nombre">Instituto Tecnológico de Villahermosa</p>
      </header>

      <div class="plantel-seccion">
        <h1 class="plantel-titulo-principal">Instituto Tecnológico de Villahermosa</h1>
        <p class="plantel-subtitulo-marca">ITVH · TecNM</p>

        ${renderFichaRow('📍', 'Ubicación', 'Carretera Villahermosa–Frontera km 3.5, Col. Tecnológico, Villahermosa, Tab.')}
        ${renderFichaRow('📅', 'Fundación', '1974')}
        ${renderFichaRow('🏛️', 'Tipo', 'Institución pública de educación superior')}
        ${renderFichaRow('🌐', 'Sitio web', 'villahermosa.tecnm.mx', URL_SITIO_WEB)}

        <div class="plantel-divisor"></div>
      </div>

      <div class="plantel-seccion">
        ${renderTituloSeccion('Acerca del plantel')}
        <p class="plantel-parrafo">
          El Instituto Tecnológico de Villahermosa (ITVH) es una institución
          pública de educación superior perteneciente al Tecnológico
          Nacional de México (TecNM), dependiente de la Secretaría de
          Educación Pública (SEP). Fundado en 1974, ha formado durante más
          de cinco décadas a miles de profesionistas en diversas
          disciplinas de ingeniería y ciencias.
        </p>
        <p class="plantel-parrafo">
          El ITVH se distingue por su enfoque en la vinculación con el
          sector productivo de la región sureste de México, contribuyendo
          activamente al desarrollo económico, científico y tecnológico
          del estado de Tabasco y del país.
        </p>
      </div>

      <div class="plantel-seccion">
        ${renderTituloSeccion('Galería del campus')}
        ${renderGaleria()}
      </div>

      <div class="plantel-seccion">
        ${renderTituloSeccion('Misión y Visión')}
        ${renderTarjetaMisionVision('🚩', 'var(--color-primary-light)', 'Misión',
          'Formar profesionistas de excelencia en ciencias y tecnología, con valores éticos y humanistas, capaces de contribuir al desarrollo sustentable del país, a través de la docencia, investigación y vinculación con los sectores productivo y social.')}
        ${renderTarjetaMisionVision('👁️', 'var(--color-success)', 'Visión',
          'Ser reconocida como una institución de educación superior de calidad, acreditada nacional e internacionalmente, líder en innovación tecnológica y en la formación integral de profesionistas competitivos, comprometidos con el desarrollo sostenible de la región y del país.')}

        <p class="plantel-subtitulo-valores">Valores institucionales</p>
        <div class="plantel-chips">
          ${VALORES.map((v) => `<span class="plantel-chip">${v}</span>`).join('')}
        </div>
      </div>

      <div class="plantel-seccion">
        ${renderTituloSeccion('Contacto y Ubicación')}
        ${CONTACTOS.map(renderContactoTile).join('')}

        <a class="plantel-mapa" href="${URL_MAPA}" target="_blank" rel="noopener">
          <span class="plantel-mapa__fondo">🗺️</span>
          <span class="plantel-mapa__boton"><span>📍</span> Ver en Google Maps</span>
        </a>
      </div>

      <p class="plantel-pie">
        Información con fines informativos.<br />
        Fuente: TecNM / ITVH
      </p>
    </div>
  `;

  contenedor
    .querySelector('#plantel-volver')
    .addEventListener('click', () => window.history.back());

  inicializarGaleria(contenedor);
}

/** Fila de la ficha rápida: ícono + etiqueta fija + valor (opcionalmente enlace). */
function renderFichaRow(icono, etiqueta, valor, href) {
  const contenidoValor = href
    ? `<a class="plantel-ficha__valor plantel-ficha__valor--link" href="${href}" target="_blank" rel="noopener">${valor}</a>`
    : `<span class="plantel-ficha__valor">${valor}</span>`;

  return `
    <div class="plantel-ficha">
      <span class="plantel-ficha__icono">${icono}</span>
      <span class="plantel-ficha__etiqueta">${etiqueta}</span>
      ${contenidoValor}
    </div>
  `;
}

/** Título de sección con la barra de acento de 40×3px debajo, igual que en Flutter. */
function renderTituloSeccion(texto) {
  return `
    <div class="plantel-titulo-seccion">
      <h2>${texto}</h2>
      <span class="plantel-titulo-seccion__barra"></span>
    </div>
  `;
}

/** Tarjeta de Misión/Visión con fondo e ícono tintados del color recibido. */
function renderTarjetaMisionVision(icono, color, titulo, texto) {
  return `
    <div class="plantel-mision-vision" style="--color-tarjeta: ${color}">
      <div class="plantel-mision-vision__header">
        <span>${icono}</span>
        <h3>${titulo}</h3>
      </div>
      <p>${texto}</p>
    </div>
  `;
}

/** Tile de contacto tappable que abre el enlace correspondiente. */
function renderContactoTile({ icono, color, titulo, subtitulo, href }) {
  const target = href.startsWith('http') ? ' target="_blank" rel="noopener"' : '';
  return `
    <a class="plantel-contacto" href="${href}"${target} style="--color-contacto: ${color}">
      <span class="plantel-contacto__icono">${icono}</span>
      <span class="plantel-contacto__texto">
        <span class="plantel-contacto__titulo">${titulo}</span>
        <span class="plantel-contacto__subtitulo">${subtitulo}</span>
      </span>
      <span class="plantel-contacto__flecha">›</span>
    </a>
  `;
}

/** Marcado del carrusel: imagen principal, contador, flechas, miniaturas y puntos. */
function renderGaleria() {
  const slides = FOTOS_GALERIA.map(
    (foto) => `
      <div class="plantel-galeria__slide">
        <img src="assets/img/${foto.archivo}" alt="${foto.descripcion}"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
        <div class="plantel-galeria__fallback">🖼️</div>
      </div>
    `
  ).join('');

  const miniaturas = FOTOS_GALERIA.map(
    (foto, i) => `
      <button class="plantel-galeria__miniatura${i === 0 ? ' activa' : ''}" data-index="${i}" aria-label="Ver foto ${i + 1}">
        <img src="assets/img/${foto.archivo}" alt="" />
      </button>
    `
  ).join('');

  const puntos = FOTOS_GALERIA.map(
    (_, i) => `<span class="plantel-galeria__punto${i === 0 ? ' activo' : ''}" data-index="${i}"></span>`
  ).join('');

  return `
    <div class="plantel-galeria">
      <div class="plantel-galeria__viewport">
        <div class="plantel-galeria__track" id="plantel-galeria-track">
          ${slides}
        </div>
        <span class="plantel-galeria__contador" id="plantel-galeria-contador">1 / ${FOTOS_GALERIA.length}</span>
        <button class="plantel-galeria__flecha plantel-galeria__flecha--izq oculta" id="plantel-galeria-izq" aria-label="Foto anterior">‹</button>
        <button class="plantel-galeria__flecha plantel-galeria__flecha--der" id="plantel-galeria-der" aria-label="Foto siguiente">›</button>
      </div>
      <p class="plantel-galeria__descripcion" id="plantel-galeria-descripcion">${FOTOS_GALERIA[0].descripcion}</p>
      <div class="plantel-galeria__miniaturas" id="plantel-galeria-miniaturas">${miniaturas}</div>
      <div class="plantel-galeria__puntos" id="plantel-galeria-puntos">${puntos}</div>
    </div>
  `;
}

/**
 * Engancha la interacción del carrusel: flechas, miniaturas y puntos
 * navegan sincronizadamente, igual que el PageView + miniaturas +
 * indicadores de puntos de conoce_plantel.dart.
 * @param {HTMLElement} contenedor
 */
function inicializarGaleria(contenedor) {
  const track = contenedor.querySelector('#plantel-galeria-track');
  const contador = contenedor.querySelector('#plantel-galeria-contador');
  const descripcion = contenedor.querySelector('#plantel-galeria-descripcion');
  const flechaIzq = contenedor.querySelector('#plantel-galeria-izq');
  const flechaDer = contenedor.querySelector('#plantel-galeria-der');
  const miniaturas = [...contenedor.querySelectorAll('.plantel-galeria__miniatura')];
  const puntos = [...contenedor.querySelectorAll('.plantel-galeria__punto')];

  let indice = 0;
  const total = FOTOS_GALERIA.length;

  function irA(nuevoIndice) {
    indice = Math.max(0, Math.min(total - 1, nuevoIndice));

    track.style.transform = `translateX(-${indice * 100}%)`;
    contador.textContent = `${indice + 1} / ${total}`;
    descripcion.textContent = FOTOS_GALERIA[indice].descripcion;

    miniaturas.forEach((min, i) => min.classList.toggle('activa', i === indice));
    puntos.forEach((punto, i) => punto.classList.toggle('activo', i === indice));
    flechaIzq.classList.toggle('oculta', indice === 0);
    flechaDer.classList.toggle('oculta', indice === total - 1);

    miniaturas[indice]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  flechaIzq.addEventListener('click', () => irA(indice - 1));
  flechaDer.addEventListener('click', () => irA(indice + 1));
  miniaturas.forEach((min) => min.addEventListener('click', () => irA(Number(min.dataset.index))));
  puntos.forEach((punto) => punto.addEventListener('click', () => irA(Number(punto.dataset.index))));
}

registrarRuta('/plantel', renderPlantel);