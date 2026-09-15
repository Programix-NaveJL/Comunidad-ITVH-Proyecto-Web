// ═════════════════════════════════════════════════════════════════
// historia.js
//
// Pantalla "Un poco de historia" del Drawer. Réplica funcional de
// historia_plantel_screen.dart: hero fotográfico con badge de fecha
// de fundación, introducción, línea de tiempo vertical con los tres
// hitos históricos del ITVH (1974, 1979, 1992) y un banner de cierre
// "+50 años".
//
// No se registra como ruta propia: plantel.js despacha aquí cuando
// el segundo segmento del hash es 'historia' (#/plantel/historia),
// ya que ambas pantallas comparten la ruta base '/plantel'.
//
// Simplificación consciente respecto al original: en Flutter el
// SliverAppBar colapsa físicamente el hero al hacer scroll. Aquí la
// barra superior queda fija (sticky) sobre el hero en vez de
// encogerlo, y solo se anima la opacidad del título — mismo efecto
// de "aparece al hacer scroll", sin la física de colapso del sliver.
// ═════════════════════════════════════════════════════════════════

/** Altura aproximada del hero antes de considerarlo "colapsado", en
 *  píxeles — igual al valor usado en Flutter (_alturaExpandida) menos
 *  la altura estándar de un AppBar (kToolbarHeight = 56). */
const ALTURA_COLAPSO = 260 - 56;

/** Hitos históricos del ITVH, en el orden en que se muestran en la
 *  línea de tiempo. `year` también se usa como clave para la paleta
 *  temática de cada evento (ver historia.css). */
const EVENTOS = [
  {
    year: '1974',
    icono: '🚩',
    titulo: 'Los orígenes',
    cuerpo: 'El ITVH nació cuando la economía tabasqueña dependía de la agricultura, ganadería, pesca y cuatro industrias clave: azucarera, chocolatera, aceitera y petrolera. La falta de mano de obra calificada limitaba el crecimiento.',
    imagen: 'drawer_imagen2_2.jpg',
    pie: 'Gimnasio-Auditorio en sus primeros años.',
  },
  {
    year: '1979',
    icono: '🏙️',
    titulo: 'Sede propia',
    cuerpo: 'Tras operar en instituciones prestadas, el 20 de noviembre de 1979 el Instituto se trasladó a sus instalaciones definitivas en el Km. 3.5 de la carretera Villahermosa–Frontera.',
    imagen: 'drawer_imagen2_1.jpg',
    pie: 'Centro de Información (Biblioteca) en sus inicios, sin techo.',
  },
  {
    year: '1992',
    icono: '💻',
    titulo: 'Modernización',
    cuerpo: 'Se construyó un laboratorio de cómputo de dos niveles, una unidad académica departamental y el nuevo Centro de Información. Se consolidó el SITE de Internet y se implementaron redes internas.',
    imagen: 'drawer_imagen2.jpg',
    pie: 'Centro de cómputo en sus inicios.',
  },
];

/** Pinta la pantalla "Un poco de historia" completa dentro de `contenedor`. */
export function renderHistoriaPlantel(contenedor) {
  contenedor.innerHTML = `
    <div class="historia">
      <div class="historia-barra">
        <button class="historia-barra__volver" id="historia-volver" aria-label="Regresar">‹</button>
        <span class="historia-barra__titulo" id="historia-titulo-appbar">Un poco de historia</span>
      </div>

      <div class="historia-hero">
        <img
          class="historia-hero__img"
          src="assets/img/drawer_imagen2.jpg"
          alt=""
          onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
        />
        <div class="historia-hero__fallback"></div>
        <div class="historia-hero__gradiente"></div>
        <div class="historia-hero__badge">
          <span>📅</span> Fundado el 9 de septiembre de 1974
        </div>
      </div>

      <div class="historia-contenido">
        <h1 class="historia-titulo-principal">Instituto Tecnológico<br />de Villahermosa</h1>
        <p class="historia-subtitulo">Más de 50 años formando profesionistas en Tabasco.</p>

        <div class="historia-divisor"></div>

        <div class="historia-timeline">
          ${EVENTOS.map((evento, i) => renderTimelineItem(evento, i === EVENTOS.length - 1)).join('')}
        </div>

        <div class="historia-banner">
          <span class="historia-banner__icono">🎓</span>
          <div class="historia-banner__texto">
            <p class="historia-banner__titulo">+50 años</p>
            <p class="historia-banner__subtitulo">formando profesionistas en Tabasco</p>
          </div>
        </div>
      </div>
    </div>
  `;

  contenedor
    .querySelector('#historia-volver')
    .addEventListener('click', () => window.history.back());

  inicializarFadeTitulo(contenedor);
}

/** Nodo circular + línea vertical + contenido de un hito histórico. */
function renderTimelineItem(evento, isLast) {
  return `
    <div class="historia-timeline__item" data-evento="${evento.year}">
      <div class="historia-timeline__columna-izq">
        <div class="historia-timeline__nodo"><span>${evento.icono}</span></div>
        ${isLast ? '' : '<div class="historia-timeline__linea"></div>'}
      </div>

      <div class="historia-timeline__contenido${isLast ? ' sin-margen' : ''}">
        <p class="historia-timeline__anio">${evento.year}</p>
        <h3 class="historia-timeline__titulo">${evento.titulo}</h3>
        <p class="historia-timeline__cuerpo">${evento.cuerpo}</p>

        <div class="historia-timeline__imagen">
          <img
            src="assets/img/${evento.imagen}"
            alt="${evento.titulo}"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          />
          <div class="historia-timeline__imagen-fallback">🖼️</div>
          <div class="historia-timeline__imagen-overlay"></div>
        </div>

        <p class="historia-timeline__pie">${evento.pie}</p>
      </div>
    </div>
  `;
}

/**
 * Anima la opacidad del título de la barra superior según el scroll
 * de la página, igual que la opacidad manual del SliverAppBar en
 * Flutter: invisible arriba del todo, visible por completo una vez
 * pasada la altura del hero. El listener se auto-remueve en cuanto
 * el título deja de estar en el DOM (el usuario navegó a otra
 * pantalla, que reemplaza por completo el contenido de #app).
 * @param {HTMLElement} contenedor
 */
function inicializarFadeTitulo(contenedor) {
  const titulo = contenedor.querySelector('#historia-titulo-appbar');
  if (!titulo) return;

  function onScroll() {
    if (!document.body.contains(titulo)) {
      window.removeEventListener('scroll', onScroll);
      return;
    }
    const offset = Math.min(Math.max(window.scrollY, 0), ALTURA_COLAPSO);
    titulo.style.opacity = ALTURA_COLAPSO === 0 ? '0' : String(offset / ALTURA_COLAPSO);
  }

  window.addEventListener('scroll', onScroll);
  onScroll();
}