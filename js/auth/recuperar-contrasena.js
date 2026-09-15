// ═════════════════════════════════════════════════════════════════
// recuperar-contrasena.js
//
// Flujo completo de recuperación de contraseña, en dos pantallas.
// Réplica funcional de Logins/recuperar_contrasena.dart.
//
//  Pantalla 1 — ruta '/recuperar' (renderRecuperar)
//    • El usuario ingresa su correo institucional.
//    • Supabase envía un enlace de recuperación a ese correo, con
//      `redirectTo` apuntando de vuelta a esta misma página en la
//      ruta '/nueva-contrasena'.
//    • Se reemplaza el formulario por una vista de confirmación,
//      con opción de reenviar.
//
//  Pantalla 2 — ruta '/nueva-contrasena' (renderNuevaContrasena)
//    • El usuario llega aquí desde el enlace del correo. El SDK de
//      Supabase (configurado con `detectSessionInUrl: true` en
//      core/supabase-client.js) detecta el token en la URL y deja
//      al usuario con una sesión temporal válida solo para cambiar
//      su contraseña.
//    • El usuario escribe y confirma su nueva contraseña.
//    • `updateUser()` aplica el cambio y se cierra esa sesión
//      temporal para forzar un login limpio con las credenciales
//      nuevas — igual que en Flutter.
//
// Configuración requerida en el proyecto de Supabase:
//   • Auth → URL Configuration → Redirect URLs debe incluir la URL
//     pública del sitio (ej. https://tu-dominio.com/*), ya que aquí
//     no se usa un esquema de deep link como en la app móvil, sino
//     la propia URL de la página web.
//
// Dependencias: core/supabase-client.js, core/router.js,
// core/toast.js.
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../core/supabase-client.js';
import { navegarA, registrarRuta } from '../core/router.js';
import { mostrarToast } from '../core/toast.js';

const REGEX_CORREO = /^[\w\-.]+@[\w\-.]+\.\w+$/;

// ─────────────────────────────────────────────────────────────────
// PANTALLA 1 — SOLICITAR ENLACE
// ─────────────────────────────────────────────────────────────────

/**
 * Pinta la pantalla de "¿Olvidaste tu contraseña?" dentro de
 * `contenedor`. Función que el router invoca al entrar a
 * '/recuperar'.
 * @param {HTMLElement} contenedor
 */
export function renderRecuperar(contenedor) {
  contenedor.innerHTML = `
    <div class="pantalla-fondo" style="background-image: url('assets/img/tec_villahermosa.png')"></div>
    <div class="pantalla-overlay"></div>

    <div class="auth-centro">
      <img class="auth-logo" src="assets/img/logo_itvh.png" alt="ITVH" style="height: 80px;" />
      <div class="glass-card auth-card" id="recuperar-tarjeta">
        ${_vistaFormularioCorreo()}
      </div>
    </div>
  `;

  _inicializarFormularioCorreo(contenedor);
}

/** Marcado del formulario de correo (vista inicial de '/recuperar'). */
function _vistaFormularioCorreo() {
  return `
    <h1 class="auth-titulo">¿Olvidaste tu contraseña?</h1>
    <p class="auth-subtitulo">Te enviaremos un enlace para restablecerla.</p>

    <form id="form-recuperar" novalidate>
      <div class="glass-field" style="margin-top: 28px;">
        <span class="glass-field__icon">✉️</span>
        <input id="recuperar-correo" type="email" placeholder="Correo institucional" autocomplete="email" />
      </div>

      <button type="submit" id="recuperar-boton" class="btn-primary" style="margin-top: 24px;">
        Enviar enlace
      </button>

      <p class="auth-link-centro"><a href="#/login">Volver al inicio de sesión</a></p>
    </form>
  `;
}

/** Engancha el submit del formulario de correo. */
function _inicializarFormularioCorreo(contenedor) {
  const form = contenedor.querySelector('#form-recuperar');
  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    _enviarEnlace(contenedor);
  });
}

/**
 * Envía el enlace de recuperación vía Supabase y, si tiene éxito,
 * reemplaza el contenido de la tarjeta por la vista de confirmación.
 * Espejo de `_enviarEnlace()` en recuperar_contrasena.dart.
 */
