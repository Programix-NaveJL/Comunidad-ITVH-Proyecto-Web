// ═════════════════════════════════════════════════════════════════
// nombre-portada-destacada.js
//
// Pantalla 2 del flujo de creación/edición de destacadas, portada de
// NombrePortadaDestacada.dart. El usuario elige/edita la portada de
// la colección, escribe un nombre y guarda — inserta o actualiza
// historias_destacadas + historias_destacadas_items en Supabase.
//
// Overlay abierto por función (mismo patrón que
// seleccionar-historias-destacada.js), apilado encima de esa
// pantalla para poder "volver" a ella con el botón atrás, igual que
// Navigator.push en Flutter.
//
// SUBIDA DE PORTADA: reutiliza storageService.subirHistoriaDesdeBytes
// (bucket itvh-historias) pasando userId = "<uid>/destacadas" — el
// mismo truco que ya usaba NombrePortadaDestacada.dart para que el
// path resultante caiga en <uid>/destacadas/<timestamp>.jpg en vez de
// <uid>/<timestamp>.jpg (que es donde caen las historias normales).
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../../core/supabase-client.js';
import { mostrarToast } from '../../../core/toast.js';
import { storageService } from '../../../core/storage-service.js';

/**
 * Sube la portada de la colección al bucket de historias, bajo
 * <uid>/destacadas/<timestamp>.jpg, y devuelve la CDN URL pública.
 */
async function subirPortadaDestacadaAR2(file, uid) {
  return storageService.subirHistoriaDesdeBytes({
    blob: file,
    extension: 'jpg',
    userId: `${uid}/destacadas`,
  });
}

