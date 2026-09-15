// js/features/marketplace/marketplace-editar-perfil.js
//
// Editar perfil de negocio del emprendedor: nombre + descripción.
// Equivalente web de MarketplaceEditarPerfil.dart.
//
// render(contenedor, emprendedor, onGuardado) — emprendedor es el
// registro completo tal como viene de Supabase (con 'id',
// 'nombre_negocio', 'descripcion'). onGuardado() se llama tras un
// guardado exitoso para que el padre recargue sus datos, análogo al
// Navigator.pop(context, true) del Dart.
//
// NOTA: en el Dart esta pantalla es una ruta completa (Scaffold +
// AppBar propios). Aquí se monta como panel embebido: quien la abra
// (probablemente marketplace-mi-negocio-personal.js) decide si la
// muestra dentro de una hoja inferior, un panel de "sub-vista", o
// reemplazando temporalmente el contenido de un contenedor — este
// archivo solo pinta el formulario y expone el botón "Guardar" en su
// propio header, sin asumir el mecanismo de navegación del padre.

import { supabaseClient } from '../../core/supabase-client.js';
import { mostrarToast } from '../../core/toast.js';

export function render(contenedor, emprendedor, onGuardado) {
  contenedor.innerHTML = plantilla(emprendedor);
  activarInteracciones(contenedor, emprendedor, onGuardado);
}

function plantilla(emprendedor) {
  const nombre = escapar(emprendedor?.nombre_negocio ?? '');
  const descripcion = escapar(emprendedor?.descripcion ?? '');

  return `
    <div class="mkt-editar-perfil">
      <header class="mkt-editar-perfil__header">
        <button class="mkt-editar-perfil__volver" data-ep-volver aria-label="Volver">‹</button>
        <h2 class="mkt-editar-perfil__titulo">Editar perfil de negocio</h2>
        <button class="mkt-editar-perfil__guardar" data-ep-guardar>Guardar</button>
      </header>

      <form class="mkt-editar-perfil__form" data-ep-form>
        <label class="mkt-ep-label" for="ep-nombre">Nombre del negocio</label>
        <input
          class="mkt-ep-input"
          id="ep-nombre"
          type="text"
          maxlength="60"
          placeholder="Ej. Tortas Mister"
          value="${nombre}"
          data-ep-nombre
          required
        />
        <div class="mkt-ep-contador" data-ep-contador-nombre>${nombre.length}/60</div>

        <div class="mkt-ep-divisor"></div>

        <label class="mkt-ep-label" for="ep-descripcion">Descripción</label>
        <textarea
          class="mkt-ep-textarea"
          id="ep-descripcion"
          maxlength="300"
          rows="4"
          placeholder="Describe tu negocio, qué ofreces, horarios..."
          data-ep-descripcion
        >${descripcion}</textarea>
        <div class="mkt-ep-contador" data-ep-contador-descripcion>${descripcion.length}/300</div>

        <button type="submit" class="mkt-ep-boton-guardar" data-ep-guardar-abajo>
          <span data-ep-guardar-texto>💾 Guardar cambios</span>
        </button>
      </form>
    </div>
  `;
}

function activarInteracciones(contenedor, emprendedor, onGuardado) {
  const form = contenedor.querySelector('[data-ep-form]');
  const inputNombre = contenedor.querySelector('[data-ep-nombre]');
  const inputDescripcion = contenedor.querySelector('[data-ep-descripcion]');
  const contadorNombre = contenedor.querySelector('[data-ep-contador-nombre]');
  const contadorDescripcion = contenedor.querySelector('[data-ep-contador-descripcion]');
  const botonHeader = contenedor.querySelector('[data-ep-guardar]');
  const botonAbajo = contenedor.querySelector('[data-ep-guardar-abajo]');
  const botonVolver = contenedor.querySelector('[data-ep-volver]');

  inputNombre.addEventListener('input', () => {
    contadorNombre.textContent = `${inputNombre.value.length}/60`;
  });
  inputDescripcion.addEventListener('input', () => {
    contadorDescripcion.textContent = `${inputDescripcion.value.length}/300`;
  });

  // TODO: confirmar mecanismo real de "volver" cuando se integre
  // esta pantalla desde marketplace-mi-negocio-personal.js (podría
  // ser navegarA() a una ruta anterior, cerrar una hoja inferior, o
  // restaurar el panel previo — por ahora solo dispara un evento
  // custom para que el padre decida qué hacer).
  botonVolver.addEventListener('click', () => {
    contenedor.dispatchEvent(new CustomEvent('mkt-ep-volver', { bubbles: true }));
  });

  botonHeader.addEventListener('click', () => guardar());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    guardar();
  });

  let guardando = false;

  async function guardar() {
    if (guardando) return;

    const nombreNegocio = inputNombre.value.trim();
    if (!nombreNegocio) {
      mostrarToast('Ingresa el nombre de tu negocio', 'error');
      inputNombre.focus();
      return;
    }

    guardando = true;
    ponerCargando(true);

    try {
      const { error } = await supabaseClient
        .from('emprendedores')
        .update({
          nombre_negocio: nombreNegocio,
          descripcion: inputDescripcion.value.trim(),
        })
        .eq('id', emprendedor.id);

      if (error) throw error;

      mostrarToast('¡Perfil actualizado!', 'exito');
      onGuardado?.();
    } catch (e) {
      console.error('marketplace-editar-perfil – error al guardar:', e);
      mostrarToast(`Error al guardar: ${e.message ?? e}`, 'error');
    } finally {
      guardando = false;
      ponerCargando(false);
    }
  }

  function ponerCargando(activo) {
    botonHeader.disabled = activo;
    botonAbajo.disabled = activo;
    const texto = contenedor.querySelector('[data-ep-guardar-texto]');
    texto.textContent = activo ? 'Guardando...' : '💾 Guardar cambios';
  }
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}