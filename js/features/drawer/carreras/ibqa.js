// ═════════════════════════════════════════════════════════════════
// ibqa.js
//
// Pantalla informativa de la Ingeniería Bioquímica (IBQA). Réplica
// funcional de IBQA.dart, construida sobre los helpers compartidos
// de comun.js.
//
// Usa los tres acentos del ColorScheme, igual que ISC/ICDA: primary
// para Misión, semestres, título de sección, retícula y especialidad;
// secondary para el Perfil de Ingreso; tertiary para el Perfil de
// Egreso y la card de Visión — así los tres se distinguen entre sí
// sin salir de la paleta del tema activo.
//
// Particularidad del 9no semestre: a diferencia de otras carreras
// que marcan el semestre completo como soloInformativo, aquí mezcla
// una materia con PDF real (Formulación y Evaluación de Proyectos)
// junto a tres actividades institucionales sin URL. renderMateriaItem
// (dentro de renderSemestreExpansion) ya resuelve esto materia por
// materia según si trae url o no, así que no se marca el semestre
// como soloInformativo.
// ═════════════════════════════════════════════════════════════════

import {
  renderHeroCarrera,
  renderSectionTitle,
  renderInfoCard,
  renderObjetivoGeneral,
  renderObjetivoItem,
  renderPerfilSection,
  renderReticulaItem,
  renderSemestreExpansion,
  renderEspecialidadExpansion,
  inicializarCarrera,
} from './comun.js';

const PRIMARY = 'var(--color-primary)';
const SECONDARY = 'var(--color-secondary)';
const TERTIARY = 'var(--color-tertiary)';

// ── Objetivos Específicos ───────────────────────────────────────
const OBJETIVOS = [
  [1, 'Trabajo en Equipo', 'Trabaja en equipos interdisciplinarios y multiculturales, con liderazgo, sentido crítico, disposición al cambio y comprometido con la calidad.'],
  [2, 'Diseño de Procesos', 'Diseña y selecciona equipos y procesos para el aprovechamiento sustentable de los recursos bióticos.'],
  [3, 'Tecnologías Emergentes', 'Identifica y aplica tecnologías emergentes relacionadas con su campo de acción del Ingeniero Bioquímico para la mejora de procesos existentes.'],
  [4, 'Gestión de Calidad', 'Participa en el diseño y la aplicación de normas y programas para la gestión y aseguramiento de la calidad, en empresas e instituciones del ámbito de la Ingeniería Bioquímica.'],
  [5, 'Actualización', 'Actualiza sus conocimientos permanentemente para responder a los cambios globales.'],
  [6, 'Investigación', 'Participa en proyectos de investigación científica y tecnológica en el campo de la Ingeniería Bioquímica para contribuir al desarrollo de la sociedad.'],
  [7, 'Emprendimiento', 'Crea y administra empresas productoras de bienes y servicios para satisfacer necesidades en el campo de aplicación de la Ingeniería Bioquímica.'],
];

const RETICULAS = [
  { clave: 'IBQA-2010-207E', nombre: 'Retícula 2010', url: 'https://pub-f883231412d746839d3a41f6bc354031.r2.dev/IBQA/IBQA-2010-207E.pdf' },
];

const BASE = 'https://villahermosa.tecnm.mx/docs/oferta/ingbioquimica/temario2010';

