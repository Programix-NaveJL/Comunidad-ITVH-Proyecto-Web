// ═════════════════════════════════════════════════════════════════
// mensaje-repository.js
//
// Réplica web de Pantallas/JaguarChat/Chats/mensaje_repository.dart.
// Capa de datos de los MENSAJES dentro de una conversación (la lista
// de chats es chat-repository.js). Guarda/lee la tabla 'mensajes' de
// IndexedDB y sincroniza con la cola transitoria `mensajes_pendientes`
// de Supabase — misma arquitectura que móvil: local-first, la cola
// de Supabase solo transporta el mensaje hasta que ambos lados lo
// tengan guardado localmente.
//
// Diferencia notada respecto a Dart: no existe backup-service.js en
// web todavía, así que la llamada equivalente a
// BackupService.instancia.respaldarSiNecesario() queda pendiente
// (ver comentario en enviarMensaje).
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../core/supabase-client.js';
import {
  TABLA_MENSAJES,
  suscribir,
  obtenerPorId,
  guardar,
  obtenerPorIndice,
  consultarConCursor,
} from './servicios/db-service.js';
import {
  TipoMensaje,
  EstadoMensaje,
  esMedia,
  crearMensaje,
  textoPreview,
  empaquetarMetadata,
  desempaquetarMetadata,
  aplicarMetadata,
  mensajeDesdeSupabase,
} from './mensaje-model.js';
import * as chatRepository from './chat-repository.js';

const LIMITE_STREAM = 60;

// ── Streams ──────────────────────────────────────────────────────

/**
 * Últimos LIMITE_STREAM mensajes de la conversación con
 * [otroUsuarioId], en orden cronológico ascendente (igual que
 * watchMensajes() en Dart: pide desc + limit, y voltea el arreglo).
 */
export function watchMensajes(otroUsuarioId, callback) {
  const emitir = async () => {
    const rango = IDBKeyRange.bound([otroUsuarioId, ''], [otroUsuarioId, '\uffff']);
    const desc = await consultarConCursor(TABLA_MENSAJES, 'porChatYFecha', rango, {
      direccion: 'prev',
      limite: LIMITE_STREAM,
    });
    callback(desc.reverse());
  };
  emitir();
  return suscribir(TABLA_MENSAJES, emitir);
}

// ── Paginación ───────────────────────────────────────────────────

export async function cargarPagina({ otroUsuarioId, antes, cantidad = 40 }) {
  const antesIso = new Date(antes).toISOString();
  // Límite superior exclusivo: solo mensajes ANTERIORES a [antes].
  const rango = IDBKeyRange.bound([otroUsuarioId, ''], [otroUsuarioId, antesIso], false, true);
  const desc = await consultarConCursor(TABLA_MENSAJES, 'porChatYFecha', rango, {
    direccion: 'prev',
    limite: cantidad,
  });
  return desc.reverse();
}

// ── Sincronización inicial ──────────────────────────────────────

export async function sincronizarDesdeSupabase({ otroUsuarioId, miId }) {
  try {
    const { data: raw, error } = await supabaseClient
      .from('mensajes_pendientes')
      .select(
        'id, remitente_id, destinatario_id, contenido, tipo, ' +
          'media_url, creado_en, ' +
          'contexto_descripcion, contexto_imagen_url, ' +
          'contexto_lugar, contexto_objeto_id, contexto_tipo, ' +
          'respuesta_a_id, respuesta_a_contenido, respuesta_a_tipo, ' +
          'respuesta_a_emisor_id, editado, eliminado'
      )
      .or(
        `and(remitente_id.eq.${miId},destinatario_id.eq.${otroUsuarioId}),` +
          `and(remitente_id.eq.${otroUsuarioId},destinatario_id.eq.${miId})`
      )
      .order('creado_en', { ascending: false })
      .limit(50);

    if (error) throw error;
    if (!raw || raw.length === 0) return;

    const existentes = await obtenerPorIndice(TABLA_MENSAJES, 'porChat', otroUsuarioId);
    const idsExistentes = new Set(existentes.map((m) => m.mensajeId));

    const nuevos = raw
      .filter((fila) => !idsExistentes.has(fila.id))
      .map((fila) => mensajeDesdeSupabase(fila, { miId, otroId: otroUsuarioId }));

    if (nuevos.length === 0) return;

    for (const msg of nuevos) {
      await guardar(TABLA_MENSAJES, msg);
    }

    // Borra de mensajes_pendientes las filas DIRIGIDAS A MÍ que este
    // sync acaba de guardar localmente, para que el catch-up del
    // realtime no vuelva a encontrarlas y las reprocese (lo que
    // duplicaría el incremento de noLeidos). Las que YO envié no se
    // tocan: le pertenecen al flujo de entrega del otro usuario.
    const idsParaMi = nuevos.filter((m) => m.emisorId === otroUsuarioId).map((m) => m.mensajeId);

    if (idsParaMi.length > 0) {
      try {
        await supabaseClient.from('mensajes_pendientes').delete().in('id', idsParaMi);
      } catch (e) {
        console.error('mensaje-repository – sincronizarDesdeSupabase, borrado de pendientes:', e);
      }
    }
  } catch (e) {
    console.error('mensaje-repository – sincronizarDesdeSupabase:', e);
  }
}

