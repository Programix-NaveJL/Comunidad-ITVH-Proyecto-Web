// Pantalla de configuración de la cuenta del usuario.
//
// Secciones: Cuenta (cambiar contraseña), Notificaciones (historial
// de reacciones/comentarios — ahora rutas reales, ver
// historial-reacciones.js / historial-comentarios.js), Legal
// (enlaces externos) y Sesión (cerrar sesión, eliminar cuenta).
//
// Eliminar cuenta: pendiente la limpieza de archivos en Cloudflare
// R2 (r2_config.dart / storage_service.dart aún no se portaron).
// Por ahora solo se borra la fila en `perfiles` — el cascade de
// Supabase limpia el resto en base de datos, pero los archivos
// físicos en R2 quedan huérfanos hasta que se porte esa parte.
//
// '/historial-reacciones' y '/historial-comentarios' ya NO se
// registran aquí como placeholder: historial-reacciones.js y
// historial-comentarios.js se autoregistran en esas rutas al
// cargarse (igual que el resto de pantallas del proyecto) — solo
// falta agregar su <script type="module"> en index.html.

import { supabaseClient } from '../../core/supabase-client.js';
import { registrarRuta, navegarA } from '../../core/router.js';
import { mostrarToast } from '../../core/toast.js';

const URL_TERMINOS = 'https://programix-navejl.github.io/Comunidad-ITVH-Cumplimiento-Legal/terminos.html';
const URL_POLITICA = 'https://programix-navejl.github.io/Comunidad-ITVH-Cumplimiento-Legal/politica.html';
const URL_ESTANDARES = 'https://programix-navejl.github.io/Comunidad-ITVH-Cumplimiento-Legal/estandares.html';

registrarRuta('/ajustes', renderAjustes);
registrarRuta('/ajustes-contrasena', renderCambiarContrasena);

// ─────────────────────────────────────────────────────────────────
// PANTALLA PRINCIPAL
// ─────────────────────────────────────────────────────────────────

function renderAjustes(contenedor) {
  contenedor.innerHTML = `
    <div class="ajustes">
      <header class="ajustes-header">
        <button class="ajustes-volver" id="ajustes-volver" aria-label="Regresar">‹</button>
        <h1>Ajustes</h1>
      </header>

      <div class="ajustes-cuerpo">
        <p class="ajustes-seccion">CUENTA</p>
        <div class="ajustes-grupo">
          ${filaTile({ icono: '🔒', color: '#007aff', titulo: 'Cambiar contraseña', id: 'ajustes-cambiar-password' })}
        </div>

        <p class="ajustes-seccion">NOTIFICACIONES</p>
        <div class="ajustes-grupo">
          ${filaRow({ icono: '❤️', color: '#ff3b30', titulo: 'Reacciones', subtitulo: 'Publicaciones a las que reaccionaste', id: 'ajustes-reacciones' })}
          <div class="ajustes-divisor"></div>
          ${filaRow({ icono: '💬', color: '#007aff', titulo: 'Comentarios', subtitulo: 'Publicaciones en las que comentaste', id: 'ajustes-comentarios' })}
        </div>

        <p class="ajustes-seccion">LEGAL</p>
        <div class="ajustes-grupo">
          ${filaTile({ icono: '📄', color: '#ff9500', titulo: 'Términos y condiciones', id: 'ajustes-terminos' })}
          <div class="ajustes-divisor"></div>
          ${filaTile({ icono: '🛡️', color: '#ff9500', titulo: 'Política de privacidad', id: 'ajustes-politica' })}
          <div class="ajustes-divisor"></div>
          ${filaTile({ icono: '🛡️', color: '#ff9500', titulo: 'Estándares de seguridad infantil', id: 'ajustes-estandares' })}
        </div>

        <p class="ajustes-seccion">SESIÓN</p>
        <div class="ajustes-grupo">
          ${filaTile({ icono: '🚪', color: '#007aff', titulo: 'Cerrar sesión', id: 'ajustes-cerrar-sesion', flecha: false })}
          <div class="ajustes-divisor"></div>
          ${filaTile({ icono: '🗑️', color: '#ff3b30', titulo: 'Eliminar cuenta', id: 'ajustes-eliminar-cuenta', flecha: false, colorTitulo: '#ff3b30' })}
        </div>

        <div class="ajustes-pie">
          <a href="https://programix-navejl.github.io/Programix-NaveJL-Pagina-Oficial/" target="_blank" rel="noopener">
            <p>Comunidad ITVH</p>
            <p class="ajustes-pie__copy">Programix NaveJL © 2026</p>
          </a>
        </div>
      </div>
    </div>
  `;

  activarInteraccionesAjustes(contenedor);
}

