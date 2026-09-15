// hoja-comentarios.js
// Ruta real: js/features/social/publicaciones/tarjeta-publicaciones/hoja-comentarios.js
//
// Puerto de hoja_comentarios.dart. Hoja inferior de comentarios de
// una publicación: lista de comentarios raíz + respuestas, campo
// para escribir/responder/editar con autocompletado de @menciones,
// y reacciones por comentario.
//
// Toda la lógica de datos (cargar, enviar, editar, eliminar,
// reaccionar) y el composer de abajo (input + banner + @menciones)
// viven en comentarios-hilo.js — el mismo motor que usa
// ver-publicacion.js para la pantalla completa de detalle. Este
// archivo solo aporta el "shell" propio de la hoja flotante:
//
//   - js/core/bottom-sheet.js para el shell (backdrop + manija + arrastre).
//   - item-comentario.js para pintar/activar cada comentario raíz + sus respuestas.
//
// DIFERENCIA DE PLATAFORMA — AnimatedPadding por teclado: el Dart
// original ajusta el padding inferior de la hoja según
// MediaQuery.viewInsets.bottom cuando aparece el teclado. El
// navegador no expone ese valor de forma directamente equivalente en
// todos los casos (varía por navegador/SO); se deja pendiente y
// anotado aquí — el layout flex (lista con flex:1 + footer fijo)
// funciona razonablemente sin ese ajuste en la mayoría de casos,
// pero si en pruebas reales el teclado tapa el input en algún
// dispositivo, es el punto a revisar primero.

import { abrirHojaInferior } from '../../../../core/bottom-sheet.js';
import { renderItemComentario, activarItemComentario } from './item-comentario.js';
import { crearControladorComentarios, renderComposerComentario, activarComposerComentario } from './comentarios-hilo.js';

/**
 * Abre la hoja de comentarios de una publicación.
 *
 * @param {Object} opciones
 * @param {Object} opciones.post - debe traer al menos 'id'.
 * @param {?string} [opciones.uid]
 * @param {?Function} [opciones.onMiPerfilTap]
 * @param {?Function} [opciones.onCerrar] - se dispara al cerrar la hoja (para que tarjeta-publicacion.js recalcule el total de comentarios, igual que el .then() del showModalBottomSheet original).
 */
export function abrirHojaComentarios({ post, uid = null, onMiPerfilTap = null, onCerrar = null }) {
  const { sheet, cuerpo, cerrar } = abrirHojaInferior({ initialChildSize: 0.6, maxChildSize: 0.95, minChildSize: 0.3, onCerrar });
  sheet.classList.add('hoja-comentarios');

  cuerpo.innerHTML = `
    <div class="hoja-comentarios__header">
      <span class="hoja-comentarios__icono">💬</span>
      <p class="hoja-comentarios__titulo" id="hc-contador">0 comentarios</p>
    </div>
    <div class="hoja-comentarios__divisor"></div>
    <div class="hoja-comentarios__lista" id="hc-lista"></div>
    <div class="hoja-comentarios__footer" id="hc-footer"></div>
  `;

  const elLista = cuerpo.querySelector('#hc-lista');
  const elContador = cuerpo.querySelector('#hc-contador');
  const elFooter = cuerpo.querySelector('#hc-footer');
  elFooter.innerHTML = renderComposerComentario();

  // Mismo contrato que hoja-etiquetados.js/hoja-reacciones.js: quien
  // abre la hoja debe pasar el uid ya resuelto (tarjeta-publicacion.js
  // lo resuelve una sola vez con supabaseClient.auth.getUser() y lo
  // reutiliza para todas sus hojas hijas).
  const controlador = crearControladorComentarios({ post, uid, onCambio: renderLista });
  const composer = activarComposerComentario(elFooter, controlador);

  function renderLista() {
    const estado = controlador.getState();
    elContador.textContent = `${estado.comentarios.length} ${estado.comentarios.length === 1 ? 'comentario' : 'comentarios'}`;

    if (estado.cargando) {
      elLista.innerHTML = `<div class="hoja-comentarios__spinner"><span class="btn-spinner"></span></div>`;
      composer.actualizar();
      return;
    }

    const raices = estado.comentarios.filter((c) => c.parent_id == null);

    if (raices.length === 0) {
      elLista.innerHTML = `
        <div class="hoja-comentarios__vacio">
          <span class="hoja-comentarios__vacio-icono">💬</span>
          <p>Sé el primero en comentar</p>
        </div>
      `;
      composer.actualizar();
      return;
    }

    elLista.innerHTML = raices
      .map((c) => renderItemComentario(c, estado.comentarios.filter((r) => r.parent_id === c.id), { tiempoBuilder: controlador.tiempo }))
      .join('');

    raices.forEach((c) => {
      const respuestas = estado.comentarios.filter((r) => r.parent_id === c.id);
      const elItem = elLista.querySelector(`[data-comentario-id="${c.id}"]`);
      if (!elItem) return;
      activarItemComentario(elItem, c, respuestas, {
        uid,
        onMiPerfilTap,
        onLike: (item, tipo) => controlador.reaccionar(item, tipo),
        onResponder: (item) => {
          composer.prefillInput(controlador.iniciarRespuesta(item));
          composer.actualizar();
        },
        onEditar: (item) => {
          composer.prefillInput(controlador.iniciarEdicion(item));
          composer.actualizar();
        },
        onEliminar: (item) => controlador.confirmarEliminar(item),
      });
    });

    composer.actualizar();
  }

  controlador.cargar();
}