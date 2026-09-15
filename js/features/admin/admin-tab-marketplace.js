// ═════════════════════════════════════════════════════════════════
// admin-tab-marketplace.js
// Ubicación: js/features/admin/admin-tab-marketplace.js
//
// Réplica web de admin_tab_marketplace.dart. Sub-tabs Publicaciones
// (búsqueda + eliminar) y Emprendedores (scroll infinito, refrescar,
// verificar/suspender/rechazar).
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../core/supabase-client.js';
import { mostrarToast } from '../../core/toast.js';
import {
  crearAdminSearchBar,
  plantillaAdminCard,
  plantillaEmptyAdmin,
  mostrarConfirmacionAdmin,
  formatearTiempoRelativo,
  idCorto,
  escapar,
} from './admin-shared-widgets.js';

const TAMANO_PAGINA = 20;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function render(contenedor) {
  let subTab = 'publicaciones';

  contenedor.innerHTML = `
    <div class="adm-subtabs">
      <button class="adm-subtab activo" data-subtab="publicaciones">Publicaciones</button>
      <button class="adm-subtab" data-subtab="emprendedores">Emprendedores</button>
    </div>
    <div class="adm-subpanel visible" data-panel="publicaciones"></div>
    <div class="adm-subpanel" data-panel="emprendedores"></div>
  `;

  contenedor.querySelectorAll('[data-subtab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      subTab = btn.dataset.subtab;
      contenedor.querySelectorAll('[data-subtab]').forEach((b) => b.classList.toggle('activo', b === btn));
      contenedor.querySelectorAll('[data-panel]').forEach((p) => p.classList.toggle('visible', p.dataset.panel === subTab));
    });
  });

  renderPublicaciones(contenedor.querySelector('[data-panel="publicaciones"]'));
  renderEmprendedores(contenedor.querySelector('[data-panel="emprendedores"]'));
}

// ── Publicaciones ────────────────────────────────────────────────

