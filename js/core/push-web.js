// push-web.js
// Ubicación sugerida: js/core/push-web.js
//
// Notificaciones push web con Firebase Cloud Messaging:
//   1. Pide permiso al usuario.
//   2. Registra el service worker (firebase-messaging-sw.js).
//   3. Obtiene el token con la VAPID key.
//   4. Lo guarda en la tabla push_tokens con plataforma = 'web'.
//   5. Muestra un toast cuando llega un push con la app abierta.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getMessaging,
  getToken,
  deleteToken,
  onMessage,
  isSupported,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js';
import { supabaseClient } from './supabase-client.js';
import { mostrarToast } from './toast.js';

// Misma config que en firebase-messaging-sw.js.
const firebaseConfig = {
  apiKey: 'AIzaSyDMNwlM8QeL4aSHbmZT9zmkrgV_90DkVho',
  authDomain: 'comunidad-itvh.firebaseapp.com',
  projectId: 'comunidad-itvh',
  messagingSenderId: '646810208593',
  appId: '1:646810208593:web:238eec22f124cf0aedab70',
};

// Consola Firebase → Configuración → Cloud Messaging →
// Certificados push web → "Generar par de claves".
const VAPID_KEY = 'BMkWVREmhetaJ4R5wHvmLkgeNfjFVyoqQhv_kHgCHvgqjBK05Ycqrxw9_VsBhVjYCrLiIKAVYnf8BDTgeyteVro';

let messaging = null;
let escuchandoPrimerPlano = false;

async function obtenerMessaging() {
  if (messaging) return messaging;
  if (!(await isSupported())) return null;
  messaging = getMessaging(initializeApp(firebaseConfig));
  return messaging;
}

/**
 * Llamar desde un gesto del usuario (un botón "Activar notificaciones"),
 * no automáticamente al cargar: los navegadores bloquean o penalizan
 * los permisos pedidos sin interacción.
 * Devuelve el token, o null si no se pudo activar.
 */
export async function activarNotificacionesWeb(uid) {
  try {
    const msg = await obtenerMessaging();
    if (!msg) {
      mostrarToast('Este navegador no soporta notificaciones push');
      return null;
    }

    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      mostrarToast('Permiso de notificaciones no concedido');
      return null;
    }

    // Ruta relativa a la página (index.html), no a este módulo.
    const registro = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;

    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registro,
    });
    if (!token) return null;

    // RPC definida en push_tokens_web.sql (security definer): maneja el
    // caso de un token que antes pertenecía a otra cuenta en este
    // mismo navegador. El usuario sale de auth.uid() en el servidor.
    const { error } = await supabaseClient.rpc('registrar_push_token', {
      p_token: token,
      p_plataforma: 'web',
    });
    if (error) throw error;

    escucharPrimerPlano(msg);
    return token;
  } catch (error) {
    console.error('push-web – activar:', error);
    mostrarToast('No se pudieron activar las notificaciones');
    return null;
  }
}

// Con la app abierta y visible, FCM no muestra la alerta del sistema:
// entrega el mensaje aquí y hay que mostrarlo a mano.
function escucharPrimerPlano(msg) {
  if (escuchandoPrimerPlano) return;
  escuchandoPrimerPlano = true;
  onMessage(msg, (payload) => {
    const titulo = payload.data?.titulo ?? payload.notification?.title;
    const cuerpo = payload.data?.cuerpo ?? payload.notification?.body;
    if (titulo) mostrarToast(cuerpo ? `${titulo}: ${cuerpo}` : titulo);
  });
}

/**
 * Si el permiso ya fue concedido en una sesión anterior, refresca el
 * token (puede rotar) sin volver a preguntar. Llamar tras el login.
 */
export async function reactivarSiHayPermiso(uid) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return null;
  return activarNotificacionesWeb(uid);
}

/** Llamar al cerrar sesión para no seguir recibiendo pushes del usuario anterior. */
export async function desactivarNotificacionesWeb() {
  try {
    const msg = await obtenerMessaging();
    if (!msg) return;
    const registro = await navigator.serviceWorker.getRegistration('./firebase-messaging-sw.js');
    const token = await getToken(msg, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registro });
    if (token) {
      await supabaseClient.rpc('eliminar_push_token', { p_token: token });
    }
    await deleteToken(msg);
  } catch (error) {
    console.error('push-web – desactivar:', error);
  }
}