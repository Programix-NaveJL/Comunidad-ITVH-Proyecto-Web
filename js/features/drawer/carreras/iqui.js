// ═════════════════════════════════════════════════════════════════
// iqui.js
//
// Pantalla informativa de la Ingeniería Química (IQUI). Réplica
// funcional de IQUI.dart, construida sobre los helpers compartidos
// de comun.js (mismo patrón que isc.js/icda.js).
//
// A diferencia de las carreras cuyo acento se deriva del ColorScheme
// activo (cs.primary/secondary/tertiary), IQUI usa dos colores fijos
// —igual que en Flutter— independientes del tema claro/oscuro:
// NARANJA para la mayoría de secciones y NARANJA_OSCURO para el
// Perfil de Egreso y la especialidad, que así quedan visualmente
// diferenciados del resto.
//
// Particularidades frente a otras carreras ya migradas:
//   • Tres retículas de años distintos (2005, 2010, 2023), en vez de
//     una sola.
//   • Sección "Propósitos Específicos" en lugar de "Objetivos
//     Específicos" (mismo helper renderObjetivoItem, solo cambia el
//     título de la sección).
//   • Una única especialidad (Procesos Químicos): se renderiza con
//     una sola llamada a renderEspecialidadExpansion en vez de un
//     .map() sobre una lista.
//   • El 9no semestre no tiene temarios en PDF (actividades
//     institucionales), así que sus materias se declaran con url
//     vacía y renderSemestreExpansion las pinta como filas de solo
//     texto.
// ═════════════════════════════════════════════════════════════════

import {
  renderHeroCarrera,
  renderSectionTitle,
  renderObjetivoGeneral,
  renderObjetivoItem,
  renderPerfilSection,
  renderReticulaItem,
  renderSemestreExpansion,
  renderEspecialidadExpansion,
  inicializarCarrera,
} from './comun.js';

// Colores fijos de IQUI, independientes del tema claro/oscuro.
const NARANJA = '#E65100';
const NARANJA_OSCURO = '#BF360C';

// ── Propósitos Específicos ──────────────────────────────────────
// Cada registro es [número, título corto, descripción].
const PROPOSITOS = [
  [1, 'Resolver Problemas', 'Identificar y resolver problemas de ingeniería aplicando los principios de las ciencias básicas e ingeniería.'],
  [2, 'Saber Diseñar', 'Aplicar y sintetizar procesos de diseño de ingeniería que resulten en proyectos que cumplen las necesidades especificadas.'],
  [3, 'Hacer Experimentos', 'Desarrollar experimentaciones adecuadas; analizar e interpretar datos y utilizar el juicio de ingeniería para establecer conclusiones.'],
  [4, 'Saber Comunicarse', 'Comunicarse efectivamente con diferentes audiencias.'],
  [5, 'Ser Ético', 'Reconoce sus responsabilidades éticas y profesionales en situaciones relevantes para la ingeniería, considerando el impacto de las soluciones en los contextos global, económico, ambiental y social.'],
  [6, 'Actualizarse', 'Reconoce la necesidad permanente de conocimiento adicional y tiene la habilidad para localizarlo, evaluarlo, integrarlo y aplicarlo adecuadamente.'],
  [7, 'Trabajar en Equipo', 'Trabaja efectivamente en equipos que establecen metas, planean tareas, cumplen fechas límite y analizan riesgos e incertidumbre.'],
];

// ── Retículas: tres planes de distintos años ────────────────────
// La de 2023 comparte clave con la de 2010 porque es una
// actualización de especialidad sobre el mismo plan base.
const RETICULAS = [
  { clave: 'IQUI-2005-299', nombre: 'Retícula 2005', url: 'https://pub-f883231412d746839d3a41f6bc354031.r2.dev/IQUI/IQUI-2005-299.pdf' },
  { clave: 'IQUI-2010-232', nombre: 'Retícula 2010', url: 'https://pub-f883231412d746839d3a41f6bc354031.r2.dev/IQUI/IQUI-2010-232.pdf' },
  { clave: 'IQUI-2010-232', nombre: 'Retícula 2023', url: 'http://cc.villahermosa.tecnm.mx/sys/estpro/reticulas/IQUI-2010-232--IQUE-PRQ-2023-01.pdf' },
];

// URL base de los temarios, para no repetirla en cada materia.
const BASE = 'https://villahermosa.tecnm.mx/docs/oferta/ingquimica/temario2010';

