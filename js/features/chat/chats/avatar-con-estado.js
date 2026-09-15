// ═════════════════════════════════════════════════════════════════
// avatar-con-estado.js
// Ubicación: js/features/chat/chats/avatar-con-estado.js
//
// Réplica web de pantallas_ui/avatar_con_estado.dart. Avatar
// reutilizable con puntito verde de "en línea" (reactivo vía
// presence-service.js) que al hacer tap navega directo a
// conversacion-screen.js.
//
// A diferencia de Dart (StreamBuilder se limpia solo al desmontar el
// widget), aquí el llamador es responsable de invocar destruir()
// cuando quite el elemento del DOM, para no dejar la suscripción de
// presencia viva. chats_page_home.dart NO usa este widget (le agregó
// el puntito directo a su propio Stack) — mismo criterio aquí:
// chats-screen.js sigue sin usar este componente, es para pantallas
// nuevas (búsqueda de perfiles, destacadas, etc.).
//
// Navegación: mismo patrón de overlay + pushState/popstate que
// abrirConversacion() en chats-screen.js (ver esa función para el
// razonamiento completo de por qué se hace así).
// ═════════════════════════════════════════════════════════════════

import * as presenceService from '../servicios/presence-service.js';
import { mostrarToast } from '../../../core/toast.js';

/**
 * Crea el elemento del avatar-con-estado.
 * @returns {{elemento: HTMLElement, destruir: () => void}}
 */
export function crearAvatarConEstado({ otroUsuarioId, otroNombre, otroNombreUsuario = null, otroAvatarUrl = null, radio = 27 }) {
  const diametro = radio * 2;
  const tamañoWrapper = diametro + 4;
  const tamañoPunto = radio * 0.35 + 6;
  const inicial = (otroNombre || '?').trim().charAt(0).toUpperCase();

  const wrapper = document.createElement('button');
  wrapper.className = 'conv-avatar-estado';
  wrapper.style.width = `${tamañoWrapper}px`;
  wrapper.style.height = `${tamañoWrapper}px`;
  wrapper.innerHTML = `
    <span class="conv-avatar-estado__circulo" style="width:${diametro}px;height:${diametro}px;font-size:${Math.round(radio * 0.55)}px">
      ${otroAvatarUrl ? `<img src="${otroAvatarUrl}" alt="" />` : `<span>${inicial}</span>`}
    </span>
    <span class="conv-avatar-estado__punto" style="width:${tamañoPunto}px;height:${tamañoPunto}px"></span>
  `;

  const punto = wrapper.querySelector('.conv-avatar-estado__punto');

  const cancelarPresencia = presenceService.suscribir((enLinea) => {
    punto.classList.toggle('visible', enLinea.has(otroUsuarioId));
  });

  wrapper.addEventListener('click', () => {
    irAlChat({ otroUsuarioId, otroNombre, otroNombreUsuario, otroAvatarUrl });
  });

  return {
    elemento: wrapper,
    destruir: () => cancelarPresencia(),
  };
}

// ── Navegación — mismo patrón que abrirConversacion() en chats-screen.js ──

async function irAlChat({ otroUsuarioId, otroNombre, otroNombreUsuario, otroAvatarUrl }) {
  const overlay = document.createElement('div');
  overlay.className = 'conv-overlay-raiz';
  document.body.appendChild(overlay);

  window.history.pushState({ jaguarChatConversacion: true }, '');
  window.addEventListener('popstate', cerrarOverlay, { once: true });

  function cerrarOverlay() {
    overlay.remove();
  }

  try {
    const { render: renderConversacion } = await import('./conversacion/conversacion-screen.js');
    await renderConversacion(overlay, { otroUsuarioId, otroNombre, otroNombreUsuario, otroAvatarUrl });
  } catch (error) {
    console.error('avatar-con-estado – irAlChat:', error);
    mostrarToast('No se pudo abrir la conversación', 'error');
    window.removeEventListener('popstate', cerrarOverlay);
    overlay.remove();
    window.history.back();
  }
}