// ── Envío ────────────────────────────────────────────────────────

export async function enviarMensaje({
  otroUsuarioId,
  otroNombre,
  otroNombreUsuario = null,
  otroAvatarUrl = null,
  contenido = null,
  tipo = TipoMensaje.TEXTO,
  mediaUrlRemota = null,
  mediaPathLocal = null,
  mediaNombreArchivo = null,
  mediaTamanioBytes = null,
  mediaDuracionMs = null,
  mediaAncho = null,
  mediaAlto = null,
  mediaThumbnailUrl = null,
  contextoDescripcion = null,
  contextoImagenUrl = null,
  contextoLugar = null,
  contextoObjetoId = null,
  contextoTipo = null,
  respuestaAMensajeId = null,
  respuestaAContenido = null,
  respuestaATipo = null,
  respuestaAEmisorId = null,
}) {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const miId = user?.id;
  if (!miId) return;

  const mensajeId = crypto.randomUUID();
  const ahora = new Date().toISOString();

  const msg = crearMensaje({
    mensajeId,
    chatOtroUsuarioId: otroUsuarioId,
    emisorId: miId,
    contenido,
    tipo,
    mediaUrlRemota,
    mediaPathLocal,
    mediaNombreArchivo,
    mediaTamanioBytes,
    mediaDuracionMs,
    mediaAncho,
    mediaAlto,
    mediaThumbnailUrl,
    timestamp: ahora,
    estado: EstadoMensaje.ENVIANDO,
    contextoDescripcion,
    contextoImagenUrl,
    contextoLugar,
    contextoObjetoId,
    contextoTipo,
    respuestaAMensajeId,
    respuestaAContenido,
    respuestaATipo,
    respuestaAEmisorId,
  });

  await guardar(TABLA_MENSAJES, msg);

  await chatRepository.actualizarPreview({
    otroUsuarioId,
    otroNombre,
    otroNombreUsuario,
    otroAvatarUrl,
    ultimoMensaje: textoPreview(msg),
    fecha: ahora,
  });

  try {
    const { error } = await supabaseClient.from('mensajes_pendientes').insert({
      id: mensajeId,
      remitente_id: miId,
      destinatario_id: otroUsuarioId,
      contenido: payloadWire(msg),
      tipo,
      media_url: mediaUrlRemota,
      contexto_descripcion: contextoDescripcion,
      contexto_imagen_url: contextoImagenUrl,
      contexto_lugar: contextoLugar,
      contexto_objeto_id: contextoObjetoId,
      contexto_tipo: contextoTipo,
      respuesta_a_id: respuestaAMensajeId,
      respuesta_a_contenido: respuestaAContenido,
      respuesta_a_tipo: respuestaATipo,
      respuesta_a_emisor_id: respuestaAEmisorId,
    });
    if (error) throw error;

    const guardado = await obtenerPorId(TABLA_MENSAJES, mensajeId);
    if (guardado) {
      guardado.estado = EstadoMensaje.ENTREGADO;
      await guardar(TABLA_MENSAJES, guardado);
    }

    // TODO: cuando exista un backup-service.js web equivalente al de
    // Dart, llamarlo aquí (BackupService.instancia.respaldarSiNecesario()).
  } catch (e) {
    console.error('mensaje-repository – enviarMensaje Supabase error:', e);
    const guardado = await obtenerPorId(TABLA_MENSAJES, mensajeId);
    if (guardado) {
      guardado.estado = EstadoMensaje.FALLIDO;
      await guardar(TABLA_MENSAJES, guardado);
    }
  }
}

