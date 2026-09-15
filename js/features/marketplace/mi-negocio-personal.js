// js/features/marketplace/mi-negocio-personal.js
//
// Panel privado del emprendedor: estado de verificación,
// estadísticas y sus publicaciones activas con editar/eliminar.
// Equivalente web de MarketplaceMiNegocioPersonal.dart.
//
// render(contenedor, onIrAPublicar) — onIrAPublicar() es llamado al
// tocar "Crear publicación"/"Nueva" cuando NO hay publicaciones o
// desde el header de la lista; si no se provee, se dispara un evento
// custom 'mkt-ir-a-publicar' (bubbles) para que marketplace-screen.js
// decida cambiar a la tab "Publicar" — mismo fallback por
// Navigator.push que usaba el Dart si no le pasaban el callback.
//
// EDITAR PERFIL / EDITAR PUBLICACIÓN: ambas pantallas eran rutas
// completas en Dart; aquí se abren dentro de una hoja inferior
// (bottom-sheet.js) para no necesitar un sistema de rutas propio del
// Marketplace. Ver la nota de navegación en cada uno de esos
// archivos.

import { supabaseClient } from '../../core/supabase-client.js';
import { mostrarToast } from '../../core/toast.js';
import { storageService } from '../../core/storage-service.js';
import { R2_CONFIG } from '../../core/r2-config.js';
import { abrirHojaInferior } from '../../core/bottom-sheet.js';
import { render as renderEditarPerfil } from './marketplace-editar-perfil.js';
import { render as renderEditarPublicacion } from './marketplace-editar-publicacion.js';

const ACCENT = '#3390EC';

let raizPanel = null;
let emprendedor = null;
let publicaciones = [];
let cargando = true;
let onIrAPublicarCb = null;

export async function render(contenedor, onIrAPublicar) {
  raizPanel = contenedor;
  onIrAPublicarCb = onIrAPublicar ?? null;
  await cargarDatos();
}

function irAPublicar() {
  if (onIrAPublicarCb) {
    onIrAPublicarCb();
    return;
  }
  raizPanel?.dispatchEvent(new CustomEvent('mkt-ir-a-publicar', { bubbles: true }));
}

async function cargarDatos() {
  cargando = true;
  renderTodo();

  const { data: userData } = await supabaseClient.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) {
    cargando = false;
    emprendedor = null;
    renderTodo();
    return;
  }

  try {
    const { data: empRes, error } = await supabaseClient
      .from('emprendedores')
      .select(`
        id, nombre_negocio, descripcion, estado,
        calificacion_promedio, total_valoraciones,
        total_contactos, total_visualizaciones, creado_en,
        perfiles ( nombre, cdn_foto_perfil, carrera )
      `)
      .eq('perfil_id', uid)
      .maybeSingle();

    if (error) throw error;
    emprendedor = empRes;

    if (empRes) {
      await cargarPublicaciones(empRes.id);
    } else {
      publicaciones = [];
    }
  } catch (e) {
    console.error('marketplace-mi-negocio-personal – error cargando datos:', e);
    mostrarToast('No se pudo cargar tu negocio', 'error');
  } finally {
    cargando = false;
    renderTodo();
  }
}

async function cargarPublicaciones(emprendedorId) {
  const { data, error } = await supabaseClient
    .from('marketplace_publicaciones')
    .select(`
      id, titulo, descripcion, precio, tipo,
      emprendedor_id, categoria_id,
      creado_en, expira_en, esta_activa,
      total_visualizaciones, total_contactos,
      marketplace_categorias ( nombre, emoji ),
      marketplace_imagenes   ( id, r2_url, r2_path, orden )
    `)
    .eq('emprendedor_id', emprendedorId)
    .eq('esta_activa', true)
    .gt('expira_en', new Date().toISOString())
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('marketplace-mi-negocio-personal – error cargando publicaciones:', error);
    publicaciones = [];
    return;
  }
  publicaciones = data ?? [];
}

