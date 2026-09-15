// comentarios-hilo.js
// Ruta real: js/features/social/publicaciones/tarjeta-publicaciones/comentarios-hilo.js
//
// Motor compartido de comentarios, extraído de la lógica que antes
// vivía únicamente dentro de hoja-comentarios.js. La idea: tanto la
// hoja flotante (hoja-comentarios.js, se abre desde el feed) como la
// pantalla completa (ver-publicacion.js, se llega desde historial de
// reacciones/comentarios) necesitan exactamente el mismo
// comportamiento — cargar comentarios, responder, editar, eliminar,
// reaccionar, @menciones — solo cambia el "shell" visual que los
// envuelve (bottom-sheet vs. pantalla con su propio historial).
//
// Este archivo expone dos piezas independientes:
//
//   1. crearControladorComentarios({ post, uid, onCambio })
//      El estado y las operaciones de datos (Supabase). No toca el
//      DOM directamente — llama a onCambio() cada vez que algo que
//      afecta a la LISTA cambió (cargó, se editó, se eliminó, se
//      reaccionó), para que quien lo use vuelva a pintar su lista.
//      Las operaciones de "responder"/"editar" (iniciarRespuesta,
//      iniciarEdicion) NO llaman a onCambio() — solo devuelven el
//      texto a precargar en el input; es el caller quien decide
//      cuándo refrescar el composer (ver ejemplos de uso en
//      hoja-comentarios.js y ver-publicacion.js).
//
//   2. renderComposerComentario() + activarComposerComentario(zona, controlador)
//      El input de abajo con su banner de "editando"/"respondiendo a"
//      y el autocompletado de @menciones. Reutilizable tal cual en
//      cualquier shell, siempre que el contenedor le dé una zona
//      vacía donde inyectar su HTML.
//
// DIFERENCIA DE PLATAFORMA — AlertDialog de confirmar eliminar: ver
// nota igual en hoja-comentarios.js — no hay diálogo nativo del
// sistema equivalente con botones personalizados; se resuelve con un
// overlay propio mínimo (confirmarEliminarComentario, al final del
// archivo) reutilizando las clases globales .glass-card/.btn-outline
// de glassmorphism.css.

import { supabaseClient } from '../../../../core/supabase-client.js';
import { tipoReaccionDesdeString, tipoReaccionAString } from './reacciones.js';
import {
  buscarPerfilesMencion,
  detectarQueryMencion,
  indiceArrobaActiva,
  aplicarMencionSeleccionada,
  renderPanelMenciones,
  activarPanelMenciones,
} from '../mencion-autocomplete.js';

const DEBOUNCE_MENCION_MS = 250;

// ═══════════════════════════════════════════════════════════════
// CONTROLADOR — estado + operaciones de datos
// ═══════════════════════════════════════════════════════════════

/**
 * @param {Object} opciones
 * @param {Object} opciones.post - debe traer al menos 'id'.
 * @param {?string} [opciones.uid]
 * @param {() => void} opciones.onCambio - se dispara cuando cambia algo que afecta a la lista (cargó, editó, eliminó, reaccionó).
 */