// ── Editar mensaje ───────────────────────────────────────────────
// Solo puede editar mensajes propios. Actualiza local de inmediato
// (optimista), intenta actualizar la fila si sigue pendiente en la
// cola, y siempre inserta una acción para que el receptor la aplique
// vía Realtime aunque el mensaje original ya haya sido entregado.
export async function editarMensaje({ msg, nuevoContenido, otroUsuarioId }) {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const miId = user?.id;
  if (!miId || msg.emisorId !== miId || msg.eliminado) return;

  const contenidoLimpio = nuevoContenido.trim();
  if (contenidoLimpio === '') return;

  msg.contenido = contenidoLimpio;
  msg.editado = true;
  await guardar(TABLA_MENSAJES, msg);

  if (await esUltimoMensaje(otroUsuarioId, msg.mensajeId)) {
    await chatRepository.actualizarUltimoMensajeTexto({
      otroUsuarioId,
      texto: textoPreview(msg),
    });
  }

  try {
    await supabaseClient
      .from('mensajes_pendientes')
      .update({ contenido: payloadWireConCaption(msg, contenidoLimpio), editado: true })
      .eq('id', msg.mensajeId);
  } catch {
    // Si ya no existe en la cola (ya fue entregado), no pasa nada.
  }

  try {
    await supabaseClient.from('mensajes_acciones').insert({
      mensaje_id: msg.mensajeId,
      remitente_id: miId,
      destinatario_id: otroUsuarioId,
      accion: 'editar',
      nuevo_contenido: contenidoLimpio,
    });
  } catch (e) {
    console.error('mensaje-repository – editarMensaje acción remota:', e);
  }
}

// ── Eliminar mensaje (para todos) ─────────────────────────────────

export async function eliminarMensaje({ msg, otroUsuarioId }) {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const miId = user?.id;
  if (!miId || msg.emisorId !== miId || msg.eliminado) return;

  msg.eliminado = true;
  await guardar(TABLA_MENSAJES, msg);

  if (await esUltimoMensaje(otroUsuarioId, msg.mensajeId)) {
    await chatRepository.actualizarUltimoMensajeTexto({
      otroUsuarioId,
      texto: 'Mensaje eliminado',
    });
  }

  try {
    await supabaseClient.from('mensajes_pendientes').update({ eliminado: true }).eq('id', msg.mensajeId);
  } catch {
    /* ya entregado, no pasa nada */
  }

  try {
    await supabaseClient.from('mensajes_acciones').insert({
      mensaje_id: msg.mensajeId,
      remitente_id: miId,
      destinatario_id: otroUsuarioId,
      accion: 'eliminar',
    });
  } catch (e) {
    console.error('mensaje-repository – eliminarMensaje acción remota:', e);
  }
}

// ── Aplicar edición/eliminación que llegó del otro usuario ────────
// Usado por el servicio de Realtime al recibir una fila de
// `mensajes_acciones`.
export async function aplicarAccionRemota({ mensajeId, accion, nuevoContenido = null }) {
  const existente = await obtenerPorId(TABLA_MENSAJES, mensajeId);
  if (!existente) return;

  if (accion === 'editar' && nuevoContenido != null) {
    existente.contenido = nuevoContenido;
    existente.editado = true;
  } else if (accion === 'eliminar') {
    existente.eliminado = true;
  }
  await guardar(TABLA_MENSAJES, existente);

  if (await esUltimoMensaje(existente.chatOtroUsuarioId, mensajeId)) {
    const texto = accion === 'eliminar' ? 'Mensaje eliminado' : textoPreview(existente);
    await chatRepository.actualizarUltimoMensajeTexto({
      otroUsuarioId: existente.chatOtroUsuarioId,
      texto,
    });
  }
}

// ── Reacciones ─────────────────────────────────────────────────
// Solo puede haber una reacción activa por persona, como en
// WhatsApp. Optimista: escribe local primero y después intenta
// sincronizar con Supabase.

export async function reaccionar({ mensajeId, otroUsuarioId, emoji }) {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const miId = user?.id;
  if (!miId) return;

  const msg = await obtenerPorId(TABLA_MENSAJES, mensajeId);
  if (!msg || msg.eliminado) return;

  msg.reacciones = { ...msg.reacciones, [miId]: emoji };
  await guardar(TABLA_MENSAJES, msg);

  try {
    await supabaseClient.from('mensaje_reacciones').upsert(
      {
        mensaje_id: mensajeId,
        usuario_id: miId,
        chat_otro_usuario_id: otroUsuarioId,
        emoji,
      },
      { onConflict: 'mensaje_id,usuario_id' }
    );
  } catch (e) {
    console.error('mensaje-repository – reaccionar:', e);
  }
}

