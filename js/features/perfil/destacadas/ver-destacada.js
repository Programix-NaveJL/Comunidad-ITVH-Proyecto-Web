// ═════════════════════════════════════════════════════════════════
// ver-destacada.js
//
// Equivalente a VerDestacada.dart. A diferencia de las otras tres
// pantallas del módulo, VerDestacada NO tiene una interfaz propia más
// allá de un spinner de carga: solo arma los "grupos" a partir de las
// colecciones guardadas y navega al visor de historias existente
// (abrirVerHistorias, de ver-historia.js), reutilizando exactamente
// el mismo formato de grupo que ya usan las historias en vivo
// (autor_id, esTuyo, nombre, foto, stories, tieneStory, todasVistas).
//
// Por eso aquí no se crea una "pantalla" completa como en
// seleccionar-historias-destacada.js/nombre-portada-destacada.js:
// se muestra un overlay mínimo de carga/error y, en cuanto los datos
// están listos, se reemplaza directamente por el visor real — igual
// que el Navigator.pushReplacement del Dart.
//
// v3 (igual que el Dart): las historias dentro de cada colección se
// ordenan por creado_en ascendente (más antigua → más reciente), NO
// por el campo `orden` de historias_destacadas_items (ese refleja el
// orden de selección al crear la colección, no el orden cronológico).
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../../core/supabase-client.js';
import { abrirVerHistorias } from '../../social/historias/ver-historias/ver-historia.js';

// z-index 2000, igual que el resto de overlays a pantalla completa
// (ver ver-destacada.css). El spinner usa la clase global .btn-spinner
// (misma que pintarCargando() en mi-perfil-screen.js).

async function cargarColeccion(destacadaId) {
  try {
    const { data: destacada, error: errorDestacada } = await supabaseClient
      .from('historias_destacadas')
      .select(
        'id, nombre, autor_id, portada_url, ' +
          'perfiles!historias_destacadas_autor_id_fkey(nombre, cdn_foto_perfil)'
      )
      .eq('id', destacadaId)
      .single();

    if (errorDestacada) throw errorDestacada;

    const { data: itemsRaw, error: errorItems } = await supabaseClient
      .from('historias_destacadas_items')
      .select(
        'orden, ' +
          'historias!historias_destacadas_items_historia_id_fkey(' +
          'id, autor_id, media_url, cdn_url, tipo, creado_en, ' +
          'preview_url, track_titulo, track_artista, track_cover, track_inicio_ms)'
      )
      .eq('destacada_id', destacadaId);

    if (errorItems) throw errorItems;

    const historias = (itemsRaw || [])
      .map((item) => item.historias)
      .filter((h) => h != null)
      // Orden cronológico real: más antigua → más reciente
      .sort((a, b) => new Date(a.creado_en ?? 0) - new Date(b.creado_en ?? 0));

    if (historias.length === 0) return null;

    const { data: { user } } = await supabaseClient.auth.getUser();
    const perfil = destacada.perfiles || {};

    return {
      autor_id: destacada.autor_id,
      esTuyo: destacada.autor_id === user?.id,
      nombre: destacada.nombre || '',
      foto: perfil.cdn_foto_perfil || '',
      stories: historias,
      tieneStory: true,
      todasVistas: false,
    };
  } catch (e) {
    console.error(`VerDestacada – cargar ${destacadaId}:`, e);
    return null;
  }
}

/**
 * @param {Object} opciones
 * @param {string} opciones.destacadaId - colección en la que se hizo tap
 * @param {string[]} opciones.todasIds - ids de todas las colecciones del carrusel (para swipe entre colecciones)
 * @param {number} opciones.indiceInicial - índice de destacadaId dentro de todasIds
 * @param {Function} [opciones.onIrAMiPerfil]
 */
export function abrirVerDestacada({ destacadaId, todasIds, indiceInicial, onIrAMiPerfil }) {
  const overlay = document.createElement('div');
  overlay.className = 'ver-destacada-overlay';
  overlay.innerHTML = `<span class="btn-spinner"></span>`;
  document.body.appendChild(overlay);

  (async () => {
    try {
      const resultados = await Promise.all(todasIds.map(cargarColeccion));
      const grupos = resultados.filter((g) => g != null);

      if (grupos.length === 0) {
        mostrarError(overlay, 'Esta colección no tiene historias');
        return;
      }

      // Recalcula el índice real dentro de `grupos` (que puede tener
      // menos elementos que todasIds si alguna colección quedó vacía)
      let indiceReal = 0;
      let contadorValidos = 0;
      for (let i = 0; i < resultados.length; i++) {
        if (resultados[i] != null) {
          if (i === indiceInicial) {
            indiceReal = contadorValidos;
            break;
          }
          contadorValidos++;
        }
      }

      overlay.remove();
      abrirVerHistorias({ grupos, indiceInicial: indiceReal, onIrAMiPerfil });
    } catch (e) {
      console.error('VerDestacada – cargarYNavegar:', e);
      mostrarError(overlay, 'No se pudo cargar la colección');
    }
  })();
}

function mostrarError(overlay, mensaje) {
  overlay.innerHTML = `
    <div class="ver-destacada-error">
      <div class="ver-destacada-error-icono">⚠️</div>
      <div class="ver-destacada-error-texto">${mensaje}</div>
      <button type="button" class="ver-destacada-error-volver">Volver</button>
    </div>`;
  overlay.querySelector('.ver-destacada-error-volver').addEventListener('click', () => overlay.remove());
}