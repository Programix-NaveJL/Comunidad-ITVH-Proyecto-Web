// ═════════════════════════════════════════════════════════════════
// maestros-screen.js
// Ubicación: js/features/chat/maestros/maestros-screen.js
//
// Réplica web de Referencias de maestros/RefeMaestros_Principal.dart.
// Chips de departamento + buscador + lista de MaestroCard + FAB
// "Agregar docente".
//
// El FAB se inyecta en #jchat-fab-zona (reservada por
// jaguar-chat-principal.js) y se muestra/oculta con un
// MutationObserver que observa la clase 'visible' del propio panel
// — así no hace falta tocar jaguar-chat-principal.js para nada de
// esto, tal como su comentario de cabecera ya anticipaba.
// ═════════════════════════════════════════════════════════════════

import * as maestrosRepository from './maestros-repository.js';
import { crearMaestro, nombreCompletoMaestro } from './maestro-model.js';
import { crearMaestroCard } from './maestro-card.js';
import { mostrarToast } from '../../../core/toast.js';

const TITULOS = ['Dr.', 'Dra.', 'Ing.', 'Inga.', 'Mtro.', 'Mtra.', 'Lic.', 'Profe'];
const DEPTOS_TEXTO = [
  'Sistemas y Computación',
  'Ingeniería Industrial',
  'Ciencias Económico-Administrativas',
  'Ing. Química, Bioquímica y Ambiental',
  'Ciencias de la Tierra',
  'Ciencias Básicas',
];

const DEPARTAMENTOS = [
  { id: 'todos', chipLabel: 'Todos', icono: '▦', color: '#8E8E93', filtroDb: null },
  { id: 'sistemas', chipLabel: 'Sistemas', icono: '💻', color: '#007AFF', filtroDb: 'Sistemas y Computación' },
  { id: 'industrial', chipLabel: 'Industrial', icono: '🏭', color: '#FF9500', filtroDb: 'Ingeniería Industrial' },
  { id: 'economico', chipLabel: 'Económico', icono: '🏛️', color: '#34C759', filtroDb: 'Ciencias Económico-Administrativas' },
  { id: 'quimica', chipLabel: 'Química', icono: '🧪', color: '#AF52DE', filtroDb: 'Ing. Química, Bioquímica y Ambiental' },
  { id: 'tierra', chipLabel: 'Tierra', icono: '⛰️', color: '#00C7BE', filtroDb: 'Ciencias de la Tierra' },
  { id: 'basicas', chipLabel: 'C. Básicas', icono: '🧮', color: '#FF2D55', filtroDb: 'Ciencias Básicas' },
];

