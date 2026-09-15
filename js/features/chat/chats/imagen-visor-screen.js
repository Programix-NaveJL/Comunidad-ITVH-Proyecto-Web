// ═════════════════════════════════════════════════════════════════
// imagen-visor-screen.js
// Ubicación: js/features/chat/chats/imagen-visor-screen.js
//
// Réplica web de pantallas_ui/imagen_visor_screen.dart. Visor de
// imagen a pantalla completa. Dart usa `photo_view` (zoom/pan por
// gestos); el equivalente web sin dependencias nuevas es un pinch-
// zoom + pan básico con Pointer Events (2 dedos = zoom, 1 dedo
// arrastra si hay zoom aplicado), suficiente para el caso de uso.
//
// El FIX de jul 2026 (quitar el Hero por conflicto con el
// ListView.builder virtualizado) no aplica aquí: la versión web no
// usa transiciones compartidas entre pantallas, así que no hay
// riesgo equivalente que evitar.
// ═════════════════════════════════════════════════════════════════

export function mostrarImagenVisor(url) {
  const overlay = document.createElement('div');
  overlay.className = 'conv-visor-overlay';
  overlay.innerHTML = `
    <button class="conv-visor__cerrar">✕</button>
    <div class="conv-visor__lienzo">
      <img class="conv-visor__img" src="${url}" alt="" draggable="false" />
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const img = overlay.querySelector('.conv-visor__img');
  let escala = 1;
  let x = 0;
  let y = 0;
  let distanciaInicial = null;
  let escalaInicial = 1;
  let arrastrando = false;
  let inicioArrastre = { x: 0, y: 0 };

  function aplicarTransform() {
    img.style.transform = `translate(${x}px, ${y}px) scale(${escala})`;
  }

  function distanciaEntre(t1, t2) {
    return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
  }

  img.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      distanciaInicial = distanciaEntre(e.touches[0], e.touches[1]);
      escalaInicial = escala;
    } else if (e.touches.length === 1 && escala > 1) {
      arrastrando = true;
      inicioArrastre = { x: e.touches[0].clientX - x, y: e.touches[0].clientY - y };
    }
  });

  img.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && distanciaInicial) {
      e.preventDefault();
      const nueva = distanciaEntre(e.touches[0], e.touches[1]);
      escala = Math.min(4, Math.max(1, escalaInicial * (nueva / distanciaInicial)));
      aplicarTransform();
    } else if (arrastrando && e.touches.length === 1) {
      x = e.touches[0].clientX - inicioArrastre.x;
      y = e.touches[0].clientY - inicioArrastre.y;
      aplicarTransform();
    }
  }, { passive: false });

  img.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) distanciaInicial = null;
    if (e.touches.length === 0) {
      arrastrando = false;
      if (escala <= 1) {
        escala = 1;
        x = 0;
        y = 0;
        aplicarTransform();
      }
    }
  });

  // Doble click de escritorio: alterna zoom 1x / 2x.
  img.addEventListener('dblclick', () => {
    escala = escala > 1 ? 1 : 2;
    x = 0;
    y = 0;
    aplicarTransform();
  });

  function cerrar() {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
  }

  overlay.querySelector('.conv-visor__cerrar').addEventListener('click', cerrar);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('conv-visor__lienzo')) cerrar();
  });
}