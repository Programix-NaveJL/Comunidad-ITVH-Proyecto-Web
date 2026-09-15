// storage-service.js
//
// Puerto de storage_service.dart. Servicio centralizado para subir
// y eliminar archivos en Cloudflare R2 vía las mismas Edge
// Functions que ya usa la app móvil (generar-url-subida,
// eliminar-objeto-r2) — este archivo nunca conoce credenciales de
// R2, solo el token de sesión de Supabase del usuario autenticado.
//
// DIFERENCIAS DE PLATAFORMA respecto al Dart original (marcadas
// explícitamente, avisar si alguna necesita revisarse):
//
//   1. COMPRESIÓN DE IMAGEN: flutter_image_compress se reemplaza
//      por un pipeline con <canvas> (createImageBitmap → dibujar a
//      escala reducida → toBlob('image/jpeg', calidad)). Mismo
//      resultado práctico (JPEG recomprimido, redimensionado si el
//      lado mayor excede minAncho), sin dependencias externas.
//
//   2. COMPRESIÓN DE VIDEO: el Dart original usa FFmpeg (libx264 +
//      AAC) para recomprimir video. NO hay equivalente en un
//      navegador estándar sin cargar un WASM pesado (ffmpeg.wasm,
//      varios MB y notablemente más lento que el binario nativo).
//      Por ahora, todo video se sube TAL CUAL viene del picker/
//      cámara, sin recomprimir — es una limitación real de la
//      plataforma, no un descuido. Si el consumo de banda ancha/
//      almacenamiento de video sin comprimir se vuelve un problema,
//      la opción a evaluar sería integrar ffmpeg.wasm específicamente
//      para ese caso.
//
//   3. PROGRESO DE SUBIDA: fetch() no expone progreso de subida, así
//      que el PUT a la URL prefirmada usa XMLHttpRequest en su lugar
//      (vía subirViaPresignedUrl), que sí dispara xhr.upload.onprogress.
//
//   4. HISTORIA DE AUDIO (subirHistoriaAudioConFondo) — SIN FFmpeg
//      no hay forma de muxear audio+fondo+ecualizador como hace el
//      Dart original (filtro showfreqs). El equivalente web:
//        • El fondo se genera con <canvas> (sólido o degradado),
//          igual que el Dart.
//        • El mux se resuelve con canvas.captureStream() + Web Audio
//          API (MediaElementAudioSourceNode → MediaStreamAudioDestinationNode,
//          SIN conectar a las bocinas para que no se escuche mientras
//          se genera) combinados en un MediaStream, grabado con
//          MediaRecorder. Esto graba en TIEMPO REAL — tarda lo mismo
//          que dura el audio, no hay forma de acelerarlo sin FFmpeg.
//        • SÍ tiene onda de voz animada horneada en el video final
//          (no el ecualizador de barras de frecuencia tipo showfreqs
//          del Dart, sino una onda de amplitud estilo WhatsApp,
//          consistente con la que ya se ve en historias-audio.js
//          mientras se graba): un AnalyserNode lee la REPRODUCCIÓN
//          del audio durante el mux (no el micrófono, ya terminó de
//          grabarse) y el canvas se redibuja en cada frame vía
//          requestAnimationFrame — fondo + barras — sincronizado con
//          el propio audio que se está grabando al video. El filtro
//          showfreqs de frecuencia real (FFT visual) sí queda fuera
//          de alcance sin FFmpeg; esta es una onda de amplitud, más
//          simple pero con el mismo espíritu visual.
//        • El archivo resultante es .webm (VP9/Opus), NO .mp4 —
//          MediaRecorder no genera MP4 de forma confiable entre
//          navegadores. ver-historias.js (aún no portado) debe poder
//          reproducir .webm además de .mp4. Precaución: Safari/iOS
//          tiene soporte débil de WebM; si se necesita compatibilidad
//          total ahí, la única alternativa real sería ffmpeg.wasm.
//        • El Content-Type que se manda a generar-url-subida se
//          SANITIZA quitando el sufijo ";codecs=..." que agrega
//          MediaRecorder (ej. "video/webm;codecs=vp9,opus" →
//          "video/webm") — la whitelist de la Edge Function compara
//          con coincidencia exacta de string, y ese sufijo nunca
//          matchearía. El Blob conserva su tipo completo para
//          reproducción local; solo se sanitiza lo que viaja en la
//          petición HTTP.
//
//   5. MÉTODOS PORTADOS AHORA vs. PENDIENTES: además de
//      subirFotoPerfil, subirMediaPublicacion y eliminarDeR2, ya se
//      portaron subirHistoriaDesdeBytes, subirHistoriaAudioConFondo,
//      subirImagenMarketplace, subirImagenChat, subirStickerChat,
//      subirAudioChat y — NUEVO — subirImagenCosaPerdida (para el
//      módulo Cosas perdidas de JaguarChat). A diferencia del Dart
//      original, que implementa su propio mini-cliente de R2 dentro
//      de cosas_perdidas_screen.dart (_subirR2 + _R2Helper) en vez
//      de usar StorageService, la versión web SÍ centraliza esa
//      subida aquí — mismo resultado en el wire (JPEG comprimido +
//      URL prefirmada), código más DRY del lado web. Para eliminar
//      la imagen de un reporte se reutiliza el eliminarDeR2()
//      genérico ya existente, con bucket: R2_CONFIG.bucketCosasPerdidas.
//      subirVideoChat / subirDocumentoChat siguen sin portar — el
//      composer del chat tampoco los usa todavía del lado móvil.

