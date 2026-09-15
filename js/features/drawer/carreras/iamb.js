// ═════════════════════════════════════════════════════════════════
// iamb.js
//
// Pantalla informativa de la Ingeniería Ambiental (IAMB). Réplica
// funcional de IAMB.dart, construida sobre los helpers compartidos
// de comun.js.
//
// Usa los tres acentos del ColorScheme: primary como color principal
// de la carrera (objetivo, campo laboral, semestres, especialidad),
// secondary para el Perfil de Ingreso y tertiary para el Perfil de
// Egreso.
//
// Particularidades frente a otras carreras:
//   • Perfil de Ingreso, Perfil de Egreso y Campo Laboral llevan un
//     subtítulo en itálica bajo el título de sección, aclarando que
//     es información orientativa — se pinta como un <p> suelto entre
//     renderSectionTitle y el bloque de bullets correspondiente.
//   • Incluye un aviso ámbar (renderAvisoCard, definido en este
//     mismo archivo por ser exclusivo de esta pantalla) que advierte
//     sobre un cruce de datos conocido en el backend del portal
//     institucional, colocado justo antes de las retículas.
//   • El 9no semestre no usa flag de "solo informativo": sus
//     actividades se declaran como materias con url vacía y cada
//     renderMateriaItem resuelve individualmente si tiene tap o no.
// ═════════════════════════════════════════════════════════════════

import {
  renderHeroCarrera,
  renderSectionTitle,
  renderObjetivoGeneral,
  renderPerfilSection,
  renderReticulaItem,
  renderSemestreExpansion,
  renderEspecialidadExpansion,
  inicializarCarrera,
} from './comun.js';

const PRIMARY = 'var(--color-primary)';
const SECONDARY = 'var(--color-secondary)';
const TERTIARY = 'var(--color-tertiary)';

const RETICULAS = [
  { clave: 'IAMB-2004-286', nombre: 'Plan 2004', url: 'https://pub-f883231412d746839d3a41f6bc354031.r2.dev/IAMB/IAMB-2004-286.pdf' },
  { clave: 'IAMB-2010-206', nombre: 'Plan 2010', url: 'https://pub-f883231412d746839d3a41f6bc354031.r2.dev/IAMB/IAMB_2010_206.pdf' },
  { clave: 'IAMB-2010-206--IAME-GIR-2023-01', nombre: 'Gestión Integral de Residuos', url: 'http://cc.villahermosa.tecnm.mx/sys/estpro/reticulas/IAMB-2010-206--IAME-GIR-2023-01.pdf' },
];

const BASE = 'https://villahermosa.tecnm.mx/docs/oferta/ingambiental/temario2010';
const ESP = 'https://villahermosa.tecnm.mx/docs/oferta/ingambiental/especialidad';

