// mi-perfil-widgets.js
// Ruta real: js/features/perfil/mi-perfil/mi-perfil-widgets.js
//
// Puerto de mi_perfil_widgets.dart. Piezas de UI chicas y funciones
// reutilizadas por mi-perfil-header.js, mi-perfil-screen.js y
// mi-perfil-feed-detalle.js.
//
// DIFERENCIA DE PLATAFORMA — sbCliente: el Dart original define su
// propio cliente de Supabase compartido para el módulo. Aquí NO se
// crea uno nuevo — el proyecto ya tiene un cliente único en
// js/core/supabase-client.js que usa todo el resto de Social ya
// portado; cada archivo de este módulo debe importar
// { supabaseClient } de ahí, igual que tarjeta-publicacion.js,
// notificaciones.js, etc.
//
// DIFERENCIA DE PLATAFORMA — decoracionTarjeta(): en Flutter es una
// función que arma un BoxDecoration (esquinas + sombra). En web ese
// mismo efecto es una clase CSS (.mp-tarjeta, en mi-perfil.css) —
// no hace falta una función JS equivalente, solo aplicar la clase.
//
// DIFERENCIA DE PLATAFORMA — íconos de red social: el Dart usa
// Image.asset() con PNGs de Instagram/Facebook/TikTok. Mientras no
// se agreguen esos assets al proyecto web, se usan emoji como
// placeholder — mismo criterio ya usado en el resto del port.
// Avisar cuando tengas los PNG/SVG reales para reemplazar
// renderBotonRed().
//
// DIFERENCIA DE PLATAFORMA — miniatura de video: video_thumbnail
// (paquete nativo) se reemplaza por la misma técnica <video>+
// <canvas> que ya usa notificaciones.js (generarMiniaturaVideo). Se
// duplica aquí en vez de importarla porque esa función no está
// exportada allá. Candidato a extraer a un helper compartido (p.ej.
// js/core/video-thumbnail.js) si termina haciendo falta en un
// tercer lugar — avisar si prefieres ese refactor ahora en vez de
// la duplicación.

// ── Formateo de números (1234 -> "1.2K", 2500000 -> "2.5M") ──────

export function formatContador(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

// ═══════════════════════════════════════════════════════════════
// STAT — número + etiqueta (Posts / Seguidores / Seguidos)
// ═══════════════════════════════════════════════════════════════

export function renderStatCol({ valor, label }) {
  return `
    <div class="mp-stat">
      <p class="mp-stat__valor">${escaparHtml(valor)}</p>
      <p class="mp-stat__label">${escaparHtml(label)}</p>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// BOTÓN RED SOCIAL — Instagram / Facebook / TikTok
// ─────────────────────────────────────────────────────────────
// Devuelve solo el HTML (mismo criterio que pill-button.js) — quien
// lo inserte engancha el click sobre [data-red].
// ═══════════════════════════════════════════════════════════════

const REDES = {
  instagram: { icono: 'assets/icons/instagram.png', bg: 'rgba(225, 48, 108, 0.12)' },
  facebook: { icono: 'assets/icons/facebook.png', bg: 'rgba(24, 119, 242, 0.12)' },
  tiktok: { icono: 'assets/icons/tiktok.png', bg: 'rgba(255, 255, 255, 0.08)' },
};

export function renderBotonRed(red) {
  const info = REDES[red];
  if (!info) return '';
  return `
    <button class="mp-boton-red" data-red="${red}" style="background:${info.bg}" aria-label="${red}">
      <img src="${info.icono}" alt="" />
    </button>
  `;
}

// ═══════════════════════════════════════════════════════════════
// INSIGNIAS — chips "tinted pill"
// ═══════════════════════════════════════════════════════════════

export function renderInsigniasRow(insignias) {
  if (!insignias || insignias.length === 0) return '';
  return `
    <div class="mp-insignias">
      ${insignias.map((ins) => `<span class="mp-insignia">${escaparHtml(ins.tipo ?? '')}</span>`).join('')}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// AVATAR — con o sin contorno de historia
// ─────────────────────────────────────────────────────────────
// Sin historia activa  → avatar normal + sombra
// Con historia sin ver  → contorno degradado azul→verde
// Con historia ya vista → contorno gris sólido
// ═══════════════════════════════════════════════════════════════

export function renderAvatar({ fotoUrl, tieneHistoria = false, vistasTodas = false, tam = 92 }) {
  const core = `
    <div class="mp-avatar-nucleo" style="width:${tam}px;height:${tam}px">
      ${fotoUrl ? `<img src="${fotoUrl}" alt="" />` : '<span class="mp-avatar-nucleo__icono">👤</span>'}
    </div>
  `;

  if (!tieneHistoria) {
    return `<div class="mp-avatar mp-avatar--sin-historia">${core}</div>`;
  }

  const modificador = vistasTodas ? 'mp-avatar--vista' : 'mp-avatar--activa';
  return `<div class="mp-avatar ${modificador}"><div class="mp-avatar__anillo">${core}</div></div>`;
}

// ═══════════════════════════════════════════════════════════════
// FOTO COMPLETA — overlay de foto de perfil con zoom simple
// ─────────────────────────────────────────────────────────────
// SIMPLIFICACIÓN respecto a InteractiveViewer (pinch-zoom 0.5x–4x +
// arrastre libre, como en historiasfotosvideos-editar.js): aquí solo
// se alterna entre 1x y 2.5x con doble-click/doble-tap. Cubre el
// caso de uso real (ver detalle de la foto) sin la complejidad
// completa de pan+pinch — avisar si de verdad hace falta el pinch
// libre y se porta igual que en el editor.
// ═══════════════════════════════════════════════════════════════

export function abrirFotoCompleta(url) {
  if (!url) return;

  const overlay = document.createElement('div');
  overlay.className = 'mp-foto-overlay';
  overlay.innerHTML = `
    <button class="mp-foto-overlay__cerrar" aria-label="Cerrar">✕</button>
    <img class="mp-foto-overlay__img" src="${url}" alt="" />
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const img = overlay.querySelector('.mp-foto-overlay__img');
  let ampliada = false;

  function cerrar() {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
  }

  overlay.querySelector('.mp-foto-overlay__cerrar').addEventListener('click', cerrar);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrar();
  });
  img.addEventListener('dblclick', () => {
    ampliada = !ampliada;
    img.classList.toggle('mp-foto-overlay__img--zoom', ampliada);
  });
}

// ═══════════════════════════════════════════════════════════════
// MINIATURA DE VIDEO — mismo criterio que notificaciones.js
// ═══════════════════════════════════════════════════════════════

/**
 * Genera una miniatura real (frame del video) y la mete dentro de
 * [contenedor] cuando esté lista. Mientras tanto deja el fondo/
 * placeholder que [contenedor] ya tuviera.
 */
export function montarMiniaturaVideo(contenedor, url) {
  const video = document.createElement('video');
  video.src = url;
  video.crossOrigin = 'anonymous';
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;

  video.addEventListener('loadeddata', () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = Math.round(300 * ((video.videoHeight || 1) / (video.videoWidth || 1)));
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      contenedor.innerHTML = `<img src="${dataUrl}" alt="" />`;
    } catch (error) {
      console.error('mi-perfil-widgets – miniatura video:', error);
    } finally {
      video.remove();
    }
  });
  video.addEventListener('error', () => video.remove());

  video.load();
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}