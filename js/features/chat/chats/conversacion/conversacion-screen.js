// ═════════════════════════════════════════════════════════════════
// conversacion-screen.js
// Ubicación: js/features/chat/chats/conversacion/conversacion-screen.js
//
// Réplica web de pantallas_ui/conversacion/conversacion_screen.dart.
// Pantalla de conversación 1 a 1: historial de mensajes, envío de
// texto/imagen/sticker/audio, responder/editar/eliminar, reacciones,
// paginación hacia atrás y cita de respuestas con scroll aproximado
// (mismo criterio que Dart: nada de "ensureVisible" sobre listas
// reconstruidas — se calcula una posición proporcional).
//
// Se monta desde chats-screen.js (reemplazando el placeholder
// "próximamente" de abrirConversacion()):
//   import('./conversacion/conversacion-screen.js')
//     .then(({ render }) => render(contenedor, { otroUsuarioId, ... }));
//
// AJUSTAR: la navegación real a "Ver perfil" depende de la función
// de routing de perfil-utils.js, que no se confirmó en este archivo
// — se usa un hash de ruta razonable (#/perfil/<id>) como valor por
// defecto; cambia SOLO la línea marcada con "AJUSTAR RUTA" si difiere.
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../../../core/supabase-client.js';
import { mostrarToast } from '../../../../core/toast.js';
import * as mensajeRepository from '../../mensaje-repository.js';
import * as chatRepository from '../../chat-repository.js';
import * as chatMediaService from '../../chat-media-service.js';
import { plantillaBurbuja, activarBurbuja } from './burbuja-mensaje.js';
import { montarComposerBar } from './composer-bar.js';
import { mostrarMenuMensaje, mostrarEditarMensaje, mostrarConfirmacion, plantillaFechaSeparador, plantillaEmptyConversacion, escaparHtml } from './conversacion-sheets.js';
import { mostrarPerfilPreview } from '../perfil-preview-sheet.js';

