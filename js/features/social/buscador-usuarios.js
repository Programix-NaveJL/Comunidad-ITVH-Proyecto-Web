// Pantalla de búsqueda de usuarios, accesible desde el ícono de
// lupa en el encabezado del feed social ("Comunidad").
//
// Responsabilidades:
//   1. "Personas que quizás conozcas": prioriza usuarios de la
//      misma carrera que el usuario actual y que aún no sigue,
//      completando con los de mayor total_seguidores.
//   2. Resultados de búsqueda en vivo (debounce de 400ms) por
//      nombre o @usuario.
//   3. Botón seguir/dejar de seguir con actualización optimista
//      (revierte el estado local si la escritura en Supabase falla).
//
// Pendiente: al tocar un resultado se navega a
// '/perfil-publico/<id>', ruta que todavía no existe porque el
// módulo "Mi Perfil" no se ha portado. En cuanto se construya ese
// módulo y registre esa ruta, este archivo no necesita cambios.

import { supabaseClient } from '../../core/supabase-client.js';
import { registrarRuta, navegarA } from '../../core/router.js';
import { resolverUrlPerfil } from '../../core/perfil-utils.js';

registrarRuta('/buscador-usuarios', render);

// Estado del módulo. Se reinicia en cada render() porque el archivo
// se importa una sola vez pero la pantalla puede abrirse varias
// veces durante la sesión.
let uidActual = null;
let sugerencias = [];
let resultados = [];
let siguiendo = new Set();
let cargandoSugerencias = true;
let buscando = false;
let hayBusqueda = false;
let debounceTimer = null;

async function render(contenedor) {
  uidActual = null;
  sugerencias = [];
  resultados = [];
  siguiendo = new Set();
  cargandoSugerencias = true;
  buscando = false;
  hayBusqueda = false;
  clearTimeout(debounceTimer);
  debounceTimer = null;

  contenedor.innerHTML = plantillaBase();
  activarInteracciones(contenedor);
  renderCuerpo(contenedor);

  const { data } = await supabaseClient.auth.getUser();
  uidActual = data?.user?.id ?? null;
  if (!uidActual) return;

  await cargarEstadoSeguidos();
  await cargarSugerencias();
  renderCuerpo(contenedor);
}

function plantillaBase() {
  return `
    <div class="buscador">
      <header class="buscador-header">
        <button class="buscador-volver" id="buscador-volver" aria-label="Regresar">‹</button>
        <div class="buscador-campo">
          <span class="buscador-campo__icono">🔍</span>
          <input
            type="text"
            id="buscador-input"
            placeholder="Buscar por nombre o @usuario"
            autocomplete="off"
            autofocus
          />
          <button class="buscador-campo__limpiar" id="buscador-limpiar" aria-label="Limpiar" hidden>✕</button>
        </div>
      </header>
      <div class="buscador-cuerpo" id="buscador-cuerpo"></div>
    </div>
  `;
}

// ── Carga de datos ──────────────────────────────────────────────

async function cargarEstadoSeguidos() {
  try {
    const { data, error } = await supabaseClient
      .from('seguidores')
      .select('seguido_id')
      .eq('seguidor_id', uidActual);
    if (error) throw error;
    siguiendo = new Set((data ?? []).map((f) => f.seguido_id));
  } catch (error) {
    console.error('buscador-usuarios – seguidos:', error);
  }
}

async function cargarSugerencias() {
  try {
    const { data: miPerfil } = await supabaseClient
      .from('perfiles')
      .select('carrera')
      .eq('id', uidActual)
      .maybeSingle();

    const miCarrera = miPerfil?.carrera ?? null;

    const { data, error } = await supabaseClient
        .from('perfiles')
        .select('id, nombre, nombre_usuario, cdn_foto_perfil, carrera, total_seguidores')
        .neq('id', uidActual)
        .order('total_seguidores', { ascending: false })
        .limit(20);
    if (error) throw error;

    const todos = data ?? [];
    const mismaCarrera = todos.filter(
      (u) => miCarrera && u.carrera === miCarrera && !siguiendo.has(u.id)
    );
    const otros = todos.filter(
      (u) => !siguiendo.has(u.id) && !mismaCarrera.some((m) => m.id === u.id)
    );

    sugerencias = [...mismaCarrera, ...otros].slice(0, 10);
  } catch (error) {
    console.error('buscador-usuarios – sugerencias:', error);
  } finally {
    cargandoSugerencias = false;
  }
}

async function buscar(contenedor, texto) {
  buscando = true;
  renderCuerpo(contenedor);

  try {
    const q = texto.startsWith('@') ? texto.slice(1) : texto;
    const { data, error } = await supabaseClient
        .from('perfiles')
        .select('id, nombre, nombre_usuario, cdn_foto_perfil, carrera')
        .neq('id', uidActual)
        .or(`nombre.ilike.%${q}%,nombre_usuario.ilike.%${q}%`)
        .limit(20);
    if (error) throw error;
    resultados = data ?? [];
  } catch (error) {
    console.error('buscador-usuarios – buscar:', error);
    resultados = [];
  } finally {
    buscando = false;
    renderCuerpo(contenedor);
  }
}

// ── Seguir / dejar de seguir (optimista) ──────────────────────────

