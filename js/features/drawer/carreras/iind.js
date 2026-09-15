// ═════════════════════════════════════════════════════════════════
// iind.js
//
// Pantalla informativa de la Ingeniería Industrial. Réplica
// funcional de IIND.dart. Primera carrera fuera del Departamento de
// Sistemas y Computación — pertenece al área "industrial" en
// oferta-educativa.js.
//
// Color de acento: cs.primary de Flutter → var(--color-primary),
// usado en semestres, Objetivo General y retícula. Perfil de
// Ingreso usa cs.secondary, Perfil de Egreso y la especialidad usan
// cs.tertiary — igual que en el Dart original.
// ═════════════════════════════════════════════════════════════════

import {
  renderHeroCarrera,
  renderSectionTitle,
  renderInfoCard,
  renderObjetivoGeneral,
  renderObjetivoItem,
  renderPerfilSection,
  renderCampoLaboral,
  renderReticulaItem,
  renderSemestreExpansion,
  renderEspecialidadExpansion,
  inicializarCarrera,
} from './comun.js';

const COLOR = 'var(--color-primary)';
const COLOR_INGRESO = 'var(--color-secondary)';
const COLOR_EGRESO = 'var(--color-tertiary)';

/** Pinta la pantalla de IIND completa dentro de `contenedor`. */
export function renderIIND(contenedor) {
  contenedor.innerHTML = `
    <div class="carrera">
      ${renderHeroCarrera({
        color: COLOR,
        icono: '🏭',
        departamento: 'Departamento de Ingeniería Industrial',
        titulo: 'Ingeniería Industrial',
      })}

      <div class="carrera-cuerpo">

        <div class="carrera-cards">
          ${renderInfoCard({
            icono: '🚩',
            titulo: 'Misión',
            contenido:
              'Formadora de profesionales en Ingeniería Industrial en el sureste del país, capaces de desarrollar competencias instrumentales, sistémicas y actitudinales con alta responsabilidad.',
            color: COLOR,
          })}
          ${renderInfoCard({
            icono: '👁️',
            titulo: 'Visión',
            contenido:
              'Ser líder en ingeniería industrial en el sureste de México, formando profesionales competitivos con ética y armonía con el medio ambiente.',
            color: COLOR_EGRESO,
          })}
        </div>

        ${renderSectionTitle('Objetivo General', COLOR)}
        ${renderObjetivoGeneral(
          'Formar profesionistas en el campo de la ingeniería industrial, líderes, creativos y emprendedores con visión sistémica, capacidad analítica y competitiva que les permita diseñar, implementar, mejorar, innovar, optimizar y administrar sistemas de producción de bienes y servicios en un entorno global, con enfoque sustentable, ético y comprometido con la sociedad.',
          COLOR
        )}

        ${renderSectionTitle('Objetivos Específicos', COLOR)}
        <div class="carrera-objetivos">
          ${_objetivos.map((o) => renderObjetivoItem(o.numero, o.titulo, o.descripcion, COLOR)).join('')}
        </div>

        ${renderSectionTitle('Perfil de Ingreso', COLOR)}
        ${renderPerfilSection(_perfilIngreso, COLOR_INGRESO)}

        ${renderSectionTitle('Perfil de Egreso', COLOR)}
        ${renderPerfilSection(_perfilEgreso, COLOR_EGRESO)}

        ${renderSectionTitle('Campo Laboral', COLOR)}
        ${renderCampoLaboral({
          texto:
            'Los egresados pueden desempeñarse en sectores públicos, privados y sociales, tanto en la industria como en instituciones educativas, consultorías y organizaciones sin fines de lucro.',
          chips: _sectores,
          color: COLOR,
        })}

        ${renderSectionTitle('Retícula IIND-2010-227', COLOR)}
        <div class="carrera-reticulas">
          ${renderReticulaItem(_reticula, COLOR)}
        </div>

        ${renderSectionTitle('Plan de Estudios', COLOR)}
        <div class="carrera-semestres">
          ${_semestres.map((s) => renderSemestreExpansion(s, COLOR)).join('')}
        </div>

        ${renderSectionTitle('Especialidad', COLOR)}
        <div class="carrera-especialidades">
          ${renderEspecialidadExpansion(_especialidad, COLOR_EGRESO)}
        </div>

      </div>
    </div>
  `;

  inicializarCarrera(contenedor);
}

// ═════════════════════════════════════════════════════════════════
// DATOS
// ═════════════════════════════════════════════════════════════════

