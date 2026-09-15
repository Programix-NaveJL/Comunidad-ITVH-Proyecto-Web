// ver-historia-base.js
// Puerto de ver_historia_base.dart. En Dart, esto es la clase
// abstracta EstadoVistaGrupoHistoriaBase compartida vía `part of`
// entre ver_historia_propia.dart y ver_historia_publica.dart. JS no
// tiene ese mecanismo, así que aquí se expone una FÁBRICA:
// crearVistaGrupoHistoria(opciones) construye un controlador con
// todo el comportamiento común, y recibe como "hooks" las piezas que
// cada especialización aporta (esMiHistoria, renderAccionInferior/
// activarAccionInferior, renderHoja/activarHoja, alTocarAvatarAutor,
// cargarDatosAlAbrirHoja, cargarDatosExtraInicial, resetearDatosExtra,
// faltanDatosExtra) — mismo rol que los métodos abstractos del Dart
// original.
//
// cargarDatosExtraInicial(historia) puede devolver opcionalmente
// { totalLikes } para que la especialización sobreescriba el
// contador compartido (la rama "propia" necesita mostrar "cuántos
// reaccionaron", no el like directo de cargarLike()).
//
// DIFERENCIAS DE PLATAFORMA (documentadas aquí una sola vez):
//
//   • GESTOS: Flutter resuelve automáticamente qué gesto "gana"
//     (tap vs long-press vs drag vertical vs horizontal) vía su
//     arena de gestos. El navegador no tiene eso — aquí se
//     desambigua a mano con pointerdown/pointermove/pointerup:
//     se espera a que el movimiento supere ~10px para decidir el
//     eje (x o y), y el long-press se cancela apenas hay movimiento
//     real. Si en pruebas reales un gesto se siente "pegajoso" o
//     se dispara el equivocado, este es el punto a ajustar primero.
//
//   • AUDIO DE FONDO (LockCachingAudioSource → <audio> + preload):
//     no hay equivalente de caché-a-disco controlable en el
//     navegador. La "precarga" de la siguiente canción se aproxima
//     creando un <audio preload="auto"> con esa URL para que el
//     navegador la deje en su caché HTTP normal — no hay garantía
//     de que esté lista al instante como con LockCachingAudioSource.
//
//     Los listeners de loadedmetadata/timeupdate del <audio>
//     principal capturan SU PROPIA instancia en una constante local
//     (miAudio) y comparan contra la variable de módulo `audioEl`
//     antes de tocar nada. Esto es necesario porque, si el usuario
//     cambia de historia (o cierra el visor) mientras ese <audio>
//     todavía estaba cargando metadatos, el evento puede llegar
//     DESPUÉS de que cargarHistoriaActual() ya haya hecho
//     `audioEl = null` — sin esta comprobación el callback intenta
//     leer/escribir currentTime sobre null y truena
//     (Cannot read properties of null (reading 'currentTime')).
//
//   • VIDEO: por simplicidad, el <video> se recrea cada vez que se
//     cambia de historia (incluso al volver a una ya vista dentro
//     del mismo autor) — el Dart original reutiliza el controller
//     si la URL coincide, como optimización de red. Aquí se acepta
//     una descarga extra a cambio de un código bastante más simple.
//
//   • FONDO DIFUMINADO: solo se implementa para imágenes (una capa
//     con background-image + filter:blur detrás de la imagen
//     principal). Para video se omite esa capa — el video se ve
//     centrado sobre fondo negro sólido, sin el efecto Instagram de
//     fondo borroso duplicado.
//
//   • HOJA INFERIOR: se reutiliza el shell compartido de
//     js/core/bottom-sheet.js (el mismo que usan las hojas de
//     comentarios/reacciones de publicaciones) en vez de reimplementar
//     un DraggableScrollableSheet propio.

import { supabaseClient } from '../../../../core/supabase-client.js';
import { navegarA } from '../../../../core/router.js';
import { resolverUrlHistoria, resolverUrlPerfil } from '../../../../core/perfil-utils.js';
import { abrirHojaInferior } from '../../../../core/bottom-sheet.js';

const DURACION_IMAGEN_MS = 8000;
const UMBRAL_MOV_PX = 10;
const UMBRAL_SWIPE_UP_PX = 40;
const UMBRAL_SWIPE_HORIZ_PX = 50;

