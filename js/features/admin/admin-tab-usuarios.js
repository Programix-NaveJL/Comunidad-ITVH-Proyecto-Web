// ═════════════════════════════════════════════════════════════════
// admin-tab-usuarios.js
// Ubicación: js/features/admin/admin-tab-usuarios.js
//
// Réplica web de admin_tab_usuarios.dart. Buscador (con detección
// de UUID), filtros por estado, scroll infinito, menú por usuario
// (ver perfil, insignia, admin, suspender/expulsar/reactivar), y
// sheet de "perfiles con insignias" con su propia paginación.
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../core/supabase-client.js';
import { abrirPerfilPublico } from '../perfil/perfil-publico.js';
import { mostrarToast } from '../../core/toast.js';
import {
  crearAdminSearchBar,
  plantillaAdminCard,
  plantillaFiltrosChips,
  activarFiltrosChips,
  plantillaEmptyAdmin,
  mostrarConfirmacionAdmin,
  mostrarMenuOpcionesAdmin,
  idCorto,
  escapar,
} from './admin-shared-widgets.js';

const TAMANO_PAGINA = 20;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const NIVELES_ESTADO = {
  suspendido: { titulo: (n) => `¿Suspender a ${n}?`, msg: 'No podrá acceder temporalmente.', boton: 'Suspender', color: '#FFCC00' },
  expulsado: { titulo: (n) => `¿Expulsar a ${n}?`, msg: 'Acción permanente. No podrá volver nunca.', boton: 'Expulsar', color: '#B71C1C' },
  activo: { titulo: (n) => `¿Reactivar a ${n}?`, msg: 'Recuperará acceso completo.', boton: 'Reactivar', color: '#34C759' },
};

