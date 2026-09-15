// ═════════════════════════════════════════════════════════════════
// perfil-preview-sheet.js
// Ubicación: js/features/chat/chats/perfil-preview-sheet.js
//
// Réplica web de pantallas_ui/perfil_preview_sheet.dart. Card
// informativo al tocar el avatar/nombre del otro usuario en la
// conversación: foto, nombre, @usuario, carrera/semestre, fecha de
// unión, y botón "Perfil".
//
// Igual que en Dart, recibe onVerPerfil como callback en vez de
// navegar directamente, para no acoplarse a la ruta exacta de
// perfil-publico. AJUSTAR si la ruta real difiere de la usada por
// quien llama a mostrarPerfilPreview() (ver conversacion-screen.js).
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../../core/supabase-client.js';

export async function mostrarPerfilPreview({ usuarioId, nombre, nombreUsuario, avatarUrl, onVerPerfil }) {
  const overlay = document.createElement('div');
  overlay.className = 'conv-sheet-overlay';
  overlay.innerHTML = plantilla({ nombre, nombreUsuario, avatarUrl, cargando: true });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  function cerrar() {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 200);
  }
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrar();
  });
  activarBoton(overlay, cerrar, onVerPerfil);

  try {
    const { data, error } = await supabaseClient
      .from('perfiles')
      .select('carrera, semestre, creado_en, cdn_foto_perfil')
      .eq('id', usuarioId)
      .maybeSingle();
    if (error) throw error;

    overlay.querySelector('.conv-perfil-sheet').outerHTML = plantilla({
      nombre,
      nombreUsuario,
      avatarUrl: avatarUrl || data?.cdn_foto_perfil,
      cargando: false,
      carrera: data?.carrera,
      semestre: data?.semestre,
      creadoEn: data?.creado_en,
    });
    activarBoton(overlay, cerrar, onVerPerfil);
  } catch (e) {
    console.error('perfil-preview-sheet – error al cargar datos:', e);
    overlay.querySelector('.conv-perfil-sheet').outerHTML = plantilla({ nombre, nombreUsuario, avatarUrl, cargando: false });
    activarBoton(overlay, cerrar, onVerPerfil);
  }
}

function activarBoton(overlay, cerrar, onVerPerfil) {
  overlay.querySelector('.conv-perfil-sheet__boton-perfil')?.addEventListener('click', () => {
    cerrar();
    onVerPerfil?.();
  });
}

function fechaUnion(fechaIso) {
  if (!fechaIso) return null;
  const texto = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date(fechaIso));
  return `Se unió en ${texto.charAt(0).toUpperCase()}${texto.slice(1)}`;
}

function plantilla({ nombre, nombreUsuario, avatarUrl, cargando, carrera, semestre, creadoEn }) {
  const inicial = (nombre || '?').trim().charAt(0).toUpperCase();
  const union = fechaUnion(creadoEn);

  return `
    <div class="conv-perfil-sheet">
      <div class="conv-sheet__manija"></div>
      <span class="conv-perfil-sheet__avatar">
        ${avatarUrl ? `<img src="${avatarUrl}" alt="" />` : `<span class="chats-avatar__inicial">${inicial}</span>`}
      </span>
      <p class="conv-perfil-sheet__nombre">${escapar(nombre)}</p>
      ${nombreUsuario ? `<p class="conv-perfil-sheet__usuario">@${escapar(nombreUsuario)}</p>` : ''}
      <div class="conv-perfil-sheet__info">
        ${
          cargando
            ? `<span class="chats-spinner"></span>`
            : `
              ${carrera ? `<p class="conv-perfil-sheet__fila">🎓 ${escapar(carrera)}${semestre ? ` · ${semestre}° sem.` : ''}</p>` : ''}
              ${union ? `<p class="conv-perfil-sheet__fila">📅 ${escapar(union)}</p>` : ''}
            `
        }
      </div>
      <button class="conv-perfil-sheet__boton-perfil">Perfil</button>
    </div>
  `;
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}