const SEMESTRES = [
  { numero: 1, materias: [
    { nombre: 'Fundamentos de Investigación', url: `${BASE}/1semestre/FundamentosdeInvestigacion-AC006.pdf` },
    { nombre: 'Cálculo Diferencial', url: `${BASE}/1semestre/CalculoDiferencial-AC001.pdf` },
    { nombre: 'Química', url: `${BASE}/1semestre/Quimica-AE057.pdf` },
    { nombre: 'Taller de Ética', url: `${BASE}/1semestre/TallerdeEtica-AC007.pdf` },
    { nombre: 'Comportamiento Organizacional', url: `${BASE}/1semestre/ComportamientoOrganizacional.pdf` },
    { nombre: 'Dibujo Asistido por Computadora', url: `${BASE}/1semestre/DibujoAsistidoporComputadora-AE012.pdf` },
  ] },
  { numero: 2, materias: [
    { nombre: 'Administración y Legislación de Empresas', url: `${BASE}/2semestre/AdministracionyLegislacionEmpresas.pdf` },
    { nombre: 'Cálculo Integral', url: `${BASE}/2semestre/CalculoIntegral-AC002.pdf` },
    { nombre: 'Química Orgánica I', url: `${BASE}/2semestre/Qu%C3%ADmicaOrganica_I.pdf` },
    { nombre: 'Biología', url: `${BASE}/2semestre/Biologia-AE005.pdf` },
    { nombre: 'Química Analítica', url: `${BASE}/2semestre/QuimicaAnalitica.pdf` },
    { nombre: 'Álgebra Lineal', url: `${BASE}/2semestre/AlgebraLineal-AC003.pdf` },
  ] },
  { numero: 3, materias: [
    { nombre: 'Cálculo Vectorial', url: `${BASE}/3semestre/CalculoVectorial-AC004.pdf` },
    { nombre: 'Ecuaciones Diferenciales', url: `${BASE}/3semestre/EcuacionesDiferenciales-AC005.pdf` },
    { nombre: 'Química Orgánica II', url: `${BASE}/3semestre/QuimicaOrganica-II.pdf` },
    { nombre: 'Termodinámica', url: `${BASE}/3semestre/Termodinamica-AE065.pdf` },
    { nombre: 'Física', url: `${BASE}/3semestre/Fisica.pdf` },
    { nombre: 'Estadística', url: `${BASE}/3semestre/Estadistica.pdf` },
  ] },
  { numero: 4, materias: [
    { nombre: 'Programación y Métodos Numéricos', url: `${BASE}/4semestre/ProgramacionyMetodosNumericos.pdf` },
    { nombre: 'Electromagnetismo', url: `${BASE}/4semestre/Electromagnetismo-AE020.pdf` },
    { nombre: 'Bioquímica', url: `${BASE}/4semestre/Bioquimica-AE007.pdf` },
    { nombre: 'Balance de Materia y Energía', url: `${BASE}/4semestre/BalancedeMateriayEnergia-AE004.pdf` },
    { nombre: 'Análisis Instrumental', url: `${BASE}/4semestre/AnalisisInstrumental.pdf` },
    { nombre: 'Aseguramiento de la Calidad', url: `${BASE}/4semestre/AseguramientodelaCalidad.pdf` },
  ] },
  { numero: 5, materias: [
    { nombre: 'Ingeniería Económica', url: `${BASE}/5semestre/IngenieriaEconomica.pdf` },
    { nombre: 'Fenómenos de Transporte I', url: `${BASE}/5semestre/FenomenosdeTransporte-I.pdf` },
    { nombre: 'Bioquímica del Nitrógeno y Regulación Genética', url: `${BASE}/5semestre/BioquimicadelNitrogenoyRegulacionGenetica.pdf` },
    { nombre: 'Fisicoquímica', url: `${BASE}/5semestre/Fisicoquimica.pdf` },
    { nombre: 'Desarrollo Sustentable', url: `${BASE}/5semestre/DesarrolloSustentable-AC008.pdf` },
    { nombre: 'Instrumentación y Control', url: `${BASE}/5semestre/InstrumentacionyControl-AE039.pdf` },
  ] },
  { numero: 6, materias: [
    { nombre: 'Operaciones Unitarias I', url: `${BASE}/6semestre/OperacionesUnitarias-I.pdf` },
    { nombre: 'Fenómenos de Transporte II', url: `${BASE}/6semestre/FenomenosdeTransporte-II.pdf` },
    { nombre: 'Microbiología', url: `${BASE}/6semestre/Microbiologia-AE050.pdf` },
    { nombre: 'Seguridad e Higiene', url: `${BASE}/6semestre/SeguridadeHigiene.pdf` },
    { nombre: 'Cinética Química y Biológica', url: `${BASE}/6semestre/Cineticaqumicaybiologica.pdf` },
    { nombre: 'Taller de Investigación I', url: `${BASE}/6semestre/TallerdeInvestigacion-I-AC009.pdf` },
  ] },
  { numero: 7, materias: [
    { nombre: 'Taller de Investigación II', url: `${BASE}/7semestre/TallerdeInvestigacion-II-AC010.pdf` },
    { nombre: 'Operaciones Unitarias II', url: `${BASE}/7semestre/OperacionesUnitarias-II.pdf` },
    { nombre: 'Operaciones Unitarias III', url: `${BASE}/7semestre/OperacionesUnitarias-III.pdf` },
    { nombre: 'Ingeniería de Biorreactores', url: `${BASE}/7semestre/IngenieriadeBiorreactores.pdf` },
  ] },
  { numero: 8, materias: [
    { nombre: 'Ingeniería de Proyectos', url: `${BASE}/8semestre/IngenieriadeProyectos.pdf` },
    { nombre: 'Ingeniería y Gestión Ambiental', url: `${BASE}/8semestre/IngenieriayGestionAmbiental.pdf` },
    { nombre: 'Ingeniería de Procesos', url: `${BASE}/8semestre/IngenieriadeProcesos.pdf` },
  ] },
  // Mezcla una materia con PDF real y tres sin URL — cada
  // renderMateriaItem individual resuelve su propio caso.
  { numero: 9, materias: [
    { nombre: 'Formulación y Evaluación de Proyectos', url: `${BASE}/9semestre/FormulacionyEvaluaciondeProyectos-AE029.pdf` },
    { nombre: 'Residencia Profesional', url: '' },
    { nombre: 'Servicio Social', url: '' },
    { nombre: 'Actividades Complementarias', url: '' },
  ] },
];

