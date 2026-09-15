// js/features/ubicatecnm/mapa-interactivo.js
//
// Pantalla de mapa interactivo del campus del ITVH. Equivalente web
// de mapa_interactivo.dart.
//
// render(contenedor, onVolver) — onVolver() se llama al tocar el
// botón "‹"; esta pantalla se abre siempre embebida dentro del hub
// de UbicaTecNM (ubicatecnm.js), nunca como ruta de nivel superior
// del router, así que no se registra con registrarRuta ni cambia el
// hash — mismo motivo por el que marketplace-inicio.js tampoco lo
// hace.
//
// SUSTITUCIONES respecto al Dart original (documentadas aquí porque
// no tienen equivalente 1:1 en web):
//   • Google Maps + Places API → Leaflet + tiles de OpenStreetMap
//     (sin API key). Requiere en index.html:
//       <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
//       <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
//     cargados ANTES que este módulo — se usa el global `L`.
//   • BitmapDescriptor dibujado con canvas (globito con nombre) →
//     L.divIcon con HTML/CSS (mismo look: burbuja + triángulo),
//     ver mapa-interactivo.css.
//   • permission_handler → Geolocation API nativa del navegador
//     (navigator.geolocation.watchPosition). El punto azul de "mi
//     ubicación" se dibuja a mano con un marcador circular, ya que
//     Leaflet no lo trae integrado como GoogleMap.myLocationEnabled.
//   • InfoWindow / BottomSheet según _esDescripcionLarga() → mismo
//     criterio exacto (contiene <li>/<b>/<p> o longitud > 80): si es
//     larga, se abre bottom-sheet.js con el HTML completo; si es
//     corta, se abre un popup normal de Leaflet con el texto plano.
//   • flutter_html → el HTML del GeoJSON ya viene limpio de esa
//     fuente, así que se inyecta directo en el bottom sheet con
//     innerHTML (mismas etiquetas simples: <li>, <b>, <p>).

import { mostrarToast } from '../../core/toast.js';
import { abrirHojaInferior } from '../../core/bottom-sheet.js';

const ACENTO = '#1B365D';
const RUTA_GEOJSON = 'assets/mapas/campus_data.geojson';
const CENTRO_CAMPUS = [18.0234, -92.9040];

let raizPanel = null;
let onVolverCb = () => {};
let mapa = null;
let capaPoligonos = null;
let capaMarcadores = null;
let marcadorDestino = null;
let marcadorUbicacion = null;
let circuloPrecision = null;
let watchIdUbicacion = null;

let edificios = []; // { nombre, descripcion, centroide: [lat, lng], esLarga }

export async function render(contenedor, onVolver) {
  raizPanel = contenedor;
  onVolverCb = onVolver ?? (() => {});
  edificios = [];

  contenedor.innerHTML = plantillaBase();
  activarInteracciones(contenedor);

  inicializarMapa(contenedor.querySelector('#ubica-mapa-lienzo'));
  await cargarGeoJsonDelCampus();
  activarGeolocalizacion();
}

/** Limpia listeners de geolocalización y libera el mapa — llamar al salir de esta pantalla. */
export function destruir() {
  if (watchIdUbicacion !== null) {
    navigator.geolocation.clearWatch(watchIdUbicacion);
    watchIdUbicacion = null;
  }
  if (mapa) {
    mapa.remove();
    mapa = null;
  }
}

function plantillaBase() {
  return `
    <div class="ubica-mapa">
      <header class="ubica-mapa__header">
        <button class="ubica-mapa__volver" data-mapa-volver aria-label="Volver">‹</button>
        <h2 class="ubica-mapa__titulo">Mapa interactivo del ITVH</h2>
      </header>

      <div class="ubica-mapa__lienzo-zona">
        <div id="ubica-mapa-lienzo" class="ubica-mapa__lienzo"></div>

        <div class="ubica-mapa__buscador-zona">
          <div class="ubica-mapa__buscador">
            <span class="ubica-mapa__buscador-icono">🔍</span>
            <input class="ubica-mapa__buscador-input" id="ubica-buscar-input" type="text" placeholder="Buscar edificio en el campus..." />
            <button class="ubica-mapa__buscador-limpiar" id="ubica-buscar-limpiar" hidden>✕</button>
          </div>

          <div class="ubica-mapa__panel" id="ubica-panel-sugerencias" hidden></div>
          <div class="ubica-mapa__panel" id="ubica-panel-resultados" hidden></div>
        </div>
      </div>
    </div>
  `;
}

