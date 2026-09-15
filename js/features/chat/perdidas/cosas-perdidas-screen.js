// ═════════════════════════════════════════════════════════════════
// cosas-perdidas-screen.js
// Ubicación: js/features/chat/perdidas/cosas-perdidas-screen.js
//
// Réplica web de Cosas perdidas/cosas_perdidas_screen.dart. Permite
// publicar y consultar reportes de objetos perdidos en el campus,
// con foto opcional, descripción y lugar. Cada reporte expira a los
// 7 días (columna `expira_en`, calculada por Postgres — no hay
// distinción de "perdido"/"encontrado": el propio autor elimina su
// reporte cuando ya no lo necesita.
//
// Tabla: objetos_perdidos (ver el SQL sugerido en el .dart original;
// no se repite aquí porque el esquema ya existe en Supabase).
//
// DIFERENCIAS DE PLATAFORMA respecto al Dart original:
//   1. Subida a R2 vía storage-service.js (subirImagenCosaPerdida),
//      no un mini-cliente propio — ver comentario en ese archivo.
//   2. Sin image_picker: se usan dos <input type="file"> ocultos,
//      uno con capture="environment" (cámara en móvil) y otro sin
//      capture (galería/explorador de archivos).
//   3. El botón "Contactar" abre conversacion-screen.js, que TODAVÍA
//      NO EXISTE — la llamada está envuelta en try/catch con un
//      toast de "en construcción" como fallback, así que no rompe
//      nada ahora y debería funcionar solo (o necesitar un ajuste
//      menor de firma) en cuanto se construya esa pantalla.
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../../core/supabase-client.js';
import { storageService } from '../../../core/storage-service.js';
import { R2_CONFIG } from '../../../core/r2-config.js';
import { mostrarToast } from '../../../core/toast.js';

const ACCENT = '#007AFF';
const TABLA = 'objetos_perdidos';

export async function render(contenedor) {
  let items = [];
  let cargando = true;
  let error = null;
  let fab = null;

  contenedor.innerHTML = `<div class="cp-screen" id="cp-screen"></div>`;
  const zona = contenedor.querySelector('#cp-screen');

  async function cargar() {
    cargando = true;
    error = null;
    pintar();
    try {
      const { data, error: err } = await supabaseClient
        .from(TABLA)
        .select('*, perfiles(nombre, cdn_foto_perfil, nombre_usuario)')
        .gt('expira_en', new Date().toISOString())
        .order('creado_en', { ascending: false })
        .limit(60);
      if (err) throw err;
      items = (data || []).map(objetoDesdeFila);
      cargando = false;
    } catch (e) {
      console.error('cosas-perdidas-screen – cargar:', e);
      cargando = false;
      error = e;
    }
    pintar();
    actualizarFab();
  }

  function pintar() {
    if (cargando) {
      zona.innerHTML = `<div class="cp-cargando"><span class="chats-spinner"></span></div>`;
      return;
    }
    if (error) {
      zona.innerHTML = plantillaError();
      zona.querySelector('#cp-reintentar')?.addEventListener('click', cargar);
      return;
    }
    if (items.length === 0) {
      zona.innerHTML = plantillaEmpty();
      zona.querySelector('#cp-empty-reportar')?.addEventListener('click', abrirFormulario);
      return;
    }
    zona.innerHTML = `<div class="cp-lista" id="cp-lista"></div>`;
    const lista = zona.querySelector('#cp-lista');
    supabaseClient.auth.getUser().then(({ data }) => {
      const miId = data?.user?.id;
      items.forEach((obj) => {
        lista.appendChild(
          crearObjetoCard(obj, {
            esMio: obj.autorId === miId,
            onEliminar: obj.autorId === miId ? () => eliminarReporte(obj) : null,
          })
        );
      });
    });
  }

  async function eliminarReporte(obj) {
    const confirmado = await confirmarEliminar();
    if (!confirmado) return;

    if (obj.r2Path) {
      try {
        await storageService.eliminarDeR2({ bucket: R2_CONFIG.bucketCosasPerdidas, path: obj.r2Path });
      } catch (e) {
        console.error('cosas-perdidas-screen – eliminarDeR2:', e);
        /* no bloquea el borrado del registro */
      }
    }

    try {
      const { error: err } = await supabaseClient.from(TABLA).delete().eq('id', obj.id);
      if (err) throw err;
      await cargar();
    } catch (e) {
      console.error('cosas-perdidas-screen – eliminar registro:', e);
      mostrarToast('No se pudo eliminar el reporte.', 'error');
    }
  }

  function abrirFormulario() {
    mostrarFormularioReporte(() => cargar());
  }

  // ── FAB ────────────────────────────────────────────────────────
  // Mismo patrón que maestros-screen.js: se inyecta en la zona
  // reservada por jaguar-chat-principal.js y se muestra/oculta
  // observando la clase 'visible' del propio panel.
  const fabZona = document.getElementById('jchat-fab-zona');
  if (fabZona) {
    fab = document.createElement('button');
    fab.className = 'cp-fab';
    fab.innerHTML = `<span>＋</span> Reportar`;
    fab.style.display = 'none';
    fab.addEventListener('click', abrirFormulario);
    fabZona.appendChild(fab);

    new MutationObserver(actualizarFab).observe(contenedor, { attributes: true, attributeFilter: ['class'] });
  }

  function actualizarFab() {
    if (!fab) return;
    fab.style.display = contenedor.classList.contains('visible') && !cargando && !error ? 'flex' : 'none';
  }

  await cargar();
}

