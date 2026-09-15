// ═════════════════════════════════════════════════════════════════
// comun.js
//
// Helpers de renderizado compartidos por todas las pantallas de
// carrera (isc.js, icda.js, iinf.js y el resto). Réplica funcional
// de los widgets privados que se repetían casi idénticos en cada
// Screen.dart: _SectionTitle, _InfoCard, _ObjetivoItem,
// _PerfilSection, _ReticulaItem, _SemestreExpansion,
// _EspecialidadExpansion, _MateriaItem y _MateriaInfoItem.
//
// Cada carrera define su propio "color de acento" (equivalente al
// cs.primary/cs.secondary/cs.tertiary hardcodeado dentro de cada
// widget privado en Dart) y lo pasa como parámetro `color` a estos
// helpers. Ese color se inyecta como la variable CSS --color-carrera
// vía `style` inline, y carreras.css calcula los tintes translúcidos
// con color-mix() a partir de ella.
//
// Nota de fidelidad: en _MateriaItem del Dart original, el ícono de
// PDF siempre usa el acento principal de la carrera (cs.primary en
// ISC, cs.tertiary en ICDA/IINF) incluso dentro de una Especialidad
// con su propio color de encabezado — no hereda el color de la
// especialidad. renderEspecialidadExpansion replica esto: tinta su
// propio encabezado con `especialidad.color`, pero pasa el acento
// de la carrera (no el de la especialidad) a las materias anidadas.
//
// Todos los renderXxx devuelven HTML como string, siguiendo el
// mismo patrón que ya usa plantel.js. La interacción (acordeones,
// apertura del visor de PDF, botón de regresar) se engancha con una
// sola llamada a inicializarCarrera(contenedor) al final del render
// de cada pantalla.
// ═════════════════════════════════════════════════════════════════

import { abrirPdfViewer } from './pdf-viewer.js';

const ORDINALES = ['', '1er', '2do', '3er', '4to', '5to', '6to', '7mo', '8vo', '9no'];

/**
 * Encabezado tipo SliverAppBar: ícono decorativo de fondo, chip de
 * departamento y título grande, todo teñido con `color`. Acepta un
 * `chipExtra` opcional (texto) para carreras que necesitan un
 * segundo chip sólido junto al de departamento, ej. "Nueva carrera"
 * en ICDA.
 * @param {{ color: string, icono: string, departamento: string, titulo: string, chipExtra?: string }} opts
 */
export function renderHeroCarrera({ color, icono, departamento, titulo, chipExtra }) {
  return `
    <header class="carrera-hero" style="--color-carrera:${color}">
      <button class="carrera-hero__volver" type="button" aria-label="Regresar">‹</button>
      <span class="carrera-hero__icono-fondo">${icono}</span>
      <div class="carrera-hero__chips">
        <span class="carrera-hero__chip">${departamento}</span>
        ${chipExtra ? `<span class="carrera-hero__chip carrera-hero__chip--solido">${chipExtra}</span>` : ''}
      </div>
      <h1 class="carrera-hero__titulo">${titulo}</h1>
    </header>
  `;
}

/** Título de sección con barra vertical de acento (equivalente a _SectionTitle). */
export function renderSectionTitle(texto, color) {
  return `
    <div class="carrera-titulo" style="--color-carrera:${color}">
      <span class="carrera-titulo__barra"></span>
      <h2>${texto}</h2>
    </div>
  `;
}

/**
 * Card compacta con ícono, título y texto (equivalente a _InfoCard).
 * @param {{ icono: string, titulo: string, contenido: string, color: string }} opts
 */
export function renderInfoCard({ icono, titulo, contenido, color }) {
  return `
    <div class="carrera-info-card" style="--color-carrera:${color}">
      <span class="carrera-info-card__icono">${icono}</span>
      <p class="carrera-info-card__titulo">${titulo}</p>
      <p class="carrera-info-card__texto">${contenido}</p>
    </div>
  `;
}

/** Caja de texto del Objetivo General. */
export function renderObjetivoGeneral(texto, color) {
  return `
    <div class="carrera-objetivo" style="--color-carrera:${color}">
      <p>${texto}</p>
    </div>
  `;
}