function activarInteracciones(contenedor) {
  contenedor.querySelector('[data-mapa-volver]').addEventListener('click', () => {
    destruir();
    onVolverCb();
  });

  const input = contenedor.querySelector('#ubica-buscar-input');
  const limpiar = contenedor.querySelector('#ubica-buscar-limpiar');
  const panelSugerencias = contenedor.querySelector('#ubica-panel-sugerencias');
  const panelResultados = contenedor.querySelector('#ubica-panel-resultados');

  input.addEventListener('focus', () => {
    if (!input.value.trim()) renderSugerencias(panelSugerencias, input);
  });

  input.addEventListener('input', () => {
    const query = input.value.trim();
    limpiar.hidden = query.length === 0;

    if (!query) {
      panelResultados.hidden = true;
      panelResultados.innerHTML = '';
      renderSugerencias(panelSugerencias, input);
      return;
    }
    panelSugerencias.hidden = true;
    renderResultados(panelResultados, query);
  });

  limpiar.addEventListener('click', () => {
    input.value = '';
    limpiar.hidden = true;
    panelResultados.hidden = true;
    panelResultados.innerHTML = '';
    renderSugerencias(panelSugerencias, input);
    input.focus();
  });

  // Tocar el mapa cierra el buscador — mismo comportamiento que
  // onTap del GoogleMap en el Dart original.
  const lienzo = contenedor.querySelector('#ubica-mapa-lienzo');
  lienzo.addEventListener('click', () => {
    input.blur();
    input.value = '';
    limpiar.hidden = true;
    panelSugerencias.hidden = true;
    panelResultados.hidden = true;
  });
}

function renderSugerencias(panel, input) {
  const sugerencias = ['Biblioteca', 'Centro de Cómputo', 'Cafetería', 'Edificio M', 'Gimnasio'];
  panel.hidden = false;
  panel.innerHTML = `
    <p class="ubica-mapa__ayuda">ℹ️ Escribe el nombre de un edificio</p>
    <p class="ubica-mapa__etiqueta">Sugerencias</p>
    <div class="ubica-mapa__chips">
      ${sugerencias.map((s) => `<button class="ubica-mapa__chip" data-sugerencia="${escapar(s)}">${escapar(s)}</button>`).join('')}
    </div>
  `;
  panel.querySelectorAll('[data-sugerencia]').forEach((btn) => {
    btn.addEventListener('click', () => {
      input.value = btn.dataset.sugerencia;
      input.dispatchEvent(new Event('input'));
      input.focus();
    });
  });
}

function renderResultados(panel, query) {
  const resultados = edificios.filter((e) => e.nombre.toLowerCase().includes(query.toLowerCase()));
  panel.hidden = false;

  if (resultados.length === 0) {
    panel.innerHTML = `
      <div class="ubica-mapa__sin-resultados">
        <span>🔎</span>
        <span>No se encontraron edificios</span>
      </div>
    `;
    return;
  }

  panel.innerHTML = resultados
    .map(
      (e, i) => `
    <button class="ubica-mapa__resultado" data-resultado="${i}">
      <span>📍</span>
      <span>${escapar(e.nombre)}</span>
    </button>
  `
    )
    .join('');

  panel.querySelectorAll('[data-resultado]').forEach((btn) => {
    btn.addEventListener('click', () => seleccionarEdificio(resultados[Number(btn.dataset.resultado)]));
  });
}

