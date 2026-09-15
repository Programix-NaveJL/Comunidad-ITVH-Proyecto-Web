// publicar-historia.js
// Ruta real: js/features/social/historias/publicar-historia.js
//
// Puerto de PublicarHistoria.dart. Pantalla de subida y publicación
// de una historia, con límite diario de 3 publicaciones por usuario
// (ventana rodante de 24h, validado ANTES de subir cualquier archivo
// para no gastar ancho de banda en una subida que de todos modos
// sería rechazada). La validación es solo de cliente — igual que en
// Dart, blindarla del todo requiere un trigger/policy en Postgres.
//
// Dos puntos de entrada, igual que los dos constructores del Dart
// original:
//   • abrirPublicarHistoria({archivo, ...}) — imagen o video ya
//     elegido. Es el que usa seleccionar-media.js hoy.
//   • abrirPublicarHistoriaAudioConFondo({audioBlob, coloresFondo})
//     — historia de "Audio" (voz + fondo). Sin caller todavía
//     (HistoriasAudio no se ha portado) — listo para cuando exista.
//
// Ambos comparten el mismo overlay de estados (subiendo/éxito/error/
// límite alcanzado) vía ejecutarFlujoPublicacion(), igual que el
// Dart comparte un solo _EstadoPublicacion entre sus dos
// constructores.
//
// Al publicar con éxito se dispara un CustomEvent 'historia:publicada'
// en window — mismo criterio que 'publicacion:creada' en
// crear-publicacion.js: como historias-texto.js (y cualquier otro
// hub futuro) navega a su propia ruta en vez de vivir dentro del
// overlay de seleccionar-media.js, no hay un valor de retorno de
// navegación que le avise al feed que debe refrescar el carrusel de
// historias. pantalla-principal.js escucha este evento para volver a
// llamar cargarStories().
//
// DEPENDENCIA PENDIENTE — ServicioMusica: si se pasa trackElegido,
// se asume que ya viene con las columnas exactas que espera la
// tabla 'historias' (equivalente a trackElegido.toSupabaseMap() en
// Dart) — no se ha portado ServicioMusica/pista_musical.dart
// todavía, así que no se puede confirmar esa forma aquí.
//
// Pantalla de fondo negro fijo, igual que seleccionar-media.js (el
// Dart original también usa Colors.black sin importar el tema).

import { supabaseClient } from '../../../core/supabase-client.js';
import { storageService } from '../../../core/storage-service.js';

const MAX_HISTORIAS_DIA = 3;
const EXTENSIONES_VIDEO = ['mp4', 'mov', 'avi', 'mkv'];

function esVideo(archivo, extension) {
  const tipo = (archivo?.type || '').toLowerCase();
  if (tipo) return tipo.startsWith('video/');
  return EXTENSIONES_VIDEO.includes((extension || '').toLowerCase().replace('.', ''));
}

/**
 * Cuenta cuántas historias publicó el usuario en las últimas 24h
 * (ventana rodante) y devuelve true si todavía puede publicar otra.
 */
async function puedePublicarHoy(uid) {
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseClient
    .from('historias')
    .select('id')
    .eq('autor_id', uid)
    .gte('creado_en', hace24h);
  if (error) throw error;
  return (data ?? []).length < MAX_HISTORIAS_DIA;
}

/**
 * Publica una historia a partir de una imagen o video ya elegido
 * (por ejemplo, desde el <input type="file"> de seleccionar-media.js).
 * Equivalente al constructor por defecto de PublicarHistoriaScreen.
 *
 * @param {Object} opciones
 * @param {File|Blob} opciones.archivo
 * @param {Object} [opciones.trackElegido] - ver nota de dependencia pendiente al inicio del archivo.
 * @param {number} [opciones.trackInicioMs]
 * @param {number} [opciones.videoInicioMs]
 * @param {number} [opciones.videoFinMs]
 * @returns {Promise<boolean>} true si se publicó.
 */
export function abrirPublicarHistoria({
  archivo,
  trackElegido = null,
  trackInicioMs = 0,
  videoInicioMs = null,
  videoFinMs = null,
} = {}) {
  const extension = (archivo?.name?.split('.').pop() ?? '').toLowerCase();
  const tipoVideo = esVideo(archivo, extension);

  return ejecutarFlujoPublicacion({
    trackElegido,
    trackInicioMs,
    videoInicioMs,
    async subir(uid, onProgress) {
      const cdnUrl = await storageService.subirHistoriaDesdeBytes({
        blob: archivo,
        extension,
        userId: uid,
        onProgress: tipoVideo ? onProgress : null,
      });
      return { cdnUrl, tipo: tipoVideo ? 'video' : 'imagen', videoFinMs: videoFinMs ?? 15000 };
    },
  });
}

/**
 * Publica una historia de "Audio": una grabación de voz sobre un
 * fondo de color/degradado. Equivalente al constructor
 * `.audioConFondo()` de PublicarHistoriaScreen.
 *
 * @param {Object} opciones
 * @param {Blob} opciones.audioBlob
 * @param {string[]} opciones.coloresFondo
 * @returns {Promise<boolean>} true si se publicó.
 */
