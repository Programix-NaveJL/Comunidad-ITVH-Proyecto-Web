// ═════════════════════════════════════════════════════════════════
// admin-tab-reportes.js
// Ubicación: js/features/admin/admin-tab-reportes.js
//
// Réplica web de admin_tab_reportes.dart. Filtros de estado, lista
// con acciones de moderación (ignorar/eliminar pub/suspender autor/
// resolver), eliminación real de medios en R2 antes del registro.
//
// AJUSTAR: "Ver publicación" asume que ver-publicacion.js exporta
// render(contenedor, { post, isDark }) y se monta como overlay a
// pantalla completa (mismo patrón que conversacion-screen.js). Si su
// firma real es distinta, solo hay que ajustar verPublicacion().
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../core/supabase-client.js';
import { storageService } from '../../core/storage-service.js';
import { R2_CONFIG } from '../../core/r2-config.js';
import { mostrarToast } from '../../core/toast.js';
import {
  plantillaAdminCard,
  plantillaFiltrosChips,
  activarFiltrosChips,
  plantillaEmptyAdmin,
  mostrarConfirmacionAdmin,
  formatearTiempoRelativo,
  idCorto,
  escapar,
} from './admin-shared-widgets.js';

const FILTROS = [
  ['pendiente', 'Pendientes'],
  ['resuelto', 'Resueltos'],
  ['ignorado', 'Ignorados'],
  ['todos', 'Todos'],
];