function inicializarMapa(lienzo) {
  mapa = L.map(lienzo, {
    center: CENTRO_CAMPUS,
    zoom: 17.5,
    minZoom: 15,
    maxZoom: 20,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);

  capaPoligonos = L.layerGroup().addTo(mapa);
  capaMarcadores = L.layerGroup().addTo(mapa);

  // Leaflet mide el contenedor en el instante de L.map(): si el panel
  // del tab todavía no tenía su tamaño final en ese momento (por la
  // transición de la pestaña, o mientras el navegador termina de
  // aplicar el layout), el mapa se queda con dimensiones internas
  // incorrectas para siempre aunque el CSS ya esté bien. Forzamos un
  // recálculo en el siguiente frame y otro de respaldo un poco después.
  requestAnimationFrame(() => mapa?.invalidateSize());
  setTimeout(() => mapa?.invalidateSize(), 300);
}

async function cargarGeoJsonDelCampus() {
  try {
    const respuesta = await fetch(RUTA_GEOJSON);
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    const geojson = await respuesta.json();

    (geojson.features ?? []).forEach((feature) => {
      const geometria = feature.geometry;
      const propiedades = feature.properties ?? {};

      const nombre = propiedades.Name ?? 'Sin nombre';
      const descripcionRaw = propiedades.description ?? '';
      const descripcion = descripcionRaw || '<p>Sin descripción disponible.</p>';
      const esLarga = esDescripcionLarga(descripcion);
      const snippet = esLarga ? 'Toca para ver más información' : limpiarHtml(descripcion);

      if (geometria.type === 'Polygon') {
        procesarPoligono(geometria, nombre, descripcion, esLarga, snippet);
      } else if (geometria.type === 'Point') {
        procesarPunto(geometria, nombre, descripcion, esLarga, snippet);
      }
    });
  } catch (e) {
    console.error('mapa-interactivo – error cargando GeoJSON:', e);
    mostrarToast('No se pudo cargar el mapa del campus', 'error');
  }
}

function procesarPoligono(geometria, nombre, descripcion, esLarga, snippet) {
  const anillo = geometria.coordinates[0]; // [[lng, lat], ...]
  const puntos = anillo.map(([lng, lat]) => [lat, lng]);

  let sumaLat = 0, sumaLng = 0;
  puntos.forEach(([lat, lng]) => {
    sumaLat += lat;
    sumaLng += lng;
  });
  const centroide = [sumaLat / puntos.length, sumaLng / puntos.length];

  edificios.push({ nombre, descripcion, centroide, esLarga });

  const poligono = L.polygon(puntos, {
    color: ACENTO,
    weight: 2,
    fillColor: ACENTO,
    fillOpacity: 0.3,
  }).addTo(capaPoligonos);

  poligono.on('click', () => manejarTapEdificio(nombre, descripcion, esLarga, centroide));

  const marcador = L.marker(centroide, {
    icon: iconoGlobito(nombre),
  }).addTo(capaMarcadores);

  if (esLarga) {
    marcador.on('click', () => abrirDetallesEdificio(nombre, descripcion));
  } else {
    marcador.bindPopup(plantillaPopup(nombre, snippet));
  }
}

function procesarPunto(geometria, nombre, descripcion, esLarga, snippet) {
  const [lng, lat] = geometria.coordinates;
  const marcador = L.marker([lat, lng], {
    icon: iconoPunto(nombre),
  }).addTo(capaMarcadores);

  if (esLarga) {
    marcador.on('click', () => abrirDetallesEdificio(nombre, descripcion));
  } else if (snippet) {
    marcador.bindPopup(plantillaPopup(nombre, snippet));
  } else {
    marcador.bindPopup(`<strong>${escapar(nombre)}</strong>`);
  }
}

function manejarTapEdificio(nombre, descripcion, esLarga, centroide) {
  if (esLarga) {
    abrirDetallesEdificio(nombre, descripcion);
  } else {
    // Abre el popup del marcador correspondiente al centroide —
    // equivalente de showMarkerInfoWindow() en el Dart original.
    capaMarcadores.eachLayer((m) => {
      const pos = m.getLatLng();
      if (Math.abs(pos.lat - centroide[0]) < 1e-9 && Math.abs(pos.lng - centroide[1]) < 1e-9) {
        m.openPopup();
      }
    });
  }
}

function plantillaPopup(nombre, snippet) {
  return `<strong>${escapar(nombre)}</strong>${snippet ? `<br>${escapar(snippet)}` : ''}`;
}

// ── Iconos tipo "globito" con nombre — equivalente CSS/HTML del
// canvas dibujado a mano en el Dart original (_crearMarkerEdificio).
function iconoGlobito(nombre) {
  return L.divIcon({
    className: 'ubica-globito-wrapper',
    html: `<div class="ubica-globito"><span>${escapar(nombre)}</span><div class="ubica-globito__flecha"></div></div>`,
    iconSize: null,
    iconAnchor: [0, 0],
  });
}

// ── Marcador circular de color por categoría — equivalente de
// _colorPorTipo() en el Dart original.
function iconoPunto(nombre) {
  const n = nombre.toLowerCase();
  let clase = 'ubica-punto--azul';
  if (n.includes('acceso')) clase = 'ubica-punto--verde';
  else if (n.includes('cancha') || n.includes('gimnasio') || n.includes('deporti')) clase = 'ubica-punto--naranja';

  return L.divIcon({
    className: 'ubica-punto-wrapper',
    html: `<div class="ubica-punto ${clase}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function seleccionarEdificio(edificio) {
  const contenedor = raizPanel;
  contenedor.querySelector('#ubica-buscar-input').value = '';
  contenedor.querySelector('#ubica-buscar-limpiar').hidden = true;
  contenedor.querySelector('#ubica-panel-sugerencias').hidden = true;
  contenedor.querySelector('#ubica-panel-resultados').hidden = true;
  contenedor.querySelector('#ubica-buscar-input').blur();

  if (marcadorDestino) capaMarcadores.removeLayer(marcadorDestino);
  marcadorDestino = L.marker(edificio.centroide, {
    icon: L.divIcon({
      className: 'ubica-punto-wrapper',
      html: `<div class="ubica-punto ubica-punto--rojo"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    }),
  })
    .addTo(capaMarcadores)
    .bindPopup(`📍 ${escapar(edificio.nombre)}`);

  mapa.flyTo(edificio.centroide, 19.5, { duration: 0.6 });

  setTimeout(() => {
    if (edificio.esLarga) {
      abrirDetallesEdificio(edificio.nombre, edificio.descripcion);
    } else {
      marcadorDestino.openPopup();
    }
  }, 650);
}

