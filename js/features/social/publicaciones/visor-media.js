// visor-media.js
// Ruta real sugerida: js/features/social/publicaciones/visor-media.js
//
// Puerto de visor_media.dart. Pantalla a pantalla completa para ver
// los medios (fotos/video) de una publicación: swipe horizontal
// entre medios, zoom en imágenes con doble tap, reproducción de
// video con controles propios, arrastre vertical para cerrar, y una
// barra inferior con reacción/comentarios/ver reacciones que
// reutiliza las hojas ya portadas (hoja-comentarios.js,
// hoja-reacciones.js).
//
// Se abre desde tarjeta-publicacion.js (onMedioTap, al tocar una
// celda de la galería), pasándole los mismos datos que en el Dart
// original: medios, índice inicial, post, reacción/likes/comentarios
// iniciales y el callback de reaccionar.
//
// DIFERENCIA DE PLATAFORMA — PageView → scroll-snap: el Dart original
// usa un PageView.builder para el swipe entre medios. En web se logra
// con un contenedor flex de ancho 100%×n con overflow-x:auto y
// scroll-snap-type:x mandatory — cada "página" ocupa el 100% del
// ancho visible y el navegador maneja el gesto de swipe de forma
// nativa. El índice actual se detecta con un IntersectionObserver
// sobre cada página, en vez de escuchar a un PageController.
//
// DIFERENCIA DE PLATAFORMA — zoom de imagen: el Dart original usa
// InteractiveViewer (pellizco libre con dos dedos + doble-tap
// animado hacia el punto tocado). Aquí solo se porta el doble-tap
// (alterna 1×/2.5× con transform-origin en el punto tocado) — el
// pellizco libre con dos dedos queda pendiente, documentado aquí
// mismo, si en pruebas reales hace falta.
//
// DIFERENCIA DE PLATAFORMA — swipe horizontal + arrastre vertical al
// mismo tiempo: el listener de arrastre-para-cerrar se registra con
// { passive: true } (necesario para no bloquear el scroll-snap
// nativo), así que no puede cancelar el scroll horizontal con
// preventDefault. Se distingue el gesto por dirección predominante
// (ver iniciarArrastre/moverArrastre más abajo), pero si en pruebas
// reales un swipe diagonal dispara ambos gestos a la vez, es el
// punto a revisar primero.
//
// DIFERENCIA DE PLATAFORMA — pausar video al ir al perfil: este
// visor es un overlay independiente del router (mismo patrón que
// tp-opciones-overlay/feed-hoja-overlay en tarjeta-publicacion.css),
// no una ruta empujada encima de otra como en Flutter. Se pausa el
// video antes de navegar al perfil del autor por si el usuario cierra
// el visor después, pero no existe un "onAlRegresar" real — el
// router de hash no tiene concepto de "volver" a una pantalla
// anterior. AVISAR si esto no es el comportamiento esperado una vez
// exista el módulo Mi Perfil real.
//
// Usa:
//   - js/core/router.js para navegar al perfil del autor.
//   - js/core/perfil-utils.js para resolver URLs de perfil/medio.
//   - tarjeta-publicaciones/reacciones.js para el botón de reacción.
//   - tarjeta-publicaciones/hoja-comentarios.js y hoja-reacciones.js
//     para las hojas que abre la barra inferior.

import { supabaseClient } from '../../../core/supabase-client.js';
import { navegarA } from '../../../core/router.js';
import { resolverUrlPerfil, resolverUrlMedio } from '../../../core/perfil-utils.js';
import { montarBotonReaccion } from './tarjeta-publicaciones/reacciones.js';
import { abrirHojaComentarios } from './tarjeta-publicaciones/hoja-comentarios.js';
import { abrirHojaConReacciones } from './tarjeta-publicaciones/hoja-reacciones.js';

const UMBRAL_CERRAR_PX = 120;

