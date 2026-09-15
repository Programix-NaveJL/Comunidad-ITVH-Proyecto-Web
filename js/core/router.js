// ═════════════════════════════════════════════════════════════════
// router.js
//
// Enrutador simple basado en el hash de la URL (ej. "#/login").
//
// Qué hace este archivo:
//   • Mantiene un registro de rutas → función de render (`rutas`).
//   • Escucha el evento `hashchange` del navegador: cada vez que el
//     hash cambia, busca la función de render correspondiente y la
//     ejecuta pasándole el contenedor principal de la app
//     (<div id="app">) y los parámetros posicionales extraídos del
//     hash, si los hay (ej. "#/perfil/abc123" → params = ['abc123']).
//   • Expone `navegarA(ruta)` para que cualquier pantalla cambie de
//     ruta mediante código (ej. el botón "Regístrate" del login
//     llama a `navegarA('/registro')`), en vez de manipular
//     `window.location.hash` directamente en cada archivo.
//   • Si el hash no coincide con ninguna ruta registrada, cae en la
//     ruta por defecto (`rutaInicial`, configurable con
//     `establecerRutaInicial`).
//
// Cómo registrar una pantalla nueva (ver auth/iniciar-sesion.js
// para un ejemplo completo):
//
//   import { registrarRuta } from '../core/router.js';
//   registrarRuta('/login', (contenedor) => { ...pinta el login... });
//
// SPLASH DE ARRANQUE: index.html pinta un splash estático (HTML puro,
// sin esperar el bundle de módulos) antes de <div id="app">, y marca
// window.__splashInicio = Date.now() en un <script> inline justo
// después — así queda el timestamp más temprano posible, antes de
// que el navegador siquiera empiece a bajar los módulos JS.
//
// Este router no hace guard de sesión (eso vive en cada pantalla o
// en el punto donde de verdad se resuelve login-vs-shell), así que
// la señal de "ya hay algo que mostrar" es el primer resolverRuta()
// que corre — sea que caiga en /login o en cualquier otra ruta, ya
// hay HTML real detrás. Aun así, el splash se queda visible un
// mínimo de SPLASH_DURACION_MS desde que apareció (no menos, aunque
// el router resuelva al instante) para que no parpadee en conexiones
// rápidas — ver programarCierreSplash().
//
// Este router es intencionalmente simple: no maneja transiciones
// animadas más allá del splash, guards de autenticación ni rutas
// anidadas. Esas capacidades se pueden ir agregando aquí mismo
// conforme el proyecto lo necesite, sin tener que tocar las
// pantallas que ya lo consumen — todas dependen únicamente de
// `registrarRuta` y `navegarA`.
// ═════════════════════════════════════════════════════════════════

const contenedorApp = document.getElementById('app');

/** Mapa de ruta → función de render: (contenedor, ...params) => void */
const rutas = new Map();

/** Ruta que se muestra si el hash actual no coincide con ninguna registrada. */
let rutaInicial = '/login';

/** Evita programar el cierre del splash más de una vez. */
let splashProgramado = false;

/** Cuánto tiempo mínimo se mantiene visible el splash, en milisegundos. */
const SPLASH_DURACION_MS = 3000;

/** Duración del fade-out (debe coincidir con la transición en el CSS del splash). */
const SPLASH_FADE_MS = 500;

/**
 * Registra una pantalla bajo una ruta dada.
 * @param {string} ruta - ej. '/login', '/registro', '/recuperar'
 * @param {(contenedor: HTMLElement, ...params: string[]) => void} render
 */
export function registrarRuta(ruta, render) {
  rutas.set(ruta, render);
}

/** Define cuál ruta se usa cuando el hash no coincide con ninguna registrada. */
export function establecerRutaInicial(ruta) {
  rutaInicial = ruta;
}

/** Cambia de pantalla actualizando el hash — dispara `hashchange` automáticamente. */
export function navegarA(ruta) {
  window.location.hash = ruta;
}

/**
 * Resuelve el hash actual contra las rutas registradas y renderiza
 * la pantalla correspondiente dentro de `contenedorApp`, limpiando
 * primero cualquier contenido de la pantalla anterior.
 */
function resolverRuta() {
  const hash = window.location.hash.replace(/^#/, '') || rutaInicial;
  const segmentos = hash.split('/').filter(Boolean); // ej. ['perfil', 'abc123']

  const ruta = `/${segmentos[0] ?? ''}`;
  const params = segmentos.slice(1);

  const render = rutas.get(ruta) ?? rutas.get(rutaInicial);
  if (!render || !contenedorApp) return;

  contenedorApp.innerHTML = '';
  render(contenedorApp, ...params);

  programarCierreSplash();
}

/**
 * Programa el cierre del splash (ver index.html) tras el primer
 * render real, respetando SPLASH_DURACION_MS como mínimo desde que
 * apareció — aunque el router resuelva al instante, el splash no se
 * corta antes de tiempo.
 */
function programarCierreSplash() {
  if (splashProgramado) return;
  splashProgramado = true;

  const splash = document.getElementById('splash');
  if (!splash) return;

  const inicio = window.__splashInicio ?? Date.now();
  const transcurrido = Date.now() - inicio;
  const restante = Math.max(0, SPLASH_DURACION_MS - transcurrido);

  setTimeout(() => {
    splash.classList.add('splash--oculto');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    // Respaldo por si transitionend no dispara (ej. sin CSS de transición cargado).
    setTimeout(() => splash.remove(), SPLASH_FADE_MS);
  }, restante);
}

window.addEventListener('hashchange', resolverRuta);
window.addEventListener('DOMContentLoaded', resolverRuta);