// ── Modelo (fila de Supabase → objeto plano) ───────────────────

function objetoDesdeFila(fila) {
  const perfil = fila.perfiles || {};
  return {
    id: fila.id,
    autorId: fila.autor_id,
    descripcion: fila.descripcion,
    lugar: fila.lugar ?? null,
    imagenUrl: fila.imagen_url ?? null,
    r2Path: fila.r2_path ?? null,
    creadoEn: fila.creado_en,
    expiraEn: fila.expira_en,
    autorNombre: perfil.nombre ?? 'Estudiante',
    autorAvatar: perfil.cdn_foto_perfil ?? null,
    autorNombreUsuario: perfil.nombre_usuario ?? null,
  };
}

// ── Tarjeta de reporte ───────────────────────────────────────────

function crearObjetoCard(obj, { esMio, onEliminar }) {
  const el = document.createElement('div');
  el.className = 'cp-card';

  const tieneImagen = obj.imagenUrl;

  el.innerHTML = `
    ${
      tieneImagen
        ? `<div class="cp-card__imagen"><img src="${obj.imagenUrl}" alt="" loading="lazy" /></div>`
        : ''
    }
    <div class="cp-card__cuerpo">
      <div class="cp-card__meta">
        <span class="cp-card__tiempo">${escapar(relativo(obj.creadoEn))}</span>
        <span class="cp-card__expira">⏱ ${escapar(expiracion(obj.expiraEn))}</span>
      </div>
      <p class="cp-card__desc">${escapar(obj.descripcion)}</p>
      ${obj.lugar ? `<p class="cp-card__lugar">📍 ${escapar(obj.lugar)}</p>` : ''}
      <div class="cp-card__footer">
        <span class="cp-card__avatar">${
          obj.autorAvatar
            ? `<img src="${obj.autorAvatar}" alt="" />`
            : (obj.autorNombre || '?').trim().charAt(0).toUpperCase()
        }</span>
        <div class="cp-card__autor">
          <p class="cp-card__autor-nombre">${escapar(obj.autorNombre)}</p>
          ${obj.autorNombreUsuario ? `<p class="cp-card__autor-usuario">@${escapar(obj.autorNombreUsuario)}</p>` : ''}
        </div>
        <div class="cp-card__accion" id="cp-accion"></div>
      </div>
    </div>
  `;

  const zonaAccion = el.querySelector('#cp-accion');
  if (esMio && onEliminar) {
    const btn = document.createElement('button');
    btn.className = 'cp-btn-eliminar';
    btn.innerHTML = `🗑️ Eliminar`;
    btn.addEventListener('click', onEliminar);
    zonaAccion.appendChild(btn);
  } else if (!esMio) {
    const btn = document.createElement('button');
    btn.className = 'cp-btn-contactar';
    btn.innerHTML = `💬 Contactar`;
    btn.addEventListener('click', () => contactarAutor(obj));
    zonaAccion.appendChild(btn);
  }

  return el;
}