export function abrirPublicarHistoriaAudioConFondo({ audioBlob, coloresFondo } = {}) {
  return ejecutarFlujoPublicacion({
    trackElegido: null,
    trackInicioMs: 0,
    videoInicioMs: 0,
    async subir(uid, onProgress) {
      const { url, duracionMs } = await storageService.subirHistoriaAudioConFondo({
        audioBlob,
        coloresFondo,
        userId: uid,
        onProgress,
      });
      return { cdnUrl: url, tipo: 'video', videoFinMs: duracionMs };
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// FLUJO COMPARTIDO — overlay de estados (subiendo/éxito/error/límite)
// ═══════════════════════════════════════════════════════════════

function ejecutarFlujoPublicacion({ subir, trackElegido, trackInicioMs, videoInicioMs }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'publicar-historia-overlay';
    overlay.innerHTML = `
      <div class="publicar-historia">
        <div class="publicar-historia__contenido" data-contenido></div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const contenido = overlay.querySelector('[data-contenido]');

    function cerrar(resultado) {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 200);
      resolve(resultado);
    }

    function pintarSubiendo(progresoPct) {
      contenido.innerHTML = `
        <div class="publicar-historia__spinner"></div>
        <p class="publicar-historia__mensaje">
          ${progresoPct != null ? `Procesando... ${progresoPct.toFixed(0)}%` : 'Publicando tu historia...'}
        </p>
        ${
          progresoPct != null
            ? `<div class="publicar-historia__barra"><div class="publicar-historia__barra-relleno" style="width:${Math.min(100, progresoPct)}%"></div></div>`
            : ''
        }
        ${
          trackElegido
            ? `<p class="publicar-historia__track">🎵 ${escaparHtml(trackElegido.titulo ?? '')} · ${escaparHtml(trackElegido.artista ?? '')}</p>`
            : progresoPct == null
              ? `<p class="publicar-historia__submensaje">Esto solo tomará un momento</p>`
              : ''
        }
      `;
    }

    function pintarExitoso() {
      contenido.innerHTML = `
        <div class="publicar-historia__icono publicar-historia__icono--exito">✓</div>
        <p class="publicar-historia__titulo">¡Historia publicada!</p>
        <p class="publicar-historia__submensaje">Ya está visible para tus seguidores</p>
      `;
    }

    function pintarLimite() {
      contenido.innerHTML = `
        <div class="publicar-historia__icono publicar-historia__icono--limite">⏳</div>
        <p class="publicar-historia__titulo">Límite diario alcanzado</p>
        <p class="publicar-historia__submensaje">
          Ya publicaste ${MAX_HISTORIAS_DIA} historias en las últimas 24 horas. Intenta de nuevo más tarde.
        </p>
        <button class="publicar-historia__btn" data-entendido>Entendido</button>
      `;
      contenido.querySelector('[data-entendido]').addEventListener('click', () => cerrar(false));
    }

    function pintarError(mensaje) {
      contenido.innerHTML = `
        <div class="publicar-historia__icono publicar-historia__icono--error">✕</div>
        <p class="publicar-historia__titulo">No se pudo publicar</p>
        <p class="publicar-historia__submensaje">${escaparHtml(mensaje)}</p>
        <button class="publicar-historia__btn" data-reintentar>Reintentar</button>
        <button class="publicar-historia__btn-texto" data-cancelar>Cancelar</button>
      `;
      contenido.querySelector('[data-reintentar]').addEventListener('click', publicar);
      contenido.querySelector('[data-cancelar]').addEventListener('click', () => cerrar(false));
    }

    async function publicar() {
      pintarSubiendo(null);
      try {
        const { data } = await supabaseClient.auth.getUser();
        const uid = data?.user?.id ?? null;
        if (!uid) {
          pintarError('No hay sesión activa');
          return;
        }

        const puede = await puedePublicarHoy(uid);
        if (!puede) {
          pintarLimite();
          return;
        }

        const { cdnUrl, tipo, videoFinMs } = await subir(uid, (pct) => pintarSubiendo(pct));

        const payload = { autor_id: uid, media_url: cdnUrl, cdn_url: cdnUrl, tipo };
        if (tipo === 'video') {
          payload.video_inicio_ms = videoInicioMs ?? 0;
          payload.video_fin_ms = videoFinMs ?? 15000;
        }
        if (trackElegido) {
          // Ver nota de DEPENDENCIA PENDIENTE al inicio del archivo.
          Object.assign(payload, trackElegido);
          payload.track_inicio_ms = trackInicioMs;
        }

        const { error } = await supabaseClient.from('historias').insert(payload);
        if (error) throw error;

        pintarExitoso();
        // Web-equivalente de que quien llamó a Navigator.push() se
        // entere del resultado: como "Texto" (y cualquier otro hub)
        // vive en su propia ruta en vez de dentro del overlay de
        // seleccionar-media.js, no hay un valor de retorno de
        // navegación que le avise al feed — pantalla-principal.js
        // escucha este evento para refrescar el carrusel de historias.
        window.dispatchEvent(new CustomEvent('historia:publicada'));
        await new Promise((r) => setTimeout(r, 800));
        cerrar(true);
      } catch (error) {
        console.error('publicar-historia:', error);
        pintarError(error.message ?? 'Error al publicar la historia');
      }
    }

    publicar();
  });
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}