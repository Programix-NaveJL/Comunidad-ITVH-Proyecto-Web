// marketplace-screen.js
// Ubicación: js/features/marketplace/marketplace-screen.js
//
// ═════════════════════════════════════════════════════════════════
// PROPÓSITO
// ═════════════════════════════════════════════════════════════════
// Contenedor del módulo "Market": agrupa Inicio, Publicar y Mi
// Negocio bajo una barra de navegación inferior flotante propia
// (equivalente web de MarketPlaceHome + PageView + barra flotante
// en Flutter). Cada subpantalla se monta una sola vez y se mantiene
// viva en el DOM — mismo patrón de "montado una vez" que usa
// shell.js para sus pestañas de nivel superior — así el feed de
// Inicio o el formulario de Publicar no pierden su estado al
// cambiar de tab.
//
// Se monta desde shell.js cuando el usuario entra a la pestaña
// 'market':
//   import('../marketplace/marketplace-screen.js').then(({ render }) => render(panel));
//
// ═════════════════════════════════════════════════════════════════
// RESPONSABILIDADES
// ═════════════════════════════════════════════════════════════════
//   - Cambiar de subpantalla tocando la barra inferior O deslizando
//     horizontalmente (ver CAMBIOS).
//   - Montar cada subpantalla una sola vez, la primera vez que asoma
//     en pantalla, y conservarla viva.
//   - Ofrecer a mi-negocio-personal.js el callback que cambia a la
//     tab "Publicar" y a marketplace-inicio.js el que abre el
//     perfil público de un emprendedor.
//
// ═════════════════════════════════════════════════════════════════
// CAMBIOS
// ═════════════════════════════════════════════════════════════════
//   - DESLIZAR ENTRE PESTAÑAS (equivalente al PageView de Flutter):
//     las 3 subpantallas ahora viven en un carril horizontal
//     (#market-pager) con CSS scroll-snap, así que el navegador se
//     encarga del gesto: el contenido sigue al dedo, hace "snap" a
//     la sección más cercana y nunca salta más de una. No hay
//     listeners de touch/mouse propios.
//   - El "pill" azul de la barra inferior ya no se mueve con
//     `left` + transición CSS: su posición se calcula con el
//     scrollLeft del carril, así que sigue al dedo en tiempo real.
//   - cambiarTab() (usada por los botones de la barra y por el
//     callback de mi-negocio-personal.js) ahora hace un scrollTo()
//     suave hacia la subpantalla en vez de mostrar/ocultar paneles
//     con display.
//   - Montaje perezoso: una subpantalla se monta cuando empieza a
//     asomar durante el deslizamiento (para que no aparezca vacía),
//     salvo al tocar la barra, donde solo se monta el destino y no
//     las intermedias que se cruzan en la animación.
//   - Se conserva la clase .visible en el panel activo (por si
//     algún módulo hijo la consulta) y el resto se marca con
//     `inert` para que sus elementos no reciban foco estando fuera
//     de vista (un foco en un panel oculto haría que el carril se
//     desplazara solo).
//
// Limitación: el deslizamiento es el nativo del navegador — funciona
// con dedo (táctil) y con trackpad; con el mouse en escritorio no se
// puede "arrastrar", ahí se cambia con la barra inferior.

import { navegarA } from '../../core/router.js';

const TABS = [
  { id: 'inicio',   label: 'Inicio',     icono: '🏠' },
  { id: 'publicar', label: 'Publicar',   icono: '➕' },
  { id: 'negocio',  label: 'Mi negocio', icono: '🏪' },
];

// Milisegundos sin eventos de scroll para considerar que el
// deslizamiento (o el scroll suave de la barra) ya terminó. Se usa
// en vez del evento 'scrollend' porque no todos los navegadores lo
// soportan todavía.
const FIN_SCROLL_MS = 120;

let tabActiva = 'inicio';
let indiceActivo = 0;
// true mientras dura el scroll suave disparado por un click en la
// barra: evita que el "redondeo" de las subpantallas intermedias
// haga parpadear la pestaña activa.
let navegandoPorClick = false;
let temporizadorFinScroll = null;

export function render(contenedor) {
  tabActiva = 'inicio';
  indiceActivo = 0;
  navegandoPorClick = false;
  clearTimeout(temporizadorFinScroll);
  temporizadorFinScroll = null;

  contenedor.innerHTML = plantilla();
  activarInteracciones(contenedor);
}

