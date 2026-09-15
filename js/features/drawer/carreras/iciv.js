// ═════════════════════════════════════════════════════════════════
// iciv.js
//
// Pantalla informativa de la Ingeniería Civil (ICIV). Réplica
// funcional de ICIV.dart, construida sobre los helpers compartidos
// de comun.js.
//
// Usa los tres acentos del ColorScheme: primary para Misión,
// objetivos, semestres, retículas y campo laboral; secondary para
// el Perfil de Ingreso y para la especialidad "Construcción y
// Mantenimiento de Vías Terrestres"; tertiary para el Perfil de
// Egreso y la card de Visión.
//
// Particularidad frente al resto de carreras ya migradas: ICIV
// declara dos URL base distintas para sus temarios de especialidad
// (BASE_2010 para "Estructuras" y BASE_2024 para "Construcción y
// Mantenimiento de Vías Terrestres"), porque cada una vive en una
// carpeta de servidor distinta — el resto de la pantalla (objetivo,
// semestres regulares, etc.) usa BASE_2010 igual que las demás
// carreras del Departamento de Ciencias de la Tierra.
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

const OBJETIVOS = [
  [1, 'Resolver Problemas', 'Identifica, determina o resuelve problemas en las áreas de Hidráulica, Estructuras, Vías Terrestre y Construcción.'],
  [2, 'Saber Diseñar', 'Diseña y desarrolla proyectos para solucionar problemas de obras civiles.'],
  [3, 'Hacer Experimentos', 'Formula y ejecuta proyectos de investigación y desarrollo tecnológico en el ámbito de la Ingeniería Civil.'],
  [4, 'Saber Comunicarse', "Utiliza Tecnologías de la Información y Comunicación (TIC's), software especializado y herramientas electrónicas para el diseño de proyectos de Ingeniería Civil."],
  [5, 'Ser Ético', 'Optimiza el uso de los recursos en los procesos constructivos de obras civiles, con sentido ético y profesional.'],
  [6, 'Actualizarse', 'Se actualiza constantemente para realizar estudios de factibilidad ambiental, económica, técnica y financiera de los proyectos de obras civiles.'],
  [7, 'Trabajar en Equipo', 'Coordina y participa en equipos multidisciplinarios para la aplicación de soluciones innovadoras en proyectos de Ingeniería Civil.'],
];

const RETICULAS = [
  { clave: 'ICIV-2010-208--ICIE-CMV-2024-04', nombre: 'Construcción y Mantenimiento de Vías Terrestres', url: 'http://cc.villahermosa.tecnm.mx/sys/estpro/reticulas/ICIV-2010-208--ICIE-CMV-2024-04.pdf' },
  { clave: 'ICIV-2010-208--ICIE-EST-2023-01', nombre: 'Estructuras', url: 'http://cc.villahermosa.tecnm.mx/sys/estpro/reticulas/ICIV-2010-208--ICIE-EST-2023-01.pdf' },
];

// Dos bases de URL: los temarios regulares y la especialidad de
// Estructuras viven en el servidor 2010; la especialidad de Vías
// Terrestres vive en el servidor 2024.
const BASE_2010 = 'https://villahermosa.tecnm.mx/docs/oferta/ingcivil/temario2010';
const BASE_2024 = 'https://villahermosa.tecnm.mx/docs/oferta/ingcivil/temario2024';

