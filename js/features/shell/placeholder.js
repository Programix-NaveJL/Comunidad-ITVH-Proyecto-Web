  // Contenido reutilizable para pantallas que aún no se han construido.
//
// Se usa tanto para el contenido de una pestaña del TabBar como para
// las rutas del Drawer, de modo que ningún enlace del shell quede
// roto mientras se desarrollan esos módulos.

export function renderMarcadorPosicion(contenedor, { icono = '🚧', titulo, subtitulo }) {
  contenedor.innerHTML = `
    <div class="shell-placeholder">
      <span class="shell-placeholder__icono">${icono}</span>
      <p class="shell-placeholder__titulo">${titulo}</p>
      <p class="shell-placeholder__subtitulo">${subtitulo}</p>
    </div>
  `;
}