function filaTile({ icono, color, titulo, id, flecha = true, colorTitulo }) {
  return `
    <button class="ajustes-tile" id="${id}">
      <span class="ajustes-tile__icono" style="background:${color}1f;color:${color}">${icono}</span>
      <span class="ajustes-tile__titulo" style="${colorTitulo ? `color:${colorTitulo}` : ''}">${titulo}</span>
      ${flecha ? '<span class="ajustes-tile__flecha">›</span>' : ''}
    </button>
  `;
}

function filaRow({ icono, color, titulo, subtitulo, id }) {
  return `
    <button class="ajustes-tile" id="${id}">
      <span class="ajustes-tile__icono" style="background:${color}1f;color:${color}">${icono}</span>
      <span class="ajustes-tile__textos">
        <span class="ajustes-tile__titulo">${titulo}</span>
        <span class="ajustes-tile__subtitulo">${subtitulo}</span>
      </span>
      <span class="ajustes-tile__flecha">›</span>
    </button>
  `;
}

function activarInteraccionesAjustes(contenedor) {
  contenedor.querySelector('#ajustes-volver').addEventListener('click', () => window.history.back());
  contenedor.querySelector('#ajustes-cambiar-password').addEventListener('click', () => navegarA('/ajustes-contrasena'));
  contenedor.querySelector('#ajustes-reacciones').addEventListener('click', () => navegarA('/historial-reacciones'));
  contenedor.querySelector('#ajustes-comentarios').addEventListener('click', () => navegarA('/historial-comentarios'));
  contenedor.querySelector('#ajustes-terminos').addEventListener('click', () => window.open(URL_TERMINOS, '_blank', 'noopener'));
  contenedor.querySelector('#ajustes-politica').addEventListener('click', () => window.open(URL_POLITICA, '_blank', 'noopener'));
  contenedor.querySelector('#ajustes-estandares').addEventListener('click', () => window.open(URL_ESTANDARES, '_blank', 'noopener'));
  contenedor.querySelector('#ajustes-cerrar-sesion').addEventListener('click', confirmarCerrarSesion);
  contenedor.querySelector('#ajustes-eliminar-cuenta').addEventListener('click', abrirDialogoEliminarCuenta);
}

// ─────────────────────────────────────────────────────────────────
// DIÁLOGO: Cerrar sesión
// ─────────────────────────────────────────────────────────────────

