// ═════════════════════════════════════════════════════════════════
// chats-screen.js
// Ubicación: js/features/chat/chats/chats-screen.js
//
// Puerto web de
// Pantallas/JaguarChat/Chats/pantallas_ui/chats_page_home.dart.
//
// Pantalla principal de la lista de conversaciones (tab "Chats" de
// JaguarChat). Incluye: barra de búsqueda con fallback al directorio
// de perfiles, fila de avatares "en línea", tabs de filtro
// Todos/No leídos/Fijados, chat tile con menú contextual (mantener
// presionado) y eliminación con deshacer real (el borrado en
// IndexedDB solo ocurre si pasan 4s sin que el usuario pulse
// "Deshacer" — igual que el fix de jul 2026 en la versión Dart).
//
// Se monta desde jaguar-chat-principal.js:
//   import('./chats/chats-screen.js').then(({ render }) => render(panel));
//
// DIFERENCIAS INTENCIONALES respecto a la versión Flutter:
//   • El menú contextual (_MenuChatSheet en Dart) se implementa aquí
//     como una hoja modal propia y autocontenida (ver
//     abrirMenuChat()/plantillaMenuChat()), en vez de reutilizar
//     js/core/bottom-sheet.js — su firma exacta no se confirmó
//     todavía en este proyecto. Si más adelante se decide
//     reutilizarlo, este es el único bloque que cambia.
//   • El snackbar de "Deshacer" tampoco reutiliza mostrarToast() de
//     toast.js: ese solo acepta mensaje+tipo, sin botón de acción ni
//     duración cancelable — justo lo que este flujo necesita. Se
//     implementa con su propio contenedor (#chats-snackbar-zona).
//   • Al tocar un chat o un resultado del directorio, abrirConversacion()
//     navega a conversacion-screen.js a través del puente
//     conversacion-nav.js (ver ese archivo — necesario porque el
//     router navega por hash y no serializa objetos completos).
// ═════════════════════════════════════════════════════════════════

import { mostrarToast } from '../../../core/toast.js';
import * as chatRepository from '../chat-repository.js';
import * as perfilesRepository from '../servicios/perfiles-repository.js';
import * as presenceService from '../servicios/presence-service.js';
import { abrirConversacion as abrirConversacionNav } from './conversacion/conversacion-nav.js';

const AZUL_TELEGRAM = '#3390ec';
const VERDE_EN_LINEA = '#22c55e';

// ── Estado del módulo ────────────────────────────────────────────
// Se reinicia en cada render() porque el archivo se importa una sola
// vez, pero jaguar-chat-principal.js solo llama a render() la
// primera vez que se muestra la pestaña "chats" (mismo criterio de
// montaje perezoso que el resto de la app) — en la práctica esto
// corre una vez por sesión, pero se deja el reinicio por si el shell
// llega a remontarse (logout/login).
let listaChats = [];
let busqueda = '';
let filtro = 'todos'; // 'todos' | 'noLeidos' | 'fijados'
let resultadosPerfiles = [];
let buscandoPerfiles = false;

// Eliminación con deshacer real: ids ocultos de la UI mientras corre
// la ventana de 4s, y los Timers que disparan el borrado real si no
// se cancelan a tiempo.
const ocultosPendientes = new Set();
const timersEliminacion = new Map();

let usuariosEnLineaActual = new Set();
let cancelarWatchChats = null;
let cancelarPresencia = null;
let debounceBusqueda = null;

let contenedorRaiz = null;

export async function render(contenedor) {
  contenedorRaiz = contenedor;

  // Reset de estado por si esta función se vuelve a llamar.
  listaChats = [];
  busqueda = '';
  filtro = 'todos';
  resultadosPerfiles = [];
  buscandoPerfiles = false;
  ocultosPendientes.clear();
  for (const t of timersEliminacion.values()) clearTimeout(t);
  timersEliminacion.clear();
  usuariosEnLineaActual = new Set();

  contenedor.innerHTML = plantillaRaiz();
  activarBarraBusqueda(contenedor);

  cancelarWatchChats = chatRepository.watchChats((chats) => {
    listaChats = chats;
    actualizarVista();
  });

  cancelarPresencia = presenceService.suscribir((enLinea) => {
    usuariosEnLineaActual = enLinea;
    actualizarVista();
  });
}

