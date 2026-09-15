// ═════════════════════════════════════════════════════════════════
// crear-cuenta.js
//
// Pantalla de registro de nuevos usuarios en Comunidad ITVH (web).
// Réplica funcional de Logins/crear_cuenta.dart.
//
// Solo permite registrarse con correo institucional del ITVH
// (formato: l########@villahermosa.tecnm.mx). Cualquier otro correo
// se rechaza localmente antes de llamar a Supabase.
//
// Flujo de registro (idéntico al de Flutter):
//   1. Validar todos los campos en el navegador.
//   2. Verificar que el nombre de usuario no esté en uso (ilike).
//   3. Crear el usuario en Supabase Auth (signUp).
//   4. Insertar el perfil en la tabla `perfiles` (upsert, por si un
//      trigger de Supabase ya creó una fila vacía).
//   5. Navegar a '/home' — la sesión ya quedó activa tras el signUp.
//
// Secciones del formulario, en el mismo orden que en Flutter:
//   • Datos personales      — nombre completo, nombre de usuario
//   • Información académica — carrera y semestre (selects)
//   • Datos de acceso       — número de control, correo
//     institucional, contraseña, confirmar contraseña y aceptación
//     de Términos/Política
//
// Dependencias: core/supabase-client.js, core/router.js,
// core/toast.js.
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../core/supabase-client.js';
import { navegarA, registrarRuta } from '../core/router.js';
import { mostrarToast } from '../core/toast.js';

// Enlaces legales — Comunidad ITVH (mismos que en Flutter).
const URL_TERMINOS =
  'https://programix-navejl.github.io/Comunidad-ITVH-Cumplimiento-Legal/terminos.html';
const URL_POLITICA =
  'https://programix-navejl.github.io/Comunidad-ITVH-Cumplimiento-Legal/politica.html';

// Catálogo de carreras del ITVH — idéntico al de crear_cuenta.dart.
const CARRERAS = [
  'Ingeniería Ambiental',
  'Ingeniería Bioquímica',
  'Ingeniería Civil',
  'Ingeniería en Ciencia de Datos',
  'Ingeniería en Gestión Empresarial',
  'Ingeniería en Sistemas Computacionales',
  'Ingeniería en Tecnologías de la Información y Comunicaciones',
  'Ingeniería Industrial',
  'Ingeniería Informática',
  'Ingeniería Petrolera',
  'Ingeniería Química',
  'Licenciatura en Administración',
];

// Nombre de usuario: letras SIN acentos/ñ, números, guion bajo y
// punto, sin espacios. El punto no puede ir al inicio, al final, ni
// repetirse — misma convención que Instagram, para no complicar la
// resolución de @menciones en el resto de la app. Entre 3 y 20
// caracteres.
const REGEX_USUARIO = /^(?!\.)(?!.*\.\.)[A-Za-z0-9_.]{3,20}(?<!\.)$/;

// Correo institucional válido: l + 8 dígitos + dominio del ITVH.
const REGEX_CORREO_TEC = /^l[0-9]{8}@villahermosa\.tecnm\.mx$/;

/**
 * Pinta la pantalla de registro dentro de `contenedor` y engancha
 * sus eventos. Es la función que el router invoca al entrar a
 * '/registro'.
 * @param {HTMLElement} contenedor
 */