async function contactarAutor(obj) {
  // conversacion-screen.js sale con window.history.back() — asume
  // que quien la abre ya empujó un estado de historial antes de
  // montarla, para que ese back() la deshaga de forma natural en vez
  // de salirse de la ruta actual de la app. Se empuja ese estado
  // aquí y se limpia el overlay al volver (popstate).
  try {
    const mod = await import('../chats/conversacion/conversacion-screen.js');

    const overlay = document.createElement('div');
    overlay.className = 'cp-conversacion-overlay';
    document.body.appendChild(overlay);

    history.pushState({ cpConversacionAbierta: true }, '');
    const alVolver = () => {
      overlay.remove();
      window.removeEventListener('popstate', alVolver);
    };
    window.addEventListener('popstate', alVolver);

    await mod.render(overlay, {
      otroUsuarioId: obj.autorId,
      otroNombre: obj.autorNombre,
      otroNombreUsuario: obj.autorNombreUsuario,
      otroAvatarUrl: obj.autorAvatar,
      contextoObjeto: {
        id: obj.id,
        descripcion: obj.descripcion,
        imagenUrl: obj.imagenUrl,
        lugar: obj.lugar,
      },
    });
  } catch (e) {
    console.warn('cosas-perdidas-screen – conversacion-screen.js aún no disponible:', e);
    mostrarToast('El chat directo está en construcción.', 'error');
  }
}

// ── Tiempo relativo / expiración (misma lógica que el Dart) ─────

function relativo(fechaIso) {
  const diffMs = Date.now() - new Date(fechaIso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Justo ahora';
  if (min < 60) return `Hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `Hace ${dias} d`;
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(fechaIso));
}

function expiracion(expiraIso) {
  const dias = Math.floor((new Date(expiraIso).getTime() - Date.now()) / 86400000);
  if (dias <= 0) return 'Expira hoy';
  if (dias === 1) return 'Expira mañana';
  return `Expira en ${dias} días`;
}

// ── Estados de la lista ──────────────────────────────────────────

function plantillaEmpty() {
  return `
    <div class="cp-empty">
      <div class="cp-empty__icono">🔎</div>
      <p class="cp-empty__titulo">Nada por aquí</p>
      <p class="cp-empty__desc">¿Perdiste algo en el campus?<br />Publícalo aquí para que alguien te ayude.</p>
      <button class="cp-empty__boton" id="cp-empty-reportar">＋ Reportar objeto</button>
    </div>
  `;
}

function plantillaError() {
  return `
    <div class="cp-error">
      <div class="cp-error__icono">📡</div>
      <p class="cp-error__texto">No se pudieron cargar los reportes.</p>
      <button class="cp-error__boton" id="cp-reintentar">Reintentar</button>
    </div>
  `;
}

// ── Confirmación de eliminar (reemplaza el AlertDialog de Dart) ──

function confirmarEliminar() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'cp-confirm-overlay';
    overlay.innerHTML = `
      <div class="cp-confirm">
        <p class="cp-confirm__titulo">¿Eliminar reporte?</p>
        <p class="cp-confirm__texto">El reporte y la imagen se eliminarán permanentemente.</p>
        <div class="cp-confirm__botones">
          <button class="cp-confirm__cancelar" id="cp-confirm-cancelar">Cancelar</button>
          <button class="cp-confirm__eliminar" id="cp-confirm-eliminar">Eliminar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const cerrar = (resultado) => {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 150);
      resolve(resultado);
    };

    overlay.querySelector('#cp-confirm-cancelar').addEventListener('click', () => cerrar(false));
    overlay.querySelector('#cp-confirm-eliminar').addEventListener('click', () => cerrar(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cerrar(false);
    });
  });
}