// ── Plan de Estudios: 9 semestres ───────────────────────────────
// El 9no no lleva temarios en PDF (residencia, servicio social,
// etc.): sus materias se declaran con url vacía y
// renderSemestreExpansion las pinta como filas de solo texto.
const SEMESTRES = [
  { numero: 1, materias: [
    { nombre: 'Taller de Ética', url: `${BASE}/1ERSEMESTRE/TallerdeEtica-ACA-0907.pdf` },
    { nombre: 'Fundamentos de Investigación', url: `${BASE}/1ERSEMESTRE/FundamentosdeInvestigacion-ACC-0906.pdf` },
    { nombre: 'Cálculo Diferencial', url: `${BASE}/1ERSEMESTRE/CalculoDiferencial-ACF-0901.pdf` },
    { nombre: 'Química Inorgánica', url: `${BASE}/1ERSEMESTRE/QuimicaInorganica-AEF-1060.pdf` },
    { nombre: 'Programación', url: `${BASE}/1ERSEMESTRE/Programacion.pdf` },
    { nombre: 'Dibujo Asistido por Computadora', url: `${BASE}/1ERSEMESTRE/DibujoAsistidoporComputadora-AEO-1012.pdf` },
  ] },
  { numero: 2, materias: [
    // Álgebra Lineal reutiliza el PDF de Ing. Ambiental porque IQUI
    // no tiene su propia versión publicada en el servidor.
    { nombre: 'Álgebra Lineal', url: 'https://villahermosa.tecnm.mx/docs/oferta/ingambiental/temario2010/2semestre/AlgebraLineal-AC003.pdf' },
    { nombre: 'Mecánica Clásica', url: `${BASE}/2DOSEMESTRE/MecanicaClasica-AEF-1042.pdf` },
    { nombre: 'Cálculo Integral', url: `${BASE}/2DOSEMESTRE/CalculoIntegral-ACF-0902.pdf` },
    { nombre: 'Química Orgánica I', url: `${BASE}/2DOSEMESTRE/QumicaorganicaI.pdf` },
    { nombre: 'Termodinámica', url: `${BASE}/2DOSEMESTRE/Termodinamica-AEF-1065.pdf` },
    { nombre: 'Química Analítica', url: `${BASE}/2DOSEMESTRE/QuimicaAnalitica-AEG-1059.pdf` },
  ] },
  { numero: 3, materias: [
    { nombre: 'Análisis de Datos Experimentales', url: `${BASE}/3ERSEMESTRE/AnalisisdeDatosExperimentales.pdf` },
    { nombre: 'Electricidad, Magnetismo y Óptica', url: `${BASE}/3ERSEMESTRE/Electricidad,MagnetismoyOptica.pdf` },
    { nombre: 'Cálculo Vectorial', url: `${BASE}/3ERSEMESTRE/CalculoVectorial-ACF%E2%80%930904.pdf` },
    { nombre: 'Química Orgánica II', url: `${BASE}/3ERSEMESTRE/QuimicaOrganicaII.pdf` },
    { nombre: 'Balance de Materia y Energía', url: `${BASE}/3ERSEMESTRE/BalancedeMateriayEnergia-AEF-1004.pdf` },
    { nombre: 'Gestión de la Calidad', url: `${BASE}/3ERSEMESTRE/GestiondelaCalidad.pdf` },
  ] },
  { numero: 4, materias: [
    { nombre: 'Métodos Numéricos', url: `${BASE}/4semestre/MetodosNumericos.pdf` },
    { nombre: 'Ecuaciones Diferenciales', url: `${BASE}/4semestre/EcuacionesDiferenciales-ACF%E2%80%930905.pdf` },
    { nombre: 'Mecanismos de Transferencia', url: `${BASE}/4semestre/MecanismosdeTransferencia.pdf` },
    { nombre: 'Ingeniería Ambiental', url: `${BASE}/4semestre/IngenieriaAmbiental.pdf` },
    { nombre: 'Fisicoquímica I', url: `${BASE}/4semestre/Fisicoqu%C3%ADmicaI.pdf` },
    { nombre: 'Análisis Instrumental', url: `${BASE}/4semestre/AnalisisInstrumental-AEF-1003.pdf` },
  ] },
  { numero: 5, materias: [
    { nombre: 'Desarrollo Sustentable', url: `${BASE}/5semestre/DesarrolloSustentable-ACD-0908.pdf` },
    { nombre: 'Ingeniería de Costos', url: `${BASE}/5semestre/IngenieriadeCostos.pdf` },
    { nombre: 'Balance de Momento, Calor y Masa', url: `${BASE}/5semestre/BalancedeMomento,CaloryMasa.pdf` },
    { nombre: 'Procesos de Separación I', url: `${BASE}/5semestre/ProcesosdeSeparacionI.pdf` },
    { nombre: 'Fisicoquímica II', url: `${BASE}/5semestre/Fisicoqu%C3%ADmicaII.pdf` },
  ] },
  { numero: 6, materias: [
    { nombre: 'Taller de Investigación I', url: `${BASE}/6semestre/TallerdeInvestigacionI-ACA-0909.pdf` },
    { nombre: 'Procesos de Separación II', url: `${BASE}/6semestre/ProcesosdeseparacinII.pdf` },
    { nombre: 'Laboratorio Integral I', url: `${BASE}/6semestre/LaboratorioIntegralI.pdf` },
    { nombre: 'Reactores Químicos', url: `${BASE}/6semestre/ReactoresQuimicos.pdf` },
  ] },
  { numero: 7, materias: [
    { nombre: 'Taller de Administración Gerencial', url: `${BASE}/7semestre/TallerdeAdministracionGerencial.pdf` },
    { nombre: 'Taller de Investigación II', url: `${BASE}/7semestre/TallerdeInvestigacionII-ACA-0910.pdf` },
    { nombre: 'Procesos de Separación III', url: `${BASE}/7semestre/ProcesosdeSeparacionIII.pdf` },
    { nombre: 'Síntesis y Optimización de Procesos', url: `${BASE}/7semestre/SintesisyOptimizaciondeProcesos.pdf` },
    { nombre: 'Salud y Seguridad en el Trabajo', url: `${BASE}/7semestre/Saludyseguridadeneltrabajo.pdf` },
    { nombre: 'Laboratorio Integral II', url: `${BASE}/7semestre/LaboratorioIntegralII.pdf` },
  ] },
  { numero: 8, materias: [
    { nombre: 'Laboratorio Integral III', url: `${BASE}/8semestre/LaboratorioIntegralIII.pdf` },
    { nombre: 'Instrumentación y Control', url: `${BASE}/8semestre/InstrumentacionyControl-AEF-1039.pdf` },
    { nombre: 'Ingeniería de Proyectos', url: `${BASE}/8semestre/IngenieriadeProyectos.pdf` },
    { nombre: 'Simulación de Procesos', url: `${BASE}/8semestre/SimulaciondeProcesos.pdf` },
  ] },
  { numero: 9, soloInformativo: true, materias: [
    { nombre: 'Especialidad', url: '' },
    { nombre: 'Residencia Profesional', url: '' },
    { nombre: 'Servicio Social', url: '' },
    { nombre: 'Actividades Complementarias', url: '' },
  ] },
];

