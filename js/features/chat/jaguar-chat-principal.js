// ═════════════════════════════════════════════════════════════════
// jaguar-chat-principal.js
// Ubicación: js/features/chat/jaguar-chat-principal.js
//
// ═════════════════════════════════════════════════════════════════
// PROPÓSITO
// ═════════════════════════════════════════════════════════════════
// Contenedor principal de "Jaguar Chat" para web. Puerto web de
// Pantallas/JaguarChat/JaguarChatPrincipal.dart: agrupa las 4
// secciones del módulo de comunicación bajo un mismo encabezado y
// una barra de navegación inferior tipo "pill" flotante con blur
// real (backdrop-filter), estilo Telegram.
//
// Se monta desde js/features/shell/shell.js cuando el usuario entra
// a la pestaña "jaguares":
//
//   if (id === 'jaguares') {
//     import('../chat/jaguar-chat-principal.js').then(({ render }) => render(panel));
//     return;
//   }
//
// ═════════════════════════════════════════════════════════════════
// RESPONSABILIDADES
// ═════════════════════════════════════════════════════════════════
// Secciones (tabs):
//   0. chats     — lista de conversaciones. YA CONECTADA a
//                  js/features/chat/chats/chats-screen.js (ver
//                  montarPanel más abajo).
//   1. maestros  — Referencias de maestros. YA CONECTADA a
//                  js/features/chat/maestros/maestros-screen.js.
//   2. perdidas  — Cosas perdidas. YA CONECTADA a
//                  js/features/chat/perdidas/cosas-perdidas-screen.js.
//   3. ajustes   — Configuración del módulo de chat. Placeholder.
//
//   - Cambiar de sección tocando el pill O deslizando horizontalmente
//     (ver CAMBIOS).
//   - Montar cada sección una sola vez (data-montado), la primera vez
//     que asoma en pantalla, y conservarla viva (sin destruirla) para
//     no perder scroll/estado al volver a una tab ya visitada.
//   - Reservar .jchat-fab-zona para los FABs de Maestros y Cosas
//     perdidas (los inyectan sus propios módulos).
//
// ═════════════════════════════════════════════════════════════════
// CAMBIOS
// ═════════════════════════════════════════════════════════════════
//   - DESLIZAR ENTRE PESTAÑAS (equivalente al PageView de Flutter):
//     las 4 secciones ahora viven en un carril horizontal
//     (#jchat-pager) con CSS scroll-snap, así que el navegador se
//     encarga del gesto: el contenido sigue al dedo, hace "snap" a
//     la sección más cercana y nunca salta más de una (scroll-snap-
//     stop: always). No hay listeners de touch/mouse propios.
//   - El indicador azul del pill ya no salta con una transición CSS:
//     su posición se calcula a partir del scrollLeft del carril, así
//     que sigue al dedo en tiempo real (y también anima solo cuando
//     se toca un botón, porque ese toque hace un scroll suave).
//   - Tocar un botón del pill ahora hace scrollTo() suave hacia esa
//     sección en lugar de mostrar/ocultar paneles con display.
//   - Montaje perezoso: una sección se monta cuando empieza a asomar
//     durante el deslizamiento (para que no aparezca vacía), salvo
//     al tocar el pill, donde solo se monta el destino y no las
//     intermedias que se cruzan en la animación.
//   - Se conserva la clase .visible en el panel activo (por si algún
//     módulo hijo la consulta) y se marca el resto con `inert` para
//     que sus elementos no reciban foco/tab estando fuera de vista
//     (un foco en un panel oculto haría que el carril se desplazara
//     solo).
//
// Diferencias intencionales respecto a la versión Flutter:
//   • El deslizamiento es el nativo del navegador: funciona con dedo
//     (táctil) y con trackpad; con el mouse en escritorio no se puede
//     "arrastrar" (no hay drag con mouse), se cambia con el pill.
//   • El FAB de "Agregar docente" (Maestros) y el FAB de "Reportar"
//     (Cosas perdidas) se implementan en sus propios módulos, no
//     aquí — este archivo solo reserva el contenedor donde esos
//     módulos pueden inyectar su propio FAB posicionado sobre el
//     pill (ver clase .jchat-fab-zona). Esa zona es fija y está
//     fuera del carril, así que NO se desliza con las secciones.
// ═════════════════════════════════════════════════════════════════

import { renderMarcadorPosicion } from '../shell/placeholder.js';