// ── Render principal ─────────────────────────────────────────────
function renderTodo() {
  if (!raizPanel) return;

  if (cargando) {
    raizPanel.innerHTML = `<div class="mkt-spinner"></div>`;
    return;
  }

  raizPanel.innerHTML = `
    <div class="mkt-negocio">
      ${emprendedor ? plantillaHeader(emprendedor) : ''}
      ${plantillaVerificacion(emprendedor)}
      ${emprendedor ? plantillaEstadisticas(emprendedor, publicaciones.length) : ''}
      ${emprendedor?.estado === 'verificado' ? plantillaSeccionPublicaciones() : ''}
    </div>
  `;

  activarInteracciones();
}

// ── Header (foto + nombre + descripción + editar perfil) ────────
function plantillaHeader(emp) {
  const perfil = emp.perfiles ?? null;
  const foto = perfil?.cdn_foto_perfil ?? null;
  const carrera = perfil?.carrera ?? null;
  const verificado = emp.estado === 'verificado';

  return `
    <div class="mkt-negocio__header">
      <div class="mkt-negocio__avatar-zona">
        <div class="mkt-negocio__avatar">
          ${foto ? `<img src="${foto}" alt="" />` : `<span>🏪</span>`}
        </div>
        ${verificado ? `<span class="mkt-negocio__medalla">🏅</span>` : ''}
      </div>

      <h2 class="mkt-negocio__nombre">${escapar(emp.nombre_negocio ?? 'Mi negocio')}</h2>
      ${carrera ? `<p class="mkt-negocio__carrera">${escapar(carrera)}</p>` : ''}

      ${
        emp.descripcion
          ? `<div class="mkt-negocio__descripcion">${escapar(emp.descripcion)}</div>`
          : ''
      }

      <button class="mkt-negocio__editar-perfil" data-negocio-editar-perfil>
        ✏️ Editar perfil
      </button>
    </div>
  `;
}

// ── Banner de estado de verificación ─────────────────────────────
function plantillaVerificacion(emp) {
  if (!emp) {
    return bannerEstado({
      claseColor: 'gris',
      emoji: '🏪',
      titulo: 'Aún no eres emprendedor',
      mensaje: 'Ve a "Publicar" para solicitar tu verificación y comenzar a vender.',
    });
  }

  const estado = emp.estado;

  if (estado === 'verificado') {
    return bannerEstado({
      claseColor: 'accent',
      emoji: '🏅',
      titulo: 'Emprendedor Verificado',
      mensaje: 'Tu negocio está activo en el Marketplace del ITVH.',
    });
  }
  if (estado === 'pendiente') {
    return bannerEstado({
      claseColor: 'naranja',
      emoji: '⏳',
      titulo: 'Verificación en revisión',
      mensaje: 'Tu solicitud está siendo revisada. La respuesta puede tomar 1-2 días hábiles.',
    });
  }
  if (estado === 'suspendido') {
    return bannerEstado({
      claseColor: 'rojo',
      emoji: '🚫',
      titulo: 'Cuenta suspendida',
      mensaje: 'Tu cuenta de emprendedor ha sido suspendida. Contacta al administrador.',
    });
  }
  return '';
}

function bannerEstado({ claseColor, emoji, titulo, mensaje }) {
  return `
    <div class="mkt-banner mkt-banner--${claseColor}">
      <div class="mkt-banner__icono">${emoji}</div>
      <div class="mkt-banner__texto">
        <p class="mkt-banner__titulo">${titulo}</p>
        <p class="mkt-banner__mensaje">${mensaje}</p>
      </div>
    </div>
  `;
}

