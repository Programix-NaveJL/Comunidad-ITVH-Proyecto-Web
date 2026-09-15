// ═════════════════════════════════════════════════════════════════
// iniciar-sesion.js
//
// Pantalla de inicio de sesión de Comunidad ITVH (web).
// Réplica funcional de Logins/iniciar_sesion.dart.
//
// Qué hace este archivo:
//   • Pinta el formulario de login (correo/usuario + contraseña)
//     dentro del contenedor que le entrega el router.
//   • Permite autenticarse con correo O nombre de usuario: si el
//     identificador no contiene '@', primero resuelve el correo
//     asociado consultando la tabla `perfiles` antes de llamar a
//     Supabase Auth — igual que en la app Flutter.
//   • Tras autenticar, consulta `estado_cuenta` en `perfiles`:
//       - 'suspendido' | 'expulsado' → cierra la sesión recién
//         creada y muestra una hoja de bloqueo que no se puede
//         descartar sin presionar "Entendido".
//       - cualquier otro valor       → navega a '/home' (Feed).
//   • Se auto-registra como ruta '/login' al importarse, así que
//     basta con importar este archivo una vez desde index.html.
//
// Dependencias: core/supabase-client.js (cliente único de Supabase),
// core/router.js (navegación entre pantallas), core/toast.js
// (mensajes de error flotantes).
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../core/supabase-client.js';
import { navegarA, registrarRuta } from '../core/router.js';
import { mostrarToast } from '../core/toast.js';

/**
 * Pinta la pantalla de login dentro de `contenedor` y engancha sus
 * eventos. Es la función que el router invoca al entrar a '/login'.
 * @param {HTMLElement} contenedor
 */
export function renderLogin(contenedor) {
  contenedor.innerHTML = `
    <div class="pantalla-fondo" style="background-image: url('assets/img/tec_villahermosa.png')"></div>
    <div class="pantalla-overlay"></div>

    <div class="auth-centro">
      <img class="auth-logo" src="assets/icons/splash_foreground.png" alt="Comunidad ITVH" />

      <div class="glass-card auth-card">
        <h1 class="auth-titulo">Bienvenido</h1>
        <p class="auth-subtitulo">Inicia sesión para continuar</p>

        <form id="form-login" novalidate>
          <div class="glass-field">
            <span class="glass-field__icon">👤</span>
            <input
              id="login-identificador"
              type="text"
              placeholder="Correo o usuario"
              autocomplete="username"
            />
          </div>

          <div class="glass-field" style="margin-top: 14px;">
            <span class="glass-field__icon">🔒</span>
            <input
              id="login-password"
              type="password"
              placeholder="Contraseña"
              autocomplete="current-password"
            />
            <span class="glass-field__trailing" id="login-toggle-visibilidad">👁️</span>
          </div>

          <div class="auth-link-derecha">
            <a href="#/recuperar">¿Olvidaste tu contraseña?</a>
          </div>

          <button type="submit" id="login-boton" class="btn-primary">
            Iniciar sesión
          </button>

          <p class="auth-link-centro">
            ¿No tienes cuenta? <a href="#/registro">Regístrate</a>
          </p>
        </form>
      </div>
    </div>
  `;

  _inicializarEventos(contenedor);
}

/** Engancha el submit del formulario y el toggle de visibilidad de contraseña. */
function _inicializarEventos(contenedor) {
  const form = contenedor.querySelector('#form-login');
  const passwordInput = contenedor.querySelector('#login-password');
  const toggleVisibilidad = contenedor.querySelector('#login-toggle-visibilidad');

  toggleVisibilidad.addEventListener('click', () => {
    const oculto = passwordInput.type === 'password';
    passwordInput.type = oculto ? 'text' : 'password';
    toggleVisibilidad.textContent = oculto ? '🙈' : '👁️';
  });

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    _iniciarSesion(contenedor);
  });
}

/**
 * Flujo completo de login: resuelve usuario→correo si aplica,
 * autentica con Supabase, valida `estado_cuenta` y navega o
 * bloquea según el resultado. Espejo de `_login()` en
 * iniciar_sesion.dart.
 * @param {HTMLElement} contenedor
 */
