// Pantalla de creación de publicaciones (wizard de 3 pasos), ruta
// '/crear-publicacion'. Puerto de crear_publicacion.dart +
// crear_publicacion_logica.dart + crear_publicacion_modelos.dart +
// crear_publicacion_widgets.dart — consolidados en un solo archivo
// porque el split en 4 archivos de Dart existía para poder usar
// `part`/mixins; en JS, sin esa restricción de lenguaje, este
// proyecto ya viene manteniendo un archivo por pantalla (ver
// pantalla-principal.js, notificaciones.js). Avisar si se prefiere
// dividirlo igual en 4 archivos por trazabilidad 1:1 con el Dart.
//
// PASO-FLOW (igual que el Dart): 0 = seleccionar archivos,
// 1 = etiquetar personas, 2 = redactar texto + publicar.
//
// DIFERENCIA DE PLATAFORMA — Paso 0 (marcada explícitamente):
// el Dart original tiene un grid propio de la galería del
// dispositivo (photo_manager: paginación, scrubber lateral,
// agrupación por fecha, permisos, celda de cámara). Un navegador NO
// expone esa API — una página web no puede "listar" la galería del
// usuario, solo puede abrir el selector nativo del sistema
// operativo vía <input type="file">. Por eso el paso 0 aquí es
// mucho más simple: dos acciones ("Elegir de galería" con selección
// múltiple nativa, y "Cámara" con captura de foto/video) en vez del
// grid completo — no hay equivalente web posible para el resto
// (scrubber, paginación infinita, banner de acceso limitado).
//
// DEPENDENCIA PENDIENTE: el Dart usa buscarPerfilesMencion() de
// mencion_autocomplete.dart (aún no compartido/portado) para el
// buscador del paso 1. Mientras tanto, buscarPersonasEtiquetar() de
// aquí abajo hace la misma búsqueda de forma local — reemplazar por
// la función compartida en cuanto se porte mencion-autocomplete.js,
// para no mantener dos implementaciones de la misma búsqueda (esa
// también alimenta las @menciones en comentarios).

import { supabaseClient } from '../../../../core/supabase-client.js';
import { registrarRuta } from '../../../../core/router.js';
import { mostrarToast } from '../../../../core/toast.js';
import { resolverUrlPerfil } from '../../../../core/perfil-utils.js';
import { storageService } from '../../../../core/storage-service.js';

registrarRuta('/crear-publicacion', render);

const MAX_ETIQUETADOS = 10;
const MAX_SUGERIDOS = 10;
const MAX_MEDIA = 5; // 4 imágenes + 1 video máximo

// Estado del módulo. Se reinicia en cada render().
let uidActual = null;
let contenedorActual = null;
let paso = 0;
let media = []; // { file: File, tipo: 'imagen'|'video', previewUrl: string }
let etiquetados = [];
let publicando = false;
let estadoPublicacion = '';
let progresoPct = null;
let nombreUsuario = null;
let fotoPerfilUrl = null;
let usuariosSugeridos = [];
let cargandoSugeridos = false;
let resultadosEtiquetar = [];
let buscandoEtiquetar = false;
let listenerSalida = null;

async function render(contenedor) {
  contenedorActual = contenedor;
  uidActual = null;
  paso = 0;
  limpiarObjectUrls();
  media = [];
  etiquetados = [];
  publicando = false;
  estadoPublicacion = '';
  progresoPct = null;
  nombreUsuario = null;
  fotoPerfilUrl = null;
  usuariosSugeridos = [];
  cargandoSugeridos = false;
  resultadosEtiquetar = [];
  buscandoEtiquetar = false;

  contenedor.innerHTML = plantillaBase();
  activarInteracciones(contenedor);
  renderHeader(contenedor);
  registrarLimpiezaAlSalir();

  const { data } = await supabaseClient.auth.getUser();
  uidActual = data?.user?.id ?? null;
  if (!uidActual) return;

  cargarPerfil();
  cargarUsuariosSugeridos();
}

