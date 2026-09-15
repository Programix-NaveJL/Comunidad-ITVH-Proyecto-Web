// js/features/marketplace/marketplace-publicar.js
//
// Formulario de publicación del Marketplace + flujo de verificación
// de emprendedor. Equivalente web de MarketplacePublicar.dart.
//
// render(contenedor) — se monta una sola vez desde
// marketplace-screen.js, igual que marketplace-inicio.js.

import { supabaseClient } from '../../core/supabase-client.js';
import { mostrarToast } from '../../core/toast.js';
import { storageService } from '../../core/storage-service.js';
import { abrirHojaInferior } from '../../core/bottom-sheet.js';

const LIMITE_PUBLICACIONES = 6;
// Límite real de la columna `precio` (numeric(10,2)) en
// marketplace_publicaciones — 8 dígitos enteros + 2 decimales.
const PRECIO_MAXIMO = 99999999.99;
const REGEX_PRECIO = /^\d{0,8}(\.\d{0,2})?$/;

let raizPanel = null;

// ── Estado del módulo (se resetea en cada render) ────────────────
let cargandoEstado = true;
let estadoEmprendedor = null; // null | 'pendiente' | 'suspendido' | 'verificado'
let emprendedorId = null;
let uidSesion = null;

let categorias = [];
let tipo = 'producto';
let categoriaId = null;
let fotos = []; // [{ file, previewUrl }]
let publicando = false;
let solicitando = false;

export async function render(contenedor) {
  raizPanel = contenedor;
  cargandoEstado = true;
  estadoEmprendedor = null;
  emprendedorId = null;
  categorias = [];
  tipo = 'producto';
  categoriaId = null;
  fotos = [];
  publicando = false;
  solicitando = false;

  renderVista();
  await verificarEstado();
}

// ═════════════════════════════════════════════════════════════════
// Verificación de estado del emprendedor
// ═════════════════════════════════════════════════════════════════
async function verificarEstado() {
  cargandoEstado = true;
  renderVista();

  const { data: { session } } = await supabaseClient.auth.getSession();
  const uid = session?.user?.id;
  uidSesion = uid ?? null;
  if (!uid) {
    cargandoEstado = false;
    renderVista();
    return;
  }

  const { data, error } = await supabaseClient
    .from('emprendedores')
    .select('id, estado')
    .eq('perfil_id', uid)
    .maybeSingle();

  if (error) {
    console.error('marketplace-publicar – error verificando estado:', error);
  }

  estadoEmprendedor = data?.estado ?? null;
  emprendedorId = data?.id ?? null;
  cargandoEstado = false;
  renderVista();

  if (estadoEmprendedor === 'verificado') {
    await cargarCategorias();
  }
}

async function cargarCategorias() {
  const { data, error } = await supabaseClient
    .from('marketplace_categorias')
    .select('id, nombre, emoji')
    .order('nombre');

  if (error) {
    console.error('marketplace-publicar – error cargando categorías:', error);
    return;
  }
  categorias = data ?? [];
  renderVista();
}

// ═════════════════════════════════════════════════════════════════
// Router interno de vistas
// ═════════════════════════════════════════════════════════════════
function renderVista() {
  if (!raizPanel) return;

  if (cargandoEstado) {
    raizPanel.innerHTML = `<div class="mkt-spinner"></div>`;
    return;
  }

  if (estadoEmprendedor === null) {
    raizPanel.innerHTML = plantillaSolicitarVerificacion();
    activarInteraccionesSolicitud();
    return;
  }

  if (estadoEmprendedor === 'pendiente') {
    raizPanel.innerHTML = plantillaEstado({
      icono: '⏳',
      claseColor: 'pendiente',
      titulo: 'Solicitud en revisión',
      mensaje: 'Tu solicitud como Emprendedor Verificado está siendo revisada. Te notificaremos pronto.',
    });
    return;
  }

  if (estadoEmprendedor === 'suspendido') {
    raizPanel.innerHTML = plantillaEstado({
      icono: '🚫',
      claseColor: 'suspendido',
      titulo: 'Cuenta suspendida',
      mensaje: 'Tu cuenta de emprendedor ha sido suspendida. Contacta al administrador para más información.',
    });
    return;
  }

  // 'verificado'
  raizPanel.innerHTML = plantillaFormulario();
  activarInteraccionesFormulario();
}

