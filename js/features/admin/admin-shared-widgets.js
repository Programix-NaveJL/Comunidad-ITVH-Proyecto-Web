// ═════════════════════════════════════════════════════════════════
// admin-shared-widgets.js
// Ubicación: js/features/admin/admin-shared-widgets.js
//
// Réplica web de admin_shared_widgets.dart. Piezas reutilizadas por
// panel-admin.js y por las 5 pestañas del panel (según se vayan
// construyendo): buscador, card base, tarjeta de métrica, acceso
// rápido, etiqueta de sección, empty state y pantalla de acceso
// denegado.
//
// Convención: los widgets "tontos" (sin estado propio: AdminCard,
// MetricCard, SectionLabel, EmptyAdmin) son funciones que devuelven
// HTML como string, para insertarse dentro de bloques más grandes
// (igual que plantillaX() en maestro-card.js). AccesoRapido también
// es string + un activador aparte (mismo patrón "plantilla +
// activar" que el resto del proyecto). AdminSearchBar SÍ tiene
// estado propio (el botón X reacciona en vivo al texto, como en
// Dart), así que se monta como nodo DOM con un pequeño controlador.
//
// DIFERENCIA INTENCIONAL: el paquete `timeago` de Dart no tiene
// equivalente sin agregar una dependencia externa nueva — se
// reemplaza por formatearTiempoRelativo(), un formateador propio en
// español con las mismas franjas que timeago.EsMessages() cubre en
// la práctica (segundos/minutos/horas/días/meses/años).
// ═════════════════════════════════════════════════════════════════

// ── AdminSearchBar ───────────────────────────────────────────────

/**
 * Monta una barra de búsqueda con botón "X" que aparece/desaparece
 * según haya texto. Devuelve { obtenerValor, limpiar, destruir }.
 */
export function crearAdminSearchBar(contenedor, { hint, onChanged }) {
  contenedor.innerHTML = `
    <div class="adm-searchbar">
      <span class="adm-searchbar__icono">🔍</span>
      <input type="text" class="adm-searchbar__input" placeholder="${escapar(hint)}" autocomplete="off" />
      <button class="adm-searchbar__limpiar" style="display:none">✕</button>
    </div>
  `;
  const input = contenedor.querySelector('.adm-searchbar__input');
  const btnLimpiar = contenedor.querySelector('.adm-searchbar__limpiar');

  function actualizarBoton() {
    btnLimpiar.style.display = input.value ? '' : 'none';
  }

  const onInput = () => {
    actualizarBoton();
    onChanged(input.value);
  };
  input.addEventListener('input', onInput);
  btnLimpiar.addEventListener('click', () => {
    input.value = '';
    actualizarBoton();
    onChanged('');
  });

  return {
    obtenerValor: () => input.value,
    limpiar: () => {
      input.value = '';
      actualizarBoton();
    },
    destruir: () => input.removeEventListener('input', onInput),
  };
}

// ── AdminCard ─────────────────────────────────────────────────────

export function plantillaAdminCard(innerHtml) {
  return `<div class="adm-card">${innerHtml}</div>`;
}

// ── MetricCard ────────────────────────────────────────────────────

export function plantillaMetricCard({ emoji, label, valor, color, alerta = false }) {
  return `
    <div class="adm-metric-card${alerta ? ' adm-metric-card--alerta' : ''}" style="--adm-metric-color:${color}">
      <span class="adm-metric-card__emoji">${emoji}</span>
      <div>
        <p class="adm-metric-card__valor">${escapar(valor)}</p>
        <p class="adm-metric-card__label">${escapar(label)}</p>
      </div>
    </div>
  `;
}

// ── AccesoRapido ──────────────────────────────────────────────────

export function plantillaAccesoRapido({ icono, color, titulo, subtitulo, tabIndice }) {
  return `
    <button class="adm-acceso-rapido" data-tab-indice="${tabIndice}">
      <span class="adm-acceso-rapido__icono" style="background:${color}1f;color:${color}">${icono}</span>
      <span class="adm-acceso-rapido__textos">
        <span class="adm-acceso-rapido__titulo">${escapar(titulo)}</span>
        <span class="adm-acceso-rapido__subtitulo">${escapar(subtitulo)}</span>
      </span>
      <span class="adm-acceso-rapido__flecha">›</span>
    </button>
  `;
}

/** Engancha los clicks de todos los .adm-acceso-rapido dentro de `zona`. */
export function activarAccesosRapidos(zona, onIrATab) {
  zona.querySelectorAll('[data-tab-indice]').forEach((btn) => {
    btn.addEventListener('click', () => onIrATab(Number(btn.dataset.tabIndice)));
  });
}

// ── SectionLabel ──────────────────────────────────────────────────

export function plantillaSectionLabel(label) {
  return `<p class="adm-section-label">${escapar(label)}</p>`;
}

