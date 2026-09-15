// js/features/marketplace/mi-negocio-publico.js
//
// Perfil público de un negocio: header, botón de calificar, tabs de
// Publicaciones/Opiniones. Equivalente web de
// MarketplaceMiNegocioPublico.dart.
//
// render(contenedor, emprendedorId) — si emprendedorId es null/undefined,
// se resuelve el emprendedor del usuario autenticado actual (mismo
// fallback que el Dart cuando widget.emprendedorId es null: "es tu
// propio negocio visto en modo público").
//
// RUTA: en el Dart esta pantalla es un Navigator.push (empuja encima
// de lo que hubiera). Acá se registra como ruta real ('/negocio') al
// final de este archivo — el router (core/router.js) solo usa el
// PRIMER segmento del hash como ruta y pasa el resto como parámetros
// posicionales (mismo patrón que editar-perfil.js con '/perfil' y
// plantel.js con '/plantel'), así que '#/negocio/<id>' resuelve a
// esta ruta con emprendedorId como único parámetro. El botón "‹"
// navega directo a '/home' en vez de disparar un evento para que "el
// padre decida" — no hay padre: esta pantalla siempre se abre como
// ruta de nivel superior, nunca embebida.
//
// MD5: el navegador no tiene MD5 nativo (Web Crypto solo expone
// SHA-*), así que se incluye una implementación mínima embebida
// (md5Hex) — mismo propósito que el paquete `crypto` en el Dart
// original: generar un conversacion_id determinístico para la
// columna NOT NULL sin FK de marketplace_valoraciones.

import { supabaseClient } from '../../core/supabase-client.js';
import { mostrarToast } from '../../core/toast.js';
import { navegarA, registrarRuta } from '../../core/router.js';
import { abrirHojaInferior } from '../../core/bottom-sheet.js';

const ACCENT = '#3390EC';

let raizPanel = null;
let cargando = true;
let emprendedor = null;
let publicaciones = [];
let valoraciones = [];
let miValoracion = null;
let tabActiva = 'publicaciones';
let uidActual = null;
let emprendedorIdParam = null;

export async function render(contenedor, emprendedorId) {
  raizPanel = contenedor;
  emprendedorIdParam = emprendedorId ?? null;
  tabActiva = 'publicaciones';
  await cargarDatos();
}

function esMiPropioNegocio() {
  return !!uidActual && !!emprendedor?.perfil_id && uidActual === emprendedor.perfil_id;
}

async function cargarDatos() {
  cargando = true;
  renderTodo();

  const { data: userData } = await supabaseClient.auth.getUser();
  uidActual = userData?.user?.id ?? null;

  try {
    let id = emprendedorIdParam;

    if (!id) {
      if (!uidActual) {
        cargando = false;
        emprendedor = null;
        renderTodo();
        return;
      }
      const { data: res } = await supabaseClient
        .from('emprendedores')
        .select('id')
        .eq('perfil_id', uidActual)
        .maybeSingle();

      id = res?.id ?? null;
      if (!id) {
        cargando = false;
        emprendedor = null;
        renderTodo();
        return;
      }
    }

    await Promise.all([
      cargarEmprendedor(id),
      cargarPublicaciones(id),
      cargarValoraciones(id),
      cargarMiValoracion(id),
    ]);
  } catch (e) {
    console.error('mi-negocio-publico – error cargando datos:', e);
    mostrarToast('No se pudo cargar el negocio', 'error');
  } finally {
    cargando = false;
    renderTodo();
  }
}