// ═════════════════════════════════════════════════════════════════
// Pantalla: solicitar verificación
// ═════════════════════════════════════════════════════════════════
function plantillaSolicitarVerificacion() {
  return `
    <form class="mkt-pub-scroll" id="mkt-form-solicitud">
      <div class="mkt-pub-insignia">
        <span>🏅</span>
      </div>

      <h2 class="mkt-pub-titulo-hero">Conviértete en<br>Emprendedor Verificado</h2>
      <p class="mkt-pub-subtitulo-hero">
        Completa tu perfil de negocio para comenzar a publicar en el Marketplace del ITVH.
      </p>

      <div class="mkt-pub-seccion-header">Tu negocio</div>
      <div class="mkt-pub-tarjeta">
        <div class="mkt-pub-fila">
          <label class="mkt-pub-fila__label" for="mkt-nombre-negocio">Nombre</label>
          <input class="mkt-pub-fila__input" id="mkt-nombre-negocio" type="text"
                 maxlength="60" placeholder="Tortas El Jaguar" required />
        </div>
      </div>

      <div class="mkt-pub-seccion-header">Descripción</div>
      <div class="mkt-pub-tarjeta">
        <textarea class="mkt-pub-textarea" id="mkt-desc-negocio" maxlength="300" rows="4"
                  placeholder="¿Qué ofreces? ¿Cuál es tu propuesta de valor?" required></textarea>
      </div>

      <button class="mkt-pub-boton-principal" id="mkt-btn-solicitar" type="submit">
        <span id="mkt-btn-solicitar-texto">Solicitar verificación</span>
      </button>

      <p class="mkt-pub-nota-centro">La revisión puede tomar 1-2 días hábiles</p>
    </form>
  `;
}

function activarInteraccionesSolicitud() {
  const form = raizPanel.querySelector('#mkt-form-solicitud');
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (solicitando) return;

    const nombre = raizPanel.querySelector('#mkt-nombre-negocio').value.trim();
    const descripcion = raizPanel.querySelector('#mkt-desc-negocio').value.trim();
    if (!nombre || !descripcion) {
      mostrarToast('Completa nombre y descripción', 'error');
      return;
    }

    solicitando = true;
    actualizarBotonSolicitar();

    try {
      const { data: { session } } = await supabaseClient.auth.getSession();
      const uid = session?.user?.id;
      const { error } = await supabaseClient.from('emprendedores').insert({
        perfil_id: uid,
        nombre_negocio: nombre,
        descripcion,
        estado: 'pendiente',
      });
      if (error) throw error;

      mostrarToast('¡Solicitud enviada! Te notificaremos cuando seas verificado.', 'exito');
      await verificarEstado();
    } catch (error) {
      console.error('marketplace-publicar – error al solicitar verificación:', error);
      mostrarToast(`Error al enviar solicitud: ${error.message ?? error}`, 'error');
    } finally {
      solicitando = false;
      actualizarBotonSolicitar();
    }
  });
}

function actualizarBotonSolicitar() {
  const boton = raizPanel.querySelector('#mkt-btn-solicitar');
  const texto = raizPanel.querySelector('#mkt-btn-solicitar-texto');
  if (!boton || !texto) return;
  boton.disabled = solicitando;
  texto.textContent = solicitando ? 'Enviando solicitud...' : 'Solicitar verificación';
}

// ═════════════════════════════════════════════════════════════════
// Pantalla: estado (pendiente / suspendido)
// ═════════════════════════════════════════════════════════════════
function plantillaEstado({ icono, claseColor, titulo, mensaje }) {
  return `
    <div class="mkt-pub-estado">
      <div class="mkt-pub-estado__icono mkt-pub-estado__icono--${claseColor}">${icono}</div>
      <h2 class="mkt-pub-estado__titulo">${titulo}</h2>
      <p class="mkt-pub-estado__mensaje">${mensaje}</p>
    </div>
  `;
}