// ── Estadísticas ──────────────────────────────────────────────────
function plantillaEstadisticas(emp, publicacionesActivas) {
  const vistas = emp.total_visualizaciones ?? 0;
  const contactos = emp.total_contactos ?? 0;
  const calificacion = Number(emp.calificacion_promedio ?? 0);
  const valoraciones = emp.total_valoraciones ?? 0;

  const stat = (icono, valor, label, colorVar) => `
    <div class="mkt-stat">
      <div class="mkt-stat__icono" style="background:${colorVar}22;color:${colorVar}">${icono}</div>
      <div class="mkt-stat__texto">
        <p class="mkt-stat__valor">${valor}</p>
        <p class="mkt-stat__label">${label}</p>
      </div>
    </div>
  `;

  return `
    <div class="mkt-negocio__stats">
      <h3 class="mkt-negocio__stats-titulo">Estadísticas</h3>
      <div class="mkt-stats-grid">
        ${stat('👁️', formatearNumero(vistas), 'Visualizaciones', '#3B82F6')}
        ${stat('💬', formatearNumero(contactos), 'Contactos', '#22C55E')}
        ${stat('⭐', calificacion > 0 ? `${calificacion.toFixed(1)} (${valoraciones})` : 'Sin cal.', 'Calificación', '#F59E0B')}
        ${stat('🏪', String(publicacionesActivas), 'Activas', ACCENT)}
      </div>
    </div>
  `;
}