// ── Especialidad única: Procesos Químicos ───────────────────────
const ESP_BASE = 'https://villahermosa.tecnm.mx/docs/oferta/ingquimica/especialidad';

const ESPECIALIDAD = {
  nombre: 'Procesos Químicos',
  icono: '🧬',
  color: NARANJA_OSCURO,
  subtitulo: null, // usa el conteo de materias por defecto + clave abajo
  clave: 'IQUI-2010-232',
  materias: [
    { nombre: 'Ciencia y Tecnología de Materiales', url: `${ESP_BASE}/CienciayTecnologiadeMateriales.pdf` },
    { nombre: 'Control de Calidad en Productos', url: `${ESP_BASE}/ControldeCalidadenProductos.pdf` },
    { nombre: 'Diseño y Caracterización de Fluidos de Perforación', url: `${ESP_BASE}/DisennoyCaracterizaciondeFluidosdePerforacion.pdf` },
    { nombre: 'Optimización de Procesos Industriales', url: `${ESP_BASE}/OptimizaciondeProcesosIndustriales.pdf` },
    { nombre: 'Tecnologías y Tratamientos de Residuos', url: `${ESP_BASE}/TecnologiasyTratamientosdeResiduos.pdf` },
  ],
};

/**
 * Pinta la pantalla de Ing. Química dentro de `contenedor`. Función
 * invocada por el dispatcher de carreras.js.
 * @param {HTMLElement} contenedor
 */
