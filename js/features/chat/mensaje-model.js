// ═════════════════════════════════════════════════════════════════
// mensaje-model.js
//
// Réplica fiel de Pantallas/JaguarChat/Chats/mensaje.dart. Mismos
// tipos de mensaje, mismo textoPreview, y — lo más importante — el
// mismo formato exacto de empaquetado de MetadataMedia. Ese formato
// viaja dentro de la columna `contenido` de `mensajes_pendientes` en
// Supabase, así que un mensaje con foto/video/audio/documento
// enviado desde web tiene que poder leerse en móvil y viceversa.
// NO cambiar las claves del JSON de empaquetarMetadata() sin cambiar
// también mensaje.dart.
// ═════════════════════════════════════════════════════════════════

export const TipoMensaje = {
  TEXTO: 'texto',
  IMAGEN: 'imagen',
  VIDEO: 'video',
  AUDIO: 'audio',
  DOCUMENTO: 'documento',
  STICKER: 'sticker',
};

export function esMedia(tipo) {
  return tipo !== TipoMensaje.TEXTO;
}

export const EstadoMensaje = {
  ENVIANDO: 'enviando',
  ENTREGADO: 'entregado',
  FALLIDO: 'fallido',
  RECIBIDO: 'recibido',
};

// ── Tipo de contexto compartido (objeto perdido / marketplace) ─────
// Igual que TipoContextoMensaje en Dart: el campo contextoTipo del
// mensaje guarda uno de estos strings tal cual (no el nombre del
// enum, sino su representación de API).
export const TipoContextoMensaje = {
  OBJETO_PERDIDO: 'objeto_perdido',
  MARKETPLACE: 'marketplace',
};

// ── Metadata de media empaquetada para viajar por Supabase ─────────
// Mismas claves y mismo orden semántico que MetadataMedia en Dart.
// empaquetarMetadata() ↔ MetadataMedia.empaquetar()
// desempaquetarMetadata() ↔ MetadataMedia.desempaquetar()

export function empaquetarMetadata(m = {}) {
  return JSON.stringify({
    caption: m.caption ?? null,
    nombreArchivo: m.nombreArchivo ?? null,
    tamanioBytes: m.tamanioBytes ?? null,
    duracionMs: m.duracionMs ?? null,
    ancho: m.ancho ?? null,
    alto: m.alto ?? null,
    thumbnailUrl: m.thumbnailUrl ?? null,
  });
}

export function desempaquetarMetadata(raw) {
  if (!raw) {
    return { caption: null, nombreArchivo: null, tamanioBytes: null, duracionMs: null, ancho: null, alto: null, thumbnailUrl: null };
  }
  try {
    const j = JSON.parse(raw);
    return {
      caption: j.caption ?? null,
      nombreArchivo: j.nombreArchivo ?? null,
      tamanioBytes: j.tamanioBytes ?? null,
      duracionMs: j.duracionMs ?? null,
      ancho: j.ancho ?? null,
      alto: j.alto ?? null,
      thumbnailUrl: j.thumbnailUrl ?? null,
    };
  } catch {
    return { caption: null, nombreArchivo: null, tamanioBytes: null, duracionMs: null, ancho: null, alto: null, thumbnailUrl: null };
  }
}

// ── Modelo ───────────────────────────────────────────────────────
// reacciones se guarda como objeto plano { usuarioId: emoji } — a
// diferencia de Dart (que lo serializa a string porque Isar no
// soporta Map<String,String> como columna), IndexedDB sí puede
// guardar objetos anidados directamente, así que no hace falta el
// paso de (de)serialización aquí.