export function renderRegistro(contenedor) {
  contenedor.innerHTML = `
    <div class="pantalla-fondo" style="background-image: url('assets/img/tec_villahermosa.png')"></div>
    <div class="pantalla-overlay"></div>

    <div class="auth-centro">
      <img class="auth-logo" src="assets/icons/splash_foreground.png" alt="Comunidad ITVH" />

      <div class="glass-card auth-card">
        <h1 class="auth-titulo">Crear cuenta</h1>
        <p class="auth-subtitulo">Completa tu información para registrarte</p>

        <form id="form-registro" novalidate>

          <p class="section-label">Datos personales</p>

          <div class="glass-field">
            <span class="glass-field__icon">🪪</span>
            <input id="reg-nombre" type="text" placeholder="Nombre completo" autocomplete="name" />
          </div>

          <div class="glass-field" style="margin-top: 12px;">
            <span class="glass-field__icon">@</span>
            <input id="reg-usuario" type="text" placeholder="Nombre de usuario" autocomplete="off" />
          </div>
          <p class="field-hint">
            Sin espacios ni acentos. Letras, números, guion bajo y punto
            (el punto no va al inicio, al final ni repetido).
          </p>

          <p class="section-label" style="margin-top: 20px;">Información académica</p>

          <div class="glass-field">
            <span class="glass-field__icon">🎓</span>
            <select id="reg-carrera">
              <option value="" disabled selected>Selecciona tu carrera</option>
              ${CARRERAS.map((c) => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>

          <div class="glass-field" style="margin-top: 12px;">
            <span class="glass-field__icon">📅</span>
            <select id="reg-semestre">
              <option value="" disabled selected>Semestre actual</option>
              ${Array.from({ length: 12 }, (_, i) => i + 1)
                .map((s) => `<option value="${s}">${s}° Semestre</option>`)
                .join('')}
            </select>
          </div>

          <p class="section-label" style="margin-top: 20px;">Datos de acceso</p>

          <div class="glass-field">
            <span class="glass-field__icon">#️⃣</span>
            <input id="reg-control" type="text" inputmode="numeric" placeholder="Número de control" />
          </div>

          <div class="glass-field" style="margin-top: 12px;">
            <span class="glass-field__icon">✉️</span>
            <input id="reg-email" type="email" placeholder="Correo institucional" autocomplete="email" />
          </div>

          <div class="glass-field" style="margin-top: 12px;">
            <span class="glass-field__icon">🔒</span>
            <input id="reg-password" type="password" placeholder="Contraseña" autocomplete="new-password" />
            <span class="glass-field__trailing" id="reg-toggle-password">👁️</span>
          </div>

          <div class="glass-field" style="margin-top: 12px;">
            <span class="glass-field__icon">🔒</span>
            <input id="reg-confirmar" type="password" placeholder="Confirmar contraseña" autocomplete="new-password" />
            <span class="glass-field__trailing" id="reg-toggle-confirmar">👁️</span>
          </div>

          <div class="glass-checkbox-row" style="margin-top: 20px;">
            <input type="checkbox" id="reg-acepta-terminos" />
            <label for="reg-acepta-terminos">
              He leído y acepto los
              <a href="${URL_TERMINOS}" target="_blank" rel="noopener">Términos y Condiciones</a>
              y la
              <a href="${URL_POLITICA}" target="_blank" rel="noopener">Política de Privacidad</a>
              de Comunidad ITVH.
            </label>
          </div>

          <button type="submit" id="reg-boton" class="btn-primary" style="margin-top: 20px;">
            Crear cuenta
          </button>

          <p class="auth-link-centro">
            ¿Ya tienes cuenta? <a href="#/login">Inicia sesión</a>
          </p>

        </form>
      </div>
    </div>
  `;

  _inicializarEventos(contenedor);
}

