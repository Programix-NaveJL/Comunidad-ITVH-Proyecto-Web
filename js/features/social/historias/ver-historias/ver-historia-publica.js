// ver-historia-publica.js
// Puerto de ver_historia_publica.dart. Especialización para cuando
// el usuario ve la historia de otro: hoja con solo Comentarios +
// campo para escribir uno, y corazón de like en la esquina inferior
// derecha.

import { navegarA } from '../../../../core/router.js';
import { crearVistaGrupoHistoria } from './ver-historia-base.js';

export function crearVistaGrupoHistoriaPublica(opciones) {
  const controlador = crearVistaGrupoHistoria({
    ...opciones,
    esMiHistoria: false,

    faltanDatosExtra: () => false,
    resetearDatosExtra: () => {},
    cargarDatosExtraInicial: async () => undefined, // no hay datos extra como visitante
    cargarDatosAlAbrirHoja: async () => {}, // los comentarios ya los carga la base

    renderAccionInferior: ({ miLike, totalLikes }) => `
      <button class="vh-accion vh-accion--derecha" data-vh-like>
        <span class="vh-accion__corazon">${miLike ? '❤️' : '🤍'}</span>
        ${totalLikes > 0 ? `<span class="vh-accion__contador">${totalLikes}</span>` : ''}
      </button>
    `,
    activarAccionInferior: (el, { toggleLike }) => {
      el.querySelector('[data-vh-like]').addEventListener('click', (evento) => {
        evento.stopPropagation();
        toggleLike();
      });
    },

    renderHoja: (ctx) => plantillaHoja(ctx),
    activarHoja: (cuerpoEl, ctx) => activarHoja(cuerpoEl, ctx),

    alTocarAvatarAutor: ({ pausarParaNavegar, reanudarDespuesDeNavegar, grupo }) => {
      pausarParaNavegar();
      const autorId = grupo.autor_id ?? '';
      if (!autorId) {
        reanudarDespuesDeNavegar();
        return;
      }
      navegarA(`/perfil-publico/${autorId}`); // TODO: pendiente módulo Mi Perfil
    },
  });

  function plantillaHoja(ctx) {
    return `
      <div class="vh-hoja">
        <p class="vh-hoja__titulo">Comentarios</p>
        <div class="vh-hoja__lista" data-vh-lista-comentarios>
          ${
            ctx.comentarios.length === 0
              ? '<p class="vh-hoja__vacio">Sé el primero en comentar</p>'
              : ctx.comentarios.map((c) => ctx.renderComentario(c)).join('')
          }
        </div>
        <div class="vh-hoja__composer">
          <input type="text" class="vh-hoja__input" data-vh-input placeholder="Escribe un comentario..." autocomplete="off" />
          <button class="vh-hoja__enviar" data-vh-enviar aria-label="Enviar">
            ${ctx.enviando ? '<span class="btn-spinner" style="width:16px;height:16px;border-width:2px;"></span>' : '➤'}
          </button>
        </div>
      </div>
    `;
  }

  function activarHoja(cuerpoEl, ctx) {
    cuerpoEl.querySelectorAll('[data-vh-comentario-id]').forEach((el) => {
      const c = ctx.comentarios.find((com) => String(com.id) === el.dataset.vhComentarioId);
      if (c) ctx.activarComentario(el, c);
    });

    const input = cuerpoEl.querySelector('[data-vh-input]');
    const enviarBtn = cuerpoEl.querySelector('[data-vh-enviar]');

    async function disparaEnvio() {
      const texto = input.value;
      if (!texto.trim() || ctx.enviando) return;
      await ctx.enviarComentario(texto);
    }

    input.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter') {
        evento.preventDefault();
        disparaEnvio();
      }
    });
    enviarBtn.addEventListener('click', disparaEnvio);
  }

  return controlador;
}