const SEMESTRES = [
  { numero: 1, materias: [
    { nombre: 'Química Inorgánica', url: `${BASE}/1semestre/QuimicaInorganica-AE060.pdf` },
    { nombre: 'Cálculo Diferencial', url: `${BASE}/1semestre/CalculoDiferencial-AC001.pdf` },
    { nombre: 'Dibujo Asistido por Computadora', url: `${BASE}/1semestre/DibujoAsistidoporComputadora.pdf` },
    { nombre: 'Taller de Ética', url: `${BASE}/1semestre/TallerdeEtica-AC007.pdf` },
    { nombre: 'Fundamentos de Investigación', url: `${BASE}/1semestre/FundamentosdeInvestigacion-AC006.pdf` },
    { nombre: 'Biología', url: `${BASE}/1semestre/Biologia-AE005.pdf` },
  ] },
  { numero: 2, materias: [
    { nombre: 'Fundamentos de Química Orgánica', url: `${BASE}/2semestre/FundamentosdeQuimicaOrganica-AE033.pdf` },
    { nombre: 'Álgebra Lineal', url: `${BASE}/2semestre/AlgebraLineal-AC003.pdf` },
    { nombre: 'Física', url: `${BASE}/2semestre/Fisica.pdf` },
    { nombre: 'Probabilidad y Estadística Ambiental', url: `${BASE}/2semestre/ProbabilidadyEstadisticaAmbiental.pdf` },
    { nombre: 'Cálculo Integral', url: `${BASE}/2semestre/CalculoIntegral-AC002.pdf` },
    { nombre: 'Ecología', url: `${BASE}/2semestre/Ecologia.pdf` },
  ] },
  { numero: 3, materias: [
    { nombre: 'Química Analítica', url: `${BASE}/3semestre/QuimicaAnalitica-AE059.pdf` },
    { nombre: 'Cálculo Vectorial', url: `${BASE}/3semestre/CalculoVectorial-AC004.pdf` },
    { nombre: 'Diseño de Experimentos Ambientales', url: `${BASE}/3semestre/DisenodeExperimentosAmbientales.pdf` },
    { nombre: 'Termodinámica', url: `${BASE}/3semestre/Termodinamica-AE065.pdf` },
    { nombre: 'Economía Ambiental', url: `${BASE}/3semestre/EconomiaAmbiental.pdf` },
    { nombre: 'Bioquímica', url: `${BASE}/3semestre/Bioquimica-AE007.pdf` },
  ] },
  { numero: 4, materias: [
    { nombre: 'Análisis Instrumental', url: `${BASE}/4semestre/AnalisisInstrumental.pdf` },
    { nombre: 'Ecuaciones Diferenciales', url: `${BASE}/4semestre/EcuacionesDiferenciales-AC005.pdf` },
    { nombre: 'Balance de Materia y Energía', url: `${BASE}/4semestre/BalanceDeMateriaYEnergia-AE004.pdf` },
    { nombre: 'Desarrollo Sustentable', url: `${BASE}/4semestre/DesarrolloSustentable-AC008.pdf` },
    { nombre: 'Fisicoquímica I', url: `${BASE}/4semestre/Fisicoqu%C3%ADmicaI.pdf` },
    { nombre: 'Microbiología', url: `${BASE}/4semestre/Microbiologia-AE050.pdf` },
  ] },
  { numero: 5, materias: [
    { nombre: 'Fenómenos de Transporte', url: `${BASE}/5semestre/FenomenoDeTransporte-AE027.pdf` },
    { nombre: 'Sistemas de Información Geográfica', url: `${BASE}/5semestre/SistemasDeInformacionGeografica.pdf` },
    { nombre: 'Gestión Ambiental I', url: `${BASE}/5semestre/GestionAmbiental_I.pdf` },
    { nombre: 'Mecánica de Fluidos', url: `${BASE}/5semestre/Mec%C3%A1nicaDeFluidos.pdf` },
    { nombre: 'Fisicoquímica II', url: `${BASE}/5semestre/Fisicoqu%C3%ADmica_II.pdf` },
    { nombre: 'Toxicología Ambiental', url: `${BASE}/5semestre/ToxicologiaAmbiental.pdf` },
  ] },
  { numero: 6, materias: [
    { nombre: 'Taller de Investigación I', url: `${BASE}/6semestre/TallerDeInvestigacion-I-AC009.pdf` },
    { nombre: 'Contaminación Atmosférica', url: `${BASE}/6semestre/ContaminacionAtmosferica.pdf` },
    { nombre: 'Gestión Ambiental II', url: `${BASE}/6semestre/GestionAmbiental_II.pdf` },
    { nombre: 'Ingeniería de Costos', url: `${BASE}/6semestre/IngenieriaDeCostos.pdf` },
    { nombre: 'Gestión de Residuos', url: `${BASE}/6semestre/GestionDeResiduos.pdf` },
    { nombre: 'Componentes de Equipo Industrial', url: `${BASE}/6semestre/ComponentesdeEquipoIndustrial.pdf` },
  ] },
  { numero: 7, materias: [
    { nombre: 'Taller de Investigación II', url: `${BASE}/7semestre/TallerDeInvestigacion-II-AC010.pdf` },
    { nombre: 'Potabilización de Agua', url: `${BASE}/7semestre/PotabilizacionDeAgua.pdf` },
    { nombre: 'Evaluación de Impacto Ambiental', url: `${BASE}/7semestre/EvaluacionDeImpactoAmbiental.pdf` },
    { nombre: 'Remediación de Suelos', url: `${BASE}/7semestre/RemediacionDeSuelos.pdf` },
  ] },
  { numero: 8, materias: [
    { nombre: 'Seguridad e Higiene Industrial', url: `${BASE}/8semestre/SeguridadeHigieneIndustrial.pdf` },
    { nombre: 'Fundamentos de Aguas Residuales', url: `${BASE}/8semestre/FundamentosdeAguasResiduales.pdf` },
    { nombre: 'Formulación y Evaluación de Proyectos', url: `${BASE}/8semestre/AE029FormulacionyEvaluaciondeProyectos.pdf` },
  ] },
  // Actividades institucionales del 9no semestre, sin temario en PDF.
  { numero: 9, materias: [
    { nombre: 'Especialidad', url: '' },
    { nombre: 'Residencia Profesional', url: '' },
    { nombre: 'Servicio Social', url: '' },
    { nombre: 'Actividades Complementarias', url: '' },
  ] },
];

