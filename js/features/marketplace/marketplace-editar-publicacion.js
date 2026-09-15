// js/features/marketplace/marketplace-editar-publicacion.js
//
// Editar una publicación existente del Marketplace: tipo, título,
// descripción, categoría, precio y fotografías (máx. 3). Equivalente
// web de MarketplaceEditarPublicacion.dart.
//
// render(contenedor, pub, onGuardado) — `pub` es la publicación
// completa tal como viene de Supabase (con marketplace_imagenes y
// marketplace_categorias embebidas, igual que en marketplace-inicio.js).
// onGuardado() se llama tras un guardado exitoso, análogo al
// Navigator.pop(context, true) del Dart, para que el padre recargue
// su lista.
//
// FOTOS — diferencia de plataforma respecto al Dart original: no hay
// ImagePicker en el navegador, así que "Agregar" dispara un
// <input type="file" accept="image/*"> oculto. El resto del flujo es
// igual: existentes se pueden marcar para borrar (se eliminan de R2
// + Supabase al guardar), nuevas se acumulan como File y se suben
// recién al confirmar — igual que el Dart, nada se sube "al vuelo"
// al elegir la foto.
//
// NOTA DE NAVEGACIÓN: igual que marketplace-editar-perfil.js, esta
// pantalla es una ruta completa en Dart (Scaffold + AppBar propios).
// Aquí se monta como panel embebido y dispara un evento custom
// 'mkt-editar-pub-volver' al tocar "‹" — el padre decide el
// mecanismo real (hoja inferior, reemplazo de panel, etc.).

import { supabaseClient } from '../../core/supabase-client.js';
import { mostrarToast } from '../../core/toast.js';
import { storageService } from '../../core/storage-service.js';
import { R2_CONFIG } from '../../core/r2-config.js';

const MAX_FOTOS = 3;

export async function render(contenedor, pub, onGuardado) {
  const estado = {
    tipo: pub.tipo ?? 'producto',
    categoriaId: pub.categoria_id ?? null,
    categorias: [],
    // Imágenes existentes que se conservan (orden ya viene ordenado
    // desde el feed, pero se re-ordena por si acaso).
    imagenesExistentes: [...(pub.marketplace_imagenes ?? [])].sort((a, b) => a.orden - b.orden),
    imagenesABorrar: [],
    fotosNuevas: [], // { file, previewUrl }
    guardando: false,
  };

  contenedor.innerHTML = plantilla(pub);
  activarInteracciones(contenedor, pub, estado, onGuardado);
  renderFotos(contenedor, estado);

  const { data, error } = await supabaseClient
    .from('marketplace_categorias')
    .select('id, nombre, emoji')
    .order('nombre');

  if (error) {
    console.error('marketplace-editar-publicacion – error cargando categorías:', error);
  } else {
    estado.categorias = data ?? [];
    renderCategorias(contenedor, estado);
  }
}

function plantilla(pub) {
  const titulo = escapar(pub.titulo ?? '');
  const descripcion = escapar(pub.descripcion ?? '');
  const precio = pub.precio != null ? Number(pub.precio).toFixed(2) : '';

  return `
    <div class="mkt-editar-pub">
      <header class="mkt-editar-pub__header">
        <button class="mkt-editar-pub__volver" data-ep-volver aria-label="Volver">‹</button>
        <h2 class="mkt-editar-pub__titulo">Editar publicación</h2>
        <button class="mkt-editar-pub__guardar" data-ep-guardar>Guardar</button>
      </header>

      <form class="mkt-editar-pub__form" data-ep-form>

        <div class="mkt-ep-label">Tipo</div>
        <div class="mkt-ep-radio-grupo">
          <label class="mkt-ep-radio-tile">
            <input type="radio" name="ep-tipo" value="producto" data-ep-tipo ${pub.tipo === 'servicio' ? '' : 'checked'} />
            <span class="mkt-ep-radio-icono">📦</span>
            <span class="mkt-ep-radio-texto">
              <strong>Producto</strong>
              <small>Artículo físico o digital</small>
            </span>
          </label>
          <div class="mkt-ep-radio-divisor"></div>
          <label class="mkt-ep-radio-tile">
            <input type="radio" name="ep-tipo" value="servicio" data-ep-tipo ${pub.tipo === 'servicio' ? 'checked' : ''} />
            <span class="mkt-ep-radio-icono">🛠️</span>
            <span class="mkt-ep-radio-texto">
              <strong>Servicio</strong>
              <small>Asesoría, reparación, suscripción...</small>
            </span>
          </label>
        </div>

        <div class="mkt-ep-divisor"></div>

        <label class="mkt-ep-label" for="ep-titulo">Título</label>
        <input class="mkt-ep-input" id="ep-titulo" type="text" maxlength="80" placeholder="Título del producto o servicio" value="${titulo}" data-ep-titulo required />
        <div class="mkt-ep-contador" data-ep-contador-titulo>${titulo.length}/80</div>

        <div class="mkt-ep-divisor"></div>

        <label class="mkt-ep-label" for="ep-descripcion">Descripción</label>
        <textarea class="mkt-ep-textarea" id="ep-descripcion" maxlength="500" rows="4" placeholder="Describe tu producto o servicio..." data-ep-descripcion>${descripcion}</textarea>
        <div class="mkt-ep-contador" data-ep-contador-descripcion>${descripcion.length}/500</div>

        <div class="mkt-ep-divisor"></div>

        <label class="mkt-ep-label" for="ep-categoria">Categoría</label>
        <select class="mkt-ep-select" id="ep-categoria" data-ep-categoria>
          <option value="" disabled ${pub.categoria_id ? '' : 'selected'}>Selecciona una categoría</option>
        </select>

        <div class="mkt-ep-divisor"></div>

        <label class="mkt-ep-label" for="ep-precio">Precio (MXN)</label>
        <div class="mkt-ep-precio-zona">
          <span class="mkt-ep-precio-signo">$</span>
          <input class="mkt-ep-input mkt-ep-input--precio" id="ep-precio" type="text" inputmode="decimal" placeholder="Ej. 50.00" value="${precio}" data-ep-precio />
        </div>

        <div class="mkt-ep-divisor"></div>

        <div class="mkt-ep-fotos-header">
          <span class="mkt-ep-label" style="margin-bottom:0">Fotografías</span>
          <span class="mkt-ep-fotos-contador" data-ep-fotos-contador>0/${MAX_FOTOS}</span>
        </div>
        <div class="mkt-ep-fotos-fila" data-ep-fotos-fila></div>
        <input type="file" accept="image/*" hidden data-ep-input-archivo />

        <button type="submit" class="mkt-ep-boton-guardar" data-ep-guardar-abajo>
          <span data-ep-guardar-texto>💾 Guardar cambios</span>
        </button>
      </form>
    </div>
  `;
}

