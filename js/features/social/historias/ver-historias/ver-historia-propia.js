// ver-historia-propia.js
// Puerto de ver_historia_propia.dart. Especialización para cuando el
// usuario ve su propia historia: hoja con Comentarios + Reacciones
// (quién vio / quién dio like) y botón de eliminar la historia.

import { supabaseClient } from '../../../../core/supabase-client.js';
import { resolverUrlPerfil } from '../../../../core/perfil-utils.js';
import { R2_CONFIG } from '../../../../core/r2-config.js';
import { storageService } from '../../../../core/storage-service.js';
import { crearVistaGrupoHistoria, tiempoTranscurrido, escaparHtml } from './ver-historia-base.js';

export function crearVistaGrupoHistoriaPropia(opciones) {
  let actividad = [];
  let totalReaccionaron = 0;
  let eliminando = false;
  let errorEliminar = null;

  const controlador = crearVistaGrupoHistoria({
    ...opciones,
    esMiHistoria: true,

    faltanDatosExtra: () => actividad.length === 0,
    resetearDatosExtra: () => {
      actividad = [];
      totalReaccionaron = 0;
      errorEliminar = null;
    },
    cargarDatosExtraInicial: async (historia) => {
      await cargarActividad(historia?.id);
      return { totalLikes: totalReaccionaron };
    },
    cargarDatosAlAbrirHoja: async (historia) => {
      await cargarActividad(historia?.id);
    },

    renderAccionInferior: ({ totalLikes }) => `
      <button class="vh-accion vh-accion--izquierda" data-vh-abrir-hoja>
        <span class="vh-accion__circulo">👥</span>
        ${totalLikes > 0 ? `<span class="vh-accion__contador">${totalLikes}</span>` : ''}
      </button>
    `,
    activarAccionInferior: (el, { mostrarHoja }) => {
      el.querySelector('[data-vh-abrir-hoja]').addEventListener('click', (evento) => {
        evento.stopPropagation();
        mostrarHoja();
      });
    },

    renderHoja: (ctx) => plantillaHoja(ctx),
    activarHoja: (cuerpoEl, ctx) => activarHoja(cuerpoEl, ctx),

    alTocarAvatarAutor: ({ pausarParaNavegar, onCerrarTodo, onIrAMiPerfil }) => {
      pausarParaNavegar();
      onCerrarTodo();
      onIrAMiPerfil?.();
    },
  });

  // ═══════════════════════════════════════════════════════════
  // ACTIVIDAD: quién vio / quién reaccionó
  // ═══════════════════════════════════════════════════════════

  async function cargarActividad(historiaId) {
    if (!historiaId) return;
    try {
      const { data: userData } = await supabaseClient.auth.getUser();
      const uid = userData?.user?.id ?? null;

      const { data: vistasRes } = await supabaseClient
        .from('historia_vistas')
        .select('usuario_id, visto_en, perfiles!historia_vistas_usuario_id_fkey(id, nombre, cdn_foto_perfil)')
        .eq('historia_id', historiaId)
        .order('visto_en', { ascending: false });

      const { data: likesRes } = await supabaseClient.from('reacciones_historias').select('usuario_id').eq('historia_id', historiaId).eq('tipo', 'like');

      const reaccionaron = new Set((likesRes ?? []).map((l) => l.usuario_id));
      totalReaccionaron = reaccionaron.size;

      const lista = (vistasRes ?? [])
        .map((v) => ({
          usuario_id: v.usuario_id,
          perfil: v.perfiles ?? {},
          reacciono: reaccionaron.has(v.usuario_id),
          visto_en: v.visto_en,
        }))
        .filter((v) => v.usuario_id !== uid);

      // Quienes reaccionaron van siempre antes que quienes solo
      // vieron; dentro de cada grupo se conserva el orden por fecha
      // de vista más reciente.
      lista.sort((a, b) => {
        if (a.reacciono !== b.reacciono) return a.reacciono ? -1 : 1;
        return new Date(b.visto_en ?? 0).getTime() - new Date(a.visto_en ?? 0).getTime();
      });

      actividad = lista;
    } catch (error) {
      console.error('ver-historia-propia – actividad:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ELIMINAR HISTORIA
  // ═══════════════════════════════════════════════════════════

  async function eliminarHistoria(ctx) {
    if (eliminando) return;
    if (!window.confirm('¿Seguro que quieres eliminar esta historia?')) return;

    const historia = ctx.historiaActual;
    const historiaId = historia.id;
    const cdnUrl = historia.cdn_url;
    const mediaUrl = historia.media_url;

    eliminando = true;
    ctx.actualizar();

    try {
      // Paso 1: borrar el archivo de R2 (o del bucket viejo de
      // Supabase Storage, si esta historia es de antes de migrar).
      // Si esto falla, no se intenta borrar la fila.
      if (cdnUrl) {
        const r2Path = cdnUrl.replace(`${R2_CONFIG.dominioHistorias}/`, '');
        await storageService.eliminarDeR2({ bucket: R2_CONFIG.bucketHistorias, path: r2Path });
      } else if (mediaUrl) {
        await supabaseClient.storage.from('historias').remove([mediaUrl]);
      }

      // Paso 2: borrar la fila. Si 'historias' tiene alguna FK hija
      // sin ON DELETE CASCADE, esto lanza un error de Postgres que
      // el catch de abajo traduce a un mensaje legible.
      const { error } = await supabaseClient.from('historias').delete().eq('id', historiaId);
      if (error) throw error;

      ctx.cerrarHoja();
      ctx.onCerrarTodo();
    } catch (error) {
      console.error('ver-historia-propia – eliminar:', error);
      eliminando = false;
      errorEliminar = mensajeError(error);
      ctx.actualizar();
    }
  }

  function mensajeError(error) {
    const texto = error?.message ?? String(error);
    if (texto.includes('23503') || texto.includes('violates foreign key')) {
      return 'todavía tiene datos relacionados (vistas, likes o comentarios) que no se pudieron limpiar. Avísale al equipo de desarrollo.';
    }
    return texto;
  }

  // ═══════════════════════════════════════════════════════════
  // HOJA: Comentarios + Reacciones + Eliminar
  // ═══════════════════════════════════════════════════════════

  function plantillaHoja(ctx) {
    return `
      <div class="vh-hoja">
        <div class="vh-hoja__barra-superior">
          <span class="vh-hoja__icono-actividad">👥</span>
          <span class="vh-hoja__spacer"></span>
          ${
            eliminando
              ? '<span class="btn-spinner" style="width:18px;height:18px;border-width:2px;border-top-color:#ff453a;"></span>'
              : '<button class="vh-hoja__btn-eliminar" data-vh-eliminar aria-label="Eliminar historia">🗑️</button>'
          }
        </div>

        <p class="vh-hoja__titulo">Comentarios</p>
        <div class="vh-hoja__lista">
          ${
            ctx.comentarios.length === 0
              ? '<p class="vh-hoja__vacio">Sin comentarios aún</p>'
              : ctx.comentarios
                  .slice(0, 4)
                  .map((c) => ctx.renderComentario(c))
                  .join('')
          }
        </div>
        ${
          ctx.comentarios.length > 4
            ? `<button class="vh-hoja__ver-todo" data-vh-ver-todos-comentarios>Ver todo</button>`
            : ''
        }

        <p class="vh-hoja__titulo" style="margin-top:16px;">Reacciones</p>
        <div class="vh-hoja__lista">
          ${
            actividad.length === 0
              ? '<p class="vh-hoja__vacio">Nadie ha reaccionado aún</p>'
              : actividad.map((item) => itemActividadHtml(item)).join('')
          }
        </div>

        ${errorEliminar ? `<p class="vh-hoja__error">No se pudo eliminar la historia: ${escaparHtml(errorEliminar)}</p>` : ''}
      </div>
    `;
  }

  function itemActividadHtml(item) {
    const foto = resolverUrlPerfil(item.perfil);
    const nombre = item.perfil.nombre ?? '';
    return `
      <div class="vh-actividad-item" data-vh-actividad-id="${item.usuario_id}">
        <div class="vh-actividad-item__avatar">
          ${foto ? `<img src="${foto}" alt="" />` : '👤'}
          ${item.reacciono ? '<span class="vh-actividad-item__corazon">❤️</span>' : ''}
        </div>
        <div class="vh-actividad-item__info">
          <p class="vh-actividad-item__nombre">${escaparHtml(nombre)}</p>
          <p class="vh-actividad-item__tiempo">${tiempoTranscurrido(item.visto_en)}</p>
        </div>
        ${!item.reacciono ? '<span class="vh-actividad-item__ojo">👁️</span>' : ''}
      </div>
    `;
  }

  function activarHoja(cuerpoEl, ctx) {
    cuerpoEl.querySelector('[data-vh-eliminar]')?.addEventListener('click', () => eliminarHistoria(ctx));
    cuerpoEl.querySelectorAll('[data-vh-comentario-id]').forEach((el) => {
      const c = ctx.comentarios.find((com) => String(com.id) === el.dataset.vhComentarioId);
      if (c) ctx.activarComentario(el, c);
    });
    cuerpoEl.querySelectorAll('[data-vh-actividad-id]').forEach((el) => {
      el.addEventListener('click', () => {
        ctx.pausarParaNavegar();
        // TODO: pendiente módulo Mi Perfil — ver nota en ver-historia-base.js
        import('../../../../core/router.js').then(({ navegarA }) => navegarA(`/perfil-publico/${el.dataset.vhActividadId}`));
      });
    });
    cuerpoEl.querySelector('[data-vh-ver-todos-comentarios]')?.addEventListener('click', () => {
      // Simplificación: en vez de una segunda hoja apilada (como en
      // Dart), se expande la lista completa dentro de la misma hoja.
      cuerpoEl.querySelector('.vh-hoja__lista').innerHTML = ctx.comentarios.map((c) => ctx.renderComentario(c)).join('');
      cuerpoEl.querySelectorAll('[data-vh-comentario-id]').forEach((el) => {
        const c = ctx.comentarios.find((com) => String(com.id) === el.dataset.vhComentarioId);
        if (c) ctx.activarComentario(el, c);
      });
      cuerpoEl.querySelector('[data-vh-ver-todos-comentarios]')?.remove();
    });
  }

  return controlador;
}