// ═════════════════════════════════════════════════════════════════
// Formulario de publicación
// ═════════════════════════════════════════════════════════════════
function plantillaFormulario() {
  const categoriaSeleccionada = categorias.find((c) => c.id === categoriaId);

  return `
    <form class="mkt-pub-scroll" id="mkt-form-publicar">
      <div class="mkt-pub-aviso mkt-pub-aviso--info">
        <span>ℹ️</span>
        <span>Hasta ${LIMITE_PUBLICACIONES} publicaciones activas al mismo tiempo.</span>
      </div>

      <div class="mkt-pub-seccion-header">Tipo de publicación</div>
      <div class="mkt-pub-segmented" id="mkt-segmented">
        <div class="mkt-pub-segmented__thumb" id="mkt-segmented-thumb"></div>
        <button type="button" class="mkt-pub-segmented__btn${tipo === 'producto' ? ' activo' : ''}" data-tipo="producto">
          📦 Producto
        </button>
        <button type="button" class="mkt-pub-segmented__btn${tipo === 'servicio' ? ' activo' : ''}" data-tipo="servicio">
          🛠️ Servicio
        </button>
      </div>

      <div class="mkt-pub-seccion-header">Detalles</div>
      <div class="mkt-pub-tarjeta">
        <div class="mkt-pub-fila">
          <label class="mkt-pub-fila__label" for="mkt-titulo">Título</label>
          <input class="mkt-pub-fila__input" id="mkt-titulo" type="text"
                 maxlength="80" placeholder="Ej. Tortas de pierna" style="text-align:right" required />
        </div>
        <div class="mkt-pub-divisor"></div>
        <div class="mkt-pub-fila">
          <label class="mkt-pub-fila__label" for="mkt-precio">Precio</label>
          <div class="mkt-pub-precio-wrap">
            <span class="mkt-pub-precio-signo">$</span>
            <input class="mkt-pub-fila__input" id="mkt-precio" type="text" inputmode="decimal"
                   placeholder="0.00" style="text-align:right" />
          </div>
        </div>
        <div class="mkt-pub-divisor"></div>
        <button type="button" class="mkt-pub-fila-accion" id="mkt-btn-categoria">
          <span class="mkt-pub-fila__label">Categoría</span>
          <span class="mkt-pub-fila-accion__valor${categoriaSeleccionada ? '' : ' placeholder'}" id="mkt-categoria-valor">
            ${categoriaSeleccionada ? `${categoriaSeleccionada.emoji} ${categoriaSeleccionada.nombre}` : 'Seleccionar'}
          </span>
          <span class="mkt-pub-fila-accion__chevron">›</span>
        </button>
      </div>

      <div class="mkt-pub-seccion-header">Descripción</div>
      <div class="mkt-pub-tarjeta">
        <textarea class="mkt-pub-textarea" id="mkt-descripcion" maxlength="500" rows="4"
                  placeholder="Describe tu producto o servicio con detalle..."></textarea>
      </div>

      <div class="mkt-pub-seccion-header-fila">
        <span class="mkt-pub-seccion-header">Fotografías</span>
        <span class="mkt-pub-contador" id="mkt-fotos-contador">${fotos.length}/3</span>
      </div>
      <div class="mkt-pub-tarjeta">
        <div class="mkt-pub-fotos" id="mkt-fotos"></div>
        <input type="file" id="mkt-input-foto" accept="image/*" hidden />
      </div>

      <div class="mkt-pub-aviso mkt-pub-aviso--warning">
        <span>🕒</span>
        <span>Tu publicación estará activa por 24 horas y luego se eliminará automáticamente.</span>
      </div>

      <button class="mkt-pub-boton-principal" id="mkt-btn-publicar" type="submit">
        <span id="mkt-btn-publicar-texto">🚀 Publicar</span>
      </button>
    </form>
  `;
}