const _objetivos = [
  {
    numero: 1,
    titulo: 'Resolver Problemas',
    descripcion: 'Desarrolla sistemas productivos de bienes y servicios aplicando tecnologías para su optimización.',
  },
  {
    numero: 2,
    titulo: 'Saber Diseñar',
    descripcion: 'Diseña sistemas de trabajo para elevar la productividad mediante mejora continua.',
  },
  {
    numero: 3,
    titulo: 'Hacer Experimentos',
    descripcion: 'Desarrolla investigación para mejorar los sistemas de trabajo y elevar la productividad.',
  },
  {
    numero: 4,
    titulo: 'Saber Comunicarse',
    descripcion: 'Administra la información de los procesos de bienes y servicios para la optimización de los recursos.',
  },
  {
    numero: 5,
    titulo: 'Ser Ético',
    descripcion: 'Gestiona sistemas productivos de bienes y servicios atendiendo los lineamientos legales.',
  },
  {
    numero: 6,
    titulo: 'Actualizarse',
    descripcion: 'Actualiza sus conocimientos permanentemente para mejorar la competitividad de las organizaciones.',
  },
  {
    numero: 7,
    titulo: 'Trabajar en Equipo',
    descripcion:
      'Dirige equipos de trabajo para el desarrollo de proyectos de inversión, sociales y de transferencia de tecnología.',
  },
];

const _perfilIngreso = [
  'Capacidad de análisis, síntesis y juicio crítico.',
  'Capacidad de planeación, organización y coordinación de tareas.',
  'Liderazgo positivo, capacidad de dirección y de mando.',
  'Actitud emprendedora e interés por mejorar el entorno.',
];

const _perfilEgreso = [
  'Diseña, mejora e integra sistemas productivos de bienes y servicios aplicando tecnologías para su optimización.',
  'Diseña, implementa y mejora sistemas de trabajo para elevar la productividad.',
  'Implanta sistemas de calidad utilizando métodos estadísticos para mejorar la competitividad de las organizaciones.',
  'Administra sistemas de mantenimiento en procesos de bienes y servicios para la optimización en el uso de los recursos.',
  'Gestiona sistemas de seguridad y salud ocupacional de manera sustentable, atendiendo los lineamientos legales.',
  'Formula, evalúa y gestiona proyectos de inversión, sociales y de transferencia de tecnología para el desarrollo regional.',
];

const _sectores = [
  { icono: '🏛️', nombre: 'Sector Público' },
  { icono: '🏭', nombre: 'Sector Industrial' },
  { icono: '🏬', nombre: 'Comercio y Servicios' },
  { icono: '🎓', nombre: 'Instituciones Educativas' },
  { icono: '🤝', nombre: 'Consultoría' },
  { icono: '❤️', nombre: 'Org. sin fines de lucro' },
];

const _reticula = {
  clave: 'IIND-2010-227',
  nombre: 'Retícula 2010 - IINE-CSP-2023-01 (D)',
  url: 'http://cc.villahermosa.tecnm.mx/sys/estpro/reticulas/IIND-2010-227--IINE-CSP-2023-01.pdf',
};

// URL base de los temarios para no repetirla en cada materia.
const _base = 'https://villahermosa.tecnm.mx/docs/oferta/ingindustrial/temario2010';