async function cargarEmprendedor(id) {
  const { data, error } = await supabaseClient
    .from('emprendedores')
    .select(`
      id, perfil_id, nombre_negocio, descripcion, estado,
      calificacion_promedio, total_valoraciones,
      total_contactos, total_visualizaciones, creado_en,
      perfiles ( nombre, nombre_usuario, cdn_foto_perfil, carrera )
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  emprendedor = data;
}

async function cargarPublicaciones(emprendedorId) {
  const { data, error } = await supabaseClient
    .from('marketplace_publicaciones')
    .select(`
      id, titulo, precio, tipo, creado_en, expira_en, esta_activa,
      marketplace_categorias ( nombre, emoji ),
      marketplace_imagenes   ( r2_url, orden )
    `)
    .eq('emprendedor_id', emprendedorId)
    .eq('esta_activa', true)
    .gt('expira_en', new Date().toISOString())
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('mi-negocio-publico – error cargando publicaciones:', error);
    publicaciones = [];
    return;
  }
  publicaciones = data ?? [];
}

async function cargarValoraciones(emprendedorId) {
  const { data, error } = await supabaseClient
    .from('marketplace_valoraciones')
    .select(`
      id, promedio, comentario, creado_en,
      atencion, amabilidad, rapidez, cumplimiento, experiencia,
      perfiles:autor_id ( nombre, nombre_usuario, cdn_foto_perfil )
    `)
    .eq('emprendedor_id', emprendedorId)
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('mi-negocio-publico – error cargando valoraciones:', error);
    valoraciones = [];
    return;
  }
  valoraciones = data ?? [];
}

async function cargarMiValoracion(emprendedorId) {
  if (!uidActual) {
    miValoracion = null;
    return;
  }
  const { data } = await supabaseClient
    .from('marketplace_valoraciones')
    .select('id, atencion, amabilidad, rapidez, cumplimiento, experiencia, comentario')
    .eq('emprendedor_id', emprendedorId)
    .eq('autor_id', uidActual)
    .maybeSingle();
  miValoracion = data ?? null;
}

// ── MD5 → pseudo-conversacion_id ─────────────────────────────────
function idConversacionPseudo(usuarioA, usuarioB) {
  const par = [usuarioA, usuarioB].sort().join(':');
  const hex = md5Hex(par);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function recalcularPromedioEmprendedor(emprendedorId) {
  const { data, error } = await supabaseClient
    .from('marketplace_valoraciones')
    .select('promedio')
    .eq('emprendedor_id', emprendedorId);

  if (error) throw error;
  const lista = data ?? [];
  const total = lista.length;
  const promedioGeneral = total === 0 ? 0 : lista.reduce((acc, v) => acc + Number(v.promedio), 0) / total;

  const { error: errorUpdate } = await supabaseClient
    .from('emprendedores')
    .update({ calificacion_promedio: promedioGeneral, total_valoraciones: total })
    .eq('id', emprendedorId);
  if (errorUpdate) throw errorUpdate;
}

async function guardarValoracion({ atencion, amabilidad, rapidez, cumplimiento, experiencia, comentario }) {
  if (!uidActual || !emprendedor) return;

  const emprendedorId = emprendedor.id;
  const promedio = (atencion + amabilidad + rapidez + cumplimiento + experiencia) / 5;

  if (miValoracion) {
    const { error } = await supabaseClient
      .from('marketplace_valoraciones')
      .update({ atencion, amabilidad, rapidez, cumplimiento, experiencia, promedio, comentario })
      .eq('id', miValoracion.id);
    if (error) throw error;
  } else {
    const { error } = await supabaseClient.from('marketplace_valoraciones').insert({
      emprendedor_id: emprendedorId,
      autor_id: uidActual,
      conversacion_id: idConversacionPseudo(uidActual, emprendedorId),
      atencion,
      amabilidad,
      rapidez,
      cumplimiento,
      experiencia,
      promedio,
      comentario,
    });
    if (error) throw error;
  }

  await recalcularPromedioEmprendedor(emprendedorId);
  await Promise.all([cargarEmprendedor(emprendedorId), cargarValoraciones(emprendedorId), cargarMiValoracion(emprendedorId)]);
}

// ── Render principal ─────────────────────────────────────────────
function renderTodo() {
  if (!raizPanel) return;

  if (cargando) {
    raizPanel.innerHTML = `<div class="mkt-spinner"></div>`;
    return;
  }

  if (!emprendedor) {
    raizPanel.innerHTML = plantillaSinPerfil();
    activarVolverSinPerfil();
    return;
  }

  const mostrarBotonCalificar = !!emprendedorIdParam && !esMiPropioNegocio();

  raizPanel.innerHTML = `
    <div class="mkt-negpub">
      <header class="mkt-negpub__header-nav">
        <button class="mkt-negpub__volver" data-negpub-volver aria-label="Volver">‹</button>
        <h2 class="mkt-negpub__titulo-nav">${escapar(emprendedor.nombre_negocio ?? 'Negocio')}</h2>
      </header>

      ${plantillaHeaderNegocio()}

      ${
        mostrarBotonCalificar
          ? `<div class="mkt-negpub__calificar-zona">
               <button class="mkt-negpub__calificar-btn" data-negpub-calificar>
                 ${miValoracion ? '✏️ Editar mi opinión' : '⭐ Calificar este negocio'}
               </button>
             </div>`
          : ''
      }

      <div class="mkt-negpub__tabs">
        <button class="mkt-negpub__tab${tabActiva === 'publicaciones' ? ' activa' : ''}" data-negpub-tab="publicaciones">
          Publicaciones (${publicaciones.length})
        </button>
        <button class="mkt-negpub__tab${tabActiva === 'opiniones' ? ' activa' : ''}" data-negpub-tab="opiniones">
          Opiniones (${emprendedor.total_valoraciones ?? valoraciones.length})
        </button>
      </div>

      <div class="mkt-negpub__contenido">
        ${tabActiva === 'publicaciones' ? plantillaTabPublicaciones() : plantillaTabOpiniones()}
      </div>
    </div>
  `;

  activarInteracciones();
}

function plantillaSinPerfil() {
  return `
    <div class="mkt-negpub">
      <header class="mkt-negpub__header-nav">
        <button class="mkt-negpub__volver" data-negpub-volver aria-label="Volver">‹</button>
        <h2 class="mkt-negpub__titulo-nav">Negocio</h2>
      </header>
      <div class="mkt-negpub__vacio">
        <div class="mkt-negpub__vacio-icono">🏪</div>
        <p class="mkt-negpub__vacio-titulo">Aún no tienes perfil de emprendedor</p>
        <p class="mkt-negpub__vacio-subtitulo">Ve a la pestaña "Publicar" para solicitar tu verificación.</p>
      </div>
    </div>
  `;
}

// El header propio del estado "sin perfil" también necesita su
// botón "‹" activado por separado, ya que renderTodo() retorna antes
// de llegar a activarInteracciones() en ese caso.
function activarVolverSinPerfil() {
  raizPanel.querySelector('[data-negpub-volver]')?.addEventListener('click', () => navegarA('/home'));
}

function plantillaHeaderNegocio() {
  const perfil = emprendedor.perfiles ?? null;
  const foto = perfil?.cdn_foto_perfil ?? null;
  const nombreUsuario = perfil?.nombre_usuario ?? '';
  const carrera = perfil?.carrera ?? null;
  const verificado = emprendedor.estado === 'verificado';
  const calificacion = Number(emprendedor.calificacion_promedio ?? 0);
  const totalVal = emprendedor.total_valoraciones ?? 0;

  return `
    <div class="mkt-negpub__header">
      <div class="mkt-negpub__avatar-zona">
        <div class="mkt-negpub__avatar">
          ${foto ? `<img src="${foto}" alt="" />` : `<span>🏪</span>`}
        </div>
        ${verificado ? `<span class="mkt-negpub__medalla">🏅</span>` : ''}
      </div>

      <h1 class="mkt-negpub__nombre">${escapar(emprendedor.nombre_negocio ?? 'Negocio')}</h1>
      <p class="mkt-negpub__usuario">${carrera ? `@${escapar(nombreUsuario)} · ${escapar(carrera)}` : `@${escapar(nombreUsuario)}`}</p>

      ${
        verificado
          ? `<span class="mkt-negpub__badge-verificado">🏅 Emprendedor Verificado</span>`
          : ''
      }

      <div class="mkt-negpub__estrellas">
        ${plantillaEstrellas(calificacion, 22)}
        <span class="mkt-negpub__estrellas-texto">
          ${
            calificacion > 0
              ? `${calificacion.toFixed(1)} (${totalVal} ${totalVal === 1 ? 'opinión' : 'opiniones'})`
              : 'Sin calificaciones aún'
          }
        </span>
      </div>

      ${
        emprendedor.descripcion
          ? `<div class="mkt-negpub__descripcion">${escapar(emprendedor.descripcion)}</div>`
          : ''
      }
    </div>
  `;
}

function plantillaEstrellas(valor, tamanoPx = 16) {
  let html = '';
  for (let i = 0; i < 5; i++) {
    const llena = i < Math.floor(valor);
    const mitad = !llena && i < valor;
    const icono = llena ? '★' : mitad ? '⯨' : '☆';
    html += `<span style="font-size:${tamanoPx}px;color:#F5A623">${icono}</span>`;
  }
  return html;
}

function plantillaTabPublicaciones() {
  if (publicaciones.length === 0) {
    return plantillaVacioTab('🏪', 'Sin publicaciones activas');
  }
  return `<div class="mkt-negpub__pub-lista">${publicaciones.map(plantillaMiniCardPublicacion).join('')}</div>`;
}

function plantillaMiniCardPublicacion(pub) {
  const categoria = pub.marketplace_categorias ?? null;
  const imagenes = [...(pub.marketplace_imagenes ?? [])].sort((a, b) => a.orden - b.orden);
  const primeraImagen = imagenes[0]?.r2_url ?? null;
  const precio = pub.precio != null ? `$${Number(pub.precio).toFixed(2)}` : '';
  const tExp = tiempoExpira(pub.expira_en);
  const claseExp = claseExpiracion(pub.expira_en);

  return `
    <article class="mkt-negpub-mini">
      <div class="mkt-negpub-mini__imagen">
        ${primeraImagen ? `<img src="${primeraImagen}" alt="" />` : `<span>🖼️</span>`}
      </div>
      <div class="mkt-negpub-mini__info">
        <div class="mkt-negpub-mini__pills">
          ${categoria ? `<span class="mkt-negpub-mini__categoria">${categoria.emoji} ${escapar(categoria.nombre)}</span>` : '<span></span>'}
          <span class="mkt-pill mkt-pill--tipo-${pub.tipo}">${pub.tipo === 'producto' ? 'Producto' : 'Servicio'}</span>
        </div>
        <h4 class="mkt-negpub-mini__titulo">${escapar(pub.titulo)}</h4>
        <div class="mkt-negpub-mini__pie">
          ${precio ? `<span class="mkt-negpub-mini__precio">${precio}</span>` : '<span></span>'}
          <span class="mkt-expira mkt-expira--${claseExp}">⏳ ${tExp}</span>
        </div>
      </div>
    </article>
  `;
}

function plantillaTabOpiniones() {
  if (valoraciones.length === 0) {
    return plantillaVacioTab('⭐', 'Sin opiniones aún');
  }
  return `<div class="mkt-negpub__val-lista">${valoraciones.map(plantillaCardValoracion).join('')}</div>`;
}

function plantillaCardValoracion(val) {
  const autor = val.perfiles ?? null;
  const nombreAutor = autor?.nombre ?? 'Usuario';
  const foto = autor?.cdn_foto_perfil ?? null;
  const promedio = Number(val.promedio ?? 0);
  const comentario = val.comentario ?? null;

  const criterios = [
    ['Atención', val.atencion ?? 0],
    ['Amabilidad', val.amabilidad ?? 0],
    ['Rapidez', val.rapidez ?? 0],
    ['Cumplimiento', val.cumplimiento ?? 0],
    ['Experiencia', val.experiencia ?? 0],
  ];

  return `
    <div class="mkt-val-card">
      <div class="mkt-val-card__cabecera">
        <div class="mkt-val-card__avatar">
          ${foto ? `<img src="${foto}" alt="" />` : `<span>👤</span>`}
        </div>
        <div class="mkt-val-card__quien">
          <p class="mkt-val-card__nombre">${escapar(nombreAutor)}</p>
          <p class="mkt-val-card__fecha">${formatearTiempoRelativo(val.creado_en)}</p>
        </div>
        <span class="mkt-val-card__promedio">⭐ ${promedio.toFixed(1)}</span>
      </div>
      <div class="mkt-val-card__criterios">
        ${criterios
          .map(
            ([label, valor]) => `
          <div class="mkt-val-card__criterio">
            <span class="mkt-val-card__criterio-label">${label}</span>
            <span class="mkt-val-card__criterio-estrellas">${plantillaEstrellas(valor, 13)}</span>
          </div>
        `
          )
          .join('')}
      </div>
      ${comentario ? `<div class="mkt-val-card__comentario">"${escapar(comentario)}"</div>` : ''}
    </div>
  `;
}

function plantillaVacioTab(icono, mensaje) {
  return `
    <div class="mkt-negpub__vacio-tab">
      <div class="mkt-negpub__vacio-tab-icono">${icono}</div>
      <p class="mkt-negpub__vacio-tab-texto">${mensaje}</p>
    </div>
  `;
}

// ── Interacciones ─────────────────────────────────────────────────
function activarInteracciones() {
  raizPanel.querySelector('[data-negpub-volver]')?.addEventListener('click', () => navegarA('/home'));

  raizPanel.querySelectorAll('[data-negpub-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      tabActiva = btn.dataset.negpubTab;
      renderTodo();
    });
  });

  raizPanel.querySelector('[data-negpub-calificar]')?.addEventListener('click', abrirHojaCalificar);
}

function abrirHojaCalificar() {
  const { cuerpo, cerrar } = abrirHojaInferior({ initialChildSize: 0.75, maxChildSize: 0.95 });
  renderHojaCalificar(cuerpo, cerrar);
}

function renderHojaCalificar(cuerpo, cerrar) {
  const editando = !!miValoracion;
  const criterios = [
    { clave: 'atencion', label: 'Atención' },
    { clave: 'amabilidad', label: 'Amabilidad' },
    { clave: 'rapidez', label: 'Rapidez' },
    { clave: 'cumplimiento', label: 'Cumplimiento' },
    { clave: 'experiencia', label: 'Experiencia' },
  ];

  const valores = {};
  criterios.forEach((c) => {
    valores[c.clave] = miValoracion?.[c.clave] ?? 0;
  });

  cuerpo.innerHTML = `
    <div class="mkt-calificar">
      <h3 class="mkt-calificar__titulo">${editando ? 'Editar tu opinión' : `Calificar a ${escapar(emprendedor.nombre_negocio)}`}</h3>
      <p class="mkt-calificar__subtitulo">Tu opinión ayuda a otros estudiantes a decidir.</p>

      <div class="mkt-calificar__criterios" data-calificar-criterios>
        ${criterios
          .map(
            (c) => `
          <div class="mkt-calificar__fila" data-calificar-fila="${c.clave}">
            <span class="mkt-calificar__label">${c.label}</span>
            <span class="mkt-calificar__estrellas" data-calificar-estrellas="${c.clave}">
              ${estrellasInteractivas(valores[c.clave], c.clave)}
            </span>
          </div>
        `
          )
          .join('')}
      </div>

      <textarea class="mkt-calificar__comentario" maxlength="300" rows="3" placeholder="Cuéntanos cómo te fue (opcional)" data-calificar-comentario>${escapar(miValoracion?.comentario ?? '')}</textarea>

      <button class="mkt-calificar__confirmar" data-calificar-confirmar disabled>
        <span data-calificar-confirmar-texto>${editando ? 'Guardar cambios' : 'Publicar opinión'}</span>
      </button>
    </div>
  `;

  function estrellasInteractivas(valorActual, clave) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
      html += `<button type="button" class="mkt-calificar__estrella${i <= valorActual ? ' activa' : ''}" data-calificar-estrella="${clave}" data-calificar-valor="${i}">★</button>`;
    }
    return html;
  }

  function actualizarBotonConfirmar() {
    const completa = criterios.every((c) => valores[c.clave] > 0);
    cuerpo.querySelector('[data-calificar-confirmar]').disabled = !completa;
  }

  cuerpo.querySelectorAll('[data-calificar-estrella]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const clave = btn.dataset.calificarEstrella;
      const valor = Number(btn.dataset.calificarValor);
      valores[clave] = valor;

      const zona = cuerpo.querySelector(`[data-calificar-estrellas="${clave}"]`);
      zona.innerHTML = estrellasInteractivas(valor, clave);
      // Re-adjuntar listeners de esta fila, ya que se reescribió su innerHTML.
      zona.querySelectorAll('[data-calificar-estrella]').forEach((b2) => {
        b2.addEventListener('click', () => {
          valores[clave] = Number(b2.dataset.calificarValor);
          zona.innerHTML = estrellasInteractivas(valores[clave], clave);
          activarFila(clave);
          actualizarBotonConfirmar();
        });
      });
      actualizarBotonConfirmar();
    });
  });

  function activarFila(clave) {
    const zona = cuerpo.querySelector(`[data-calificar-estrellas="${clave}"]`);
    zona.querySelectorAll('[data-calificar-estrella]').forEach((b2) => {
      b2.addEventListener('click', () => {
        valores[clave] = Number(b2.dataset.calificarValor);
        zona.innerHTML = estrellasInteractivas(valores[clave], clave);
        activarFila(clave);
        actualizarBotonConfirmar();
      });
    });
  }

  actualizarBotonConfirmar();

  const botonConfirmar = cuerpo.querySelector('[data-calificar-confirmar]');
  const textoConfirmar = cuerpo.querySelector('[data-calificar-confirmar-texto]');
  const inputComentario = cuerpo.querySelector('[data-calificar-comentario]');

  let guardando = false;
  botonConfirmar.addEventListener('click', async () => {
    if (guardando || botonConfirmar.disabled) return;
    guardando = true;
    botonConfirmar.disabled = true;
    textoConfirmar.textContent = 'Guardando...';

    try {
      await guardarValoracion({
        atencion: valores.atencion,
        amabilidad: valores.amabilidad,
        rapidez: valores.rapidez,
        cumplimiento: valores.cumplimiento,
        experiencia: valores.experiencia,
        comentario: inputComentario.value.trim() || null,
      });
      cerrar();
      tabActiva = 'opiniones';
      renderTodo();
    } catch (e) {
      console.error('mi-negocio-publico – error al guardar valoración:', e);
      mostrarToast(`No se pudo guardar tu opinión: ${e.message ?? e}`, 'error');
      guardando = false;
      botonConfirmar.disabled = false;
      textoConfirmar.textContent = editando ? 'Guardar cambios' : 'Publicar opinión';
    }
  });
}

// ── Helpers de tiempo ─────────────────────────────────────────────
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

// Equivalente simplificado de timeago (locale 'es'). No se asumió
// ninguna librería de timeago disponible en el proyecto web; si ya
// tienes una integrada en otro módulo, dime y la reutilizo en vez de
// esta implementación local.
function formatearTiempoRelativo(fechaIso) {
  if (!fechaIso) return '';
  const diffMs = Date.now() - new Date(fechaIso).getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return 'justo ahora';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `hace ${dias} d`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  const anios = Math.floor(meses / 12);
  return `hace ${anios} ${anios === 1 ? 'año' : 'años'}`;
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// ═════════════════════════════════════════════════════════════════
// MD5 — implementación mínima en JS puro (dominio público, variante
// compacta del algoritmo estándar de RFC 1321). Único propósito aquí:
// generar el mismo tipo de digest de 16 bytes que crypto.md5 en Dart,
// usado solo para derivar el conversacion_id pseudo-determinístico —
// NO se usa con fines criptográficos.
// ═════════════════════════════════════════════════════════════════
function md5Hex(str) {
  function rotl(x, c) {
    return (x << c) | (x >>> (32 - c));
  }
  function toHex(num) {
    let s = '';
    for (let i = 0; i < 4; i++) {
      s += ((num >> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    }
    return s;
  }

  const K = new Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32);

  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];

  const bytes = new TextEncoder().encode(str);
  const bitLen = bytes.length * 8;

  const withOne = [...bytes, 0x80];
  while (withOne.length % 64 !== 56) withOne.push(0);
  for (let i = 0; i < 8; i++) withOne.push((bitLen / 2 ** (8 * i)) & 0xff);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  for (let chunkStart = 0; chunkStart < withOne.length; chunkStart += 64) {
    const M = new Array(16);
    for (let i = 0; i < 16; i++) {
      M[i] =
        withOne[chunkStart + i * 4] |
        (withOne[chunkStart + i * 4 + 1] << 8) |
        (withOne[chunkStart + i * 4 + 2] << 16) |
        (withOne[chunkStart + i * 4 + 3] << 24);
    }

    let A = a0, B = b0, C = c0, D = d0;

    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i] + M[g]) | 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl(F, S[i])) | 0;
    }

    a0 = (a0 + A) | 0;
    b0 = (b0 + B) | 0;
    c0 = (c0 + C) | 0;
    d0 = (d0 + D) | 0;
  }

  return [a0, b0, c0, d0].map(toHex).join('');
}

registrarRuta('/negocio', render);