function plantillaRaiz() {
  return `
    <div class="chats-screen">
      <div class="chats-search-zona">${plantillaBarraBusqueda()}</div>
      <div class="chats-online-zona" id="chats-online-zona"></div>
      <div class="chats-tabs-zona" id="chats-tabs-zona"></div>
      <div class="chats-lista-zona" id="chats-lista-zona"></div>
      <div class="chats-snackbar-zona" id="chats-snackbar-zona"></div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────
// FILTRADO (réplica de _filtrarLocal / _aplicarFiltroTab en Dart)
// ─────────────────────────────────────────────────────────────────

function filtrarLocal(termino) {
  const base = listaChats.filter((c) => !ocultosPendientes.has(c.otroUsuarioId));
  if (!termino) return base;

  const q = termino.toLowerCase();
  return base.filter((c) => {
    const nombre = (c.otroNombre ?? '').toLowerCase();
    const usuario = (c.otroNombreUsuario ?? '').toLowerCase();
    return nombre.includes(q) || usuario.includes(q);
  });
}

function aplicarFiltroTab(chats) {
  if (filtro === 'noLeidos') return chats.filter((c) => c.noLeidos > 0);
  if (filtro === 'fijados') return chats.filter((c) => c.fijado);
  return chats;
}

// ─────────────────────────────────────────────────────────────────
// RENDER PRINCIPAL — se re-ejecuta ante cualquier cambio de estado
// (nuevos chats, búsqueda, cambio de tab, resultados de perfiles,
// presencia). Reconstruye el HTML de cada zona dinámica y reengancha
// sus listeners — las listas son chicas, así que un re-render
// completo de estas 3 zonas es más simple y confiable que un diff
// manual, igual de razonable que los setState() de Dart.
// ─────────────────────────────────────────────────────────────────

function actualizarVista() {
  if (!contenedorRaiz) return;

  const localesFiltrados = filtrarLocal(busqueda);
  const mostrarFallbackPerfiles = busqueda !== '' && localesFiltrados.length === 0;
  const chatsVisibles = mostrarFallbackPerfiles ? [] : aplicarFiltroTab(localesFiltrados);

  // Los contadores de las pills y la fila "en línea" usan la lista
  // sin filtrar por búsqueda/tab, solo excluyendo eliminación
  // pendiente — igual que chatsParaContadores en Dart.
  const chatsParaContadores = listaChats.filter(
    (c) => !ocultosPendientes.has(c.otroUsuarioId)
  );
  const noLeidosCount = chatsParaContadores.filter((c) => c.noLeidos > 0).length;
  const fijadosCount = chatsParaContadores.filter((c) => c.fijado).length;

  const zonaOnline = document.getElementById('chats-online-zona');
  const zonaTabs = document.getElementById('chats-tabs-zona');
  const zonaLista = document.getElementById('chats-lista-zona');
  if (!zonaOnline || !zonaTabs || !zonaLista) return;

  if (mostrarFallbackPerfiles) {
    zonaOnline.innerHTML = '';
    zonaTabs.innerHTML = '';
  } else {
    zonaOnline.innerHTML = plantillaFilaEnLinea(chatsParaContadores);
    zonaTabs.innerHTML = plantillaTabs(noLeidosCount, fijadosCount);
    activarFilaEnLinea(zonaOnline);
    activarTabs(zonaTabs);
  }

  if (mostrarFallbackPerfiles) {
    zonaLista.innerHTML = plantillaDirectorio();
    activarDirectorio(zonaLista);
  } else if (chatsVisibles.length === 0) {
    zonaLista.innerHTML = plantillaEmptyState(filtro);
  } else {
    zonaLista.innerHTML = plantillaListaChats(chatsVisibles);
    activarListaChats(zonaLista, chatsVisibles);
  }
}

// ─────────────────────────────────────────────────────────────────
// BARRA DE BÚSQUEDA
// ─────────────────────────────────────────────────────────────────

function plantillaBarraBusqueda() {
  return `
    <div class="chats-busqueda">
      <span class="chats-busqueda__icono">🔍</span>
      <input
        type="text"
        id="chats-busqueda-input"
        class="chats-busqueda__input"
        placeholder="Buscar conversación..."
        autocomplete="off"
      />
    </div>
  `;
}

function activarBarraBusqueda(contenedor) {
  const input = contenedor.querySelector('#chats-busqueda-input');
  if (!input) return;

  input.addEventListener('input', () => {
    onBusquedaCambia(input.value);
  });
}

function onBusquedaCambia(valor) {
  busqueda = valor;
  actualizarVista();

  clearTimeout(debounceBusqueda);
  debounceBusqueda = setTimeout(async () => {
    const localesFiltrados = filtrarLocal(valor);

    if (valor === '' || localesFiltrados.length > 0) {
      resultadosPerfiles = [];
      actualizarVista();
      return;
    }

    buscandoPerfiles = true;
    actualizarVista();

    const resultados = await perfilesRepository.buscar(valor);

    resultadosPerfiles = resultados;
    buscandoPerfiles = false;
    actualizarVista();
  }, 350);
}

// ─────────────────────────────────────────────────────────────────
// FILA DE AVATARES "EN LÍNEA"
// ─────────────────────────────────────────────────────────────────

function plantillaFilaEnLinea(chats) {
  const chatsEnLinea = chats.filter((c) => usuariosEnLineaActual.has(c.otroUsuarioId));
  if (chatsEnLinea.length === 0) return '';

  return `
    <div class="chats-en-linea">
      ${chatsEnLinea.map((c) => plantillaAvatarEnLinea(c)).join('')}
    </div>
  `;
}

function plantillaAvatarEnLinea(chat) {
  const inicial = (chat.otroNombre || '?').trim().charAt(0).toUpperCase();
  const primerNombre = (chat.otroNombre || '').split(' ')[0];

  return `
    <button class="chats-en-linea__item" data-chat-id="${chat.otroUsuarioId}">
      <span class="chats-en-linea__avatar-zona">
        <span class="chats-en-linea__avatar">
          ${
            chat.otroAvatarUrl
              ? `<img src="${chat.otroAvatarUrl}" alt="" />`
              : `<span class="chats-avatar__inicial">${inicial}</span>`
          }
        </span>
        <span class="chats-punto-en-linea"></span>
      </span>
      <span class="chats-en-linea__nombre">${escaparHtml(primerNombre)}</span>
    </button>
  `;
}

function activarFilaEnLinea(zona) {
  zona.querySelectorAll('[data-chat-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const chat = listaChats.find((c) => c.otroUsuarioId === btn.dataset.chatId);
      if (chat) {
        chatRepository.marcarComoLeido(chat.otroUsuarioId);
        abrirConversacion(chat);
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// TABS DE FILTRO — Todos / No leídos / Fijados
// ─────────────────────────────────────────────────────────────────

function plantillaTabs(noLeidosCount, fijadosCount) {
  return `
    <div class="chats-tabs">
      ${plantillaPill('todos', 'Todos', null)}
      ${plantillaPill('noLeidos', 'No leídos', noLeidosCount)}
      ${plantillaPill('fijados', 'Fijados', fijadosCount)}
    </div>
  `;
}

function plantillaPill(id, etiqueta, contador) {
  const seleccionado = filtro === id;
  const mostrarContador = contador != null && contador > 0;
  return `
    <button class="chats-pill${seleccionado ? ' seleccionado' : ''}" data-filtro="${id}">
      <span>${etiqueta}</span>
      ${mostrarContador ? `<span class="chats-pill__contador">${contador}</span>` : ''}
    </button>
  `;
}

function activarTabs(zona) {
  zona.querySelectorAll('[data-filtro]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (filtro === btn.dataset.filtro) return;
      filtro = btn.dataset.filtro;
      actualizarVista();
    });
  });
}

// ─────────────────────────────────────────────────────────────────
// LISTA DE CHATS / CHAT TILE
// ─────────────────────────────────────────────────────────────────

function plantillaListaChats(chats) {
  return `
    <div class="chats-lista">
      ${chats.map((chat) => plantillaChatTile(chat)).join('')}
    </div>
  `;
}

function plantillaChatTile(chat) {
  const hora = chat.ultimaFecha ? formatearHora(chat.ultimaFecha) : '';
  const inicial = (chat.otroNombre || '?').trim().charAt(0).toUpperCase();
  const enLinea = usuariosEnLineaActual.has(chat.otroUsuarioId);
  const tieneNoLeidos = chat.noLeidos > 0;

  return `
    <div class="chats-tile" data-chat-id="${chat.otroUsuarioId}">
      <div class="chats-tile__avatar-zona">
        <span class="chats-tile__avatar">
          ${
            chat.otroAvatarUrl
              ? `<img src="${chat.otroAvatarUrl}" alt="" />`
              : `<span class="chats-avatar__inicial">${inicial}</span>`
          }
        </span>
        ${chat.fijado ? '<span class="chats-badge-fijado">📌</span>' : ''}
        ${enLinea ? '<span class="chats-punto-en-linea chats-punto-en-linea--tile"></span>' : ''}
      </div>

      <div class="chats-tile__contenido">
        <div class="chats-tile__fila-superior">
          ${chat.fijado ? '<span class="chats-tile__icono-fijado">📌</span>' : ''}
          <span class="chats-tile__nombre">${escaparHtml(chat.otroNombre || '')}</span>
        </div>
        <div class="chats-tile__fila-inferior">
          ${chat.silenciado ? '<span class="chats-tile__icono-silenciado">🔕</span>' : ''}
          <span class="chats-tile__mensaje">${escaparHtml(chat.ultimoMensaje || '')}</span>
        </div>
      </div>

      <div class="chats-tile__meta">
        <span class="chats-tile__hora${tieneNoLeidos ? ' chats-tile__hora--noleido' : ''}">${hora}</span>
        ${
          tieneNoLeidos
            ? `<span class="chats-tile__badge${chat.silenciado ? ' chats-tile__badge--silenciado' : ''}">${chat.noLeidos}</span>`
            : ''
        }
      </div>
    </div>
  `;
}

function activarListaChats(zona, chatsVisibles) {
  zona.querySelectorAll('[data-chat-id]').forEach((tile) => {
    const chat = chatsVisibles.find((c) => c.otroUsuarioId === tile.dataset.chatId);
    if (!chat) return;

    tile.addEventListener('click', () => {
      chatRepository.marcarComoLeido(chat.otroUsuarioId);
      abrirConversacion(chat);
    });

    activarPulsacionLarga(tile, () => abrirMenuChat(chat));
  });
}

/**
 * Detecta "mantener presionado" en desktop (mouse) y móvil (touch),
 * equivalente a GestureDetector(onLongPress:) en Flutter. Se cancela
 * si el puntero se levanta o se mueve antes de cumplirse la
 * duración.
 */
function activarPulsacionLarga(elemento, callback, duracionMs = 500) {
  let timer = null;
  let movido = false;

  const iniciar = () => {
    movido = false;
    timer = setTimeout(() => {
      if (!movido) callback();
    }, duracionMs);
  };
  const cancelar = () => {
    clearTimeout(timer);
    timer = null;
  };
  const marcarMovido = () => {
    movido = true;
    cancelar();
  };

  elemento.addEventListener('mousedown', iniciar);
  elemento.addEventListener('mouseup', cancelar);
  elemento.addEventListener('mouseleave', cancelar);
  elemento.addEventListener('touchstart', iniciar, { passive: true });
  elemento.addEventListener('touchend', cancelar);
  elemento.addEventListener('touchmove', marcarMovido);
  // Evita que el click normal (tap corto) dispare justo después de
  // que un long-press ya haya abierto el menú.
  elemento.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ─────────────────────────────────────────────────────────────────
// MENÚ CONTEXTUAL (mantener presionado) — hoja modal propia
// ver nota de "DIFERENCIAS INTENCIONALES" en la cabecera del archivo
// ─────────────────────────────────────────────────────────────────

function abrirMenuChat(chat) {
  const overlay = document.createElement('div');
  overlay.className = 'chats-menu-overlay';
  overlay.innerHTML = plantillaMenuChat(chat);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add('visible'));

  const cerrar = () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrar();
  });

  overlay.querySelector('[data-accion="fijar"]')?.addEventListener('click', () => {
    cerrar();
    chatRepository.toggleFijado(chat.otroUsuarioId);
  });
  overlay.querySelector('[data-accion="silenciar"]')?.addEventListener('click', () => {
    cerrar();
    chatRepository.toggleSilenciado(chat.otroUsuarioId);
  });
  overlay.querySelector('[data-accion="archivar"]')?.addEventListener('click', () => {
    cerrar();
    chatRepository.toggleArchivado(chat.otroUsuarioId);
  });
  overlay.querySelector('[data-accion="eliminar"]')?.addEventListener('click', () => {
    cerrar();
    eliminarConDeshacer(chat);
  });
}

function plantillaMenuChat(chat) {
  return `
    <div class="chats-menu-sheet">
      <div class="chats-menu-sheet__manija"></div>
      <p class="chats-menu-sheet__titulo">${escaparHtml(chat.otroNombre || '')}</p>

      <button class="chats-menu-sheet__opcion" data-accion="fijar">
        <span>📌</span><span>${chat.fijado ? 'Desfijar' : 'Fijar conversación'}</span>
      </button>
      <button class="chats-menu-sheet__opcion" data-accion="silenciar">
        <span>${chat.silenciado ? '🔔' : '🔕'}</span>
        <span>${chat.silenciado ? 'Activar notificaciones' : 'Silenciar'}</span>
      </button>
      <button class="chats-menu-sheet__opcion" data-accion="archivar">
        <span>🗄️</span><span>Archivar conversación</span>
      </button>
      <button class="chats-menu-sheet__opcion chats-menu-sheet__opcion--peligro" data-accion="eliminar">
        <span>🗑️</span><span>Eliminar conversación</span>
      </button>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────
// ELIMINACIÓN CON DESHACER REAL
//
// Réplica del fix de jul 2026 en Dart: el chat se oculta de la UI
// de inmediato (ocultosPendientes, filtrado en filtrarLocal), pero
// NO se borra nada en IndexedDB todavía. Un timer de 4s dispara el
// borrado real (chatRepository.eliminarChat) solo si el usuario no
// pulsó "Deshacer" antes. Si lo pulsa, el timer se cancela y el chat
// vuelve a mostrarse tal cual estaba.
// ─────────────────────────────────────────────────────────────────

function eliminarConDeshacer(chat) {
  const id = chat.otroUsuarioId;
  const nombre = chat.otroNombre;

  clearTimeout(timersEliminacion.get(id));
  timersEliminacion.delete(id);

  ocultosPendientes.add(id);
  actualizarVista();

  mostrarSnackbarDeshacer({
    texto: `Conversación con ${nombre} eliminada`,
    onDeshacer: () => {
      clearTimeout(timersEliminacion.get(id));
      timersEliminacion.delete(id);
      ocultosPendientes.delete(id);
      actualizarVista();
    },
  });

  const timer = setTimeout(async () => {
    timersEliminacion.delete(id);
    await chatRepository.eliminarChat(id, { borrarMensajes: true });
    ocultosPendientes.delete(id);
    actualizarVista();
  }, 4000);
  timersEliminacion.set(id, timer);
}

let temporizadorSnackbar = null;

function mostrarSnackbarDeshacer({ texto, onDeshacer }) {
  const zona = document.getElementById('chats-snackbar-zona');
  if (!zona) return;

  clearTimeout(temporizadorSnackbar);

  zona.innerHTML = `
    <div class="chats-snackbar" id="chats-snackbar-activo">
      <span class="chats-snackbar__texto">${escaparHtml(texto)}</span>
      <button class="chats-snackbar__accion" id="chats-snackbar-deshacer">Deshacer</button>
    </div>
  `;

  const snackbar = document.getElementById('chats-snackbar-activo');
  requestAnimationFrame(() => snackbar.classList.add('visible'));

  const ocultar = () => {
    snackbar.classList.remove('visible');
    setTimeout(() => snackbar.remove(), 250);
  };

  document.getElementById('chats-snackbar-deshacer').addEventListener('click', () => {
    onDeshacer();
    ocultar();
  });

  temporizadorSnackbar = setTimeout(ocultar, 4000);
}

// ─────────────────────────────────────────────────────────────────
// SECCIÓN DIRECTORIO (fallback cuando la búsqueda no coincide con
// ningún chat existente)
// ─────────────────────────────────────────────────────────────────

function plantillaDirectorio() {
  if (buscandoPerfiles) {
    return `<div class="chats-directorio-cargando"><span class="chats-spinner"></span></div>`;
  }

  if (resultadosPerfiles.length === 0) {
    return plantillaEmptyStatePersonalizado({
      icono: '🔎',
      titulo: 'Nadie por aquí',
      descripcion: 'No encontramos a nadie en el<br />directorio con ese nombre.',
    });
  }

  return `
    <div class="chats-directorio">
      <p class="chats-directorio__aviso">No tienes chats con ese nombre. Personas en Comunidad ITVH:</p>
      ${resultadosPerfiles.map((p) => plantillaPerfilTile(p)).join('')}
    </div>
  `;
}

function plantillaPerfilTile(perfil) {
  const inicial = (perfil.nombre || '?').trim().charAt(0).toUpperCase();
  return `
    <button class="chats-perfil-tile" data-perfil-id="${perfil.id}">
      <span class="chats-tile__avatar">
        ${
          perfil.avatarUrl
            ? `<img src="${perfil.avatarUrl}" alt="" />`
            : `<span class="chats-avatar__inicial">${inicial}</span>`
        }
      </span>
      <span class="chats-perfil-tile__info">
        <span class="chats-perfil-tile__nombre">${escaparHtml(perfil.nombre)}</span>
        ${perfil.nombreUsuario ? `<span class="chats-perfil-tile__usuario">@${escaparHtml(perfil.nombreUsuario)}</span>` : ''}
      </span>
      <span class="chats-perfil-tile__icono">💬</span>
    </button>
  `;
}

function activarDirectorio(zona) {
  zona.querySelectorAll('[data-perfil-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const perfil = resultadosPerfiles.find((p) => p.id === btn.dataset.perfilId);
      if (perfil) iniciarChatConPerfil(perfil);
    });
  });
}

