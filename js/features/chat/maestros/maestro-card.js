// ═════════════════════════════════════════════════════════════════
// maestro-card.js
// Ubicación: js/features/chat/maestros/maestro-card.js
//
// Réplica web de Referencias de maestros/maestro_card.dart. Tarjeta
// de un docente: nombre, departamento, materias/semestres,
// puntuación, comentarios (con "ver más"), botón Editar y botón
// Evaluar, cada uno con su propio sheet.
//
// DIFERENCIA: las estrellas se rellenan por porcentaje exacto
// (mst-estrella__llena con width:X%) en vez del floor()+media que
// usa Dart (Icons.star_half_rounded solo cubre medias exactas) — es
// más preciso, no una simplificación.
// ═════════════════════════════════════════════════════════════════

import * as maestrosRepository from './maestros-repository.js';
import { nombreCompletoMaestro } from './maestro-model.js';
import { supabaseClient } from '../../../core/supabase-client.js';
import { mostrarToast } from '../../../core/toast.js';

const AZUL = '#007AFF';
const VERDE = '#34C759';
const COMENTARIOS_VISIBLES = 2;

const TITULOS = ['Dr.', 'Dra.', 'Ing.', 'Inga.', 'Mtro.', 'Mtra.', 'Lic.', 'Profe'];
const DEPTOS = [
  'Sistemas y Computación',
  'Ingeniería Industrial',
  'Ciencias Económico-Administrativas',
  'Ing. Química, Bioquímica y Ambiental',
  'Ciencias de la Tierra',
  'Ciencias Básicas',
];

export function crearMaestroCard(maestro, { onActualizado } = {}) {
  let m = maestro;
  let evaluaciones = [];
  let cargandoEvals = true;
  let expandido = false;

  const el = document.createElement('div');
  el.className = 'mst-card';

  function render() {
    el.innerHTML = `
      <div class="mst-card__cabecera">
        <span class="mst-card__avatar">${(m.nombre || '?').trim().charAt(0).toUpperCase()}</span>
        <div class="mst-card__nombre-zona">
          <p class="mst-card__nombre">${escapar(nombreCompletoMaestro(m))}</p>
          ${m.departamento ? `<p class="mst-card__depto">${escapar(m.departamento)}</p>` : ''}
        </div>
        <div class="mst-card__meta">
          ${renderPuntuacion(m.promedioEstrellas, m.totalEvaluaciones)}
          <button class="mst-card__editar" id="mst-btn-editar">✏️ Editar</button>
        </div>
      </div>
      <hr class="mst-divisor" />
      ${m.materias.length ? `<p class="mst-etiqueta">Materias</p><div class="mst-chips">${m.materias.map((c) => chip(c, AZUL)).join('')}</div>` : ''}
      ${m.semestres.length ? `<p class="mst-etiqueta">Semestres</p><div class="mst-chips">${m.semestres.map((c) => chip(c, VERDE)).join('')}</div>` : ''}
      <hr class="mst-divisor" />
      <div class="mst-card__fila-comentarios">
        <p class="mst-etiqueta">Comentarios</p>
        <button class="mst-card__evaluar" id="mst-btn-evaluar">＋ Evaluar</button>
      </div>
      <div class="mst-card__comentarios" id="mst-comentarios"></div>
    `;
    renderComentarios();
    el.querySelector('#mst-btn-editar').addEventListener('click', abrirEdicion);
    el.querySelector('#mst-btn-evaluar').addEventListener('click', abrirEvaluacion);
  }

  function renderComentarios() {
    const zona = el.querySelector('#mst-comentarios');
    if (!zona) return;
    if (cargandoEvals) {
      zona.innerHTML = `<div class="mst-comentarios-cargando"><span class="chats-spinner"></span></div>`;
      return;
    }
    if (evaluaciones.length === 0) {
      zona.innerHTML = `<p class="mst-sin-evals">Aún no hay evaluaciones. ¡Sé el primero!</p>`;
      return;
    }
    const visibles = expandido ? evaluaciones : evaluaciones.slice(0, COMENTARIOS_VISIBLES);
    const hayMas = evaluaciones.length > COMENTARIOS_VISIBLES;
    zona.innerHTML = `
      ${visibles.map((e) => plantillaComentario(e)).join('')}
      ${hayMas ? `<button class="mst-ver-mas" id="mst-ver-mas">${expandido ? 'Ver menos ▲' : `Ver más comentarios (${evaluaciones.length - COMENTARIOS_VISIBLES}) ▼`}</button>` : ''}
    `;
    zona.querySelector('#mst-ver-mas')?.addEventListener('click', () => {
      expandido = !expandido;
      renderComentarios();
    });
  }

  async function cargarEvaluaciones() {
    cargandoEvals = true;
    renderComentarios();
    evaluaciones = await maestrosRepository.obtenerEvaluaciones(m.id);
    cargandoEvals = false;
    renderComentarios();
  }

  function abrirEdicion() {
    mostrarFormularioEditar(m, (actualizado) => {
      m = actualizado;
      render();
      onActualizado?.();
    });
  }

  async function abrirEvaluacion() {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    const uid = user?.id;
    if (!uid) return;

    const yaEval = await maestrosRepository.yaEvaluo({ maestroId: m.id, usuarioId: uid });
    if (yaEval) {
      mostrarToast('Ya evaluaste a este docente.', 'error');
      return;
    }
    mostrarFormularioEvaluacion(m, () => cargarEvaluaciones());
  }

  render();
  cargarEvaluaciones();
  return el;
}

