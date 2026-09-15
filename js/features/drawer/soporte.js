// Formulario de soporte accesible desde el Drawer ("¿Algo falló?").
//
// Un solo formulario para quejas y sugerencias por igual: el usuario
// escribe libremente su mensaje, sin categorizar. Guarda el reporte
// en `tickets_soporte` junto con nombre y correo para poder avisarle
// cuando su mensaje sea revisado.

import { supabaseClient } from '../../core/supabase-client.js';
import { registrarRuta } from '../../core/router.js';
import { mostrarToast } from '../../core/toast.js';

const LIMITE_DESCRIPCION = 500;
const REGEX_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

registrarRuta('/soporte', render);

function render(contenedor) {
  contenedor.innerHTML = plantilla();
  activarInteracciones(contenedor);
}

function plantilla() {
  return `
    <div class="soporte">
      <div class="soporte-glow"></div>
      <div class="soporte-cuerpo">
        <button class="soporte-volver" id="soporte-volver" aria-label="Regresar">‹</button>

        <header class="soporte-header">
          <div class="soporte-header__icono">💬</div>
          <div>
            <h1 class="soporte-titulo">Quejas y sugerencias</h1>
            <p class="soporte-subtitulo">¿Algo falló o tienes una idea para mejorar la app? Cuéntanos.</p>
          </div>
        </header>

        <form id="form-soporte" novalidate>
          <label class="soporte-label" for="soporte-nombre">Nombre <span class="soporte-requerido">*</span></label>
          <div class="soporte-campo">
            <textarea id="soporte-nombre" rows="1" placeholder="Tu nombre"></textarea>
          </div>

          <label class="soporte-label" for="soporte-correo">Correo electrónico <span class="soporte-requerido">*</span></label>
          <div class="soporte-campo">
            <textarea id="soporte-correo" rows="1" placeholder="Donde te avisamos la respuesta"></textarea>
            <span class="soporte-campo__icono">🔒</span>
          </div>
          <p class="soporte-nota">Solo lo usamos para responder tu mensaje</p>

          <label class="soporte-label" for="soporte-mensaje">Tu mensaje <span class="soporte-requerido">*</span></label>
          <div class="soporte-campo">
            <textarea id="soporte-mensaje" rows="6" maxlength="${LIMITE_DESCRIPCION}" placeholder="Queja, sugerencia o lo que se te ocurra..."></textarea>
          </div>
          <p class="soporte-contador" id="soporte-contador">0/${LIMITE_DESCRIPCION}</p>

          <button type="submit" class="soporte-btn-enviar" id="soporte-btn-enviar">
            <span id="soporte-btn-texto">Enviar ✈️</span>
          </button>
        </form>
      </div>
    </div>
  `;
}

function activarInteracciones(contenedor) {
  contenedor.querySelector('#soporte-volver').addEventListener('click', () => window.history.back());

  const mensaje = contenedor.querySelector('#soporte-mensaje');
  const contador = contenedor.querySelector('#soporte-contador');
  mensaje.addEventListener('input', () => {
    contador.textContent = `${mensaje.value.length}/${LIMITE_DESCRIPCION}`;
  });

  contenedor.querySelector('#form-soporte').addEventListener('submit', (evento) => {
    evento.preventDefault();
    enviarReporte(contenedor);
  });
}

async function enviarReporte(contenedor) {
  const nombre = contenedor.querySelector('#soporte-nombre').value.trim();
  const correo = contenedor.querySelector('#soporte-correo').value.trim();
  const descripcion = contenedor.querySelector('#soporte-mensaje').value.trim();

  if (!nombre || !correo || !descripcion) {
    mostrarToast('Completa todos los campos', 'error');
    return;
  }
  if (!REGEX_CORREO.test(correo)) {
    mostrarToast('Ingresa un correo válido', 'error');
    return;
  }

  const boton = contenedor.querySelector('#soporte-btn-enviar');
  const textoBoton = contenedor.querySelector('#soporte-btn-texto');
  boton.disabled = true;
  textoBoton.innerHTML = '<span class="btn-spinner"></span>';

  try {
    const { data } = await supabaseClient.auth.getUser();

    const { error } = await supabaseClient.from('tickets_soporte').insert({
      usuario_id: data?.user?.id ?? null,
      nombre,
      correo,
      descripcion,
    });
    if (error) throw error;

    window.history.back();
    mostrarToast('¡Gracias! Te avisaremos por correo cuando lo revisemos.', 'success');
  } catch (error) {
    console.error('soporte – error enviando reporte:', error);
    mostrarToast('No se pudo enviar. Intenta de nuevo.', 'error');
    boton.disabled = false;
    textoBoton.textContent = 'Enviar ✈️';
  }
}