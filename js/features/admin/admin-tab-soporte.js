// ═════════════════════════════════════════════════════════════════
// admin-tab-soporte.js
// Ubicación: js/features/admin/admin-tab-soporte.js
//
// Réplica web de admin_tab_soporte.dart. Lista de tickets con
// filtro de estado; tocar uno abre ver-ticket-soporte.js como
// overlay (mismo patrón conv-overlay-raiz + pushState/popstate ya
// usado por conversacion-screen.js).
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../core/supabase-client.js';
import { plantillaAdminCard, plantillaFiltrosChips, activarFiltrosChips, plantillaEmptyAdmin, formatearTiempoRelativo, escapar } from './admin-shared-widgets.js';

const FILTROS = [
  ['pendiente', 'Pendientes'],
  ['resuelto', 'Resueltos'],
  ['todos', 'Todos'],
];

export function render(contenedor, { onTicketsPendientes } = {}) {
  let tickets = [];
  let cargando = true;
  let filtroEstado = 'pendiente';

  contenedor.innerHTML = `
    <div id="adm-sop-filtros">${plantillaFiltrosChips(FILTROS, filtroEstado)}</div>
    <div class="adm-lista" id="adm-sop-lista"></div>
  `;

  activarFiltrosChips(contenedor.querySelector('#adm-sop-filtros'), (valor) => {
    filtroEstado = valor;
    contenedor.querySelector('#adm-sop-filtros').innerHTML = plantillaFiltrosChips(FILTROS, filtroEstado);
    activarFiltrosChips(contenedor.querySelector('#adm-sop-filtros'), arguments.callee);
    cargar();
  });

  const zona = contenedor.querySelector('#adm-sop-lista');

  async function cargar() {
    cargando = true;
    render();
    try {
      let query = supabaseClient.from('tickets_soporte').select('id, usuario_id, nombre, correo, descripcion, estado, creado_en');
      if (filtroEstado !== 'todos') query = query.eq('estado', filtroEstado);
      const { data, error } = await query.order('creado_en', { ascending: false }).limit(50);
      if (error) throw error;
      tickets = data;

      const { count } = await supabaseClient.from('tickets_soporte').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente');
      onTicketsPendientes?.(count ?? 0);
    } catch (e) {
      console.error('admin-tab-soporte – cargar:', e);
    } finally {
      cargando = false;
      render();
    }
  }

  function render() {
    if (cargando) {
      zona.innerHTML = `<div class="adm-lista-cargando"><span class="chats-spinner"></span></div>`;
      return;
    }
    if (tickets.length === 0) {
      zona.innerHTML = plantillaEmptyAdmin({
        mensaje: filtroEstado === 'pendiente' ? '¡Sin tickets pendientes!' : 'Sin tickets aquí',
        icono: filtroEstado === 'pendiente' ? '✅' : '🎧',
      });
      return;
    }
    zona.innerHTML = tickets.map((t) => plantillaTicket(t)).join('');
    tickets.forEach((t) => {
      zona.querySelector(`[data-ticket-id="${t.id}"]`).addEventListener('click', () => abrirDetalle(t));
    });
  }

  function plantillaTicket(t) {
    const pendiente = t.estado === 'pendiente';
    return plantillaAdminCard(`
      <div class="adm-item" data-ticket-id="${t.id}">
        <span class="adm-item__avatar" style="background:rgba(0,122,255,0.12);color:#007AFF">🎧</span>
        <div class="adm-item__cuerpo">
          <div class="adm-item__titulo-fila">
            <span class="adm-item__nombre">${escapar(t.nombre || 'Sin nombre')}</span>
            <span class="adm-badge" style="background:${pendiente ? '#FF950020' : '#34C75920'};color:${pendiente ? '#FF9500' : '#34C759'}">${escapar(t.estado)}</span>
          </div>
          <p class="adm-item__sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapar(t.descripcion || '')}</p>
          ${t.creado_en ? `<p class="adm-item__extra">${formatearTiempoRelativo(t.creado_en)}</p>` : ''}
        </div>
        <span style="color:var(--color-text-30)">›</span>
      </div>
    `);
  }

  async function abrirDetalle(t) {
    const overlay = document.createElement('div');
    overlay.className = 'conv-overlay-raiz';
    document.body.appendChild(overlay);
    window.history.pushState({ ticketSoporte: true }, '');
    window.addEventListener('popstate', () => overlay.remove(), { once: true });

    const { render: renderDetalle } = await import('./ver-ticket-soporte.js');
    await renderDetalle(overlay, { ticket: t, onCerrar: () => overlay.remove() });

    // Al remover el overlay (por back o por el botón ←) recargamos
    // la lista, igual que Dart hace al volver de la pantalla de detalle.
    const observer = new MutationObserver(() => {
      if (!document.body.contains(overlay)) {
        cargar();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true });
  }

  cargar();
}