export function render(contenedor) {
  let reportes = [];
  let cargando = true;
  let filtroEstado = 'pendiente';

  contenedor.innerHTML = `
    <div id="adm-rep-filtros">${plantillaFiltrosChips(FILTROS, filtroEstado)}</div>
    <div style="display:flex;justify-content:flex-end;padding:0 16px"><button class="adm-refrescar" id="adm-rep-refrescar">🔄</button></div>
    <div class="adm-lista" id="adm-rep-lista"></div>
  `;

  activarFiltrosChips(contenedor.querySelector('#adm-rep-filtros'), (valor) => {
    filtroEstado = valor;
    contenedor.querySelector('#adm-rep-filtros').innerHTML = plantillaFiltrosChips(FILTROS, filtroEstado);
    activarFiltrosChips(contenedor.querySelector('#adm-rep-filtros'), arguments.callee);
    cargar();
  });
  contenedor.querySelector('#adm-rep-refrescar').addEventListener('click', cargar);

  const zona = contenedor.querySelector('#adm-rep-lista');

  async function cargar() {
    cargando = true;
    render();
    try {
      let query = supabaseClient
        .from('reportes')
        .select('id, motivo, detalle, creado_en, estado, publicacion_id, autor_id, perfiles!reportes_reportado_por_fkey(nombre, nombre_usuario, cdn_foto_perfil)');
      if (filtroEstado !== 'todos') query = query.eq('estado', filtroEstado);
      const { data, error } = await query.order('creado_en', { ascending: false }).limit(50);
      if (error) throw error;
      reportes = data;
    } catch (e) {
      console.error('admin-tab-reportes – cargar:', e);
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
    if (reportes.length === 0) {
      zona.innerHTML = plantillaEmptyAdmin({
        mensaje: filtroEstado === 'pendiente' ? '¡Sin reportes pendientes!' : 'Sin reportes aquí',
        icono: filtroEstado === 'pendiente' ? '✅' : '🚩',
      });
      return;
    }
    zona.innerHTML = reportes.map((r) => plantillaReporte(r)).join('');
    reportes.forEach((r) => {
      zona.querySelector(`[data-ver-pub="${r.id}"]`)?.addEventListener('click', () => verPublicacion(r.publicacion_id));
      zona.querySelector(`[data-ignorar="${r.id}"]`)?.addEventListener('click', () => confirmarYResolver(r.id, 'ignorado'));
      zona.querySelector(`[data-eliminar-pub-rep="${r.id}"]`)?.addEventListener('click', () => eliminarPublicacionReportada(r));
      zona.querySelector(`[data-suspender-autor="${r.id}"]`)?.addEventListener('click', () => suspenderAutor(r));
      zona.querySelector(`[data-resolver="${r.id}"]`)?.addEventListener('click', () => confirmarYResolver(r.id, 'resuelto'));
    });
  }

  function plantillaReporte(r) {
    const reportero = r.perfiles;
    const pendiente = r.estado === 'pendiente';
    return plantillaAdminCard(`
      <div style="padding:14px">
        <div class="adm-reporte-cabecera">
          🚩 <span style="flex:1;font-size:14px;font-weight:700;color:var(--color-text)">${escapar(r.motivo || 'Sin motivo')}</span>
          <span class="adm-badge" style="background:${pendiente ? '#FF950020' : '#34C75920'};color:${pendiente ? '#FF9500' : '#34C759'}">${escapar(r.estado)}</span>
        </div>
        ${r.detalle ? `<p class="adm-reporte-detalle">${escapar(r.detalle)}</p>` : ''}
        ${reportero ? `<p class="adm-reporte-meta">👤 Reportado por @${escapar(reportero.nombre_usuario || '')}</p>` : ''}
        ${r.publicacion_id ? `<p class="adm-item__id" style="margin-top:4px">Pub ID: ${idCorto(r.publicacion_id)}</p><div class="adm-reporte-ver" data-ver-pub="${r.id}">🔗 Ver publicación</div>` : ''}
        ${r.creado_en ? `<p class="adm-item__extra" style="margin-top:4px">${formatearTiempoRelativo(r.creado_en)}</p>` : ''}
        ${
          pendiente
            ? `
          <div class="adm-reporte-botones">
            <div class="adm-reporte-botones-fila">
              <button class="adm-btn-outline" data-ignorar="${r.id}" style="border:1px solid var(--glass-border);color:var(--color-text-54)">🙈 Ignorar</button>
              <button class="adm-btn-outline" data-eliminar-pub-rep="${r.id}" style="border:1px solid #ff453a;color:#ff453a" ${r.publicacion_id ? '' : 'disabled'}>🗑️ Eliminar pub.</button>
            </div>
            <div class="adm-reporte-botones-fila">
              <button class="adm-btn-outline" data-suspender-autor="${r.id}" style="border:1px solid #FFCC00;color:#FFCC00" ${r.autor_id ? '' : 'disabled'}>🔒 Suspender autor</button>
              <button class="adm-btn-fill" data-resolver="${r.id}" style="background:#34C759">✓ Resolver</button>
            </div>
          </div>
        `
            : ''
        }
      </div>
    `);
  }

  async function confirmarYResolver(id, accion) {
    const textos = {
      ignorado: { titulo: '¿Ignorar este reporte?', msg: 'No se tomará acción sobre la publicación.', color: '#8E8E93' },
      resuelto: { titulo: '¿Marcar como resuelto?', msg: 'Confirma que ya se atendió este reporte.', color: '#34C759' },
    };
    const t = textos[accion];
    const ok = await mostrarConfirmacionAdmin({ titulo: t.titulo, mensaje: t.msg, textoConfirmar: 'Confirmar', color: t.color });
    if (!ok) return;
    const { error } = await supabaseClient.from('reportes').update({ estado: accion }).eq('id', id);
    if (error) return mostrarToast(`Error: ${error.message}`, 'error');
    cargar();
  }

  async function verPublicacion(pubId) {
    try {
      const { data, error } = await supabaseClient
        .from('publicaciones')
        .select(
          'id, contenido, tipo, creado_en, total_reacciones, total_comentarios, autor_id, esta_suspendida, perfiles!publicaciones_autor_id_fkey(id, nombre, nombre_usuario, cdn_foto_perfil), publicacion_medios(url, cdn_url, tipo_medio, orden)'
        )
        .eq('id', pubId)
        .single();
      if (error) throw error;

      const overlay = document.createElement('div');
      overlay.className = 'conv-overlay-raiz';
      document.body.appendChild(overlay);
      window.history.pushState({ verPublicacionAdmin: true }, '');
      window.addEventListener('popstate', () => overlay.remove(), { once: true });

      const { render: renderPublicacion } = await import('../social/publicaciones/ver-publicacion.js');
      renderPublicacion(overlay, { post: data });
    } catch (e) {
      mostrarToast(`No se pudo cargar: ${e.message}`, 'error');
    }
  }

  async function eliminarPublicacionReportada(r) {
    const ok = await mostrarConfirmacionAdmin({ titulo: '¿Eliminar publicación?', mensaje: 'Se eliminarán también los archivos multimedia.', textoConfirmar: 'Eliminar', color: '#ff453a' });
    if (!ok) return;

    try {
      const { data: medios } = await supabaseClient.from('publicacion_medios').select('cdn_url').eq('publicacion_id', r.publicacion_id);
      for (const medio of medios || []) {
        if (!medio.cdn_url) continue;
        const url = new URL(medio.cdn_url);
        const path = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
        await storageService.eliminarDeR2({ bucket: R2_CONFIG.bucketPublicaciones, path });
      }
      await supabaseClient.from('publicaciones').delete().eq('id', r.publicacion_id);
      await supabaseClient.from('reportes').update({ estado: 'resuelto' }).eq('id', r.id);
      mostrarToast('Publicación y archivos eliminados', 'success');
      cargar();
    } catch (e) {
      mostrarToast(`Error: ${e.message}`, 'error');
    }
  }

  async function suspenderAutor(r) {
    const ok = await mostrarConfirmacionAdmin({ titulo: '¿Suspender al autor?', mensaje: 'El usuario no podrá acceder temporalmente.', textoConfirmar: 'Suspender', color: '#FFCC00' });
    if (!ok) return;
    try {
      await supabaseClient.from('perfiles').update({ estado_cuenta: 'suspendido' }).eq('id', r.autor_id);
      await supabaseClient.from('reportes').update({ estado: 'resuelto' }).eq('id', r.id);
      mostrarToast('Autor suspendido', 'success');
      cargar();
    } catch (e) {
      mostrarToast(`Error: ${e.message}`, 'error');
    }
  }

  cargar();
}