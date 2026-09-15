// Puerto de reportar_publicacion.dart. Dos hojas encadenadas:
//   1. Motivo del reporte (lista seleccionable + botón enviar).
//   2. Confirmación, con oferta opcional de dejar de seguir al autor.
//
// Al confirmar el motivo: inserta en `reportes` (un trigger de BD ya
// existente se encarga de incrementar total_reportes y suspender la
// publicación al llegar a 3), y envía un correo de aviso vía EmailJS
// usando fetch() directo a su API REST — el mismo patrón que el Dart
// original con http.post, ya que EmailJS está diseñado para llamarse
// desde el cliente con la Public Key (no es una credencial secreta).

import { supabaseClient } from '../../../core/supabase-client.js';
import { abrirHojaInferior } from '../../../core/bottom-sheet.js';

const EMAILJS_SERVICE_ID = 'service_now66xu';
const EMAILJS_TEMPLATE_ID = 'template_90u44gs';
const EMAILJS_PUBLIC_KEY = 'O75xLune5q8dMekAA';
const EMAILJS_URL = 'https://api.emailjs.com/api/v1.0/email/send';

const MOTIVOS = [
  { key: 'spam', label: 'Spam o publicidad no deseada', icono: '📧' },
  { key: 'acoso_bullying', label: 'Acoso o bullying', icono: '😞' },
  { key: 'contenido_inapropiado', label: 'Contenido inapropiado u ofensivo', icono: '🔞' },
  { key: 'desinformacion', label: 'Desinformación o noticias falsas', icono: '✔️' },
  { key: 'violencia', label: 'Violencia o contenido peligroso', icono: '⚠️' },
  { key: 'otro', label: 'Otro motivo', icono: '⋯' },
];

/**
 * Punto de entrada público — llamar desde el menú de opciones (⋯) de
 * tarjeta-publicacion.js al tocar "Reportar".
 *
 * @param {Object} opciones
 * @param {Object} opciones.post
 * @param {?string} [opciones.uid]
 * @param {?Function} [opciones.onMiPerfilTap]
 * @param {?Function} [opciones.onRefresh]
 */