function confirmarCerrarSesion() {
  abrirDialogo({
    icono: '🚪',
    titulo: 'Cerrar sesión',
    cuerpo: '¿Estás seguro que deseas cerrar tu sesión?',
    textoConfirmar: 'Cerrar sesión',
    colorConfirmar: '#007aff',
    onConfirmar: async (cerrar) => {
      await supabaseClient.auth.signOut();
      cerrar();
      navegarA('/login');
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// DIÁLOGO: Eliminar cuenta
// ─────────────────────────────────────────────────────────────────

function abrirDialogoEliminarCuenta() {
  const overlay = document.createElement('div');
  overlay.className = 'ajustes-dialogo-overlay';
  overlay.innerHTML = `
    <div class="ajustes-dialogo">
      <p class="ajustes-dialogo__titulo">⚠️ Eliminar cuenta</p>
      <p class="ajustes-dialogo__cuerpo">
        Esta acción es permanente e irreversible. Se eliminarán tu perfil,
        publicaciones, historias y todos tus datos.
      </p>
      <p class="ajustes-dialogo__label">Escribe ELIMINAR para confirmar:</p>
      <input type="text" id="ajustes-eliminar-input" class="ajustes-dialogo__input" placeholder="ELIMINAR" autocomplete="off" />
      <p class="ajustes-dialogo__error" id="ajustes-eliminar-error"></p>
      <div class="ajustes-dialogo__acciones">
        <button class="ajustes-dialogo__btn" id="ajustes-eliminar-cancelar">Cancelar</button>
        <button class="ajustes-dialogo__btn ajustes-dialogo__btn--peligro" id="ajustes-eliminar-confirmar" disabled>Eliminar cuenta</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector('#ajustes-eliminar-input');
  const btnConfirmar = overlay.querySelector('#ajustes-eliminar-confirmar');
  const errorEl = overlay.querySelector('#ajustes-eliminar-error');

  input.addEventListener('input', () => {
    // Mayúsculas automáticas para que coincida con "ELIMINAR" sin
    // que la persona tenga que activar Bloq Mayús.
    input.value = input.value.toUpperCase();
    btnConfirmar.disabled = input.value.trim() !== 'ELIMINAR';
  });

  overlay.querySelector('#ajustes-eliminar-cancelar').addEventListener('click', () => overlay.remove());

  btnConfirmar.addEventListener('click', async () => {
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = '<span class="btn-spinner"></span>';
    errorEl.textContent = '';

    try {
      const { data } = await supabaseClient.auth.getUser();
      const uid = data?.user?.id;
      if (!uid) throw new Error('Sesión no válida.');

      // NOTA: aquí falta la limpieza de archivos en Cloudflare R2
      // (publicaciones, historias, foto de perfil) — pendiente de
      // portar r2_config.dart / storage_service.dart. Por ahora solo
      // se borra la fila de perfil; el cascade de Supabase limpia el
      // resto en base de datos, pero los archivos en R2 quedan huérfanos.
      const { error } = await supabaseClient.from('perfiles').delete().eq('id', uid);
      if (error) throw error;

      await supabaseClient.auth.signOut();
      overlay.remove();
      navegarA('/login');
    } catch (error) {
      console.error('ajustes – error eliminando cuenta:', error);
      errorEl.textContent = 'No se pudo eliminar la cuenta. Intenta de nuevo.';
      btnConfirmar.disabled = false;
      btnConfirmar.textContent = 'Eliminar cuenta';
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// DIÁLOGO GENÉRICO (confirmación simple, tipo AlertDialog)
// ─────────────────────────────────────────────────────────────────

function abrirDialogo({ titulo, cuerpo, textoConfirmar, colorConfirmar, onConfirmar }) {
  const overlay = document.createElement('div');
  overlay.className = 'ajustes-dialogo-overlay';
  overlay.innerHTML = `
    <div class="ajustes-dialogo">
      <p class="ajustes-dialogo__titulo">${titulo}</p>
      <p class="ajustes-dialogo__cuerpo">${cuerpo}</p>
      <div class="ajustes-dialogo__acciones">
        <button class="ajustes-dialogo__btn" id="ajustes-dialogo-cancelar">Cancelar</button>
        <button class="ajustes-dialogo__btn" id="ajustes-dialogo-confirmar" style="color:${colorConfirmar}">${textoConfirmar}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const cerrar = () => overlay.remove();
  overlay.querySelector('#ajustes-dialogo-cancelar').addEventListener('click', cerrar);
  overlay.querySelector('#ajustes-dialogo-confirmar').addEventListener('click', () => onConfirmar(cerrar));
}

// ─────────────────────────────────────────────────────────────────
// SUB-PANTALLA: Cambiar contraseña
// ─────────────────────────────────────────────────────────────────

function renderCambiarContrasena(contenedor) {
  contenedor.innerHTML = `
    <div class="ajustes">
      <header class="ajustes-header">
        <button class="ajustes-volver" id="contrasena-volver" aria-label="Regresar">‹</button>
        <h1>Cambiar contraseña</h1>
        <button class="ajustes-guardar" id="contrasena-guardar">Guardar</button>
      </header>

      <div class="ajustes-cuerpo">
        <div class="ajustes-grupo" style="margin-top:8px;">
          <div class="ajustes-campo-password">
            <input type="password" id="contrasena-nueva" placeholder="Nueva contraseña" />
            <button type="button" class="ajustes-toggle-ver" data-target="contrasena-nueva">👁️</button>
          </div>
          <div class="ajustes-divisor"></div>
          <div class="ajustes-campo-password">
            <input type="password" id="contrasena-confirmar" placeholder="Confirmar contraseña" />
            <button type="button" class="ajustes-toggle-ver" data-target="contrasena-confirmar">👁️</button>
          </div>
        </div>
        <p class="ajustes-hint">La nueva contraseña debe tener al menos 8 caracteres.</p>
      </div>
    </div>
  `;

  activarInteraccionesContrasena(contenedor);
}

function activarInteraccionesContrasena(contenedor) {
  contenedor.querySelector('#contrasena-volver').addEventListener('click', () => window.history.back());

  contenedor.querySelectorAll('.ajustes-toggle-ver').forEach((boton) => {
    boton.addEventListener('click', () => {
      const input = contenedor.querySelector(`#${boton.dataset.target}`);
      const oculto = input.type === 'password';
      input.type = oculto ? 'text' : 'password';
      boton.textContent = oculto ? '🙈' : '👁️';
    });
  });

  contenedor.querySelector('#contrasena-guardar').addEventListener('click', () => guardarContrasena(contenedor));
}

async function guardarContrasena(contenedor) {
  const nueva = contenedor.querySelector('#contrasena-nueva').value.trim();
  const confirmar = contenedor.querySelector('#contrasena-confirmar').value.trim();
  const boton = contenedor.querySelector('#contrasena-guardar');

  if (!nueva) return mostrarToast('Ingresa tu nueva contraseña', 'error');
  if (nueva.length < 8) return mostrarToast('Mínimo 8 caracteres', 'error');
  if (confirmar !== nueva) return mostrarToast('Las contraseñas no coinciden', 'error');

  boton.disabled = true;
  boton.innerHTML = '<span class="btn-spinner" style="width:16px;height:16px;border-width:2px;"></span>';

  try {
    const { error } = await supabaseClient.auth.updateUser({ password: nueva });
    if (error) throw error;

    mostrarToast('Contraseña actualizada correctamente.', 'success');
    window.history.back();
  } catch (error) {
    mostrarToast(error?.message ?? 'Ocurrió un error. Intenta de nuevo.', 'error');
    boton.disabled = false;
    boton.textContent = 'Guardar';
  }
}