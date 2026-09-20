// editar-perfil.js
// Ruta real: js/features/perfil/editar-perfil.js
//
// Puerto de editar_perfil.dart. Pantalla "Editar perfil": foto,
// nombre, @usuario, correo (solo lectura), presentación/bio,
// carrera/semestre (pickers), redes sociales y cerrar sesión.
//
// DIFERENCIA DE PLATAFORMA — cómo se monta: en el Dart es una ruta
// del Navigator que se abre encima de Mi Perfil y se cierra con
// Navigator.pop(). Acá, como Mi Perfil es una PESTAÑA del shell (no
// una ruta con URL propia — ver mi-perfil-screen.js), este archivo
// SÍ es una ruta real del router (`/perfil/editar`, que shell.js ya
// asumía) y se auto-registra al final de este archivo, mismo
// patrón que iniciar-sesion.js / crear-cuenta.js. Al guardar o
// cancelar se navega de vuelta a '/shell' en lugar de un pop.
//
// DIFERENCIA DE PLATAFORMA — permisos de cámara/galería: el Dart
// pide permission_handler explícitamente antes de abrir el picker.
// En el navegador eso no aplica — un <input type="file"> normal
// abre el selector de archivos del sistema, y uno con
// capture="environment" invita a la cámara en móvil; el propio
// navegador maneja cualquier permiso, no hace falta pedirlo desde
// JS.
//
// DIFERENCIA DE PLATAFORMA — "cambios sin guardar" al salir: el
// Dart intercepta el pop del Navigator (PopScope) para cualquier
// forma de salir, incluido el gesto nativo de "atrás". Acá solo se
// intercepta el botón "‹" propio de este header — el router es
// intencionalmente simple (ver core/router.js) y no expone un hook
// para interceptar cambios de hash en general (ej. el botón "atrás"
// del navegador). Limitación aceptada por ahora, mismo criterio que
// otros límites ya documentados en mi-perfil-screen.js.
//
// DIFERENCIA DE PLATAFORMA — diálogos de confirmación: en vez de
// duplicar el CSS de un modal de confirmación, este archivo
// reutiliza las clases `.ajustes-dialogo*` de css/drawer/ajustes.css
// (ya cargado globalmente en index.html) tanto para "cambios sin
// guardar" como para "cerrar sesión" — son genéricas (título +
// cuerpo + 2 botones) y ya están resueltas ahí.
//
// DIFERENCIA DE PLATAFORMA — resolución de la URL de la foto: el
// Dart resuelve a mano cdn_foto_perfil vs. el fallback legado de
// Supabase Storage (foto_perfil). Acá se reutiliza
// resolverUrlPerfil() de perfil-utils.js, que ya hace exactamente
// esa resolución (la misma que usan seguidores-sheet.js y
// mi-perfil-header.js) — evita reimplementar esa lógica legada por
// tercera vez.

import { supabaseClient } from '../../core/supabase-client.js';
import { mostrarToast } from '../../core/toast.js';
import { navegarA, registrarRuta } from '../../core/router.js';
import { abrirHojaInferior } from '../../core/bottom-sheet.js';
import { storageService } from '../../core/storage-service.js';
import { R2_CONFIG } from '../../core/r2-config.js';
import { resolverUrlPerfil } from '../../core/perfil-utils.js';
import { abrirFotoCompleta } from './mi-perfil/mi-perfil-widgets.js';

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

const SEMESTRES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const SELECT_EDITAR_PERFIL = [
  'id',
  'nombre',
  'nombre_usuario',
  'cdn_foto_perfil',
  'carrera',
  'semestre',
  'presentacion',
  'facebook_url',
  'instagram_url',
  'tiktok_url',
].join(', ');

// Misma regla que en crear-cuenta.js (registro) y en el Dart
// original: letras sin acentos/ñ, números, guion bajo y punto, sin
// espacios; el punto no va al inicio, al final ni repetido; 3–20
// caracteres. Se repite aquí a propósito — ver el comentario
// equivalente en editar_perfil.dart sobre por qué no se centraliza
// todavía.
const REGEX_USUARIO = /^(?!\.)(?!.*\.\.)[A-Za-z0-9_.]{3,20}(?<!\.)$/;

