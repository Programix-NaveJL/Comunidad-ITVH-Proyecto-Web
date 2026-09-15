// ═════════════════════════════════════════════════════════════════
// seleccionar-historias-destacada.js
//
// Pantalla 1 del flujo de creación/edición de destacadas, portada de
// SeleccionarHistoriasDestacada.dart. Muestra TODAS las historias del
// usuario (sin límite de 24h) agrupadas por fecha, en un grid de 3
// columnas. El usuario selecciona de 1 a 10 historias y avanza a
// NombrePortadaDestacada.
//
// Se implementa como overlay abierto por función — igual que
// visor-media.js y ver-historia.js — porque en Flutter es una
// pantalla empujada con Navigator.push que no necesita URL propia.
//
// Exporta abrirSeleccionarHistoriasDestacada(opciones), donde
// opciones (todas opcionales, solo se usan en modo edición):
//   destacadaId, nombreInicial, portadaUrlInicial, seleccionInicial (array de ids)
//   onGuardado — () => void, llamado tras crear/actualizar la colección
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../../core/supabase-client.js';
import { mostrarToast } from '../../../core/toast.js';
import { resolverUrlHistoria } from '../../../core/perfil-utils.js';
import { abrirNombrePortadaDestacada } from './nombre-portada-destacada.js';

const MAX_SELECCION = 10;