// ── Bottom sheet con la descripción HTML completa — mismo criterio
// que _mostrarDetallesEdificio() en el Dart original.
function abrirDetallesEdificio(nombre, descripcion) {
  const { cuerpo } = abrirHojaInferior({ initialChildSize: 0.4, minChildSize: 0.2, maxChildSize: 0.85 });
  cuerpo.innerHTML = `
    <div class="ubica-detalle">
      <h3 class="ubica-detalle__nombre">${escapar(nombre)}</h3>
      <div class="ubica-detalle__descripcion">${sanearHtmlBasico(descripcion)}</div>
    </div>
  `;
}

// ── Geolocalización nativa del navegador — sustituto de
// permission_handler + GoogleMap.myLocationEnabled.
function activarGeolocalizacion() {
  if (!('geolocation' in navigator)) return;

  watchIdUbicacion = navigator.geolocation.watchPosition(
    (posicion) => {
      const { latitude, longitude, accuracy } = posicion.coords;
      const latlng = [latitude, longitude];

      if (!marcadorUbicacion) {
        marcadorUbicacion = L.circleMarker(latlng, {
          radius: 7,
          color: '#fff',
          weight: 2,
          fillColor: '#007AFF',
          fillOpacity: 1,
        }).addTo(mapa);
        circuloPrecision = L.circle(latlng, {
          radius: accuracy,
          color: '#007AFF',
          weight: 1,
          fillColor: '#007AFF',
          fillOpacity: 0.12,
        }).addTo(mapa);
      } else {
        marcadorUbicacion.setLatLng(latlng);
        circuloPrecision.setLatLng(latlng);
        circuloPrecision.setRadius(accuracy);
      }
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        mostrarToast('Activa la ubicación para verte en el mapa', 'info');
      }
    },
    { enableHighAccuracy: true, maximumAge: 10000 }
  );
}

// ─────────────────────────────────────────────────────────────────
function esDescripcionLarga(descripcion) {
  return descripcion.includes('<li>') || descripcion.includes('<b>') || descripcion.includes('<p>') || descripcion.length > 80;
}

function limpiarHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// Permite solo las etiquetas simples que ya trae el GeoJSON
// (<p>, <b>, <li>, <ul>) — mismo alcance que flutter_html aquí, sin
// admitir HTML arbitrario en el bottom sheet.
function sanearHtmlBasico(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('*').forEach((el) => {
    if (!['P', 'B', 'STRONG', 'LI', 'UL', 'OL', 'BR'].includes(el.tagName)) {
      el.replaceWith(...el.childNodes);
    }
  });
  return div.innerHTML;
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}