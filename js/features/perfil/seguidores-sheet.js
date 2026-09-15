// seguidores-sheet.js
// Ruta real: js/features/perfil/seguidores-sheet.js
//
// Puerto de SeguidoresSheet.dart. Usa el shell compartido
// abrirHojaInferior() (core/bottom-sheet.js) en vez de un overlay
// hecho a mano — este sí es el caso "grande" (título + buscador +
// lista arrastrable) para el que existe ese shell, a diferencia del
// mini-overlay de 2 botones que mi-perfil-screen.js arma por su
// cuenta para el menú del avatar.
//
// DIFERENCIA DE PLATAFORMA — ver perfil de otra persona: el Dart
// navega a PerfilPublico.dart. Esa pantalla aún no existe en el
// port web, así que _irAlPerfil() muestra un toast "próximamente"
// para cualquier fila que no sea la del propio usuario. Reemplazar
// por un import real cuando se porte PerfilPublico.dart.
//
// DIFERENCIA DE PLATAFORMA — ir a "Mi Perfil": en el shell web, Mi
// Perfil es una pestaña (shell.js → cambiarPestana), no una ruta con
// URL propia, y shell.js no expone cambiarPestana() a otros módulos.
// Por eso onMiPerfilTap es responsabilidad de quien abre el sheet —
// si no se pasa, tocar tu propia fila solo cierra el sheet. Hoy el
// único lugar que abre este sheet es Mi Perfil mismo, así que ese
// caso (verte a ti mismo en tu propia lista) es un límite raro y
// aceptable por ahora.

import { supabaseClient } from '../../core/supabase-client.js';
import { mostrarToast } from '../../core/toast.js';
import { resolverUrlPerfil } from '../../core/perfil-utils.js';
import { abrirHojaInferior } from '../../core/bottom-sheet.js';

export const TipoLista = { SEGUIDORES: 'seguidores', SEGUIDOS: 'seguidos' };

/**
 * @param {Object} opciones
 * @param {string} opciones.usuarioId - de quién se lista seguidores/seguidos.
 * @param {'seguidores'|'seguidos'} opciones.tipo
 * @param {boolean} [opciones.puedeVer] - false muestra la pantalla de candado.
 * @param {string|null} [opciones.uid] - usuario autenticado actual (para marcar "(Tú)").
 * @param {() => void} [opciones.onMiPerfilTap] - se llama si se toca la propia fila.
 * @param {string|null} [opciones.nombreUsuario] - para el mensaje del candado.
 */
