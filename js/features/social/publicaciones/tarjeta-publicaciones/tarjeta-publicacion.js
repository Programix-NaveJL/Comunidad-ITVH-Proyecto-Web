// tarjeta-publicacion.js
// Ruta real sugerida: js/features/social/publicaciones/tarjeta-publicaciones/tarjeta-publicacion.js
//
// Puerto de tarjeta_publicacion.dart. Ensambla todo lo demás de esta
// carpeta: galeria-multimedia.js, pill-button.js, reacciones.js,
// hoja-comentarios.js, hoja-etiquetados.js y hoja-reacciones.js.
//
// Patrón render()+activar() ya usado en el resto del proyecto:
//   renderTarjetaPublicacion(post) arma el HTML del shell (útil para
//   pintar varias tarjetas de una vez con .map().join(''), como hace
//   pantalla-principal.js con sus posts).
//   activarTarjetaPublicacion(elRaiz, post, opciones), llamado sobre
//   cada tarjeta ya insertada en el DOM, engancha todo lo interactivo
//   y dispara los fetches propios de la tarjeta (reacciones, total de
//   comentarios, etiquetados) — igual que el initState() del Dart
//   original, que no depende de lo que traiga el post del feed más
//   allá de un valor inicial.
//
// Las hojas hijas (comentarios/reacciones/etiquetados) siguen el
// tema activo por sí solas vía las variables CSS de bottom-sheet.css
// — esta tarjeta no necesita calcular ni propagarles ningún booleano
// de tema.
//
// PENDIENTES EXPLÍCITOS (no bloquean este archivo, documentados
// donde ocurren más abajo):
//   - "Reportar" en el menú de opciones debería abrir
//     reportar-publicacion.js — aún no portado. Mismo placeholder.
//   - Eliminar publicación borra la fila en Supabase, pero la
//     limpieza de archivos en Cloudflare R2 queda con TODO explícito
//     (mismo pendiente ya documentado en ajustes.js para "eliminar
//     cuenta" — no se inventa aquí la firma real de
//     storage-service.js/r2-config.js sin haberlos visto).

import { supabaseClient } from '../../../../core/supabase-client.js';
import { navegarA } from '../../../../core/router.js';
import { mostrarToast } from '../../../../core/toast.js';
import { resolverUrlPerfil } from '../../../../core/perfil-utils.js';
import { pillBtn } from './pill-button.js';
import { montarBotonReaccion } from './reacciones.js';
import { renderGaleriaMultimedia, activarGaleriaMultimedia } from './galeria-multimedia.js';
import { abrirHojaComentarios } from './hoja-comentarios.js';
import { abrirHojaEtiquetados } from './hoja-etiquetados.js';
import { abrirHojaConReacciones } from './hoja-reacciones.js';
import { abrirVisorMedia } from '../visor-media.js';
import { mostrarReporteSheet } from '../reportar-publicacion.js';

/**
 * Arma el HTML del shell de una tarjeta de publicación. No engancha
 * ninguna interacción todavía — usar activarTarjetaPublicacion()
 * después de insertar en el DOM.
 *
 * @param {Object} post - fila de 'publicaciones' con 'perfiles' y 'publicacion_medios' embebidos.
 */