const ESPECIALIDADES = [
  {
    nombre: 'Manejo y Gestión de Residuos',
    icono: '🗑️',
    color: PRIMARY,
    materias: [
      { nombre: 'Manejo de Residuos de Manejo Especial', url: `${ESP}/ManejodeResiduosdeManejoEspecial.pdf` },
      { nombre: 'Manejo de Residuos Sólidos Urbanos I', url: `${ESP}/ManejodeResiduosSolidosUrbanosI.pdf` },
      { nombre: 'Manejo de Residuos Sólidos Urbanos II', url: `${ESP}/ManejodeResiduosSolidosUrbanosII.pdf` },
      { nombre: 'Manejo de Residuos Peligrosos', url: `${ESP}/ManejodeResiduosPeligrosos.pdf` },
      { nombre: 'Minimización y Valoración de RSU', url: `${ESP}/MinimizacionyValoraciondeRSU.pdf` },
    ],
  },
];

/**
 * Card ámbar exclusiva de IAMB que advierte sobre un cruce de datos
 * conocido en el backend del portal institucional, que a veces
 * muestra claves o nombres de asignaturas incorrectos en algunos
 * bloques de especialidad. Se ubica antes de las retículas para que
 * el usuario la vea antes de comparar materias.
 */
function renderAvisoCard() {
  const aviso = '#FFA000';
  return `
    <div class="carrera-aviso" style="--color-aviso:${aviso}">
      <span class="carrera-aviso__icono">🔍</span>
      <div class="carrera-aviso__texto">
        <p class="carrera-aviso__titulo">¿Las materias no coinciden con tu retícula?</p>
        <p class="carrera-aviso__cuerpo">Existe un cruce de datos en el backend del portal que muestra claves o nombres de asignaturas incorrectos en los bloques de especialidad de algunas carreras.</p>
        <p class="carrera-aviso__nota">Nota: Los PDF oficiales de las retículas selladas son el único documento válido para tu plan de estudios actual.</p>
      </div>
    </div>
  `;
}

/**
 * Pinta la pantalla de Ing. Ambiental dentro de `contenedor`.
 * Función invocada por el dispatcher de carreras.js.
 * @param {HTMLElement} contenedor
 */