const _semestres = [
  {
    numero: 1,
    materias: [
      { nombre: 'Fundamentos de Investigación', url: `${_base}/1semestre/FundamentosdeInvestigacion-ACC-0906.pdf` },
      { nombre: 'Taller de Ética', url: `${_base}/1semestre/TallerdeEtica-ACA-0907.pdf` },
      { nombre: 'Cálculo Diferencial', url: `${_base}/1semestre/CalculoDiferencial-AC001.pdf` },
      { nombre: 'Taller de Herramientas Intelectuales', url: `${_base}/1semestre/TALLERDEHERRAMIENTASINTELECTUALESv2.pdf` },
      { nombre: 'Química', url: `${_base}/1semestre/QUIMICAv2.pdf` },
      { nombre: 'Dibujo Industrial', url: `${_base}/1semestre/DIBUJOINDUSTRIALv2.pdf` },
    ],
  },
  {
    numero: 2,
    materias: [
      { nombre: 'Electricidad y Electrónica Industrial', url: `${_base}/2semestre/ELECTRICIDADYELECTRONICAINDUSTRIALv2.pdf` },
      { nombre: 'Propiedad de los Materiales', url: `${_base}/2semestre/PROPIEDADDELOSMATERIALESv2.pdf` },
      { nombre: 'Cálculo Integral', url: `${_base}/2semestre/CalculoIntegral-ACF%E2%80%930902.pdf` },
      { nombre: 'Probabilidad y Estadística', url: `${_base}/2semestre/ProbabilidadyEstadistica-AEC-1053.pdf` },
      { nombre: 'Análisis de la Realidad Nacional', url: `${_base}/2semestre/ANALISISDELAREALIDADNACIONALv2.pdf` },
      { nombre: 'Taller de Liderazgo', url: `${_base}/2semestre/TALLERDELIDERAZGO.pdf` },
    ],
  },
  {
    numero: 3,
    materias: [
      { nombre: 'Metrología y Normalización', url: `${_base}/3semestre/MetrologiayNormalizacion-AEC-1048.pdf` },
      { nombre: 'Álgebra Lineal', url: `${_base}/3semestre/AlgebraLineal-ACF%E2%80%930903.pdf` },
      { nombre: 'Cálculo Vectorial', url: `${_base}/3semestre/CalculoVectorial-ACF%E2%80%930904.pdf` },
      { nombre: 'Economía', url: `${_base}/3semestre/Economia-AEC-1018.pdf` },
      { nombre: 'Estadística Inferencial I', url: `${_base}/3semestre/EstadisticaInferencial-I-AEF%E2%80%931024.pdf` },
      { nombre: 'Estudio del Trabajo I', url: `${_base}/3semestre/ESTUDIODELTRABAJO-I-v2.pdf` },
    ],
  },
  {
    numero: 4,
    materias: [
      { nombre: 'Procesos de Fabricación', url: `${_base}/4semestre/PROCESOSDEFABRICACIONv2.pdf` },
      { nombre: 'Física', url: `${_base}/4semestre/FISICAv2.pdf` },
      {
        nombre: 'Algoritmos y Lenguajes de Programación',
        url: `${_base}/4semestre/ALGORITMOSYLENGUAJESDEPROGRAMACIONv2.pdf`,
      },
      { nombre: 'Investigación de Operaciones I', url: `${_base}/4semestre/INVESTIGACIONDEOPERACIONES-I-v2.pdf` },
      { nombre: 'Estadística Inferencial II', url: `${_base}/4semestre/EstadisticaInferencial-II-AEF%E2%80%931025.pdf` },
      { nombre: 'Estudio del Trabajo II', url: `${_base}/4semestre/ESTUDIODELTRABAJOIIv2.pdf` },
      { nombre: 'Higiene y Seguridad Industrial', url: `${_base}/4semestre/HIGIENEYSEGURIDADINDUSTRIAL%20.pdf` },
    ],
  },
  {
    numero: 5,
    materias: [
      { nombre: 'Administración de Proyectos', url: `${_base}/5semestre/ADMINISTRACIONDEPROYECTOSv2.pdf` },
      { nombre: 'Gestión de Costos', url: `${_base}/5semestre/GestiondeCostos-AE092.pdf` },
      { nombre: 'Administración de Operaciones I', url: `${_base}/5semestre/ADMINISTRACIONDEOPERACIONESIv2.pdf` },
      { nombre: 'Investigación de Operaciones II', url: `${_base}/5semestre/INVESTIGACIONDEOPERACIONESIIv2.pdf` },
      { nombre: 'Control Estadístico de la Calidad', url: `${_base}/5semestre/CONTROLESTADISTICODELACALIDA%20v2.pdf` },
      { nombre: 'Ergonomía', url: `${_base}/5semestre/ERGONOMIAv2.pdf` },
      { nombre: 'Desarrollo Sustentable', url: `${_base}/5semestre/DesarrolloSustentable-AC008.pdf` },
    ],
  },
  {
    numero: 6,
    materias: [
      { nombre: 'Taller de Investigación I', url: `${_base}/6semestre/TallerdeInvestigacionIAC009.pdf` },
      { nombre: 'Ingeniería Económica', url: `${_base}/6semestre/IngenieriaEconomica-AE037.pdf` },
      { nombre: 'Administración de las Operaciones II', url: `${_base}/6semestre/ADMINISTRACIONDEOPERACIONESIIv2.pdf` },
      { nombre: 'Simulación', url: `${_base}/6semestre/SIMULACIONv2.pdf` },
      { nombre: 'Administración del Mantenimiento', url: `${_base}/6semestre/ADMINISTRACIONDELMANTENIMIENTOV2.pdf` },
      { nombre: 'Mercadotecnia', url: `${_base}/6semestre/Mecadotecnia-AE044.pdf` },
    ],
  },
  {
    numero: 7,
    materias: [
      { nombre: 'Taller de Investigación II', url: `${_base}/7semestre/TallerdeInvestigacionII-AC010.pdf` },
      { nombre: 'Planeación Financiera', url: `${_base}/7semestre/PLANEACIONFINANCIERAv2.pdf` },
      {
        nombre: 'Planeación y Diseño de Instalaciones',
        url: `${_base}/7semestre/PLANEACIONYDISENODEINSTALACIONESv2.pdf`,
      },
      { nombre: 'Sistemas de Manufactura', url: `${_base}/7semestre/SISTEMASDEMANUFACTURA.pdf` },
      { nombre: 'Logística y Cadenas de Suministro', url: `${_base}/7semestre/LOGISTICAyCADENADESUMINISTROv2.pdf` },
      { nombre: 'Gestión de los Sistemas de Calidad', url: `${_base}/7semestre/GESTIONDELOSSITEMASDECALIDADv2.pdf` },
      { nombre: 'Ingeniería de Sistemas', url: `${_base}/7semestre/INGENIERIADESISTEMASv2.pdf` },
    ],
  },
  {
    numero: 8,
    materias: [
      {
        nombre: 'Formulación y Evaluación de Proyectos',
        url: `${_base}/8semestre/FormulacionyEvaluaciondeProyectos-AED-1030.pdf`,
      },
      { nombre: 'Relaciones Industriales', url: `${_base}/8semestre/RELACIONESINDUSTRIALESv2.pdf` },
    ],
  },
  // 9no semestre: actividades institucionales sin PDF de temario.
  {
    numero: 9,
    materias: [
      { nombre: 'Especialidad', url: '' },
      { nombre: 'Residencia Profesional', url: '' },
      { nombre: 'Servicio Social', url: '' },
      { nombre: 'Actividades Complementarias', url: '' },
    ],
  },
];