function renderCategorias(contenedor, estado) {
  const select = contenedor.querySelector('[data-ep-categoria]');
  const actual = estado.categoriaId;

  const opciones = estado.categorias
    .map((c) => `<option value="${c.id}" ${c.id === actual ? 'selected' : ''}>${c.emoji} ${escapar(c.nombre)}</option>`)
    .join('');

  select.querySelector('option[disabled]').insertAdjacentHTML('afterend', opciones);
  select.addEventListener('change', () => {
    estado.categoriaId = select.value || null;
  });
}

function activarInteracciones(contenedor, pub, estado, onGuardado) {
  const form = contenedor.querySelector('[data-ep-form]');
  const inputTitulo = contenedor.querySelector('[data-ep-titulo]');
  const inputDescripcion = contenedor.querySelector('[data-ep-descripcion]');
  const inputPrecio = contenedor.querySelector('[data-ep-precio]');
  const contadorTitulo = contenedor.querySelector('[data-ep-contador-titulo]');
  const contadorDescripcion = contenedor.querySelector('[data-ep-contador-descripcion]');
  const botonHeader = contenedor.querySelector('[data-ep-guardar]');
  const botonAbajo = contenedor.querySelector('[data-ep-guardar-abajo]');
  const botonVolver = contenedor.querySelector('[data-ep-volver]');
  const inputArchivo = contenedor.querySelector('[data-ep-input-archivo]');

  inputTitulo.addEventListener('input', () => {
    contadorTitulo.textContent = `${inputTitulo.value.length}/80`;
  });
  inputDescripcion.addEventListener('input', () => {
    contadorDescripcion.textContent = `${inputDescripcion.value.length}/500`;
  });

  // Solo dígitos + un punto decimal, igual que el FilteringTextInputFormatter del Dart.
  inputPrecio.addEventListener('input', () => {
    const limpio = inputPrecio.value.replace(/[^\d.]/g, '');
    const partes = limpio.split('.');
    inputPrecio.value = partes.length > 2 ? `${partes[0]}.${partes.slice(1).join('')}` : limpio;
  });

  contenedor.querySelectorAll('[data-ep-tipo]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) estado.tipo = radio.value;
    });
  });

  botonVolver.addEventListener('click', () => {
    contenedor.dispatchEvent(new CustomEvent('mkt-editar-pub-volver', { bubbles: true }));
  });

  inputArchivo.addEventListener('change', () => {
    const file = inputArchivo.files?.[0];
    inputArchivo.value = ''; // permite volver a elegir el mismo archivo después
    if (!file) return;
    if (estado.imagenesExistentes.length + estado.fotosNuevas.length >= MAX_FOTOS) return;

    estado.fotosNuevas.push({ file, previewUrl: URL.createObjectURL(file) });
    renderFotos(contenedor, estado);
  });

  botonHeader.addEventListener('click', () => guardar());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    guardar();
  });

  async function guardar() {
    if (estado.guardando) return;

    const titulo = inputTitulo.value.trim();
    if (!titulo) {
      mostrarToast('Ingresa un título', 'error');
      inputTitulo.focus();
      return;
    }
    if (!estado.categoriaId) {
      mostrarToast('Selecciona una categoría', 'error');
      return;
    }

    estado.guardando = true;
    ponerCargando(contenedor, true);

    try {
      const pubId = pub.id;
      const emprendedorId = pub.emprendedor_id;

      const { data: userData } = await supabaseClient.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error('No hay sesión activa');

      // 1. Actualizar datos principales
      const { error: errorUpdate } = await supabaseClient
        .from('marketplace_publicaciones')
        .update({
          tipo: estado.tipo,
          titulo,
          descripcion: inputDescripcion.value.trim(),
          precio: inputPrecio.value.trim() ? Number(inputPrecio.value.trim()) : null,
          categoria_id: estado.categoriaId,
        })
        .eq('id', pubId);
      if (errorUpdate) throw errorUpdate;

      // 2. Borrar imágenes marcadas — de R2 y luego de Supabase
      for (const img of estado.imagenesABorrar) {
        if (img.r2_path) {
          await storageService.eliminarDeR2({ bucket: R2_CONFIG.bucketMarketplace, path: img.r2_path });
        }
        if (img.id) {
          await supabaseClient.from('marketplace_imagenes').delete().eq('id', img.id);
        }
      }

      // 3. Subir fotos nuevas — el orden continúa después de las existentes que quedan
      const ordenBase = estado.imagenesExistentes.length;
      for (let i = 0; i < estado.fotosNuevas.length; i++) {
        const { url, path } = await storageService.subirImagenMarketplace({
          file: estado.fotosNuevas[i].file,
          publicacionId: pubId,
          userId,
          orden: ordenBase + i,
        });

        const { error: errorInsert } = await supabaseClient.from('marketplace_imagenes').insert({
          publicacion_id: pubId,
          r2_url: url,
          r2_path: path,
          orden: ordenBase + i,
        });
        if (errorInsert) throw errorInsert;
      }

      mostrarToast('¡Publicación actualizada!', 'exito');
      onGuardado?.();
    } catch (e) {
      console.error('marketplace-editar-publicacion – error al guardar:', e);
      mostrarToast(`Error al guardar: ${e.message ?? e}`, 'error');
    } finally {
      estado.guardando = false;
      ponerCargando(contenedor, false);
    }
  }
}