export function renderTarjetaPublicacion(post) {
  const perfil = post.perfiles ?? {};
  const medios = post.publicacion_medios ?? [];
  const fotoUrl = resolverUrlPerfil(perfil);
  const tiempo = tiempoRelativo(post.creado_en);
  const contenido = post.contenido ?? '';

  return `
    <article class="tarjeta-publicacion glass-card" data-post-id="${post.id}">
      <div class="tarjeta-publicacion__header">
        <div class="tarjeta-publicacion__avatar" data-autor-tap>
          ${fotoUrl ? `<img src="${fotoUrl}" alt="" />` : '<span>👤</span>'}
        </div>
        <div class="tarjeta-publicacion__autor-info">
          <p class="tarjeta-publicacion__nombre" data-autor-tap>${escaparHtml(perfil.nombre ?? '')}</p>
          <p class="tarjeta-publicacion__meta" data-autor-tap>@${escaparHtml(perfil.nombre_usuario ?? '')} · ${tiempo}</p>
          <div class="tarjeta-publicacion__etiquetados" data-etiquetados-linea></div>
        </div>
        <button class="tarjeta-publicacion__opciones" data-opciones aria-label="Opciones">⋯</button>
      </div>

      ${
        contenido
          ? `
        <div class="tarjeta-publicacion__texto-zona">
          <p class="tarjeta-publicacion__texto" data-texto>${escaparHtml(contenido)}</p>
          <button class="tarjeta-publicacion__ver-mas" data-ver-mas hidden>Ver más</button>
        </div>
      `
          : ''
      }

      ${medios.length > 0 ? `<div class="tarjeta-publicacion__galeria" data-galeria>${renderGaleriaMultimedia(medios)}</div>` : ''}

      <div class="tarjeta-publicacion__footer">
        <span class="tarjeta-publicacion__reaccion-slot" data-reaccion-slot></span>
        <span class="tarjeta-publicacion__comentar-slot" data-comentar-slot></span>
        <span class="tarjeta-publicacion__spacer"></span>
        <span class="tarjeta-publicacion__resumen" data-resumen hidden></span>
      </div>
    </article>
  `;
}

/**
 * Engancha las interacciones de una tarjeta YA insertada en el DOM y
 * dispara sus fetches propios (reacciones, total de comentarios,
 * etiquetados).
 *
 * @param {HTMLElement} elRaiz - elemento devuelto por renderTarjetaPublicacion(), ya en el DOM.
 * @param {Object} post
 * @param {Object} opciones
 * @param {?Function} [opciones.onRefresh] - se llama tras eliminar la publicación (para que el feed la quite de la lista).
 * @param {?Function} [opciones.onAutorTap] - si no se da, cae al placeholder de navegación ya usado en el resto del proyecto.
 * @param {?Function} [opciones.onMiPerfilTap]
 */
