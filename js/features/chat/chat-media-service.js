// ═════════════════════════════════════════════════════════════════
// chat-media-service.js
// Ubicación: js/features/chat/chat-media-service.js
//
// Réplica web de Pantallas/JaguarChat/Chats/chat_media_service.dart.
// Orquesta el envío de mensajes con media: sube el archivo a R2
// (bucket itvh-chat) vía storageService, y con la URL resultante
// llama a mensajeRepository.enviarMensaje.
//
// Igual que en Dart, si no hay sesión activa cada función lanza una
// excepción explícita en vez de fallar en silencio.
//
// PENDIENTE (no usado por composer-bar.js/conversacion-screen.js en
// este alcance): enviarVideo, enviarDocumento — ver nota de
// PENDIENTES en storage-service.js.
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../core/supabase-client.js';
import { storageService } from '../../core/storage-service.js';
import * as mensajeRepository from './mensaje-repository.js';
import * as stickersRecientesService from './servicios/stickers-recientes-service.js';
import { TipoMensaje } from './mensaje-model.js';

async function requerirMiId() {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (!user?.id) {
    throw new Error('No hay sesión activa: no se puede enviar media (miId es null).');
  }
  return user.id;
}

export async function enviarImagen({
  file,
  otroUsuarioId,
  otroNombre,
  otroNombreUsuario = null,
  otroAvatarUrl = null,
  caption = null,
}) {
  const miId = await requerirMiId();
  const mensajeId = crypto.randomUUID();

  try {
    const subido = await storageService.subirImagenChat({
      file,
      miId,
      otroId: otroUsuarioId,
      mensajeId,
    });

    await mensajeRepository.enviarMensaje({
      otroUsuarioId,
      otroNombre,
      otroNombreUsuario,
      otroAvatarUrl,
      contenido: caption,
      tipo: TipoMensaje.IMAGEN,
      mediaUrlRemota: subido.url,
      mediaThumbnailUrl: subido.thumbnailUrl,
      mediaTamanioBytes: subido.tamanioBytes,
      mediaAncho: subido.ancho,
      mediaAlto: subido.alto,
    });
  } catch (e) {
    console.error('chat-media-service – enviarImagen:', e);
    throw e;
  }
}

/** Sticker NUEVO subido desde un archivo local (ej. compartido al navegador). */
export async function enviarSticker({
  file,
  otroUsuarioId,
  otroNombre,
  otroNombreUsuario = null,
  otroAvatarUrl = null,
}) {
  const miId = await requerirMiId();
  const mensajeId = crypto.randomUUID();

  try {
    const subido = await storageService.subirStickerChat({
      file,
      miId,
      otroId: otroUsuarioId,
      mensajeId,
    });

    await mensajeRepository.enviarMensaje({
      otroUsuarioId,
      otroNombre,
      otroNombreUsuario,
      otroAvatarUrl,
      tipo: TipoMensaje.STICKER,
      mediaUrlRemota: subido.url,
      mediaThumbnailUrl: subido.thumbnailUrl,
      mediaTamanioBytes: subido.tamanioBytes,
      mediaAncho: subido.ancho,
      mediaAlto: subido.alto,
    });

    stickersRecientesService.agregar({ url: subido.url, ancho: subido.ancho, alto: subido.alto });
  } catch (e) {
    console.error('chat-media-service – enviarSticker:', e);
    throw e;
  }
}

/** Sticker que YA está en R2 (elegido desde la bandeja de recientes). */
export async function enviarStickerExistente({
  sticker,
  otroUsuarioId,
  otroNombre,
  otroNombreUsuario = null,
  otroAvatarUrl = null,
}) {
  await requerirMiId();

  try {
    await mensajeRepository.enviarMensaje({
      otroUsuarioId,
      otroNombre,
      otroNombreUsuario,
      otroAvatarUrl,
      tipo: TipoMensaje.STICKER,
      mediaUrlRemota: sticker.url,
      mediaAncho: sticker.ancho,
      mediaAlto: sticker.alto,
    });

    stickersRecientesService.agregar(sticker);
  } catch (e) {
    console.error('chat-media-service – enviarStickerExistente:', e);
    throw e;
  }
}

/** [blob] es la nota de voz ya grabada localmente (ver composer-bar.js, MediaRecorder). */
export async function enviarAudio({
  blob,
  duracionMs,
  otroUsuarioId,
  otroNombre,
  otroNombreUsuario = null,
  otroAvatarUrl = null,
}) {
  const miId = await requerirMiId();
  const mensajeId = crypto.randomUUID();

  try {
    const subido = await storageService.subirAudioChat({
      blob,
      miId,
      otroId: otroUsuarioId,
      mensajeId,
      duracionMs,
    });

    await mensajeRepository.enviarMensaje({
      otroUsuarioId,
      otroNombre,
      otroNombreUsuario,
      otroAvatarUrl,
      tipo: TipoMensaje.AUDIO,
      mediaUrlRemota: subido.url,
      mediaTamanioBytes: subido.tamanioBytes,
      mediaDuracionMs: subido.duracionMs,
    });
  } catch (e) {
    console.error('chat-media-service – enviarAudio:', e);
    throw e;
  }
}