function renderFotos(contenedor, estado) {
  const fila = contenedor.querySelector('[data-ep-fotos-fila]');
  const contador = contenedor.querySelector('[data-ep-fotos-contador]');
  const inputArchivo = contenedor.querySelector('[data-ep-input-archivo]');

  const total = estado.imagenesExistentes.length + estado.fotosNuevas.length;
  contador.textContent = `${total}/${MAX_FOTOS}`;

  const previewsExistentes = estado.imagenesExistentes
    .map(
      (img, i) => `
    <div class="mkt-ep-foto-preview" data-ep-foto-existente="${i}">
      <img src="${img.r2_url}" alt="" />
      <button type="button" class="mkt-ep-foto-borrar" data-ep-foto-existente-borrar="${i}" aria-label="Eliminar">🗑️</button>
    </div>
  `
    )
    .join('');

  const previewsNuevas = estado.fotosNuevas
    .map(
      (foto, i) => `
    <div class="mkt-ep-foto-preview" data-ep-foto-nueva="${i}">
      <img src="${foto.previewUrl}" alt="" />
      <span class="mkt-ep-foto-badge">Nueva</span>
      <button type="button" class="mkt-ep-foto-quitar" data-ep-foto-nueva-quitar="${i}" aria-label="Quitar">✕</button>
    </div>
  `
    )
    .join('');

  const botonAgregar =
    total < MAX_FOTOS
      ? `
    <button type="button" class="mkt-ep-foto-agregar" data-ep-foto-agregar>
      <span class="mkt-ep-foto-agregar__icono">📷</span>
      <span class="mkt-ep-foto-agregar__texto">Agregar</span>
    </button>
  `
      : '';

  fila.innerHTML = previewsExistentes + previewsNuevas + botonAgregar;

  fila.querySelector('[data-ep-foto-agregar]')?.addEventListener('click', () => inputArchivo.click());

  fila.querySelectorAll('[data-ep-foto-existente-borrar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.epFotoExistenteBorrar);
      const [img] = estado.imagenesExistentes.splice(i, 1);
      estado.imagenesABorrar.push(img);
      renderFotos(contenedor, estado);
    });
  });

  fila.querySelectorAll('[data-ep-foto-nueva-quitar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.epFotoNuevaQuitar);
      const [foto] = estado.fotosNuevas.splice(i, 1);
      URL.revokeObjectURL(foto.previewUrl);
      renderFotos(contenedor, estado);
    });
  });
}

function ponerCargando(contenedor, activo) {
  contenedor.querySelector('[data-ep-guardar]').disabled = activo;
  contenedor.querySelector('[data-ep-guardar-abajo]').disabled = activo;
  contenedor.querySelector('[data-ep-guardar-texto]').textContent = activo ? 'Guardando...' : '💾 Guardar cambios';
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}