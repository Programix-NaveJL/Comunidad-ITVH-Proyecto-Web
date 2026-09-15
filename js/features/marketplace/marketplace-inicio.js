// js/features/marketplace/marketplace-inicio.js
//
// Feed principal del Marketplace: barra de búsqueda, chips de
// categoría y tarjetas de publicación. Equivalente web de
// MarketplaceInicio.dart.
//
// render(contenedor, onVerEmprendedor) — onVerEmprendedor(id) se
// llama al tocar el nombre del negocio en una tarjeta. Si no se pasa
// un callback personalizado, por defecto navega directo al perfil
// público del negocio ('/negocio/<id>'), registrado en
// mi-negocio-publico.js.
//
// DESCRIPCIÓN EXPANDIBLE — mismo patrón ya usado en
// tarjeta-publicacion.js (configurarTextoExpandible): se inserta el
// texto con clamp de 2 líneas y, tras el próximo frame, se mide si
// scrollHeight > clientHeight para decidir si mostrar el botón
// "Leer más"/"Ver menos" — igual que el TextPainter del Dart
// original, que solo muestra el botón cuando el texto realmente se
// desborda.
//
// AUTO-CHEQUEO "es tu publicación": igual que
// _contactarEmprendedor() en el Dart, antes de navegar al chat se
// compara el id del emprendedor contra el usuario autenticado
// actual — si coincide, se muestra un toast en vez de navegar.
//
// "CONTACTAR" → JAGUARCHAT: navega a conversacion-screen.js a través
// del puente conversacion-nav.js (el router navega por hash y no
// serializa objetos completos, así que ese módulo es el único punto
// de entrada para abrir una conversación desde cualquier pantalla).
// Se adjunta un contextoObjeto tipo 'marketplace' — mismo criterio
// que _contactarEmprendedor() en Dart: descripcion = título de la
// publicación, imagenUrl = primera imagen del carrusel (si hay), y
// lugar reutilizado para mostrar el precio formateado (así
// burbuja-mensaje.js puede mostrar el ícono de dinero en vez del de
// ubicación para este tipo de contexto, igual que en Dart).
//
// NOTA IMPORTANTE sobre el id del negocio: mi-negocio-publico.js
// resuelve por el id de la fila `emprendedores` (no por el perfil_id
// del usuario dueño), así que tanto el botón "ver negocio" como el
// atributo data-emprendedor usan emprendedor.id — antes usaban por
// error perfilEmprendedor.id, lo que rompía la búsqueda con .single()
// en el perfil público.

import { supabaseClient } from '../../core/supabase-client.js';
import { mostrarToast } from '../../core/toast.js';
import { navegarA } from '../../core/router.js';
import { abrirConversacion } from '../chat/chats/conversacion/conversacion-nav.js';

const ACCENT = '#3390EC';

let categorias = [];
let publicaciones = [];
let categoriaSeleccionada = null;
let busqueda = '';
let cargando = true;
let onVerEmprendedorCb = () => {};
let raizPanel = null;
let uidActual = null;

// ── Estado global de arrastre para el carrusel ──────────────────
// Un solo listener de mouseup en window (no uno por tarjeta/carrusel)
// para evitar que se acumulen al re-renderizar el feed cada vez que
// se busca o se cambia de categoría.
let arrastreActivo = null; // { xInicio, irA, img } o null

window.addEventListener('mouseup', (e) => {
  if (!arrastreActivo) return;
  const { xInicio, irA, img } = arrastreActivo;
  const deltaX = e.clientX - xInicio;
  const UMBRAL = 40;
  if (deltaX > UMBRAL) irA(Number(img.dataset.indice || 0) - 1);
  else if (deltaX < -UMBRAL) irA(Number(img.dataset.indice || 0) + 1);
  arrastreActivo = null;
});

export async function render(contenedor, onVerEmprendedor) {
  raizPanel = contenedor;
  // Por defecto, navega directo al perfil público del negocio si el
  // llamador no especifica un comportamiento propio.
  onVerEmprendedorCb = onVerEmprendedor ?? ((id) => navegarA(`/negocio/${id}`));
  categoriaSeleccionada = null;
  busqueda = '';

  const { data } = await supabaseClient.auth.getUser();
  uidActual = data?.user?.id ?? null;

  contenedor.innerHTML = plantillaBase();
  activarInteracciones(contenedor);

  await cargarDatos();
}