const MESES = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function claveGrupo(fechaStr) {
  if (!fechaStr) return '';
  const dt = new Date(fechaStr);
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.getDate()} ${MESES[dt.getMonth() + 1]}`;
}

export function abrirSeleccionarHistoriasDestacada(opciones = {}) {
  const {
    destacadaId = null,
    nombreInicial = null,
    portadaUrlInicial = null,
    seleccionInicial = [],
    onGuardado = () => {},
  } = opciones;

  const modoEdicion = destacadaId != null;
  const seleccion = [...seleccionInicial]; // ids en orden de selección
  const porId = new Map(); // id → historia completa

  const overlay = document.createElement('div');
  overlay.className = 'sel-destacadas-overlay';
  overlay.innerHTML = `
    <header class="sel-destacadas-appbar">
      <button type="button" class="sel-destacadas-atras" aria-label="Volver">‹</button>
      <span class="sel-destacadas-titulo">${modoEdicion ? 'Editar colección' : 'Nueva colección'}</span>
      <button type="button" class="sel-destacadas-siguiente" disabled>Siguiente</button>
    </header>
    <div class="sel-destacadas-cuerpo">
      <div class="sel-destacadas-cargando">
        <span class="btn-spinner"></span>
      </div>
    </div>
    <footer class="sel-destacadas-bottombar" hidden></footer>
  `;
  document.body.appendChild(overlay);

  const cerrar = () => overlay.remove();
  overlay.querySelector('.sel-destacadas-atras').addEventListener('click', cerrar);

  const botonSiguiente = overlay.querySelector('.sel-destacadas-siguiente');
  const cuerpo = overlay.querySelector('.sel-destacadas-cuerpo');
  const bottombar = overlay.querySelector('.sel-destacadas-bottombar');

  const irASiguiente = () => {
    if (seleccion.length === 0) return;
    const primeraHistoria = porId.get(seleccion[0]);
    const portadaDefault = primeraHistoria ? resolverUrlHistoria(primeraHistoria) : null;

    abrirNombrePortadaDestacada({
      historiasSeleccionadas: [...seleccion],
      portadaUrlDefault: portadaDefault,
      destacadaId,
      nombreInicial,
      portadaUrlInicial,
      // Al guardar con éxito se cierran ambas pantallas (igual que
      // los dos Navigator.pop() en NombrePortadaDestacada.dart)
      onGuardadoConExito: () => {
        onGuardado();
        cerrar();
      },
    });
  };

  botonSiguiente.addEventListener('click', irASiguiente);

  function actualizarBotones() {
    const puedeAvanzar = seleccion.length > 0;
    botonSiguiente.disabled = !puedeAvanzar;
    bottombar.hidden = seleccion.length === 0;
    if (seleccion.length > 0) {
      bottombar.innerHTML = `
        <span class="sel-destacadas-contador">${seleccion.length} de ${MAX_SELECCION} seleccionadas</span>
        <button type="button" class="sel-destacadas-btn-siguiente">Siguiente</button>
      `;
      bottombar.querySelector('.sel-destacadas-btn-siguiente').addEventListener('click', irASiguiente);
    }
  }

  function toggleSeleccion(id, elCirculo, elBoton) {
    const yaEsta = seleccion.includes(id);
    if (yaEsta) {
      seleccion.splice(seleccion.indexOf(id), 1);
    } else {
      if (seleccion.length >= MAX_SELECCION) {
        mostrarToast('Máximo 10 historias por colección', 'error');
        return;
      }
      seleccion.push(id);
    }
    repintarSeleccion();
    actualizarBotones();
  }

  function repintarSeleccion() {
    cuerpo.querySelectorAll('.sel-destacadas-thumb').forEach((el) => {
      const id = el.dataset.id;
      const idx = seleccion.indexOf(id);
      const seleccionado = idx !== -1;
      el.classList.toggle('sel-destacadas-thumb--sel', seleccionado);
      const circulo = el.querySelector('.sel-destacadas-circulo');
      circulo.classList.toggle('sel-destacadas-circulo--sel', seleccionado);
      circulo.textContent = seleccionado ? String(idx + 1) : '';
    });
  }

  async function cargarHistorias() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    const { data, error } = await supabaseClient
      .from('historias')
      .select('id, cdn_url, media_url, tipo, creado_en')
      .eq('autor_id', user.id)
      .order('creado_en', { ascending: false });

    if (error) {
      cuerpo.innerHTML = `<div class="sel-destacadas-vacio">No se pudieron cargar tus historias</div>`;
      return;
    }

    const historias = data || [];
    porId.clear();
    historias.forEach((h) => porId.set(h.id, h));

    if (historias.length === 0) {
      cuerpo.innerHTML = `
        <div class="sel-destacadas-vacio">
          <div class="sel-destacadas-vacio-icono">📖</div>
          <div class="sel-destacadas-vacio-titulo">Aún no tienes historias</div>
          <div class="sel-destacadas-vacio-texto">Crea historias para agregarlas a una colección</div>
        </div>`;
      return;
    }

    // Agrupar por fecha (día/mes), preservando el orden original (más reciente primero)
    const agrupado = new Map();
    historias.forEach((h) => {
      const clave = claveGrupo(h.creado_en);
      if (!agrupado.has(clave)) agrupado.set(clave, []);
      agrupado.get(clave).push(h);
    });

    let html = `<div class="sel-destacadas-subtitulo">Selecciona hasta ${MAX_SELECCION} historias</div>`;

    agrupado.forEach((items, fecha) => {
      html += `<div class="sel-destacadas-fecha">${fecha}</div>`;
      html += `<div class="sel-destacadas-grid">`;
      items.forEach((h) => {
        const url = resolverUrlHistoria(h);
        html += `
          <button type="button" class="sel-destacadas-thumb" data-id="${h.id}">
            ${
              url
                ? `<img src="${url}" alt="" class="sel-destacadas-thumb-img"
                      onerror="this.style.display='none';">`
                : ''
            }
            <span class="sel-destacadas-thumb-fecha">${fecha}</span>
            <span class="sel-destacadas-circulo"></span>
          </button>`;
      });
      html += `</div>`;
    });

    cuerpo.innerHTML = html;

    cuerpo.querySelectorAll('.sel-destacadas-thumb').forEach((el) => {
      el.addEventListener('click', () => toggleSeleccion(el.dataset.id, null, el));
    });

    // Si venimos en modo edición, refleja la selección inicial ya cargada
    repintarSeleccion();
    actualizarBotones();
  }

  cargarHistorias();

  return { cerrar };
}