export function crearControladorComentarios({ post, uid = null, onCambio }) {
  let comentarios = [];
  let cargando = true;
  let enviando = false;
  let respondiendo = null;
  let nombreRespondiendo = null;
  let editando = null;

  // ── Carga ────────────────────────────────────────────────────

  async function cargar() {
    cargando = true;
    onCambio();
    try {
      const { data, error } = await supabaseClient
        .from('comentarios')
        .select(
          'id, contenido, creado_en, autor_id, parent_id, editado_en, ' +
            'perfiles!comentarios_autor_id_fkey(id, nombre, nombre_usuario, cdn_foto_perfil)'
        )
        .eq('publicacion_id', post.id)
        .order('creado_en', { ascending: true });
      if (error) throw error;

      const filas = data ?? [];
      const ids = filas.map((c) => c.id);

      const misReacciones = {};
      const totales = {};

      if (ids.length > 0) {
        const { data: likesData, error: likesError } = await supabaseClient
          .from('reacciones_comentarios')
          .select('comentario_id, usuario_id, tipo')
          .in('comentario_id', ids);
        if (likesError) throw likesError;

        (likesData ?? []).forEach((l) => {
          totales[l.comentario_id] = (totales[l.comentario_id] ?? 0) + 1;
          if (l.usuario_id === uid) {
            misReacciones[l.comentario_id] = tipoReaccionDesdeString(l.tipo);
          }
        });
      }

      comentarios = filas.map((c) => ({
        ...c,
        mi_reaccion: misReacciones[c.id] ?? null,
        total_likes: totales[c.id] ?? 0,
      }));
    } catch (error) {
      console.error('comentarios-hilo – cargar:', error);
    } finally {
      cargando = false;
      onCambio();
    }
  }

  function getState() {
    return { cargando, comentarios, enviando, respondiendo, nombreRespondiendo, editando };
  }

  // Info que el composer necesita para pintar su banner, sin
  // exponer el estado interno completo.
  function getAccionActual() {
    if (editando != null) return { tipo: 'editar' };
    if (respondiendo != null) return { tipo: 'responder', nombre: nombreRespondiendo };
    return { tipo: null };
  }

  // ── Responder / editar / cancelar ───────────────────────────
  // Devuelven el texto a precargar en el input; no llaman a
  // onCambio() — el caller decide cuándo refrescar (ver nota al
  // inicio del archivo).

  function iniciarRespuesta(comentario) {
    const perfil = comentario.perfiles ?? {};
    const esRespuesta = comentario.parent_id != null;
    const idRaiz = esRespuesta ? comentario.parent_id : comentario.id;

    editando = null;
    respondiendo = idRaiz;
    nombreRespondiendo = perfil.nombre ?? null;
    return esRespuesta ? `@${perfil.nombre_usuario ?? ''} ` : '';
  }

  function iniciarEdicion(comentario) {
    respondiendo = null;
    nombreRespondiendo = null;
    editando = comentario.id;
    return comentario.contenido ?? '';
  }

  function cancelarAccion() {
    respondiendo = null;
    nombreRespondiendo = null;
    editando = null;
  }

  // ── Envío / edición ──────────────────────────────────────────

  // Punto de entrada único que usa el composer: decide sola si debe
  // insertar un comentario nuevo o guardar una edición, según el
  // estado actual (editando/respondiendo). Devuelve true si se pudo
  // enviar (para que el composer limpie el input).
  async function enviarTexto(textoOriginal) {
    const texto = (textoOriginal ?? '').trim();
    if (!texto || !uid) return false;
    return editando != null ? guardarEdicion(texto) : enviarComentario(texto);
  }

  async function enviarComentario(texto) {
    enviando = true;
    try {
      const { error } = await supabaseClient.from('comentarios').insert({
        publicacion_id: post.id,
        autor_id: uid,
        contenido: texto,
        parent_id: respondiendo,
      });
      if (error) throw error;
      respondiendo = null;
      nombreRespondiendo = null;
      await cargar();
      return true;
    } catch (error) {
      console.error('comentarios-hilo – enviar:', error);
      return false;
    } finally {
      enviando = false;
    }
  }

  async function guardarEdicion(texto) {
    const id = editando;
    enviando = true;
    try {
      const ahora = new Date().toISOString();
      const { error } = await supabaseClient.from('comentarios').update({ contenido: texto, editado_en: ahora }).eq('id', id);
      if (error) throw error;

      const idx = comentarios.findIndex((c) => c.id === id);
      if (idx !== -1) comentarios[idx] = { ...comentarios[idx], contenido: texto, editado_en: ahora };
      editando = null;
      onCambio();
      return true;
    } catch (error) {
      console.error('comentarios-hilo – editar:', error);
      return false;
    } finally {
      enviando = false;
    }
  }

  // ── Reacciones por comentario ────────────────────────────────

  async function reaccionar(comentario, tipo) {
    if (!uid) return;
    const cid = comentario.id;
    const antes = comentario.mi_reaccion ?? null;

    const idx = comentarios.findIndex((c) => c.id === cid);
    if (idx === -1) return;
    const totalActual = comentarios[idx].total_likes;
    comentarios[idx] = {
      ...comentarios[idx],
      mi_reaccion: tipo,
      total_likes: totalActual + (antes == null && tipo != null ? 1 : 0) - (antes != null && tipo == null ? 1 : 0),
    };
    onCambio();

    try {
      if (tipo == null) {
        await supabaseClient.from('reacciones_comentarios').delete().eq('comentario_id', cid).eq('usuario_id', uid);
      } else if (antes == null) {
        await supabaseClient.from('reacciones_comentarios').insert({ comentario_id: cid, usuario_id: uid, tipo: tipoReaccionAString(tipo) });
      } else {
        await supabaseClient.from('reacciones_comentarios').update({ tipo: tipoReaccionAString(tipo) }).eq('comentario_id', cid).eq('usuario_id', uid);
      }
    } catch (error) {
      console.error('comentarios-hilo – reaccionar:', error);
      const idx2 = comentarios.findIndex((c) => c.id === cid);
      if (idx2 === -1) return;
      const totalActual2 = comentarios[idx2].total_likes;
      comentarios[idx2] = {
        ...comentarios[idx2],
        mi_reaccion: antes,
        total_likes: totalActual2 + (antes != null && tipo == null ? 1 : 0) - (antes == null && tipo != null ? 1 : 0),
      };
      onCambio();
    }
  }

  // ── Eliminar ─────────────────────────────────────────────────

  async function confirmarEliminar(comentario) {
    const ok = await confirmarEliminarComentario(comentario);
    if (!ok) return;
    await eliminarComentario(comentario);
  }

  async function eliminarComentario(comentario) {
    const id = comentario.id;
    const esRaiz = comentario.parent_id == null;
    try {
      if (esRaiz) {
        const idsRespuestas = comentarios.filter((c) => c.parent_id === id).map((c) => c.id);
        if (idsRespuestas.length > 0) {
          await supabaseClient.from('reacciones_comentarios').delete().in('comentario_id', idsRespuestas);
          await supabaseClient.from('comentarios').delete().in('id', idsRespuestas);
        }
      }
      await supabaseClient.from('reacciones_comentarios').delete().eq('comentario_id', id);
      await supabaseClient.from('comentarios').delete().eq('id', id);

      comentarios = comentarios.filter((c) => c.id !== id && c.parent_id !== id);
      if (editando === id) editando = null;
      if (respondiendo === id) {
        respondiendo = null;
        nombreRespondiendo = null;
      }
      onCambio();
    } catch (error) {
      console.error('comentarios-hilo – eliminar:', error);
    }
  }

  // ── Formato de tiempo ────────────────────────────────────────

  function tiempo(fechaStr) {
    if (!fechaStr) return '';
    const fecha = new Date(fechaStr);
    if (Number.isNaN(fecha.getTime())) return '';
    const diffMs = Date.now() - fecha.getTime();
    const seg = Math.floor(diffMs / 1000);
    const min = Math.floor(diffMs / 60000);
    const horas = Math.floor(diffMs / 3600000);
    const dias = Math.floor(diffMs / 86400000);
    if (seg < 60) return 'ahora';
    if (min < 60) return `hace ${min} min`;
    if (horas < 24) return `hace ${horas} h`;
    if (dias < 7) return `hace ${dias} d`;
    return `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
  }

  return {
    cargar,
    getState,
    getAccionActual,
    iniciarRespuesta,
    iniciarEdicion,
    cancelarAccion,
    enviarTexto,
    reaccionar,
    confirmarEliminar,
    tiempo,
  };
}

// ═══════════════════════════════════════════════════════════════
// COMPOSER — input + banner + @menciones
// ═══════════════════════════════════════════════════════════════
//
// Reutiliza las clases de hoja-comentarios.css (banner/campo/input/
// enviar) para que se vea igual en la hoja flotante y en la pantalla
// completa sin necesidad de CSS nuevo.

export function renderComposerComentario() {
  return `
    <div class="hoja-comentarios__menciones" id="cc-menciones"></div>
    <div class="hoja-comentarios__banner" id="cc-banner" hidden>
      <span class="hoja-comentarios__banner-icono" id="cc-banner-icono"></span>
      <span class="hoja-comentarios__banner-texto" id="cc-banner-texto"></span>
      <button class="hoja-comentarios__banner-cerrar" id="cc-banner-cerrar" aria-label="Cancelar">✕</button>
    </div>
    <div class="hoja-comentarios__campo">
      <input type="text" class="hoja-comentarios__input" id="cc-input" placeholder="Escribe un comentario..." autocomplete="off" />
      <button class="hoja-comentarios__enviar" id="cc-enviar" aria-label="Enviar">
        <span id="cc-enviar-icono">➤</span>
      </button>
    </div>
  `;
}

/**
 * @param {HTMLElement} zona - contenedor ya en el DOM con el HTML de renderComposerComentario() adentro.
 * @param {Object} controlador - lo que devuelve crearControladorComentarios().
 * @returns {{ enfocar: () => void, prefillInput: (texto: string) => void, actualizar: () => void }}
 */
export function activarComposerComentario(zona, controlador) {
  const elMenciones = zona.querySelector('#cc-menciones');
  const elBanner = zona.querySelector('#cc-banner');
  const elBannerIcono = zona.querySelector('#cc-banner-icono');
  const elBannerTexto = zona.querySelector('#cc-banner-texto');
  const elInput = zona.querySelector('#cc-input');
  const elEnviarBtn = zona.querySelector('#cc-enviar');
  const elEnviarIcono = zona.querySelector('#cc-enviar-icono');

  let debounceMencion = null;
  let sugerenciasMencion = [];
  let buscandoMencion = false;
  let inicioArrobaActiva = null;

  // ── Banner + placeholder según la acción actual del controlador ──

  function actualizar() {
    const accion = controlador.getAccionActual();
    const estado = controlador.getState();

    if (accion.tipo === 'editar') {
      elBannerIcono.textContent = '✎';
      elBannerTexto.textContent = 'Editando comentario';
      elBanner.classList.remove('hoja-comentarios__banner--respuesta');
      elBanner.hidden = false;
    } else if (accion.tipo === 'responder') {
      elBannerIcono.textContent = '↩';
      elBannerTexto.textContent = `Respondiendo a ${accion.nombre ?? ''}`;
      elBanner.classList.add('hoja-comentarios__banner--respuesta');
      elBanner.hidden = false;
    } else {
      elBanner.hidden = true;
    }

    elInput.placeholder = accion.tipo === 'editar' ? 'Edita tu comentario...' : accion.tipo === 'responder' ? 'Escribe tu respuesta...' : 'Escribe un comentario...';

    elEnviarBtn.disabled = estado.enviando;
    elEnviarIcono.innerHTML = estado.enviando ? '<span class="btn-spinner btn-spinner--chico"></span>' : accion.tipo === 'editar' ? '✓' : '➤';
  }

  function enfocar() {
    elInput.focus();
  }

  function prefillInput(texto) {
    elInput.value = texto ?? '';
    elInput.focus();
    elInput.setSelectionRange(elInput.value.length, elInput.value.length);
  }

  // ── Envío ────────────────────────────────────────────────────

  async function onEnviarPresionado() {
    if (controlador.getState().enviando) return;
    const ok = await controlador.enviarTexto(elInput.value);
    if (ok) elInput.value = '';
    actualizar();
  }

  function cancelar() {
    controlador.cancelarAccion();
    elInput.value = '';
    actualizar();
  }

  // ── @menciones — mismo criterio que hoja-comentarios.js ─────────

  function onCambioTexto() {
    const texto = elInput.value;
    const cursor = elInput.selectionStart ?? -1;
    if (cursor < 0) return;

    const idxArroba = indiceArrobaActiva(texto, cursor);
    const query = detectarQueryMencion(texto, cursor);

    if (idxArroba == null || query == null) {
      if (sugerenciasMencion.length > 0 || inicioArrobaActiva != null) {
        sugerenciasMencion = [];
        inicioArrobaActiva = null;
        renderMenciones();
      }
      return;
    }

    inicioArrobaActiva = idxArroba;
    clearTimeout(debounceMencion);
    debounceMencion = setTimeout(async () => {
      buscandoMencion = true;
      renderMenciones();
      const resultados = await buscarPerfilesMencion(query);
      sugerenciasMencion = resultados;
      buscandoMencion = false;
      renderMenciones();
    }, DEBOUNCE_MENCION_MS);
  }

  function seleccionarMencion(perfil) {
    const cursor = elInput.selectionStart ?? -1;
    if (inicioArrobaActiva == null || cursor < 0) return;

    const { texto, cursorPos } = aplicarMencionSeleccionada({
      texto: elInput.value,
      inicioArroba: inicioArrobaActiva,
      cursorPos: cursor,
      nombreUsuario: perfil.nombre_usuario ?? '',
    });
    elInput.value = texto;
    elInput.focus();
    elInput.setSelectionRange(cursorPos, cursorPos);

    sugerenciasMencion = [];
    inicioArrobaActiva = null;
    renderMenciones();
  }

  function renderMenciones() {
    elMenciones.innerHTML = renderPanelMenciones(sugerenciasMencion, { cargando: buscandoMencion });
    activarPanelMenciones(elMenciones, sugerenciasMencion, seleccionarMencion);
  }

  // ── Listeners ────────────────────────────────────────────────

  elInput.addEventListener('input', onCambioTexto);
  elInput.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') onEnviarPresionado();
  });
  elEnviarBtn.addEventListener('click', onEnviarPresionado);
  elBanner.querySelector('#cc-banner-cerrar')?.addEventListener('click', cancelar);

  actualizar();

  return { enfocar, prefillInput, actualizar };
}

// ═══════════════════════════════════════════════════════════════
// CONFIRMAR ELIMINAR — mismo overlay que usaba hoja-comentarios.js
// ═══════════════════════════════════════════════════════════════

function confirmarEliminarComentario(comentario) {
  return new Promise((resolve) => {
    const esRaiz = comentario.parent_id == null;
    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    overlay.innerHTML = `
      <div class="glass-card confirm-dialog">
        <p class="confirm-dialog__titulo">Eliminar comentario</p>
        <p class="confirm-dialog__texto">
          ${
            esRaiz
              ? '¿Eliminar este comentario y todas sus respuestas? Esta acción no se puede deshacer.'
              : '¿Eliminar esta respuesta? Esta acción no se puede deshacer.'
          }
        </p>
        <div class="confirm-dialog__acciones">
          <button class="btn-outline" data-cancelar>Cancelar</button>
          <button class="confirm-dialog__eliminar" data-confirmar>Eliminar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    function cerrarCon(valor) {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 150);
      resolve(valor);
    }

    overlay.querySelector('[data-cancelar]').addEventListener('click', () => cerrarCon(false));
    overlay.querySelector('[data-confirmar]').addEventListener('click', () => cerrarCon(true));
    overlay.addEventListener('click', (evento) => {
      if (evento.target === overlay) cerrarCon(false);
    });
  });
}