function plantillaBase() {
  return `
    <div class="mkt-inicio">
      <div class="mkt-buscador">
        <span class="mkt-buscador__icono">🔍</span>
        <input class="mkt-buscador__input" id="mkt-buscar-input" type="text" placeholder="Buscar productos o servicios..." />
        <button class="mkt-buscador__limpiar" id="mkt-buscar-limpiar" hidden>✕</button>
      </div>

      <div class="mkt-categorias" id="mkt-categorias"></div>

      <div class="mkt-feed" id="mkt-feed"></div>
    </div>
  `;
}

function activarInteracciones(contenedor) {
  const input = contenedor.querySelector('#mkt-buscar-input');
  const limpiar = contenedor.querySelector('#mkt-buscar-limpiar');

  let temporizador = null;
  input.addEventListener('input', () => {
    limpiar.hidden = input.value.trim().length === 0;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      busqueda = input.value.trim();
      cargarPublicaciones();
    }, 300);
  });

  limpiar.addEventListener('click', () => {
    input.value = '';
    limpiar.hidden = true;
    busqueda = '';
    cargarPublicaciones();
  });
}

async function cargarDatos() {
  cargando = true;
  renderFeed();
  await Promise.all([cargarCategorias(), cargarPublicaciones()]);
}

async function cargarCategorias() {
  const { data, error } = await supabaseClient
    .from('marketplace_categorias')
    .select('id, nombre, emoji, slug')
    .order('nombre');

  if (error) {
    console.error('marketplace-inicio – error cargando categorías:', error);
    return;
  }
  categorias = data ?? [];
  renderCategorias();
}

function renderCategorias() {
  const zona = raizPanel.querySelector('#mkt-categorias');
  if (!zona) return;

  const chip = (emoji, nombre, activo) => `
    <button class="mkt-chip${activo ? ' activo' : ''}">
      <span class="mkt-chip__medallon">${emoji}</span>
      <span class="mkt-chip__nombre">${nombre}</span>
    </button>
  `;

  zona.innerHTML = [
    chip('🛒', 'Todas', categoriaSeleccionada === null),
    ...categorias.map((c) => chip(c.emoji, c.nombre, categoriaSeleccionada === c.slug)),
  ].join('');

  const botones = zona.querySelectorAll('.mkt-chip');
  botones[0].addEventListener('click', () => {
    categoriaSeleccionada = null;
    renderCategorias();
    cargarPublicaciones();
  });
  categorias.forEach((c, i) => {
    botones[i + 1].addEventListener('click', () => {
      categoriaSeleccionada = c.slug;
      renderCategorias();
      cargarPublicaciones();
    });
  });
}

async function cargarPublicaciones() {
  cargando = true;
  renderFeed();

  let query = supabaseClient
    .from('marketplace_publicaciones')
    .select(`
      id, titulo, descripcion, precio, tipo, creado_en, expira_en,
      categoria_id,
      marketplace_categorias ( nombre, emoji ),
      marketplace_imagenes   ( r2_url, orden ),
      emprendedores (
        id, nombre_negocio, estado,
        perfiles ( id, nombre, nombre_usuario, cdn_foto_perfil )
      )
    `)
    .eq('esta_activa', true)
    .gt('expira_en', new Date().toISOString());

  if (categoriaSeleccionada) {
    const cat = categorias.find((c) => c.slug === categoriaSeleccionada);
    if (cat) query = query.eq('categoria_id', cat.id);
  }
  if (busqueda) query = query.ilike('titulo', `%${busqueda}%`);

  const { data, error } = await query.order('creado_en', { ascending: false });

  cargando = false;
  if (error) {
    console.error('marketplace-inicio – error cargando publicaciones:', error);
    mostrarToast('No se pudo cargar el Marketplace', 'error');
    publicaciones = [];
  } else {
    publicaciones = data ?? [];
  }
  renderFeed();
}

function renderFeed() {
  const zona = raizPanel?.querySelector('#mkt-feed');
  if (!zona) return;

  if (cargando) {
    zona.innerHTML = `<div class="mkt-spinner"></div>`;
    return;
  }

  if (publicaciones.length === 0) {
    zona.innerHTML = plantillaVacio();
    return;
  }

  zona.innerHTML = publicaciones.map(plantillaTarjeta).join('');
  activarTarjetas(zona);
}