const SEMESTRES = [
  { numero: 1, materias: [
    { nombre: 'Fundamentos de Investigación', url: `${BASE_2010}/1semestre/FundamentosdeInvestigacion-AC006.pdf` },
    { nombre: 'Cálculo Diferencial', url: `${BASE_2010}/1semestre/CalculoDiferencial-AC001.pdf` },
    { nombre: 'Taller de Ética', url: `${BASE_2010}/1semestre/TallerdeEtica-AC007.pdf` },
    { nombre: 'Química', url: `${BASE_2010}/1semestre/Quimica-AE058.pdf` },
    { nombre: 'Software en Ingeniería Civil', url: `${BASE_2010}/1semestre/SOFTWARE-DE-INGENIERIA-CIVIL.pdf` },
    { nombre: 'Dibujo en Ingeniería Civil', url: `${BASE_2010}/1semestre/DIBUJO-EN-INGENIERIA-CIVIL.pdf` },
  ] },
  { numero: 2, materias: [
    { nombre: 'Cálculo Integral', url: `${BASE_2010}/2semestre/CalculoIntegral-AC002.pdf` },
    { nombre: 'Cálculo Vectorial', url: `${BASE_2010}/2semestre/CalculoVectorial-AC004.pdf` },
    { nombre: 'Probabilidad y Estadística', url: `${BASE_2010}/2semestre/PROBABILIDADYESTADISTICA.pdf` },
    { nombre: 'Topografía', url: `${BASE_2010}/2semestre/TOPOGRAFIA.pdf` },
    { nombre: 'Materiales y Procesos Constructivos', url: `${BASE_2010}/2semestre/MATERIALESYPROCESOSCONSTRUCTIVOS.pdf` },
    { nombre: 'Geología', url: `${BASE_2010}/2semestre/GEOLOGIA.pdf` },
  ] },
  { numero: 3, materias: [
    { nombre: 'Álgebra Lineal', url: `${BASE_2010}/3semestre/AlgebraLineal-AC003.pdf` },
    { nombre: 'Ecuaciones Diferenciales', url: `${BASE_2010}/3semestre/EcuacionesDiferenciales-AC005.pdf` },
    { nombre: 'Estática', url: `${BASE_2010}/3semestre/ESTATICA.pdf` },
    { nombre: 'Carreteras', url: `${BASE_2010}/3semestre/CARRETERAS.pdf` },
    { nombre: 'Tecnología del Concreto', url: `${BASE_2010}/3semestre/TECNOLOGIADELCONCRETO.pdf` },
    { nombre: 'Sistemas de Transporte', url: `${BASE_2010}/3semestre/SISTEMASDETRANSPORTE.pdf` },
  ] },
  { numero: 4, materias: [
    { nombre: 'Fundamentos de la Mecánica de los Medios Continuos', url: `${BASE_2010}/4semestre/FUNDAMENTOSDELAMECANICADELOSMEDIOSCONTINUOS.pdf` },
    { nombre: 'Métodos Numéricos', url: `${BASE_2010}/4semestre/METODOSNUMERICOS.pdf` },
    { nombre: 'Mecánica de Suelos', url: `${BASE_2010}/4semestre/MECANICADESUELOS.pdf` },
    { nombre: 'Maquinaria Pesada y Movimiento de Tierras', url: `${BASE_2010}/4semestre/MAQUINARIAPESADAYMOVIMIENTODETIERRAS.pdf` },
    { nombre: 'Dinámica', url: `${BASE_2010}/4semestre/DINAMICA.pdf` },
    { nombre: 'Modelos de Optimización de Recursos', url: `${BASE_2010}/4semestre/MODELOSDEOPTIMIZACIONDERECURSOS.pdf` },
  ] },
  { numero: 5, materias: [
    { nombre: 'Mecánica de Materiales', url: `${BASE_2010}/5semestre/MECANICADEMATERIALES.pdf` },
    { nombre: 'Desarrollo Sustentable', url: `${BASE_2010}/5semestre/DesarrolloSustentable-AC008.pdf` },
    { nombre: 'Mecánica de Suelos Aplicada', url: `${BASE_2010}/5semestre/MECANICADESUELOSAPLICADA.pdf` },
    { nombre: 'Costos y Presupuestos', url: `${BASE_2010}/5semestre/COSTOSYPRESUPUESTOS.pdf` },
    { nombre: 'Taller de Investigación I', url: `${BASE_2010}/5semestre/TallerdeInvestigacion-I-AC009.pdf` },
    { nombre: 'Hidráulica Básica', url: `${BASE_2010}/5semestre/HIDRAULICABASICA.pdf` },
  ] },
  { numero: 6, materias: [
    { nombre: 'Análisis Estructural', url: `${BASE_2010}/6semestre/ANALISISESTRUCTURAL.pdf` },
    { nombre: 'Instalaciones en los Edificios', url: `${BASE_2010}/6semestre/INSTALACIONESENLOSEDIFICIOS.pdf` },
    { nombre: 'Diseño y Construcción de Pavimentos', url: `${BASE_2010}/6semestre/DISENOYCONSTRUCCIONDEPAVIMENTOS.pdf` },
    { nombre: 'Administración de la Construcción', url: `${BASE_2010}/6semestre/ADMINISTRACIONDELACONSTRUCCION.pdf` },
    { nombre: 'Hidrología Superficial', url: `${BASE_2010}/6semestre/HIDROLOGIASUPERFICIAL.pdf` },
    { nombre: 'Hidráulica de Canales', url: `${BASE_2010}/6semestre/HIDRAULICADECANALES.pdf` },
  ] },
  { numero: 7, materias: [
    { nombre: 'Análisis Estructural Avanzado', url: `${BASE_2010}/7semestre/ANALISISESTRUCTURAL-AVANZADO.pdf` },
    { nombre: 'Diseño de Elementos de Concreto Reforzado', url: `${BASE_2010}/7semestre/DISENODEELEMENTOSDECONCRETOREFORZADO.pdf` },
    { nombre: 'Taller de Investigación II', url: `${BASE_2010}/7semestre/TallerdeInvestigacionII-AC010.pdf` },
    { nombre: 'Abastecimiento de Agua', url: `${BASE_2010}/7semestre/ABASTECIMIENTODEAGUA.pdf` },
  ] },
  { numero: 8, materias: [
    { nombre: 'Diseño Estructural de Cimentaciones', url: `${BASE_2010}/8semestre/DISENOESTRUCTURALDECIMENTACIONES.pdf` },
    { nombre: 'Diseño de Elementos de Acero', url: `${BASE_2010}/8semestre/DISENODEELEMENTOSDEACERO.pdf` },
    { nombre: 'Formulación y Evaluación de Proyectos', url: `${BASE_2010}/8semestre/FORMULACIONYEVALUACIONDEPROYECTOS.pdf` },
    { nombre: 'Alcantarillado', url: `${BASE_2010}/8semestre/ALCANTARILLADO.pdf` },
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
    nombre: 'Estructuras (ICIE-EST-2023-01)',
    icono: '📐',
    color: PRIMARY,
    // Temarios en el servidor 2010 (BASE_2010).
    materias: [
      { nombre: 'Normas y Reglamentos para Diseños Estructurales y Sostenibles', url: `${BASE_2010}/Especialidad/ICIE-EST-2023-01/NormasyReglamentos.pdf` },
      { nombre: 'Obras de Ingeniería Sostenible', url: `${BASE_2010}/Especialidad/ICIE-EST-2023-01/ObrasdeIngenieriIaSostenible.pdf` },
      { nombre: 'Análisis Sísmico y Eólico', url: `${BASE_2010}/Especialidad/ICIE-EST-2023-01/AnalisisSismicoyEolico.pdf` },
      { nombre: 'Estructuras de Mampostería', url: `${BASE_2010}/Especialidad/ICIE-EST-2023-01/EstructurasdeMamposteria.pdf` },
      { nombre: 'Diseño Estructural Sostenible Con Elementos Prefabricados', url: `${BASE_2010}/Especialidad/ICIE-EST-2023-01/Disen%CC%83oEstructuralSostenible.pdf` },
    ],
  },
  {
    nombre: 'Construcción y Mantenimiento de Vías Terrestres (ICIE-CMV-2024-04)',
    icono: '🛣️',
    color: SECONDARY,
    // Temarios en el servidor 2024 (BASE_2024), distinto al de Estructuras.
    materias: [
      { nombre: 'Ingeniería de Tránsito Revisada', url: `${BASE_2024}/Especialidad/ICIE-CMV-2024-04/Ingenieriadetransitorevisada.pdf` },
      { nombre: 'Topografía Aplicada', url: `${BASE_2024}/Especialidad/ICIE-CMV-2024-04/TOPOGRAFIAAPLICADA.pdf` },
      { nombre: 'Construcción de Vías Férreas', url: `${BASE_2024}/Especialidad/ICIE-CMV-2024-04/CONSTRUCCIONDEVIASFERREAS.pdf` },
      { nombre: 'Mantenimiento y Conservación de Vías Terrestres', url: `${BASE_2024}/Especialidad/ICIE-CMV-2024-04/MantoconservacionViasterrestres.pdf` },
      { nombre: 'Auditoría de Seguridad a las Vías Férreas', url: `${BASE_2024}/Especialidad/ICIE-CMV-2024-04/AuditoriaSeguridadViasFerreas.pdf` },
    ],
  },
];

/**
 * Pinta la pantalla de Ing. Civil dentro de `contenedor`. Función
 * invocada por el dispatcher de carreras.js.
 * @param {HTMLElement} contenedor
 */
export function renderICIV(contenedor) {
  contenedor.innerHTML = `
    <div class="carrera">
      ${renderHeroCarrera({
        color: PRIMARY,
        icono: '📐',
        departamento: 'Departamento de Ciencias de la Tierra',
        titulo: 'Ingeniería Civil',
      })}

      <div class="carrera-cuerpo">

        <div class="carrera-cards">
          ${renderInfoCard({
            icono: '🚩',
            titulo: 'Misión',
            contenido: 'Formar profesionistas en Ingeniería Civil con una preparación científica-tecnológica con competencias sinérgicas, espíritu innovador que contribuya al desarrollo sustentable y a la calidad de vida del ser humano.',
            color: PRIMARY,
          })}
          ${renderInfoCard({
            icono: '👁️',
            titulo: 'Visión',
            contenido: 'Ser un programa de ingeniería Civil de calidad, que impulsa el desarrollo integral, sostenido y sustentable.',
            color: TERTIARY,
          })}
        </div>

        ${renderSectionTitle('Objetivo General', PRIMARY)}
        ${renderObjetivoGeneral(
          'Formar profesionistas en ingeniería civil de manera integral, con visión humana, analítica, creativa y emprendedora, capaces de identificar y resolver problemas con eficiencia, eficacia y pertinencia, mediante la planeación, diseño, construcción, operación y conservación de obras de infraestructura, en el marco de la globalización, la sustentabilidad y la calidad, contribuyendo al desarrollo de la sociedad.',
          PRIMARY
        )}

        ${renderSectionTitle('Objetivos Específicos', PRIMARY)}
        <div class="carrera-objetivos">
          ${OBJETIVOS.map(([n, t, d]) => renderObjetivoItem(n, t, d, PRIMARY)).join('')}
        </div>

        ${renderSectionTitle('Perfil de Ingreso', SECONDARY)}
        ${renderPerfilSection(
          [
            'El estudiante de Ingeniería Civil debe mostrar habilidad e ingenio para la solución de problemas.',
            'Tener predilección por las ciencias físico-matemáticas.',
            'Disposición para el trabajo arduo y en equipo.',
          ],
          SECONDARY
        )}

        ${renderSectionTitle('Perfil de Egreso', TERTIARY)}
        ${renderPerfilSection(
          [
            'Planea, proyecta, diseña, construye, opera y conserva obras hidráulicas y sanitarias, sistemas estructurales, vías terrestres, edificación y obras de infraestructura urbana e industrial para el desarrollo de la sociedad.',
            'Dirige equipos técnicos para determinar la factibilidad ambiental, económica, técnica y social de los proyectos de obras civiles.',
            'Formula y ejecuta proyectos de investigación para el desarrollo tecnológico en el ámbito de la Ingeniería Civil.',
            'Crea, adapta, innova y aplica tecnologías en los estudios, proyectos y construcción de obras civiles para los requerimientos de la sociedad.',
            'Administra proyectos para optimizar el uso de los recursos en el logro de los objetivos de las obras civiles.',
            'Emplea técnicas de control de calidad en los materiales y procesos constructivos para la seguridad y durabilidad de las obras de ingeniería civil.',
            'Utiliza tecnologías de la información y comunicación para la optimización de los proyectos de Ingeniería Civil.',
            'Emprende proyectos productivos pertinentes para el desarrollo sustentable de las comunidades.',
          ],
          TERTIARY
        )}

        ${renderSectionTitle('Campo Laboral', PRIMARY)}
        ${renderPerfilSection(
          [
            'Pemex.',
            'Secretaría de Comunicaciones y Transporte.',
            'Secretarías de Obras Públicas (Ayuntamientos).',
            'Secretaría de Ordenamiento Territorial y Obras Públicas del Estado de Tabasco.',
          ],
          PRIMARY
        )}

        ${renderSectionTitle('Retículas 2010-208', PRIMARY)}
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