async function _enviarEnlace(contenedor) {
  const boton = contenedor.querySelector('#recuperar-boton');
  const correo = contenedor.querySelector('#recuperar-correo').value.trim();

  if (!correo) return mostrarToast('Ingresa tu correo institucional.');
  if (!REGEX_CORREO.test(correo)) return mostrarToast('El correo no tiene un formato válido.');

  _setCargando(boton, true, 'Enviar enlace');

  try {
    // `redirectTo` apunta de vuelta a esta misma app, en la ruta que
    // muestra el formulario de nueva contraseña.
    const redirectTo = `${window.location.origin}${window.location.pathname}#/nueva-contrasena`;

    const { error } = await supabaseClient.auth.resetPasswordForEmail(correo, { redirectTo });
    if (error) throw error;

    contenedor.querySelector('#recuperar-tarjeta').innerHTML = _vistaConfirmacion(correo);
    _inicializarVistaConfirmacion(contenedor, correo);
  } catch (error) {
    _setCargando(boton, false, 'Enviar enlace');
    mostrarToast(_traducirErrorEnvio(error?.message ?? ''));
  }
}

/** Marcado de la vista de confirmación, mostrada tras enviar el correo. */
function _vistaConfirmacion(correo) {
  return `
    <div style="display:flex; flex-direction:column; align-items:center; text-align:center;">
      <div class="bloqueo-icono" style="background: rgba(0,198,255,0.15); border-color: rgba(0,198,255,0.4);">
        <span style="color: var(--color-accent); font-size: 32px;">📩</span>
      </div>
      <h1 class="auth-titulo" style="margin-top: 8px;">¡Correo enviado!</h1>
      <p class="auth-subtitulo" style="line-height:1.6;">
        Revisa tu bandeja de entrada en<br /><strong>${correo}</strong><br /><br />
        Toca el enlace del correo para establecer tu nueva contraseña.
      </p>
      <button class="btn-primary" id="recuperar-volver" style="margin-top: 12px;">
        Volver al inicio de sesión
      </button>
      <button class="btn-outline" id="recuperar-reenviar" style="margin-top: 12px; border:none; background:none; color: var(--color-text-38);">
        ¿No llegó? Reenviar correo
      </button>
    </div>
  `;
}

/** Engancha los botones de la vista de confirmación. */
function _inicializarVistaConfirmacion(contenedor, correo) {
  contenedor.querySelector('#recuperar-volver').addEventListener('click', () => navegarA('/login'));

  contenedor.querySelector('#recuperar-reenviar').addEventListener('click', () => {
    contenedor.querySelector('#recuperar-tarjeta').innerHTML = _vistaFormularioCorreo();
    contenedor.querySelector('#recuperar-correo').value = correo;
    _inicializarFormularioCorreo(contenedor);
  });
}

/** Traduce los errores de envío del enlace de recuperación al español. */
function _traducirErrorEnvio(msg) {
  const lower = msg.toLowerCase();
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Demasiados intentos. Espera un momento.';
  }
  if (lower.includes('unable to validate email')) {
    return 'No encontramos una cuenta con ese correo.';
  }
  return 'No se pudo enviar el correo. Intenta de nuevo.';
}

// ─────────────────────────────────────────────────────────────────
// PANTALLA 2 — NUEVA CONTRASEÑA
// ─────────────────────────────────────────────────────────────────

/**
 * Pinta el formulario de nueva contraseña. El usuario llega aquí
 * únicamente desde el enlace del correo, ya con una sesión temporal
 * de recuperación activa (ver nota de `detectSessionInUrl` en
 * core/supabase-client.js).
 * @param {HTMLElement} contenedor
 */
export function renderNuevaContrasena(contenedor) {
  contenedor.innerHTML = `
    <div class="pantalla-fondo" style="background-image: url('assets/img/tec_villahermosa.png')"></div>
    <div class="pantalla-overlay"></div>

    <div class="auth-centro">
      <img class="auth-logo" src="assets/img/logo_itvh.png" alt="ITVH" style="height: 80px;" />
      <div class="glass-card auth-card" id="nueva-contrasena-tarjeta">
        ${_vistaFormularioNuevaContrasena()}
      </div>
    </div>
  `;

  _inicializarFormularioNuevaContrasena(contenedor);
}

/** Marcado del formulario de nueva contraseña. */
function _vistaFormularioNuevaContrasena() {
  return `
    <h1 class="auth-titulo">Nueva contraseña</h1>
    <p class="auth-subtitulo">Elige una contraseña segura de al menos 8 caracteres.</p>

    <form id="form-nueva-contrasena" novalidate>
      <div class="glass-field" style="margin-top: 28px;">
        <span class="glass-field__icon">🔒</span>
        <input id="nueva-password" type="password" placeholder="Nueva contraseña" autocomplete="new-password" />
        <span class="glass-field__trailing" id="nueva-toggle-password">👁️</span>
      </div>

      <div class="glass-field" style="margin-top: 14px;">
        <span class="glass-field__icon">🔒</span>
        <input id="nueva-confirmar" type="password" placeholder="Confirmar contraseña" autocomplete="new-password" />
        <span class="glass-field__trailing" id="nueva-toggle-confirmar">👁️</span>
      </div>

      <button type="submit" id="nueva-boton" class="btn-primary" style="margin-top: 28px;">
        Guardar contraseña
      </button>
    </form>
  `;
}