function plantillaVacio() {
  let icono = '🏪', titulo = 'El Marketplace está vacío', subtitulo = 'Las publicaciones duran 24 horas activas.';
  if (busqueda) {
    icono = '🔎'; titulo = `Sin resultados para "${busqueda}"`; subtitulo = 'Prueba con otro término de búsqueda.';
  } else if (categoriaSeleccionada) {
    icono = '🏷️'; titulo = 'Sin publicaciones en esta categoría'; subtitulo = 'Sé el primero en publicar algo aquí.';
  }
  return `
    <div class="mkt-vacio">
      <div class="mkt-vacio__icono">${icono}</div>
      <p class="mkt-vacio__titulo">${titulo}</p>
      <p class="mkt-vacio__subtitulo">${subtitulo}</p>
    </div>
  `;
}

function plantillaTarjeta(pub) {
  const emprendedor = pub.emprendedores ?? null;
  const categoria = pub.marketplace_categorias ?? null;
  const perfilEmprendedor = emprendedor?.perfiles ?? null;
  const verificado = emprendedor?.estado === 'verificado';
  const imagenes = imagenesOrdenadas(pub);
  const precio = pub.precio != null ? `$${Number(pub.precio).toFixed(2)} MXN` : '';

  return `
    <article class="mkt-card" data-id="${pub.id}">
      ${plantillaCarrusel(imagenes, pub.id)}
      <div class="mkt-card__cuerpo">
        <div class="mkt-card__pills">
          ${categoria ? `<span class="mkt-pill">${categoria.emoji} ${categoria.nombre}</span>` : ''}
          <span class="mkt-pill mkt-pill--tipo-${pub.tipo}">${pub.tipo === 'producto' ? 'Producto' : 'Servicio'}</span>
        </div>
        <h3 class="mkt-card__titulo">${escapar(pub.titulo)}</h3>
        ${
          pub.descripcion
            ? `
          <div class="mkt-card__descripcion-zona">
            <p class="mkt-card__descripcion mkt-card__descripcion--clamp" data-desc-texto>${escapar(pub.descripcion)}</p>
            <button class="mkt-card__leer-mas" data-desc-toggle hidden>Leer más</button>
          </div>
        `
            : ''
        }
        ${precio ? `<p class="mkt-card__precio">${precio}</p>` : ''}
        <div class="mkt-card__negocio">
          <span>🏬</span>
          <button class="mkt-card__negocio-nombre" data-emprendedor="${emprendedor?.id ?? ''}">
            ${escapar(emprendedor?.nombre_negocio ?? 'Emprendedor')}
          </button>
          ${verificado ? `<span class="mkt-verificado">🏅 Verificado</span>` : ''}
        </div>
        <div class="mkt-card__tiempos">
          <span>🕒 ${tiempoPublicado(pub.creado_en)}</span>
          <span class="mkt-expira mkt-expira--${claseExpiracion(pub.expira_en)}">⏳ ${tiempoExpira(pub.expira_en)}</span>
        </div>
        <button class="mkt-card__contactar" data-contactar="${perfilEmprendedor?.id ?? ''}" data-pub="${pub.id}">
          💬 Contactar
        </button>
      </div>
    </article>
  `;
}