// Única especialidad de IIND: modelo más simple que en otras
// carreras (sin función de color por tema), con ícono fijo y
// subtitulo mostrando la clave del plan en vez del conteo de
// materias — igual que Icons.workspace_premium + subtitle en Dart.
const _especialidad = {
  nombre: 'Calidad, Seguridad y Productividad',
  icono: '🏅',
  color: 'var(--color-tertiary)',
  subtitulo: 'IINE-CSP-2023-01 (D)',
  materias: [
    {
      nombre: 'Investigación y Desarrollo',
      url: 'https://villahermosa.tecnm.mx/docs/oferta/ingindustrial/temario-IINE-CPC-2017-01(B)/01_INVESTIGACION%20Y%20DESARROLLO.pdf',
    },
    {
      nombre: 'Innovación en los Sistemas de Gestión de la Seguridad',
      url: 'https://villahermosa.tecnm.mx/docs/oferta/ingindustrial/especialidad/INNOVACIONSEGURIDAD.pdf',
    },
    {
      nombre: 'Métodos de Análisis de Riesgo para la Seguridad',
      url: 'https://villahermosa.tecnm.mx/docs/oferta/ingindustrial/especialidad/METODOSRIESGOSSEGURIDAD.pdf',
    },
    {
      nombre: 'Ingeniería de Calidad',
      url: 'https://villahermosa.tecnm.mx/docs/oferta/ingindustrial/especialidad/INGENIERIACALIDAD.pdf',
    },
    {
      nombre: 'Administración de la Calidad',
      url: 'https://villahermosa.tecnm.mx/docs/oferta/ingindustrial/especialidad/ADMINISTRACIONCALIDAD.pdf',
    },
    {
      nombre: 'Dirección Estratégica',
      url: 'https://villahermosa.tecnm.mx/docs/oferta/ingindustrial/especialidad/DIRECCIONESTRATEGICA.pdf',
    },
    {
      nombre: 'Productividad y Competitividad',
      url: 'https://villahermosa.tecnm.mx/docs/oferta/ingindustrial/especialidad/PRODUCTIVIDADCOMPETITIVIDAD.pdf',
    },
    {
      nombre: 'Herramientas Aplicadas a la Calidad',
      url: 'https://villahermosa.tecnm.mx/docs/oferta/ingindustrial/especialidad/HERRAMIENTASCALIDAD.pdf',
    },
  ],
};