async function iniciarChatConPerfil(perfil) {
  await chatRepository.actualizarPreview({
    otroUsuarioId: perfil.id,
    otroNombre: perfil.nombre,
    otroNombreUsuario: perfil.nombreUsuario,
    otroAvatarUrl: perfil.avatarUrl,
    ultimoMensaje: 'Inicia la conversación',
    fecha: new Date(),
  });

  busqueda = '';
  resultadosPerfiles = [];
  const input = contenedorRaiz?.querySelector('#chats-busqueda-input');
  if (input) input.value = '';
  actualizarVista();

  abrirConversacion({
    otroUsuarioId: perfil.id,
    otroNombre: perfil.nombre,
    otroNombreUsuario: perfil.nombreUsuario,
    otroAvatarUrl: perfil.avatarUrl,
  });
}

// ─────────────────────────────────────────────────────────────────
// NAVEGACIÓN A LA CONVERSACIÓN
//
// conversacion-screen.js ya existe: se navega vía el puente
// conversacion-nav.js (ver ese archivo para el porqué de la
// indirección). Un chat existente ya trae otroNombre/otroAvatarUrl
// consigo, así que no hace falta pasar contextoObjeto aquí — un chat
// abierto desde la lista nunca lleva contexto adjunto, a diferencia
// de "Contactar" desde Marketplace o desde un reporte de objeto
// perdido.
// ─────────────────────────────────────────────────────────────────

