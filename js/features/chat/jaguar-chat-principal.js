// ═════════════════════════════════════════════════════════════════
// jaguar-chat-principal.js
// Ubicación: js/features/chat/jaguar-chat-principal.js
//
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
// Diferencias intencionales respecto a la versión Flutter:
//   • Flutter usa PageView + swipe para deslizar entre tabs; en web
//     se cambia de sección solo con click en el pill (no se
//     implementa gesto de swipe horizontal por ahora).
//   • Flutter mantiene las 4 pantallas vivas en memoria simultánea
//     (PageView no destruye hijos). Aquí se hace lo mismo: cada
//     sección se monta una sola vez (data-montado) y se oculta con
//     CSS (display), no se destruye, para no perder scroll/estado
//     al volver a una tab ya visitada.
//   • El FAB de "Agregar docente" (Maestros) y el FAB de "Reportar"
//     (Cosas perdidas) se implementan en sus propios módulos, no
//     aquí — este archivo solo reserva el contenedor donde esos
//     módulos pueden inyectar su propio FAB posicionado sobre el
//     pill (ver clase .jchat-fab-zona).
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

// Estado del módulo. Se reinicia en cada render() porque el archivo
// se importa una sola vez pero el usuario puede salir del tab
// "Jaguares" (dentro del shell) y volver a entrar — mismo criterio
// que usa js/features/social/shell.js con pestanaActiva.
let tabActiva = 'chats';

async function render(contenedor) {
  tabActiva = 'chats';
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
        ${TABS.map((t) => `<section class="jchat-panel" data-panel="${t.id}"></section>`).join('')}
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
  contenedor.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => cambiarTab(contenedor, btn.dataset.tab));
  });

  // Monta y muestra la sección inicial.
  const panelInicial = contenedor.querySelector('[data-panel="chats"]');
  if (panelInicial) {
    panelInicial.classList.add('visible');
    montarPanel(panelInicial, 'chats');
  }

  posicionarIndicador(contenedor, 0);
}

function cambiarTab(contenedor, id) {
  if (id === tabActiva) return;
  tabActiva = id;
  const indice = TABS.findIndex((t) => t.id === id);

  contenedor.querySelectorAll('.jchat-pill__btn').forEach((btn) => {
    btn.classList.toggle('activo', btn.dataset.tab === id);
  });

  contenedor.querySelectorAll('.jchat-panel').forEach((panel) => {
    const activo = panel.dataset.panel === id;
    panel.classList.toggle('visible', activo);
    if (activo && !panel.dataset.montado) montarPanel(panel, id);
  });

  const chip = document.getElementById('jchat-chip');
  if (chip) chip.innerHTML = renderChip(TABS[indice]);

  posicionarIndicador(contenedor, indice);
}

function posicionarIndicador(contenedor, indice) {
  const indicador = contenedor.querySelector('#jchat-pill-indicador');
  if (!indicador) return;
  const anchoPorcentaje = 100 / TABS.length;
  indicador.style.width = `${anchoPorcentaje}%`;
  indicador.style.transform = `translateX(${indice * 100}%)`;
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

  const textos = {
    ajustes: ['⚙️', 'Configuración', 'Los ajustes de JaguarChat están en construcción.'],
  };
  const [icono, titulo, subtitulo] = textos[id] ?? ['🚧', 'Próximamente', ''];
  renderMarcadorPosicion(panel, { icono, titulo, subtitulo });
}

export { render };