export function mostrarReporteSheet({ post, uid = null, onMiPerfilTap = null, onRefresh = null }) {
  const { sheet, cuerpo, cerrar } = abrirHojaInferior({ initialChildSize: 0.65, maxChildSize: 0.92, minChildSize: 0.3 });
  sheet.classList.add('reporte-sheet');

  let motivoSeleccionado = null;
  let enviando = false;
  let error = null;

  render();

  function render() {
    cuerpo.innerHTML = `
      <div class="reporte-sheet__header">
        <span class="reporte-sheet__icono-titulo">🚩</span>
        <p class="reporte-sheet__titulo">Reportar publicación</p>
      </div>
      <p class="reporte-sheet__subtitulo">¿Por qué quieres reportar esta publicación? Tu reporte es anónimo.</p>
      <div class="reporte-sheet__divisor"></div>

      <div class="reporte-sheet__lista">
        ${MOTIVOS.map(
          (m) => `
          <button class="reporte-sheet__item${motivoSeleccionado === m.key ? ' reporte-sheet__item--activo' : ''}" data-motivo="${m.key}">
            <span class="reporte-sheet__item-icono">${m.icono}</span>
            <span class="reporte-sheet__item-label">${m.label}</span>
            ${motivoSeleccionado === m.key ? '<span class="reporte-sheet__item-check">✓</span>' : ''}
          </button>
        `
        ).join('')}
      </div>

      ${error ? `<p class="reporte-sheet__error">⚠️ ${error}</p>` : ''}

      <button class="reporte-sheet__enviar" id="reporte-btn-enviar" ${motivoSeleccionado && !enviando ? '' : 'disabled'}>
        ${enviando ? '<span class="btn-spinner" style="width:18px;height:18px;border-width:2px;"></span>' : 'Enviar reporte'}
      </button>
    `;

    cuerpo.querySelectorAll('[data-motivo]').forEach((el) => {
      el.addEventListener('click', () => {
        motivoSeleccionado = el.dataset.motivo;
        render();
      });
    });
    cuerpo.querySelector('#reporte-btn-enviar').addEventListener('click', enviarReporte);
  }

  async function enviarReporte() {
    if (!motivoSeleccionado || enviando) return;
    const uidActual = uid ?? (await supabaseClient.auth.getUser()).data?.user?.id;
    if (!uidActual) return;

    enviando = true;
    error = null;
    render();

    try {
      const postId = post.id;
      const autorId = post.autor_id ?? '';

      const { error: insertError } = await supabaseClient.from('reportes').insert({
        publicacion_id: postId,
        reportado_por: uidActual,
        autor_id: autorId,
        motivo: motivoSeleccionado,
      });
      if (insertError) throw insertError;

      const { data: perfilReportante } = await supabaseClient
        .from('perfiles')
        .select('nombre, nombre_usuario, carrera, semestre')
        .eq('id', uidActual)
        .single();

      const { data: perfilAutor } = await supabaseClient
        .from('perfiles')
        .select('nombre, nombre_usuario, carrera, semestre')
        .eq('id', autorId)
        .maybeSingle();

      const { data: pub } = await supabaseClient
        .from('publicaciones')
        .select('total_reportes, esta_suspendida, contenido')
        .eq('id', postId)
        .single();

      const motivoLabel = MOTIVOS.find((m) => m.key === motivoSeleccionado)?.label ?? MOTIVOS.at(-1).label;

      await enviarCorreoEmailJs({
        nombreReportante: perfilReportante?.nombre ?? 'Sin nombre',
        usernameReportante: perfilReportante?.nombre_usuario ?? '',
        carrera: perfilReportante?.carrera ?? 'No especificada',
        semestre: perfilReportante?.semestre != null ? String(perfilReportante.semestre) : 'No especificado',
        nombreAutor: perfilAutor?.nombre ?? 'Desconocido',
        usernameAutor: perfilAutor?.nombre_usuario ?? '',
        postId,
        contenidoPub: pub?.contenido ?? '(sin texto)',
        motivo: motivoLabel,
        totalReportes: pub?.total_reportes ?? 1,
        estaSuspendida: pub?.esta_suspendida ?? false,
      });

      cerrar();
      mostrarConfirmacionSheet({ post, uid: uidActual, onMiPerfilTap, onRefresh });
    } catch (err) {
      // 23505 = violación UNIQUE → ya había reportado esta publicación.
      error = err?.code === '23505' ? 'Ya reportaste esta publicación anteriormente.' : 'Ocurrió un error. Intenta de nuevo.';
      console.error('reportar-publicacion – enviar:', err);
      enviando = false;
      render();
    }
  }
}

/**
 * Hoja de confirmación tras un reporte exitoso, con la opción
 * adicional de dejar de seguir al autor de la publicación.
 */
