// ═════════════════════════════════════════════════════════════════
// carreras.js
//
// Registra la ruta única '/carreras' y despacha entre las pantallas
// de cada carrera según la clave recibida como sub-segmento del
// hash (#/carreras/isc, #/carreras/icda, ...), igual que plantel.js
// hace con '/plantel' → 'historia'. Existe porque el router solo
// indexa por el primer segmento del hash: si cada carrera llamara a
// registrarRuta por su cuenta, la última importada sobreescribiría
// a las demás.
//
// Con la migración de iqui, ibqa, iamb, iciv e ipet, las 12 carreras
// del catálogo ya están enlazadas — no quedan pendientes.
// ═════════════════════════════════════════════════════════════════

import { registrarRuta } from '../../../core/router.js';
import { renderISC } from './isc.js';
import { renderITIC } from './itic.js';
import { renderIINF } from './iinf.js';
import { renderICDA } from './icda.js';
import { renderIIND } from './iind.js';
import { renderIGEE } from './igee.js';
import { renderLADM } from './ladm.js';
import { renderIQUI } from './iqui.js';
import { renderIBQA } from './ibqa.js';
import { renderIAMB } from './iamb.js';
import { renderICIV } from './iciv.js';
import { renderIPET } from './ipet.js';


const PANTALLAS = {
  isc: renderISC,
  itic: renderITIC,
  iinf: renderIINF,
  icda: renderICDA,
  iind: renderIIND,
  igee: renderIGEE,
  ladm: renderLADM,
  iqui: renderIQUI,
  ibqa: renderIBQA,
  iamb: renderIAMB,
  iciv: renderICIV,
  ipet: renderIPET,
};

/**
 * Despacha hacia la pantalla de la carrera solicitada. Es la
 * función que el router invoca al entrar a '/carreras'.
 * @param {HTMLElement} contenedor
 * @param {string} [clave] - ej. 'isc', tomado de #/carreras/isc
 */
function despacharCarrera(contenedor, clave) {
  const render = PANTALLAS[clave];
  if (!render) {
    contenedor.innerHTML = `
      <p class="carrera-no-encontrada">Esta carrera aún no está disponible.</p>
    `;
    return;
  }
  render(contenedor);
}

registrarRuta('/carreras', despacharCarrera);