const TABS = [
  {
    id: 'chats',
    label: 'Chats',
    subtitulo: 'Chats',
    icono: '💬',
  },
  {
    id: 'maestros',
    label: 'Maestros',
    subtitulo: 'Ref. de maestros',
    icono: '🎓',
  },
  {
    id: 'perdidas',
    label: 'Perdidas',
    subtitulo: 'Cosas perdidas',
    icono: '🔎',
  },
  {
    id: 'ajustes',
    label: 'Ajustes',
    subtitulo: 'Configuración',
    icono: '⚙️',
  },
];

// Milisegundos sin eventos de scroll para considerar que el
// deslizamiento (o el scroll suave del pill) ya terminó. Se usa en
// vez del evento 'scrollend' porque no todos los navegadores lo
// soportan todavía.
const FIN_SCROLL_MS = 120;

// Estado del módulo. Se reinicia en cada render() porque el archivo
// se importa una sola vez pero el usuario puede salir del tab
// "Jaguares" (dentro del shell) y volver a entrar — mismo criterio
// que usa js/features/social/shell.js con pestanaActiva.
let tabActiva = 'chats';
let indiceActivo = 0;
// true mientras dura el scroll suave disparado por un click en el
// pill: evita que el "redondeo" de las secciones intermedias haga
// parpadear la pestaña activa y el chip del encabezado.
let navegandoPorClick = false;
let temporizadorFinScroll = null;

async function render(contenedor) {
  tabActiva = 'chats';
  indiceActivo = 0;
  navegandoPorClick = false;
  clearTimeout(temporizadorFinScroll);
  temporizadorFinScroll = null;

  contenedor.innerHTML = plantilla();
  activarInteracciones(contenedor);
}

function plantilla() {
  return `
    <div class="jchat-root">
      <header class="jchat-header">
        <h1 class="jchat-header__titulo">
          Jaguar<br /><span class="jchat-header__accento">Chat</span>
        </h1>
        <div class="jchat-header__chip" id="jchat-chip">
          ${renderChip(TABS[0])}
        </div>
      </header>

      <main class="jchat-contenido" id="jchat-contenido">
        <div class="jchat-pager" id="jchat-pager">
          ${TABS.map((t) => `<section class="jchat-panel" data-panel="${t.id}"></section>`).join('')}
        </div>
      </main>

      <div class="jchat-fab-zona" id="jchat-fab-zona"></div>

      <nav class="jchat-pill" id="jchat-pill">
        <div class="jchat-pill__indicador" id="jchat-pill-indicador"></div>
        ${TABS.map((t, i) => renderBotonPill(t, i)).join('')}
      </nav>
    </div>
  `;
}

function renderChip(tab) {
  return `
    <span class="jchat-chip">
      <span class="jchat-chip__icono">${tab.icono}</span>
      <span class="jchat-chip__texto">${tab.subtitulo}</span>
    </span>
  `;
}

function renderBotonPill(tab, indice) {
  return `
    <button class="jchat-pill__btn${tab.id === tabActiva ? ' activo' : ''}" data-tab="${tab.id}" data-indice="${indice}">
      <span class="jchat-pill__icono">${tab.icono}</span>
      <span class="jchat-pill__label">${tab.label}</span>
    </button>
  `;
}

function activarInteracciones(contenedor) {
  const pager = contenedor.querySelector('#jchat-pager');

  contenedor.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => irATab(contenedor, btn.dataset.tab));
  });

  pager.addEventListener('scroll', () => alScrollear(contenedor, pager), { passive: true });

  // Si cambia el ANCHO del carril (rotar el celular, redimensionar la
  // ventana), scrollLeft queda en píxeles viejos y el snap podría
  // caer en otra sección: se re-alinea a la sección activa. Se ignora
  // el primer aviso (medición inicial) y los cambios solo de alto.
  let anchoPrevio = 0;
  new ResizeObserver(() => {
    const ancho = pager.clientWidth;
    if (!ancho || ancho === anchoPrevio) return;
    const esPrimera = anchoPrevio === 0;
    anchoPrevio = ancho;
    if (!esPrimera) pager.scrollLeft = indiceActivo * ancho;
  }).observe(pager);

  // Estado y montaje de la sección inicial.
  sincronizarActiva(contenedor, 0, true);
  montarSiFalta(contenedor, 0);
  posicionarIndicador(contenedor, 0);
}

// ── Cambio de sección ───────────────────────────────────────────

// Click en un botón del pill: scroll suave hacia la sección.
function irATab(contenedor, id) {
  const indice = TABS.findIndex((t) => t.id === id);
  if (indice === -1) return;

  const pager = contenedor.querySelector('#jchat-pager');
  if (!pager) return;

  const destino = indice * pager.clientWidth;
  if (indice === indiceActivo && Math.abs(pager.scrollLeft - destino) < 2) return;

  navegandoPorClick = true;
  montarSiFalta(contenedor, indice);
  sincronizarActiva(contenedor, indice);

  const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  pager.scrollTo({ left: destino, behavior: reducirMovimiento ? 'auto' : 'smooth' });
}

