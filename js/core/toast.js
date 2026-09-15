// ═════════════════════════════════════════════════════════════════
// toast.js
//
// Utilidad compartida para mostrar mensajes flotantes de error o
// éxito — equivalente web de los `_showError` / `_mostrarError`
// que se repiten en cada pantalla de la app Flutter (SnackBar de
// Material). Se centraliza aquí para que ninguna pantalla tenga
// que reimplementar su propio mensaje flotante.
// ═════════════════════════════════════════════════════════════════

/**
 * Muestra un mensaje flotante en la esquina inferior de la pantalla
 * durante unos segundos y luego lo retira del DOM automáticamente.
 * @param {string} mensaje - Texto a mostrar.
 * @param {'error'|'success'} [tipo='error']
 */
export function mostrarToast(mensaje, tipo = 'error') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${tipo}`;
  toast.innerHTML = `
    <span>${tipo === 'error' ? '⚠️' : '✅'}</span>
    <span>${mensaje}</span>
  `;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3500);
}