export function render(contenedor) {
  let usuarios = [];
  let cargando = false;
  let cargandoMas = false;
  let hayMas = true;
  let offset = 0;
  let busqueda = '';
  let filtroEstado = 'todos';
  let adminIds = new Set();

  contenedor.innerHTML = `
    <div class="adm-usuarios-busqueda"></div>
    <div id="adm-usuarios-filtros">${plantillaFiltrosChips(
      [
        ['todos', 'Todos'],
        ['activo', 'Activo'],
        ['suspendido', 'Suspendido'],
        ['expulsado', 'Expulsado'],
      ],
      filtroEstado
    )}</div>
    <div style="padding:0 16px 10px">
      <button class="adm-btn-insignias" id="adm-ver-insignias" style="width:100%;display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:12px;background:rgba(0,122,255,0.08);border:1px solid rgba(0,122,255,0.2);color:#007AFF;font-size:13px;font-weight:600;cursor:pointer">
        🏅 <span style="flex:1;text-align:left">Ver perfiles con insignias</span> ›
      </button>
    </div>
    <div class="adm-lista" id="adm-usuarios-lista"></div>
  `;

  crearAdminSearchBar(contenedor.querySelector('.adm-usuarios-busqueda'), {
    hint: 'Buscar por nombre, usuario o ID...',
    onChanged: buscar,
  });

  function renderFiltros() {
    const zona = contenedor.querySelector('#adm-usuarios-filtros');
    zona.innerHTML = plantillaFiltrosChips(
      [
        ['todos', 'Todos'],
        ['activo', 'Activo'],
        ['suspendido', 'Suspendido'],
        ['expulsado', 'Expulsado'],
      ],
      filtroEstado
    );
    activarFiltrosChips(zona, (valor) => {
      filtroEstado = valor;
      renderFiltros();
      buscar(busqueda);
    });
  }
  renderFiltros();

  contenedor.querySelector('#adm-ver-insignias').addEventListener('click', mostrarPerfilesConInsignias);

  const zonaLista = contenedor.querySelector('#adm-usuarios-lista');

  const contenedorScroll = contenedor.closest('.adm-panel__seccion') || contenedor;
  contenedorScroll.addEventListener('scroll', () => {
    if (contenedorScroll.scrollTop + contenedorScroll.clientHeight >= contenedorScroll.scrollHeight - 200) {
      cargarPagina();
    }
  });

  async function buscar(valor) {
    busqueda = valor.trim();
    offset = 0;
    hayMas = true;
    adminIds = new Set();
    await cargarPagina({ reemplazar: true });
  }

  async function cargarPagina({ reemplazar = false } = {}) {
    if (cargandoMas) return;
    if (!reemplazar && !hayMas) return;

    if (reemplazar) cargando = true;
    else cargandoMas = true;
    renderLista();

    try {
      const esUuid = UUID_RE.test(busqueda);
      let query = supabaseClient.from('perfiles').select('id, nombre, nombre_usuario, cdn_foto_perfil, creado_en, estado_cuenta, carrera');

      if (esUuid) query = query.eq('id', busqueda);
      else if (busqueda) query = query.or(`nombre.ilike.%${busqueda}%,nombre_usuario.ilike.%${busqueda}%`);
      if (filtroEstado !== 'todos') query = query.eq('estado_cuenta', filtroEstado);

      const desde = reemplazar ? 0 : offset;
      const hasta = desde + TAMANO_PAGINA - 1;
      const { data, error } = await query.order('creado_en', { ascending: false }).range(desde, hasta);
      if (error) throw error;

      usuarios = reemplazar ? data : [...usuarios, ...data];
      offset = desde + data.length;
      hayMas = data.length === TAMANO_PAGINA;

      await actualizarAdminIds(data.map((u) => u.id));
    } catch (e) {
      console.error('admin-tab-usuarios – cargarPagina:', e);
    } finally {
      cargando = false;
      cargandoMas = false;
      renderLista();
    }
  }

  async function actualizarAdminIds(ids) {
    if (ids.length === 0) return;
    const { data, error } = await supabaseClient.from('tabla_admins').select('perfil_id').in('perfil_id', ids);
    if (error) return console.error('admin-tab-usuarios – adminIds:', error);
    data.forEach((f) => adminIds.add(f.perfil_id));
  }

  function renderLista() {
    if (cargando) {
      zonaLista.innerHTML = `<div class="adm-lista-cargando"><span class="chats-spinner"></span></div>`;
      return;
    }
    if (usuarios.length === 0) {
      zonaLista.innerHTML = plantillaEmptyAdmin({ mensaje: 'Sin usuarios encontrados', icono: '🔍' });
      return;
    }
    zonaLista.innerHTML =
      usuarios.map((u) => plantillaUsuario(u, adminIds.has(u.id))).join('') +
      (cargandoMas ? `<div class="adm-lista-cargando-mas"><span class="chats-spinner"></span></div>` : '');

    usuarios.forEach((u) => {
      const el = zonaLista.querySelector(`[data-usuario-id="${u.id}"]`);
      if (!el) return;
      el.addEventListener('click', (e) => {
        if (e.target.closest('.adm-item__menu')) return;
        abrirPerfilPublico(u.id);
      });
      el.querySelector('.adm-item__menu').addEventListener('click', (e) => {
        e.stopPropagation();
        abrirMenuUsuario(u);
      });
    });
  }

  function plantillaUsuario(u, esAdmin) {
    const noActivo = u.estado_cuenta !== 'activo';
    const inicial = (u.nombre || '?').trim().charAt(0).toUpperCase();
    return plantillaAdminCard(`
      <div class="adm-item" data-usuario-id="${u.id}">
        <span class="adm-item__avatar">${u.cdn_foto_perfil ? `<img src="${u.cdn_foto_perfil}" alt="" />` : inicial}</span>
        <div class="adm-item__cuerpo">
          <div class="adm-item__titulo-fila">
            <span class="adm-item__nombre">${escapar(u.nombre || '')}</span>
            ${esAdmin ? `<span class="adm-badge" style="background:rgba(0,122,255,0.12);color:#007AFF">🛡️ ADMIN</span>` : ''}
            ${noActivo ? `<span class="adm-badge" style="background:${colorEstado(u.estado_cuenta)}1f;color:${colorEstado(u.estado_cuenta)}">${labelEstado(u.estado_cuenta)}</span>` : ''}
          </div>
          <p class="adm-item__sub">@${escapar(u.nombre_usuario || '')}</p>
          ${u.carrera ? `<p class="adm-item__extra">${escapar(u.carrera)}</p>` : ''}
          <p class="adm-item__id" data-copiar-id="${u.id}">ID: ${idCorto(u.id)}</p>
        </div>
        <button class="adm-item__menu">⋮</button>
      </div>
    `);
  }

  async function abrirMenuUsuario(u) {
    const esAdmin = adminIds.has(u.id);
    const opciones = [
      { valor: 'perfil', icono: '👤', label: 'Ver perfil' },
      { valor: 'insignia', icono: '🏅', label: 'Asignar insignia' },
      esAdmin
        ? { valor: 'quitar_admin', icono: '🛡️', label: 'Quitar admin', color: '#B71C1C' }
        : { valor: 'hacer_admin', icono: '🛡️', label: 'Hacer admin', color: '#007AFF' },
    ];
    if (u.estado_cuenta === 'activo') {
      opciones.push({ valor: 'suspender', icono: '🔒', label: 'Suspender', color: '#FFCC00' });
      opciones.push({ valor: 'expulsar', icono: '🚫', label: 'Expulsar', peligroso: true });
    }
    if (u.estado_cuenta === 'suspendido') {
      opciones.push({ valor: 'reactivar', icono: '🔓', label: 'Reactivar', color: '#34C759' });
    }

    const accion = await mostrarMenuOpcionesAdmin(opciones);
    if (!accion) return;

    if (accion === 'perfil') abrirPerfilPublico(u.id);
    else if (accion === 'insignia') abrirAsignarInsignia(u);
    else if (accion === 'hacer_admin') hacerAdmin(u);
    else if (accion === 'quitar_admin') quitarAdmin(u);
    else if (accion === 'suspender') cambiarEstado(u, 'suspendido');
    else if (accion === 'expulsar') cambiarEstado(u, 'expulsado');
    else if (accion === 'reactivar') cambiarEstado(u, 'activo');
  }

  async function cambiarEstado(u, nuevoEstado) {
    const nombre = u.nombre || 'Usuario';
    const t = NIVELES_ESTADO[nuevoEstado];
    const ok = await mostrarConfirmacionAdmin({ titulo: t.titulo(nombre), mensaje: t.msg, textoConfirmar: t.boton, color: t.color });
    if (!ok) return;

    try {
      const { error } = await supabaseClient.from('perfiles').update({ estado_cuenta: nuevoEstado }).eq('id', u.id);
      if (error) throw error;
      mostrarToast(`${t.boton} exitoso para ${nombre}`, 'success');
      buscar(busqueda);
    } catch (e) {
      mostrarToast(`Error: ${e.message}`, 'error');
    }
  }

  async function hacerAdmin(u) {
    const nombre = u.nombre || 'Usuario';
    let nivel = 'moderador';

    const overlay = document.createElement('div');
    overlay.className = 'adm-dialogo-overlay';
    overlay.innerHTML = `
      <div class="adm-dialogo">
        <p class="adm-dialogo__titulo">¿Hacer admin a ${escapar(nombre)}?</p>
        <p class="adm-dialogo__mensaje">Tendrá acceso al Panel de Control.</p>
        <p style="font-size:12px;font-weight:600;color:var(--color-text-38);margin:0 0 8px">Nivel</p>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <button class="adm-nivel-chip seleccionado" data-nivel="moderador">Moderador</button>
          <button class="adm-nivel-chip" data-nivel="admin">Admin</button>
        </div>
        <div class="adm-dialogo__acciones">
          <button data-valor="false">Cancelar</button>
          <button data-valor="true" style="color:#007AFF">Confirmar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    overlay.querySelectorAll('[data-nivel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        nivel = btn.dataset.nivel;
        overlay.querySelectorAll('[data-nivel]').forEach((b) => b.classList.toggle('seleccionado', b === btn));
      });
    });

    const ok = await new Promise((resolve) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) resolve(false);
      });
      overlay.querySelectorAll('[data-valor]').forEach((btn) => {
        btn.addEventListener('click', () => resolve(btn.dataset.valor === 'true'));
      });
    });
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);

    if (!ok) return;
    try {
      const { error } = await supabaseClient.from('tabla_admins').insert({ perfil_id: u.id, nivel });
      if (error) throw error;
      adminIds.add(u.id);
      renderLista();
      mostrarToast(`${nombre} ahora es admin (${nivel})`, 'success');
    } catch (e) {
      mostrarToast(`Error: ${e.message}`, 'error');
    }
  }

  async function quitarAdmin(u) {
    const nombre = u.nombre || 'Usuario';
    const ok = await mostrarConfirmacionAdmin({ titulo: `¿Quitar admin a ${nombre}?`, mensaje: 'Perderá acceso al Panel de Control.', textoConfirmar: 'Quitar', color: '#B71C1C' });
    if (!ok) return;
    try {
      const { error } = await supabaseClient.from('tabla_admins').delete().eq('perfil_id', u.id);
      if (error) throw error;
      adminIds.delete(u.id);
      renderLista();
      mostrarToast(`${nombre} ya no es admin`, 'success');
    } catch (e) {
      mostrarToast(`Error: ${e.message}`, 'error');
    }
  }

  // ── Asignar insignia ────────────────────────────────────────────

  function abrirAsignarInsignia(u) {
    const nombre = u.nombre || 'Usuario';
    const estaticas = [
      { emoji: '✅', label: 'Emprendedor verificado' },
      { emoji: '🎓', label: 'Estudiante verificado' },
    ];
    const emojis = ['🏆', '⭐', '💡', '🚀', '🎯', '🏅', '🔥', '👑', '💎', '🌟', '🎖️', '🤝', '📚', '🛠️', '🎨', '💪', '🌱', '⚡', '🏗️', '🎤'];

    let tipoElegido = null;
    let esPersonalizada = false;
    let emojiElegido = emojis[0];
    let textoPersonalizado = '';

    const overlay = document.createElement('div');
    overlay.className = 'adm-menu-overlay';
    overlay.innerHTML = `
      <div class="adm-menu-sheet" style="padding:20px;max-height:85vh;overflow-y:auto">
        <p class="adm-dialogo__titulo">Asignar insignia a ${escapar(nombre)}</p>
        <p style="font-size:12px;font-weight:600;color:var(--color-text-38);margin:14px 0 8px">Insignias fijas</p>
        <div id="adm-ins-estaticas"></div>
        <hr style="border:none;border-top:1px solid var(--glass-border);margin:14px 0" />
        <p style="font-size:12px;font-weight:600;color:var(--color-text-38);margin:0 0 10px">Insignia personalizada</p>
        <div class="adm-insignia-emoji-grid" id="adm-ins-emojis">
          ${emojis.map((e, i) => `<button class="adm-insignia-emoji${i === 0 ? ' seleccionado' : ''}" data-emoji="${e}">${e}</button>`).join('')}
        </div>
        <div style="height:10px"></div>
        <input type="text" class="adm-input" id="adm-ins-texto" placeholder="Nombre de la insignia..." style="width:100%;border:none;border-radius:12px;background:var(--glass-bg);padding:12px;font-size:14px;color:var(--color-text);box-sizing:border-box" />
        <button class="adm-btn-fill" id="adm-ins-asignar" style="width:100%;margin-top:16px;background:#007AFF;padding:13px" disabled>Asignar</button>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const zonaEstaticas = overlay.querySelector('#adm-ins-estaticas');
    function renderEstaticas() {
      zonaEstaticas.innerHTML = estaticas
        .map((ins) => {
          const key = ins.label.toLowerCase().replace(/ /g, '_');
          const sel = !esPersonalizada && tipoElegido === key;
          return `<button class="adm-insignia-opcion${sel ? ' seleccionada' : ''}" data-key="${key}"><span>${ins.emoji}</span><span style="flex:1">${ins.label}</span>${sel ? '✓' : ''}</button>`;
        })
        .join('');
      zonaEstaticas.querySelectorAll('[data-key]').forEach((btn) => {
        btn.addEventListener('click', () => {
          esPersonalizada = false;
          tipoElegido = btn.dataset.key;
          renderEstaticas();
          actualizarBoton();
        });
      });
    }
    renderEstaticas();

    overlay.querySelectorAll('[data-emoji]').forEach((btn) => {
      btn.addEventListener('click', () => {
        esPersonalizada = true;
        tipoElegido = null;
        emojiElegido = btn.dataset.emoji;
        overlay.querySelectorAll('[data-emoji]').forEach((b) => b.classList.toggle('seleccionado', b === btn));
        renderEstaticas();
        actualizarBoton();
      });
    });

    const inputTexto = overlay.querySelector('#adm-ins-texto');
    const btnAsignar = overlay.querySelector('#adm-ins-asignar');
    inputTexto.addEventListener('input', () => {
      textoPersonalizado = inputTexto.value.trim();
      if (textoPersonalizado) {
        esPersonalizada = true;
        tipoElegido = null;
        renderEstaticas();
      }
      actualizarBoton();
    });

    function actualizarBoton() {
      const valido = tipoElegido != null || (esPersonalizada && textoPersonalizado);
      btnAsignar.disabled = !valido;
      btnAsignar.style.opacity = valido ? '1' : '0.5';
    }

    const cerrar = () => {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cerrar();
    });

    btnAsignar.addEventListener('click', async () => {
      const tipo = esPersonalizada
        ? `${emojiElegido} ${textoPersonalizado}`
        : (() => {
            const ins = estaticas.find((e) => e.label.toLowerCase().replace(/ /g, '_') === tipoElegido);
            return `${ins.emoji} ${ins.label}`;
          })();
      cerrar();
      try {
        const {
          data: { user },
        } = await supabaseClient.auth.getUser();
        const { data: adminRow, error: e1 } = await supabaseClient.from('tabla_admins').select('id').eq('perfil_id', user.id).single();
        if (e1) throw e1;
        const { error: e2 } = await supabaseClient.from('insignias').insert({ perfil_id: u.id, tipo, otorgada_por: adminRow.id });
        if (e2) throw e2;
        mostrarToast(`Insignia "${tipo}" asignada a ${nombre}`, 'success');
      } catch (e) {
        mostrarToast(`Error: ${e.message}`, 'error');
      }
    });
  }

  // ── Ver perfiles con insignias ──────────────────────────────────

  async function mostrarPerfilesConInsignias() {
    let datos = [];
    let cargandoIns = true;
    let cargandoMasIns = false;
    let hayMasIns = true;
    let offsetIns = 0;

    const overlay = document.createElement('div');
    overlay.className = 'adm-menu-overlay';
    overlay.innerHTML = `
      <div class="adm-menu-sheet" style="max-height:85vh;display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;padding:14px 20px 8px;gap:8px">
          <span>🏅</span><p style="font-weight:700;color:var(--color-text);margin:0">Perfiles con insignias</p>
        </div>
        <hr style="border:none;border-top:1px solid var(--glass-border);margin:0" />
        <div id="adm-ins-lista" style="overflow-y:auto;padding:12px 16px 24px;flex:1"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => overlay.remove(), 200);
      }
    });

    const zona = overlay.querySelector('#adm-ins-lista');
    zona.addEventListener('scroll', () => {
      if (zona.scrollTop + zona.clientHeight >= zona.scrollHeight - 150) cargarMas();
    });

    async function cargarMas() {
      if (cargandoMasIns || !hayMasIns) return;
      cargandoMasIns = true;
      renderIns();
      const { data, error } = await supabaseClient
        .from('insignias')
        .select('id, tipo, otorgada_en, perfiles!insignias_perfil_id_fkey ( id, nombre, nombre_usuario, cdn_foto_perfil )')
        .order('otorgada_en', { ascending: false })
        .range(offsetIns, offsetIns + TAMANO_PAGINA - 1);
      if (!error) {
        datos = [...datos, ...data];
        offsetIns += data.length;
        hayMasIns = data.length === TAMANO_PAGINA;
      }
      cargandoMasIns = false;
      renderIns();
    }

    function renderIns() {
      if (cargandoIns) {
        zona.innerHTML = `<div class="adm-lista-cargando"><span class="chats-spinner"></span></div>`;
        return;
      }
      if (datos.length === 0) {
        zona.innerHTML = plantillaEmptyAdmin({ mensaje: 'Sin insignias asignadas', icono: '🏅' });
        return;
      }
      zona.innerHTML =
        datos
          .map((ins) => {
            const p = ins.perfiles;
            return `
            <div class="adm-item" style="cursor:default" data-insignia-id="${ins.id}">
              <span class="adm-item__avatar">${p?.cdn_foto_perfil ? `<img src="${p.cdn_foto_perfil}" alt="" />` : '👤'}</span>
              <div class="adm-item__cuerpo">
                <p class="adm-item__nombre">${escapar(p?.nombre || '')}</p>
                <p class="adm-item__sub">@${escapar(p?.nombre_usuario || '')}</p>
                <span class="adm-badge" style="background:rgba(0,122,255,0.1);color:#007AFF;margin-top:4px;display:inline-block">${escapar(ins.tipo)}</span>
              </div>
              <button class="adm-item__menu" data-quitar-ins style="color:#ff453a">✕</button>
            </div>`;
          })
          .join('') + (cargandoMasIns ? `<div class="adm-lista-cargando-mas"><span class="chats-spinner"></span></div>` : '');

      zona.querySelectorAll('[data-quitar-ins]').forEach((btn, i) => {
        btn.addEventListener('click', async () => {
          const ins = datos[i];
          const ok = await mostrarConfirmacionAdmin({ titulo: '¿Quitar insignia?', mensaje: `Se quitará "${ins.tipo}" a ${ins.perfiles?.nombre}.`, textoConfirmar: 'Quitar', color: '#ff453a' });
          if (!ok) return;
          try {
            const { error } = await supabaseClient.from('insignias').delete().eq('id', ins.id);
            if (error) throw error;
            datos.splice(i, 1);
            renderIns();
            mostrarToast(`Insignia "${ins.tipo}" quitada`, 'success');
          } catch (e) {
            mostrarToast(`Error: ${e.message}`, 'error');
          }
        });
      });
    }

    cargandoIns = true;
    renderIns();
    const { data, error } = await supabaseClient
      .from('insignias')
      .select('id, tipo, otorgada_en, perfiles!insignias_perfil_id_fkey ( id, nombre, nombre_usuario, cdn_foto_perfil )')
      .order('otorgada_en', { ascending: false })
      .range(0, TAMANO_PAGINA - 1);
    if (!error) {
      datos = data;
      offsetIns = data.length;
      hayMasIns = data.length === TAMANO_PAGINA;
    }
    cargandoIns = false;
    renderIns();
  }

  function colorEstado(e) {
    return e === 'suspendido' ? '#FFCC00' : e === 'expulsado' ? '#B71C1C' : '#34C759';
  }
  function labelEstado(e) {
    return e === 'suspendido' ? 'Suspendido' : e === 'expulsado' ? 'Expulsado' : 'Activo';
  }

  buscar('');
}