// Se dispara continuamente mientras el carril se desplaza (por dedo,
// trackpad o por el scroll suave de irATab).
function alScrollear(contenedor, pager) {
  const ancho = pager.clientWidth;
  if (!ancho) return;

  // Posición fraccionaria: 0 = Chats, 1 = Maestros, 1.5 = a medio
  // camino entre Maestros y Perdidas, etc. Se limita por si Safari
  // reporta valores fuera de rango durante el rebote elástico.
  const posicion = Math.min(Math.max(pager.scrollLeft / ancho, 0), TABS.length - 1);

  posicionarIndicador(contenedor, posicion);

  if (!navegandoPorClick) {
    // Monta las secciones que ya asoman para que no aparezcan vacías
    // mientras se arrastra.
    montarSiFalta(contenedor, Math.floor(posicion));
    montarSiFalta(contenedor, Math.ceil(posicion));
    sincronizarActiva(contenedor, Math.round(posicion));
  }

  // "Fin de scroll" por inactividad: libera el candado del click y
  // asegura que la pestaña activa coincida con donde quedó el snap.
  clearTimeout(temporizadorFinScroll);
  temporizadorFinScroll = setTimeout(() => {
    navegandoPorClick = false;
    const indiceFinal = Math.min(Math.max(Math.round(pager.scrollLeft / (pager.clientWidth || 1)), 0), TABS.length - 1);
    sincronizarActiva(contenedor, indiceFinal);
  }, FIN_SCROLL_MS);
}

// Actualiza todo lo que depende de "cuál es la pestaña activa":
// botones del pill, chip del encabezado, clase .visible e inert de
// los paneles. Es idempotente: si el índice no cambió, no hace nada
// (salvo con `forzar`, para la pintura inicial).
function sincronizarActiva(contenedor, indice, forzar = false) {
  if (!forzar && indice === indiceActivo) return;
  indiceActivo = indice;
  tabActiva = TABS[indice].id;

  contenedor.querySelectorAll('.jchat-pill__btn').forEach((btn) => {
    btn.classList.toggle('activo', btn.dataset.tab === tabActiva);
  });

  contenedor.querySelectorAll('.jchat-panel').forEach((panel) => {
    const activo = panel.dataset.panel === tabActiva;
    panel.classList.toggle('visible', activo);
    panel.inert = !activo;
  });

  const chip = contenedor.querySelector('#jchat-chip');
  if (chip) chip.innerHTML = renderChip(TABS[indice]);
}

// `posicion` es fraccionaria: el indicador sigue al carril en tiempo
// real (su transición CSS se eliminó, ver jaguar-chat.css).
function posicionarIndicador(contenedor, posicion) {
  const indicador = contenedor.querySelector('#jchat-pill-indicador');
  if (!indicador) return;
  const anchoPorcentaje = 100 / TABS.length;
  indicador.style.width = `${anchoPorcentaje}%`;
  indicador.style.transform = `translateX(${posicion * 100}%)`;
}

// ── Montaje de secciones ────────────────────────────────────────

function montarSiFalta(contenedor, indice) {
  const tab = TABS[indice];
  if (!tab) return;
  const panel = contenedor.querySelector(`[data-panel="${tab.id}"]`);
  if (panel && !panel.dataset.montado) montarPanel(panel, tab.id);
}

// Monta el contenido de una sección la primera vez que se muestra.
// 'chats', 'maestros' y 'perdidas' ya tienen módulo real; 'ajustes'
// sigue en marcador de posición hasta que se construya, sin
// necesidad de tocar el resto de este archivo — mismo criterio que
// montarPanel() en js/features/shell/shell.js.
function montarPanel(panel, id) {
  panel.dataset.montado = '1';

  if (id === 'chats') {
    import('./chats/chats-screen.js').then(({ render }) => render(panel));
    return;
  }

  if (id === 'maestros') {
    import('./maestros/maestros-screen.js').then(({ render }) => render(panel));
    return;
  }

  if (id === 'perdidas') {
    import('./perdidas/cosas-perdidas-screen.js').then(({ render }) => render(panel));
    return;
  }

  if (id === 'ajustes') {
    import('./ajustes/ajustes-chat-screen.js').then(({ render }) => render(panel));
    return;
  }

  const [icono, titulo, subtitulo] = textos[id] ?? ['🚧', 'Próximamente', ''];
  renderMarcadorPosicion(panel, { icono, titulo, subtitulo });
}

export { render };