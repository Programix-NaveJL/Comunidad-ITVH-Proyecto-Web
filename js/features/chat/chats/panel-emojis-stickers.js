// ═════════════════════════════════════════════════════════════════
// panel-emojis-stickers.js
// Ubicación: js/features/chat/chats/panel-emojis-stickers.js
//
// Réplica web de pantallas_ui/panel_emojis_stickers.dart. Panel bajo
// el composer con 2 tabs: Emojis y Stickers (bandeja de recientes).
//
// DIFERENCIA INTENCIONAL: Dart usa el paquete emoji_picker_flutter
// (categorías completas del sistema). Por la convención de este
// proyecto de no agregar dependencias externas nuevas, aquí se usa
// una grilla propia con una selección curada de emojis frecuentes
// por categoría.
//
// BOTÓN TEMPORAL DE PRUEBA (2026-09): en Dart los stickers nuevos
// llegan por share intent del sistema (compartir_sticker_service.dart,
// aún no portado — ver 🔜 en el tracker del proyecto), así que sin
// esto la bandeja de recientes se queda vacía para siempre en local.
// El botón "+" en el tab Stickers sube un archivo cualquiera vía
// chatMediaService.enviarSticker() — es solo para poder probar el
// flujo mientras compartir-sticker-service.js no exista. QUITAR este
// botón cuando se porte el share target real.
// ═════════════════════════════════════════════════════════════════

import * as stickersRecientesService from '../servicios/stickers-recientes-service.js';

const CATEGORIAS_EMOJI = {
  Caritas: ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😉', '😎', '🤔', '😴', '😭', '😡', '🥳', '😅', '🙄'],
  Gestos: ['👍', '👎', '👏', '🙌', '🙏', '👋', '💪', '🤝', '✌️', '🤙', '👌', '🫶'],
  Corazones: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💕', '💖', '💔'],
  Objetos: ['🔥', '✨', '🎉', '🎊', '📚', '💻', '📱', '⏰', '☕', '🍕', '⚽', '🎮'],
};

export function montarPanelEmojisStickers(contenedor, { onEmojiSeleccionado, onStickerSeleccionado, onSubirStickerNuevo }) {
  contenedor.innerHTML = `
    <div class="conv-panel-emojis">
      <div class="conv-panel-emojis__tabs">
        <button class="conv-panel-emojis__tab seleccionado" data-tab="emojis">Emojis</button>
        <button class="conv-panel-emojis__tab" data-tab="stickers">Stickers</button>
      </div>
      <div class="conv-panel-emojis__vista" id="conv-panel-vista"></div>
    </div>
  `;

  const vista = contenedor.querySelector('#conv-panel-vista');

  const inputArchivoSticker = document.createElement('input');
  inputArchivoSticker.type = 'file';
  inputArchivoSticker.accept = 'image/*';
  inputArchivoSticker.style.display = 'none';
  contenedor.appendChild(inputArchivoSticker);

  inputArchivoSticker.addEventListener('change', async () => {
    const file = inputArchivoSticker.files[0];
    inputArchivoSticker.value = '';
    if (!file || !onSubirStickerNuevo) return;
    await onSubirStickerNuevo(file);
    renderStickers();
  });

  function renderEmojis() {
    vista.innerHTML = Object.entries(CATEGORIAS_EMOJI)
      .map(
        ([categoria, emojis]) => `
          <p class="conv-panel-emojis__categoria">${categoria}</p>
          <div class="conv-panel-emojis__grid">
            ${emojis.map((e) => `<button class="conv-panel-emojis__emoji" data-emoji="${e}">${e}</button>`).join('')}
          </div>
        `
      )
      .join('');
    vista.querySelectorAll('[data-emoji]').forEach((btn) => {
      btn.addEventListener('click', () => onEmojiSeleccionado(btn.dataset.emoji));
    });
  }

  function renderStickers() {
    const stickers = stickersRecientesService.obtener();
    const botonSubir = `
      <button class="conv-panel-emojis__sticker conv-panel-emojis__sticker--agregar" id="conv-btn-subir-sticker" title="Subir sticker de prueba">＋</button>
    `;

    if (stickers.length === 0) {
      vista.innerHTML = `
        <div class="conv-panel-emojis__vacio">
          Comparte o envía un sticker<br />para verlo aquí
          <div class="conv-panel-emojis__grid-stickers" style="margin-top:16px">${botonSubir}</div>
        </div>
      `;
    } else {
      vista.innerHTML = `
        <div class="conv-panel-emojis__grid-stickers">
          ${botonSubir}
          ${stickers
            .map(
              (s) => `<button class="conv-panel-emojis__sticker" data-url="${s.url}"><img src="${s.url}" alt="" /></button>`
            )
            .join('')}
        </div>
      `;
    }

    vista.querySelectorAll('[data-url]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sticker = stickers.find((s) => s.url === btn.dataset.url);
        if (sticker) onStickerSeleccionado(sticker);
      });
    });

    vista.querySelector('#conv-btn-subir-sticker')?.addEventListener('click', () => inputArchivoSticker.click());
  }

  contenedor.querySelectorAll('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      contenedor.querySelectorAll('[data-tab]').forEach((t) => t.classList.remove('seleccionado'));
      tab.classList.add('seleccionado');
      if (tab.dataset.tab === 'emojis') renderEmojis();
      else renderStickers();
    });
  });

  renderEmojis();
}