export async function quitarReaccion({ mensajeId, otroUsuarioId }) {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const miId = user?.id;
  if (!miId) return;

  const msg = await obtenerPorId(TABLA_MENSAJES, mensajeId);
  if (!msg || !(miId in (msg.reacciones ?? {}))) return;

  const nuevasReacciones = { ...msg.reacciones };
  delete nuevasReacciones[miId];
  msg.reacciones = nuevasReacciones;
  await guardar(TABLA_MENSAJES, msg);

  try {
    await supabaseClient.from('mensaje_reacciones').delete().eq('mensaje_id', mensajeId).eq('usuario_id', miId);
  } catch (e) {
    console.error('mensaje-repository – quitarReaccion:', e);
  }
}

/** Aplica localmente una reacción (o su eliminación si emoji es null). */
export async function aplicarReaccionRemota({ mensajeId, usuarioId, emoji = null }) {
  const msg = await obtenerPorId(TABLA_MENSAJES, mensajeId);
  if (!msg) return;

  const nuevasReacciones = { ...msg.reacciones };
  if (emoji == null) {
    delete nuevasReacciones[usuarioId];
  } else {
    nuevasReacciones[usuarioId] = emoji;
  }
  msg.reacciones = nuevasReacciones;
  await guardar(TABLA_MENSAJES, msg);
}

/** Trae todas las reacciones de esta conversación y las aplica localmente. */
export async function sincronizarReaccionesDesdeSupabase({ otroUsuarioId, miId }) {
  try {
    const { data: raw, error } = await supabaseClient
      .from('mensaje_reacciones')
      .select('mensaje_id, usuario_id, emoji')
      .or(
        `and(usuario_id.eq.${miId},chat_otro_usuario_id.eq.${otroUsuarioId}),` +
          `and(usuario_id.eq.${otroUsuarioId},chat_otro_usuario_id.eq.${miId})`
      );
    if (error) throw error;

    for (const fila of raw ?? []) {
      await aplicarReaccionRemota({
        mensajeId: fila.mensaje_id,
        usuarioId: fila.usuario_id,
        emoji: fila.emoji,
      });
    }
  } catch (e) {
    console.error('mensaje-repository – sincronizarReaccionesDesdeSupabase:', e);
  }
}

// ── Helpers (idempotencia de recepción) ───────────────────────────
// Indica si un mensaje con este mensajeId ya se guardó localmente.
// Usado por el servicio de Realtime antes de procesar una fila de
// mensajes_pendientes, para no volver a incrementar noLeidos si esa
// fila ya se procesó antes.
export async function existeMensaje(mensajeId) {
  const existente = await obtenerPorId(TABLA_MENSAJES, mensajeId);
  return existente != null;
}

async function esUltimoMensaje(otroUsuarioId, mensajeId) {
  const rango = IDBKeyRange.bound([otroUsuarioId, ''], [otroUsuarioId, '\uffff']);
  const ultimo = await consultarConCursor(TABLA_MENSAJES, 'porChatYFecha', rango, {
    direccion: 'prev',
    limite: 1,
  });
  return ultimo[0]?.mensajeId === mensajeId;
}

// ── Reintentos ─────────────────────────────────────────────────

export async function reintentarFallidos({ otroUsuarioId }) {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const miId = user?.id;
  if (!miId) return;

  const todos = await obtenerPorIndice(TABLA_MENSAJES, 'porChat', otroUsuarioId);
  const fallidos = todos
    .filter((m) => m.estado === EstadoMensaje.FALLIDO)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  for (const msg of fallidos) {
    await reenviar(msg, miId, otroUsuarioId);
  }
}

export async function reintentarMensajeEspecifico({ msg, otroUsuarioId }) {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const miId = user?.id;
  if (!miId) return;
  await reenviar(msg, miId, otroUsuarioId);
}