export async function render(contenedor) {
  let deptoActivo = DEPARTAMENTOS[0];
  let maestros = [];
  let cargando = true;
  let busqueda = '';
  let fab = null;

  contenedor.innerHTML = `
    <div class="mst-screen">
      <div class="mst-chips-zona" id="mst-chips-zona"></div>
      <div class="mst-busqueda-zona">
        <div class="mst-busqueda">
          <span>🔍</span>
          <input type="text" id="mst-busqueda-input" placeholder="Buscar docente..." autocomplete="off" />
          <button id="mst-limpiar-busqueda" class="mst-limpiar" style="display:none">✕</button>
        </div>
      </div>
      <div class="mst-lista-zona" id="mst-lista-zona"></div>
    </div>
  `;

  renderChips();

  const inputBusqueda = contenedor.querySelector('#mst-busqueda-input');
  const btnLimpiar = contenedor.querySelector('#mst-limpiar-busqueda');
  inputBusqueda.addEventListener('input', () => {
    busqueda = inputBusqueda.value;
    btnLimpiar.style.display = busqueda ? '' : 'none';
    renderLista();
  });
  btnLimpiar.addEventListener('click', () => {
    inputBusqueda.value = '';
    busqueda = '';
    btnLimpiar.style.display = 'none';
    renderLista();
  });

  function renderChips() {
    const zona = contenedor.querySelector('#mst-chips-zona');
    zona.innerHTML = `
      <div class="mst-chips-scroll">
        ${DEPARTAMENTOS.map(
          (d) => `
          <button class="mst-depto-chip${d.id === deptoActivo.id ? ' seleccionado' : ''}" data-depto="${d.id}"
            style="${d.id === deptoActivo.id ? `background:${d.color};color:#fff` : ''}">
            <span>${d.icono}</span><span>${d.chipLabel}</span>
          </button>`
        ).join('')}
      </div>
    `;
    zona.querySelectorAll('[data-depto]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const depto = DEPARTAMENTOS.find((d) => d.id === btn.dataset.depto);
        if (depto.id === deptoActivo.id) return;
        deptoActivo = depto;
        renderChips();
        cargarMaestros();
      });
    });
  }

  function maestrosFiltrados() {
    const q = busqueda.trim().toLowerCase();
    if (!q) return maestros;
    return maestros.filter((m) => nombreCompletoMaestro(m).toLowerCase().includes(q));
  }

  async function cargarMaestros() {
    cargando = true;
    renderLista();
    maestros = await maestrosRepository.obtenerMaestros({ departamento: deptoActivo.filtroDb });
    cargando = false;
    renderLista();
    actualizarFab();
  }

  function renderLista() {
    const zona = contenedor.querySelector('#mst-lista-zona');
    if (cargando) {
      zona.innerHTML = `<div class="mst-cargando"><span class="chats-spinner"></span></div>`;
      return;
    }
    if (maestros.length === 0) {
      zona.innerHTML = plantillaEmptyState(deptoActivo);
      zona.querySelector('#mst-empty-agregar')?.addEventListener('click', abrirNuevoMaestro);
      return;
    }
    const filtrados = maestrosFiltrados();
    if (filtrados.length === 0) {
      zona.innerHTML = plantillaSinResultados(busqueda, deptoActivo.color);
      return;
    }
    zona.innerHTML = '';
    filtrados.forEach((m) => zona.appendChild(crearMaestroCard(m)));
  }

  // ── FAB ────────────────────────────────────────────────────────
  const fabZona = document.getElementById('jchat-fab-zona');
  if (fabZona) {
    fab = document.createElement('button');
    fab.className = 'mst-fab';
    fab.textContent = '＋';
    fab.style.display = 'none';
    fab.addEventListener('click', abrirNuevoMaestro);
    fabZona.appendChild(fab);

    new MutationObserver(actualizarFab).observe(contenedor, { attributes: true, attributeFilter: ['class'] });
  }

  function actualizarFab() {
    if (!fab) return;
    fab.style.display = contenedor.classList.contains('visible') && maestros.length > 0 ? 'flex' : 'none';
  }

  function abrirNuevoMaestro() {
    mostrarFormularioNuevoMaestro(deptoActivo.color, () => cargarMaestros());
  }

  await cargarMaestros();
}

function plantillaEmptyState(depto) {
  return `
    <div class="mst-empty">
      <div class="mst-empty__icono" style="background:${depto.color}1f;color:${depto.color}">${depto.icono}</div>
      <p class="mst-empty__titulo">Sin docentes aún</p>
      <p class="mst-empty__desc">${
        depto.id === 'todos'
          ? 'Sé el primero en agregar<br />un docente a la comunidad.'
          : `No hay docentes en ${escapar(depto.chipLabel)} aún.<br />Agrega el primero.`
      }</p>
      <button class="mst-empty__boton" id="mst-empty-agregar" style="background:${depto.color}">＋ Agregar docente</button>
    </div>
  `;
}

function plantillaSinResultados(query, color) {
  return `
    <div class="mst-empty mst-empty--chico">
      <div class="mst-empty__icono" style="background:${color}1f;color:${color}">🔍</div>
      <p class="mst-empty__titulo">Sin resultados</p>
      <p class="mst-empty__desc">No encontramos a "${escapar(query)}" en esta sección.</p>
    </div>
  `;
}

function escapar(t) {
  const div = document.createElement('div');
  div.textContent = t ?? '';
  return div.innerHTML;
}

// ── Sheet "Agregar docente" (con verificación de duplicado) ───────