function mostrarConfirmacionSheet({ post, uid, onMiPerfilTap, onRefresh }) {
  const { cuerpo, cerrar } = abrirHojaInferior({ initialChildSize: 0.48, maxChildSize: 0.7, minChildSize: 0.3 });

  const autorId = post.autor_id ?? '';
  const esPropia = uid === autorId;

  let yaSigo = null; // null = cargando
  let procesando = false;
  let dejeSeguir = false;

  render();
  verificarSeguimiento();

  async function verificarSeguimiento() {
    if (esPropia || !autorId) {
      yaSigo = false;
      render();
      return;
    }
    try {
      const { data } = await supabaseClient.from('seguidores').select('id').eq('seguidor_id', uid).eq('seguido_id', autorId).maybeSingle();
      yaSigo = Boolean(data);
    } catch (error) {
      console.error('reportar-publicacion – verificarSeguimiento:', error);
      yaSigo = false;
    }
    render();
  }

  async function dejarDeSeguir() {
    procesando = true;
    render();
    try {
      await supabaseClient.from('seguidores').delete().eq('seguidor_id', uid).eq('seguido_id', autorId);
      try {
        await supabaseClient.rpc('decrementar_seguimiento', { p_seguidor_id: uid, p_seguido_id: autorId });
      } catch {
        // Si la RPC no existe, se ignora — mismo criterio que el Dart original.
      }
      yaSigo = false;
      dejeSeguir = true;
      onRefresh?.();
    } catch (error) {
      console.error('reportar-publicacion – dejarDeSeguir:', error);
    } finally {
      procesando = false;
      render();
    }
  }

  function render() {
    cuerpo.innerHTML = `
      <div class="confirmacion-reporte">
        <div class="confirmacion-reporte__icono">✅</div>
        <p class="confirmacion-reporte__titulo">Gracias por tu reporte</p>
        <p class="confirmacion-reporte__texto">
          Tu reporte ha sido enviado. Nuestro equipo revisará la publicación y tomará las medidas necesarias. Tu identidad permanece anónima.
        </p>
        <div class="confirmacion-reporte__divisor"></div>
        <div class="confirmacion-reporte__seguimiento" id="cr-seguimiento"></div>
      </div>
    `;

    const zona = cuerpo.querySelector('#cr-seguimiento');

    if (esPropia) {
      zona.innerHTML = `<button class="confirmacion-reporte__btn confirmacion-reporte__btn--outline" id="cr-cerrar">Cerrar</button>`;
    } else if (yaSigo === null) {
      zona.innerHTML = `<span class="btn-spinner"></span>`;
    } else if (dejeSeguir) {
      zona.innerHTML = `<p class="confirmacion-reporte__hecho">✓ Dejaste de seguir a este usuario</p>`;
    } else if (yaSigo) {
      zona.innerHTML = `
        <p class="confirmacion-reporte__pregunta">¿También quieres dejar de seguir a este usuario?</p>
        <div class="confirmacion-reporte__acciones">
          <button class="confirmacion-reporte__btn confirmacion-reporte__btn--peligro" id="cr-dejar-seguir" ${procesando ? 'disabled' : ''}>
            ${procesando ? '<span class="btn-spinner" style="width:16px;height:16px;border-width:2px;"></span>' : 'Dejar de seguir'}
          </button>
          <button class="confirmacion-reporte__btn confirmacion-reporte__btn--outline" id="cr-seguir-viendo">Seguir viendo</button>
        </div>
      `;
      cuerpo.querySelector('#cr-dejar-seguir').addEventListener('click', dejarDeSeguir);
      cuerpo.querySelector('#cr-seguir-viendo').addEventListener('click', cerrar);
    } else {
      zona.innerHTML = `<button class="confirmacion-reporte__btn confirmacion-reporte__btn--outline" id="cr-cerrar">Cerrar</button>`;
    }

    cuerpo.querySelector('#cr-cerrar')?.addEventListener('click', cerrar);
  }
}

// ═══════════════════════════════════════════════════════════════
// EMAILJS
// ═══════════════════════════════════════════════════════════════

async function enviarCorreoEmailJs({
  nombreReportante,
  usernameReportante,
  carrera,
  semestre,
  nombreAutor,
  usernameAutor,
  postId,
  contenidoPub,
  motivo,
  totalReportes,
  estaSuspendida,
}) {
  const templateParams = {
    to_email: 'alfredo.naveju.lop@gmail.com',
    reportante_nombre: nombreReportante,
    reportante_usuario: `@${usernameReportante}`,
    reportante_carrera: carrera,
    reportante_semestre: `Semestre ${semestre}`,
    autor_nombre: nombreAutor,
    autor_usuario: `@${usernameAutor}`,
    post_id: postId,
    post_contenido: contenidoPub.length > 300 ? `${contenidoPub.slice(0, 300)}…` : contenidoPub,
    motivo,
    total_reportes: String(totalReportes),
    estado_publicacion: estaSuspendida
      ? `⛔ SUSPENDIDA AUTOMÁTICAMENTE (${totalReportes} reportes)`
      : `🟡 Activa (${totalReportes} reporte${totalReportes === 1 ? '' : 's'})`,
  };

  try {
    const response = await fetch(EMAILJS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: templateParams,
      }),
    });

    if (!response.ok) {
      console.error('reportar-publicacion – EmailJS error', response.status, await response.text());
    }
  } catch (error) {
    // No bloquea el flujo si el correo falla; el reporte ya quedó en BD.
    console.error('reportar-publicacion – EmailJS excepción:', error);
  }
}