export function crearVistaGrupoHistoria(opciones) {
  const {
    grupo,
    esPrimeraPagina,
    onAvanzarGrupo,
    onRetrocederGrupo,
    onCerrarTodo,
    onIrAMiPerfil = null,
    esMiHistoria,
    renderAccionInferior,
    activarAccionInferior,
    renderHoja,
    activarHoja,
    alTocarAvatarAutor,
    cargarDatosAlAbrirHoja,
    cargarDatosExtraInicial,
    resetearDatosExtra,
    faltanDatosExtra,
  } = opciones;

  // ── Estado ───────────────────────────────────────────────────
  let storiaActual = 0;
  let activa = false;
  let yaCargadaAlgunaVez = false;
  let modalAbierto = false;
  let pausadoPorTap = false;

  let audioEl = null;
  let audioPrecargaEl = null;
  let urlPrecargada = null;

  let videoEl = null;
  let esVideoActual = false;
  let videoInicioMs = 0;
  let videoFinMs = 0;

  let comentarios = [];
  let miLike = false;
  let totalLikes = 0;
  let enviandoComentario = false;

  let uidActual = null;

  // Progreso (equivalente al AnimationController de Dart, vía rAF).
  let rafId = null;
  let inicioTs = 0;
  let duracionActualMs = DURACION_IMAGEN_MS;
  let fraccionActual = 0;

  // DOM
  let elRaiz, elMedia, elPausado, elProgreso, elHeader, elChipMusica, elAccionInferior;

  // ── Helpers de datos del grupo ───────────────────────────────
  function getStories() {
    return grupo.stories ?? [];
  }
  function getHistoriaActual() {
    return getStories()[storiaActual] ?? {};
  }

  // ═══════════════════════════════════════════════════════════
  // MONTAJE
  // ═══════════════════════════════════════════════════════════

  function montar(contenedorPadre) {
    elRaiz = document.createElement('div');
    elRaiz.className = 'vh-pagina vh-pagina--oculta';
    elRaiz.innerHTML = `
      <div class="vh-media" data-vh-media></div>
      <div class="vh-pausado-icono" data-vh-pausado hidden>⏸️</div>
      <div class="vh-gradiente vh-gradiente--top"></div>
      <div class="vh-gradiente vh-gradiente--bottom"></div>
      <div class="vh-progreso" data-vh-progreso></div>
      <div class="vh-header" data-vh-header></div>
      <div class="vh-chip-musica-zona" data-vh-chip-musica hidden></div>
      <div class="vh-accion-inferior" data-vh-accion-inferior></div>
    `;
    contenedorPadre.appendChild(elRaiz);

    elMedia = elRaiz.querySelector('[data-vh-media]');
    elPausado = elRaiz.querySelector('[data-vh-pausado]');
    elProgreso = elRaiz.querySelector('[data-vh-progreso]');
    elHeader = elRaiz.querySelector('[data-vh-header]');
    elChipMusica = elRaiz.querySelector('[data-vh-chip-musica]');
    elAccionInferior = elRaiz.querySelector('[data-vh-accion-inferior]');

    renderEstructuraProgreso();
    activarGestos();

    supabaseClient.auth.getUser().then(({ data }) => {
      uidActual = data?.user?.id ?? null;
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ACTIVAR / DESACTIVAR (equivalente a didUpdateWidget en activa)
  // ═══════════════════════════════════════════════════════════

  async function activar() {
    activa = true;
    elRaiz.classList.remove('vh-pagina--oculta');

    if (!yaCargadaAlgunaVez) {
      yaCargadaAlgunaVez = true;
      await cargarHistoriaActual();
      return;
    }

    if (comentarios.length === 0 || faltanDatosExtra()) {
      await cargarHistoriaActual();
      return;
    }

    if (!modalAbierto && !pausadoPorTap) {
      reanudarAnim();
      audioEl?.play().catch(() => {});
      videoEl?.play().catch(() => {});
    }
  }

  function desactivar() {
    activa = false;
    elRaiz.classList.add('vh-pagina--oculta');
    pausarAnim();
    audioEl?.pause();
    videoEl?.pause();
  }

  function destruir() {
    pausarAnim();
    audioEl?.pause();
    audioEl = null;
    audioPrecargaEl?.pause();
    audioPrecargaEl = null;
    videoEl?.removeEventListener('timeupdate', onVideoTimeUpdate);
    videoEl = null;
    elRaiz?.remove();
  }

  // ═══════════════════════════════════════════════════════════
  // CARGA DE LA HISTORIA ACTUAL
  // ═══════════════════════════════════════════════════════════

  async function cargarHistoriaActual() {
    resetAnim();
    videoEl?.removeEventListener('timeupdate', onVideoTimeUpdate);
    videoEl = null;
    audioEl?.pause();
    audioEl = null;

    const historia = getHistoriaActual();
    const url = resolverUrlHistoria(historia);
    const tipo = historia.tipo ?? 'imagen';
    esVideoActual = tipo === 'video' || (Boolean(url) && (url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('.webm')));

    pintarMedia(historia, url, esVideoActual);
    renderHeaderYTiempo(historia);
    renderChipMusica(historia);
    pintarAccion();

    await Promise.all([registrarVista(historia), cargarLike(historia), cargarComentarios(historia)]);

    const resultadoExtra = await cargarDatosExtraInicial(historia);
    if (resultadoExtra && typeof resultadoExtra.totalLikes === 'number') {
      totalLikes = resultadoExtra.totalLikes;
    }
    pintarAccion();

    if (esVideoActual) {
      await prepararVideo(historia);
    } else if (activa && !modalAbierto && !pausadoPorTap) {
      iniciarProgreso(DURACION_IMAGEN_MS);
    }

    if (activa && !modalAbierto && !pausadoPorTap) {
      iniciarAudio(historia);
    }
  }

  function pintarMedia(historia, url, esVideo) {
    if (!url) {
      elMedia.innerHTML = '<div class="vh-media__vacio"></div>';
      return;
    }
    if (esVideo) {
      elMedia.innerHTML = `<video class="vh-media__video" playsinline></video>`;
      videoEl = elMedia.querySelector('video');
      videoEl.muted = Boolean(historia.preview_url);
      videoEl.volume = historia.preview_url ? 0 : 1;
      videoEl.src = url;
    } else {
      elMedia.innerHTML = `
        <div class="vh-media__fondo-blur" style="background-image:url('${url}')"></div>
        <img class="vh-media__img" src="${url}" alt="" />
      `;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // VIDEO
  // ═══════════════════════════════════════════════════════════

  function onVideoTimeUpdate() {
    if (!videoEl) return;
    const posMs = videoEl.currentTime * 1000;
    if (videoFinMs > videoInicioMs && posMs >= videoFinMs) {
      videoEl.currentTime = videoInicioMs / 1000;
    }
  }

  function prepararVideo(historia) {
    return new Promise((resolve) => {
      videoInicioMs = historia.video_inicio_ms ?? 0;
      videoFinMs = historia.video_fin_ms ?? 0;

      videoEl.addEventListener(
        'loadedmetadata',
        () => {
          const duracionTotalMs = (videoEl.duration || 0) * 1000;
          if (videoFinMs <= videoInicioMs || videoFinMs > duracionTotalMs) {
            videoFinMs = duracionTotalMs;
          }
          videoEl.currentTime = videoInicioMs / 1000;

          if (activa && !modalAbierto && !pausadoPorTap) {
            videoEl.play().catch(() => {});
            const segmentoMs = videoFinMs - videoInicioMs;
            iniciarProgreso(segmentoMs > 500 ? segmentoMs : duracionTotalMs > 500 ? duracionTotalMs : DURACION_IMAGEN_MS);
          }
          resolve();
        },
        { once: true }
      );
      videoEl.addEventListener('timeupdate', onVideoTimeUpdate);
      videoEl.load();
    });
  }

  // ═══════════════════════════════════════════════════════════
  // AUDIO DE FONDO (canción acoplada)
  // ═══════════════════════════════════════════════════════════

  function iniciarAudio(historia) {
    const previewUrl = historia.preview_url;
    if (!previewUrl) {
      precargarSiguienteAudio();
      return;
    }

    const inicioMs = historia.track_inicio_ms ?? 0;

    // Se guarda la instancia en una constante local (miAudio) además
    // de en la variable de módulo `audioEl`. Los listeners de abajo
    // usan SIEMPRE miAudio para leer/escribir currentTime, y solo
    // llaman a play()/renderChipMusica() si esta instancia sigue
    // siendo la vigente (audioEl === miAudio). Así, si el usuario ya
    // avanzó de historia (o cerró el visor) y cargarHistoriaActual()
    // ya puso audioEl = null antes de que este <audio> terminara de
    // cargar sus metadatos, el callback no truena: simplemente no
    // hace nada porque miAudio !== audioEl.
    const miAudio = new Audio();
    audioEl = miAudio;

    miAudio.addEventListener('loadedmetadata', () => {
      if (audioEl !== miAudio) return;
      miAudio.currentTime = inicioMs / 1000;
      if (activa && !modalAbierto && !pausadoPorTap) miAudio.play().catch(() => {});
    });
    miAudio.addEventListener('timeupdate', () => {
      if (audioEl !== miAudio) return;
      if (miAudio.currentTime * 1000 >= inicioMs + 15000) miAudio.currentTime = inicioMs / 1000;
    });
    miAudio.addEventListener('play', () => {
      if (audioEl === miAudio) renderChipMusica(getHistoriaActual());
    });
    miAudio.addEventListener('pause', () => {
      if (audioEl === miAudio) renderChipMusica(getHistoriaActual());
    });
    miAudio.src = previewUrl;
    miAudio.load();

    precargarSiguienteAudio();
  }

  function precargarSiguienteAudio() {
    const siguiente = getStories()[storiaActual + 1];
    const url = siguiente?.preview_url;
    if (!url || url === urlPrecargada) return;
    audioPrecargaEl?.pause();
    audioPrecargaEl = new Audio();
    audioPrecargaEl.preload = 'auto';
    audioPrecargaEl.src = url;
    audioPrecargaEl.load();
    urlPrecargada = url;
  }

  function toggleAudio() {
    if (!audioEl) return;
    audioEl.paused ? audioEl.play().catch(() => {}) : audioEl.pause();
  }

  function detenerAudio() {
    audioEl?.pause();
    audioEl = null;
  }

  // ═══════════════════════════════════════════════════════════
  // PROGRESO (rAF, equivalente al AnimationController de Dart)
  // ═══════════════════════════════════════════════════════════

  function tickProgreso(ts) {
    const transcurrido = ts - inicioTs;
    fraccionActual = Math.min(1, transcurrido / duracionActualMs);
    pintarBarra();
    if (fraccionActual >= 1) {
      rafId = null;
      siguiente();
      return;
    }
    rafId = requestAnimationFrame(tickProgreso);
  }
  function iniciarProgreso(duracionMs) {
    pausarAnim();
    duracionActualMs = duracionMs;
    fraccionActual = 0;
    inicioTs = performance.now();
    rafId = requestAnimationFrame(tickProgreso);
  }
  function pausarAnim() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }
  function reanudarAnim() {
    if (rafId) return;
    inicioTs = performance.now() - fraccionActual * duracionActualMs;
    rafId = requestAnimationFrame(tickProgreso);
  }
  function resetAnim() {
    pausarAnim();
    fraccionActual = 0;
    pintarBarra();
  }

  function renderEstructuraProgreso() {
    elProgreso.innerHTML = getStories()
      .map((_, i) => `<div class="vh-progreso__seg"><div class="vh-progreso__fill" data-vh-fill="${i}"></div></div>`)
      .join('');
  }
  function pintarBarra() {
    elProgreso.querySelectorAll('[data-vh-fill]').forEach((el, i) => {
      const pct = i < storiaActual ? 100 : i === storiaActual ? fraccionActual * 100 : 0;
      el.style.width = `${pct}%`;
    });
  }

  // ═══════════════════════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════════════════════

  function renderHeaderYTiempo(historia) {
    const nombre = grupo.nombre ?? '';
    const foto = grupo.foto ?? '';
    elHeader.innerHTML = `
      <button class="vh-header__avatar" data-vh-avatar>${foto ? `<img src="${foto}" alt="" />` : '👤'}</button>
      <div class="vh-header__info" data-vh-avatar>
        <p class="vh-header__nombre">${esMiHistoria ? 'Tu historia' : escaparHtml(nombre.split(' ')[0] ?? '')}</p>
        <p class="vh-header__tiempo">${tiempoTranscurrido(historia.creado_en)}</p>
      </div>
      <button class="vh-header__cerrar" data-vh-cerrar aria-label="Cerrar">✕</button>
    `;
    elHeader.querySelectorAll('[data-vh-avatar]').forEach((el) =>
      el.addEventListener('click', (evento) => {
        evento.stopPropagation();
        alTocarAvatarAutor({ pausarParaNavegar, reanudarDespuesDeNavegar, onCerrarTodo, onIrAMiPerfil, grupo });
      })
    );
    elHeader.querySelector('[data-vh-cerrar]').addEventListener('click', (evento) => {
      evento.stopPropagation();
      detenerAudio();
      onCerrarTodo();
    });
  }

  // ═══════════════════════════════════════════════════════════
  // CHIP DE MÚSICA
  // ═══════════════════════════════════════════════════════════

  function renderChipMusica(historia) {
    const previewUrl = historia.preview_url;
    if (!previewUrl) {
      elChipMusica.hidden = true;
      elChipMusica.innerHTML = '';
      return;
    }
    const reproduciendo = Boolean(audioEl && !audioEl.paused);
    elChipMusica.hidden = false;
    elChipMusica.innerHTML = `
      <button class="vh-chip-musica" data-vh-toggle-audio>
        <span class="vh-chip-musica__cover${reproduciendo ? ' vh-chip-musica__cover--girando' : ''}">
          ${historia.track_cover ? `<img src="${historia.track_cover}" alt="" />` : '🎵'}
        </span>
        <span class="vh-chip-musica__info">
          <span class="vh-chip-musica__titulo">${escaparHtml(historia.track_titulo ?? '')}</span>
          <span class="vh-chip-musica__artista">${escaparHtml(historia.track_artista ?? '')}</span>
        </span>
        <span class="vh-chip-musica__icono">${reproduciendo ? '⏸️' : '▶️'}</span>
      </button>
    `;
    elChipMusica.querySelector('[data-vh-toggle-audio]').addEventListener('click', (evento) => {
      evento.stopPropagation();
      toggleAudio();
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ACCIÓN INFERIOR (delegada al hook de cada especialización)
  // ═══════════════════════════════════════════════════════════

  function pintarAccion() {
    elAccionInferior.innerHTML = renderAccionInferior({ miLike, totalLikes });
    activarAccionInferior(elAccionInferior, { miLike, totalLikes, toggleLike, mostrarHoja, uid: uidActual });
  }

  // ═══════════════════════════════════════════════════════════
  // DATOS: vista, like, comentarios (compartido entre ambas ramas)
  // ═══════════════════════════════════════════════════════════

  async function registrarVista(historia) {
    if (!uidActual || !historia.id) return;
    try {
      await supabaseClient.from('historia_vistas').upsert(
        { historia_id: historia.id, usuario_id: uidActual },
        { onConflict: 'historia_id,usuario_id' }
      );
    } catch (error) {
      console.error('ver-historia – registrar vista:', error);
    }
  }

  async function cargarLike(historia) {
    if (!uidActual || !historia.id) return;
    try {
      const { data: miLikeRes } = await supabaseClient
        .from('reacciones_historias')
        .select('id')
        .eq('historia_id', historia.id)
        .eq('usuario_id', uidActual)
        .eq('tipo', 'like')
        .maybeSingle();
      const { data: totalRes } = await supabaseClient.from('reacciones_historias').select('id').eq('historia_id', historia.id).eq('tipo', 'like');
      miLike = Boolean(miLikeRes);
      totalLikes = (totalRes ?? []).length;
    } catch (error) {
      console.error('ver-historia – cargarLike:', error);
    }
  }

  async function toggleLike() {
    if (!uidActual) return;
    const historia = getHistoriaActual();
    const antes = miLike;
    miLike = !antes;
    totalLikes += antes ? -1 : 1;
    pintarAccion();
    try {
      if (antes) {
        await supabaseClient.from('reacciones_historias').delete().eq('historia_id', historia.id).eq('usuario_id', uidActual).eq('tipo', 'like');
      } else {
        await supabaseClient.from('reacciones_historias').insert({ historia_id: historia.id, usuario_id: uidActual, tipo: 'like' });
      }
    } catch (error) {
      miLike = antes;
      totalLikes += antes ? 1 : -1;
      pintarAccion();
      console.error('ver-historia – toggleLike:', error);
    }
  }

  async function cargarComentarios(historia) {
    if (!historia.id) return;
    try {
      const { data, error } = await supabaseClient
        .from('comentarios_historias')
        .select('id, contenido, creado_en, autor_id, perfiles!comentarios_historias_autor_id_fkey(id, nombre, nombre_usuario, cdn_foto_perfil)')
        .eq('historia_id', historia.id)
        .order('creado_en', { ascending: true });
      if (error) throw error;

      const lista = data ?? [];
      const ids = lista.map((c) => c.id);
      const totales = {};
      const misLikes = {};

      if (ids.length > 0) {
        const { data: likesData } = await supabaseClient
          .from('reacciones_comentarios_historias')
          .select('comentario_id, usuario_id')
          .in('comentario_id', ids)
          .eq('tipo', 'like');
        (likesData ?? []).forEach((l) => {
          totales[l.comentario_id] = (totales[l.comentario_id] ?? 0) + 1;
          if (l.usuario_id === uidActual) misLikes[l.comentario_id] = true;
        });
      }

      comentarios = lista.map((c) => ({
        ...c,
        total_likes_comentario: totales[c.id] ?? 0,
        yo_di_like_comentario: misLikes[c.id] ?? false,
      }));
    } catch (error) {
      console.error('ver-historia – cargarComentarios:', error);
    }
  }

  async function enviarComentario(texto) {
    const limpio = texto.trim();
    if (!limpio || !uidActual) return;
    enviandoComentario = true;
    try {
      await supabaseClient.from('comentarios_historias').insert({ historia_id: getHistoriaActual().id, autor_id: uidActual, contenido: limpio });
      await cargarComentarios(getHistoriaActual());
    } catch (error) {
      console.error('ver-historia – enviarComentario:', error);
    } finally {
      enviandoComentario = false;
    }
  }

  async function toggleLikeComentario(comentarioId, yaDioLike) {
    if (!uidActual) return;
    comentarios = comentarios.map((c) =>
      c.id === comentarioId
        ? { ...c, yo_di_like_comentario: !yaDioLike, total_likes_comentario: c.total_likes_comentario + (yaDioLike ? -1 : 1) }
        : c
    );
    try {
      if (yaDioLike) {
        await supabaseClient.from('reacciones_comentarios_historias').delete().eq('comentario_id', comentarioId).eq('usuario_id', uidActual);
      } else {
        await supabaseClient.from('reacciones_comentarios_historias').insert({ comentario_id: comentarioId, usuario_id: uidActual, tipo: 'like' });
      }
    } catch (error) {
      comentarios = comentarios.map((c) =>
        c.id === comentarioId
          ? { ...c, yo_di_like_comentario: yaDioLike, total_likes_comentario: c.total_likes_comentario + (yaDioLike ? 1 : -1) }
          : c
      );
      console.error('ver-historia – toggleLikeComentario:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HOJA INFERIOR
  // ═══════════════════════════════════════════════════════════

  async function mostrarHoja() {
    if (modalAbierto) return;
    pausarParaNavegar();
    modalAbierto = true;

    const { cuerpo, cerrar } = abrirHojaInferior({
      initialChildSize: 0.6,
      maxChildSize: 0.95,
      minChildSize: 0.3,
      onCerrar: () => {
        modalAbierto = false;
        reanudarDespuesDeNavegar();
      },
    });

    const ctx = {
      uid: uidActual,
      grupo,
      cerrarHoja: cerrar,
      pausarParaNavegar,
      reanudarDespuesDeNavegar,
      onCerrarTodo,
      onIrAMiPerfil,
      tiempoTranscurrido,
      renderComentario: renderComentarioHistoria,
      activarComentario: (el, c) => activarComentarioHistoria(el, c, ctx),
      comentarios,
      enviando: enviandoComentario,
      historiaActual: getHistoriaActual(),
      enviarComentario: async (texto) => {
        await enviarComentario(texto);
        actualizar();
      },
      toggleLikeComentario: async (id, yaDioLike) => {
        await toggleLikeComentario(id, yaDioLike);
        actualizar();
      },
      actualizar: () => actualizar(),
    };

    function actualizar() {
      ctx.comentarios = comentarios;
      ctx.enviando = enviandoComentario;
      ctx.historiaActual = getHistoriaActual();
      cuerpo.innerHTML = renderHoja(ctx);
      activarHoja(cuerpo, ctx);
    }

    actualizar();
    await cargarDatosAlAbrirHoja(getHistoriaActual());
    actualizar();
  }

  // ── Gestos ───────────────────────────────────────────────────

  function activarGestos() {
    let startX = 0;
    let startY = 0;
    let eje = null;
    let dragUpAcum = 0;
    let dragX = 0;
    let dragY = 0;
    let longPressTimer = null;

    elRaiz.addEventListener('pointerdown', (evento) => {
      if (modalAbierto) return;
      startX = evento.clientX;
      startY = evento.clientY;
      eje = null;
      dragUpAcum = 0;
      dragX = 0;
      dragY = 0;
      longPressTimer = setTimeout(() => {
        if (eje === null) activarPausaPorTap();
      }, 500);
      try {
        elRaiz.setPointerCapture(evento.pointerId);
      } catch {
        /* algunos navegadores lanzan si el pointer ya se soltó */
      }
    });

    elRaiz.addEventListener('pointermove', (evento) => {
      if (modalAbierto) return;
      const dx = evento.clientX - startX;
      const dy = evento.clientY - startY;

      if (eje === null) {
        if (Math.abs(dx) > UMBRAL_MOV_PX || Math.abs(dy) > UMBRAL_MOV_PX) {
          clearTimeout(longPressTimer);
          eje = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        } else {
          return;
        }
      }

      if (eje === 'y') {
        if (dy > 0) {
          dragY = Math.min(dy, 300);
          aplicarTransform(0, dragY);
        } else {
          dragUpAcum = Math.max(dragUpAcum, -dy);
        }
      } else if (eje === 'x') {
        dragX = Math.max(-200, Math.min(200, dx));
        aplicarTransform(dragX, 0);
      }
    });

    elRaiz.addEventListener('pointerup', (evento) => {
      clearTimeout(longPressTimer);
      if (pausadoPorTap) {
        desactivarPausaPorTap();
        eje = null;
        return;
      }

      if (eje === 'y') {
        if (dragUpAcum >= UMBRAL_SWIPE_UP_PX) {
          resetTransform();
          mostrarHoja();
        } else if (dragY > 100) {
          detenerAudio();
          onCerrarTodo();
        } else {
          resetTransform();
        }
      } else if (eje === 'x') {
        if (dragX < -UMBRAL_SWIPE_HORIZ_PX) {
          resetTransform();
          detenerAudio();
          onAvanzarGrupo();
        } else if (dragX > UMBRAL_SWIPE_HORIZ_PX) {
          resetTransform();
          detenerAudio();
          onRetrocederGrupo();
        } else {
          resetTransform();
        }
      } else {
        const rect = elRaiz.getBoundingClientRect();
        const mitad = rect.left + rect.width / 2;
        evento.clientX > mitad ? siguiente() : anterior();
      }
      eje = null;
    });

    elRaiz.addEventListener('pointercancel', () => {
      clearTimeout(longPressTimer);
      resetTransform();
      if (pausadoPorTap) desactivarPausaPorTap();
      eje = null;
    });

    function activarPausaPorTap() {
      pausadoPorTap = true;
      pausarAnim();
      audioEl?.pause();
      videoEl?.pause();
      elPausado.hidden = false;
    }
    function desactivarPausaPorTap() {
      pausadoPorTap = false;
      elPausado.hidden = true;
      if (!modalAbierto) {
        reanudarAnim();
        audioEl?.play().catch(() => {});
        videoEl?.play().catch(() => {});
      }
    }
    function aplicarTransform(x, y) {
      elRaiz.style.transform = `translate(${x}px, ${y}px)`;
      elRaiz.style.opacity = String(Math.max(0, 1 - (Math.abs(x) + Math.abs(y)) / 300));
    }
    function resetTransform() {
      elRaiz.style.transform = '';
      elRaiz.style.opacity = '';
    }
  }

  // ── Navegación entre historias del mismo autor ────────────────

  function siguiente() {
    const stories = getStories();
    if (storiaActual < stories.length - 1) {
      storiaActual++;
      resetearDatosExtra();
      cargarHistoriaActual();
    } else {
      detenerAudio();
      onAvanzarGrupo();
    }
  }
  function anterior() {
    if (storiaActual > 0) {
      storiaActual--;
      resetearDatosExtra();
      cargarHistoriaActual();
    } else if (!esPrimeraPagina) {
      detenerAudio();
      onRetrocederGrupo();
    } else {
      cargarHistoriaActual();
    }
  }

  // ── Pausar/reanudar al navegar a otra pantalla (perfil, etc.) ──

  function pausarParaNavegar() {
    pausarAnim();
    audioEl?.pause();
    videoEl?.pause();
  }
  function reanudarDespuesDeNavegar() {
    if (!activa || modalAbierto || pausadoPorTap) return;
    reanudarAnim();
    audioEl?.play().catch(() => {});
    videoEl?.play().catch(() => {});
  }

  return {
    montar,
    activar,
    desactivar,
    destruir,
    get elemento() {
      return elRaiz;
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// COMENTARIO — item compartido entre la hoja "propia" y "pública"
// ═══════════════════════════════════════════════════════════════

export function renderComentarioHistoria(c) {
  const perfil = c.perfiles ?? {};
  const foto = resolverUrlPerfil(perfil);
  return `
    <div class="vh-comentario" data-vh-comentario-id="${c.id}">
      <div class="vh-comentario__avatar" data-vh-comentario-perfil>${foto ? `<img src="${foto}" alt="" />` : '👤'}</div>
      <div class="vh-comentario__cuerpo">
        <p class="vh-comentario__nombre" data-vh-comentario-perfil>${escaparHtml(perfil.nombre ?? '')}</p>
        <p class="vh-comentario__texto">${escaparHtml(c.contenido ?? '')}</p>
        <div class="vh-comentario__acciones">
          <span class="vh-comentario__tiempo">${tiempoTranscurrido(c.creado_en)}</span>
          <button class="vh-comentario__like" data-vh-comentario-like>
            <span>${c.yo_di_like_comentario ? '❤️' : '🤍'}</span>
            ${c.total_likes_comentario > 0 ? `<span>${c.total_likes_comentario}</span>` : ''}
          </button>
        </div>
      </div>
    </div>
  `;
}

export function activarComentarioHistoria(el, c, ctx) {
  const autorId = c.autor_id ?? '';
  el.querySelectorAll('[data-vh-comentario-perfil]').forEach((elPerfil) => {
    elPerfil.addEventListener('click', () => {
      ctx.pausarParaNavegar();
      if (autorId === ctx.uid) {
        ctx.onCerrarTodo();
        ctx.onIrAMiPerfil?.();
      } else if (autorId) {
        navegarA(`/perfil-publico/${autorId}`); // TODO: pendiente módulo Mi Perfil
      } else {
        ctx.reanudarDespuesDeNavegar();
      }
    });
  });
  el.querySelector('[data-vh-comentario-like]').addEventListener('click', () => {
    ctx.toggleLikeComentario(c.id, c.yo_di_like_comentario);
  });
}

// ═══════════════════════════════════════════════════════════════
// HELPERS LOCALES
// ═══════════════════════════════════════════════════════════════

export function tiempoTranscurrido(fechaStr) {
  if (!fechaStr) return '';
  const fecha = new Date(fechaStr);
  if (Number.isNaN(fecha.getTime())) return '';
  const diffMs = Date.now() - fecha.getTime();
  const min = Math.floor(diffMs / 60000);
  const horas = Math.floor(diffMs / 3600000);
  const dias = Math.floor(diffMs / 86400000);
  if (diffMs / 1000 < 60) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  if (horas < 24) return `hace ${horas} h`;
  if (dias < 7) return `hace ${dias} d`;
  return `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
}

export function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}