/** Fila numerada de un Objetivo Específico (equivalente a _ObjetivoItem). */
export function renderObjetivoItem(numero, titulo, descripcion, color) {
  return `
    <div class="carrera-objetivo-item" style="--color-carrera:${color}">
      <span class="carrera-objetivo-item__numero">${numero}</span>
      <div>
        <p class="carrera-objetivo-item__titulo">${titulo}</p>
        <p class="carrera-objetivo-item__descripcion">${descripcion}</p>
      </div>
    </div>
  `;
}

/** Lista de bullets con punto de color (equivalente a _PerfilSection). */
export function renderPerfilSection(items, color) {
  return `
    <div class="carrera-perfil" style="--color-carrera:${color}">
      ${items
        .map(
          (item) => `
        <div class="carrera-perfil__item">
          <span class="carrera-perfil__punto"></span>
          <p>${item}</p>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

/**
 * Card tappable que abre el temario/retícula en el visor de PDF
 * (equivalente a _ReticulaItem).
 * @param {{ clave: string, nombre: string, url: string }} reticula
 */
export function renderReticulaItem(reticula, color) {
  return `
    <div
      class="carrera-reticula carrera-pdf-item"
      style="--color-carrera:${color}"
      data-url="${reticula.url}"
      data-titulo="${reticula.nombre}"
      role="button"
      tabindex="0"
    >
      <span class="carrera-reticula__icono">🗂️</span>
      <div class="carrera-reticula__texto">
        <p class="carrera-reticula__nombre">${reticula.nombre}</p>
        <p class="carrera-reticula__clave">${reticula.clave}</p>
      </div>
      <span class="carrera-reticula__pdf">📄</span>
    </div>
  `;
}

/**
 * Fila tappable de una materia (equivalente a _MateriaItem). Si
 * `materia.url` está vacío, se renderiza sin interacción con ícono
 * de info, igual que el `hasUrl` de ISC/ICDA o `soloInformativo`
 * de IINF.
 * @param {{ nombre: string, url: string }} materia
 */
export function renderMateriaItem(materia, color) {
  const tieneUrl = Boolean(materia.url);
  if (!tieneUrl) return renderMateriaInfoItem(materia.nombre, color);

  return `
    <div
      class="carrera-materia carrera-pdf-item"
      style="--color-carrera:${color}"
      data-url="${materia.url}"
      data-titulo="${materia.nombre}"
      role="button"
      tabindex="0"
    >
      <span class="carrera-materia__icono">📄</span>
      <p class="carrera-materia__nombre">${materia.nombre}</p>
      <span class="carrera-materia__flecha">›</span>
    </div>
  `;
}

/** Fila de solo texto para materias sin PDF (equivalente a _MateriaInfoItem). */
export function renderMateriaInfoItem(nombre, color) {
  return `
    <div class="carrera-materia carrera-materia--info" style="--color-carrera:${color}">
      <span class="carrera-materia__icono">ℹ️</span>
      <p class="carrera-materia__nombre">${nombre}</p>
    </div>
  `;
}

/**
 * Acordeón de un semestre del Plan de Estudios (equivalente a
 * _SemestreExpansion). `semestre.soloInformativo` controla si sus
 * materias se muestran como filas de solo texto, igual que el 9no
 * semestre de IINF. `semestre.etiqueta`, si viene definida,
 * sobreescribe la palabra por defecto ('materias'/'actividades') —
 * necesario porque algunas carreras (ej. LADM) usan singular cuando
 * el semestre tiene una sola entrada informativa.
 * @param {{ numero: number, materias: Array<{nombre:string,url:string}>, soloInformativo?: boolean, etiqueta?: string }} semestre
 */
export function renderSemestreExpansion(semestre, color) {
  const ordinal = ORDINALES[semestre.numero];
  const etiqueta = semestre.etiqueta ?? (semestre.soloInformativo ? 'actividades' : 'materias');

  const filas = semestre.soloInformativo
    ? semestre.materias.map((m) => renderMateriaInfoItem(m.nombre, color)).join('')
    : semestre.materias.map((m) => renderMateriaItem(m, color)).join('');

  return `
    <div class="carrera-expansion" style="--color-carrera:${color}">
      <button class="carrera-expansion__cabecera" type="button">
        <span class="carrera-expansion__numero">${semestre.numero}</span>
        <span class="carrera-expansion__info">
          <span class="carrera-expansion__titulo">${ordinal} Semestre</span>
          <span class="carrera-expansion__subtitulo">${semestre.materias.length} ${etiqueta}</span>
        </span>
        <span class="carrera-expansion__flecha">⌄</span>
      </button>
      <div class="carrera-expansion__cuerpo">
        <div class="carrera-expansion__cuerpo-inner">${filas}</div>
      </div>
    </div>
  `;
}

/**
 * Acordeón de una especialidad (equivalente a _EspecialidadExpansion).
 * El encabezado se tiñe con `especialidad.color`; las materias
 * anidadas usan `colorMateria` (el acento de la carrera), igual que
 * en el Dart original. Si `especialidad.subtitulo` viene definido
 * (ej. la clave del plan en IIND), se usa en vez del conteo de
 * materias por defecto.
 * @param {{ nombre: string, icono: string, color: string, materias: Array<{nombre:string,url:string}>, subtitulo?: string }} especialidad
 * @param {string} colorMateria
 */
export function renderEspecialidadExpansion(especialidad, colorMateria) {
  const filas = especialidad.materias.map((m) => renderMateriaItem(m, colorMateria)).join('');
  const subtitulo = especialidad.subtitulo ?? `${especialidad.materias.length} materias`;

  return `
    <div class="carrera-expansion" style="--color-carrera:${especialidad.color}">
      <button class="carrera-expansion__cabecera" type="button">
        <span class="carrera-expansion__icono">${especialidad.icono}</span>
        <span class="carrera-expansion__info">
          <span class="carrera-expansion__titulo">${especialidad.nombre}</span>
          <span class="carrera-expansion__subtitulo">${subtitulo}</span>
        </span>
        <span class="carrera-expansion__flecha">⌄</span>
      </button>
      <div class="carrera-expansion__cuerpo">
        <div class="carrera-expansion__cuerpo-inner">${filas}</div>
      </div>
    </div>
  `;
}

/**
 * Engancha toda la interacción de una pantalla de carrera ya
 * insertada en el DOM: botón de regresar, acordeones (semestres y
 * especialidades) y apertura del visor de PDF en retículas/materias.
 * Se llama una sola vez al final del render de cada pantalla.
 * @param {HTMLElement} contenedor
 */
export function inicializarCarrera(contenedor) {
  contenedor
    .querySelector('.carrera-hero__volver')
    ?.addEventListener('click', () => window.history.back());

  contenedor.querySelectorAll('.carrera-expansion__cabecera').forEach((boton) => {
    boton.addEventListener('click', () => {
      boton.closest('.carrera-expansion').classList.toggle('carrera-expansion--abierta');
    });
  });

  contenedor.querySelectorAll('.carrera-pdf-item').forEach((el) => {
    el.addEventListener('click', () => {
      abrirPdfViewer({ titulo: el.dataset.titulo, url: el.dataset.url });
    });
  });
}

/**
 * Párrafo + fila de chips para el Campo Laboral (equivalente a
 * _CampoLaboralSection). Cada chip lleva un ícono y una etiqueta,
 * ej. empresas o sectores destacados para el egresado.
 * @param {{ texto: string, chips: Array<{icono:string,nombre:string}>, color: string }} opts
 */
export function renderCampoLaboral({ texto, chips, color }) {
  return `
    <div class="carrera-campo-laboral" style="--color-carrera:${color}">
      <p class="carrera-campo-laboral__texto">${texto}</p>
      <div class="carrera-campo-laboral__chips">
        ${chips
          .map(
            (c) => `
          <span class="carrera-campo-laboral__chip">
            <span class="carrera-campo-laboral__chip-icono">${c.icono}</span>${c.nombre}
          </span>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}