function plantillaBase() {
  return `
    <div class="cp">
      <header class="cp-header">
        <button class="cp-header__btn" id="cp-atras" aria-label="Regresar">✕</button>
        <h1 id="cp-titulo">Nueva publicación</h1>
        <div class="cp-header__accion" id="cp-accion"></div>
      </header>

      <div class="cp-paso activo" data-paso="0">
        <div class="cp-seleccion">
          <button class="cp-seleccion__opcion" id="cp-abrir-galeria">
            <span class="cp-seleccion__icono">🖼️</span>
            <span>Elegir de galería</span>
          </button>
          <button class="cp-seleccion__opcion" id="cp-abrir-camara">
            <span class="cp-seleccion__icono">📷</span>
            <span>Cámara</span>
          </button>
        </div>
        <input type="file" id="cp-input-galeria" accept="image/*,video/*" multiple hidden />
        <input type="file" id="cp-input-foto" accept="image/*" capture="environment" hidden />
        <input type="file" id="cp-input-video" accept="video/*" capture="environment" hidden />
      </div>

      <div class="cp-paso" data-paso="1">
        <div class="cp-etiquetar">
          <div class="cp-etiquetar__buscador">
            <span>🔍</span>
            <input type="text" id="cp-etiquetar-input" placeholder="Buscar por nombre, usuario o carrera..." autocomplete="off" />
          </div>
          <div class="cp-etiquetar__chips" id="cp-etiquetar-chips"></div>
          <div class="cp-etiquetar__lista" id="cp-etiquetar-lista"></div>
        </div>
      </div>

      <div class="cp-paso" data-paso="2">
        <div class="cp-publicar">
          <div class="cp-composer">
            <div class="cp-composer__avatar" id="cp-avatar"><span>👤</span></div>
            <div class="cp-composer__col">
              <p class="cp-composer__nombre" id="cp-nombre-usuario">Tú</p>
              <textarea id="cp-texto" maxlength="500" placeholder="¿Qué está pasando en el plantel?"></textarea>
            </div>
          </div>
          <div class="cp-etiquetas-resumen" id="cp-etiquetas-resumen"></div>
          <div class="cp-media-preview" id="cp-media-preview"></div>
        </div>
        <div class="cp-progreso" id="cp-progreso" hidden></div>
      </div>

      <div class="cp-barra-seleccion" id="cp-barra-seleccion"></div>
    </div>
  `;
}

function registrarLimpiezaAlSalir() {
  if (listenerSalida) window.removeEventListener('hashchange', listenerSalida);
  listenerSalida = () => {
    if (!location.hash.startsWith('#/crear-publicacion')) {
      limpiarObjectUrls();
      window.removeEventListener('hashchange', listenerSalida);
      listenerSalida = null;
    }
  };
  window.addEventListener('hashchange', listenerSalida);
}

function limpiarObjectUrls() {
  media.forEach((m) => { if (m.previewUrl) URL.revokeObjectURL(m.previewUrl); });
}

// ═══════════════════════════════════════════════════════════════
// NAVEGACIÓN ENTRE PASOS
// ═══════════════════════════════════════════════════════════════

function irPaso(p, contenedor) {
  paso = Math.max(0, Math.min(2, p));
  contenedor.querySelectorAll('.cp-paso').forEach((el) => {
    el.classList.toggle('activo', Number(el.dataset.paso) === paso);
  });
  contenedor.querySelector('#cp-barra-seleccion').hidden = paso !== 0;
  renderHeader(contenedor);
  if (paso === 1) renderEtiquetarLista(contenedor);
  if (paso === 2) { renderEtiquetasResumen(contenedor); renderMediaPreview(contenedor); }
}

function renderHeader(contenedor) {
  contenedor.querySelector('#cp-titulo').textContent = paso === 1 ? 'Etiquetar personas' : 'Nueva publicación';

  const btnAtras = contenedor.querySelector('#cp-atras');
  btnAtras.textContent = paso === 0 ? '✕' : '‹';
  btnAtras.disabled = publicando;

  const accion = contenedor.querySelector('#cp-accion');
  if (paso === 0) {
    accion.innerHTML = '';
  } else if (paso === 1) {
    accion.innerHTML = `<button class="cp-header__link" id="cp-btn-siguiente-1">${etiquetados.length === 0 ? 'Omitir' : 'Siguiente'}</button>`;
    accion.querySelector('#cp-btn-siguiente-1').addEventListener('click', () => irPaso(2, contenedor));
  } else {
    accion.innerHTML = publicando
      ? '<span class="btn-spinner" style="width:16px;height:16px;border-width:2px;"></span>'
      : '<button class="cp-header__publicar" id="cp-btn-publicar">Publicar</button>';
    if (!publicando) accion.querySelector('#cp-btn-publicar').addEventListener('click', () => publicar(contenedor));
  }
}

