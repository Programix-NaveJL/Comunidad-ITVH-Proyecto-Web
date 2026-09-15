// ═════════════════════════════════════════════════════════════════
// perfiles-repository.js
//
// Réplica web de perfiles_repository.dart.
//
// Búsqueda en el directorio de perfiles (usada como fallback en
// chats-screen.js cuando una búsqueda no coincide con ningún chat
// existente).
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../../core/supabase-client.js';

/**
 * Busca perfiles cuyo nombre o nombre de usuario coincidan con
 * `termino` (case-insensitive), excluyendo al usuario actual.
 * Devuelve como máximo 20 resultados.
 *
 * CORRECCIÓN heredada de la versión Dart: no se busca por email —
 * hacerlo desde el cliente expondría públicamente los emails de la
 * tabla `perfiles`. Si algún día se necesita, debe resolverse con
 * una Edge Function con su propia validación de permisos, nunca
 * desde el cliente directamente.
 */
export async function buscar(termino) {
  const consulta = sanitizarIlike((termino ?? '').trim());
  if (!consulta) return [];

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  const miId = user?.id ?? '';

  const { data, error } = await supabaseClient
    .from('perfiles')
    .select('id, nombre, nombre_usuario, cdn_foto_perfil')
    .or(`nombre_usuario.ilike.%${consulta}%,nombre.ilike.%${consulta}%`)
    .neq('id', miId)
    .limit(20);

  if (error) {
    console.error('perfiles-repository – buscar:', error);
    return [];
  }

  return (data ?? []).map(mapearPerfilResultado);
}

/**
 * Escapa los wildcards de ILIKE ('%' y '_') para que se traten como
 * literales, evitando matches inesperados cuando el usuario los
 * escribe tal cual en la búsqueda. El orden importa: primero se
 * escapan los backslashes existentes, para no duplicar el escape de
 * los caracteres que se agregan después.
 */
function sanitizarIlike(valor) {
  return valor
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_');
}

/**
 * Forma de un resultado de búsqueda de perfil. Réplica el shape de
 * PerfilResultado en Dart (mismos nombres de campo, en camelCase).
 *   { id, nombre, nombreUsuario, avatarUrl }
 */
function mapearPerfilResultado(fila) {
  return {
    id: fila.id,
    nombre: fila.nombre ?? 'Sin nombre',
    nombreUsuario: fila.nombre_usuario ?? null,
    avatarUrl: fila.cdn_foto_perfil ?? null,
  };
}