const ESP = 'https://villahermosa.tecnm.mx/docs/oferta/ingbioquimica/especialidad';

const ESPECIALIDADES = [
  {
    nombre: 'Ciencias de los Alimentos (Plan IBQA-2010-207)',
    icono: '🍽️',
    color: PRIMARY,
    materias: [
      { nombre: 'Análisis de Alimentos', url: `${ESP}/Analisisdealimentos.pdf` },
      { nombre: 'Biotecnología Alimentaria', url: `${ESP}/Biotecnologiaalimentaria.pdf` },
      { nombre: 'Desarrollo e Innovación de Productos', url: `${ESP}/Desarrolloeinnovaciondeproductos.pdf` },
      { nombre: 'Ingeniería de Alimentos', url: `${ESP}/IngenieriadeAlimentos.pdf` },
      { nombre: 'Química de Alimentos', url: `${ESP}/Quimicadealimentos.pdf` },
      { nombre: 'Tecnología de Alimentos', url: `${ESP}/TecnologiadeAlimentos.pdf` },
    ],
  },
];

/**
 * Pinta la pantalla de Ing. Bioquímica dentro de `contenedor`.
 * Función invocada por el dispatcher de carreras.js.
 * @param {HTMLElement} contenedor
 */
export function renderIBQA(contenedor) {
  contenedor.innerHTML = `
    <div class="carrera">
      ${renderHeroCarrera({
        color: PRIMARY,
        icono: '🧬',
        departamento: 'Departamento Química, Bioquímica y Ambiental',
        titulo: 'Ingeniería Bioquímica',
      })}

      <div class="carrera-cuerpo">

        <div class="carrera-cards">
          ${renderInfoCard({
            icono: '🚩',
            titulo: 'Misión',
            contenido: 'Formar profesionistas en ingeniería bioquímica con una preparación científica-tecnológica y una conciencia social que contribuya al desarrollo sustentable y a la calidad de vida del ser humano.',
            color: PRIMARY,
          })}
          ${renderInfoCard({
            icono: '👁️',
            titulo: 'Visión',
            contenido: 'Ser un programa de ingeniería bioquímica reconocido por la calidad científica, tecnológica y humana de sus egresados, que impulsen el desarrollo sustentable.',
            color: TERTIARY,
          })}
        </div>

        ${renderSectionTitle('Objetivo General', PRIMARY)}
        ${renderObjetivoGeneral(
          'Formar profesionales íntegros en la Ingeniería Bioquímica competentes para trabajar en equipos multidisciplinarios y multiculturales que, con sentido ético, crítico, creativo, emprendedor y actitud de liderazgo, diseñe, controlen, simulen y optimicen equipos, procesos y tecnologías sustentables que utilicen recursos bióticos y sus derivados, para la producción de bienes y servicios que contribuyan a elevar el nivel de vida de la sociedad.',
          PRIMARY
        )}

        ${renderSectionTitle('Objetivos Específicos', PRIMARY)}
        <div class="carrera-objetivos">
          ${OBJETIVOS.map(([n, t, d]) => renderObjetivoItem(n, t, d, PRIMARY)).join('')}
        </div>

        ${renderSectionTitle('Perfil de Ingreso', SECONDARY)}
        ${renderPerfilSection(
          [
            'Habilidades en las áreas de Matemáticas, Química, Física y Biología, utilizando la observación, el análisis, la síntesis (creatividad) y la evaluación (juicio crítico).',
            'Capacidad para expresarse correctamente en forma oral y escrita.',
            'Pensamiento analítico, objetivo, crítico, sintético y destreza manual.',
            'Habilidades para realizar trabajo en equipo.',
          ],
          SECONDARY
        )}

        ${renderSectionTitle('Perfil de Egreso', TERTIARY)}
        ${renderPerfilSection(
          [
            'Ejerce su profesión para resolver problemas en su ámbito, trabajando en equipos interdisciplinarios y multiculturales, con liderazgo, sentido crítico, disposición al cambio y comprometido con la calidad.',
            'Diseña y selecciona equipos y procesos para el aprovechamiento sustentable de los recursos bióticos.',
            'Identifica y aplica tecnologías emergentes relacionadas con su campo de acción del Ingeniero Bioquímico para la mejora de procesos existentes.',
            'Participa en el diseño y la aplicación de normas y programas para la gestión y aseguramiento de la calidad, en empresas e instituciones del ámbito de la Ingeniería Bioquímica.',
            'Formula y evalúa proyectos de Ingeniería Bioquímica para coadyuvar al desarrollo regional con criterios de sustentabilidad.',
            'Participa en proyectos de investigación científica y tecnológica en el campo de la Ingeniería Bioquímica para contribuir al desarrollo de la sociedad.',
            'Crea y administra empresas productoras de bienes y servicios para satisfacer necesidades en el campo de aplicación de la Ingeniería Bioquímica.',
          ],
          TERTIARY
        )}

        ${renderSectionTitle('Retícula 2010-207', PRIMARY)}
        <div class="carrera-reticulas">
          ${RETICULAS.map((r) => renderReticulaItem(r, PRIMARY)).join('')}
        </div>

        ${renderSectionTitle('Plan de Estudios', PRIMARY)}
        <div class="carrera-semestres">
          ${SEMESTRES.map((s) => renderSemestreExpansion(s, PRIMARY)).join('')}
        </div>

        ${renderSectionTitle('Especialidades', PRIMARY)}
        <div class="carrera-especialidades">
          ${ESPECIALIDADES.map((esp) => renderEspecialidadExpansion(esp, PRIMARY)).join('')}
        </div>

      </div>
    </div>
  `;

  inicializarCarrera(contenedor);
}