// Gestión del tema visual (claro/oscuro) de la aplicación.
//
// El tema se aplica como atributo data-theme en <html>, que
// variables.css debe usar para exponer el set de custom properties
// correspondiente. La preferencia se persiste en localStorage para
// que sobreviva recargas y pestañas nuevas.

const CLAVE_ALMACENAMIENTO = 'itvh_tema';

// Aplica el tema guardado (o el preferido del sistema si no hay
// ninguno) tan pronto como se importa este módulo, para evitar un
// parpadeo de tema incorrecto antes del primer render.
export function inicializarTema() {
  const guardado = localStorage.getItem(CLAVE_ALMACENAMIENTO);
  const tema = guardado ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', tema);
}

export function obtenerTema() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function alternarTema() {
  const nuevo = obtenerTema() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', nuevo);
  localStorage.setItem(CLAVE_ALMACENAMIENTO, nuevo);
  return nuevo;
}