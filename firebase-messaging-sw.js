// firebase-messaging-sw.js
// Ubicación: RAÍZ del sitio (junto a index.html). Firebase lo busca ahí.
//
// Un service worker no puede usar `import`, por eso se cargan las
// versiones "compat" con importScripts.

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// La config de Firebase es pública (no es un secreto), es normal que
// esté en el código. Cópiala de:
// Consola Firebase → Configuración del proyecto → Tus apps → App web.
firebase.initializeApp({
  apiKey: 'AIzaSyDMNwlM8QeL4aSHbmZT9zmkrgV_90DkVho',
  authDomain: 'comunidad-itvh.firebaseapp.com',
  projectId: 'comunidad-itvh',
  messagingSenderId: '646810208593',
  appId: '1:646810208593:web:238eec22f124cf0aedab70',
});

const messaging = firebase.messaging();

// send-push-notification manda mensajes data-only:
// { tipo, titulo, cuerpo, canal, publicacion_id, origen_id, historia_id, avatar_url }
// Con la app cerrada o la pestaña en segundo plano, la notificación la
// construye este service worker. Con la pestaña visible lo hace
// onMessage en push-web.js (toast).
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return; // si trae `notification`, FCM ya la muestra sola
  const d = payload.data ?? {};
  self.registration.showNotification(d.titulo || 'Comunidad ITVH', {
    body: d.cuerpo || '',
    icon: d.avatar_url || './assets/icon-192.png', // ajusta a un icono real
    badge: './assets/icon-192.png',
    // Misma etiqueta → reemplaza en vez de apilar (equivale al groupKey de Android).
    tag: `${d.canal || 'general'}_${d.origen_id || d.tipo || ''}`,
    renotify: true,
    data: d,
  });
});

// Ruta interna según el tipo. Ajusta a tus rutas reales.
function urlDestino(d) {
  let ruta = '/notificaciones';
  if (d.tipo === 'mensaje') ruta = '/home';
  else if (d.tipo === 'seguidor' && d.origen_id) ruta = `/perfil-publico/${d.origen_id}`;
  return new URL(`index.html#${ruta}`, self.registration.scope).href;
}

// Al tocar la notificación: enfoca la app si ya está abierta (y la lleva
// a la ruta), si no la abre.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = urlDestino(evento.notification.data ?? {});
  evento.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (ventanas) => {
      for (const v of ventanas) {
        if ('focus' in v) {
          await v.focus();
          try { if ('navigate' in v) await v.navigate(url); } catch (_) {}
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});