import { supabaseClient } from './supabase-client.js';
import { R2_CONFIG } from './r2-config.js';

const TIMEOUT_BOLETO_MS = 15000;
const TIMEOUT_SUBIDA_MS = 60000;

/**
 * Sube un blob a R2 vía URL prefirmada: pide el "boleto" a la Edge
 * Function generar-url-subida y hace el PUT directo a esa URL con
 * XMLHttpRequest (para poder reportar progreso real de subida).
 *
 * @param {Blob} blob
 * @param {string} bucket
 * @param {string} path
 * @param {string} contentType
 * @param {(pct: number) => void} [onProgress] 0–100
 */
async function subirViaPresignedUrl(blob, bucket, path, contentType, onProgress) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('No hay sesión activa: no se puede subir a R2');

  const uploadUrl = await pedirUrlPrefirmada({ token, bucket, path, contentType, sizeBytes: blob.size });
  await putConProgreso(uploadUrl, blob, contentType, onProgress);
}

function pedirUrlPrefirmada({ token, bucket, path, contentType, sizeBytes }) {
  return new Promise((resolve, reject) => {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_BOLETO_MS);

    fetch(`${R2_CONFIG.edgeFunctionsUrl}/generar-url-subida`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket, path, contentType, sizeBytes }),
      signal: controlador.signal,
    })
      .then(async (res) => {
        clearTimeout(temporizador);
        if (!res.ok) {
          const cuerpo = await res.text().catch(() => '');
          reject(new Error(`Error al generar URL de subida (${res.status}): ${cuerpo}`));
          return;
        }
        const { url } = await res.json();
        resolve(url);
      })
      .catch((error) => {
        clearTimeout(temporizador);
        if (error.name === 'AbortError') {
          reject(new Error(`Tiempo de espera agotado al pedir la URL de subida (bucket=${bucket}, path=${path}).`));
        } else {
          reject(error);
        }
      });
  });
}