function plantillaComentario(e) {
  return `
    <div class="mst-comentario">
      ${renderEstrellas(e.estrellas, { size: 12 })}
      <div class="mst-comentario__texto">${escapar(e.comentario && e.comentario.length ? e.comentario : 'Sin comentario.')}</div>
    </div>
  `;
}

function chip(texto, color) {
  return `<span class="mst-chip" style="color:${color};background:${color}1a;border-color:${color}40">${escapar(texto)}</span>`;
}

function renderPuntuacion(promedio, total) {
  return `
    <div class="mst-puntuacion">
      ${renderEstrellas(promedio, { size: 16 })}
      <span class="mst-puntuacion__texto">${promedio > 0 ? `${promedio.toFixed(1)} · ${total} ${total === 1 ? 'eval.' : 'evals.'}` : 'Sin evaluar'}</span>
    </div>
  `;
}

export function renderEstrellas(valor) {
  return `<span class="mst-estrellas">${Array.from({ length: 5 }, (_, i) => {
    const pct = Math.max(0, Math.min(1, valor - i)) * 100;
    return `<span class="mst-estrella"><span class="mst-estrella__vacia">☆</span><span class="mst-estrella__llena" style="width:${pct}%">★</span></span>`;
  }).join('')}</span>`;
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// ── Sheets (overlay propio) ─────────────────────────────────────

function abrirOverlay(html) {
  const overlay = document.createElement('div');
  overlay.className = 'mst-sheet-overlay';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));
  const cerrar = () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
  };
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrar();
  });
  return { overlay, cerrar };
}