function plantilla() {
  return `
    <div class="market-shell">
      <header class="market-header">
        <h1 class="market-header__titulo">Market<span>Place</span></h1>
      </header>

      <div class="market-contenido">
        <div class="market-pager" id="market-pager">
          ${TABS.map((t) => `<section class="market-panel" data-market-panel="${t.id}"></section>`).join('')}
        </div>
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
  const pager = contenedor.querySelector('#market-pager');

  contenedor.querySelectorAll('[data-market-tab]').forEach((btn) => {
    btn.addEventListener('click', () => cambiarTab(contenedor, btn.dataset.marketTab));
  });

  pager.addEventListener('scroll', () => alScrollear(contenedor, pager), { passive: true });

  // Si cambia el ANCHO del carril (rotar el celular, redimensionar la
  // ventana), scrollLeft queda en píxeles viejos y el snap podría
  // caer en otra subpantalla: se re-alinea a la activa. Se ignora el
  // primer aviso (medición inicial) y los cambios solo de alto.
  let anchoPrevio = 0;
  new ResizeObserver(() => {
    const ancho = pager.clientWidth;
    if (!ancho || ancho === anchoPrevio) return;
    const esPrimera = anchoPrevio === 0;
    anchoPrevio = ancho;
    if (!esPrimera) pager.scrollLeft = indiceActivo * ancho;
  }).observe(pager);

  // Estado y montaje de la subpantalla inicial.
  sincronizarActiva(contenedor, 0, true);
  montarPanel(contenedor, 'inicio');
  posicionarPill(contenedor, 0);
}

// ── Cambio de subpantalla ───────────────────────────────────────

// Click en un botón de la barra (o callback de otro módulo): scroll
// suave hacia la subpantalla.
function cambiarTab(contenedor, id) {
  const indice = TABS.findIndex((t) => t.id === id);
  if (indice === -1) return;

  const pager = contenedor.querySelector('#market-pager');
  if (!pager) return;

  const destino = indice * pager.clientWidth;
  if (indice === indiceActivo && Math.abs(pager.scrollLeft - destino) < 2) return;

  navegandoPorClick = true;
  montarPanel(contenedor, id);
  sincronizarActiva(contenedor, indice);

  const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  pager.scrollTo({ left: destino, behavior: reducirMovimiento ? 'auto' : 'smooth' });
}

// Se dispara continuamente mientras el carril se desplaza (por dedo,
// trackpad o por el scroll suave de cambiarTab).
function alScrollear(contenedor, pager) {
  const ancho = pager.clientWidth;
  if (!ancho) return;

  // Posición fraccionaria: 0 = Inicio, 1 = Publicar, 1.5 = a medio
  // camino entre Publicar y Mi negocio. Se limita por si Safari
  // reporta valores fuera de rango durante el rebote elástico.
  const posicion = Math.min(Math.max(pager.scrollLeft / ancho, 0), TABS.length - 1);

  posicionarPill(contenedor, posicion);

  if (!navegandoPorClick) {
    // Monta las subpantallas que ya asoman para que no aparezcan
    // vacías mientras se arrastra.
    montarPanel(contenedor, TABS[Math.floor(posicion)].id);
    montarPanel(contenedor, TABS[Math.ceil(posicion)].id);
    sincronizarActiva(contenedor, Math.round(posicion));
  }

  // "Fin de scroll" por inactividad: libera el candado del click y
  // asegura que la pestaña activa coincida con donde quedó el snap.
  clearTimeout(temporizadorFinScroll);
  temporizadorFinScroll = setTimeout(() => {
    navegandoPorClick = false;
    const indiceFinal = Math.min(
      Math.max(Math.round(pager.scrollLeft / (pager.clientWidth || 1)), 0),
      TABS.length - 1
    );
    sincronizarActiva(contenedor, indiceFinal);
  }, FIN_SCROLL_MS);
}

// Actualiza todo lo que depende de "cuál es la pestaña activa":
// botones de la barra, clase .visible e inert de los paneles. Es
// idempotente: si el índice no cambió, no hace nada (salvo con
// `forzar`, para la pintura inicial).
function sincronizarActiva(contenedor, indice, forzar = false) {
  if (!forzar && indice === indiceActivo) return;
  indiceActivo = indice;
  tabActiva = TABS[indice].id;

  contenedor.querySelectorAll('.market-tabbar__btn').forEach((btn) => {
    btn.classList.toggle('activa', btn.dataset.marketTab === tabActiva);
  });

  contenedor.querySelectorAll('.market-panel').forEach((panel) => {
    const activo = panel.dataset.marketPanel === tabActiva;
    panel.classList.toggle('visible', activo);
    panel.inert = !activo;
  });
}

// `posicion` es fraccionaria: el pill sigue al carril en tiempo real
// (su transición CSS se eliminó, ver marketplace-shell.css).
function posicionarPill(contenedor, posicion) {
  const pill = contenedor.querySelector('#market-tabbar-pill');
  if (pill) pill.style.transform = `translateX(${posicion * 100}%)`;
}

// Monta el contenido de una subpantalla la primera vez que se
// muestra. Cada módulo se autoresponsabiliza de su propio render;
// aquí solo se decide *cuál* importar y se marca como montado para
// no repetir la importación/inserción al volver a esa tab.
function montarPanel(contenedor, id) {
  const panel = contenedor.querySelector(`[data-market-panel="${id}"]`);
  if (!panel || panel.dataset.montado) return;
  panel.dataset.montado = '1';

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