// ═══════════════════════════════════════════════════════════════
// PASO 0 — SELECCIÓN DE ARCHIVOS
// ═══════════════════════════════════════════════════════════════

function manejarArchivosSeleccionados(fileList, contenedor) {
  Array.from(fileList).forEach((file) => agregarArchivo(file, contenedor));
}

function agregarArchivo(file, contenedor) {
  const tipo = file.type.startsWith('video/') ? 'video' : 'imagen';
  const videosActuales = media.filter((m) => m.tipo === 'video').length;
  const imagenesActuales = media.filter((m) => m.tipo === 'imagen').length;

  if (tipo === 'video' && videosActuales >= 1) {
    mostrarToast('Solo puedes agregar 1 video por publicación', 'error');
    return;
  }
  if (tipo === 'imagen' && imagenesActuales >= 4) {
    mostrarToast('Máximo 4 imágenes por publicación', 'error');
    return;
  }
  if (media.length >= MAX_MEDIA) {
    mostrarToast('Máximo 4 imágenes y 1 video por publicación', 'error');
    return;
  }

  media.push({ file, tipo, previewUrl: URL.createObjectURL(file) });
  renderBarraSeleccion(contenedor);
  if (paso === 2) renderMediaPreview(contenedor);
}

function quitarMedia(i, contenedor) {
  const [item] = media.splice(i, 1);
  if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
  renderBarraSeleccion(contenedor);
  if (paso === 2) renderMediaPreview(contenedor);
}

function renderBarraSeleccion(contenedor) {
  const barra = contenedor.querySelector('#cp-barra-seleccion');
  if (paso !== 0) { barra.hidden = true; return; }
  barra.hidden = false;

  if (media.length === 0) {
    barra.innerHTML = `
      <p class="cp-barra-seleccion__guia">Puedes continuar sin fotos ni videos</p>
      <button class="cp-barra-seleccion__siguiente" id="cp-btn-siguiente-0">Siguiente</button>
    `;
  } else {
    barra.innerHTML = `
      <div class="cp-barra-seleccion__miniaturas" id="cp-miniaturas-barra">
        ${media.map((item, i) => plantillaMiniatura(item, i, 52)).join('')}
      </div>
      <button class="cp-barra-seleccion__siguiente" id="cp-btn-siguiente-0">Siguiente</button>
    `;
  }
  barra.querySelector('#cp-btn-siguiente-0').addEventListener('click', () => irPaso(1, contenedor));
  barra.querySelectorAll('[data-quitar]').forEach((btn) => {
    btn.addEventListener('click', (evento) => {
      evento.stopPropagation();
      quitarMedia(Number(btn.dataset.quitar), contenedor);
    });
  });
}

function plantillaMiniatura(item, i, size) {
  return `
    <div class="cp-miniatura" style="width:${size}px;height:${size}px;">
      ${
        item.tipo === 'video'
          ? `<div class="cp-miniatura__video">▶️</div>`
          : `<img src="${item.previewUrl}" alt="" />`
      }
      <span class="cp-miniatura__orden">${i + 1}</span>
      <button class="cp-miniatura__quitar" data-quitar="${i}" aria-label="Quitar">✕</button>
    </div>
  `;
}