/** Engancha submit y toggles de visibilidad del formulario de nueva contraseña. */
function _inicializarFormularioNuevaContrasena(contenedor) {
  const form = contenedor.querySelector('#form-nueva-contrasena');

  _engancharToggle(contenedor, '#nueva-password', '#nueva-toggle-password');
  _engancharToggle(contenedor, '#nueva-confirmar', '#nueva-toggle-confirmar');

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    _guardarNuevaContrasena(contenedor);
  });
}

/** Alterna un campo de contraseña entre oculto/visible. */
function _engancharToggle(contenedor, selectorInput, selectorToggle) {
  const input = contenedor.querySelector(selectorInput);
  const toggle = contenedor.querySelector(selectorToggle);

  toggle.addEventListener('click', () => {
    const oculto = input.type === 'password';
    input.type = oculto ? 'text' : 'password';
    toggle.textContent = oculto ? '🙈' : '👁️';
  });
}

/**
 * Valida y aplica la nueva contraseña, cerrando después la sesión
 * temporal de recuperación para forzar un login limpio. Espejo de
 * `_guardar()` en recuperar_contrasena.dart.
 */
async function _guardarNuevaContrasena(contenedor) {
  const boton = contenedor.querySelector('#nueva-boton');
  const nueva = contenedor.querySelector('#nueva-password').value.trim();
  const confirmar = contenedor.querySelector('#nueva-confirmar').value.trim();

  if (!nueva) return mostrarToast('Ingresa tu nueva contraseña');
  if (nueva.length < 8) return mostrarToast('Mínimo 8 caracteres');
  if (confirmar !== nueva) return mostrarToast('Las contraseñas no coinciden');

  _setCargando(boton, true, 'Guardar contraseña');

  try {
    const { error: updateError } = await supabaseClient.auth.updateUser({ password: nueva });
    if (updateError) throw updateError;

    // Cierra la sesión temporal del enlace de recuperación para que
    // el usuario inicie sesión normalmente con sus nuevas credenciales.
    await supabaseClient.auth.signOut();

    contenedor.querySelector('#nueva-contrasena-tarjeta').innerHTML = _vistaExito();
    contenedor.querySelector('#nueva-ir-al-login').addEventListener('click', () => navegarA('/login'));
  } catch (error) {
    _setCargando(boton, false, 'Guardar contraseña');
    mostrarToast(_traducirErrorActualizacion(error?.message ?? ''));
  }
}

/** Marcado de la vista de éxito tras actualizar la contraseña. */
function _vistaExito() {
  return `
    <div style="display:flex; flex-direction:column; align-items:center; text-align:center;">
      <div class="bloqueo-icono" style="background: rgba(52,199,89,0.15); border-color: rgba(52,199,89,0.4);">
        <span style="color: var(--color-success); font-size: 32px;">✅</span>
      </div>
      <h1 class="auth-titulo" style="margin-top: 8px;">¡Contraseña actualizada!</h1>
      <p class="auth-subtitulo" style="line-height:1.6;">
        Tu contraseña fue cambiada exitosamente.<br />
        Inicia sesión con tus nuevas credenciales.
      </p>
      <button class="btn-primary" id="nueva-ir-al-login" style="margin-top: 16px;">
        Ir al inicio de sesión
      </button>
    </div>
  `;
}

/** Traduce los errores de actualización de contraseña al español. */
function _traducirErrorActualizacion(msg) {
  const lower = msg.toLowerCase();
  if (lower.includes('same password')) {
    return 'La nueva contraseña debe ser diferente a la anterior.';
  }
  if (lower.includes('weak password')) {
    return 'La contraseña es muy débil. Usa al menos 8 caracteres.';
  }
  if (lower.includes('session')) {
    return 'El enlace expiró. Solicita uno nuevo.';
  }
  return 'No se pudo actualizar la contraseña. Intenta de nuevo.';
}

// ─────────────────────────────────────────────────────────────────
// UTILIDAD COMPARTIDA POR AMBAS PANTALLAS
// ─────────────────────────────────────────────────────────────────

/** Alterna un botón entre su estado normal y "cargando" (spinner). */
function _setCargando(boton, cargando, textoNormal) {
  boton.disabled = cargando;
  boton.innerHTML = cargando ? '<span class="btn-spinner"></span>' : textoNormal;
}

// Se registran ambas rutas apenas se importa el módulo.
registrarRuta('/recuperar', renderRecuperar);
registrarRuta('/nueva-contrasena', renderNuevaContrasena);