export function abrirNombrePortadaDestacada(opciones = {}) {
  const {
    historiasSeleccionadas = [],
    portadaUrlDefault = null,
    destacadaId = null,
    nombreInicial = null,
    portadaUrlInicial = null,
    onGuardadoConExito = () => {},
  } = opciones;

  const modoEdicion = destacadaId != null;

  let archivoNuevaPortada = null; // File elegido localmente
  let portadaUrlActual = portadaUrlInicial ?? portadaUrlDefault; // lo que se muestra
  let guardando = false;

  const overlay = document.createElement('div');
  overlay.className = 'nombre-portada-overlay';
  overlay.innerHTML = `
    <header class="nombre-portada-appbar">
      <button type="button" class="nombre-portada-atras" aria-label="Volver">‹</button>
      <span class="nombre-portada-titulo">${modoEdicion ? 'Editar colección' : 'Nueva colección'}</span>
      <span class="nombre-portada-appbar-spacer"></span>
    </header>
    <div class="nombre-portada-cuerpo">
      <div class="nombre-portada-portada-wrap">
        <button type="button" class="nombre-portada-portada" aria-label="Cambiar portada">
          ${
            portadaUrlActual
              ? `<img src="${portadaUrlActual}" alt="" class="nombre-portada-portada-img">`
              : `<span class="nombre-portada-portada-icono">🔖</span>`
          }
        </button>
        <span class="nombre-portada-portada-editar">✏️</span>
      </div>
      <div class="nombre-portada-hint">Toca para cambiar la portada</div>

      <input type="file" accept="image/*" class="nombre-portada-input-archivo" hidden />

      <div class="nombre-portada-campo-wrap">
        <input
          type="text"
          class="nombre-portada-campo"
          placeholder="Nombre de la colección"
          maxlength="30"
          value="${nombreInicial ? String(nombreInicial).replace(/"/g, '&quot;') : ''}"
        />
      </div>
      <div class="nombre-portada-contador">
        ${historiasSeleccionadas.length} ${historiasSeleccionadas.length === 1 ? 'historia' : 'historias'} seleccionada${historiasSeleccionadas.length === 1 ? '' : 's'}
      </div>

      <button type="button" class="nombre-portada-boton-listo">
        ${modoEdicion ? 'Guardar cambios' : 'Listo'}
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  const cerrar = () => overlay.remove();
  overlay.querySelector('.nombre-portada-atras').addEventListener('click', cerrar);

  const botonPortada = overlay.querySelector('.nombre-portada-portada');
  const inputArchivo = overlay.querySelector('.nombre-portada-input-archivo');
  const campoNombre = overlay.querySelector('.nombre-portada-campo');
  const botonListo = overlay.querySelector('.nombre-portada-boton-listo');

  botonPortada.addEventListener('click', () => {
    if (guardando) return;
    inputArchivo.click();
  });

  inputArchivo.addEventListener('change', () => {
    const file = inputArchivo.files?.[0];
    if (!file) return;
    archivoNuevaPortada = file;
    portadaUrlActual = null;
    botonPortada.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="" class="nombre-portada-portada-img">`;
  });

  function marcarGuardando(activo) {
    guardando = activo;
    botonListo.disabled = activo;
    botonPortada.disabled = activo;
    campoNombre.disabled = activo;
    botonListo.textContent = activo ? '' : modoEdicion ? 'Guardar cambios' : 'Listo';
    botonListo.classList.toggle('nombre-portada-boton-listo--cargando', activo);
  }

    async function guardar() {
    if (guardando) return; // ← guard extra por si acaso

    const nombre = campoNombre.value.trim();
    if (!nombre) {
      mostrarToast('Escribe un nombre para la colección', 'error');
      return;
    }

    marcarGuardando(true); // ← se mueve ANTES del await, así el botón
                            //   se deshabilita de inmediato en el primer clic

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      marcarGuardando(false);
      return;
    }

    try {
      let portadaFinal = portadaUrlActual;
      if (archivoNuevaPortada) {
        portadaFinal = await subirPortadaDestacadaAR2(archivoNuevaPortada, user.id);
      }

      if (modoEdicion) {
        await actualizarDestacada(destacadaId, nombre, portadaFinal, historiasSeleccionadas);
      } else {
        await crearDestacada(user.id, nombre, portadaFinal, historiasSeleccionadas);
      }

      mostrarToast(modoEdicion ? 'Colección actualizada' : 'Historia destacada agregada', 'success');
      onGuardadoConExito();
      cerrar(); // ← cierra ESTE overlay, el de seleccionar lo cierra onGuardadoConExito()
    } catch (e) {
      console.error('NombrePortada – guardar:', e);
      mostrarToast(`Error al guardar: ${e.message ?? e}`, 'error');
      marcarGuardando(false); // ← si falla, reactiva el botón para reintentar
    }
  }

  botonListo.addEventListener('click', guardar);

  return { cerrar };
}

async function crearDestacada(uid, nombre, portadaUrl, historiasSeleccionadas) {
  const { data: destacada, error: errorInsert } = await supabaseClient
    .from('historias_destacadas')
    .insert({ autor_id: uid, nombre, portada_url: portadaUrl })
    .select('id')
    .single();

  if (errorInsert) throw errorInsert;

  const items = historiasSeleccionadas.map((historiaId, orden) => ({
    destacada_id: destacada.id,
    historia_id: historiaId,
    orden,
  }));

  const { error: errorItems } = await supabaseClient.from('historias_destacadas_items').insert(items);
  if (errorItems) throw errorItems;
}

async function actualizarDestacada(destacadaId, nombre, portadaUrl, historiasSeleccionadas) {
  const { error: errorUpdate } = await supabaseClient
    .from('historias_destacadas')
    .update({ nombre, portada_url: portadaUrl })
    .eq('id', destacadaId);
  if (errorUpdate) throw errorUpdate;

  const { error: errorDelete } = await supabaseClient
    .from('historias_destacadas_items')
    .delete()
    .eq('destacada_id', destacadaId);
  if (errorDelete) throw errorDelete;

  const items = historiasSeleccionadas.map((historiaId, orden) => ({
    destacada_id: destacadaId,
    historia_id: historiaId,
    orden,
  }));

  const { error: errorInsert } = await supabaseClient.from('historias_destacadas_items').insert(items);
  if (errorInsert) throw errorInsert;
}