function renderPublicaciones(panel) {
  let publicaciones = [];
  let cargando = false;
  let busqueda = '';

  panel.innerHTML = `
    <div class="adm-pub-busqueda" style="padding:12px 16px 8px"></div>
    <div class="adm-lista" id="adm-pub-lista"></div>
  `;

  crearAdminSearchBar(panel.querySelector('.adm-pub-busqueda'), { hint: 'Buscar por título o ID...', onChanged: buscar });
  const zona = panel.querySelector('#adm-pub-lista');

  async function buscar(valor) {
    busqueda = valor.trim();
    cargando = true;
    render();
    try {
      const esUuid = UUID_RE.test(busqueda);
      let query = supabaseClient
        .from('marketplace_publicaciones')
        .select(
          'id, titulo, precio, tipo, esta_activa, creado_en, marketplace_categorias(nombre, emoji), emprendedores(nombre_negocio, perfiles(nombre_usuario, cdn_foto_perfil))'
        )
        .eq('esta_activa', true);
      if (esUuid) query = query.eq('id', busqueda);
      else if (busqueda) query = query.ilike('titulo', `%${busqueda}%`);
      const { data, error } = await query.order('creado_en', { ascending: false }).limit(30);
      if (error) throw error;
      publicaciones = data;
    } catch (e) {
      console.error('admin-tab-marketplace – buscarPublicaciones:', e);
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
    if (publicaciones.length === 0) {
      zona.innerHTML = plantillaEmptyAdmin({ mensaje: 'Sin publicaciones', icono: '🏪' });
      return;
    }
    zona.innerHTML = publicaciones.map((p) => plantillaPub(p)).join('');
    publicaciones.forEach((p) => {
      zona.querySelector(`[data-eliminar-pub="${p.id}"]`)?.addEventListener('click', () => eliminarPublicacion(p));
    });
  }

  function plantillaPub(p) {
    const cat = p.marketplace_categorias;
    const empr = p.emprendedores;
    return plantillaAdminCard(`
      <div style="padding:12px 14px">
        <div class="adm-pub-titulo">
          <span class="adm-pub-titulo__texto">${escapar(p.titulo)}</span>
          <span class="adm-badge" style="background:${p.esta_activa ? '#34C75920' : '#ff453a20'};color:${p.esta_activa ? '#34C759' : '#ff453a'}">${p.esta_activa ? 'Activa' : 'Inactiva'}</span>
        </div>
        ${cat ? `<p class="adm-item__sub" style="margin-top:4px">${cat.emoji} ${escapar(cat.nombre)}  •  ${escapar(empr?.nombre_negocio || '')}</p>` : ''}
        ${p.precio != null ? `<p style="font-size:13px;font-weight:700;color:#007AFF;margin:4px 0 0">$${Number(p.precio).toFixed(2)} MXN</p>` : ''}
        <p class="adm-item__id" style="margin-top:4px">ID: ${idCorto(p.id)}</p>
        <button data-eliminar-pub="${p.id}" style="margin-top:8px;background:none;border:none;color:#ff453a;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px">🗑️ Eliminar</button>
      </div>
    `);
  }

  async function eliminarPublicacion(p) {
    const ok = await mostrarConfirmacionAdmin({ titulo: '¿Eliminar publicación?', mensaje: `"${p.titulo}" será eliminada permanentemente.`, textoConfirmar: 'Eliminar', color: '#ff453a' });
    if (!ok) return;
    try {
      const { error } = await supabaseClient.from('marketplace_publicaciones').delete().eq('id', p.id);
      if (error) throw error;
      buscar(busqueda);
    } catch (e) {
      mostrarToast(`Error: ${e.message}`, 'error');
    }
  }

  buscar('');
}

// ── Emprendedores ─────────────────────────────────────────────────

function renderEmprendedores(panel) {
  let emprendedores = [];
  let cargando = false;
  let cargandoMas = false;
  let hayMas = true;
  let offset = 0;

  panel.innerHTML = `
    <div style="display:flex;justify-content:flex-end;padding:10px 16px 0">
      <button class="adm-refrescar" id="adm-empr-refrescar">🔄</button>
    </div>
    <div class="adm-lista" id="adm-empr-lista"></div>
  `;
  const zona = panel.querySelector('#adm-empr-lista');
  panel.querySelector('#adm-empr-refrescar').addEventListener('click', () => cargar({ reemplazar: true }));

  panel.addEventListener('scroll', () => {
    if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 200) cargar();
  });

  async function cargar({ reemplazar = false } = {}) {
    if (cargandoMas) return;
    if (!reemplazar && !hayMas) return;
    if (reemplazar) cargando = true;
    else cargandoMas = true;
    render();

    try {
      const desde = reemplazar ? 0 : offset;
      const { data, error } = await supabaseClient
        .from('emprendedores')
        .select(
          'id, nombre_negocio, descripcion, estado, verificado_en, verificado_por, creado_en, calificacion_promedio, total_valoraciones, perfiles!emprendedores_perfil(nombre, nombre_usuario, cdn_foto_perfil)'
        )
        .order('creado_en', { ascending: false })
        .range(desde, desde + TAMANO_PAGINA - 1);
      if (error) throw error;

      emprendedores = reemplazar ? data : [...emprendedores, ...data];
      offset = desde + data.length;
      hayMas = data.length === TAMANO_PAGINA;
    } catch (e) {
      console.error('admin-tab-marketplace – emprendedores:', e);
    } finally {
      cargando = false;
      cargandoMas = false;
      render();
    }
  }

  function render() {
    if (cargando) {
      zona.innerHTML = `<div class="adm-lista-cargando"><span class="chats-spinner"></span></div>`;
      return;
    }
    if (emprendedores.length === 0) {
      zona.innerHTML = plantillaEmptyAdmin({ mensaje: 'Sin emprendedores', icono: '🏪' });
      return;
    }
    zona.innerHTML = emprendedores.map((e) => plantillaEmpr(e)).join('') + (cargandoMas ? `<div class="adm-lista-cargando-mas"><span class="chats-spinner"></span></div>` : '');

    emprendedores.forEach((e) => {
      zona.querySelector(`[data-verificar="${e.id}"]`)?.addEventListener('click', () => cambiarEstadoEmp(e, 'verificado'));
      zona.querySelector(`[data-suspender="${e.id}"]`)?.addEventListener('click', () => cambiarEstadoEmp(e, 'suspendido'));
    });
  }

  function colorEmp(e) {
    return e === 'verificado' ? '#34C759' : e === 'suspendido' ? '#ff453a' : '#FF9500';
  }

  function plantillaEmpr(e) {
    const p = e.perfiles;
    return plantillaAdminCard(`
      <div style="padding:14px">
        <div class="adm-empr-cabecera">
          <span class="adm-item__avatar">${p?.cdn_foto_perfil ? `<img src="${p.cdn_foto_perfil}" alt="" />` : '👤'}</span>
          <div style="flex:1;min-width:0">
            <p class="adm-item__nombre">${escapar(e.nombre_negocio)}</p>
            <p class="adm-item__sub">@${escapar(p?.nombre_usuario || '')}</p>
          </div>
          <span class="adm-badge" style="background:${colorEmp(e.estado)}20;color:${colorEmp(e.estado)}">${escapar(e.estado)}</span>
        </div>
        ${e.descripcion ? `<p class="adm-empr-desc">${escapar(e.descripcion)}</p>` : ''}
        <div class="adm-empr-fila">⭐ ${e.calificacion_promedio != null ? `${Number(e.calificacion_promedio).toFixed(1)} (${e.total_valoraciones} valoraciones)` : 'Sin valoraciones'}</div>
        ${e.verificado_por ? `<div class="adm-empr-fila">✅ Por @${escapar(e.verificado_por)}${e.verificado_en ? `  •  ${formatearTiempoRelativo(e.verificado_en)}` : ''}</div>` : ''}
        <div class="adm-empr-botones">
          ${
            e.estado === 'pendiente'
              ? `
            <button class="adm-btn-outline" data-suspender="${e.id}" style="border:1px solid #ff453a;color:#ff453a">✕ Rechazar</button>
            <button class="adm-btn-fill" data-verificar="${e.id}" style="background:#34C759">✓ Verificar</button>
          `
              : `
            ${e.estado !== 'verificado' ? `<button class="adm-btn-outline" data-verificar="${e.id}" style="border:1px solid #34C759;color:#34C759">✓ Verificar</button>` : ''}
            ${e.estado !== 'suspendido' ? `<button class="adm-btn-outline" data-suspender="${e.id}" style="border:1px solid #ff453a;color:#ff453a">🚫 Suspender</button>` : ''}
          `
          }
        </div>
      </div>
    `);
  }

  async function cambiarEstadoEmp(e, nuevoEstado) {
    try {
      const updates = { estado: nuevoEstado };
      if (nuevoEstado === 'verificado') {
        const {
          data: { user },
        } = await supabaseClient.auth.getUser();
        const { data: p } = await supabaseClient.from('perfiles').select('nombre_usuario').eq('id', user.id).maybeSingle();
        updates.verificado_en = new Date().toISOString();
        updates.verificado_por = p?.nombre_usuario || 'admin';
      }
      const { error } = await supabaseClient.from('emprendedores').update(updates).eq('id', e.id);
      if (error) throw error;
      mostrarToast(`${e.nombre_negocio} → ${nuevoEstado}`, nuevoEstado === 'verificado' ? 'success' : 'error');
      cargar({ reemplazar: true });
    } catch (err) {
      mostrarToast(`Error: ${err.message}`, 'error');
    }
  }

  cargar({ reemplazar: true });
}