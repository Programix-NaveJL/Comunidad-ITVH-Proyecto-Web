// ═════════════════════════════════════════════════════════════════
// oferta-educativa.js
//
// Pantalla que lista todas las carreras ofertadas por el ITVH, con
// búsqueda por nombre/siglas y filtro por área académica. Réplica
// funcional de oferta_educativa.dart.
//
// Las 12 carreras del catálogo ya están migradas y enlazadas en
// carreras.js — DISPONIBLES se mantiene por si en el futuro se
// agrega una carrera nueva al catálogo que aún no tenga pantalla
// propia: mientras no se agregue su clave aquí, se mostraría
// bloqueada con "Próximamente" en vez de romper la navegación.
// ═════════════════════════════════════════════════════════════════

import { registrarRuta, navegarA } from '../../core/router.js';

/** Claves de carrera que ya tienen pantalla real en carreras.js. */
const DISPONIBLES = new Set([
  'isc', 'itic', 'iinf', 'icda', 'iind', 'igee', 'ladm',
  'iqui', 'ibqa', 'iamb', 'iciv', 'ipet',
]);

/** Catálogo estático de las 12 carreras, con su área académica. */
const CARRERAS = [
  // ── Sistemas y Computación ──────────────────────────────────
  { nombre: 'Ing. en Sistemas Computacionales', siglas: 'ISC', icono: '💻', area: 'sistemas', clave: 'isc' },
  { nombre: 'Ing. en Tecnologías de la Información y Comunicaciones', siglas: 'ITIC', icono: '📶', area: 'sistemas', clave: 'itic' },
  { nombre: 'Ing. en Ciencias de Datos', siglas: 'ICDA', icono: '📊', area: 'sistemas', clave: 'icda' },
  { nombre: 'Ing. Informática', siglas: 'IINF', icono: '🖥️', area: 'sistemas', clave: 'iinf' },

  // ── Ingeniería Industrial ───────────────────────────────────
  { nombre: 'Ing. Industrial', siglas: 'IIND', icono: '🏭', area: 'industrial', clave: 'iind' },

  // ── Ciencias Económico-Administrativas ──────────────────────
  { nombre: 'Ing. en Gestión Empresarial', siglas: 'IGEE', icono: '💼', area: 'economico', clave: 'igee' },
  { nombre: 'Lic. en Administración', siglas: 'LADM', icono: '🏛️', area: 'economico', clave: 'ladm' },

  // ── Ingeniería Química, Bioquímica y Ambiental ──────────────
  { nombre: 'Ing. Química', siglas: 'IQUI', icono: '🧪', area: 'quimica', clave: 'iqui' },
  { nombre: 'Ing. Bioquímica', siglas: 'IBQA', icono: '🔬', area: 'quimica', clave: 'ibqa' },
  { nombre: 'Ing. Ambiental', siglas: 'IAMB', icono: '🌿', area: 'quimica', clave: 'iamb' },

  // ── Ciencias de la Tierra ────────────────────────────────────
  { nombre: 'Ing. Civil', siglas: 'ICIV', icono: '📐', area: 'tierra', clave: 'iciv' },
  { nombre: 'Ing. Petrolera', siglas: 'IPET', icono: '🛢️', area: 'tierra', clave: 'ipet' },
];

/**
 * Metadatos de cada área académica: nombre completo, nombre corto
 * para el chip, ícono y color de acento (equivalente al enum _Area
 * del Dart, incluyendo el orden en que se listan).
 */
const AREAS = [
  { clave: 'sistemas', label: 'Sistemas y Computación', labelCorto: 'Sistemas', icono: '📱', color: 'var(--color-primary)' },
  { clave: 'industrial', label: 'Ingeniería Industrial', labelCorto: 'Industrial', icono: '🏭', color: 'var(--color-tertiary)' },
  { clave: 'economico', label: 'Ciencias Económico-Administrativas', labelCorto: 'Económico-Admin.', icono: '🏛️', color: 'var(--color-secondary)' },
  { clave: 'quimica', label: 'Ing. Química, Bioquímica y Ambiental', labelCorto: 'Química', icono: '🧪', color: 'var(--color-area-quimica)' },
  // Provisional: reutiliza --color-tertiary hasta resolver el
  // acento real de "Ciencias de la Tierra" (cs.tertiaryFixed).
  { clave: 'tierra', label: 'Ciencias de la Tierra', labelCorto: 'Tierra', icono: '🏔️', color: 'var(--color-tertiary)' },
];

const AREAS_POR_CLAVE = Object.fromEntries(AREAS.map((a) => [a.clave, a]));

/** Estado del filtro, vive fuera del render para sobrevivir a los re-renders locales. */
let areaFiltro = null; // null = "Todos"
let busqueda = '';