// ── EmptyAdmin ────────────────────────────────────────────────────

export function plantillaEmptyAdmin({ mensaje, icono }) {
  return `
    <div class="adm-empty">
      <span class="adm-empty__icono">${icono}</span>
      <p class="adm-empty__mensaje">${escapar(mensaje)}</p>
    </div>
  `;
}

// ── PantallaAccesoDenegado ──────────────────────────────────────────

export function renderAccesoDenegado(contenedor) {
  contenedor.innerHTML = `
    <div class="adm-acceso-denegado">
      <div class="adm-acceso-denegado__icono-zona">🔒</div>
      <p class="adm-acceso-denegado__titulo">Acceso restringido</p>
      <p class="adm-acceso-denegado__texto">No tienes permisos de administrador para acceder a este panel.</p>
    </div>
  `;
}

// ── formatearTiempoRelativo (equivalente a timeago en español) ──────

const UNIDADES = [
  { limite: 60, div: 1, singular: 'segundo', plural: 'segundos', ahora: true },
  { limite: 3600, div: 60, singular: 'minuto', plural: 'minutos' },
  { limite: 86400, div: 3600, singular: 'hora', plural: 'horas' },
  { limite: 2592000, div: 86400, singular: 'día', plural: 'días' },
  { limite: 31536000, div: 2592000, singular: 'mes', plural: 'meses' },
  { limite: Infinity, div: 31536000, singular: 'año', plural: 'años' },
];

export function formatearTiempoRelativo(fechaIso) {
  const diffSeg = Math.max(0, (Date.now() - new Date(fechaIso).getTime()) / 1000);
  if (diffSeg < 45) return 'hace un momento';

  for (const u of UNIDADES) {
    if (diffSeg < u.limite) {
      const cantidad = Math.floor(diffSeg / u.div);
      return `hace ${cantidad} ${cantidad === 1 ? u.singular : u.plural}`;
    }
  }
  return '';
}

// ── Helpers ───────────────────────────────────────────────────────

export function capitalizar(texto) {
  if (!texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// ── Confirmación genérica (AlertDialog de Dart) ───────────────────

export function mostrarConfirmacionAdmin({ titulo, mensaje, textoConfirmar, color = '#007AFF' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'adm-dialogo-overlay';
    overlay.innerHTML = `
      <div class="adm-dialogo">
        <p class="adm-dialogo__titulo">${escapar(titulo)}</p>
        <p class="adm-dialogo__mensaje">${escapar(mensaje)}</p>
        <div class="adm-dialogo__acciones">
          <button data-valor="false">Cancelar</button>
          <button data-valor="true" style="color:${color}">${escapar(textoConfirmar)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const cerrar = (valor) => {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
      resolve(valor);
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cerrar(false);
    });
    overlay.querySelectorAll('[data-valor]').forEach((btn) => {
      btn.addEventListener('click', () => cerrar(btn.dataset.valor === 'true'));
    });
  });
}

// ── Menú de opciones tipo sheet ────────────────────────────────────
// Reemplaza al PopupMenuButton anclado de Flutter (sin equivalente
// web nativo sencillo) — mismo patrón de overlay que el resto del
// proyecto usa para menús contextuales (ver abrirMenuChat en
// chats-screen.js).

export function mostrarMenuOpcionesAdmin(opciones) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'adm-menu-overlay';
    overlay.innerHTML = `
      <div class="adm-menu-sheet">
        <div class="adm-sheet__manija"></div>
        ${opciones
          .map(
            (o) => `
            <button class="adm-menu-opcion${o.peligroso ? ' peligroso' : ''}" data-valor="${o.valor}" style="${o.color ? `color:${o.color}` : ''}">
              <span>${o.icono}</span><span>${escapar(o.label)}</span>
            </button>`
          )
          .join('')}
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const cerrar = (valor) => {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
      resolve(valor);
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cerrar(null);
    });
    overlay.querySelectorAll('[data-valor]').forEach((btn) => {
      btn.addEventListener('click', () => cerrar(btn.dataset.valor));
    });
  });
}

// ── Chips de filtro (FilterChip de Dart) ──────────────────────────

export function plantillaFiltrosChips(opciones, activo) {
  return `
    <div class="adm-filtros">
      ${opciones
        .map(
          ([valor, label]) => `
          <button class="adm-filtro-chip${valor === activo ? ' activo' : ''}" data-filtro="${valor}">${escapar(label)}</button>`
        )
        .join('')}
    </div>
  `;
}

export function activarFiltrosChips(zona, onCambio) {
  zona.querySelectorAll('[data-filtro]').forEach((btn) => {
    btn.addEventListener('click', () => onCambio(btn.dataset.filtro));
  });
}

// ── Copiar al portapapeles con toast ──────────────────────────────

export function idCorto(id) {
  return `${id.slice(0, 8)}…`;
}