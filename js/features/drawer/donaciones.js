// Pantalla de donación por transferencia bancaria directa (SPEI).
//
// No usa ningún procesador de pagos: el dinero llega completo, sin
// comisiones. A cambio no hay confirmación automática — un admin
// registra manualmente la donación en el Panel de Control al ver el
// depósito reflejado en su banco, usando el usuario que la persona
// puso en el concepto para identificarla y asignarle su insignia.

import { supabaseClient } from '../../core/supabase-client.js';
import { registrarRuta } from '../../core/router.js';
import { mostrarToast } from '../../core/toast.js';

const CLABE = '012180015498920970';
const BANCO = 'BBVA';
const TITULAR = 'Programix NaveJL';

// Campo que se acaba de copiar, para mostrar el check temporal.
// Vive a nivel de módulo porque solo hay una instancia de esta
// pantalla montada a la vez.
let campoCopiado = null;
let temporizadorCopiado = null;

registrarRuta('/donaciones', render);

async function render(contenedor) {
  campoCopiado = null;

  const { data } = await supabaseClient.auth.getUser();
  const metadata = data?.user?.user_metadata ?? {};
  const usuarioSugerido = metadata.nombre_usuario ?? metadata.nombre ?? '';

  contenedor.innerHTML = plantilla(usuarioSugerido);
  activarInteracciones(contenedor);
}

function plantilla(usuarioSugerido) {
  return `
    <div class="donaciones">
      <header class="donaciones-header">
        <button class="donaciones-cerrar" id="donaciones-cerrar" aria-label="Cerrar">✕</button>
      </header>

      <div class="donaciones-cuerpo">
        <div class="donaciones-logo">
          <img src="assets/icons/splash_foreground.png" alt="" />
          <span class="donaciones-logo__badge">☕</span>
        </div>

        <h1 class="donaciones-titulo">¿Nos invitas un café?</h1>
        <p class="donaciones-texto">
          Esta app la hacemos un grupo de estudiantes de ITVH, entre clases,
          tareas y desveladas. Si te ha servido, un cafecito nos ayuda a
          seguir mejorándola.
          <br /><br />
          Cualquier cantidad se agradece con el alma — hasta $10 pesos hacen
          la diferencia.
        </p>

        <div class="donaciones-aviso">
          <span>💰</span>
          <p>Transferencia directa — sin comisiones. Todo tu apoyo llega completo.</p>
        </div>

        <p class="donaciones-seccion">DATOS PARA TRANSFERIR</p>

        <div class="donaciones-campo donaciones-campo--destacado" data-campo="CLABE interbancaria" data-valor="${CLABE}">
          <div>
            <p class="donaciones-campo__label">CLABE interbancaria</p>
            <p class="donaciones-campo__valor donaciones-campo__valor--mono">${formatearClabe(CLABE)}</p>
          </div>
          <span class="donaciones-campo__icono">📋</span>
        </div>

        <div class="donaciones-campo" data-campo="Titular" data-valor="${TITULAR}">
          <div>
            <p class="donaciones-campo__label">Titular</p>
            <p class="donaciones-campo__valor">${TITULAR}</p>
          </div>
          <span class="donaciones-campo__icono">📋</span>
        </div>

        <div class="donaciones-fila-simple">
          <span>Banco</span>
          <strong>${BANCO}</strong>
        </div>

        <p class="donaciones-seccion" style="margin-top:24px;">MUY IMPORTANTE</p>

        <div class="donaciones-caja-usuario">
          <p class="donaciones-caja-usuario__titulo">✏️ Pon tu usuario en el concepto</p>
          <p class="donaciones-caja-usuario__texto">
            Así podemos identificar tu donación y darte tu insignia dentro de
            la app. Sin esto no hay forma de saber quién donó.
          </p>
          <div class="glass-field donaciones-input-usuario">
            <span class="glass-field__icon">👤</span>
            <input id="donaciones-usuario" type="text" placeholder="Tu usuario" value="${usuarioSugerido}" />
          </div>
          <div class="donaciones-campo donaciones-campo--concepto" id="donaciones-concepto" data-campo="Concepto">
            <span>📝</span>
            <span id="donaciones-concepto-texto">${conceptoSugerido(usuarioSugerido)}</span>
            <span class="donaciones-campo__icono" id="donaciones-concepto-icono">📋</span>
          </div>
        </div>

        <button class="btn-outline donaciones-btn-copiar-todo" id="donaciones-copiar-todo">
          📤 Copiar todos los datos
        </button>

        <button class="btn-primary donaciones-btn-listo" id="donaciones-listo">
          ✓ Listo, ya transferí
        </button>
        <button class="donaciones-btn-ahora-no" id="donaciones-ahora-no">Ahora no</button>
      </div>
    </div>
  `;
}

function formatearClabe(clabe) {
  return clabe.match(/.{1,4}/g).join(' ');
}

function conceptoSugerido(usuario) {
  const limpio = (usuario ?? '').trim();
  return limpio ? `Donación - ${limpio}` : 'Donación';
}

function activarInteracciones(contenedor) {
  contenedor.querySelector('#donaciones-cerrar').addEventListener('click', () => window.history.back());
  contenedor.querySelector('#donaciones-ahora-no').addEventListener('click', () => window.history.back());
  contenedor.querySelector('#donaciones-listo').addEventListener('click', () => window.history.back());

  contenedor.querySelectorAll('.donaciones-campo[data-valor]').forEach((el) => {
    el.addEventListener('click', () => copiar(contenedor, el.dataset.campo, el.dataset.valor));
  });

  const inputUsuario = contenedor.querySelector('#donaciones-usuario');
  const conceptoTexto = contenedor.querySelector('#donaciones-concepto-texto');
  const conceptoEl = contenedor.querySelector('#donaciones-concepto');

  inputUsuario.addEventListener('input', () => {
    conceptoTexto.textContent = conceptoSugerido(inputUsuario.value);
  });

  conceptoEl.addEventListener('click', () => {
    copiar(contenedor, 'Concepto', conceptoSugerido(inputUsuario.value));
  });

  contenedor.querySelector('#donaciones-copiar-todo').addEventListener('click', async () => {
    const texto =
      `Datos para donar a ${TITULAR}:\n` +
      `CLABE: ${CLABE}\n` +
      `Banco: ${BANCO}\n` +
      `Concepto: ${conceptoSugerido(inputUsuario.value)}`;
    try {
      await navigator.clipboard.writeText(texto);
      mostrarToast('Datos completos copiados', 'success');
    } catch {
      mostrarToast('No se pudo copiar', 'error');
    }
  });
}

async function copiar(contenedor, campo, valor) {
  try {
    await navigator.clipboard.writeText(valor);
  } catch {
    mostrarToast('No se pudo copiar', 'error');
    return;
  }

  mostrarToast(`${campo} copiado`, 'success');

  campoCopiado = campo;
  clearTimeout(temporizadorCopiado);
  actualizarIconosCopiado(contenedor);

  temporizadorCopiado = setTimeout(() => {
    campoCopiado = null;
    actualizarIconosCopiado(contenedor);
  }, 2000);
}

function actualizarIconosCopiado(contenedor) {
  contenedor.querySelectorAll('.donaciones-campo[data-campo]').forEach((el) => {
    const icono = el.querySelector('.donaciones-campo__icono') ?? contenedor.querySelector('#donaciones-concepto-icono');
    if (!icono) return;
    icono.textContent = el.dataset.campo === campoCopiado ? '✅' : '📋';
  });
}