/** Pinta la pantalla completa dentro de `contenedor`. */
export function renderOfertaEducativa(contenedor) {
  contenedor.innerHTML = `
    <div class="oferta">
      <header class="oferta-appbar">
        <button class="oferta-appbar__volver" type="button" aria-label="Regresar">‹</button>
        <h1 class="oferta-appbar__titulo">Oferta educativa</h1>
      </header>

      <div class="oferta-busqueda${busqueda ? ' oferta-busqueda--con-texto' : ''}">
        <span class="oferta-busqueda__icono">🔍</span>
        <input
          class="oferta-busqueda__input"
          type="text"
          placeholder="Buscar carrera o siglas..."
          value="${busqueda}"
        />
        <button class="oferta-busqueda__limpiar" type="button" aria-label="Limpiar búsqueda">✕</button>
      </div>

      <div class="oferta-chips">
        <button class="oferta-chip oferta-chip--todos${areaFiltro === null ? ' oferta-chip--activo' : ''}" type="button" style="--color-chip:var(--color-primary)">
          Todos
        </button>
        ${AREAS.map(
          (a) => `
          <button
            class="oferta-chip${areaFiltro === a.clave ? ' oferta-chip--activo' : ''}"
            type="button"
            data-area="${a.clave}"
            style="--color-chip:${a.color}"
          >${a.labelCorto}</button>
        `
        ).join('')}
      </div>

      <div class="oferta-stats">
        <div class="oferta-stat" style="--color-stat:var(--color-primary)">
          <span class="oferta-stat__valor">${CARRERAS.length}</span>
          <span class="oferta-stat__etiqueta">programas</span>
        </div>
        <div class="oferta-stat" style="--color-stat:var(--color-secondary)">
          <span class="oferta-stat__valor">${AREAS.length}</span>
          <span class="oferta-stat__etiqueta">áreas</span>
        </div>
      </div>

      <div class="oferta-lista" id="oferta-lista"></div>
    </div>
  `;

  contenedor
    .querySelector('.oferta-appbar__volver')
    .addEventListener('click', () => window.history.back());

  const input = contenedor.querySelector('.oferta-busqueda__input');
  const barraBusqueda = contenedor.querySelector('.oferta-busqueda');
  const limpiar = contenedor.querySelector('.oferta-busqueda__limpiar');

  input.addEventListener('input', () => {
    busqueda = input.value;
    barraBusqueda.classList.toggle('oferta-busqueda--con-texto', Boolean(busqueda));
    renderLista(contenedor);
  });

  limpiar.addEventListener('click', () => {
    busqueda = '';
    input.value = '';
    barraBusqueda.classList.remove('oferta-busqueda--con-texto');
    input.focus();
    renderLista(contenedor);
  });

  contenedor.querySelector('.oferta-chip--todos').addEventListener('click', () => {
    areaFiltro = null;
    renderOfertaEducativa(contenedor); // re-pinta todo para refrescar el estado activo de los chips
  });

  contenedor.querySelectorAll('.oferta-chips [data-area]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const clave = chip.dataset.area;
      areaFiltro = areaFiltro === clave ? null : clave; // toggle, igual que en Flutter
      renderOfertaEducativa(contenedor);
    });
  });

  renderLista(contenedor);
}

/** Filtra, agrupa por área y pinta solo la lista (sin re-render de búsqueda/chips). */
function renderLista(contenedor) {
  const lista = contenedor.querySelector('#oferta-lista');
  const filtradas = CARRERAS.filter((c) => {
    const coincideArea = areaFiltro === null || c.area === areaFiltro;
    const texto = busqueda.trim().toLowerCase();
    const coincideBusqueda =
      !texto || c.nombre.toLowerCase().includes(texto) || c.siglas.toLowerCase().includes(texto);
    return coincideArea && coincideBusqueda;
  });

  if (filtradas.length === 0) {
    lista.innerHTML = `
      <div class="oferta-vacio">
        <span class="oferta-vacio__icono">🔎</span>
        <p class="oferta-vacio__texto">Sin resultados para "${busqueda}"</p>
      </div>
    `;
    return;
  }

  // Agrupar respetando el orden de AREAS (no el de aparición en filtradas).
  const grupos = AREAS.map((area) => ({
    area,
    carreras: filtradas.filter((c) => c.area === area.clave),
  })).filter((g) => g.carreras.length > 0);

  lista.innerHTML = grupos
    .map(
      (g) => `
      <div class="oferta-area">
        <span class="oferta-area__pastilla" style="--color-area:${g.area.color}">
          <span>${g.area.icono}</span>${g.area.label}
        </span>
        <span class="oferta-area__divisor"></span>
      </div>
      ${g.carreras.map((c) => renderCarreraCard(c, g.area.color)).join('')}
    `
    )
    .join('');

  lista.querySelectorAll('.oferta-carrera:not(.oferta-carrera--bloqueada)').forEach((card) => {
    card.addEventListener('click', () => navegarA(`/carreras/${card.dataset.clave}`));
  });
}

/** Card individual de carrera; bloqueada con "Próximamente" si aún no está migrada. */
function renderCarreraCard(carrera, colorArea) {
  const bloqueada = !DISPONIBLES.has(carrera.clave);

  return `
    <div
      class="oferta-carrera${bloqueada ? ' oferta-carrera--bloqueada' : ''}"
      style="--color-area:${colorArea}"
      ${bloqueada ? '' : `data-clave="${carrera.clave}"`}
    >
      <span class="oferta-carrera__icono">${carrera.icono}</span>
      <div class="oferta-carrera__texto">
        <p class="oferta-carrera__nombre">${carrera.nombre}</p>
        <p class="oferta-carrera__siglas">${bloqueada ? `${carrera.siglas} · Próximamente` : carrera.siglas}</p>
      </div>
      <span class="oferta-carrera__estado">${bloqueada ? '🔒' : '›'}</span>
    </div>
  `;
}

registrarRuta('/oferta-educativa', renderOfertaEducativa);