function mostrarFormularioEditar(maestro, onGuardado) {
  const { overlay, cerrar } = abrirOverlay(`
    <div class="mst-sheet mst-sheet--grande">
      <div class="mst-sheet__manija"></div>
      <div class="mst-sheet__scroll">
        <div class="mst-sheet__cabecera">
          <p class="mst-sheet__titulo">Editar docente</p>
          <span class="mst-sheet__badge">✏️ Sugerencia</span>
        </div>
        <p class="mst-sheet__subtitulo">Ayuda a completar la info de este docente.</p>

        <p class="mst-label">Título</p>
        <div class="mst-titulos">
          ${TITULOS.map((t) => `<button class="mst-titulo-chip${t === maestro.titulo ? ' seleccionado' : ''}" data-titulo="${t}">${t}</button>`).join('')}
        </div>

        <p class="mst-label">Nombre(s)</p>
        <input class="mst-input" id="mst-nombre" value="${escapar(maestro.nombre)}" placeholder="Ej: Clemente" />

        <p class="mst-label">Apellido paterno</p>
        <input class="mst-input" id="mst-apellido-pat" value="${escapar(maestro.apellidoPat)}" placeholder="Ej: Silvan" />

        <p class="mst-label">Apellido materno</p>
        <input class="mst-input" id="mst-apellido-mat" value="${escapar(maestro.apellidoMat)}" placeholder="Ej: Emeterio" />

        <p class="mst-label">Departamento</p>
        <select class="mst-select" id="mst-depto">
          <option value="" ${!maestro.departamento ? 'selected' : ''}>Selecciona departamento</option>
          ${DEPTOS.map((d) => `<option value="${escapar(d)}" ${maestro.departamento === d ? 'selected' : ''}>${escapar(d)}</option>`).join('')}
        </select>

        <p class="mst-label">Materias (separadas por coma)</p>
        <input class="mst-input" id="mst-materias" value="${escapar(maestro.materias.join(', '))}" placeholder="Ej: Cal. Dif, Cal. Vec, Ec. Dif" />

        <p class="mst-label">Semestres (separados por coma)</p>
        <input class="mst-input" id="mst-semestres" value="${escapar(maestro.semestres.join(', '))}" placeholder="Ej: 2do, 3ro, 4to" />

        <button class="mst-boton-grande" id="mst-guardar">Guardar cambios</button>
      </div>
    </div>
  `);

  let tituloSel = maestro.titulo;
  overlay.querySelectorAll('[data-titulo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      tituloSel = btn.dataset.titulo;
      overlay.querySelectorAll('[data-titulo]').forEach((b) => b.classList.toggle('seleccionado', b === btn));
    });
  });

  const btnGuardar = overlay.querySelector('#mst-guardar');
  btnGuardar.addEventListener('click', async () => {
    const nombre = overlay.querySelector('#mst-nombre').value.trim();
    const apellidoPat = overlay.querySelector('#mst-apellido-pat').value.trim();
    const apellidoMat = overlay.querySelector('#mst-apellido-mat').value.trim();
    if (!nombre || !apellidoPat || !apellidoMat) {
      mostrarToast('Nombre y apellidos son obligatorios.', 'error');
      return;
    }
    const departamento = overlay.querySelector('#mst-depto').value || null;
    const materias = overlay.querySelector('#mst-materias').value.split(',').map((s) => s.trim()).filter(Boolean);
    const semestres = overlay.querySelector('#mst-semestres').value.split(',').map((s) => s.trim()).filter(Boolean);

    btnGuardar.disabled = true;
    btnGuardar.innerHTML = `<span class="mst-spinner-boton"></span>`;

    try {
      await maestrosRepository.actualizarMaestro({ id: maestro.id, nombre, apellidoPat, apellidoMat, titulo: tituloSel, departamento, materias, semestres });
      cerrar();
      onGuardado({ ...maestro, nombre, apellidoPat, apellidoMat, titulo: tituloSel, departamento, materias, semestres });
    } catch (e) {
      console.error('maestro-card – actualizarMaestro:', e);
      mostrarToast('No se pudo guardar. Intenta de nuevo.', 'error');
      btnGuardar.disabled = false;
      btnGuardar.textContent = 'Guardar cambios';
    }
  });
}

function mostrarFormularioEvaluacion(maestro, onGuardado) {
  let estrellas = 0;
  const { overlay, cerrar } = abrirOverlay(`
    <div class="mst-sheet">
      <div class="mst-sheet__manija"></div>
      <p class="mst-sheet__titulo">Evaluar a ${escapar(nombreCompletoMaestro(maestro))}</p>
      <p class="mst-label" style="text-align:center;margin-top:16px">Puntuación</p>
      <div class="mst-estrellas-select">
        ${Array.from({ length: 5 }, (_, i) => `<button class="mst-estrella-btn" data-valor="${i + 1}">☆</button>`).join('')}
      </div>
      <p class="mst-label">Comentario (opcional)</p>
      <textarea class="mst-textarea" id="mst-comentario" rows="3" placeholder="Comparte tu experiencia con este docente..."></textarea>
      <button class="mst-boton-grande" id="mst-publicar">Publicar evaluación</button>
    </div>
  `);

  const botones = overlay.querySelectorAll('.mst-estrella-btn');
  botones.forEach((btn) => {
    btn.addEventListener('click', () => {
      estrellas = Number(btn.dataset.valor);
      botones.forEach((b, i) => {
        b.textContent = i < estrellas ? '★' : '☆';
        b.classList.toggle('activa', i < estrellas);
      });
    });
  });

  const btnPublicar = overlay.querySelector('#mst-publicar');
  btnPublicar.addEventListener('click', async () => {
    if (estrellas === 0) {
      mostrarToast('Selecciona al menos una estrella.', 'error');
      return;
    }
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    const uid = user?.id;
    if (!uid) return;

    const comentario = overlay.querySelector('#mst-comentario').value.trim();
    btnPublicar.disabled = true;
    btnPublicar.innerHTML = `<span class="mst-spinner-boton"></span>`;

    try {
      await maestrosRepository.crearEvaluacion({ maestroId: maestro.id, usuarioId: uid, estrellas, comentario: comentario || null });
      cerrar();
      onGuardado();
    } catch (e) {
      console.error('maestro-card – crearEvaluacion:', e);
      mostrarToast('No se pudo publicar. Intenta de nuevo.', 'error');
      btnPublicar.disabled = false;
      btnPublicar.textContent = 'Publicar evaluación';
    }
  });
}