export async function render(contenedor) {
  const estado = {
    cargando: true,
    guardando: false,
    perfil: null,
    email: '',
    fotoUrl: null,
    fotoOriginalUrl: null, // URL "limpia" (sin ?v=) para poder borrar de R2
    imagenLocal: null,
    imagenLocalUrl: null, // object URL de preview, revocado al reemplazar
    fotoEliminada: false,
    carreraSeleccionada: null,
    semestreSeleccionada: null,
    // snapshot original, para detectar cambios sin guardar
    nombreOriginal: '',
    usuarioOriginal: '',
    presentacionOriginal: '',
    igOriginal: '',
    fbOriginal: '',
    ttOriginal: '',
    carreraOriginal: null,
    semestreOriginal: null,
  };

  contenedor.innerHTML = `<div class="ep-screen" id="ep-root"></div>`;
  const root = contenedor.querySelector('#ep-root');

  const { data: userData } = await supabaseClient.auth.getUser();
  const uid = userData?.user?.id ?? null;
  if (!uid) return;

  pintarCargando();
  await cargarPerfil();

  // ── Carga ──────────────────────────────────────────────────

  function pintarCargando() {
    root.innerHTML = `<div class="ep-cargando"><span class="btn-spinner"></span></div>`;
  }

  async function cargarPerfil() {
    try {
      const { data: perfil, error } = await supabaseClient.from('perfiles').select(SELECT_EDITAR_PERFIL).eq('id', uid).single();
      if (error) throw error;

      estado.perfil = perfil;
      estado.fotoUrl = resolverUrlPerfil(perfil);
      estado.fotoOriginalUrl = perfil.cdn_foto_perfil || null;
      estado.carreraSeleccionada = CARRERAS.includes(perfil.carrera) ? perfil.carrera : null;
      const sem = perfil.semestre;
      estado.semestreSeleccionada = sem != null && sem >= 1 && sem <= 12 ? sem : null;
      estado.email = perfil.email || userData?.user?.email || '';

      estado.nombreOriginal = perfil.nombre ?? '';
      estado.usuarioOriginal = perfil.nombre_usuario ?? '';
      estado.presentacionOriginal = perfil.presentacion ?? '';
      estado.igOriginal = perfil.instagram_url ?? '';
      estado.fbOriginal = perfil.facebook_url ?? '';
      estado.ttOriginal = perfil.tiktok_url ?? '';
      estado.carreraOriginal = estado.carreraSeleccionada;
      estado.semestreOriginal = estado.semestreSeleccionada;
    } catch (error) {
      console.error('editar-perfil – cargar:', error);
      mostrarToast('No se pudo cargar tu perfil', 'error');
    } finally {
      estado.cargando = false;
      pintar();
    }
  }

  // ── Pintado ────────────────────────────────────────────────

  function pintar() {
    if (estado.cargando) {
      pintarCargando();
      return;
    }
    const p = estado.perfil ?? {};

    root.innerHTML = `
      <header class="ep-header">
        <button class="ep-volver" data-ep-volver aria-label="Atrás">‹</button>
        <h1>Mi perfil</h1>
        <button class="ep-guardar-header" id="ep-guardar-header" data-ep-guardar style="display:none">Guardar</button>
      </header>

      <div class="ep-cuerpo">
        <div class="ep-tarjeta ep-tarjeta--avatar">
          <div class="ep-avatar-wrap">
            <button class="ep-avatar-btn" data-ep-avatar-foto aria-label="Ver foto de perfil">
              <div class="ep-avatar">${fotoHtmlActual()}</div>
            </button>
            <button class="ep-avatar-camara" data-ep-avatar-camara aria-label="Cambiar foto de perfil">📷</button>
          </div>
          <p class="ep-avatar__nombre">${escaparHtml(p.nombre || 'Tu nombre')}</p>
          <p class="ep-avatar__usuario">@${escaparHtml(p.nombre_usuario || 'usuario')}</p>
        </div>

        <p class="ep-seccion">INFORMACIÓN PERSONAL</p>
        <div class="ep-tarjeta">
          <div class="ep-fila">
            <span class="ep-fila__icono">👤</span>
            <span class="ep-fila__label">Nombre</span>
            <input class="ep-fila__input" id="ep-nombre" type="text" value="${escaparAttr(p.nombre ?? '')}" placeholder="Tu nombre completo" />
          </div>
          <div class="ep-divisor"></div>
          <div class="ep-fila">
            <span class="ep-fila__icono">@</span>
            <span class="ep-fila__label">Usuario</span>
            <input class="ep-fila__input" id="ep-usuario" type="text" value="${escaparAttr(p.nombre_usuario ?? '')}" placeholder="nombre_usuario" />
          </div>
          <div class="ep-divisor"></div>
          <div class="ep-fila">
            <span class="ep-fila__icono">✉️</span>
            <span class="ep-fila__label">Correo</span>
            <span class="ep-fila__valor" title="${escaparAttr(estado.email || '')}">${escaparHtml(estado.email || 'No disponible')}</span>
            <span class="ep-fila__candado" aria-label="Solo lectura">🔒</span>
          </div>
        </div>
        <p class="ep-hint">El usuario no puede tener espacios ni acentos. Letras, números, guion bajo y punto (el punto no va al inicio, al final ni repetido). Entre 3 y 20 caracteres.</p>

        <p class="ep-seccion">PRESENTACIÓN</p>
        <div class="ep-tarjeta">
          <textarea class="ep-bio" id="ep-presentacion" maxlength="250" placeholder="Cuéntale algo a tus compañeros...">${escaparHtml(p.presentacion ?? '')}</textarea>
          <p class="ep-contador" id="ep-contador-bio">${(p.presentacion ?? '').length}/250</p>
        </div>

        <p class="ep-seccion">INFORMACIÓN ACADÉMICA</p>
        <div class="ep-tarjeta">
          <button class="ep-fila ep-fila--tocable" data-ep-carrera>
            <span class="ep-fila__icono">🎓</span>
            <span class="ep-fila__label">Carrera</span>
            <span class="ep-fila__valor ${estado.carreraSeleccionada ? '' : 'ep-fila__valor--vacio'}">${escaparHtml(estado.carreraSeleccionada ?? 'Seleccionar')}</span>
            <span class="ep-fila__flecha">›</span>
          </button>
          <div class="ep-divisor"></div>
          <button class="ep-fila ep-fila--tocable" data-ep-semestre>
            <span class="ep-fila__icono">🗓️</span>
            <span class="ep-fila__label">Semestre</span>
            <span class="ep-fila__valor ${estado.semestreSeleccionada ? '' : 'ep-fila__valor--vacio'}">${estado.semestreSeleccionada ? `${estado.semestreSeleccionada}° Semestre` : 'Seleccionar'}</span>
            <span class="ep-fila__flecha">›</span>
          </button>
        </div>

        <p class="ep-seccion">REDES SOCIALES</p>
        <p class="ep-seccion-subtitulo">Opcional — pega aquí el link completo de cada red (no solo tu @usuario).</p>
        <div class="ep-tarjeta">
          <div class="ep-fila">
            <img class="ep-fila__icono ep-fila__icono--red" src="assets/icons/instagram.png" alt="Instagram" />
            <input class="ep-fila__input" id="ep-instagram" type="url" value="${escaparAttr(p.instagram_url ?? '')}" placeholder="Pega aquí tu link de Instagram" />
          </div>
          <div class="ep-divisor"></div>
          <div class="ep-fila">
            <img class="ep-fila__icono ep-fila__icono--red" src="assets/icons/facebook.png" alt="Facebook" />
            <input class="ep-fila__input" id="ep-facebook" type="url" value="${escaparAttr(p.facebook_url ?? '')}" placeholder="Pega aquí tu link de Facebook" />
          </div>
          <div class="ep-divisor"></div>
          <div class="ep-fila">
            <img class="ep-fila__icono ep-fila__icono--red" src="assets/icons/tiktok.png" alt="TikTok" />
            <input class="ep-fila__input" id="ep-tiktok" type="url" value="${escaparAttr(p.tiktok_url ?? '')}" placeholder="Pega aquí tu link de TikTok" />
          </div>
        </div>

        <button class="ep-btn-guardar" data-ep-guardar>Guardar cambios</button>

        <div class="ep-tarjeta ep-tarjeta--cerrar-sesion">
          <button class="ep-cerrar-sesion" data-ep-cerrar-sesion>🚪 Cerrar sesión</button>
        </div>
      </div>

      <input type="file" accept="image/*" id="ep-file-galeria" hidden />
      <input type="file" accept="image/*" capture="environment" id="ep-file-camara" hidden />
    `;

    enganchar();
  }

  function fotoHtmlActual() {
    if (estado.imagenLocalUrl) return `<img src="${estado.imagenLocalUrl}" alt="" />`;
    if (estado.fotoUrl) return `<img src="${estado.fotoUrl}" alt="" />`;
    return `<span class="ep-avatar__icono">👤</span>`;
  }

  function enganchar() {
    const nombreEl = root.querySelector('#ep-nombre');
    const usuarioEl = root.querySelector('#ep-usuario');
    const presentacionEl = root.querySelector('#ep-presentacion');
    const igEl = root.querySelector('#ep-instagram');
    const fbEl = root.querySelector('#ep-facebook');
    const ttEl = root.querySelector('#ep-tiktok');

    [nombreEl, usuarioEl, igEl, fbEl, ttEl].forEach((el) => el?.addEventListener('input', actualizarBotonGuardarHeader));
    presentacionEl?.addEventListener('input', () => {
      const contador = root.querySelector('#ep-contador-bio');
      if (contador) contador.textContent = `${presentacionEl.value.length}/250`;
      actualizarBotonGuardarHeader();
    });

    root.querySelector('[data-ep-volver]').addEventListener('click', onVolver);
    root.querySelectorAll('[data-ep-guardar]').forEach((btn) => btn.addEventListener('click', guardar));
    root.querySelector('[data-ep-avatar-foto]').addEventListener('click', onTapFoto);
    root.querySelector('[data-ep-avatar-camara]').addEventListener('click', mostrarOpcionesFoto);
    root.querySelector('[data-ep-carrera]').addEventListener('click', abrirPickerCarrera);
    root.querySelector('[data-ep-semestre]').addEventListener('click', abrirPickerSemestre);
    root.querySelector('[data-ep-cerrar-sesion]').addEventListener('click', cerrarSesion);

    root.querySelector('#ep-file-galeria').addEventListener('change', (e) => onArchivoElegido(e.target.files?.[0]));
    root.querySelector('#ep-file-camara').addEventListener('change', (e) => onArchivoElegido(e.target.files?.[0]));

    actualizarBotonGuardarHeader();
  }

  // ── Foto ───────────────────────────────────────────────────

  function onTapFoto() {
    if (estado.imagenLocalUrl) {
      abrirFotoCompleta(estado.imagenLocalUrl);
    } else if (estado.fotoUrl) {
      abrirFotoCompleta(estado.fotoUrl);
    } else {
      mostrarOpcionesFoto();
    }
  }

  function onArchivoElegido(file) {
    if (!file) return;
    if (estado.imagenLocalUrl) URL.revokeObjectURL(estado.imagenLocalUrl);
    estado.imagenLocal = file;
    estado.imagenLocalUrl = URL.createObjectURL(file);
    estado.fotoEliminada = false;
    pintar();
  }

  // Mini action-sheet propio — mismo criterio de "no amerita el
  // shell completo de bottom-sheet.js" que ya usa mi-perfil-screen.js
  // para su menú de avatar (se duplica el patrón a propósito, ver
  // nota de plataforma de mi-perfil-widgets.js sobre duplicación
  // aceptable de piezas chicas).
  function mostrarOpcionesFoto() {
    const overlay = document.createElement('div');
    overlay.className = 'ep-hoja-avatar-overlay';
    overlay.innerHTML = `
      <div class="ep-hoja-avatar">
        <button class="ep-hoja-avatar__item" data-ep-op-galeria>🖼️ Seleccionar de la galería</button>
        <button class="ep-hoja-avatar__item" data-ep-op-camara>📷 Tomar una foto</button>
        ${
          estado.imagenLocalUrl || estado.fotoUrl
            ? `<button class="ep-hoja-avatar__item ep-hoja-avatar__item--peligro" data-ep-op-eliminar>🗑️ Eliminar foto</button>`
            : ''
        }
        <button class="ep-hoja-avatar__item ep-hoja-avatar__item--cancelar" data-ep-op-cancelar>Cancelar</button>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    function cerrar() {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
    }
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
    overlay.querySelector('[data-ep-op-galeria]').addEventListener('click', () => {
      cerrar();
      root.querySelector('#ep-file-galeria').click();
    });
    overlay.querySelector('[data-ep-op-camara]').addEventListener('click', () => {
      cerrar();
      root.querySelector('#ep-file-camara').click();
    });
    overlay.querySelector('[data-ep-op-eliminar]')?.addEventListener('click', () => {
      cerrar();
      if (estado.imagenLocalUrl) URL.revokeObjectURL(estado.imagenLocalUrl);
      estado.imagenLocal = null;
      estado.imagenLocalUrl = null;
      estado.fotoUrl = null;
      estado.fotoEliminada = true;
      pintar();
    });
    overlay.querySelector('[data-ep-op-cancelar]').addEventListener('click', cerrar);
  }

  // ── Pickers (carrera / semestre) ──────────────────────────────
  // Usan el mismo shell que seguidores-sheet.js (abrirHojaInferior)
  // para las listas "grandes" — consistente con el criterio ya
  // establecido en ese archivo sobre cuándo sí amerita el shell
  // completo.

  function abrirPickerCarrera() {
    const { cuerpo, cerrar } = abrirHojaInferior({ initialChildSize: 0.5, maxChildSize: 0.85, minChildSize: 0.3 });
    cuerpo.innerHTML = `
      <div class="ep-picker-titulo">Selecciona tu carrera</div>
      <div class="ep-picker-lista">
        ${CARRERAS.map(
          (c) => `
          <button class="ep-picker-item ${c === estado.carreraSeleccionada ? 'ep-picker-item--activo' : ''}" data-ep-picker-carrera="${escaparAttr(c)}">
            <span>${escaparHtml(c)}</span>
            ${c === estado.carreraSeleccionada ? '<span class="ep-picker-check">✓</span>' : ''}
          </button>
        `
        ).join('')}
      </div>
    `;
    cuerpo.querySelectorAll('[data-ep-picker-carrera]').forEach((btn) => {
      btn.addEventListener('click', () => {
        estado.carreraSeleccionada = btn.dataset.epPickerCarrera;
        cerrar();
        pintar();
      });
    });
  }

  function abrirPickerSemestre() {
    const { cuerpo, cerrar } = abrirHojaInferior({ initialChildSize: 0.5, maxChildSize: 0.85, minChildSize: 0.3 });
    cuerpo.innerHTML = `
      <div class="ep-picker-titulo">Selecciona tu semestre</div>
      <div class="ep-picker-lista">
        ${SEMESTRES.map(
          (s) => `
          <button class="ep-picker-item ${s === estado.semestreSeleccionada ? 'ep-picker-item--activo' : ''}" data-ep-picker-semestre="${s}">
            <span>${s}° Semestre</span>
            ${s === estado.semestreSeleccionada ? '<span class="ep-picker-check">✓</span>' : ''}
          </button>
        `
        ).join('')}
      </div>
    `;
    cuerpo.querySelectorAll('[data-ep-picker-semestre]').forEach((btn) => {
      btn.addEventListener('click', () => {
        estado.semestreSeleccionada = Number(btn.dataset.epPickerSemestre);
        cerrar();
        pintar();
      });
    });
  }

  // ── Detección de cambios sin guardar ──────────────────────────

  function valoresActuales() {
    return {
      nombre: root.querySelector('#ep-nombre')?.value.trim() ?? '',
      usuario: root.querySelector('#ep-usuario')?.value.trim() ?? '',
      presentacion: root.querySelector('#ep-presentacion')?.value.trim() ?? '',
      instagram: root.querySelector('#ep-instagram')?.value.trim() ?? '',
      facebook: root.querySelector('#ep-facebook')?.value.trim() ?? '',
      tiktok: root.querySelector('#ep-tiktok')?.value.trim() ?? '',
    };
  }

  function hayCambios() {
    const v = valoresActuales();
    return (
      v.nombre !== estado.nombreOriginal ||
      v.usuario !== estado.usuarioOriginal ||
      v.presentacion !== estado.presentacionOriginal ||
      v.instagram !== estado.igOriginal ||
      v.facebook !== estado.fbOriginal ||
      v.tiktok !== estado.ttOriginal ||
      estado.carreraSeleccionada !== estado.carreraOriginal ||
      estado.semestreSeleccionada !== estado.semestreOriginal ||
      estado.imagenLocal !== null ||
      estado.fotoEliminada
    );
  }

  function actualizarBotonGuardarHeader() {
    const btn = root.querySelector('#ep-guardar-header');
    if (btn) btn.style.display = hayCambios() ? '' : 'none';
  }

  async function onVolver() {
    if (!hayCambios()) {
      navegarA('/home');
      return;
    }
    const salir = await confirmarSalida();
    if (salir) navegarA('/home');
  }

  function confirmarSalida() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'ajustes-dialogo-overlay';
      overlay.innerHTML = `
        <div class="ajustes-dialogo">
          <p class="ajustes-dialogo__titulo">Cambios sin guardar</p>
          <p class="ajustes-dialogo__cuerpo">Tienes cambios sin guardar. ¿Deseas salir?</p>
          <div class="ajustes-dialogo__acciones">
            <button class="ajustes-dialogo__btn" data-ep-seguir>Seguir editando</button>
            <button class="ajustes-dialogo__btn ajustes-dialogo__btn--peligro" data-ep-salir>Salir sin guardar</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      const terminar = (valor) => { overlay.remove(); resolve(valor); };
      overlay.querySelector('[data-ep-seguir]').addEventListener('click', () => terminar(false));
      overlay.querySelector('[data-ep-salir]').addEventListener('click', () => terminar(true));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) terminar(false); });
    });
  }

  // ── Cerrar sesión ──────────────────────────────────────────

  async function cerrarSesion() {
    const confirmar = await confirmarCerrarSesion();
    if (!confirmar) return;
    try {
      await supabaseClient.auth.signOut();
      navegarA('/login');
    } catch (error) {
      mostrarToast(`Error al cerrar sesión: ${error.message}`, 'error');
    }
  }

  function confirmarCerrarSesion() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'ajustes-dialogo-overlay';
      overlay.innerHTML = `
        <div class="ajustes-dialogo">
          <p class="ajustes-dialogo__titulo">Cerrar sesión</p>
          <p class="ajustes-dialogo__cuerpo">¿Estás seguro que deseas cerrar tu sesión?</p>
          <div class="ajustes-dialogo__acciones">
            <button class="ajustes-dialogo__btn" data-ep-cancelar>Cancelar</button>
            <button class="ajustes-dialogo__btn ajustes-dialogo__btn--peligro" data-ep-confirmar>Cerrar sesión</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      const terminar = (valor) => { overlay.remove(); resolve(valor); };
      overlay.querySelector('[data-ep-cancelar]').addEventListener('click', () => terminar(false));
      overlay.querySelector('[data-ep-confirmar]').addEventListener('click', () => terminar(true));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) terminar(false); });
    });
  }

  // ── Guardar ────────────────────────────────────────────────

  function normalizarUrl(valor) {
    const v = (valor || '').trim();
    if (!v) return null;
    if (v.startsWith('http://') || v.startsWith('https://')) return v;
    return `https://${v}`;
  }

  function actualizarUiGuardando(guardando) {
    root.querySelectorAll('[data-ep-guardar]').forEach((btn) => {
      btn.disabled = guardando;
      btn.classList.toggle('ep-guardando', guardando);
    });
  }

  async function guardar() {
    if (estado.guardando) return;
    const v = valoresActuales();

    if (!v.nombre) {
      mostrarToast('El nombre no puede estar vacío', 'error');
      return;
    }
    if (!v.usuario) {
      mostrarToast('El nombre de usuario no puede estar vacío', 'error');
      return;
    }
    if (!REGEX_USUARIO.test(v.usuario)) {
      mostrarToast(
        'El usuario solo puede tener letras (sin acentos ni ñ), números, guion bajo y punto — sin espacios, y el punto no puede ir al inicio, al final ni repetirse. Entre 3 y 20 caracteres.',
        'error'
      );
      return;
    }
    if (!estado.carreraSeleccionada || !estado.semestreSeleccionada) {
      mostrarToast('Selecciona carrera y semestre', 'error');
      return;
    }

    estado.guardando = true;
    actualizarUiGuardando(true);

    try {
      // ── Verifica unicidad de @usuario solo si cambió ──
      if (v.usuario !== estado.usuarioOriginal) {
        const { data: existe } = await supabaseClient
          .from('perfiles')
          .select('id')
          .eq('nombre_usuario', v.usuario)
          .maybeSingle();
        if (existe) {
          mostrarToast('Ese nombre de usuario ya está en uso', 'error');
          return;
        }
      }

      // ── Sube la foto nueva a R2 (subirFotoPerfil ya comprime y
      // usa el path fijo <userId>/avatar.jpg, así que sobrescribe
      // automáticamente la anterior — ver storage-service.js) ──
      let cdnUrl = null;
      if (estado.imagenLocal) {
        cdnUrl = await storageService.subirFotoPerfil({ file: estado.imagenLocal, userId: uid });
      }

      // ── Si el usuario eliminó la foto SIN subir una nueva, hay
      // que borrar el archivo viejo de R2 explícitamente — es el
      // único caso en el que de verdad hace falta un borrado ──
      if (estado.fotoEliminada && !cdnUrl && estado.fotoOriginalUrl) {
        try {
          const path = estado.fotoOriginalUrl.split('?')[0].replace(`${R2_CONFIG.dominioPerfil}/`, '');
          await storageService.eliminarDeR2({ bucket: R2_CONFIG.bucketPerfil, path });
        } catch (error) {
          // No se relanza: si falla el borrado en R2 no debe impedir
          // que se guarde el resto del perfil.
          console.error('editar-perfil – borrar foto:', error);
        }
      }

      const updateData = {
        nombre: v.nombre,
        nombre_usuario: v.usuario,
        carrera: estado.carreraSeleccionada,
        semestre: estado.semestreSeleccionada,
        presentacion: v.presentacion,
        instagram_url: normalizarUrl(v.instagram),
        facebook_url: normalizarUrl(v.facebook),
        tiktok_url: normalizarUrl(v.tiktok),
      };
      if (cdnUrl) {
        updateData.cdn_foto_perfil = cdnUrl;
      } else if (estado.fotoEliminada) {
        updateData.cdn_foto_perfil = null;
      }

      const { error } = await supabaseClient.from('perfiles').update(updateData).eq('id', uid);
      if (error) throw error;

      // NOTA: el segundo argumento de mostrarToast asume un tipo
      // "exito" análogo al "error" ya visto en el resto del proyecto
      // (ver seguidores-sheet.js). Ajustar aquí si toast.js usa otro
      // nombre de tipo para el caso de éxito.
      mostrarToast('Perfil actualizado ✓', 'exito');
      navegarA('/home');
    } catch (error) {
      console.error('editar-perfil – guardar:', error);
      mostrarToast(`Error al guardar: ${error?.message ?? error}`, 'error');
    } finally {
      estado.guardando = false;
      actualizarUiGuardando(false);
    }
  }
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

function escaparAttr(s) {
  return escaparHtml(s).replaceAll('"', '&quot;');
}

// El router (core/router.js) solo usa el PRIMER segmento del hash
// como ruta — todo lo que sigue se pasa como parámetro posicional a
// la función de render (ver resolverRuta() en router.js, y el mismo
// patrón que ya usa plantel.js con '#/plantel/conoce' vs
// '#/plantel/historia': una sola ruta base, el sub-comportamiento
// se decide adentro según el parámetro).
//
// Por eso NO se puede registrar '/perfil/editar' como si fuera una
// ruta completa — el router compara solo contra '/perfil' y nunca
// la encuentra, cayendo siempre al fallback ('/login'). Se registra
// bajo '/perfil' y se revisa el primer parámetro ('editar') para
// decidir qué pintar. Esto de paso deja el camino libre para que,
// más adelante, '/perfil/<id>' abra PerfilPublico.js bajo esta
// misma ruta base.
registrarRuta('/perfil', (contenedor, sub) => {
  if (sub === 'editar') render(contenedor);
});