function plantillaCarrusel(imagenes, pubId) {
  if (imagenes.length === 0) {
    return `<div class="mkt-card__imagen mkt-card__imagen--vacia">🖼️</div>`;
  }
  return `
    <div class="mkt-carrusel" data-carrusel="${pubId}" data-imagenes='${JSON.stringify(imagenes)}'>
      <img class="mkt-carrusel__img" src="${imagenes[0]}" alt="" data-indice="0" />
      <div class="mkt-carrusel__zoom" aria-hidden="true">🔍</div>
      ${imagenes.length > 1 ? `
        <div class="mkt-carrusel__dots">
          ${imagenes.map((_, i) => `<span class="mkt-carrusel__dot${i === 0 ? ' activo' : ''}" data-dot="${i}"></span>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function activarTarjetas(zona) {
  // ── Descripción expandible — mismo patrón que
  // configurarTextoExpandible() en tarjeta-publicacion.js: se mide
  // tras el próximo frame si el texto clamp-eado realmente se
  // desborda, y solo entonces se muestra el botón.
  zona.querySelectorAll('[data-desc-texto]').forEach((elTexto) => {
    const elToggle = elTexto.parentElement.querySelector('[data-desc-toggle]');
    requestAnimationFrame(() => {
      const desborda = elTexto.scrollHeight > elTexto.clientHeight + 1;
      if (!desborda) return;
      elToggle.hidden = false;
      elToggle.addEventListener('click', () => {
        const expandido = elTexto.classList.toggle('mkt-card__descripcion--expandida');
        elTexto.classList.toggle('mkt-card__descripcion--clamp', !expandido);
        elToggle.textContent = expandido ? 'Ver menos' : 'Leer más';
      });
    });
  });

  zona.querySelectorAll('[data-emprendedor]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.emprendedor;
      if (id) onVerEmprendedorCb(id);
    });
  });

  zona.querySelectorAll('[data-contactar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.contactar;
      if (!id) return;

      // Auto-chequeo "es tu propia publicación" — mismo criterio que
      // _contactarEmprendedor() en el Dart original.
      if (uidActual && id === uidActual) {
        mostrarToast('Esta es tu publicación', 'error');
        return;
      }

      const pub = publicaciones.find((p) => p.id === btn.dataset.pub);
      if (!pub) return;

      const perfilEmprendedor = pub.emprendedores?.perfiles ?? null;
      const imagenes = imagenesOrdenadas(pub);

      abrirConversacion({
        otroUsuarioId: id,
        otroNombre: perfilEmprendedor?.nombre || pub.emprendedores?.nombre_negocio || 'Emprendedor',
        otroNombreUsuario: perfilEmprendedor?.nombre_usuario ?? null,
        otroAvatarUrl: perfilEmprendedor?.cdn_foto_perfil ?? null,
        contextoObjeto: {
          id: pub.id,
          descripcion: pub.titulo,
          imagenUrl: imagenes[0] ?? null,
          // 'lugar' se reutiliza para el precio en contexto de
          // marketplace — mismo criterio que en Dart (burbuja-
          // mensaje.js muestra el ícono de dinero en vez del de
          // ubicación cuando contextoTipo es 'marketplace').
          lugar: pub.precio != null ? `$${Number(pub.precio).toFixed(2)} MXN` : null,
          tipo: 'marketplace',
        },
      });
    });
  });

  zona.querySelectorAll('[data-carrusel]').forEach((carrusel) => {
    const imagenes = JSON.parse(carrusel.dataset.imagenes || '[]');
    const img = carrusel.querySelector('.mkt-carrusel__img');

    function irA(i) {
      const indice = ((i % imagenes.length) + imagenes.length) % imagenes.length;
      img.src = imagenes[indice] ?? img.src;
      img.dataset.indice = String(indice);
      carrusel.querySelectorAll('[data-dot]').forEach((d, di) => {
        d.classList.toggle('activo', di === indice);
      });
    }

    carrusel.querySelectorAll('[data-dot]').forEach((dot) => {
      dot.addEventListener('click', () => irA(Number(dot.dataset.dot)));
    });

    // ── Swipe táctil / arrastre con mouse ────────────────────────
    // Mismo patrón que un PageView de Flutter: se sigue el gesto
    // horizontal y, si supera un umbral mínimo, se avanza o
    // retrocede una imagen. Umbral bajo para que se sienta ágil,
    // pero suficiente para no confundirse con un tap.
    if (imagenes.length > 1) {
      let xInicioTactil = null;

      carrusel.addEventListener('touchstart', (e) => {
        xInicioTactil = e.touches[0].clientX;
      }, { passive: true });

      carrusel.addEventListener('touchend', (e) => {
        if (xInicioTactil === null) return;
        const deltaX = e.changedTouches[0].clientX - xInicioTactil;
        const UMBRAL = 40;
        if (deltaX > UMBRAL) irA(Number(img.dataset.indice || 0) - 1);
        else if (deltaX < -UMBRAL) irA(Number(img.dataset.indice || 0) + 1);
        xInicioTactil = null;
      });

      // Arrastre con mouse (desktop) — mismo comportamiento que el
      // swipe táctil, útil al probar en navegador de escritorio.
      // Usa el estado global `arrastreActivo` + el listener único de
      // mouseup en window (declarado arriba del módulo) para no
      // acumular listeners cada vez que se re-renderiza el feed.
      carrusel.addEventListener('mousedown', (e) => {
        arrastreActivo = { xInicio: e.clientX, irA, img };
        e.preventDefault();
      });
    }

    // Tocar la imagen (o el ícono de lupa) abre el visor a pantalla
    // completa — equivalente de _abrirVisor() en MarketplaceInicio.dart.
    const abrir = () => abrirVisorImagenes({
      imagenes,
      indiceInicial: Number(img.dataset.indice || 0),
    });
    img.addEventListener('click', abrir);
    carrusel.querySelector('.mkt-carrusel__zoom')?.addEventListener('click', abrir);
  });
}

function imagenesOrdenadas(pub) {
  const imagenes = pub.marketplace_imagenes;
  if (!imagenes || imagenes.length === 0) return [];
  return [...imagenes].sort((a, b) => a.orden - b.orden).map((img) => img.r2_url);
}

function tiempoPublicado(creadoEn) {
  const diffMs = Date.now() - new Date(creadoEn).getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return 'justo ahora';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} d`;
}

// Visor de imágenes a pantalla completa — equivalente de
// _abrirVisor() en MarketplaceInicio.dart. Antes vivía en
// core/visor-imagen.js; se trae localmente porque solo lo usa
// este módulo por ahora.
function abrirVisorImagenes({ imagenes, indiceInicial = 0 }) {
  if (!imagenes || imagenes.length === 0) return;

  let indice = indiceInicial;

  const overlay = document.createElement('div');
  overlay.className = 'mkt-visor';
  overlay.innerHTML = `
    <button class="mkt-visor__cerrar" aria-label="Cerrar">✕</button>
    ${imagenes.length > 1 ? `<button class="mkt-visor__flecha mkt-visor__flecha--izq" aria-label="Anterior">‹</button>` : ''}
    <img class="mkt-visor__img" src="${imagenes[indice]}" alt="" />
    ${imagenes.length > 1 ? `<button class="mkt-visor__flecha mkt-visor__flecha--der" aria-label="Siguiente">›</button>` : ''}
    ${imagenes.length > 1 ? `<div class="mkt-visor__contador">${indice + 1} / ${imagenes.length}</div>` : ''}
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const img = overlay.querySelector('.mkt-visor__img');
  const contador = overlay.querySelector('.mkt-visor__contador');

  function actualizar() {
    img.src = imagenes[indice];
    if (contador) contador.textContent = `${indice + 1} / ${imagenes.length}`;
  }

  function cerrar() {
    document.body.style.overflow = '';
    overlay.remove();
    document.removeEventListener('keydown', alTeclado);
  }

  function anterior() {
    indice = (indice - 1 + imagenes.length) % imagenes.length;
    actualizar();
  }

  function siguiente() {
    indice = (indice + 1) % imagenes.length;
    actualizar();
  }

  function alTeclado(e) {
    if (e.key === 'Escape') cerrar();
    if (e.key === 'ArrowLeft') anterior();
    if (e.key === 'ArrowRight') siguiente();
  }

  overlay.querySelector('.mkt-visor__cerrar').addEventListener('click', cerrar);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });
  overlay.querySelector('.mkt-visor__flecha--izq')?.addEventListener('click', anterior);
  overlay.querySelector('.mkt-visor__flecha--der')?.addEventListener('click', siguiente);
  document.addEventListener('keydown', alTeclado);

  // ── Swipe táctil dentro del visor ─────────────────────────────
  // Mismo patrón que en el carrusel chico de la tarjeta: se sigue
  // el gesto horizontal y, si supera el umbral, se avanza/retrocede
  // usando las mismas funciones anterior()/siguiente() de arriba.
  // Se marca `huboSwipe` para que el click de "cerrar al tocar
  // fuera" no se dispare justo después de un swipe (touchend suele
  // generar un click sintético inmediatamente después).
  if (imagenes.length > 1) {
    let xInicioVisor = null;
    let huboSwipe = false;

    overlay.addEventListener('touchstart', (e) => {
      xInicioVisor = e.touches[0].clientX;
      huboSwipe = false;
    }, { passive: true });

    overlay.addEventListener('touchend', (e) => {
      if (xInicioVisor === null) return;
      const deltaX = e.changedTouches[0].clientX - xInicioVisor;
      const UMBRAL = 40;
      if (deltaX > UMBRAL) {
        anterior();
        huboSwipe = true;
      } else if (deltaX < -UMBRAL) {
        siguiente();
        huboSwipe = true;
      }
      xInicioVisor = null;
    });

    overlay.addEventListener('click', (e) => {
      if (huboSwipe) {
        e.stopPropagation();
        huboSwipe = false;
      }
    }, true);
  }
}

function tiempoExpira(expiraEn) {
  const diffMs = new Date(expiraEn).getTime() - Date.now();
  if (diffMs <= 0) return 'Expirada';
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 60) return `Expira en ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `Expira en ${horas} h`;
}

function claseExpiracion(expiraEn) {
  const diffMs = new Date(expiraEn).getTime() - Date.now();
  if (diffMs <= 0) return 'vencida';
  if (diffMs < 2 * 60 * 60 * 1000) return 'pronto';
  return 'ok';
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}