function activarInteraccionesFormulario() {
  const contenedor = raizPanel;

  // ── Segmented control (tipo) ──────────────────────────────────
  moverSegmentedThumb();
  contenedor.querySelectorAll('[data-tipo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      tipo = btn.dataset.tipo;
      contenedor.querySelectorAll('[data-tipo]').forEach((b) => b.classList.toggle('activo', b.dataset.tipo === tipo));
      moverSegmentedThumb();
    });
  });

  // ── Precio: limitar a numeric(10,2) mientras se escribe ───────
  const precioInput = contenedor.querySelector('#mkt-precio');
  precioInput.addEventListener('input', () => {
    if (!REGEX_PRECIO.test(precioInput.value)) {
      precioInput.value = precioInput.value.slice(0, -1);
    }
  });

  // ── Categoría (bottom sheet) ──────────────────────────────────
  contenedor.querySelector('#mkt-btn-categoria').addEventListener('click', () => {
    abrirSelectorCategoria();
  });

  // ── Fotos ──────────────────────────────────────────────────────
  const inputFoto = contenedor.querySelector('#mkt-input-foto');
  inputFoto.addEventListener('change', () => {
    const archivo = inputFoto.files?.[0];
    inputFoto.value = ''; // permite re-seleccionar el mismo archivo después
    if (!archivo || fotos.length >= 3) return;
    fotos.push({ file: archivo, previewUrl: URL.createObjectURL(archivo) });
    renderFotos();
  });
  renderFotos();

  // ── Submit ───────────────────────────────────────────────────
  contenedor.querySelector('#mkt-form-publicar').addEventListener('submit', (evento) => {
    evento.preventDefault();
    publicar();
  });
}

function moverSegmentedThumb() {
  const thumb = raizPanel.querySelector('#mkt-segmented-thumb');
  if (!thumb) return;
  const indice = tipo === 'producto' ? 0 : 1;
  thumb.style.left = `calc(4px + ${indice} * (50% - 4px))`;
}

// ── Categoría: hoja modal con chips grandes ─────────────────────
function abrirSelectorCategoria() {
  const { cuerpo, cerrar } = abrirHojaInferior({
    initialChildSize: 0.55,
    minChildSize: 0.35,
    maxChildSize: 0.85,
  });

  cuerpo.innerHTML = `
    <div class="mkt-cat-sheet__header">
      <span class="mkt-cat-sheet__titulo">Categoría</span>
      <button type="button" class="mkt-cat-sheet__listo" id="mkt-cat-listo">Listo</button>
    </div>
    <div class="mkt-cat-sheet__chips">
      ${categorias.map((c) => `
        <button type="button" class="mkt-cat-chip${c.id === categoriaId ? ' activo' : ''}" data-cat-id="${c.id}">
          <span>${c.emoji}</span>
          <span>${escapar(c.nombre)}</span>
        </button>
      `).join('')}
    </div>
  `;

  cuerpo.querySelector('#mkt-cat-listo').addEventListener('click', cerrar);
  cuerpo.querySelectorAll('[data-cat-id]').forEach((chip) => {
    chip.addEventListener('click', () => {
      categoriaId = chip.dataset.catId;
      const cat = categorias.find((c) => c.id === categoriaId);
      const valorEl = raizPanel.querySelector('#mkt-categoria-valor');
      valorEl.textContent = cat ? `${cat.emoji} ${cat.nombre}` : 'Seleccionar';
      valorEl.classList.remove('placeholder');
      cerrar();
    });
  });
}

// ── Fotos: preview con badge "Portada" + botón agregar/eliminar ─
function renderFotos() {
  const zona = raizPanel.querySelector('#mkt-fotos');
  const contador = raizPanel.querySelector('#mkt-fotos-contador');
  if (!zona) return;

  contador.textContent = `${fotos.length}/3`;

  const previews = fotos.map((foto, indice) => `
    <div class="mkt-pub-foto">
      <img src="${foto.previewUrl}" alt="" />
      ${indice === 0 ? `<span class="mkt-pub-foto__badge">Portada</span>` : ''}
      <button type="button" class="mkt-pub-foto__eliminar" data-eliminar="${indice}">✕</button>
    </div>
  `).join('');

  const botonAgregar = fotos.length < 3 ? `
    <button type="button" class="mkt-pub-foto-agregar" id="mkt-btn-agregar-foto">
      <span>＋</span>
      <span>Agregar</span>
    </button>
  ` : '';

  zona.innerHTML = previews + botonAgregar;

  zona.querySelectorAll('[data-eliminar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const indice = Number(btn.dataset.eliminar);
      URL.revokeObjectURL(fotos[indice].previewUrl);
      fotos.splice(indice, 1);
      renderFotos();
    });
  });

  const btnAgregar = zona.querySelector('#mkt-btn-agregar-foto');
  if (btnAgregar) {
    btnAgregar.addEventListener('click', () => raizPanel.querySelector('#mkt-input-foto').click());
  }
}