async function _iniciarSesion(contenedor) {
  const boton = contenedor.querySelector('#login-boton');
  const identifier = contenedor.querySelector('#login-identificador').value.trim();
  const password = contenedor.querySelector('#login-password').value.trim();

  if (!identifier || !password) {
    mostrarToast('Completa todos los campos.');
    return;
  }

  _setCargando(boton, true);

  try {
    let email = identifier;
    let estadoPrecargado = null;

    // Si el identificador no parece un correo, se asume nombre de
    // usuario y se resuelve el correo asociado antes de autenticar.
    if (!identifier.includes('@')) {
      const { data: perfil, error } = await supabaseClient
        .from('perfiles')
        .select('email, estado_cuenta')
        .eq('nombre_usuario', identifier)
        .maybeSingle();

      if (error || !perfil) {
        mostrarToast('Usuario o contraseña incorrectos.');
        _setCargando(boton, false);
        return;
      }

      email = perfil.email;
      estadoPrecargado = perfil.estado_cuenta;
    }

    const { data: sesionData, error: authError } =
      await supabaseClient.auth.signInWithPassword({ email, password });

    if (authError) throw authError;

    // Si ya se conocía el estado (login por usuario), se reutiliza;
    // si se autenticó por correo, se consulta aparte.
    let estado = estadoPrecargado;
    if (!estado) {
      const uid = sesionData.user?.id;
      const { data: perfil } = await supabaseClient
        .from('perfiles')
        .select('estado_cuenta')
        .eq('id', uid)
        .single();
      estado = perfil?.estado_cuenta ?? 'activo';
    }

    if (estado === 'suspendido' || estado === 'expulsado') {
      await supabaseClient.auth.signOut();
      _setCargando(boton, false);
      _mostrarPantallaBloqueo(estado);
      return;
    }

    // Login exitoso — navega al Feed.
    navegarA('/home');
  } catch (error) {
    _setCargando(boton, false);
    mostrarToast(_traducirError(error?.message ?? ''));
  }
}

/** Traduce los mensajes de error de Supabase Auth al español. */
function _traducirError(msg) {
  const lower = msg.toLowerCase();

  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid email or password')
  ) {
    return 'Correo o contraseña incorrectos.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirma tu correo antes de iniciar sesión.';
  }
  if (lower.includes('too many requests')) {
    return 'Demasiados intentos. Espera un momento.';
  }
  return 'Error al iniciar sesión. Intenta de nuevo.';
}

/** Alterna el botón de login entre su estado normal y "cargando" (spinner). */
function _setCargando(boton, cargando) {
  boton.disabled = cargando;
  boton.innerHTML = cargando
    ? '<span class="btn-spinner"></span>'
    : 'Iniciar sesión';
}

/**
 * Hoja de bloqueo mostrada cuando la cuenta está suspendida o
 * expulsada. Equivalente al `showModalBottomSheet` no descartable
 * de Flutter: no se cierra con click afuera, solo con "Entendido".
 * @param {'suspendido'|'expulsado'} estado
 */
function _mostrarPantallaBloqueo(estado) {
  const esSuspendido = estado === 'suspendido';
  const color = esSuspendido ? 'var(--color-warning)' : 'var(--color-danger)';

  const overlay = document.createElement('div');
  overlay.className = 'bloqueo-overlay';
  overlay.innerHTML = `
    <div class="bloqueo-hoja">
      <div class="bloqueo-icono" style="background:${color}26; border-color:${color}66;">
        <span style="color:${color}; font-size: 36px;">${esSuspendido ? '🔒' : '⛔'}</span>
      </div>
      <h2>${esSuspendido ? 'Cuenta suspendida' : 'Cuenta eliminada'}</h2>
      <p>
        ${
          esSuspendido
            ? 'Tu cuenta ha sido suspendida temporalmente por violar las normas de la comunidad. Si crees que es un error, contacta a un administrador.'
            : 'Tu cuenta ha sido eliminada permanentemente de la plataforma por violar gravemente las normas de la comunidad. No es posible recuperarla.'
        }
      </p>
      <button class="btn-outline" id="bloqueo-entendido">Entendido</button>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#bloqueo-entendido').addEventListener('click', () => {
    overlay.remove();
  });
}

// Se registra apenas se importa el módulo — index.html solo necesita
// importar este archivo una vez para que la ruta '/login' exista.
registrarRuta('/login', renderLogin);