function formatearNumero(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Sección de publicaciones ─────────────────────────────────────
function plantillaSeccionPublicaciones() {
  return `
    <div class="mkt-negocio__pubs-header">
      <h3 class="mkt-negocio__stats-titulo">Mis publicaciones</h3>
      <button class="mkt-negocio__nueva" data-negocio-nueva>➕ Nueva</button>
    </div>
    <div class="mkt-negocio__pubs-lista">
      ${publicaciones.length === 0 ? plantillaVacio() : publicaciones.map(plantillaCardAdmin).join('')}
    </div>
  `;
}

function plantillaVacio() {
  return `
    <div class="mkt-negocio__vacio">
      <div class="mkt-negocio__vacio-icono">🗳️</div>
      <p class="mkt-negocio__vacio-titulo">Aún no tienes publicaciones</p>
      <p class="mkt-negocio__vacio-subtitulo">Crea tu primera publicación y empieza a vender en el Marketplace del ITVH.</p>
      <button class="mkt-negocio__vacio-boton" data-negocio-nueva>🚀 Crear publicación</button>
    </div>
  `;
}

function plantillaCardAdmin(pub) {
  const categoria = pub.marketplace_categorias ?? null;
  const imagenes = [...(pub.marketplace_imagenes ?? [])].sort((a, b) => a.orden - b.orden);
  const primeraImagen = imagenes[0]?.r2_url ?? null;
  const precio = pub.precio != null ? `$${Number(pub.precio).toFixed(2)}` : '';
  const tiempoExp = tiempoExpira(pub.expira_en);
  const claseExp = claseExpiracion(pub.expira_en);

  return `
    <article class="mkt-admin-card" data-pub-id="${pub.id}">
      <div class="mkt-admin-card__fila">
        <div class="mkt-admin-card__imagen">
          ${primeraImagen ? `<img src="${primeraImagen}" alt="" />` : `<span>🖼️</span>`}
        </div>
        <div class="mkt-admin-card__info">
          <div class="mkt-admin-card__pills">
            ${categoria ? `<span class="mkt-admin-card__categoria">${categoria.emoji} ${escapar(categoria.nombre)}</span>` : '<span></span>'}
            <span class="mkt-pill mkt-pill--tipo-${pub.tipo}">${pub.tipo === 'producto' ? 'Producto' : 'Servicio'}</span>
          </div>
          <h4 class="mkt-admin-card__titulo">${escapar(pub.titulo)}</h4>
          <div class="mkt-admin-card__pie">
            ${precio ? `<span class="mkt-admin-card__precio">${precio}</span>` : '<span></span>'}
            <span class="mkt-expira mkt-expira--${claseExp}">⏳ ${tiempoExp}</span>
          </div>
        </div>
      </div>
      <div class="mkt-admin-card__barra">
        <span class="mkt-admin-card__stat">👁️ ${pub.total_visualizaciones ?? 0}</span>
        <span class="mkt-admin-card__stat">💬 ${pub.total_contactos ?? 0}</span>
        <span class="mkt-admin-card__spacer"></span>
        <button class="mkt-admin-card__accion mkt-admin-card__accion--editar" data-pub-editar="${pub.id}">✏️ Editar</button>
        <button class="mkt-admin-card__accion mkt-admin-card__accion--eliminar" data-pub-eliminar="${pub.id}">🗑️ Eliminar</button>
      </div>
    </article>
  `;
}

function tiempoExpira(expiraEn) {
  const diffMs = new Date(expiraEn).getTime() - Date.now();
  if (diffMs <= 0) return 'Expirada';
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 60) return `Expira en ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `Expira en ${horas} h`;
}

function claseExpiracion(expiraEn) {
  const diffMs = new Date(expiraEn).getTime() - Date.now();
  if (diffMs <= 0) return 'vencida';
  if (diffMs < 2 * 60 * 60 * 1000) return 'pronto';
  return 'ok';
}

// ── Interacciones ─────────────────────────────────────────────────
function activarInteracciones() {
  raizPanel.querySelectorAll('[data-negocio-nueva]').forEach((btn) => {
    btn.addEventListener('click', irAPublicar);
  });

  raizPanel.querySelector('[data-negocio-editar-perfil]')?.addEventListener('click', () => {
    abrirHojaEditarPerfil();
  });

  raizPanel.querySelectorAll('[data-pub-editar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pub = publicaciones.find((p) => p.id === btn.dataset.pubEditar);
      if (pub) abrirHojaEditarPublicacion(pub);
    });
  });

  raizPanel.querySelectorAll('[data-pub-eliminar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pub = publicaciones.find((p) => p.id === btn.dataset.pubEliminar);
      if (pub) confirmarEliminar(pub);
    });
  });
}

function abrirHojaEditarPerfil() {
  const { cuerpo, cerrar } = abrirHojaInferior({ initialChildSize: 0.55, maxChildSize: 0.9 });
  renderEditarPerfil(cuerpo, emprendedor, async () => {
    cerrar();
    await cargarDatos();
  });
}

function abrirHojaEditarPublicacion(pub) {
  const { cuerpo, cerrar } = abrirHojaInferior({ initialChildSize: 0.85, maxChildSize: 0.95 });
  renderEditarPublicacion(cuerpo, pub, async () => {
    cerrar();
    await cargarDatos();
  });
}

// ── Eliminar publicación ──────────────────────────────────────────
// TODO: reemplazar este confirm() nativo por el mismo componente de
// diálogo de confirmación que uses en el resto de la app (si ya
// existe uno, por ejemplo en core/), para mantener consistencia
// visual con el resto del sitio en vez de la ventana nativa del
// navegador.
async function confirmarEliminar(pub) {
  const ok = window.confirm(
    `¿Seguro que deseas eliminar "${pub.titulo}"? Esta acción no se puede deshacer.`
  );
  if (!ok) return;

  try {
    const imagenes = pub.marketplace_imagenes ?? [];
    for (const img of imagenes) {
      if (img.r2_path) {
        await storageService.eliminarDeR2({ bucket: R2_CONFIG.bucketMarketplace, path: img.r2_path });
      }
    }

    const { error } = await supabaseClient
      .from('marketplace_publicaciones')
      .delete()
      .eq('id', pub.id);
    if (error) throw error;

    publicaciones = publicaciones.filter((p) => p.id !== pub.id);
    renderTodo();
    mostrarToast('Publicación eliminada', 'exito');
  } catch (e) {
    console.error('marketplace-mi-negocio-personal – error al eliminar:', e);
    mostrarToast(`Error al eliminar: ${e.message ?? e}`, 'error');
  }
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}