export function mostrarSeguidoresSheet({
  usuarioId,
  tipo,
  puedeVer = true,
  uid = null,
  onMiPerfilTap = null,
  nombreUsuario = null,
}) {
  const estado = { todos: [], filtrados: [], cargando: puedeVer, filtroActivo: false };
  const titulo = tipo === TipoLista.SEGUIDORES ? 'Seguidores' : 'Siguiendo';
  const icono = tipo === TipoLista.SEGUIDORES ? '👥' : '➕';

  const { cuerpo, cerrar } = abrirHojaInferior({
    initialChildSize: puedeVer ? 0.6 : 0.45,
    maxChildSize: 0.95,
    minChildSize: 0.35,
  });

  pintar();
  if (puedeVer) cargar();

  async function cargar() {
    try {
      let resultado = [];
      if (tipo === TipoLista.SEGUIDORES) {
        const { data, error } = await supabaseClient
          .from('seguidores')
          .select('seguidor_id, perfiles!seguidores_seguidor_id_fkey(id, nombre, nombre_usuario, cdn_foto_perfil, carrera, semestre)')
          .eq('seguido_id', usuarioId);
        if (error) throw error;
        resultado = (data ?? []).map((r) => r.perfiles);
      } else {
        const { data, error } = await supabaseClient
          .from('seguidores')
          .select('seguido_id, perfiles!seguidores_seguido_id_fkey(id, nombre, nombre_usuario, cdn_foto_perfil, carrera, semestre)')
          .eq('seguidor_id', usuarioId);
        if (error) throw error;
        resultado = (data ?? []).map((r) => r.perfiles);
      }
      estado.todos = resultado;
      estado.filtrados = resultado;
    } catch (error) {
      console.error('seguidores-sheet – cargar:', error);
    } finally {
      estado.cargando = false;
      pintar();
    }
  }

  function pintar() {
    if (!puedeVer) {
      cuerpo.innerHTML = plantillaCandado();
      return;
    }
    if (estado.cargando) {
      cuerpo.innerHTML = `
        <div class="sg-titulo"><span>${icono}</span> ${titulo}</div>
        <div class="sg-cargando"><span class="btn-spinner"></span></div>
      `;
      return;
    }
    cuerpo.innerHTML = `
      <div class="sg-titulo sg-titulo--activo"><span>${icono}</span> ${titulo} · ${estado.todos.length}</div>
      <div class="sg-buscador">
        <input type="text" class="sg-buscador__input" placeholder="Buscar…" id="sg-input-busqueda" />
      </div>
      <div class="sg-contenido" id="sg-contenido"></div>
    `;
    cuerpo.querySelector('#sg-input-busqueda').addEventListener('input', (e) => filtrar(e.target.value));
    pintarContenidoLista();
  }

  function pintarContenidoLista() {
    const contenedor = cuerpo.querySelector('#sg-contenido');
    if (!contenedor) return;
    if (estado.filtrados.length === 0) {
      contenedor.innerHTML = `
        <div class="sg-vacio">
          <span class="sg-vacio__icono">🔍</span>
          <p>${estado.filtroActivo ? 'Sin resultados' : 'Aún no hay nadie aquí'}</p>
        </div>
      `;
      return;
    }
    contenedor.innerHTML = `<div class="sg-lista">${estado.filtrados.map(filaHtml).join('')}</div>`;
    contenedor.querySelectorAll('[data-sg-fila]').forEach((el) => {
      el.addEventListener('click', () => irAlPerfil(el.dataset.sgFila));
    });
  }

  // Solo repinta #sg-contenido (no todo el cuerpo) para no perder el
  // foco del input mientras se escribe.
  function filtrar(texto) {
    const q = texto.toLowerCase().trim();
    estado.filtroActivo = q.length > 0;
    estado.filtrados = q === ''
      ? estado.todos
      : estado.todos.filter((p) => {
          const nombre = (p.nombre ?? '').toLowerCase();
          const usuario = (p.nombre_usuario ?? '').toLowerCase();
          return nombre.includes(q) || usuario.includes(q);
        });
    pintarContenidoLista();
  }

  function filaHtml(p) {
    const userId = p.id ?? '';
    const nombre = p.nombre ?? '';
    const usuario = p.nombre_usuario ?? '';
    const carrera = p.carrera ?? '';
    const semestre = p.semestre ?? null;
    const foto = resolverUrlPerfil(p);
    const esPropio = userId === uid;
    const carreraTexto = semestre != null ? `${carrera} · ${semestre}° sem.` : carrera;

    return `
      <button class="sg-fila" data-sg-fila="${userId}">
        <div class="sg-fila__avatar">${foto ? `<img src="${foto}" alt="" />` : '<span>👤</span>'}</div>
        <div class="sg-fila__info">
          <p class="sg-fila__nombre">${escaparHtml(nombre)}${esPropio ? '  (Tú)' : ''}</p>
          ${usuario ? `<p class="sg-fila__usuario">@${escaparHtml(usuario)}</p>` : ''}
          ${carrera ? `<p class="sg-fila__carrera">🎓 ${escaparHtml(carreraTexto)}</p>` : ''}
        </div>
        <span class="sg-fila__chevron">›</span>
      </button>
    `;
  }

  function plantillaCandado() {
    const mensaje = nombreUsuario
      ? `Sigue a ${nombreUsuario.split(' ')[0]} para ver su lista de ${titulo}`
      : `Sigue a este usuario para ver su lista de ${titulo}`;
    return `
      <div class="sg-candado">
        <div class="sg-candado__icono">🔒</div>
        <p class="sg-candado__titulo">Lista privada</p>
        <p class="sg-candado__texto">${escaparHtml(mensaje)}</p>
      </div>
    `;
  }

  // TODO PENDIENTE: reemplazar por navegación real a PerfilPublico.js
  // en cuanto se porte PerfilPublico.dart.
  function irAlPerfil(userId) {
    if (userId === uid) {
      cerrar();
      onMiPerfilTap?.();
    } else {
      mostrarToast('Ver perfil — próximamente', 'error');
    }
  }
}

function escaparHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}