// ═════════════════════════════════════════════════════════════════
// admin-tab-dashboard.js
// Ubicación: js/features/admin/admin-tab-dashboard.js
//
// Réplica web de admin_tab_dashboard.dart. 6 conteos exactos en
// paralelo (Promise.all + { count: 'exact', head: true }, equivalente
// de CountOption.exact) + accesos rápidos.
//
// DIFERENCIA: sin RefreshIndicator nativo — se agrega un botón de
// refrescar (🔄) en vez de gesto de swipe-down, mismo criterio que
// el resto de tabs de este panel.
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../core/supabase-client.js';
import { plantillaMetricCard, plantillaAccesoRapido, activarAccesosRapidos, plantillaSectionLabel } from './admin-shared-widgets.js';

export async function render(contenedor, { onIrATab, onReportesPendientes }) {
  contenedor.innerHTML = `<div class="adm-lista-cargando"><span class="chats-spinner"></span></div>`;
  await cargar();

  async function cargar() {
    try {
      const [activos, pubsActivas, reportesPend, emprPend, suspendidas, expulsadas] = await Promise.all([
        supabaseClient.from('perfiles').select('id', { count: 'exact', head: true }).eq('estado_cuenta', 'activo'),
        supabaseClient.from('marketplace_publicaciones').select('id', { count: 'exact', head: true }).eq('esta_activa', true),
        supabaseClient.from('reportes').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        supabaseClient.from('emprendedores').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        supabaseClient.from('perfiles').select('id', { count: 'exact', head: true }).eq('estado_cuenta', 'suspendido'),
        supabaseClient.from('perfiles').select('id', { count: 'exact', head: true }).eq('estado_cuenta', 'expulsado'),
      ]);

      const m = {
        activos: activos.count ?? 0,
        pubsActivas: pubsActivas.count ?? 0,
        reportesPend: reportesPend.count ?? 0,
        emprPend: emprPend.count ?? 0,
        suspendidas: suspendidas.count ?? 0,
        expulsadas: expulsadas.count ?? 0,
      };

      onReportesPendientes?.(m.reportesPend);
      renderContenido(m);
    } catch (e) {
      console.error('admin-tab-dashboard – cargar:', e);
    }
  }

  function renderContenido(m) {
    contenedor.innerHTML = `
      <div class="adm-dash">
        <div style="display:flex;align-items:center;justify-content:space-between">
          ${plantillaSectionLabel('Resumen general')}
          <button class="adm-refrescar" id="adm-dash-refrescar">🔄</button>
        </div>
        <div style="height:12px"></div>
        <div class="adm-dash-fila">
          <div data-tab-indice="1">${plantillaMetricCard({ emoji: '👥', label: 'Usuarios activos', valor: m.activos, color: '#007AFF' })}</div>
          <div data-tab-indice="2">${plantillaMetricCard({ emoji: '🛒', label: 'Publicaciones activas', valor: m.pubsActivas, color: '#34C759' })}</div>
        </div>
        <div class="adm-dash-fila">
          <div data-tab-indice="3">${plantillaMetricCard({ emoji: '🚨', label: 'Reportes pendientes', valor: m.reportesPend, color: '#FF3B30', alerta: m.reportesPend > 0 })}</div>
          <div data-tab-indice="2">${plantillaMetricCard({ emoji: '🏅', label: 'Emprendedores en espera', valor: m.emprPend, color: '#FF9500', alerta: m.emprPend > 0 })}</div>
        </div>
        <div class="adm-dash-fila">
          <div data-tab-indice="1">${plantillaMetricCard({ emoji: '🔒', label: 'Cuentas suspendidas', valor: m.suspendidas, color: '#FFCC00', alerta: m.suspendidas > 0 })}</div>
          <div data-tab-indice="1">${plantillaMetricCard({ emoji: '🚫', label: 'Cuentas expulsadas', valor: m.expulsadas, color: '#B71C1C', alerta: m.expulsadas > 0 })}</div>
        </div>

        <div style="height:12px"></div>
        ${plantillaSectionLabel('Accesos rápidos')}
        <div style="height:12px"></div>
        ${plantillaAccesoRapido({ icono: '👥', color: '#007AFF', titulo: 'Gestionar usuarios', subtitulo: `${m.activos} usuarios activos en la plataforma`, tabIndice: 1 })}
        <div style="height:8px"></div>
        ${plantillaAccesoRapido({ icono: '⏳', color: '#FF9500', titulo: 'Verificar emprendedores', subtitulo: `${m.emprPend} solicitudes pendientes`, tabIndice: 2 })}
        <div style="height:8px"></div>
        ${plantillaAccesoRapido({ icono: '🚩', color: '#FF3B30', titulo: 'Revisar reportes', subtitulo: `${m.reportesPend} reportes sin resolver`, tabIndice: 3 })}
      </div>
    `;

    // Las tarjetas métricas también navegan al tocarse — se envuelven
    // en divs con data-tab-indice para reutilizar activarAccesosRapidos.
    contenedor.querySelectorAll('[data-tab-indice]').forEach((div) => {
      div.style.cursor = 'pointer';
      div.addEventListener('click', () => onIrATab?.(Number(div.dataset.tabIndice)));
    });
    activarAccesosRapidos(contenedor, onIrATab);
    contenedor.querySelector('#adm-dash-refrescar').addEventListener('click', cargar);
  }
}