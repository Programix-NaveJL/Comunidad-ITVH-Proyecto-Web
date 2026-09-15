// js/features/marketplace/marketplace-screen.js
//
// Contenedor del módulo "Market": agrupa Inicio, Publicar y Mi
// Negocio bajo una barra de navegación inferior flotante propia
// (equivalente web de MarketPlaceHome + PageView + barra flotante
// en Flutter). Cada subpantalla se monta una sola vez y se mantiene
// viva en el DOM (solo se oculta con CSS) — mismo patrón de
// "montado una vez" que usa shell.js para sus pestañas de nivel
// superior — así el feed de Inicio o el formulario de Publicar no
// pierden su estado al cambiar de tab.
//
// Se monta desde shell.js cuando el usuario entra a la pestaña
// 'market':
//   import('../marketplace/marketplace-screen.js').then(({ render }) => render(panel));

import { navegarA } from '../../core/router.js';

const TABS = [
  { id: 'inicio',   label: 'Inicio',     icono: '🏠' },
  { id: 'publicar', label: 'Publicar',   icono: '➕' },
  { id: 'negocio',  label: 'Mi negocio', icono: '🏪' },
];

let tabActiva = 'inicio';

export function render(contenedor) {
  tabActiva = 'inicio';
  contenedor.innerHTML = plantilla();
  activarInteracciones(contenedor);
  montarPanel(contenedor, 'inicio');
}

function plantilla() {
  return `
    <div class="market-shell">
      <header class="market-header">
        <h1 class="market-header__titulo">Market<span>Place</span></h1>
      </header>

      <div class="market-contenido">
        ${TABS.map((t) => `<section class="market-panel" data-market-panel="${t.id}"></section>`).join('')}
      </div>

      <nav class="market-tabbar" id="market-tabbar">
        <div class="market-tabbar__pill" id="market-tabbar-pill"></div>
        ${TABS.map((t, i) => `
          <button class="market-tabbar__btn${i === 0 ? ' activa' : ''}" data-market-tab="${t.id}">
            <span class="market-tabbar__icono">${t.icono}</span>
            <span class="market-tabbar__label">${t.label}</span>
          </button>
        `).join('')}
      </nav>
    </div>
  `;
}

function activarInteracciones(contenedor) {
  contenedor.querySelectorAll('[data-market-tab]').forEach((btn) => {
    btn.addEventListener('click', () => cambiarTab(contenedor, btn.dataset.marketTab));
  });
}

function cambiarTab(contenedor, id) {
  if (id === tabActiva) return;
  tabActiva = id;

  const indice = TABS.findIndex((t) => t.id === id);
  contenedor.querySelectorAll('.market-tabbar__btn').forEach((btn, i) => {
    btn.classList.toggle('activa', i === indice);
  });
  moverPill(contenedor, indice);

  contenedor.querySelectorAll('.market-panel').forEach((panel) => {
    const activo = panel.dataset.marketPanel === id;
    panel.classList.toggle('visible', activo);
    if (activo) montarPanel(contenedor, id);
  });
}

function moverPill(contenedor, indice) {
  const pill = contenedor.querySelector('#market-tabbar-pill');
  if (pill) pill.style.left = `calc(${indice} * (100% / ${TABS.length}))`;
}

// Monta el contenido de una subpantalla la primera vez que se
// muestra. Cada módulo se autoresponsabiliza de su propio render;
// aquí solo se decide *cuál* importar y se marca como montado para
// no repetir la importación/inserción al volver a esa tab.
function montarPanel(contenedor, id) {
  const panel = contenedor.querySelector(`[data-market-panel="${id}"]`);
  if (!panel || panel.dataset.montado) return;
  panel.dataset.montado = '1';
  panel.classList.toggle('visible', id === tabActiva);

  if (id === 'inicio') {
    import('./marketplace-inicio.js').then(({ render }) => render(panel, verPerfilEmprendedor));
    return;
  }
  if (id === 'publicar') {
    import('./marketplace-publicar.js').then(({ render }) => render(panel));
    return;
  }
  if (id === 'negocio') {
    // Al tocar "Nueva"/"Crear publicación" sin publicaciones activas,
    // mi-negocio-personal.js llama a este callback para cambiar a la
    // tab "Publicar" — mismo mecanismo que _irATab(1) en el Dart
    // original (MarketPlaceHome._MarketPlaceHomeState), en vez de
    // Navigator.push a una pantalla aparte.
    import('./mi-negocio-personal.js').then(({ render }) =>
      render(panel, () => cambiarTab(contenedor, 'publicar'))
    );
    return;
  }
}

// Navega al perfil público de un emprendedor (equivalente de
// MarketplaceMiNegocioPublico). Ruta real registrada en
// mi-negocio-publico.js bajo '/negocio'.
function verPerfilEmprendedor(emprendedorId) {
  navegarA(`/negocio/${emprendedorId}`);
}