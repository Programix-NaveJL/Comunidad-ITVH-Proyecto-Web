// Modelo de datos "Chat" — preview de una conversación en la lista.
// Mismos campos que Pantallas/JaguarChat/Chats/chat.dart, guardado
// como objeto plano en IndexedDB (tabla 'chats', keyPath otroUsuarioId).
//
// ultimaFecha se guarda como string ISO 8601 (no hay tipo Date nativo
// en IndexedDB tan cómodo de indexar/serializar entre pestañas).

export function crearChat(datos = {}) {
  return {
    otroUsuarioId: datos.otroUsuarioId ?? '',
    otroNombre: datos.otroNombre ?? '',
    otroNombreUsuario: datos.otroNombreUsuario ?? null,
    otroAvatarUrl: datos.otroAvatarUrl ?? null,
    ultimoMensaje: datos.ultimoMensaje ?? null,
    ultimaFecha: datos.ultimaFecha ?? null,
    noLeidos: datos.noLeidos ?? 0,
    fijado: datos.fijado ?? false,
    silenciado: datos.silenciado ?? false,
    archivado: datos.archivado ?? false,
  };
}