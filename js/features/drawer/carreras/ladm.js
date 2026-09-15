// ═════════════════════════════════════════════════════════════════
// ladm.js
//
// Pantalla informativa de la Licenciatura en Administración.
// Réplica funcional de LADM.dart.
//
// Color de acento: valores fijos (no reactivos al tema), tal como
// en el Dart original — LADM usa Color(0xFF4CAF50) y Color(0xFF2E7D32)
// como constantes de archivo en vez de cs.primary/secondary/tertiary,
// así que aquí se usan directamente como hex literales en vez de
// var(--color-*).
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

// Colores fijos, réplica exacta de las constantes _verde/_verdeOscuro
// del Dart original — no reaccionan al tema oscuro/claro.
const VERDE = '#4caf50';
const VERDE_OSCURO = '#2e7d32';
const VERDE_MUY_OSCURO = '#1b5e20'; // acento de la tercera especialidad

/** Pinta la pantalla de LADM completa dentro de `contenedor`. */
export function renderLADM(contenedor) {
  contenedor.innerHTML = `
    <div class="carrera">
      ${renderHeroCarrera({
        color: VERDE,
        icono: '🏛️',
        departamento: 'Departamento Económico Administrativo',
        titulo: 'Lic. en Administración',
      })}

      <div class="carrera-cuerpo">

        ${renderSectionTitle('Objetivo General', VERDE)}
        ${renderObjetivoGeneral(
          'Formar profesionales de la administración capaces de actuar como agentes de cambio, a través del diseño, innovación y dirección en organizaciones, sensibles a las demandas sociales y oportunidades del entorno, con capacidad de intervención en ámbitos globales y con un firme propósito de observar las normas y los valores universales.',
          VERDE
        )}

        ${renderSectionTitle('Objetivos Específicos', VERDE)}
        <div class="carrera-objetivos">
          ${_objetivos.map((o) => renderObjetivoItem(o.numero, o.titulo, o.descripcion, VERDE)).join('')}
        </div>

        ${renderSectionTitle('Perfil de Ingreso', VERDE)}
        ${renderPerfilSection(_perfilIngreso, VERDE)}

        ${renderSectionTitle('Perfil de Egreso', VERDE)}
        ${renderPerfilSection(_perfilEgreso, VERDE_OSCURO)}

        ${renderSectionTitle('Campo Laboral', VERDE)}
        ${renderPerfilSection(_campoLaboral, VERDE)}

        ${renderSectionTitle('Retículas 2010', VERDE)}
        <div class="carrera-reticulas">
          ${_reticulas.map((r) => renderReticulaItem(r, VERDE)).join('')}
        </div>

        ${renderSectionTitle('Plan de Estudios', VERDE)}
        <div class="carrera-semestres">
          ${_semestres.map((s) => renderSemestreExpansion(s, VERDE)).join('')}
        </div>

        ${renderSectionTitle('Especialidades', VERDE)}
        <div class="carrera-especialidades">
          ${_especialidades.map((e) => renderEspecialidadExpansion(e, VERDE)).join('')}
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
    descripcion: 'Identifica y resuelve problemas aplicando estrategias de dirección para la competitividad y productividad de las organizaciones.',
  },
  {
    numero: 2,
    titulo: 'Saber Diseñar',
    descripcion:
      'Diseña estrategias mediante decisiones basadas en el análisis de la información interna y del entorno global que aseguren el éxito de la comercialización de productos y servicios.',
  },
  {
    numero: 3,
    titulo: 'Hacer Experimentos',
    descripcion: 'Desarrolla proyectos sustentables aplicando herramientas administrativas y métodos de investigación.',
  },
  {
    numero: 4,
    titulo: 'Saber Comunicarse',
    descripcion:
      'Comunicarse efectivamente para conducir la organización hacia la consecución de sus objetivos mediante un esfuerzo coordinado y espíritu emprendedor.',
  },
  {
    numero: 5,
    titulo: 'Ser Ético',
    descripcion:
      'Reconoce sus responsabilidades éticas y profesionales en situaciones relevantes para la administración, considerando el impacto de las soluciones en los contextos global, económico, ambiental y social.',
  },
  {
    numero: 6,
    titulo: 'Actualizarse',
    descripcion: 'Actualiza sus conocimientos permanentemente para responder a los cambios globales.',
  },
  {
    numero: 7,
    titulo: 'Trabajar en Equipo',
    descripcion: 'Integrar y coordinar equipos interdisciplinarios para favorecer el crecimiento de la organización y su entorno global.',
  },
];

const _perfilIngreso = [
  'Capacidad de liderazgo.',
  'Trabajo en equipo.',
  'Toma de decisiones.',
  'Adaptación al cambio.',
  'Capacidad de expresión verbal y escritura.',
  'Capacidad de adaptación al trabajo, ética y valores.',
];

const _perfilEgreso = [
  'Integrar los procesos gerenciales, de administración, de innovación y las estrategias de dirección para la competitividad y productividad de las organizaciones.',
  'Aplicar los conocimientos modernos de la gestión de negocios a las fases del proceso administrativo para la optimización de recursos y el manejo de los cambios organizacionales.',
  'Desarrollar las habilidades directivas y de vinculación basadas en la ética y la responsabilidad social, que le permitan integrar y coordinar equipos interdisciplinarios.',
  'Crear y desarrollar proyectos sustentables aplicando herramientas administrativas y métodos de investigación de vanguardia, con un enfoque estratégico, multicultural y humanista.',
  'Conducir la organización hacia la consecución de sus objetivos mediante un esfuerzo coordinado y espíritu emprendedor.',
  'Crear organizaciones que contribuyan a la transformación económica y social, identificando las oportunidades de negocios en un contexto global.',
  'Conocer y aplicar el marco legal vigente nacional e internacional de las organizaciones.',
  'Analizar e interpretar información financiera y económica para la toma de decisiones en las organizaciones.',
  'Ser un agente de cambio con la habilidad de potenciar el capital humano para la solución de los problemas y la toma de decisiones.',
  'Implementar y administrar sistemas de gestión de calidad orientados a la mejora continua y productividad de la organización.',
  'Aplicar las tecnologías de la información y comunicación para optimizar el trabajo y desarrollo de la organización.',
  'Actualizar conocimientos permanentemente para responder a los cambios globales.',
  'Diseñar sistemas de organización considerando alternativas estratégicas que generen cadenas productivas en beneficio de la sociedad.',
  'Tener visión multidisciplinaria para generar propuestas y desarrollar acciones ante escenarios de contingencia.',
  'Diseñar estrategias de mercadotecnia basadas en el análisis de la información interna y del entorno global.',
];

const _campoLaboral = [
  'Sector público federal, estatal y municipal.',
  'Sector privado industrial, comercial o de servicios.',
  'Ejercicio en forma independiente de la profesión en consultorías o asesorías.',
  'Instituciones educativas públicas o privadas, desempeñando funciones administrativas o docentes.',
];

const _reticulas = [
  {
    clave: 'INTE-AFI-2018-01',
    nombre: 'Administración y Finanzas',
    url: 'https://villahermosa.tecnm.mx/docs/oferta/licadministracion/reticula/LAE_CON_ADMON_Y_FINANZAS_RETICULA.pdf',
  },
  {
    clave: 'LADE-PES-2017-01',
    nombre: 'Proyectos Empresariales Sustentables',
    url: 'https://villahermosa.tecnm.mx/docs/oferta/licadministracion/reticula/LAE_CON_PROYECTOS_EMPRESARIALES_RETICULA.pdf',
  },
  {
    clave: 'LADE-CHT-2023-02',
    nombre: 'Capital Humano y Transformación Digital',
    url: 'http://cc.villahermosa.tecnm.mx/sys/estpro/reticulas/LADM-2010-234--LADE-CHT-2023-02.pdf',
  },
];

// URL base de los temarios para no repetirla en cada materia.
const _base = 'https://villahermosa.tecnm.mx/docs/oferta/licadministracion/temario2010';
const _esp = 'https://villahermosa.tecnm.mx/docs/oferta/licadministracion/temario2010/Especialidad';

const _semestres = [
  {
    numero: 1,
    materias: [
      { nombre: 'Teoría General de la Administración', url: `${_base}/1semestre/LAC-1035TeoriaGeneraldelaAdministracion_OK_2016.pdf` },
      { nombre: 'Informática para la Administración', url: `${_base}/1semestre/LAV-1025InformaticaparalaAdministracion_OK_2016.pdf` },
      { nombre: 'Taller de Ética', url: `${_base}/1semestre/TallerdeEtica-ACA-0907.pdf` },
      { nombre: 'Fundamentos de Investigación', url: `${_base}/1semestre/FundamentosdeInvestigacion-ACC-0906.pdf` },
      {
        nombre: 'Matemáticas Aplicadas a la Administración',
        url: `${_base}/1semestre/LAD-1027MatematicasAplicadasalaAdministracion_OK_2016.pdf`,
      },
      { nombre: 'Contabilidad General', url: `${_base}/1semestre/LAD-1006ContabilidadGeneral_OK_2016.pdf` },
    ],
  },
  {
    numero: 2,
    materias: [
      { nombre: 'Función Administrativa I', url: `${_base}/2semestre/LAF-1019FuncionAdministrativa%20I_OK_2016.pdf` },
      {
        nombre: 'Estadística para la Administración I',
        url: `${_base}/2semestre/LAD-1016EstadisticaparalaAdministraci%C3%B3n%20I_OK_2016.pdf`,
      },
      { nombre: 'Derecho Laboral y Seguridad Social', url: `${_base}/2semestre/LAF-1010DerechoLaboralSeguridadSocial_OK_2016.pdf` },
      { nombre: 'Comunicación Corporativa', url: `${_base}/2semestre/LAC-1004ComunicacionCorporativa_OK_2016.pdf` },
      { nombre: 'Taller de Desarrollo Humano', url: `${_base}/2semestre/LAC-1034TallerdeDesarrolloHumano_OK_2016.pdf` },
      { nombre: 'Costos de Manufactura', url: 'https://villahermosa.tecnm.mx/site/oferta.jsp?view=Licenciaturaadministracion' },
    ],
  },
  {
    numero: 3,
    materias: [
      { nombre: 'Función Administrativa II', url: `${_base}/3semestre/LAD-1020FuncionAdministrativaII_OK_2016.pdf` },
      { nombre: 'Estadística para la Administración II', url: `${_base}/3semestre/LAD-1017EstadisticaparalaadministracionII_OK_2016.pdf` },
      { nombre: 'Derecho Empresarial', url: `${_base}/3semestre/LAD-1009DerechoEmpresarial_OK_2016.pdf` },
      { nombre: 'Comportamiento Organizacional', url: `${_base}/3semestre/LAD-1003ComportamientoOrganizacional_OK_2016.pdf` },
      { nombre: 'Dinámica Social', url: `${_base}/3semestre/LAC-1013DinamicaSocial_OK_2016.pdf` },
      { nombre: 'Contabilidad Gerencial', url: `${_base}/3semestre/LAD-1007ContabilidadGerencial_OK_2016.pdf` },
    ],
  },
  {
    numero: 4,
    materias: [
      { nombre: 'Gestión Estratégica del Capital Humano I', url: `${_base}/4semestre/LAD-1023GestionEstrategicadelCapitalHumanoI_OK_2016.pdf` },
      { nombre: 'Procesos Estructurales', url: `${_base}/4semestre/LAD-1031ProcesosEstructurales_OK_2016.pdf` },
      {
        nombre: 'Métodos Cuantitativos para la Administración',
        url: `${_base}/4semestre/LAD-1028MetodosCuantitativosparalaAdministracion_OK_2016.pdf`,
      },
      { nombre: 'Fundamentos de Mercadotecnia', url: `${_base}/4semestre/LAF-1021FundamentosdeMercadotecnia_OK_2016.pdf` },
      { nombre: 'Economía Empresarial', url: `${_base}/4semestre/LAD-1014EconomiaEmpresarial_OK_2016.pdf` },
      { nombre: 'Matemáticas Financieras', url: `${_base}/4semestre/MatematicasFinancieras-AEC-1079.pdf` },
    ],
  },
  {
    numero: 5,
    materias: [
      { nombre: 'Gestión Estratégica del Capital Humano II', url: `${_base}/5semestre/LAD-1024GestionEstrategicaCapitalHumanoII_OK_2016.pdf` },
      { nombre: 'Derecho Fiscal', url: `${_base}/5semestre/DerechoFiscal-AEC-1070.pdf` },
      { nombre: 'Mezcla de Mercadotecnia', url: `${_base}/5semestre/MezcladeMercadotecnia-AEC-1080.pdf` },
      { nombre: 'Macroeconomía', url: `${_base}/5semestre/Macroeconomia-AEC-1077.pdf` },
      { nombre: 'Administración Financiera I', url: `${_base}/5semestre/AdministracionFinancieraI-AED-1068.pdf` },
      { nombre: 'Desarrollo Sustentable', url: `${_base}/5semestre/DesarrolloSustentable-ACD-0908.pdf` },
    ],
  },
  {
    numero: 6,
    materias: [
      { nombre: 'Gestión de la Retribución', url: `${_base}/6semestre/LAM-1022GestiondelaRetribucion_OK_2016.pdf` },
      { nombre: 'Producción', url: `${_base}/6semestre/LAF-1032Produccion_OK_2016.pdf` },
      { nombre: 'Taller de Investigación I', url: `${_base}/6semestre/TallerdeInvestigacionI-ACA-0909.pdf` },
      {
        nombre: 'Sistemas de Información de Mercadotecnia',
        url: `${_base}/6semestre/LAD-1033SistemasdeInformaciondeMercadotecnia_OK_2016.pdf`,
      },
      { nombre: 'Innovación y Emprendedurismo', url: `${_base}/6semestre/LAA-1026InnovacionyEmprendedurismo_OK_2016.pdf` },
      { nombre: 'Administración Financiera II', url: `${_base}/6semestre/LAD-1002AdministracionFinancieraII_OK_2016.pdf` },
    ],
  },
  {
    numero: 7,
    materias: [
      { nombre: 'Plan de Negocios', url: `${_base}/7semestre/LAB-1029PlandeNegocios_OK_2016.pdf` },
      { nombre: 'Procesos de Dirección', url: `${_base}/7semestre/LAC-1030ProcesosdeDireccion_OK_2016.pdf` },
      { nombre: 'Taller de Investigación II', url: `${_base}/7semestre/TallerdeInvestigacionII-ACA-0910.pdf` },
      { nombre: 'Administración de la Calidad', url: `${_base}/7semestre/LAD-1001AdministraciondelaCalidad_OK_2016.pdf` },
      { nombre: 'Economía Internacional', url: `${_base}/7semestre/LAC-1015EconomiaInternacional_OK_2016.pdf` },
      { nombre: 'Diagnóstico y Evaluación Empresarial', url: `${_base}/7semestre/LAD-1012DiagnosticoyEvaluacionEmpresarial_OK_2016.pdf` },
    ],
  },
  {
    numero: 8,
    materias: [
      { nombre: 'Consultoría Empresarial', url: `${_base}/8semestre/LAC-1005ConsultoriaEmpresarial_OK_2016.pdf` },
      { nombre: 'Formulación y Evaluación de Proyectos', url: `${_base}/8semestre/LAD-1018FormulacionyEvaluaciondeProyectos_OK_2016.pdf` },
      { nombre: 'Desarrollo Organizacional', url: `${_base}/8semestre/LAD-1011DesarrolloOrganizacional_OK_2016.pdf` },
    ],
  },
  // 9no semestre: solo Residencia Profesional, sin PDF. etiqueta
  // 'actividad' en singular, igual que el Dart original.
  {
    numero: 9,
    soloInformativo: true,
    etiqueta: 'actividad',
    materias: [{ nombre: 'Residencia Profesional', url: '' }],
  },
];

// Cada especialidad muestra "N materias · CLAVE" como subtítulo,
// combinando conteo y clave en un solo string.
const _especialidades = [
  {
    nombre: 'Proyectos Empresariales Sustentables',
    icono: '🌿',
    color: VERDE,
    subtitulo: '5 materias  ·  INTE-PES-2017-03',
    materias: [
      { nombre: 'Normas de Calidad y su Aplicación', url: `${_esp}/INTE-PES-2017-03/NormasdeCalidadysuAplicacion-PEF-1701.pdf` },
      {
        nombre: 'Estrategias Corporativas y Sustentabilidad',
        url: `${_esp}/INTE-PES-2017-03/EstrategiasCorporativasySustentabilidad-PEF-1703.pdf`,
      },
      { nombre: 'Comercio Exterior', url: `${_esp}/INTE-PES-2017-03/ComercioExterior-PEF-1704.pdf` },
      { nombre: 'Marketing Ecológico', url: `${_esp}/INTE-PES-2017-03/MarketingEcologico-PED-1705.pdf` },
      { nombre: 'Modelo de Negocios Sustentables', url: `${_esp}/INTE-PES-2017-03/ModelosdeNegociosSustentables-PED-1706.pdf` },
    ],
  },
  {
    nombre: 'Administración y Finanzas',
    icono: '💰',
    color: VERDE_OSCURO,
    subtitulo: '6 materias  ·  INTE-AFI-2018-01',
    materias: [
      { nombre: 'Mercados Financieros I', url: `${_esp}/INTE-AFI-2018-01/MercadosFinancierosI-AFD-1801.pdf` },
      { nombre: 'Modelo de Negocios Sustentables', url: `${_esp}/INTE-AFI-2018-01/ModelodeNegociosSustentables-AFD-1802.pdf` },
      {
        nombre: 'Estrategias Corporativas y Sustentabilidad',
        url: `${_esp}/INTE-AFI-2018-01/EstrategiasCorporativasySustentabilidad-AFF-1803.pdf`,
      },
      { nombre: 'Comercio Exterior', url: `${_esp}/INTE-AFI-2018-01/ComercioExterior-AFF-1804.pdf` },
      { nombre: 'Auditoría Interna', url: `${_esp}/INTE-AFI-2018-01/AuditoriaInterna-AFD-1805.pdf` },
      { nombre: 'Mercados Financieros II', url: `${_esp}/INTE-AFI-2018-01/MercadosFinancieros%20II-AFD-1806.pdf` },
    ],
  },
  {
    nombre: 'Capital Humano y Transformación Digital',
    icono: '👥',
    color: VERDE_MUY_OSCURO,
    subtitulo: '6 materias  ·  LADE-CHT-2023-02',
    materias: [
      {
        nombre: 'Productividad y Competitividad del Talento Humano',
        url: `${_esp}/INTE-CHT-2017-03/ProductividadyCompetitividaddelTalentoHumano-CHC-1701.pdf`,
      },
      {
        nombre: 'Nuevas Herramientas como Apoyo a la Gestión del Talento',
        url: `${_esp}/INTE-CHT-2017-03/NuevasHerramientascomoApoyoalaGestiondelTalentoHumano-CHH-1702.pdf`,
      },
      { nombre: 'Capital Humano en la Era Digital', url: `${_esp}/INTE-CHT-2017-03/CapitalHumanoenlaEraDigital-CHC-1703.pdf` },
      {
        nombre: 'Taller de Valoración de Empresas por Simulación',
        url: `${_esp}/INTE-CHT-2017-03/TallerdeValoraciondeEmpresasporsimulacion-CHC-1704.pdf`,
      },
      {
        nombre: 'Seminario de Gestión del Talento Humano',
        url: `${_esp}/INTE-CHT-2017-03/SeminariodeGestiondelTalentoHumano-CHB-1705.pdf`,
      },
      { nombre: 'Nómina Electrónica', url: `${_esp}/INTE-CHT-2017-03/NominaelectronicaCHC1706.pdf` },
    ],
  },
];