function abrirConversacion(chat) {
  abrirConversacionNav({
    otroUsuarioId: chat.otroUsuarioId,
    otroNombre: chat.otroNombre,
    otroNombreUsuario: chat.otroNombreUsuario,
    otroAvatarUrl: chat.otroAvatarUrl,
  });
}

// ─────────────────────────────────────────────────────────────────
// EMPTY STATES
// ─────────────────────────────────────────────────────────────────

const EMPTY_STATES = {
  todos: {
    icono: '💬',
    titulo: 'Sin conversaciones',
    descripcion: 'Aquí aparecerán tus chats con otros<br />estudiantes del campus.',
  },
  noLeidos: {
    icono: '✅',
    titulo: 'Todo leído',
    descripcion: 'No tienes mensajes sin leer<br />por el momento.',
  },
  fijados: {
    icono: '📌',
    titulo: 'Nada fijado',
    descripcion: 'Mantén presionado un chat<br />para fijarlo aquí arriba.',
  },
};

function plantillaEmptyState(f) {
  return plantillaEmptyStatePersonalizado(EMPTY_STATES[f] ?? EMPTY_STATES.todos);
}

function plantillaEmptyStatePersonalizado({ icono, titulo, descripcion }) {
  return `
    <div class="chats-empty">
      <div class="chats-empty__icono-zona">
        <span>${icono}</span>
      </div>
      <p class="chats-empty__titulo">${titulo}</p>
      <p class="chats-empty__descripcion">${descripcion}</p>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function formatearHora(fechaIso) {
  const fecha = new Date(fechaIso);
  const ahora = new Date();
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);
  const diaFecha = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

  if (diaFecha.getTime() === hoy.getTime()) {
    return new Intl.DateTimeFormat('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(fecha);
  }
  if (diaFecha.getTime() === ayer.getTime()) return 'Ayer';

  const diffDias = Math.floor((ahora - fecha) / (1000 * 60 * 60 * 24));
  if (diffDias < 7) {
    const dia = new Intl.DateTimeFormat('es-MX', { weekday: 'long' }).format(fecha);
    return dia.charAt(0).toUpperCase() + dia.slice(1);
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(fecha);
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}