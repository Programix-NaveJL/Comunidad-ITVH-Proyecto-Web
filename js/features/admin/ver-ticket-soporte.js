// ═════════════════════════════════════════════════════════════════
// ver-ticket-soporte.js
// Ubicación: js/features/admin/ver-ticket-soporte.js
//
// Réplica web de ver_ticket_soporte.dart. Detalle de un ticket de
// soporte: estado, perfil del usuario en la app (si existe), datos
// del formulario, mensaje completo, y botón de marcar resuelto.
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../core/supabase-client.js';
import { abrirPerfilPublico } from '../perfil/perfil-publico.js';
import { mostrarToast } from '../../core/toast.js';
import { mostrarConfirmacionAdmin, formatearTiempoRelativo, escapar } from './admin-shared-widgets.js';

export async function render(contenedor, { ticket, onCerrar }) {
  let perfil = null;
  let cargandoPerfil = true;
  let estado = ticket.estado || 'pendiente';

  contenedor.innerHTML = `
    <div class="adm-detalle-screen">
      <div class="adm-detalle-appbar">
        <button class="adm-detalle-appbar__back" id="adm-detalle-back">←</button>
        <p class="adm-detalle-appbar__titulo">Detalle del ticket</p>
      </div>
      <div class="adm-detalle-cuerpo" id="adm-detalle-cuerpo"></div>
    </div>
  `;
  contenedor.querySelector('#adm-detalle-back').addEventListener('click', () => window.history.back());

  await cargarPerfil();
  renderCuerpo();

  async function cargarPerfil() {
    const uid = ticket.usuario_id;
    if (!uid) {
      cargandoPerfil = false;
      return;
    }
    try {
      const { data, error } = await supabaseClient.from('perfiles').select('nombre, nombre_usuario, cdn_foto_perfil, carrera, semestre, presentacion').eq('id', uid).maybeSingle();
      if (error) throw error;
      perfil = data;
    } catch (e) {
      console.error('ver-ticket-soporte – cargarPerfil:', e);
    } finally {
      cargandoPerfil = false;
    }
  }

  function renderCuerpo() {
    const pendiente = estado === 'pendiente';
    const cuerpo = contenedor.querySelector('#adm-detalle-cuerpo');
    cuerpo.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <span class="adm-badge" style="background:${pendiente ? '#FF950020' : '#34C75920'};color:${pendiente ? '#FF9500' : '#34C759'}">${escapar(estado)}</span>
        ${ticket.creado_en ? `<span style="font-size:12px;color:var(--color-text-38)">${formatearTiempoRelativo(ticket.creado_en)}</span>` : ''}
      </div>

      <p class="adm-section-label" style="font-size:12px;letter-spacing:0.3px;color:var(--color-text-38);margin-bottom:10px">PERFIL EN LA APP</p>
      ${
        cargandoPerfil
          ? `<div class="adm-lista-cargando"><span class="chats-spinner"></span></div>`
          : perfil == null
            ? `<div class="adm-card"><div style="padding:14px;display:flex;align-items:center;gap:10px;color:var(--color-text-54);font-size:12.5px">👤 No se encontró un perfil vinculado a este ticket</div></div>`
            : plantillaPerfilCard(perfil, ticket.usuario_id)
      }

      <div style="height:22px"></div>
      <p class="adm-section-label" style="font-size:12px;letter-spacing:0.3px;color:var(--color-text-38);margin-bottom:10px">DATOS DEL FORMULARIO</p>
      <div class="adm-card"><div style="padding:14px">
        <div class="adm-dato-fila"><span class="adm-dato-fila__label">Nombre</span><span class="adm-dato-fila__valor">${escapar(ticket.nombre || '—')}</span></div>
        <div style="height:12px"></div>
        <div class="adm-dato-fila"><span class="adm-dato-fila__label">Correo</span><span class="adm-dato-fila__valor">${escapar(ticket.correo || '—')}</span>
          ${ticket.correo ? `<button id="adm-copiar-correo" style="background:none;border:none;color:var(--color-text-38);cursor:pointer">📋</button>` : ''}
        </div>
      </div></div>

      <div style="height:22px"></div>
      <p class="adm-section-label" style="font-size:12px;letter-spacing:0.3px;color:var(--color-text-38);margin-bottom:10px">MENSAJE</p>
      <div class="adm-card"><div style="padding:14px;font-size:13.5px;line-height:1.5;color:var(--color-text)">${escapar(ticket.descripcion || '')}</div></div>

      <div style="height:28px"></div>
      ${pendiente ? `<button id="adm-marcar-resuelto" class="adm-btn-fill" style="width:100%;background:#34C759;padding:13px">✓ Marcar como resuelto</button>` : ''}
    `;

    cuerpo.querySelector('#adm-copiar-correo')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(ticket.correo);
      mostrarToast('Correo copiado', 'success');
    });
    cuerpo.querySelector('[data-ir-perfil]')?.addEventListener('click', () => abrirPerfilPublico(ticket.usuario_id));
    cuerpo.querySelector('#adm-marcar-resuelto')?.addEventListener('click', marcarResuelto);
  }

  function plantillaPerfilCard(p, uid) {
    const inicial = (p.nombre || '?').trim().charAt(0).toUpperCase();
    return `
      <div class="adm-card">
        <div data-ir-perfil style="padding:14px;cursor:${uid ? 'pointer' : 'default'}">
          <div class="adm-perfil-card__fila">
            <span class="adm-item__avatar" style="width:52px;height:52px;font-size:18px">${p.cdn_foto_perfil ? `<img src="${p.cdn_foto_perfil}" alt="" />` : inicial}</span>
            <div class="adm-perfil-card__textos">
              <p class="adm-perfil-card__nombre">${escapar(p.nombre || 'Sin nombre')}</p>
              ${p.nombre_usuario ? `<p class="adm-perfil-card__usuario">@${escapar(p.nombre_usuario)}</p>` : ''}
            </div>
            ${uid ? `<span style="color:var(--color-text-30)">›</span>` : ''}
          </div>
          ${
            p.carrera || p.semestre
              ? `<div class="adm-empr-fila" style="margin-top:12px">🎓 ${[p.carrera, p.semestre ? `Semestre ${p.semestre}` : null].filter(Boolean).join(' · ')}</div>`
              : ''
          }
          ${p.presentacion ? `<p style="font-size:12.5px;font-style:italic;color:var(--color-text-54);margin-top:10px;line-height:1.4">${escapar(p.presentacion)}</p>` : ''}
        </div>
      </div>
    `;
  }

  async function marcarResuelto() {
    const ok = await mostrarConfirmacionAdmin({ titulo: '¿Marcar como resuelto?', mensaje: 'Confirma que ya atendiste este ticket.', textoConfirmar: 'Confirmar', color: '#34C759' });
    if (!ok) return;
    try {
      const { error } = await supabaseClient.from('tickets_soporte').update({ estado: 'resuelto' }).eq('id', ticket.id);
      if (error) throw error;
      estado = 'resuelto';
      renderCuerpo();
    } catch (e) {
      mostrarToast(`Error: ${e.message}`, 'error');
    }
  }
}