/** Engancha el submit del formulario y los toggles de visibilidad de contraseña. */
function _inicializarEventos(contenedor) {
  const form = contenedor.querySelector('#form-registro');

  _engancharToggle(contenedor, '#reg-password', '#reg-toggle-password');
  _engancharToggle(contenedor, '#reg-confirmar', '#reg-toggle-confirmar');

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    _registrar(contenedor);
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
 * Flujo completo de registro: valida todos los campos en el mismo
 * orden que `_register()` en crear_cuenta.dart, verifica unicidad
 * de usuario, crea la cuenta en Supabase Auth y su perfil, y navega
 * al Feed si todo sale bien.
 * @param {HTMLElement} contenedor
 */
async function _registrar(contenedor) {
  const boton = contenedor.querySelector('#reg-boton');

  const nombre = contenedor.querySelector('#reg-nombre').value.trim();
  const usuario = contenedor.querySelector('#reg-usuario').value.trim();
  const carrera = contenedor.querySelector('#reg-carrera').value;
  const semestre = contenedor.querySelector('#reg-semestre').value;
  const control = contenedor.querySelector('#reg-control').value.trim();
  const email = contenedor.querySelector('#reg-email').value.trim().toLowerCase();
  const password = contenedor.querySelector('#reg-password').value.trim();
  const confirmarPassword = contenedor.querySelector('#reg-confirmar').value.trim();
  const aceptaTerminos = contenedor.querySelector('#reg-acepta-terminos').checked;

  // ── Validaciones locales, mismo orden que en Flutter ────────────
  if (!nombre) return mostrarToast('Ingresa tu nombre completo.');
  if (!usuario) return mostrarToast('Ingresa un nombre de usuario.');
  if (!REGEX_USUARIO.test(usuario)) {
    return mostrarToast(
      'El usuario solo puede tener letras (sin acentos ni ñ), números, ' +
        'guion bajo y punto — sin espacios, y el punto no puede ir al ' +
        'inicio, al final ni repetirse. Entre 3 y 20 caracteres.'
    );
  }
  if (!control) return mostrarToast('Ingresa tu número de control.');
  if (!email) return mostrarToast('Ingresa tu correo institucional.');
  if (!REGEX_CORREO_TEC.test(email)) {
    return mostrarToast('Acceso denegado. Introduce un correo institucional válido del ITVH.');
  }
  if (password.length < 6) return mostrarToast('La contraseña debe tener al menos 6 caracteres.');
  if (!confirmarPassword) return mostrarToast('Confirma tu contraseña.');
  if (password !== confirmarPassword) return mostrarToast('Las contraseñas no coinciden.');
  if (!carrera) return mostrarToast('Selecciona tu carrera.');
  if (!semestre) return mostrarToast('Selecciona tu semestre.');
  if (!aceptaTerminos) return mostrarToast('Debes aceptar los Términos y la Política de Privacidad.');

  _setCargando(boton, true);

  try {
    // Verificar unicidad del nombre de usuario (case-insensitive).
    const { data: usuarioExistente } = await supabaseClient
      .from('perfiles')
      .select('id')
      .ilike('nombre_usuario', usuario)
      .maybeSingle();

    if (usuarioExistente) {
      mostrarToast('Ese nombre de usuario ya está en uso.');
      _setCargando(boton, false);
      return;
    }

    // Crear el usuario en Supabase Auth.
    const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
      email,
      password,
    });
    if (signUpError) throw signUpError;

    const uid = signUpData.user?.id;
    if (!uid) throw new Error('No se pudo crear el usuario.');

    // Insertar el perfil — upsert por si un trigger de Supabase ya
    // creó una fila vacía al detectar el nuevo usuario de Auth.
    const { error: perfilError } = await supabaseClient.from('perfiles').upsert({
      id: uid,
      nombre,
      nombre_usuario: usuario,
      email,
      carrera,
      semestre: Number(semestre),
      numero_control: control,
      acepto_terminos: aceptaTerminos,
    });
    if (perfilError) throw perfilError;

    // Registro exitoso — la sesión ya quedó activa tras el signUp.
    navegarA('/home');
  } catch (error) {
    _setCargando(boton, false);
    mostrarToast(_traducirError(error?.message ?? ''));
  }
}

/**
 * Traduce los mensajes de error de Supabase Auth / Postgres al
 * español. También captura errores de constraints de la base de
 * datos, igual que `_traducirError()` en crear_cuenta.dart.
 */
function _traducirError(msg) {
  const lower = msg.toLowerCase();

  if (
    lower.includes('database error') ||
    lower.includes('unexpected_failure') ||
    lower.includes('violates check constraint')
  ) {
    return 'Tu matrícula no cumple con los requisitos del Tec (L + 8 números) o ya está registrada.';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'Ya existe una cuenta con ese correo institucional.';
  }
  if (lower.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (lower.includes('invalid email') || lower.includes('bad request')) {
    return 'El formato del correo electrónico no es válido.';
  }
  if (lower.includes('signup is disabled')) {
    return 'El registro está deshabilitado temporalmente.';
  }
  return msg || 'Error al crear la cuenta. Intenta de nuevo.';
}

/** Alterna el botón de registro entre su estado normal y "cargando" (spinner). */
function _setCargando(boton, cargando) {
  boton.disabled = cargando;
  boton.innerHTML = cargando ? '<span class="btn-spinner"></span>' : 'Crear cuenta';
}

// Se registra apenas se importa el módulo.
registrarRuta('/registro', renderRegistro);