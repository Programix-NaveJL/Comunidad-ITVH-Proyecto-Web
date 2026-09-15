// ver-historia.js
// Puerto de VerHistoria.dart. Punto de entrada del visor: un carrusel
// entre autores (grupos de historias), decidiendo por cada grupo si
// es "propio" o "público" — la misma única bifurcación que hace el
// Dart original en _esGrupoPropio().
//
// DIFERENCIA DE PLATAFORMA: en Dart esto es una pantalla empujada
// con Navigator.push. Aquí, igual que visor-media.js, es un overlay
// abierto por función (abrirVerHistorias), no una ruta con URL
// propia — no hace falta registrarlo en index.html.
//
// El PageView de Dart usa NeverScrollableScrollPhysics (el dedo no
// controla el carrusel directamente; son los gestos DENTRO de cada
// página los que llaman a avanzar/retroceder). Aquí se replica con
// controladores por grupo creados de forma perezosa y mantenidos
// vivos en un Map según el índice — igual que PageView.builder
// conserva el estado de las páginas ya visitadas — así que volver a
// un autor anterior conserva en qué historia se había quedado.

import { supabaseClient } from '../../../../core/supabase-client.js';
import { crearVistaGrupoHistoriaPropia } from './ver-historia-propia.js';
import { crearVistaGrupoHistoriaPublica } from './ver-historia-publica.js';

export function abrirVerHistorias({ grupos, indiceInicial, onIrAMiPerfil = null }) {
  if (!grupos || grupos.length === 0) return;

  const overlay = document.createElement('div');
  overlay.className = 'vh-overlay';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const controladores = new Map(); // índice → controlador ya creado
  let paginaActual = indiceInicial;
  let uidActual = null;

  supabaseClient.auth.getUser().then(({ data }) => {
    uidActual = data?.user?.id ?? null;
  });

  function esGrupoPropio(grupo) {
    return Boolean(grupo.esTuyo) || grupo.autor_id === uidActual;
  }

  function obtenerControlador(indice) {
    if (controladores.has(indice)) return controladores.get(indice);

    const grupo = grupos[indice];
    const esPrimeraPagina = indice === 0;
    const fabrica = esGrupoPropio(grupo) ? crearVistaGrupoHistoriaPropia : crearVistaGrupoHistoriaPublica;

    const controlador = fabrica({
      grupo,
      esPrimeraPagina,
      onAvanzarGrupo: () => irAPagina(indice + 1),
      onRetrocederGrupo: () => irAPagina(indice - 1),
      onCerrarTodo: cerrarTodo,
      onIrAMiPerfil,
    });

    controlador.montar(overlay);
    controladores.set(indice, controlador);
    return controlador;
  }

  function irAPagina(indice) {
    if (indice < 0) return;
    if (indice >= grupos.length) {
      cerrarTodo();
      return;
    }
    controladores.get(paginaActual)?.desactivar();
    paginaActual = indice;
    obtenerControlador(indice).activar();
  }

  function cerrarTodo() {
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
    controladores.forEach((c) => c.destruir());
    controladores.clear();
    setTimeout(() => overlay.remove(), 200);
  }

  // Espera a resolver uidActual antes de decidir propia/pública de
  // la primera página, para no arrancar clasificando mal el grupo
  // inicial mientras la sesión aún carga.
  supabaseClient.auth.getUser().then(() => {
    obtenerControlador(paginaActual).activar();
  });
}