/**
 * Abre el visor de medios a pantalla completa.
 *
 * @param {Object} opciones
 * @param {Array<Object>} opciones.medios - filas de publicacion_medios (con tipo_medio, url/cdn_url).
 * @param {number} [opciones.indiceInicial]
 * @param {?Object} [opciones.post] - fila de publicaciones con 'perfiles' embebido, para la barra inferior.
 * @param {?string} [opciones.reaccionInicial]
 * @param {number} [opciones.totalLikes]
 * @param {number} [opciones.totalComentarios]
 * @param {?(tipo: ?string) => Promise<void>} [opciones.onReaccionar] - si no se da, la barra inferior muestra un corazón estático (igual que en el Dart original).
 * @param {?string} [opciones.uid]
 * @param {?Function} [opciones.onMiPerfilTap]
 */
export function abrirVisorMedia({
  medios,
  indiceInicial = 0,
  post = null,
  reaccionInicial = null,
  totalLikes = 0,
  totalComentarios = 0,
  onReaccionar = null,
  uid = null,
  onMiPerfilTap = null,
}) {
  const total = medios.length;
  if (total === 0) return;

  let indiceActual = indiceInicial;
  let miReaccion = reaccionInicial;
  let likesActuales = totalLikes;
  let overlayVisible = true;

  const overlay = document.createElement('div');
  overlay.className = 'visor-media-overlay';
  overlay.innerHTML = `
    <div class="visor-media" data-vm-panel>
      <div class="visor-media__paginas" data-vm-paginas>
        ${medios.map((medio, indice) => renderPagina(medio, indice)).join('')}
      </div>
      <div class="visor-media__barra-superior" data-vm-barra-superior>
        <button class="visor-media__cerrar" data-vm-cerrar aria-label="Cerrar">✕</button>
        ${total > 1 ? `<span class="visor-media__contador" data-vm-contador>${indiceActual + 1} / ${total}</span>` : ''}
      </div>
      ${post ? renderBarraInferior(post, totalComentarios) : ''}
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden'; // evita el scroll de fondo mientras el visor está abierto
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const elPanel = overlay.querySelector('[data-vm-panel]');
  const elPaginas = overlay.querySelector('[data-vm-paginas]');
  const elBarraSuperior = overlay.querySelector('[data-vm-barra-superior]');
  const elBarraInferior = overlay.querySelector('.visor-media__barra-inferior');
  const elContador = overlay.querySelector('[data-vm-contador]');

  // Salta a la página inicial sin animación antes de que el usuario
  // vea el visor (equivalente a PageController(initialPage: ...)).
  if (indiceInicial > 0) {
    requestAnimationFrame(() => {
      elPaginas.scrollLeft = indiceInicial * elPaginas.clientWidth;
    });
  }
  reproducirVideoDe(indiceActual);

  // ── Cerrar ──────────────────────────────────────────────────

  function cerrar() {
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
    overlay.querySelectorAll('video').forEach((v) => v.pause());
    observer.disconnect();
    document.removeEventListener('keydown', alPresionarTecla);
    setTimeout(() => overlay.remove(), 200);
  }

  function alPresionarTecla(evento) {
    if (evento.key === 'Escape') cerrar();
  }

  overlay.querySelector('[data-vm-cerrar]').addEventListener('click', cerrar);
  document.addEventListener('keydown', alPresionarTecla);

  // ── Índice actual — IntersectionObserver sobre cada página ────

  const observer = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (entrada.intersectionRatio > 0.5) {
          const idx = Number(entrada.target.dataset.idx);
          if (idx !== indiceActual) cambiarIndice(idx);
        }
      });
    },
    { root: elPaginas, threshold: 0.5 }
  );
  elPaginas.querySelectorAll('.visor-media__pagina').forEach((el) => observer.observe(el));

  function cambiarIndice(nuevo) {
    pausarVideoDe(indiceActual);
    indiceActual = nuevo;
    if (elContador) elContador.textContent = `${indiceActual + 1} / ${total}`;
    reproducirVideoDe(indiceActual);
  }

  function pausarVideoDe(indice) {
    overlay.querySelector(`.visor-media__pagina[data-idx="${indice}"] video`)?.pause();
  }

  function reproducirVideoDe(indice) {
    overlay.querySelector(`.visor-media__pagina[data-idx="${indice}"] video`)?.play().catch(() => {});
  }

  // ── Mostrar/ocultar barras al tocar el medio ───────────────────

  function alternarOverlay() {
    overlayVisible = !overlayVisible;
    elBarraSuperior.classList.toggle('visor-media__barra-superior--oculta', !overlayVisible);
    elBarraInferior?.classList.toggle('visor-media__barra-inferior--oculta', !overlayVisible);
  }

  elPaginas.querySelectorAll('.visor-media__pagina').forEach((pagina) => {
    pagina.addEventListener('click', (evento) => {
      // Los controles propios de cada página (play/pausa, barra de
      // progreso) marcan data-no-alternar para no disparar esto.
      if (evento.target.closest('[data-no-alternar]')) return;
      alternarOverlay();
    });
  });

  // ── Zoom de imagen (doble tap/click) ──────────────────────────

  elPaginas.querySelectorAll('.visor-media__img').forEach((img) => {
    let ultimoTap = 0;
    img.addEventListener('click', (evento) => {
      const ahora = Date.now();
      if (ahora - ultimoTap < 300) {
        const rect = img.getBoundingClientRect();
        const px = ((evento.clientX - rect.left) / rect.width) * 100;
        const py = ((evento.clientY - rect.top) / rect.height) * 100;
        const ampliada = img.classList.toggle('visor-media__img--zoom');
        img.style.transformOrigin = ampliada ? `${px}% ${py}%` : 'center';
      }
      ultimoTap = ahora;
    });
  });

  // ── Video: play/pausa propio y barra de progreso ──────────────

  elPaginas.querySelectorAll('.visor-media__pagina').forEach((pagina) => {
    const video = pagina.querySelector('video');
    if (!video) return;
    activarControlesDeVideo(pagina, video);
  });

  // ── Arrastre vertical para cerrar ─────────────────────────────
  // Ver nota de DIFERENCIA DE PLATAFORMA al inicio del archivo sobre
  // por qué esto convive con { passive: true }.

  let arrastreInicioX = null;
  let arrastreInicioY = null;
  let arrastreActivo = false;
  let arrastreOffset = 0;

  elPaginas.addEventListener('touchstart', iniciarArrastre, { passive: true });
  elPaginas.addEventListener('touchmove', moverArrastre, { passive: true });
  elPaginas.addEventListener('touchend', terminarArrastre);

  function iniciarArrastre(evento) {
    if (evento.touches.length !== 1) return;
    arrastreInicioX = evento.touches[0].clientX;
    arrastreInicioY = evento.touches[0].clientY;
    arrastreActivo = false;
  }

  function moverArrastre(evento) {
    if (arrastreInicioY == null) return;
    const dx = evento.touches[0].clientX - arrastreInicioX;
    const dy = evento.touches[0].clientY - arrastreInicioY;

    if (!arrastreActivo) {
      if (Math.abs(dx) > Math.abs(dy)) {
        // Gesto predominantemente horizontal → lo maneja el
        // scroll-snap nativo, no es un arrastre para cerrar.
        arrastreInicioY = null;
        return;
      }
      if (dy > 8) arrastreActivo = true;
    }

    if (arrastreActivo && dy > 0) {
      arrastreOffset = Math.min(dy, 300);
      elPanel.style.transition = 'none';
      elPanel.style.transform = `translateY(${arrastreOffset}px)`;
      overlay.style.transition = 'none';
      overlay.style.opacity = String(Math.max(0, 1 - arrastreOffset / 250));
    }
  }

  function terminarArrastre() {
    elPanel.style.transition = '';
    overlay.style.transition = '';
    if (arrastreActivo && arrastreOffset > UMBRAL_CERRAR_PX) {
      cerrar();
    } else if (arrastreActivo) {
      elPanel.style.transform = '';
      overlay.style.opacity = '';
    }
    arrastreInicioX = null;
    arrastreInicioY = null;
    arrastreActivo = false;
    arrastreOffset = 0;
  }

  // ── Barra inferior: reacción, comentar, ver reacciones, autor ──

  if (post && elBarraInferior) {
    const elReaccionSlot = elBarraInferior.querySelector('[data-vm-reaccion-slot]');
    const elComentarBtn = elBarraInferior.querySelector('[data-vm-comentar]');
    const elReaccionesBtn = elBarraInferior.querySelector('[data-vm-ver-reacciones]');
    const elAutor = elBarraInferior.querySelector('[data-vm-autor]');

    montarReaccion();

    function montarReaccion() {
      if (!elReaccionSlot) return;
      if (onReaccionar) {
        montarBotonReaccion(elReaccionSlot, {
          reaccionActual: miReaccion,
          onSeleccionar: reaccionar,
          label: likesActuales > 0 ? likesActuales : null,
          tamano: 'normal',
        });
      } else {
        // Sin callback de reaccionar, mismo criterio del Dart
        // original: un corazón estático en vez del selector completo.
        elReaccionSlot.innerHTML = `
          <span class="visor-media__pill visor-media__pill--estatico">
            ${miReaccion ? '❤️' : '🤍'}${likesActuales > 0 ? ` ${likesActuales}` : ''}
          </span>
        `;
      }
    }

    async function reaccionar(tipo) {
      const antes = miReaccion;
      if (antes == null && tipo != null) likesActuales += 1;
      if (antes != null && tipo == null) likesActuales -= 1;
      miReaccion = tipo;
      montarReaccion();
      try {
        await onReaccionar(tipo);
      } catch (error) {
        console.error('visor-media – reaccionar:', error);
        if (antes == null && tipo != null) likesActuales -= 1;
        if (antes != null && tipo == null) likesActuales += 1;
        miReaccion = antes;
        montarReaccion();
      }
    }

    elComentarBtn?.addEventListener('click', () => {
      abrirHojaComentarios({ post, isDark: true, uid, onMiPerfilTap });
    });

    // Vuelve a consultar la lista completa (con perfiles embebidos)
    // antes de abrir la hoja — mismo criterio ya usado en
    // tarjeta-publicacion.js (mostrarReacciones).
    elReaccionesBtn?.addEventListener('click', async () => {
      if (!post?.id) return;
      try {
        const { data, error } = await supabaseClient
          .from('reacciones')
          .select('usuario_id, tipo, perfiles!reacciones_usuario_id_fkey(id, nombre, nombre_usuario, cdn_foto_perfil)')
          .eq('publicacion_id', post.id);
        if (error) throw error;

        const reacciones = data ?? [];
        if (reacciones.length !== likesActuales) {
          likesActuales = reacciones.length;
          montarReaccion();
        }
        abrirHojaConReacciones({ reacciones, isDark: true, totalLikes: reacciones.length, uid, onMiPerfilTap });
      } catch (error) {
        console.error('visor-media – mostrarReacciones:', error);
      }
    });

    elAutor?.addEventListener('click', () => {
      const autorId = post.autor_id ?? '';
      const esPropio = autorId === uid;
      overlay.querySelectorAll('video').forEach((v) => v.pause()); // ver nota de DIFERENCIA DE PLATAFORMA arriba
      if (esPropio) {
        if (onMiPerfilTap) onMiPerfilTap();
        else navegarA('/perfil/editar'); // TODO: pendiente módulo Mi Perfil
      } else if (autorId) {
        navegarA(`/perfil-publico/${autorId}`); // TODO: pendiente módulo Mi Perfil
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// CONTROLES DE VIDEO — play/pausa, barra de progreso, tiempos
// ═══════════════════════════════════════════════════════════════

function activarControlesDeVideo(pagina, video) {
  const botonPlay = pagina.querySelector('[data-vm-play]');
  const slider = pagina.querySelector('[data-vm-slider]');
  const elTiempoActual = pagina.querySelector('[data-vm-tiempo-actual]');
  const elTiempoTotal = pagina.querySelector('[data-vm-tiempo-total]');

  function actualizarIconoPlay() {
    botonPlay.textContent = video.paused ? '▶️' : '⏸️';
  }

  botonPlay.addEventListener('click', (evento) => {
    evento.stopPropagation();
    video.paused ? video.play() : video.pause();
  });
  video.addEventListener('play', actualizarIconoPlay);
  video.addEventListener('pause', actualizarIconoPlay);

  video.addEventListener('loadedmetadata', () => {
    if (elTiempoTotal) elTiempoTotal.textContent = formatearTiempo(video.duration);
    if (slider) slider.max = String(Math.floor(video.duration * 1000));
  });

  video.addEventListener('timeupdate', () => {
    if (elTiempoActual) elTiempoActual.textContent = formatearTiempo(video.currentTime);
    if (slider && !slider.dataset.arrastrando) slider.value = String(Math.floor(video.currentTime * 1000));
  });

  if (slider) {
    slider.addEventListener('pointerdown', () => {
      slider.dataset.arrastrando = '1';
    });
    slider.addEventListener('change', () => {
      video.currentTime = Number(slider.value) / 1000;
      delete slider.dataset.arrastrando;
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════════

function renderPagina(medio, indice) {
  const url = resolverUrlMedio(medio);
  const esVideo = medio.tipo_medio === 'video';

  if (esVideo) {
    return `
      <div class="visor-media__pagina" data-idx="${indice}">
        <video class="visor-media__video" src="${url}" playsinline preload="metadata"></video>
        <div class="visor-media__video-controles" data-no-alternar>
          <button class="visor-media__video-play" data-vm-play data-no-alternar aria-label="Reproducir/Pausar">▶️</button>
          <div class="visor-media__video-barra">
            <input type="range" class="visor-media__video-slider" data-vm-slider data-no-alternar min="0" max="1000" value="0" />
            <div class="visor-media__video-tiempos">
              <span data-vm-tiempo-actual>0:00</span>
              <span data-vm-tiempo-total>0:00</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="visor-media__pagina" data-idx="${indice}">
      <img class="visor-media__img" src="${url}" alt="" />
    </div>
  `;
}

function renderBarraInferior(post, totalComentarios) {
  const perfil = post.perfiles ?? {};
  const fotoUrl = resolverUrlPerfil(perfil);
  const tiempo = tiempoRelativo(post.creado_en);
  const contenido = post.contenido ?? '';

  return `
    <div class="visor-media__barra-inferior" data-no-alternar>
      <div class="visor-media__autor" data-vm-autor>
        <div class="visor-media__autor-avatar">
          ${fotoUrl ? `<img src="${fotoUrl}" alt="" />` : '<span>👤</span>'}
        </div>
        <div class="visor-media__autor-info">
          <p class="visor-media__autor-nombre">${escaparHtml(perfil.nombre ?? '')}</p>
          <p class="visor-media__autor-meta">@${escaparHtml(perfil.nombre_usuario ?? '')} · ${tiempo}</p>
        </div>
      </div>
      ${contenido ? `<p class="visor-media__texto">${escaparHtml(contenido)}</p>` : ''}
      <div class="visor-media__acciones">
        <span class="visor-media__reaccion-slot" data-vm-reaccion-slot></span>
        <button class="visor-media__pill" data-vm-comentar>💬${totalComentarios > 0 ? ` ${totalComentarios}` : ''}</button>
        <span class="visor-media__spacer"></span>
        <button class="visor-media__pill" data-vm-ver-reacciones>👥</button>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// HELPERS LOCALES
// ═══════════════════════════════════════════════════════════════

function formatearTiempo(segundosTotales) {
  if (!Number.isFinite(segundosTotales) || segundosTotales < 0) return '0:00';
  const horas = Math.floor(segundosTotales / 3600);
  const minutos = Math.floor((segundosTotales % 3600) / 60);
  const segundos = Math.floor(segundosTotales % 60).toString().padStart(2, '0');
  if (horas > 0) return `${horas}:${minutos.toString().padStart(2, '0')}:${segundos}`;
  return `${minutos}:${segundos}`;
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function tiempoRelativo(fechaStr) {
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