// ═════════════════════════════════════════════════════════════════
// Publicar
// ═════════════════════════════════════════════════════════════════
async function publicar() {
  if (publicando) return;

  const titulo = raizPanel.querySelector('#mkt-titulo').value.trim();
  const descripcion = raizPanel.querySelector('#mkt-descripcion').value.trim();
  const precioTexto = raizPanel.querySelector('#mkt-precio').value.trim();

  if (!titulo) {
    mostrarToast('El título es requerido', 'error');
    return;
  }
  if (!categoriaId) {
    mostrarToast('Selecciona una categoría', 'error');
    return;
  }

  // ── Validar límite real de precio numeric(10,2) ────────────────
  // El input ya filtra mientras se escribe, pero esta validación
  // explícita cubre valores pegados desde portapapeles, que no
  // pasan por el listener de 'input'.
  const precio = precioTexto ? Number.parseFloat(precioTexto) : null;
  if (precio != null && precio > PRECIO_MAXIMO) {
    mostrarToast('El precio no puede ser mayor a $99,999,999.99', 'error');
    return;
  }

  publicando = true;
  actualizarBotonPublicar();

  try {
    // ── Verificar límite de publicaciones activas ────────────────
    const { data: activas, error: errorActivas } = await supabaseClient
      .from('marketplace_publicaciones')
      .select('id')
      .eq('emprendedor_id', emprendedorId)
      .eq('esta_activa', true)
      .gt('expira_en', new Date().toISOString());

    if (errorActivas) throw errorActivas;

    if ((activas ?? []).length >= LIMITE_PUBLICACIONES) {
      mostrarToast(`Límite alcanzado: máximo ${LIMITE_PUBLICACIONES} publicaciones activas a la vez.`, 'error');
      return;
    }

    // ── Insertar publicación ──────────────────────────────────────
    const { data: pubRes, error: errorInsert } = await supabaseClient
      .from('marketplace_publicaciones')
      .insert({
        emprendedor_id: emprendedorId,
        categoria_id: categoriaId,
        tipo,
        titulo,
        descripcion,
        precio,
      })
      .select('id')
      .single();

    if (errorInsert) throw errorInsert;
    const publicacionId = pubRes.id;

    // ── Subir fotos ────────────────────────────────────────────────
    for (let i = 0; i < fotos.length; i++) {
      const resultado = await storageService.subirImagenMarketplace({
        file: fotos[i].file,
        publicacionId,
        userId: uidSesion,
        orden: i,
      });

      const { error: errorImagen } = await supabaseClient.from('marketplace_imagenes').insert({
        publicacion_id: publicacionId,
        r2_url: resultado.url,
        r2_path: resultado.path,
        orden: i,
      });
      if (errorImagen) throw errorImagen;
    }

    mostrarToast('¡Publicación creada! Estará activa por 24 horas.', 'exito');
    resetearFormulario();
  } catch (error) {
    console.error('marketplace-publicar – error al publicar:', error);
    mostrarToast(`Error al publicar: ${error.message ?? error}`, 'error');
  } finally {
    publicando = false;
    actualizarBotonPublicar();
  }
}

function resetearFormulario() {
  fotos.forEach((f) => URL.revokeObjectURL(f.previewUrl));
  fotos = [];
  categoriaId = null;
  tipo = 'producto';
  renderVista();
}

function actualizarBotonPublicar() {
  const boton = raizPanel.querySelector('#mkt-btn-publicar');
  const texto = raizPanel.querySelector('#mkt-btn-publicar-texto');
  if (!boton || !texto) return;
  boton.disabled = publicando;
  texto.textContent = publicando ? 'Publicando...' : '🚀 Publicar';
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}