function renderMediaPreview(contenedor) {
  const zona = contenedor.querySelector('#cp-media-preview');
  if (media.length === 0) { zona.innerHTML = ''; return; }
  zona.innerHTML = `<div class="cp-media-preview__fila">${media.map((item, i) => plantillaMiniatura(item, i, 100)).join('')}</div>`;
  zona.querySelectorAll('[data-quitar]').forEach((btn) => {
    btn.addEventListener('click', (evento) => {
      evento.stopPropagation();
      quitarMedia(Number(btn.dataset.quitar), contenedor);
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// PASO 1 — ETIQUETAR PERSONAS
// ═══════════════════════════════════════════════════════════════

async function cargarUsuariosSugeridos() {
  if (!uidActual) return;
  cargandoSugeridos = true;
  if (paso === 1) renderEtiquetarLista(contenedorActual);

  try {
    const { data: previas } = await supabaseClient
      .from('publicacion_etiquetas')
      .select('usuario_id')
      .eq('etiquetado_por', uidActual)
      .limit(50);

    const vistos = new Set([uidActual]);
    const idsFrecuentes = [];
    (previas ?? []).forEach((fila) => {
      if (fila.usuario_id && !vistos.has(fila.usuario_id)) {
        vistos.add(fila.usuario_id);
        idsFrecuentes.push(fila.usuario_id);
      }
    });

    // NOTA: 'foto_perfil' no existe como columna en la tabla
    // perfiles de este proyecto (migrado a R2, solo cdn_foto_perfil
    // vive ahí) — pedirla en el select rompe el query completo con
    // error 42703 y devuelve data=null en silencio si no se revisa
    // el error. resolverUrlPerfil() ya contempla el caso sin ese
    // campo (cae a Supabase Storage o cadena vacía).
    const camposPerfil = 'id, nombre, nombre_usuario, cdn_foto_perfil, carrera';
    let sugeridos = [];

    if (idsFrecuentes.length > 0) {
      const { data } = await supabaseClient
        .from('perfiles')
        .select(camposPerfil)
        .in('id', idsFrecuentes.slice(0, MAX_SUGERIDOS));
      sugeridos = data ?? [];
    }

    if (sugeridos.length < MAX_SUGERIDOS) {
      const faltan = MAX_SUGERIDOS - sugeridos.length;
      const excluidos = new Set([...vistos, ...sugeridos.map((u) => u.id)]);
      const { data: candidatos } = await supabaseClient
        .from('perfiles')
        .select(camposPerfil)
        .limit(faltan + excluidos.size + 20);

      const aleatorios = (candidatos ?? [])
        .filter((u) => !excluidos.has(u.id))
        .sort(() => Math.random() - 0.5);
      sugeridos = [...sugeridos, ...aleatorios.slice(0, faltan)];
    }

    usuariosSugeridos = sugeridos;
  } catch (error) {
    console.error('crear-publicacion – sugeridos:', error);
  } finally {
    cargandoSugeridos = false;
    if (paso === 1) renderEtiquetarLista(contenedorActual);
  }
}

// Búsqueda provisional — ver nota "DEPENDENCIA PENDIENTE" al inicio
// del archivo (mencion_autocomplete.dart aún no portado).
async function buscarPersonasEtiquetar(texto) {
  try {
    const { data, error } = await supabaseClient
      .from('perfiles')
      .select('id, nombre, nombre_usuario, cdn_foto_perfil, carrera')
      .neq('id', uidActual)
      .or(`nombre.ilike.%${texto}%,nombre_usuario.ilike.%${texto}%,carrera.ilike.%${texto}%`)
      .limit(20);
    if (error) throw error;
    return data ?? [];
  } catch (error) {
    console.error('crear-publicacion – buscar personas:', error);
    return [];
  }
}

function yaSeleccionado(id) {
  return etiquetados.some((u) => u.id === id);
}

function toggleSeleccionEtiquetado(perfil, contenedor) {
  if (yaSeleccionado(perfil.id)) {
    etiquetados = etiquetados.filter((u) => u.id !== perfil.id);
  } else {
    if (etiquetados.length >= MAX_ETIQUETADOS) {
      mostrarToast(`Máximo ${MAX_ETIQUETADOS} personas etiquetadas`, 'error');
      return;
    }
    etiquetados = [...etiquetados, perfil];
  }
  renderHeader(contenedor);
  renderEtiquetarLista(contenedor);
}

function quitarEtiquetado(usuarioId, contenedor) {
  etiquetados = etiquetados.filter((u) => u.id !== usuarioId);
  renderHeader(contenedor);
  renderEtiquetasResumen(contenedor);
}

async function buscarEtiquetar(contenedor, texto) {
  if (!texto) {
    resultadosEtiquetar = [];
    renderEtiquetarLista(contenedor);
    return;
  }
  buscandoEtiquetar = true;
  renderEtiquetarLista(contenedor);
  resultadosEtiquetar = (await buscarPersonasEtiquetar(texto)).filter((p) => p.id !== uidActual);
  buscandoEtiquetar = false;
  renderEtiquetarLista(contenedor);
}

function renderEtiquetarLista(contenedor) {
  const input = contenedor.querySelector('#cp-etiquetar-input');
  const vacio = !input.value.trim();
  const zona = contenedor.querySelector('#cp-etiquetar-lista');

  if (vacio) {
    if (cargandoSugeridos) {
      zona.innerHTML = `<div class="cp-etiquetar__spinner"><span class="btn-spinner"></span></div>`;
    } else if (usuariosSugeridos.length === 0) {
      zona.innerHTML = `<p class="cp-etiquetar__vacio">Escribe un nombre, usuario o carrera</p>`;
    } else {
      zona.innerHTML =
        `<p class="cp-etiquetar__titulo">Sugerencias</p>` +
        usuariosSugeridos.map(plantillaFilaPersona).join('');
    }
  } else if (buscandoEtiquetar) {
    zona.innerHTML = `<div class="cp-etiquetar__spinner"><span class="btn-spinner"></span></div>`;
  } else if (resultadosEtiquetar.length === 0) {
    zona.innerHTML = `<p class="cp-etiquetar__vacio">Sin resultados</p>`;
  } else {
    zona.innerHTML = resultadosEtiquetar.map(plantillaFilaPersona).join('');
  }

  zona.querySelectorAll('[data-etiquetar-id]').forEach((fila) => {
    fila.addEventListener('click', () => {
      const perfil = [...usuariosSugeridos, ...resultadosEtiquetar].find((p) => p.id === fila.dataset.etiquetarId);
      if (perfil) toggleSeleccionEtiquetado(perfil, contenedor);
    });
  });

  renderChipsEtiquetados(contenedor);
}

function plantillaFilaPersona(perfil) {
  const foto = resolverUrlPerfil(perfil);
  const marcado = yaSeleccionado(perfil.id);
  const carrera = perfil.carrera;
  return `
    <div class="cp-fila-persona" data-etiquetar-id="${perfil.id}">
      <div class="cp-fila-persona__avatar">${foto ? `<img src="${foto}" alt="" />` : '<span>👤</span>'}</div>
      <div class="cp-fila-persona__textos">
        <p class="cp-fila-persona__nombre">${perfil.nombre ?? ''}</p>
        <p class="cp-fila-persona__sub">${carrera ? `@${perfil.nombre_usuario ?? ''} · ${carrera}` : `@${perfil.nombre_usuario ?? ''}`}</p>
      </div>
      <span class="cp-fila-persona__check${marcado ? ' marcado' : ''}">${marcado ? '✓' : '○'}</span>
    </div>
  `;
}

function renderChipsEtiquetados(contenedor) {
  const zona = contenedor.querySelector('#cp-etiquetar-chips');
  if (etiquetados.length === 0) { zona.innerHTML = ''; return; }
  zona.innerHTML = etiquetados
    .map((u) => `<span class="cp-chip" data-chip-id="${u.id}">${u.nombre ?? ''} <button data-quitar-chip="${u.id}">✕</button></span>`)
    .join('');
  zona.querySelectorAll('[data-quitar-chip]').forEach((btn) => {
    btn.addEventListener('click', () => toggleSeleccionEtiquetado({ id: btn.dataset.quitarChip }, contenedor));
  });
}

// ═══════════════════════════════════════════════════════════════
// PASO 2 — REDACTAR + PUBLICAR
// ═══════════════════════════════════════════════════════════════

async function cargarPerfil() {
  try {
    const { data, error } = await supabaseClient
      .from('perfiles')
      .select('nombre_usuario, cdn_foto_perfil')
      .eq('id', uidActual)
      .maybeSingle();
    if (error) throw error;
    nombreUsuario = data?.nombre_usuario ?? 'Tú';
    fotoPerfilUrl = data?.cdn_foto_perfil ?? null;
    renderComposerPerfil(contenedorActual);
  } catch (error) {
    console.error('crear-publicacion – perfil:', error);
  }
}

function renderComposerPerfil(contenedor) {
  contenedor.querySelector('#cp-nombre-usuario').textContent = nombreUsuario ?? 'Tú';
  contenedor.querySelector('#cp-avatar').innerHTML = fotoPerfilUrl ? `<img src="${fotoPerfilUrl}" alt="" />` : '<span>👤</span>';
}

function renderEtiquetasResumen(contenedor) {
  const zona = contenedor.querySelector('#cp-etiquetas-resumen');
  const enlace = `<button class="cp-etiquetas-resumen__link" id="cp-editar-etiquetas">👤➕ ${etiquetados.length === 0 ? 'Etiquetar personas' : 'Editar etiquetas'}</button>`;
  const chips = etiquetados.length
    ? `<div class="cp-etiquetas-resumen__chips">${etiquetados
        .map(
          (u) => `
        <span class="cp-etiqueta-final" data-etiqueta-final="${u.id}">
          <span class="cp-etiqueta-final__avatar">${resolverUrlPerfil(u) ? `<img src="${resolverUrlPerfil(u)}" alt="" />` : '👤'}</span>
          ${u.nombre ?? ''}
          <button data-quitar-final="${u.id}">✕</button>
        </span>
      `
        )
        .join('')}</div>`
    : '';
  zona.innerHTML = enlace + chips;

  zona.querySelector('#cp-editar-etiquetas').addEventListener('click', () => irPaso(1, contenedor));
  zona.querySelectorAll('[data-quitar-final]').forEach((btn) => {
    btn.addEventListener('click', () => { quitarEtiquetado(btn.dataset.quitarFinal, contenedor); renderEtiquetasResumen(contenedor); });
  });
}

function renderProgreso(contenedor) {
  const zona = contenedor.querySelector('#cp-progreso');
  if (!publicando || !estadoPublicacion) { zona.hidden = true; return; }
  zona.hidden = false;
  zona.innerHTML = `
    <span class="btn-spinner" style="width:16px;height:16px;border-width:2px;"></span>
    <div class="cp-progreso__col">
      <p class="cp-progreso__texto">${estadoPublicacion}</p>
      ${progresoPct !== null ? `<div class="cp-progreso__track"><div class="cp-progreso__barra" style="width:${Math.min(100, Math.max(0, progresoPct))}%"></div></div>` : ''}
    </div>
  `;
}

async function publicar(contenedor) {
  if (publicando || !uidActual) return;

  try {
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    const { data: conteoHoy } = await supabaseClient
      .from('publicaciones')
      .select('id')
      .eq('autor_id', uidActual)
      .gte('creado_en', inicioDia.toISOString());
    if ((conteoHoy?.length ?? 0) >= 3) {
      mostrarToast('Has alcanzado el límite de 3 publicaciones por día', 'error');
      return;
    }
  } catch (error) {
    console.error('crear-publicacion – límite diario:', error);
  }

  const texto = contenedor.querySelector('#cp-texto').value.trim();
  if (!texto && media.length === 0) {
    mostrarToast('Escribe algo o adjunta un archivo', 'error');
    return;
  }

  publicando = true;
  estadoPublicacion = 'Preparando publicación...';
  progresoPct = null;
  renderHeader(contenedor);
  renderProgreso(contenedor);

  let pubId = null;
  try {
    const soloVideos = media.length > 0 && media.every((m) => m.tipo === 'video');
    const tipo = soloVideos ? 'reel' : 'post';

    const { data: pubRes, error: errPub } = await supabaseClient
      .from('publicaciones')
      .insert({ autor_id: uidActual, contenido: texto, tipo })
      .select('id')
      .single();
    if (errPub) throw errPub;
    pubId = pubRes.id;

    if (etiquetados.length > 0) {
      const filas = etiquetados.map((u) => ({ publicacion_id: pubId, usuario_id: u.id, etiquetado_por: uidActual }));
      const { error: errEtq } = await supabaseClient.from('publicacion_etiquetas').insert(filas);
      if (errEtq) throw errEtq;
    }

    for (let i = 0; i < media.length; i++) {
      const item = media[i];
      const esVid = item.tipo === 'video';

      estadoPublicacion = esVid ? 'Subiendo video...' : `Subiendo imagen ${i + 1}/${media.length}...`;
      progresoPct = esVid ? 0 : null;
      renderProgreso(contenedor);

      const cdnUrl = await storageService.subirMediaPublicacion({
        file: item.file,
        postId: pubId,
        userId: uidActual,
        orden: i,
        onProgress: esVid
          ? (pct) => {
              progresoPct = pct;
              estadoPublicacion = `Subiendo video... ${pct.toFixed(0)}%`;
              renderProgreso(contenedor);
            }
          : undefined,
      });

      const { error: errMedio } = await supabaseClient.from('publicacion_medios').insert({
        publicacion_id: pubId,
        url: cdnUrl,
        cdn_url: cdnUrl,
        tipo_medio: item.tipo,
        orden: i,
      });
      if (errMedio) throw errMedio;
    }

    limpiarObjectUrls();
    // Web-equivalente de Navigator.push<bool>().then((creada) => ...):
    // avisa a pantalla-principal.js (u otra pantalla que esté
    // escuchando) que hay publicaciones nuevas que traer, sin
    // depender de un valor de retorno de la navegación.
    window.dispatchEvent(new CustomEvent('publicacion:creada'));
    window.history.back();
  } catch (error) {
    console.error('crear-publicacion – publicar:', error);
    if (pubId) {
      try {
        await supabaseClient.from('publicaciones').delete().eq('id', pubId);
      } catch (errorRollback) {
        console.error('crear-publicacion – rollback:', errorRollback);
      }
    }
    mostrarToast('No se pudo publicar. Intenta de nuevo.', 'error');
  } finally {
    publicando = false;
    estadoPublicacion = '';
    progresoPct = null;
    renderHeader(contenedor);
    renderProgreso(contenedor);
  }
}

// ═══════════════════════════════════════════════════════════════
// INTERACCIONES
// ═══════════════════════════════════════════════════════════════

function activarInteracciones(contenedor) {
  contenedor.querySelector('#cp-atras').addEventListener('click', () => {
    if (publicando) return;
    if (paso === 0) window.history.back();
    else irPaso(paso - 1, contenedor);
  });

  const inputGaleria = contenedor.querySelector('#cp-input-galeria');
  const inputFoto = contenedor.querySelector('#cp-input-foto');
  const inputVideo = contenedor.querySelector('#cp-input-video');

  contenedor.querySelector('#cp-abrir-galeria').addEventListener('click', () => inputGaleria.click());
  contenedor.querySelector('#cp-abrir-camara').addEventListener('click', () => abrirOpcionesCamara(contenedor, inputFoto, inputVideo));

  inputGaleria.addEventListener('change', () => {
    manejarArchivosSeleccionados(inputGaleria.files, contenedor);
    inputGaleria.value = '';
  });
  inputFoto.addEventListener('change', () => {
    manejarArchivosSeleccionados(inputFoto.files, contenedor);
    inputFoto.value = '';
  });
  inputVideo.addEventListener('change', () => {
    manejarArchivosSeleccionados(inputVideo.files, contenedor);
    inputVideo.value = '';
  });

  const inputEtiquetar = contenedor.querySelector('#cp-etiquetar-input');
  let debounceEtiquetar = null;
  inputEtiquetar.addEventListener('input', () => {
    clearTimeout(debounceEtiquetar);
    const texto = inputEtiquetar.value.trim();
    if (!texto) { renderEtiquetarLista(contenedor); return; }
    debounceEtiquetar = setTimeout(() => buscarEtiquetar(contenedor, texto), 350);
  });

  contenedor.querySelector('#cp-texto').addEventListener('input', () => {
    // El texto se lee directo del textarea al publicar; no hace
    // falta mantenerlo espejado en una variable de estado aparte.
  });

  renderBarraSeleccion(contenedor);
}

/// Menú de opciones "Tomar foto" / "Grabar video" (equivalente web
/// del CupertinoActionSheet de _abrirCamara en Dart).
function abrirOpcionesCamara(contenedor, inputFoto, inputVideo) {
  const overlay = document.createElement('div');
  overlay.className = 'feed-hoja-overlay';
  overlay.innerHTML = `
    <div class="feed-hoja">
      <div class="feed-hoja__manija"></div>
      <button class="feed-hoja__item" data-camara="foto"><span>📷</span> Tomar foto</button>
      <button class="feed-hoja__item" data-camara="video"><span>🎥</span> Grabar video</button>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (evento) => {
    if (evento.target === overlay) { overlay.remove(); return; }
    const accion = evento.target.closest('[data-camara]')?.dataset.camara;
    if (!accion) return;
    overlay.remove();
    if (accion === 'foto') inputFoto.click();
    if (accion === 'video') inputVideo.click();
  });
}