export function renderIAMB(contenedor) {
  contenedor.innerHTML = `
    <div class="carrera">
      ${renderHeroCarrera({
        color: PRIMARY,
        icono: '🌿',
        departamento: 'Departamento de Química, Bioquímica y Ambiental',
        titulo: 'Ingeniería Ambiental',
      })}

      <div class="carrera-cuerpo">

        ${renderSectionTitle('Objetivo General', PRIMARY)}
        ${renderObjetivoGeneral(
          'Formar profesionistas en Ingeniería Ambiental éticos, analíticos, críticos y creativos con las competencias para identificar, proponer y resolver problemas ambientales de manera multidisciplinaria, asegurando la protección, conservación y mejoramiento del ambiente, bajo un marco legal, buscando el desarrollo sustentable en beneficio de la vida en el planeta.',
          PRIMARY
        )}

        ${renderSectionTitle('Perfil de Ingreso', SECONDARY)}
        <p class="carrera-subtitulo">Información sobre el perfil de ingreso deseable.</p>
        ${renderPerfilSection(
          [
            'Dominio de habilidades básicas como la comprensión de textos.',
            'El trabajo en equipo.',
            'Interés sobre el tema de relevancia.',
            'Iniciativa, capacidad de gestión, de comunicación y creatividad.',
            'Interés por la investigación de las causas que deterioran el ambiente y respeto a la naturaleza.',
            'Inclinación por el conocimiento científico-tecnológico e interés en las ciencias básicas y naturales, y en sus aplicaciones para la solución de problemas.',
          ],
          SECONDARY
        )}

        ${renderSectionTitle('Perfil de Egreso', TERTIARY)}
        <p class="carrera-subtitulo">Información del perfil que tendrán los egresados y egresadas al concluir.</p>
        ${renderPerfilSection(
          [
            'Vincula el valor de los recursos naturales para promover su uso sustentable de acuerdo a las necesidades de la región, mediante instrumentos de concientización, sensibilización y comunicación.',
            'Participa en el desarrollo y ejecución de protocolos de investigación básica o aplicada para la resolución de problemas ambientales.',
            'Elabora, implementa y mantiene sistemas de gestión ambiental.',
            'Participa en la realización de auditorías ambientales en el sector público y privado.',
            'Realiza diagnósticos y evaluaciones de impacto y riesgo ambiental sustentados en métodos y procedimientos certificados conforme a criterios nacionales e internacionales.',
            'Elabora estudios de factibilidad económica y técnica de los procesos para la prevención y control ambiental.',
            'Propone e innova tecnologías para el manejo de los residuos cumpliendo la legislación ambiental vigente.',
            'Conoce y aplica criterios de ingeniería básica y aplicada, así como de las ciencias biológicas, para el dimensionamiento, adecuación, operación, mantenimiento y desarrollo de tecnologías de tratamiento, prevención, control y transformación de efluentes sólidos, líquidos y gaseosos contaminados.',
            "Conoce y aplica las TIC's, así como sistemas computacionales o software especializados en el área ambiental.",
            'Es analítico, ético, crítico y consciente de la importancia de su entorno para la vida, respetuoso de la misma y promotor del desarrollo sustentable.',
            'Es capaz de formar recursos humanos, realizar actividades de docencia, investigación y capacitación.',
            'Tiene una actitud emprendedora y de liderazgo para interactuar con grupos multidisciplinarios e interdisciplinarios en la búsqueda de soluciones a los problemas de deterioro del medio ambiente.',
          ],
          TERTIARY
        )}

        ${renderSectionTitle('Campo Laboral', PRIMARY)}
        <p class="carrera-subtitulo">Descripción de las posibles opciones laborales al egresar.</p>
        ${renderPerfilSection(
          [
            'Dependencias del gobierno en los ámbitos federal, estatal y municipal; organismos públicos desconcentrados y/o descentralizados.',
            'Empresas del sector industrial en general, y de los ramos minero-metalúrgico, energético, de obras y proyectos civiles.',
            'Instituciones educativas de nivel medio o superior, así como de investigación, tanto públicas como privadas.',
            'Profesional independiente que realiza capacitación para empresas, estudios de impacto ambiental, de riesgo, auditorías ambientales, propuesta de innovaciones tecnológicas, etc.',
            'Organizaciones no gubernamentales encaminadas a la promoción de cultura ambiental limpia.',
          ],
          PRIMARY
        )}

        ${renderAvisoCard()}

        ${renderSectionTitle('Retículas', PRIMARY)}
        <div class="carrera-reticulas">
          ${RETICULAS.map((r) => renderReticulaItem(r, PRIMARY)).join('')}
        </div>

        ${renderSectionTitle('Plan de Estudios', PRIMARY)}
        <div class="carrera-semestres">
          ${SEMESTRES.map((s) => renderSemestreExpansion(s, PRIMARY)).join('')}
        </div>

        ${renderSectionTitle('Especialidad', PRIMARY)}
        <div class="carrera-especialidades">
          ${ESPECIALIDADES.map((esp) => renderEspecialidadExpansion(esp, PRIMARY)).join('')}
        </div>

      </div>
    </div>
  `;

  inicializarCarrera(contenedor);
}