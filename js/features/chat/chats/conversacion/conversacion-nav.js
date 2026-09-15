// ═════════════════════════════════════════════════════════════════
// conversacion-nav.js
// Ubicación: js/features/chat/chats/conversacion/conversacion-nav.js
//
// Puente de navegación hacia conversacion-screen.js. El router de la
// app navega por hash (ver navegarA()/registrarRuta() en
// core/router.js) y no serializa objetos completos en la URL —
// conversacion-screen.js necesita más que un id (nombre, avatar,
// opcionalmente un contextoObjeto de marketplace/objeto perdido), así
// que este módulo guarda esos datos en una variable de módulo justo
// antes de navegar, y los entrega al montar la ruta '/chat'.
//
// abrirConversacion(datos) es el ÚNICO punto de entrada que cualquier
// pantalla debe usar para abrir una conversación — chats-screen.js,
// marketplace-inicio.js, cualquier futura pantalla de notificaciones,
// etc. — así todas comparten el mismo contrato de datos sin duplicar
// lógica de navegación:
//
//   import { abrirConversacion } from '.../conversacion/conversacion-nav.js';
//   abrirConversacion({
//     otroUsuarioId, otroNombre, otroNombreUsuario, otroAvatarUrl,
//     contextoObjeto, // opcional — { id, descripcion, imagenUrl, lugar, tipo }
//   });
//
// LÍMITE CONOCIDO Y ACEPTADO: si el usuario recarga la página estando
// dentro de una conversación, datosPendientes se pierde (no hay nada
// que deserializar desde la URL) y la ruta redirige a '/home'. Esto
// es aceptable porque la app no soporta deep-linking a una
// conversación específica todavía — igual que Flutter no lo soporta
// vía una URL, solo vía Navigator.push en memoria.
// ═════════════════════════════════════════════════════════════════

import { navegarA, registrarRuta } from '../../../../core/router.js';
import { render as renderConversacion } from './conversacion-screen.js';

let datosPendientes = null;

export function abrirConversacion(datos) {
  datosPendientes = datos;
  navegarA('/chat');
}

registrarRuta('/chat', async (contenedor) => {
  if (!datosPendientes) {
    // Sin datos en memoria (ej. recarga de página estando en una
    // conversación) no hay forma de reconstruir el contexto completo
    // — se regresa a Inicio en vez de romper la pantalla.
    navegarA('/home');
    return;
  }
  const datos = datosPendientes;
  datosPendientes = null;
  await renderConversacion(contenedor, datos);
});