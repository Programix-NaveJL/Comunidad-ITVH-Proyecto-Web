// Pantalla de detalle de una publicación: la tarjeta completa arriba
// y el hilo de comentarios inline debajo (a diferencia de la hoja
// flotante que abre tarjeta-publicacion.js desde el feed). Se llega
// aquí desde el historial de reacciones/comentarios.
//
// El router de hash solo pasa strings como parámetros — no puede
// cargar un objeto de publicación completo desde la URL. Como
// '/publicacion' es una ruta real (con su propio historial de
// navegador, no un overlay), quien navega hacia acá debe llamar a
// abrirPublicacion(post) en vez de navegarA('/publicacion')
// directo, para dejar el post listo en memoria antes de que el
// router dispare render().
//
// Ruta real: js/features/social/publicaciones/ver-publicacion.js
// (comentarios-hilo.js vive dentro de tarjeta-publicaciones/, no
// como hermano directo).

import { supabaseClient } from '../../../core/supabase-client.js';
import { registrarRuta, navegarA } from '../../../core/router.js';
import { renderTarjetaPublicacion, activarTarjetaPublicacion } from './tarjeta-publicaciones/tarjeta-publicacion.js';
import { crearControladorComentarios, renderComposerComentario, activarComposerComentario } from './tarjeta-publicaciones/comentarios-hilo.js';
import { renderItemComentario, activarItemComentario } from './tarjeta-publicaciones/item-comentario.js';

let postPendiente = null;

export function abrirPublicacion(post, { onMiPerfilTap = null } = {}) {
  postPendiente = { post, onMiPerfilTap };
  navegarA('/publicacion');
}

registrarRuta('/publicacion', render);

async function render(contenedor) {
  if (!postPendiente) {
    contenedor.innerHTML = `
      <div class="ver-publicacion__error">
        <p>No se encontró la publicación.</p>
        <button data-volver>Regresar</button>
      </div>
    `;
    contenedor.querySelector('[data-volver]').addEventListener('click', () => window.history.back());
    return;
  }

  const { post, onMiPerfilTap } = postPendiente;
  postPendiente = null; // se consume una sola vez, igual que un argumento de Navigator.push

  contenedor.innerHTML = `
    <div class="ver-publicacion">
      <header class="ver-publicacion__header">
        <button class="ver-publicacion__volver" id="vp-volver" aria-label="Regresar">‹</button>
        <h1>Publicación</h1>
      </header>
      <div class="ver-publicacion__lista">
        <div id="vp-tarjeta"></div>
        <div class="ver-publicacion__comentarios" id="vp-comentarios"></div>
      </div>
      <div class="ver-publicacion__composer" id="vp-composer"></div>
    </div>
  `;

  contenedor.querySelector('#vp-volver').addEventListener('click', () => window.history.back());

  const elTarjeta = contenedor.querySelector('#vp-tarjeta');
  elTarjeta.innerHTML = renderTarjetaPublicacion(post);
  const elTarjetaRaiz = elTarjeta.querySelector('[data-post-id]');

  const composerZona = contenedor.querySelector('#vp-composer');
  composerZona.innerHTML = renderComposerComentario();
  const elComentarios = contenedor.querySelector('#vp-comentarios');

  const { data } = await supabaseClient.auth.getUser();
  const uid = data?.user?.id ?? null;

  const controlador = crearControladorComentarios({ post, uid, onCambio: renderComentarios });
  const composer = activarComposerComentario(composerZona, controlador);

  activarTarjetaPublicacion(elTarjetaRaiz, post, {
    onRefresh: () => window.history.back(),
    onMiPerfilTap,
    onComentarTap: () => composer.enfocar(),
  });

  function renderComentarios() {
    const estado = controlador.getState();

    if (estado.cargando) {
      elComentarios.innerHTML = `<div class="ver-publicacion__spinner"><span class="btn-spinner"></span></div>`;
    } else {
      const raices = estado.comentarios.filter((c) => c.parent_id == null);
      elComentarios.innerHTML = raices
        .map((c) => renderItemComentario(c, estado.comentarios.filter((r) => r.parent_id === c.id), { tiempoBuilder: controlador.tiempo }))
        .join('');

      raices.forEach((c) => {
        const respuestas = estado.comentarios.filter((r) => r.parent_id === c.id);
        const elItem = elComentarios.querySelector(`[data-comentario-id="${c.id}"]`);
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
    }

    composer.actualizar();
  }

  controlador.cargar();
}