// ── Formulario "Reportar objeto perdido" ─────────────────────────

function mostrarFormularioReporte(onPublicado) {
  let archivoImagen = null;
  let urlPreview = null;

  const overlay = document.createElement('div');
  overlay.className = 'cp-sheet-overlay';
  overlay.innerHTML = `
    <div class="cp-sheet">
      <div class="cp-sheet__manija"></div>
      <div class="cp-sheet__scroll">
        <p class="cp-sheet__titulo">Reportar objeto perdido</p>
        <p class="cp-sheet__subtitulo">El reporte expira automáticamente en 7 días.</p>

        <div class="cp-imagen-selector" id="cp-imagen-selector">
          <span class="cp-imagen-selector__icono">📷</span>
          <span class="cp-imagen-selector__texto">Agregar foto del objeto</span>
          <span class="cp-imagen-selector__subtexto">Se comprimirá antes de subir</span>
        </div>
        <input type="file" accept="image/*" capture="environment" id="cp-input-camara" hidden />
        <input type="file" accept="image/*" id="cp-input-galeria" hidden />

        <textarea class="cp-textarea" id="cp-descripcion" rows="4" maxlength="300" placeholder="¿Qué se perdió? Descríbelo con detalle..."></textarea>
        <input class="cp-input" id="cp-lugar" placeholder="Lugar donde se perdió (ej. Sala H-12…)" />

        <p class="cp-error" id="cp-form-error" style="display:none"></p>

        <button class="cp-boton-grande" id="cp-publicar">Publicar reporte</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const cerrar = () => {
    overlay.classList.remove('visible');
    if (urlPreview) URL.revokeObjectURL(urlPreview);
    setTimeout(() => overlay.remove(), 200);
  };
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrar();
  });

  const selectorImagen = overlay.querySelector('#cp-imagen-selector');
  const inputCamara = overlay.querySelector('#cp-input-camara');
  const inputGaleria = overlay.querySelector('#cp-input-galeria');

  selectorImagen.addEventListener('click', () => mostrarOpcionesImagen());

  function mostrarOpcionesImagen() {
    if (archivoImagen) {
      // Ya hay una imagen elegida: el click quita la imagen actual.
      quitarImagen();
      return;
    }
    // Sin image_picker no hay un selector nativo cámara/galería en
    // un solo control — se ofrece elegir con un pequeño menú propio.
    const menu = document.createElement('div');
    menu.className = 'cp-sheet-overlay';
    menu.innerHTML = `
      <div class="cp-sheet cp-sheet--menu">
        <div class="cp-sheet__manija"></div>
        <button class="cp-opcion-imagen" id="cp-opt-camara">📷 Tomar foto</button>
        <button class="cp-opcion-imagen" id="cp-opt-galeria">🖼️ Elegir de galería</button>
      </div>
    `;
    document.body.appendChild(menu);
    requestAnimationFrame(() => menu.classList.add('visible'));
    const cerrarMenu = () => {
      menu.classList.remove('visible');
      setTimeout(() => menu.remove(), 150);
    };
    menu.addEventListener('click', (e) => {
      if (e.target === menu) cerrarMenu();
    });
    menu.querySelector('#cp-opt-camara').addEventListener('click', () => {
      cerrarMenu();
      inputCamara.click();
    });
    menu.querySelector('#cp-opt-galeria').addEventListener('click', () => {
      cerrarMenu();
      inputGaleria.click();
    });
  }

  function alElegirArchivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    archivoImagen = file;
    if (urlPreview) URL.revokeObjectURL(urlPreview);
    urlPreview = URL.createObjectURL(file);
    pintarPreview();
  }
  inputCamara.addEventListener('change', alElegirArchivo);
  inputGaleria.addEventListener('change', alElegirArchivo);

  function pintarPreview() {
    selectorImagen.innerHTML = `
      <img src="${urlPreview}" alt="" class="cp-imagen-preview" />
      <span class="cp-imagen-preview__quitar">✕</span>
    `;
    selectorImagen.classList.add('con-imagen');
  }

  function quitarImagen() {
    archivoImagen = null;
    if (urlPreview) URL.revokeObjectURL(urlPreview);
    urlPreview = null;
    selectorImagen.classList.remove('con-imagen');
    selectorImagen.innerHTML = `
      <span class="cp-imagen-selector__icono">📷</span>
      <span class="cp-imagen-selector__texto">Agregar foto del objeto</span>
      <span class="cp-imagen-selector__subtexto">Se comprimirá antes de subir</span>
    `;
  }

  const btnPublicar = overlay.querySelector('#cp-publicar');
  const errorEl = overlay.querySelector('#cp-form-error');

  btnPublicar.addEventListener('click', async () => {
    const descripcion = overlay.querySelector('#cp-descripcion').value.trim();
    if (!descripcion) {
      errorEl.textContent = 'Escribe una descripción del objeto.';
      errorEl.style.display = '';
      return;
    }
    errorEl.style.display = 'none';

    const lugar = overlay.querySelector('#cp-lugar').value.trim() || null;

    btnPublicar.disabled = true;
    btnPublicar.innerHTML = `<span class="cp-spinner-boton"></span>`;

    try {
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      const uid = user?.id;
      if (!uid) throw new Error('No hay sesión activa.');

      let imagenUrl = null;
      let r2Path = null;
      if (archivoImagen) {
        const subida = await storageService.subirImagenCosaPerdida({ file: archivoImagen, userId: uid });
        imagenUrl = subida.url;
        r2Path = subida.path;
      }

      const { error: err } = await supabaseClient.from(TABLA).insert({
        autor_id: uid,
        descripcion,
        lugar,
        imagen_url: imagenUrl,
        r2_path: r2Path,
      });
      if (err) throw err;

      cerrar();
      onPublicado();
    } catch (e) {
      console.error('cosas-perdidas-screen – publicar:', e);
      errorEl.textContent = 'No se pudo publicar. Intenta de nuevo.';
      errorEl.style.display = '';
      btnPublicar.disabled = false;
      btnPublicar.textContent = 'Publicar reporte';
    }
  });
}

// ── Vista de detalle (llegando desde la burbuja de contexto de un chat) ──
// Exportada para que conversacion-screen.js pueda abrirla cuando el
// usuario toca la burbuja de "objeto perdido" citada en un mensaje.

export async function renderDetalle(contenedor, objetoId) {
  contenedor.innerHTML = `<div class="cp-detalle" id="cp-detalle"><span class="chats-spinner"></span></div>`;
  const zona = contenedor.querySelector('#cp-detalle');

  try {
    const { data, error: err } = await supabaseClient
      .from(TABLA)
      .select('*, perfiles(nombre, cdn_foto_perfil, nombre_usuario)')
      .eq('id', objetoId)
      .maybeSingle();
    if (err) throw err;

    if (!data) {
      zona.innerHTML = `
        <div class="cp-detalle__no-disponible">
          <span>⏱️</span>
          <p>Este reporte ya no está disponible</p>
        </div>
      `;
      return;
    }

    const obj = objetoDesdeFila(data);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    zona.innerHTML = '';
    zona.appendChild(crearObjetoCard(obj, { esMio: obj.autorId === user?.id, onEliminar: null }));
  } catch (e) {
    console.error('cosas-perdidas-screen – renderDetalle:', e);
    zona.innerHTML = `<div class="cp-detalle__no-disponible"><span>⏱️</span><p>Este reporte ya no está disponible</p></div>`;
  }
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}