export function crearMensaje(datos = {}) {
  return {
    mensajeId: datos.mensajeId,
    chatOtroUsuarioId: datos.chatOtroUsuarioId,
    emisorId: datos.emisorId,
    contenido: datos.contenido ?? null,
    tipo: datos.tipo ?? TipoMensaje.TEXTO,

    mediaPathLocal: datos.mediaPathLocal ?? null,
    mediaUrlRemota: datos.mediaUrlRemota ?? null,
    mediaNombreArchivo: datos.mediaNombreArchivo ?? null,
    mediaTamanioBytes: datos.mediaTamanioBytes ?? null,
    mediaDuracionMs: datos.mediaDuracionMs ?? null,
    mediaAncho: datos.mediaAncho ?? null,
    mediaAlto: datos.mediaAlto ?? null,
    mediaThumbnailUrl: datos.mediaThumbnailUrl ?? null,

    timestamp: datos.timestamp ?? new Date().toISOString(),
    estado: datos.estado ?? EstadoMensaje.ENVIANDO,

    contextoDescripcion: datos.contextoDescripcion ?? null,
    contextoImagenUrl: datos.contextoImagenUrl ?? null,
    contextoLugar: datos.contextoLugar ?? null,
    contextoObjetoId: datos.contextoObjetoId ?? null,
    contextoTipo: datos.contextoTipo ?? null,

    respuestaAMensajeId: datos.respuestaAMensajeId ?? null,
    respuestaAContenido: datos.respuestaAContenido ?? null,
    respuestaATipo: datos.respuestaATipo ?? null,
    respuestaAEmisorId: datos.respuestaAEmisorId ?? null,

    editado: datos.editado ?? false,
    eliminado: datos.eliminado ?? false,

    // { usuarioId: emoji }
    reacciones: datos.reacciones ?? {},
  };
}

/** Aplica una MetadataMedia desempaquetada sobre un mensaje existente. */
export function aplicarMetadata(msg, metadata) {
  msg.contenido = metadata.caption;
  msg.mediaNombreArchivo = metadata.nombreArchivo;
  msg.mediaTamanioBytes = metadata.tamanioBytes;
  msg.mediaDuracionMs = metadata.duracionMs;
  msg.mediaAncho = metadata.ancho;
  msg.mediaAlto = metadata.alto;
  msg.mediaThumbnailUrl = metadata.thumbnailUrl;
  return msg;
}

/** Texto corto para la lista de chats o al citar en "responder a". */
export function textoPreview(msg) {
  if (msg.eliminado) return 'Mensaje eliminado';
  switch (msg.tipo) {
    case TipoMensaje.IMAGEN:
      return msg.contenido ? `📷 ${msg.contenido}` : '📷 Foto';
    case TipoMensaje.VIDEO:
      return msg.contenido ? `🎬 ${msg.contenido}` : '🎬 Video';
    case TipoMensaje.AUDIO: {
      const seg = Math.round((msg.mediaDuracionMs ?? 0) / 1000);
      const m = Math.trunc(seg / 60);
      const s = String(seg % 60).padStart(2, '0');
      return `🎤 Audio (${m}:${s})`;
    }
    case TipoMensaje.DOCUMENTO:
      return `📄 ${msg.mediaNombreArchivo ?? 'Documento'}`;
    case TipoMensaje.STICKER:
      return '🏷️ Sticker';
    default:
      return msg.contenido ?? '';
  }
}

/** Agrupa las reacciones por emoji: { '❤️': ['uid1','uid2'], ... } */
export function reaccionesAgrupadas(msg) {
  const agrupado = {};
  Object.entries(msg.reacciones ?? {}).forEach(([usuarioId, emoji]) => {
    (agrupado[emoji] ??= []).push(usuarioId);
  });
  return agrupado;
}

// ── Factory desde una fila de Supabase (sync inicial / catch-up) ──
// Réplica de Mensaje.fromSupabase(). [row] viene de la tabla
// mensajes_pendientes.
export function mensajeDesdeSupabase(row, { miId, otroId }) {
  const emisor = row.remitente_id;
  const tipo = row.tipo ?? TipoMensaje.TEXTO;

  const msg = crearMensaje({
    mensajeId: row.id,
    chatOtroUsuarioId: emisor === miId ? otroId : emisor,
    emisorId: emisor,
    tipo,
    mediaUrlRemota: row.media_url ?? null,
    timestamp: new Date(row.creado_en).toISOString(),
    estado: EstadoMensaje.ENTREGADO,
    contextoDescripcion: row.contexto_descripcion ?? null,
    contextoImagenUrl: row.contexto_imagen_url ?? null,
    contextoLugar: row.contexto_lugar ?? null,
    contextoObjetoId: row.contexto_objeto_id ?? null,
    contextoTipo: row.contexto_tipo ?? null,
    respuestaAMensajeId: row.respuesta_a_id ?? null,
    respuestaAContenido: row.respuesta_a_contenido ?? null,
    respuestaATipo: row.respuesta_a_tipo ?? null,
    respuestaAEmisorId: row.respuesta_a_emisor_id ?? null,
    editado: row.editado ?? false,
    eliminado: row.eliminado ?? false,
  });

  if (esMedia(tipo)) {
    aplicarMetadata(msg, desempaquetarMetadata(row.contenido));
  } else {
    msg.contenido = row.contenido ?? null;
  }

  return msg;
}