function putConProgreso(uploadUrl, blob, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.timeout = TIMEOUT_SUBIDA_MS;

    if (onProgress) {
      xhr.upload.onprogress = (evento) => {
        if (evento.lengthComputable) onProgress((evento.loaded / evento.total) * 100);
      };
    }
    xhr.onload = () => {
      if (xhr.status === 200) resolve();
      else reject(new Error(`Error al subir a R2 (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Error de red al subir a R2'));
    xhr.ontimeout = () => reject(new Error('Tiempo de espera agotado al subir el archivo a R2.'));
    xhr.send(blob);
  });
}

// ─────────────────────────────────────────────────────────────
// COMPRESIÓN — imagen (canvas) / video (sin recomprimir, ver nota
// de plataforma #2 al inicio del archivo)
// ─────────────────────────────────────────────────────────────

/**
 * Recomprime una imagen a JPEG, redimensionando si el lado mayor
 * excede minAncho. Equivalente web de _comprimirImagen en Dart.
 *
 * @param {File|Blob} file
 * @param {{calidad?: number, minAncho?: number}} [opciones] calidad 0–100
 * @returns {Promise<Blob>}
 */
async function comprimirImagen(file, { calidad = 70, minAncho = 1280 } = {}) {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, minAncho / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Error al comprimir imagen'))),
      'image/jpeg',
      calidad / 100
    );
  });
}

/** Lee ancho/alto reales de una imagen sin decodificarla dos veces innecesariamente. */
async function medirDimensiones(blobOImagen) {
  const bitmap = await createImageBitmap(blobOImagen);
  const dim = { ancho: bitmap.width, alto: bitmap.height };
  bitmap.close();
  return dim;
}

function esVideo(archivo) {
  const tipo = (archivo.type || '').toLowerCase();
  if (tipo) return tipo.startsWith('video/');
  const nombre = (archivo.name || '').toLowerCase();
  return ['.mp4', '.mov', '.avi', '.mkv'].some((ext) => nombre.endsWith(ext));
}

// ─────────────────────────────────────────────────────────────
// HISTORIA DE AUDIO — fondo (canvas) + mux (MediaRecorder), ver
// nota de plataforma #4 al inicio del archivo
// ─────────────────────────────────────────────────────────────

/**
 * Dibuja el fondo de una historia de audio en un canvas: sólido si
 * se da un solo color, degradado diagonal si se dan dos o más.
 * Equivalente web de _generarFondoPng en Dart.
 */
function dibujarFondoEnCanvas(canvas, coloresFondo) {
  const ctx = canvas.getContext('2d');
  if (coloresFondo.length > 1) {
    const gradiente = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    const paso = 1 / (coloresFondo.length - 1);
    coloresFondo.forEach((color, i) => gradiente.addColorStop(i * paso, color));
    ctx.fillStyle = gradiente;
  } else {
    ctx.fillStyle = coloresFondo[0];
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Dibuja una fila de barras verticales centradas, estilo onda de voz
 * de WhatsApp, sobre el fondo ya pintado del canvas. `amplitudes` es
 * un arreglo de valores 0–1 (uno por barra); las barras más nuevas
 * van al final del arreglo, como una ventana deslizante.
 */
function dibujarOndaEnCanvas(ctx, amplitudes, anchoCanvas, altoCanvas) {
  const anchoBarra = Math.max(3, Math.round(anchoCanvas * 0.012));
  const espacio = Math.max(3, Math.round(anchoBarra * 0.8));
  const totalAncho = amplitudes.length * (anchoBarra + espacio) - espacio;
  const xInicio = (anchoCanvas - totalAncho) / 2;
  const yCentro = altoCanvas * 0.55; // misma posición aproximada que el mic/onda del editor de grabación
  const altoMax = altoCanvas * 0.12;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  amplitudes.forEach((amp, i) => {
    const alto = Math.max(anchoBarra, amp * altoMax);
    const x = xInicio + i * (anchoBarra + espacio);
    const y = yCentro - alto / 2;
    dibujarRectRedondeado(ctx, x, y, anchoBarra, alto, anchoBarra / 2);
    ctx.fill();
  });
}

function dibujarRectRedondeado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Primer mimeType de video soportado por MediaRecorder en este navegador. */
function elegirMimeTypeSoportado() {
  const candidatos = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return candidatos.find((tipo) => window.MediaRecorder && MediaRecorder.isTypeSupported(tipo)) ?? '';
}

/**
 * Espera a que un <audio> cargado desde un blob reporte su duración
 * real. Workaround de un bug conocido de Chrome: la duración de un
 * <audio>/<video> cargado desde blob puede reportar `Infinity` hasta
 * que se fuerza una búsqueda al final del archivo.
 */
function esperarDuracionReal(audioEl) {
  return new Promise((resolve, reject) => {
    audioEl.addEventListener(
      'loadedmetadata',
      () => {
        if (audioEl.duration === Infinity || Number.isNaN(audioEl.duration)) {
          audioEl.currentTime = 1e101;
          audioEl.addEventListener(
            'timeupdate',
            function alCorregir() {
              audioEl.removeEventListener('timeupdate', alCorregir);
              audioEl.currentTime = 0;
              resolve();
            },
            { once: true }
          );
        } else {
          resolve();
        }
      },
      { once: true }
    );
    audioEl.addEventListener('error', () => reject(new Error('No se pudo leer el audio grabado')), { once: true });
  });
}

/**
 * Genera el video final (fondo estático + audio) grabando en tiempo
 * real con MediaRecorder. Ver nota de plataforma #4 al inicio del
 * archivo para las limitaciones frente al Dart original.
 *
 * @param {Blob} audioBlob
 * @param {string[]} coloresFondo - 1 color = sólido, 2+ = degradado diagonal.
 * @param {{ancho?: number, alto?: number, onProgress?: (pct: number) => void}} [opciones]
 * @returns {Promise<{blob: Blob, duracionMs: number}>}
 */
async function generarVideoAudioConFondo(audioBlob, coloresFondo, { ancho = 720, alto = 1280, onProgress } = {}) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Este navegador no puede grabar video (MediaRecorder no disponible).');
  }

  const FPS_ONDA = 24; // suficiente para que la onda se vea fluida sin gastar CPU de más
  const NUM_BARRAS = 40; // mismo criterio que BARRAS_ESTATICAS en historias-audio.js

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  dibujarFondoEnCanvas(canvas, coloresFondo);
  // A diferencia de un fondo estático (que bastaría con 1 fps), aquí
  // el canvas se redibuja en cada frame con la onda animada — ver
  // el loop dibujarFrame() más abajo — así que captureStream() pide
  // explícitamente FPS_ONDA en vez de dejar que el navegador infiera
  // la tasa de cambios.
  const canvasStream = canvas.captureStream(FPS_ONDA);

  const audioUrl = URL.createObjectURL(audioBlob);
  const audioEl = new Audio(audioUrl);
  await esperarDuracionReal(audioEl);
  const duracionMs = Math.round((audioEl.duration || 0) * 1000);

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const fuente = audioCtx.createMediaElementSource(audioEl);
  const destino = audioCtx.createMediaStreamDestination();
  // Se conecta SOLO al destino de grabación, no a audioCtx.destination,
  // para que el audio no se escuche por las bocinas mientras se genera
  // el video en segundo plano.
  fuente.connect(destino);

  // Segundo tap del mismo nodo fuente, exclusivo para LEER la
  // amplitud y dibujar la onda — tampoco se conecta a las bocinas.
  // Es el mismo patrón de AnalyserNode que historias-audio.js usa
  // mientras graba desde el micrófono, aplicado aquí a la
  // REPRODUCCIÓN del audio ya grabado, durante el mux.
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  const datosAnalyser = new Uint8Array(analyser.frequencyBinCount);
  fuente.connect(analyser);

  const streamCombinado = new MediaStream([...canvasStream.getVideoTracks(), ...destino.stream.getAudioTracks()]);

  const mimeType = elegirMimeTypeSoportado();
  const grabador = new MediaRecorder(streamCombinado, mimeType ? { mimeType } : undefined);
  const partes = [];
  grabador.ondataavailable = (evento) => {
    if (evento.data.size > 0) partes.push(evento.data);
  };

  const finalizado = new Promise((resolve, reject) => {
    grabador.onstop = () => resolve();
    grabador.onerror = (evento) => reject(evento.error ?? new Error('Error al grabar el video'));
  });

  let intervaloProgreso = null;
  if (onProgress && duracionMs > 0) {
    intervaloProgreso = setInterval(() => {
      onProgress(Math.min(100, (audioEl.currentTime / audioEl.duration) * 100));
    }, 200);
  }

  // ── Loop de dibujo: fondo + onda animada por amplitud real ─────
  let dibujando = true;
  const historialAmplitud = new Array(NUM_BARRAS).fill(0.05);

  function leerAmplitud() {
    analyser.getByteTimeDomainData(datosAnalyser);
    let suma = 0;
    for (let i = 0; i < datosAnalyser.length; i++) {
      const v = (datosAnalyser[i] - 128) / 128;
      suma += v * v;
    }
    return Math.min(1, Math.sqrt(suma / datosAnalyser.length) * 4);
  }

  function dibujarFrame() {
    if (!dibujando) return;
    dibujarFondoEnCanvas(canvas, coloresFondo);
    historialAmplitud.push(leerAmplitud());
    historialAmplitud.shift();
    dibujarOndaEnCanvas(ctx, historialAmplitud, canvas.width, canvas.height);
    requestAnimationFrame(dibujarFrame);
  }

  grabador.start();
  requestAnimationFrame(dibujarFrame);
  await audioEl.play();
  await new Promise((resolve) => audioEl.addEventListener('ended', resolve, { once: true }));
  dibujando = false;
  grabador.stop();
  await finalizado;

  if (intervaloProgreso) clearInterval(intervaloProgreso);
  audioCtx.close();
  URL.revokeObjectURL(audioUrl);

  return { blob: new Blob(partes, { type: mimeType || 'video/webm' }), duracionMs };
}

// ─────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────

export const storageService = {
  /**
   * Bucket: itvh-perfil · Path: <userId>/avatar.jpg
   */
  async subirFotoPerfil({ file, userId }) {
    const comprimida = await comprimirImagen(file);
    const path = `${userId}/avatar.jpg`;
    await subirViaPresignedUrl(comprimida, R2_CONFIG.bucketPerfil, path, 'image/jpeg');
    return `${R2_CONFIG.dominioPerfil}/${path}`;
  },

  /**
   * Bucket: itvh-publicaciones · Path: <userId>/<postId>/<orden>.jpg|.mp4
   *
   * Nota: el archivo de video se sube sin recomprimir (ver nota de
   * plataforma #2 al inicio del archivo) — onProgress sí refleja el
   * progreso real de subida en ese caso, igual que en Dart refleja
   * el progreso de compresión+subida.
   */
  async subirMediaPublicacion({ file, postId, userId, orden, onProgress }) {
    if (esVideo(file)) {
      const path = `${userId}/${postId}/${orden}.mp4`;
      await subirViaPresignedUrl(file, R2_CONFIG.bucketPublicaciones, path, 'video/mp4', onProgress);
      return `${R2_CONFIG.dominioPublicaciones}/${path}`;
    }

    const comprimida = await comprimirImagen(file);
    const path = `${userId}/${postId}/${orden}.jpg`;
    await subirViaPresignedUrl(comprimida, R2_CONFIG.bucketPublicaciones, path, 'image/jpeg');
    return `${R2_CONFIG.dominioPublicaciones}/${path}`;
  },

  /**
   * Bucket: itvh-historias · Path: <userId>/<timestamp>.jpg|.mp4
   *
   * Equivalente web de subirHistoriaDesdeBytes en Dart. En el Dart
   * original esta variante existía para el caso en el que la media
   * ya vive en memoria (Uint8List) en vez de en un File — en el
   * navegador un File/Blob YA es esa misma cosa, así que no hace
   * falta la indirección de escribir un archivo temporal que hacía
   * el Dart antes de llamar a subirHistoria().
   *
   * Nota: el video se sube sin recomprimir (ver nota de plataforma
   * #2 al inicio del archivo).
   *
   * @param {Object} args
   * @param {File|Blob} args.blob
   * @param {string} args.extension - sin punto (ej. 'jpg', 'mp4').
   * @param {string} args.userId
   * @param {(pct: number) => void} [args.onProgress]
   */
  async subirHistoriaDesdeBytes({ blob, extension, userId, onProgress }) {
    const ext = (extension || '').toLowerCase().replace('.', '');
    const ts = Date.now();
    const tipoVideo = esVideo(blob) || ['mp4', 'mov', 'avi', 'mkv'].includes(ext);

    if (tipoVideo) {
      const path = `${userId}/${ts}.mp4`;
      await subirViaPresignedUrl(blob, R2_CONFIG.bucketHistorias, path, 'video/mp4', onProgress);
      return `${R2_CONFIG.dominioHistorias}/${path}`;
    }

    const comprimida = await comprimirImagen(blob);
    const path = `${userId}/${ts}.jpg`;
    await subirViaPresignedUrl(comprimida, R2_CONFIG.bucketHistorias, path, 'image/jpeg');
    return `${R2_CONFIG.dominioHistorias}/${path}`;
  },

  /**
   * Bucket: itvh-historias · Path: <userId>/<timestamp>.webm
   *
   * Historia de "Audio": una grabación de voz sobre un fondo de
   * color o degradado. Ver nota de plataforma #4 al inicio del
   * archivo — sin FFmpeg, el mux se resuelve con canvas+MediaRecorder
   * en tiempo real, SIN el ecualizador animado del Dart original, y
   * el archivo resultante es .webm en vez de .mp4.
   *
   * @param {Object} args
   * @param {Blob} args.audioBlob - audio grabado (ej. desde MediaRecorder de un micrófono).
   * @param {string[]} args.coloresFondo - 1 color = sólido, 2+ = degradado diagonal.
   * @param {string} args.userId
   * @param {(pct: number) => void} [args.onProgress] - progreso de GENERACIÓN del video (0-100), no de subida.
   * @returns {Promise<{url: string, duracionMs: number}>}
   */
  async subirHistoriaAudioConFondo({ audioBlob, coloresFondo, userId, onProgress }) {
    const { blob, duracionMs } = await generarVideoAudioConFondo(audioBlob, coloresFondo, { onProgress });
    const ts = Date.now();
    const path = `${userId}/${ts}.webm`;
    // Se sanitiza el Content-Type quitando el sufijo ";codecs=..."
    // antes de mandarlo a la Edge Function — ver nota de DIFERENCIA
    // DE PLATAFORMA #4 al inicio del archivo. El Blob conserva su
    // tipo completo (con códecs) para reproducción local; solo esta
    // petición usa el tipo base.
    const contentType = (blob.type || 'video/webm').split(';')[0].trim();
    await subirViaPresignedUrl(blob, R2_CONFIG.bucketHistorias, path, contentType);
    return { url: `${R2_CONFIG.dominioHistorias}/${path}`, duracionMs };
  },

  /**
   * Llama a la Edge Function eliminar-objeto-r2. El caller es
   * responsable de dar el bucket y path correctos.
   */
  async eliminarDeR2({ bucket, path }) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('No hay sesión activa: no se puede eliminar de R2');

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_BOLETO_MS);
    let res;
    try {
      res = await fetch(`${R2_CONFIG.edgeFunctionsUrl}/eliminar-objeto-r2`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket, path }),
        signal: controlador.signal,
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Tiempo de espera agotado al eliminar de R2 (bucket=${bucket}, path=${path})`);
      }
      throw error;
    } finally {
      clearTimeout(temporizador);
    }

    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '');
      throw new Error(`Error al eliminar de R2 (${res.status}): ${cuerpo}`);
    }
  },


    /**
   * Bucket: itvh-marketplace · Path: <userId>/<publicacionId>/<orden>.jpg
   *
   * Igual que los demás buckets, el primer segmento debe ser el
   * auth.uid() del usuario autenticado (no el emprendedorId), porque
   * es lo que valida generar-url-subida del lado del servidor.
   */
  async subirImagenMarketplace({ file, publicacionId, userId, orden }) {
    const comprimida = await comprimirImagen(file);
    const path = `${userId}/${publicacionId}/${orden}.jpg`;
    await subirViaPresignedUrl(comprimida, R2_CONFIG.bucketMarketplace, path, 'image/jpeg');
    return { url: `${R2_CONFIG.dominioMarketplace}/${path}`, path };
  },

  /**
   * Bucket: itvh-cosas-perdidas · Path: <userId>/<timestamp>.jpg
   *
   * NUEVO. El Dart original NO usa StorageService para esto — tiene
   * su propio mini-cliente de R2 dentro de cosas_perdidas_screen.dart
   * (_subirR2 + _R2Helper.eliminar). Aquí se centraliza en el
   * servicio compartido: mismo bucket/dominio (bucketCosasPerdidas/
   * dominioCosasPerdidas ya definidos en r2-config.js), misma
   * compresión JPEG que el resto de imágenes de la app. Para
   * eliminar la imagen al borrar un reporte, usar el
   * eliminarDeR2() genérico con bucket: R2_CONFIG.bucketCosasPerdidas.
   */
  async subirImagenCosaPerdida({ file, userId }) {
    const comprimida = await comprimirImagen(file);
    const ts = Date.now();
    const path = `${userId}/${ts}.jpg`;
    await subirViaPresignedUrl(comprimida, R2_CONFIG.bucketCosasPerdidas, path, 'image/jpeg');
    return { url: `${R2_CONFIG.dominioCosasPerdidas}/${path}`, path };
  },
  

  /**
   * Bucket: itvh-chat · Path: <miId>/<otroId>/<mensajeId>.jpg
   *
   * Igual que el resto de buckets, el primer segmento del path debe
   * ser el auth.uid() del usuario autenticado (miId), no el id del
   * otro usuario — por el bug de R2 ya documentado en este archivo.
   *
   * NOTA: a diferencia de subirFotoPerfil/subirMediaPublicacion, no
   * se genera un thumbnailUrl aparte (el resto del proyecto tampoco
   * lo hace para imágenes) — mediaThumbnailUrl siempre viaja null.
   */
  async subirImagenChat({ file, miId, otroId, mensajeId }) {
    const comprimida = await comprimirImagen(file);
    const { ancho, alto } = await medirDimensiones(comprimida);
    const path = `${miId}/${otroId}/${mensajeId}.jpg`;
    await subirViaPresignedUrl(comprimida, R2_CONFIG.bucketChat, path, 'image/jpeg');
    return {
      url: `${R2_CONFIG.dominioChat}/${path}`,
      thumbnailUrl: null,
      tamanioBytes: comprimida.size,
      ancho,
      alto,
    };
  },

  /**
   * Bucket: itvh-chat · Path: <miId>/<otroId>/<mensajeId>.webp
   *
   * Sube el sticker TAL CUAL (sin comprimir ni recodificar), igual
   * que el Dart original — solo se leen sus dimensiones para el
   * aspect ratio de la burbuja.
   */
  async subirStickerChat({ file, miId, otroId, mensajeId }) {
    const { ancho, alto } = await medirDimensiones(file);
    const ext = (file.type && file.type.split('/')[1]) || 'webp';
    const path = `${miId}/${otroId}/${mensajeId}.${ext}`;
    await subirViaPresignedUrl(file, R2_CONFIG.bucketChat, path, file.type || 'image/webp');
    return {
      url: `${R2_CONFIG.dominioChat}/${path}`,
      thumbnailUrl: null,
      tamanioBytes: file.size,
      ancho,
      alto,
    };
  },

  /**
   * Bucket: itvh-chat · Path: <miId>/<otroId>/<mensajeId>.webm
   *
   * DIFERENCIA DE PLATAFORMA: el Dart original graba con `record` en
   * AAC/.m4a. Un navegador no puede grabar AAC de forma confiable
   * (MediaRecorder solo soporta codecs Opus/Vorbis en la práctica),
   * así que la nota de voz se graba y se sube como .webm/opus — mismo
   * criterio ya documentado arriba para subirHistoriaAudioConFondo.
   * El Content-Type se sanitiza igual (sin el sufijo ";codecs=...").
   */
  async subirAudioChat({ blob, miId, otroId, mensajeId, duracionMs }) {
    const path = `${miId}/${otroId}/${mensajeId}.webm`;
    const contentType = (blob.type || 'audio/webm').split(';')[0].trim();
    await subirViaPresignedUrl(blob, R2_CONFIG.bucketChat, path, contentType);
    return {
      url: `${R2_CONFIG.dominioChat}/${path}`,
      tamanioBytes: blob.size,
      duracionMs,
    };
  },

  // ── PENDIENTES ──────────────────────────────────────────────
  // subirVideoChat / subirDocumentoChat: pendientes — composer_bar.dart
  // y conversacion_screen.dart tampoco los usan todavía del lado
  // móvil en el flujo normal de composer (solo imagen/audio/sticker),
  // así que no hacían falta para portar conversacion-screen.js.
};