export async function render(contenedor, { otroUsuarioId, otroNombre, otroNombreUsuario = null, otroAvatarUrl = null, contextoObjeto = null }) {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const miId = user?.id || '';

  let recientes = [];
  let historicos = [];
  let hayMasPaginas = true;
  let cargandoPagina = false;
  let mensajeDestacado = null;
  let cancelarSub = null;
  let irAMensajePendiente = null;

  contenedor.innerHTML = `
    <div class="conv-screen">
      <div class="conv-appbar" id="conv-appbar"></div>
      <div class="conv-mensajes-zona" id="conv-mensajes-zona">
        <div class="conv-mensajes" id="conv-mensajes"></div>
        <button class="conv-boton-scroll" id="conv-boton-scroll" style="display:none">⌄</button>
      </div>
      <div class="conv-composer-zona" id="conv-composer-zona"></div>
    </div>
  `;

  // ── AppBar ────────────────────────────────────────────────────
  const appbar = contenedor.querySelector('#conv-appbar');
  const inicial = (otroNombre || '?').trim().charAt(0).toUpperCase();
  appbar.innerHTML = `
    <button class="conv-appbar__back" id="conv-back">←</button>
    <button class="conv-appbar__perfil" id="conv-abrir-perfil">
      <span class="conv-appbar__avatar">
        ${otroAvatarUrl ? `<img src="${otroAvatarUrl}" alt="" />` : `<span class="chats-avatar__inicial">${inicial}</span>`}
      </span>
      <span class="conv-appbar__textos">
        <span class="conv-appbar__nombre">${escaparHtml(otroNombre)}</span>
        ${otroNombreUsuario ? `<span class="conv-appbar__usuario">@${escaparHtml(otroNombreUsuario)}</span>` : ''}
      </span>
    </button>
  `;
  appbar.querySelector('#conv-back').addEventListener('click', salir);
  appbar.querySelector('#conv-abrir-perfil').addEventListener('click', () => {
    mostrarPerfilPreview({
      usuarioId: otroUsuarioId,
      nombre: otroNombre,
      nombreUsuario: otroNombreUsuario,
      avatarUrl: otroAvatarUrl,
      onVerPerfil: () => {
        // AJUSTAR RUTA si perfil-utils.js expone otra convención.
        window.location.hash = `#/perfil/${otroUsuarioId}`;
      },
    });
  });

  function salir() {
    if (cancelarSub) cancelarSub();
    chatRepository.marcarComoLeido(otroUsuarioId);
    window.history.back();
  }

  // ── Composer ──────────────────────────────────────────────────
  const composerZona = contenedor.querySelector('#conv-composer-zona');
  const composer = montarComposerBar(composerZona, {
    miId,
    otroUsuarioId,
    otroNombre,
    otroNombreUsuario,
    otroAvatarUrl,
    contextoObjetoInicial: contextoObjeto,
    onEnviarTexto: async (texto, { respuesta, contexto }) => {
      await mensajeRepository.enviarMensaje({
        otroUsuarioId,
        otroNombre,
        otroNombreUsuario,
        otroAvatarUrl,
        contenido: texto,
        contextoDescripcion: contexto?.descripcion,
        contextoImagenUrl: contexto?.imagenUrl,
        contextoLugar: contexto?.lugar,
        contextoObjetoId: contexto?.id,
        contextoTipo: contexto ? (contexto.tipo === 'marketplace' ? 'marketplace' : 'objeto_perdido') : null,
        respuestaAMensajeId: respuesta?.mensajeId,
        respuestaAContenido: respuesta?.contenido || respuesta?.tipo,
        respuestaATipo: respuesta?.tipo,
        respuestaAEmisorId: respuesta?.emisorId,
      });
    },
  });

  // ── Lista combinada ordenada, sin duplicados ─────────────────
  function todos() {
    if (historicos.length === 0) return recientes;
    const idsRecientes = new Set(recientes.map((m) => m.mensajeId));
    return [...historicos.filter((m) => !idsRecientes.has(m.mensajeId)), ...recientes];
  }

  const zonaMensajes = contenedor.querySelector('#conv-mensajes');
  const zonaScroll = contenedor.querySelector('#conv-mensajes-zona');
  const btnScroll = contenedor.querySelector('#conv-boton-scroll');

  function estabaAbajo() {
    return zonaScroll.scrollHeight - zonaScroll.scrollTop - zonaScroll.clientHeight < 40;
  }

  function scrollAlFondo() {
    zonaScroll.scrollTo({ top: zonaScroll.scrollHeight, behavior: 'smooth' });
  }

  function renderMensajes({ mantenerScroll = false } = {}) {
    const lista = todos();
    const alturaAntes = zonaScroll.scrollHeight;
    const scrollAntes = zonaScroll.scrollTop;

    if (lista.length === 0) {
      zonaMensajes.innerHTML = plantillaEmptyConversacion(otroNombre);
      return;
    }

    let html = '';
    if (cargandoPagina) html += `<div class="conv-cargando-pagina"><span class="chats-spinner"></span></div>`;

    lista.forEach((msg, idx) => {
      const esMio = msg.emisorId === miId;
      const anterior = idx > 0 ? lista[idx - 1] : null;
      const siguiente = idx < lista.length - 1 ? lista[idx + 1] : null;
      const mostrarFecha = !anterior || !mismoDia(msg.timestamp, anterior.timestamp);
      const esUltimoDelGrupo =
        !siguiente ||
        siguiente.emisorId !== msg.emisorId ||
        Math.abs(new Date(siguiente.timestamp) - new Date(msg.timestamp)) / 60000 > 10;

      if (mostrarFecha) html += plantillaFechaSeparador(msg.timestamp);
      html += plantillaBurbuja(msg, {
        esMio,
        esUltimoDelGrupo,
        miId,
        otroNombre,
        destacado: msg.mensajeId === mensajeDestacado,
      });
    });

    zonaMensajes.innerHTML = html;

    lista.forEach((msg) => {
      const fila = zonaMensajes.querySelector(`[data-mensaje-id="${msg.mensajeId}"]`);
      if (fila) activarBurbujaFila(fila, msg);
    });

    if (mantenerScroll) {
      zonaScroll.scrollTop = scrollAntes + (zonaScroll.scrollHeight - alturaAntes);
    }
  }

  function activarBurbujaFila(fila, msg) {
    activarBurbuja(fila, msg, {
      onLongPress: (m) => abrirMenuMensaje(m, m.emisorId === miId),
      onReintentar: (m) => reintentarMensaje(m),
      onTapReaccion: (m, emoji) => alternarReaccion(m, emoji),
      onTapRespuesta: (mensajeId) => irAMensaje(mensajeId),
      onResponder: (m) => iniciarRespuesta(m),
    });
  }

  function iniciarRespuesta(msg) {
    if (msg.eliminado) return;
    composer.iniciarRespuesta(msg);
  }

  // ── Scroll: mostrar botón + paginar hacia arriba ─────────────
  zonaScroll.addEventListener('scroll', () => {
    const mostrar = zonaScroll.scrollHeight - zonaScroll.scrollTop - zonaScroll.clientHeight > 150;
    btnScroll.style.display = mostrar ? '' : 'none';

    if (zonaScroll.scrollTop <= 80 && hayMasPaginas && !cargandoPagina) {
      cargarPaginaAnterior();
    }
  });
  btnScroll.addEventListener('click', scrollAlFondo);

  async function cargarPaginaAnterior() {
    if (cargandoPagina || !hayMasPaginas) return;
    cargandoPagina = true;
    const cursor = todos().length ? todos()[0].timestamp : new Date().toISOString();
    renderMensajes();

    const pagina = await mensajeRepository.cargarPagina({ otroUsuarioId, antes: cursor });
    if (pagina.length === 0) {
      hayMasPaginas = false;
    } else {
      const idsExistentes = new Set(historicos.map((m) => m.mensajeId));
      const nuevos = pagina.filter((m) => !idsExistentes.has(m.mensajeId));
      historicos = [...nuevos, ...historicos];
    }
    cargandoPagina = false;
    renderMensajes({ mantenerScroll: true });
  }

  // ── Ir a mensaje citado ───────────────────────────────────────
  async function irAMensaje(mensajeId) {
    const lista = todos();
    const idx = lista.findIndex((m) => m.mensajeId === mensajeId);
    if (idx === -1) {
      if (hayMasPaginas && !cargandoPagina) {
        await cargarPaginaAnterior();
        return irAMensaje(mensajeId);
      }
      mostrarToast('No se encontró el mensaje original', 'error');
      return;
    }
    const proporcion = idx / lista.length;
    zonaScroll.scrollTo({ top: zonaScroll.scrollHeight * proporcion, behavior: 'smooth' });
    mensajeDestacado = mensajeId;
    renderMensajes();
    setTimeout(() => {
      mensajeDestacado = null;
      renderMensajes();
    }, 900);
  }

  // ── Acciones sobre un mensaje ─────────────────────────────────
  async function abrirMenuMensaje(msg, esMio) {
    if (msg.eliminado) return;
    const accion = await mostrarMenuMensaje({
      esMio,
      esTexto: msg.tipo === 'texto',
      esSticker: msg.tipo === 'sticker',
      miReaccionActual: (msg.reacciones || {})[miId],
    });
    if (!accion) return;

    if (accion.startsWith('emoji:')) {
      await alternarReaccion(msg, accion.slice('emoji:'.length));
      return;
    }
    switch (accion) {
      case 'responder':
        iniciarRespuesta(msg);
        break;
      case 'copiar':
        navigator.clipboard?.writeText(msg.contenido || '');
        mostrarToast('Mensaje copiado', 'success');
        break;
      case 'editar':
        await editarMensaje(msg);
        break;
      case 'eliminar':
        await eliminarMensaje(msg);
        break;
      case 'guardar_sticker':
        await guardarSticker(msg);
        break;
    }
  }

  async function editarMensaje(msg) {
    const nuevoTexto = await mostrarEditarMensaje(msg.contenido || '');
    if (nuevoTexto == null) return;
    const limpio = nuevoTexto.trim();
    if (!limpio || limpio === msg.contenido) return;
    await mensajeRepository.editarMensaje({ msg, nuevoContenido: limpio, otroUsuarioId });
  }

  async function eliminarMensaje(msg) {
    const confirmar = await mostrarConfirmacion({
      titulo: 'Eliminar mensaje',
      mensaje: 'Se eliminará para ambos. Esta acción no se puede deshacer.',
      textoConfirmar: 'Eliminar',
      peligroso: true,
    });
    if (!confirmar) return;
    await mensajeRepository.eliminarMensaje({ msg, otroUsuarioId });
    if (composer.obtenerRespuestaActiva()?.mensajeId === msg.mensajeId) composer.cancelarRespuesta();
  }

  async function alternarReaccion(msg, emoji) {
    const actual = (msg.reacciones || {})[miId];
    if (actual === emoji) {
      await mensajeRepository.quitarReaccion({ mensajeId: msg.mensajeId, otroUsuarioId });
    } else {
      await mensajeRepository.reaccionar({ mensajeId: msg.mensajeId, otroUsuarioId, emoji });
    }
  }

  async function guardarSticker(msg) {
    if (!msg.mediaUrlRemota) return;
    const { default: stickersRecientesService } = await import('../../servicios/stickers-recientes-service.js').then((m) => ({ default: m }));
    stickersRecientesService.agregar({ url: msg.mediaUrlRemota, ancho: msg.mediaAncho, alto: msg.mediaAlto });
    mostrarToast('Sticker guardado', 'success');
  }

  async function reintentarMensaje(msg) {
    const confirmar = await mostrarConfirmacion({
      titulo: 'Mensaje no enviado',
      mensaje: '¿Quieres intentar enviar este mensaje de nuevo?',
      textoConfirmar: 'Reintentar',
    });
    if (!confirmar) return;
    await mensajeRepository.reintentarMensajeEspecifico({ msg, otroUsuarioId });
  }

  function mismoDia(a, b) {
    const fa = new Date(a);
    const fb = new Date(b);
    return fa.getFullYear() === fb.getFullYear() && fa.getMonth() === fb.getMonth() && fa.getDate() === fb.getDate();
  }

  // ── Ciclo de vida ────────────────────────────────────────────
  chatRepository.marcarComoLeido(otroUsuarioId);
  mensajeRepository.reintentarFallidos({ otroUsuarioId });

  await mensajeRepository.sincronizarDesdeSupabase({ otroUsuarioId, miId });

  cancelarSub = mensajeRepository.watchMensajes(otroUsuarioId, (msgs) => {
    const abajo = !zonaScroll || estabaAbajo();
    const llegaronNuevos = msgs.length > recientes.length;
    recientes = msgs;
    if (llegaronNuevos) hayMasPaginas = true;
    renderMensajes();
    if (llegaronNuevos) chatRepository.marcarComoLeido(otroUsuarioId);
    if (abajo) requestAnimationFrame(scrollAlFondo);
  });

  mensajeRepository.sincronizarReaccionesDesdeSupabase({ otroUsuarioId, miId });
}