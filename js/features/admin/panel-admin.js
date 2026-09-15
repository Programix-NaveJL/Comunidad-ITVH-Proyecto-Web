// ═════════════════════════════════════════════════════════════════
// panel-admin.js
// Ubicación: js/features/admin/panel-admin.js
//
// Réplica web de panel_admin.dart. Panel de administración con 5
// pestañas (Dashboard, Usuarios, Marketplace, Reportes, Soporte),
// accesible solo a perfiles con fila en `tabla_admins` — verificado
// aquí de nuevo aunque shell.js ya oculte el tab "Admin" a quien no
// lo sea, como defensa en profundidad por si se navega directo.
//
// Cada pestaña se monta una sola vez (perezoso, como
// jaguar-chat-principal.js) y se mantiene viva en memoria al
// cambiar entre tabs (display:none, no se destruye) — igual
// criterio que TabBarView de Flutter, que no destruye sus hijos.
//
// PENDIENTE: las 5 pestañas siguen en marcador de posición hasta
// portar admin_tab_dashboard.dart / admin_tab_usuarios.dart /
// admin_tab_marketplace.dart / admin_tab_reportes.dart /
// admin_tab_soporte.dart. Cuando se porten, montarTab() es el único
// lugar que cambia — mismo patrón que montarPanel() en
// jaguar-chat-principal.js/shell.js.
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../core/supabase-client.js';
import { renderAccesoDenegado } from './admin-shared-widgets.js';
import { renderMarcadorPosicion } from '../shell/placeholder.js';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icono: '📊' },
  { id: 'usuarios', label: 'Usuarios', icono: '👥' },
  { id: 'marketplace', label: 'Marketplace', icono: '🏪' },
  { id: 'reportes', label: 'Reportes', icono: '🚩' },
  { id: 'soporte', label: 'Soporte', icono: '🎧' },
];

export async function render(contenedor) {
  contenedor.innerHTML = `<div class="adm-verificando"><span class="chats-spinner"></span></div>`;

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const uid = user?.id;

  let esAdmin = false;
  if (uid) {
    const { data, error } = await supabaseClient.from('tabla_admins').select('nivel').eq('perfil_id', uid).maybeSingle();
    if (error) console.error('panel-admin – verificarAdmin:', error);
    esAdmin = data != null;
  }

  if (!esAdmin) {
    renderAccesoDenegado(contenedor);
    return;
  }

  let tabActiva = 'dashboard';
  let reportesPendientes = 0;
  let ticketsPendientes = 0;

  contenedor.innerHTML = `
    <div class="adm-panel">
      <header class="adm-panel__header">
        <div class="adm-panel__titulo-zona">
          <span class="adm-panel__chip">🛡️ Admin</span>
          <div>
            <p class="adm-panel__titulo">Panel de Control</p>
            <p class="adm-panel__subtitulo">Comunidad ITVH</p>
          </div>
        </div>
        <nav class="adm-tabs" id="adm-tabs"></nav>
      </header>
      <main class="adm-panel__contenido" id="adm-panel-contenido">
        ${TABS.map((t) => `<section class="adm-panel__seccion" data-tab="${t.id}"></section>`).join('')}
      </main>
    </div>
  `;

  renderTabs();
  const seccionInicial = contenedor.querySelector('[data-tab="dashboard"]');
  seccionInicial.classList.add('visible');
  montarTab(seccionInicial, 'dashboard');

  function renderTabs() {
    const zona = contenedor.querySelector('#adm-tabs');
    zona.innerHTML = TABS.map((t) => {
      const contador = t.id === 'reportes' ? reportesPendientes : t.id === 'soporte' ? ticketsPendientes : 0;
      return `
        <button class="adm-tab${t.id === tabActiva ? ' activo' : ''}" data-tab-btn="${t.id}">
          <span class="adm-tab__icono">${t.icono}${contador > 0 ? `<span class="adm-tab__badge">${contador}</span>` : ''}</span>
          <span class="adm-tab__label">${t.label}</span>
        </button>
      `;
    }).join('');
    zona.querySelectorAll('[data-tab-btn]').forEach((btn) => {
      btn.addEventListener('click', () => cambiarTab(btn.dataset.tabBtn));
    });
  }

  function cambiarTab(id) {
    if (id === tabActiva) return;
    tabActiva = id;
    renderTabs();
    contenedor.querySelectorAll('.adm-panel__seccion').forEach((sec) => {
      const activo = sec.dataset.tab === id;
      sec.classList.toggle('visible', activo);
      if (activo && !sec.dataset.montado) montarTab(sec, id);
    });
  }

  function irATab(indiceONombre) {
    const id = typeof indiceONombre === 'number' ? TABS[indiceONombre]?.id : indiceONombre;
    if (id) cambiarTab(id);
  }

  function actualizarBadgeReportes(n) {
    reportesPendientes = n;
    renderTabs();
  }

  function actualizarBadgeTickets(n) {
    ticketsPendientes = n;
    renderTabs();
  }

    function montarTab(seccion, id) {
    seccion.dataset.montado = '1';

    if (id === 'dashboard') {
      import('./admin-tab-dashboard.js').then(({ render }) => render(seccion, { onIrATab: irATab, onReportesPendientes: actualizarBadgeReportes }));
      return;
    }
    if (id === 'usuarios') {
      import('./admin-tab-usuarios.js').then(({ render }) => render(seccion));
      return;
    }
    if (id === 'marketplace') {
      import('./admin-tab-marketplace.js').then(({ render }) => render(seccion));
      return;
    }
    if (id === 'reportes') {
      import('./admin-tab-reportes.js').then(({ render }) => render(seccion));
      return;
    }
    if (id === 'soporte') {
      import('./admin-tab-soporte.js').then(({ render }) => render(seccion, { onTicketsPendientes: actualizarBadgeTickets }));
      return;
    }
  }
}