async function toggleFollow(contenedor, usuarioId) {
  const yaSigo = siguiendo.has(usuarioId);

  if (yaSigo) siguiendo.delete(usuarioId);
  else siguiendo.add(usuarioId);
  renderCuerpo(contenedor);

  try {
    if (yaSigo) {
      const { error } = await supabaseClient
        .from('seguidores')
        .delete()
        .eq('seguidor_id', uidActual)
        .eq('seguido_id', usuarioId);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient
        .from('seguidores')
        .insert({ seguidor_id: uidActual, seguido_id: usuarioId });
      if (error) throw error;
    }
  } catch (error) {
    console.error('buscador-usuarios – follow:', error);
    // Revierte el cambio optimista si la escritura falló.
    if (yaSigo) siguiendo.add(usuarioId);
    else siguiendo.delete(usuarioId);
    renderCuerpo(contenedor);
  }
}

// ── Render del cuerpo (sugerencias o resultados) ──────────────────

function renderCuerpo(contenedor) {
  const cuerpo = contenedor.querySelector('#buscador-cuerpo');
  if (!cuerpo) return;

  if (hayBusqueda) {
    cuerpo.innerHTML = plantillaResultados();
  } else {
    cuerpo.innerHTML = plantillaSugerencias();
  }
}

function plantillaSugerencias() {
  if (cargandoSugerencias) {
    return `<div class="buscador-spinner-zona"><span class="btn-spinner"></span></div>`;
  }
  if (sugerencias.length === 0) {
    return `<p class="buscador-vacio">No hay sugerencias disponibles</p>`;
  }
  return `
    <p class="buscador-titulo-seccion">Personas que quizás conozcas</p>
    ${sugerencias.map((u) => plantillaItemUsuario(u)).join('')}
  `;
}

function plantillaResultados() {
  if (buscando) {
    return `<div class="buscador-spinner-zona"><span class="btn-spinner"></span></div>`;
  }
  if (resultados.length === 0) {
    return `
      <div class="buscador-sin-resultados">
        <span class="buscador-sin-resultados__icono">🔎</span>
        <p>Sin resultados</p>
      </div>
    `;
  }
  return `
    <p class="buscador-titulo-seccion">${resultados.length} resultado${resultados.length === 1 ? '' : 's'}</p>
    ${resultados.map((u) => plantillaItemUsuario(u)).join('')}
  `;
}

function plantillaItemUsuario(usuario) {
  const nombre = usuario.nombre ?? '';
  const usr = usuario.nombre_usuario ?? '';
  const carrera = usuario.carrera ?? '';
  const foto = resolverUrlPerfil(usuario);
  const yaSigo = siguiendo.has(usuario.id);

  return `
    <div class="buscador-item" data-uid="${usuario.id}">
      <div class="buscador-item__click" data-abrir-perfil="${usuario.id}">
        <div class="buscador-item__avatar">
          ${foto ? `<img src="${foto}" alt="" />` : '<span>👤</span>'}
        </div>
        <div class="buscador-item__textos">
          <p class="buscador-item__nombre">${nombre}</p>
          ${usr ? `<p class="buscador-item__usuario">@${usr}</p>` : ''}
          ${carrera ? `<p class="buscador-item__carrera">${carrera}</p>` : ''}
        </div>
      </div>
      <button class="buscador-item__seguir${yaSigo ? ' siguiendo' : ''}" data-seguir="${usuario.id}">
        ${yaSigo ? 'Siguiendo' : 'Seguir'}
      </button>
      <span class="buscador-item__flecha" data-abrir-perfil="${usuario.id}">›</span>
    </div>
  `;
}

// ── Interacciones ──────────────────────────────────────────────

function activarInteracciones(contenedor) {
  contenedor.querySelector('#buscador-volver').addEventListener('click', () => window.history.back());

  const input = contenedor.querySelector('#buscador-input');
  const btnLimpiar = contenedor.querySelector('#buscador-limpiar');

  input.addEventListener('input', () => {
    const texto = input.value.trim();
    btnLimpiar.hidden = texto.length === 0;
    hayBusqueda = texto.length > 0;

    clearTimeout(debounceTimer);
    if (!texto) {
      resultados = [];
      renderCuerpo(contenedor);
      return;
    }
    debounceTimer = setTimeout(() => buscar(contenedor, texto), 400);
  });

  btnLimpiar.addEventListener('click', () => {
    input.value = '';
    btnLimpiar.hidden = true;
    hayBusqueda = false;
    resultados = [];
    renderCuerpo(contenedor);
    input.focus();
  });

  // Delegación de eventos: el cuerpo se vuelve a pintar en cada
  // cambio de estado (seguir, resultados nuevos, etc.), así que un
  // solo listener en el contenedor fijo evita tener que re-adjuntar
  // listeners cada vez.
  const cuerpo = contenedor.querySelector('#buscador-cuerpo');
  cuerpo.addEventListener('click', (evento) => {
    const btnSeguir = evento.target.closest('[data-seguir]');
    if (btnSeguir) {
      toggleFollow(contenedor, btnSeguir.dataset.seguir);
      return;
    }
    const abrirPerfil = evento.target.closest('[data-abrir-perfil]');
    if (abrirPerfil) {
      // TODO: reemplazar por la navegación real cuando exista el
      // módulo "Mi Perfil" (js/features/perfil/).
      navegarA(`/perfil-publico/${abrirPerfil.dataset.abrirPerfil}`);
    }
  });
}