export function renderIQUI(contenedor) {
  contenedor.innerHTML = `
    <div class="carrera">
      ${renderHeroCarrera({
        color: NARANJA,
        icono: '🧪',
        departamento: 'Departamento Química, Bioquímica y Ambiental',
        titulo: 'Ing. Química',
      })}

      <div class="carrera-cuerpo">

        ${renderSectionTitle('Objetivo General', NARANJA)}
        ${renderObjetivoGeneral(
          'Formar profesionistas en Ingeniería Química competentes para investigar, generar y aplicar el conocimiento científico y tecnológico, que le permita identificar y resolver problemas de diseño, operación, adaptación, optimización y administración en industrias químicas y de servicios, con calidad, seguridad, economía, usando racional y eficientemente los recursos naturales, conservando el medio ambiente, cumpliendo el código ético de la profesión y participando en el bienestar de la sociedad.',
          NARANJA
        )}

        ${renderSectionTitle('Propósitos Específicos', NARANJA)}
        <div class="carrera-objetivos">
          ${PROPOSITOS.map(([n, t, d]) => renderObjetivoItem(n, t, d, NARANJA)).join('')}
        </div>

        ${renderSectionTitle('Perfil de Ingreso', NARANJA)}
        ${renderPerfilSection(
          [
            'Capacidad para expresarse correctamente en forma oral y escrita.',
            'Capacidades de razonamiento verbal y numérico.',
            'Capacidad de análisis, síntesis, identificación y resolución de problemas.',
            'Habilidades para realizar trabajo en equipo.',
            'Ser creativo, innovador, responsable, disciplinado y con vocación.',
            'Preferentemente con bachillerato en ciencias físico-matemáticas, químico-biológico, único o equivalente.',
          ],
          NARANJA
        )}

        ${renderSectionTitle('Perfil de Egreso', NARANJA_OSCURO)}
        ${renderPerfilSection(
          [
            'Diseña, selecciona, opera, optimiza y controla procesos en industrias químicas y de servicios con base en el desarrollo tecnológico, de manera sustentable.',
            'Colabora en equipos interdisciplinarios y multiculturales, con actitud innovadora, espíritu crítico, disposición al cambio y apego a la ética profesional.',
            'Planea e implementa sistemas de gestión de calidad, ambiente e higiene y seguridad conforme a normas nacionales e internacionales.',
            'Utiliza las TIC como herramientas en la construcción de soluciones a problemas de ingeniería y difusión del conocimiento científico.',
            'Realiza innovación y adaptación de tecnología en procesos aplicando la metodología científica con respeto a la propiedad intelectual.',
            'Utiliza un segundo idioma en su ámbito laboral según los requerimientos del entorno.',
            'Se comunica de forma oral y escrita en el ámbito laboral de manera expedita y concisa.',
            'Demuestra actitud creativa, emprendedora y liderazgo para impulsar y crear empresas que contribuyan al progreso nacional.',
            'Administra recursos humanos, materiales y financieros para los sectores público y privado, acorde a modelos administrativos vigentes.',
            'Demuestra actitudes de superación continua para lograr metas personales y profesionales con pertenencia y competitividad.',
          ],
          NARANJA_OSCURO
        )}

        ${renderSectionTitle('Campo Laboral', NARANJA)}
        ${renderPerfilSection(
          [
            'Industrias de extracción y transformación.',
            'Sector público (IMP, PEMEX, SE, CFE, SEDESOL) y sector privado de la industria química.',
            'Industrias relacionadas con planeación y diseño de plantas químicas: alcoholera, jabonera, azucarera, del papel, textil y otras.',
            'Empresas o compañías de servicio: firmas de ingeniería y consultoras.',
            'Fábricas que producen fibras sintéticas para la industria textil.',
            'Instituciones educativas.',
            'Ingeniería Bioquímica y Biomédica.',
            'Protección ambiental, seguridad y materiales peligrosos.',
          ],
          NARANJA
        )}

        ${renderSectionTitle('Retículas', NARANJA)}
        <div class="carrera-reticulas">
          ${RETICULAS.map((r) => renderReticulaItem(r, NARANJA)).join('')}
        </div>

        ${renderSectionTitle('Plan de Estudios', NARANJA)}
        <div class="carrera-semestres">
          ${SEMESTRES.map((s) => renderSemestreExpansion(s, NARANJA)).join('')}
        </div>

        ${renderSectionTitle('Especialidad', NARANJA_OSCURO)}
        <div class="carrera-especialidades">
          ${renderEspecialidadExpansion(
            { ...ESPECIALIDAD, subtitulo: `${ESPECIALIDAD.materias.length} materias  ·  ${ESPECIALIDAD.clave}` },
            NARANJA
          )}
        </div>

      </div>
    </div>
  `;

  inicializarCarrera(contenedor);
}