async function reenviar(msg, miId, otroUsuarioId) {
  msg.estado = EstadoMensaje.ENVIANDO;
  await guardar(TABLA_MENSAJES, msg);

  try {
    const { error } = await supabaseClient.from('mensajes_pendientes').upsert(
      {
        id: msg.mensajeId,
        remitente_id: miId,
        destinatario_id: otroUsuarioId,
        contenido: payloadWire(msg),
        tipo: msg.tipo,
        media_url: msg.mediaUrlRemota,
        contexto_descripcion: msg.contextoDescripcion,
        contexto_imagen_url: msg.contextoImagenUrl,
        contexto_lugar: msg.contextoLugar,
        contexto_objeto_id: msg.contextoObjetoId,
        contexto_tipo: msg.contextoTipo,
        respuesta_a_id: msg.respuestaAMensajeId,
        respuesta_a_contenido: msg.respuestaAContenido,
        respuesta_a_tipo: msg.respuestaATipo,
        respuesta_a_emisor_id: msg.respuestaAEmisorId,
      },
      { onConflict: 'id' }
    );
    if (error) throw error;

    const guardado = await obtenerPorId(TABLA_MENSAJES, msg.mensajeId);
    if (guardado) {
      guardado.estado = EstadoMensaje.ENTREGADO;
      await guardar(TABLA_MENSAJES, guardado);
    }
  } catch {
    const guardado = await obtenerPorId(TABLA_MENSAJES, msg.mensajeId);
    if (guardado) {
      guardado.estado = EstadoMensaje.FALLIDO;
      await guardar(TABLA_MENSAJES, guardado);
    }
  }
}

// ── Wire format ────────────────────────────────────────────────
// Lo que realmente viaja en la columna `contenido` de
// mensajes_pendientes: texto plano si es un mensaje de texto, o el
// JSON de MetadataMedia si es media. Debe coincidir exactamente con
// _payloadWire() / _payloadWireConCaption() de mensaje_repository.dart.

function payloadWire(msg) {
  if (msg.tipo === TipoMensaje.TEXTO) return msg.contenido ?? '';
  return empaquetarMetadata({
    caption: msg.contenido,
    nombreArchivo: msg.mediaNombreArchivo,
    tamanioBytes: msg.mediaTamanioBytes,
    duracionMs: msg.mediaDuracionMs,
    ancho: msg.mediaAncho,
    alto: msg.mediaAlto,
    thumbnailUrl: msg.mediaThumbnailUrl,
  });
}

function payloadWireConCaption(msg, nuevoTexto) {
  if (msg.tipo === TipoMensaje.TEXTO) return nuevoTexto;
  return empaquetarMetadata({
    caption: nuevoTexto,
    nombreArchivo: msg.mediaNombreArchivo,
    tamanioBytes: msg.mediaTamanioBytes,
    duracionMs: msg.mediaDuracionMs,
    ancho: msg.mediaAncho,
    alto: msg.mediaAlto,
    thumbnailUrl: msg.mediaThumbnailUrl,
  });
}

// ── Recepción ────────────────────────────────────────────────────
// Usado por el servicio de Realtime al recibir un INSERT nuevo en
// mensajes_pendientes dirigido a mí.

export async function guardarRecibido({
  mensajeId,
  remitenteId,
  contenidoRaw,
  tipo,
  mediaUrlRemota = null,
  timestamp,
  contextoDescripcion = null,
  contextoImagenUrl = null,
  contextoLugar = null,
  contextoObjetoId = null,
  contextoTipo = null,
  respuestaAMensajeId = null,
  respuestaAContenido = null,
  respuestaATipo = null,
  respuestaAEmisorId = null,
  // Datos del emisor, para actualizar el preview del chat.
  otroNombre,
  otroNombreUsuario = null,
  otroAvatarUrl = null,
}) {
  const msg = crearMensaje({
    mensajeId,
    chatOtroUsuarioId: remitenteId,
    emisorId: remitenteId,
    tipo,
    mediaUrlRemota,
    timestamp: new Date(timestamp).toISOString(),
    estado: EstadoMensaje.RECIBIDO,
    contextoDescripcion,
    contextoImagenUrl,
    contextoLugar,
    contextoObjetoId,
    contextoTipo,
    respuestaAMensajeId,
    respuestaAContenido,
    respuestaATipo,
    respuestaAEmisorId,
  });

  if (esMedia(tipo)) {
    aplicarMetadata(msg, desempaquetarMetadata(contenidoRaw));
  } else {
    msg.contenido = contenidoRaw;
  }

  await guardar(TABLA_MENSAJES, msg);

  await chatRepository.actualizarPreview({
    otroUsuarioId: remitenteId,
    otroNombre,
    otroNombreUsuario,
    otroAvatarUrl,
    ultimoMensaje: textoPreview(msg),
    fecha: msg.timestamp,
    incrementarNoLeidos: true,
  });
}