function mostrarFormularioNuevoMaestro(accentColor, onCreado) {
  const overlay = document.createElement('div');
  overlay.className = 'mst-sheet-overlay';
  overlay.innerHTML = `
    <div class="mst-sheet mst-sheet--grande">
      <div class="mst-sheet__manija"></div>
      <div class="mst-sheet__scroll">
        <p class="mst-sheet__titulo">Agregar docente</p>

        <p class="mst-label">Título</p>
        <div class="mst-titulos">
          ${TITULOS.map((t, i) => `<button class="mst-titulo-chip${i === TITULOS.length - 1 ? ' seleccionado' : ''}" data-titulo="${t}" style="${i === TITULOS.length - 1 ? `background:${accentColor}` : ''}">${t}</button>`).join('')}
        </div>

        <p class="mst-label">Nombre(s)</p>
        <input class="mst-input" id="mst-nombre" placeholder="Ej: Clemente" />

        <p class="mst-label">Apellido paterno</p>
        <input class="mst-input" id="mst-apellido-pat" placeholder="Ej: Silvan" />

        <p class="mst-label">Apellido materno</p>
        <div class="mst-input-con-sufijo">
          <input class="mst-input" id="mst-apellido-mat" placeholder="Ej: Emeterio" />
          <span class="mst-sufijo" id="mst-sufijo-verificacion"></span>
        </div>
        <p class="mst-error" id="mst-error-apellidos" style="display:none"></p>

        <p class="mst-label">Departamento</p>
        <select class="mst-select" id="mst-depto">
          <option value="" selected>Selecciona departamento</option>
          ${DEPTOS_TEXTO.map((d) => `<option value="${d}">${d}</option>`).join('')}
        </select>

        <p class="mst-label">Materias (separadas por coma)</p>
        <input class="mst-input" id="mst-materias" placeholder="Ej: Cal. Dif, Cal. Vec, Ec. Dif" />

        <p class="mst-label">Semestres (separados por coma)</p>
        <input class="mst-input" id="mst-semestres" placeholder="Ej: 2do, 3ro, 4to" />

        <button class="mst-boton-grande" id="mst-crear" style="background:${accentColor}">Agregar docente</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));
  const cerrar = () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
  };
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrar();
  });

  let tituloSel = TITULOS[TITULOS.length - 1];
  overlay.querySelectorAll('[data-titulo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      tituloSel = btn.dataset.titulo;
      overlay.querySelectorAll('[data-titulo]').forEach((b) => {
        b.classList.toggle('seleccionado', b === btn);
        b.style.background = b === btn ? accentColor : '';
      });
    });
  });

  const inputPat = overlay.querySelector('#mst-apellido-pat');
  const inputMat = overlay.querySelector('#mst-apellido-mat');
  const sufijo = overlay.querySelector('#mst-sufijo-verificacion');
  const errorEl = overlay.querySelector('#mst-error-apellidos');
  const btnCrear = overlay.querySelector('#mst-crear');

  let apellidosVerificados = false;
  let errorApellidos = null;

  function resetVerificacion() {
    apellidosVerificados = false;
    errorApellidos = null;
    sufijo.innerHTML = '';
    errorEl.style.display = 'none';
  }

  async function verificarDuplicado() {
    const pat = inputPat.value.trim();
    const mat = inputMat.value.trim();
    if (!pat || !mat) return;

    sufijo.innerHTML = `<span class="mst-spinner-chico"></span>`;
    apellidosVerificados = false;
    errorApellidos = null;
    errorEl.style.display = 'none';

    const existe = await maestrosRepository.maestroExiste({ apellidoPat: pat, apellidoMat: mat });

    apellidosVerificados = !existe;
    if (existe) {
      errorApellidos = 'Docente ya existe. Verifica su información en la lista.';
      sufijo.innerHTML = '';
      errorEl.textContent = errorApellidos;
      errorEl.style.display = '';
    } else {
      sufijo.innerHTML = `<span class="mst-check">✓</span>`;
    }
  }

  inputPat.addEventListener('input', resetVerificacion);
  inputMat.addEventListener('input', resetVerificacion);
  inputMat.addEventListener('blur', verificarDuplicado);

  btnCrear.addEventListener('click', async () => {
    if (!apellidosVerificados && !errorApellidos) {
      await verificarDuplicado();
      if (errorApellidos) return;
    }
    if (errorApellidos) return;

    const nombre = overlay.querySelector('#mst-nombre').value.trim();
    const apellidoPat = inputPat.value.trim();
    const apellidoMat = inputMat.value.trim();
    if (!nombre || !apellidoPat || !apellidoMat) {
      mostrarToast('Nombre y apellidos son obligatorios.', 'error');
      return;
    }

    const departamento = overlay.querySelector('#mst-depto').value || null;
    const materias = overlay.querySelector('#mst-materias').value.split(',').map((s) => s.trim()).filter(Boolean);
    const semestres = overlay.querySelector('#mst-semestres').value.split(',').map((s) => s.trim()).filter(Boolean);

    btnCrear.disabled = true;
    btnCrear.innerHTML = `<span class="mst-spinner-boton"></span>`;

    try {
      await maestrosRepository.crearMaestro(crearMaestro({ nombre, apellidoPat, apellidoMat, titulo: tituloSel, departamento, materias, semestres }));
      cerrar();
      onCreado();
    } catch (e) {
      console.error('maestros-screen – crearMaestro:', e);
      mostrarToast('No se pudo crear el docente. Intenta de nuevo.', 'error');
      btnCrear.disabled = false;
      btnCrear.textContent = 'Agregar docente';
    }
  });
}