export function activarTarjetaPublicacion(elRaiz, post, opciones) {
  const { onRefresh = null, onAutorTap = null, onMiPerfilTap = null } = opciones;

  let uidActual = null;
  let miReaccion = null;
  let totalLikes = post.total_reacciones ?? 0;
  let totalComentarios = post.total_comentarios ?? 0;
  let conteoPorEmoji = {};
  let topEmojis = [];
  let etiquetados = [];

  const medios = post.publicacion_medios ?? [];
  const elReaccionSlot = elRaiz.querySelector('[data-reaccion-slot]');
  const elComentarSlot = elRaiz.querySelector('[data-comentar-slot]');
  const elResumen = elRaiz.querySelector('[data-resumen]');
  const elEtiquetadosLinea = elRaiz.querySelector('[data-etiquetados-linea]');
  const elGaleria = elRaiz.querySelector('[data-galeria]');
  const elTexto = elRaiz.querySelector('[data-texto]');
  const elVerMas = elRaiz.querySelector('[data-ver-mas]');

  montarReaccionBtn();
  actualizarComentarBtn();
  configurarTextoExpandible();
  if (elGaleria) activarGaleriaMultimedia(elGaleria, onMedioTap);

  elComentarSlot.addEventListener('click', mostrarComentarios);
  elResumen.addEventListener('click', mostrarReacciones);
  elRaiz.querySelectorAll('[data-autor-tap]').forEach((el) => el.addEventListener('click', irAlPerfilAutor));
  elRaiz.querySelector('[data-opciones]').addEventListener('click', mostrarOpciones);

  init();

  async function init() {
    const { data } = await supabaseClient.auth.getUser();
    uidActual = data?.user?.id ?? null;
    await Promise.all([cargarReacciones(), cargarTotalComentarios(), cargarEtiquetados()]);
  }

  // ── Reacciones ─────────────────────────────────────────────────

  async function cargarReacciones() {
    try {
      const { data, error } = await supabaseClient.from('reacciones').select('usuario_id, tipo').eq('publicacion_id', post.id);
      if (error) throw error;

      const lista = data ?? [];
      const conteo = {};
      lista.forEach((r) => {
        if (!r.tipo) return;
        conteo[r.tipo] = (conteo[r.tipo] ?? 0) + 1;
      });
      const topOrdenado = Object.entries(conteo).sort((a, b) => b[1] - a[1]);

      totalLikes = lista.length;
      miReaccion = uidActual ? (lista.find((r) => r.usuario_id === uidActual)?.tipo ?? null) : miReaccion;
      conteoPorEmoji = conteo;
      topEmojis = topOrdenado.slice(0, 2).map(([emoji]) => emoji);

      montarReaccionBtn();
      actualizarResumen();
    } catch (error) {
      console.error('tarjeta-publicacion – cargarReacciones:', error);
    }
  }

  async function reaccionar(tipo) {
    if (!uidActual) return;
    const antes = miReaccion;
    const conteoAntes = { ...conteoPorEmoji };
    const topAntes = [...topEmojis];
    const totalAntes = totalLikes;

    if (antes == null && tipo != null) totalLikes += 1;
    if (antes != null && tipo == null) totalLikes -= 1;
    if (antes != null) {
      conteoPorEmoji[antes] = (conteoPorEmoji[antes] ?? 1) - 1;
      if (conteoPorEmoji[antes] <= 0) delete conteoPorEmoji[antes];
    }
    if (tipo != null) conteoPorEmoji[tipo] = (conteoPorEmoji[tipo] ?? 0) + 1;
    topEmojis = Object.entries(conteoPorEmoji)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([emoji]) => emoji);
    miReaccion = tipo;
    montarReaccionBtn();
    actualizarResumen();

    try {
      if (tipo == null) {
        await supabaseClient.from('reacciones').delete().eq('publicacion_id', post.id).eq('usuario_id', uidActual);
      } else if (antes == null) {
        await supabaseClient.from('reacciones').insert({ publicacion_id: post.id, usuario_id: uidActual, tipo });
      } else {
        await supabaseClient.from('reacciones').update({ tipo }).eq('publicacion_id', post.id).eq('usuario_id', uidActual);
      }
    } catch (error) {
      console.error('tarjeta-publicacion – reaccionar:', error);
      miReaccion = antes;
      totalLikes = totalAntes;
      conteoPorEmoji = conteoAntes;
      topEmojis = topAntes;
      montarReaccionBtn();
      actualizarResumen();
    }
  }

  function montarReaccionBtn() {
    montarBotonReaccion(elReaccionSlot, {
      reaccionActual: miReaccion,
      onSeleccionar: reaccionar,
      label: totalLikes > 0 ? totalLikes : null,
      tamano: 'normal',
    });
  }

  function actualizarResumen() {
    if (totalLikes === 0) {
      elResumen.hidden = true;
      return;
    }
    elResumen.hidden = false;
    elResumen.innerHTML = `${renderEmojisApilados(topEmojis)}<span class="tarjeta-publicacion__resumen-total">${totalLikes}</span>`;
  }

  // Vuelve a consultar la lista COMPLETA (con perfiles embebidos)
  // para el sheet — misma duplicación que el Dart original entre
  // _mostrarReacciones() y mostrarReaccionesSheet() de
  // hoja_reacciones.dart: cargarReacciones() de arriba trae solo lo
  // necesario para el resumen de la tarjeta, esta consulta trae
  // además los perfiles para poder listarlos en la hoja.
  async function mostrarReacciones() {
    try {
      const { data, error } = await supabaseClient
        .from('reacciones')
        .select('usuario_id, tipo, perfiles!reacciones_usuario_id_fkey(id, nombre, nombre_usuario, cdn_foto_perfil)')
        .eq('publicacion_id', post.id);
      if (error) throw error;

      const reacciones = data ?? [];
      if (reacciones.length !== totalLikes) {
        totalLikes = reacciones.length;
        actualizarResumen();
      }
      abrirHojaConReacciones({ reacciones, totalLikes: reacciones.length, uid: uidActual, onMiPerfilTap });
    } catch (error) {
      console.error('tarjeta-publicacion – mostrarReacciones:', error);
    }
  }

  // ── Comentarios ──────────────────────────────────────────────

  async function cargarTotalComentarios() {
    try {
      const { data, error } = await supabaseClient.from('comentarios').select('id').eq('publicacion_id', post.id);
      if (error) throw error;
      totalComentarios = (data ?? []).length;
      actualizarComentarBtn();
    } catch (error) {
      console.error('tarjeta-publicacion – cargarTotalComentarios:', error);
    }
  }

  function actualizarComentarBtn() {
    elComentarSlot.innerHTML = pillBtn({ icono: '💬', label: totalComentarios > 0 ? totalComentarios : null });
  }

  function mostrarComentarios() {
    abrirHojaComentarios({ post, uid: uidActual, onMiPerfilTap, onCerrar: cargarTotalComentarios });
  }

  // ── Etiquetados ──────────────────────────────────────────────

  async function cargarEtiquetados() {
    try {
      const { data, error } = await supabaseClient
        .from('publicacion_etiquetas')
        .select('usuario_id, perfiles!publicacion_etiquetas_usuario_fkey(id, nombre, nombre_usuario, cdn_foto_perfil)')
        .eq('publicacion_id', post.id);
      if (error) throw error;

      etiquetados = (data ?? []).map((fila) => fila.perfiles).filter(Boolean);
      renderLineaEtiquetados();
    } catch (error) {
      console.error('tarjeta-publicacion – cargarEtiquetados:', error);
    }
  }

  function renderLineaEtiquetados() {
    if (etiquetados.length === 0) {
      elEtiquetadosLinea.innerHTML = '';
      return;
    }
    const visibles = etiquetados.slice(0, 2);
    const restantes = etiquetados.length - visibles.length;

    let html = '<span class="tarjeta-publicacion__con">Con </span>';
    visibles.forEach((u, i) => {
      html += `<span class="tarjeta-publicacion__etiquetado-nombre" data-usuario-id="${u.id ?? ''}">${escaparHtml(u.nombre ?? '')}</span>`;
      const esUltimo = i === visibles.length - 1;
      if (!esUltimo) {
        html += '<span class="tarjeta-publicacion__coma">, </span>';
      } else if (restantes > 0) {
        html += `<span class="tarjeta-publicacion__mas" data-ver-etiquetados> y ${restantes} ${restantes === 1 ? 'persona más' : 'personas más'}</span>`;
      }
    });
    elEtiquetadosLinea.innerHTML = html;

    elEtiquetadosLinea.querySelectorAll('[data-usuario-id]').forEach((el) => {
      el.addEventListener('click', () => irAlPerfil(el.dataset.usuarioId));
    });
    const verMasEl = elEtiquetadosLinea.querySelector('[data-ver-etiquetados]');
    if (verMasEl) verMasEl.addEventListener('click', mostrarEtiquetados);
  }

  function mostrarEtiquetados() {
    if (etiquetados.length === 0) return;
    abrirHojaEtiquetados({ etiquetados, uid: uidActual, onMiPerfilTap });
  }

  // ── Texto expandible ("Ver más"/"Ver menos") ────────────────

  function configurarTextoExpandible() {
    if (!elTexto || !elVerMas) return;
    elTexto.classList.add('tarjeta-publicacion__texto--clamp');
    requestAnimationFrame(() => {
      const desborda = elTexto.scrollHeight > elTexto.clientHeight + 1;
      if (!desborda) return;
      elVerMas.hidden = false;
      elVerMas.addEventListener('click', () => {
        const expandido = elTexto.classList.toggle('tarjeta-publicacion__texto--expandido');
        elTexto.classList.toggle('tarjeta-publicacion__texto--clamp', !expandido);
        elVerMas.textContent = expandido ? 'Ver menos' : 'Ver más';
      });
    });
  }

  // ── Navegación a perfil — mismo placeholder ya usado en el resto
  // del proyecto (ver item-comentario.js) mientras no se porta
  // perfil-helper.js / el módulo Mi Perfil ─────────────────────

  function irAlPerfilAutor() {
    const autorId = post.autor_id ?? '';
    const esPropio = autorId === uidActual;
    if (esPropio) {
      if (onMiPerfilTap) onMiPerfilTap();
      else navegarA('/perfil/editar'); // TODO: pendiente módulo Mi Perfil
    } else if (onAutorTap) {
      onAutorTap();
    } else if (autorId) {
      navegarA(`/perfil-publico/${autorId}`); // TODO: pendiente módulo Mi Perfil
    }
  }

  function irAlPerfil(usuarioId) {
    if (!usuarioId) return;
    if (usuarioId === uidActual) {
      if (onMiPerfilTap) onMiPerfilTap();
      else navegarA('/perfil/editar'); // TODO: pendiente módulo Mi Perfil
    } else {
      navegarA(`/perfil-publico/${usuarioId}`); // TODO: pendiente módulo Mi Perfil
    }
  }

  // ── Medio tocado en la galería ───────────────────────────────

  function onMedioTap(indice) {
    abrirVisorMedia({
      medios,
      indiceInicial: indice,
      post,
      reaccionInicial: miReaccion,
      totalLikes,
      totalComentarios,
      onReaccionar: reaccionar,
      uid: uidActual,
      onMiPerfilTap,
    });
  }

  // ── Menú de opciones (⋯) ─────────────────────────────────────

  function mostrarOpciones() {
    const esMio = post.autor_id === uidActual;
    const overlay = document.createElement('div');
    overlay.className = 'tp-opciones-overlay';
    overlay.innerHTML = `
      <div class="tp-opciones-menu">
        <div class="tp-opciones-menu__manija"></div>
        ${
          esMio
            ? `<button class="tp-opciones-menu__item tp-opciones-menu__item--peligro" data-eliminar>🗑️ Eliminar publicación</button>`
            : `<button class="tp-opciones-menu__item" data-reportar>🚩 Reportar</button>`
        }
        <button class="tp-opciones-menu__item" data-cancelar>✕ Cancelar</button>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    function cerrar() {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 180);
    }

    overlay.addEventListener('click', (evento) => {
      if (evento.target === overlay) cerrar();
    });
    overlay.querySelector('[data-cancelar]').addEventListener('click', cerrar);
    overlay.querySelector('[data-eliminar]')?.addEventListener('click', () => {
      cerrar();
      eliminarPublicacion();
    });
    overlay.querySelector('[data-reportar]')?.addEventListener('click', () => {
      cerrar();
      mostrarReporteSheet({ post, uid: uidActual, onMiPerfilTap, onRefresh });
    });
  }

  async function eliminarPublicacion() {
    try {
      await supabaseClient.from('publicaciones').delete().eq('id', post.id);

      // TODO: pendiente conectar la limpieza de los archivos en
      // Cloudflare R2 (mismo pendiente ya documentado en ajustes.js
      // para "eliminar cuenta" — no se invoca aquí storage-service.js
      // sin haber confirmado su firma real de export).

      onRefresh?.();
    } catch (error) {
      console.error('tarjeta-publicacion – eliminarPublicacion:', error);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS LOCALES
// ═══════════════════════════════════════════════════════════════

function renderEmojisApilados(emojis) {
  if (emojis.length === 0) return '';
  if (emojis.length === 1) {
    return `<span class="tp-emojis-apilados tp-emojis-apilados--1"><span class="tp-emoji-circulo tp-emoji-circulo--frente">${emojis[0]}</span></span>`;
  }
  return `
    <span class="tp-emojis-apilados tp-emojis-apilados--2">
      <span class="tp-emoji-circulo tp-emoji-circulo--atras">${emojis[1]}</span>
      <span class="tp-emoji-circulo tp-emoji-circulo--frente">${emojis[0]}</span>
    </span>
  `;
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
  const seg = Math.floor(diffMs / 1000);
  const min = Math.floor(diffMs / 60000);
  const horas = Math.floor(diffMs / 3600000);
  const dias = Math.floor(diffMs / 86400000);
  if (seg < 60) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  if (horas < 24) return `hace ${horas} h`;
  if (dias < 7) return `hace ${dias} d`;
  return `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
}