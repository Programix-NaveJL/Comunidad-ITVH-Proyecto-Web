// ═════════════════════════════════════════════════════════════════
// igee.js
//
// Pantalla informativa de la Ingeniería en Gestión Empresarial.
// Réplica funcional de IGEE.dart.
//
// Color de acento: cs.secondary de Flutter → var(--color-secondary),
// dominante en toda la pantalla (semestres, título, retícula) — a
// diferencia de la mayoría de carreras que usan primary como acento
// principal. Perfil de Egreso usa cs.primary, Campo Laboral usa
// cs.tertiary.
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

const COLOR = 'var(--color-secondary)';
const COLOR_EGRESO = 'var(--color-primary)';
const COLOR_CAMPO = 'var(--color-tertiary)';

/** Pinta la pantalla de IGEE completa dentro de `contenedor`. */
export function renderIGEE(contenedor) {
  contenedor.innerHTML = `
    <div class="carrera">
      ${renderHeroCarrera({
        color: COLOR,
        icono: '💼',
        departamento: 'Departamento Económico Administrativo',
        titulo: 'Ing. en Gestión Empresarial',
      })}

      <div class="carrera-cuerpo">

        ${renderSectionTitle('Objetivo General', COLOR)}
        ${renderObjetivoGeneral(
          'Formar profesionales que contribuyan a la gestión de empresas e innovación de procesos; así como al diseño, implementación y desarrollo de sistemas estratégicos de negocios, optimizando recursos en un entorno global, con ética y responsabilidad social.',
          COLOR
        )}

        ${renderSectionTitle('Objetivos Específicos', COLOR)}
        <div class="carrera-objetivos">
          ${_objetivos.map((o) => renderObjetivoItem(o.numero, o.titulo, o.descripcion, COLOR)).join('')}
        </div>

        ${renderSectionTitle('Perfil de Ingreso', COLOR)}
        ${renderPerfilSection(_perfilIngreso, COLOR)}

        ${renderSectionTitle('Perfil de Egreso', COLOR)}
        ${renderPerfilSection(_perfilEgreso, COLOR_EGRESO)}

        ${renderSectionTitle('Campo Laboral', COLOR)}
        ${renderPerfilSection(_campoLaboral, COLOR_CAMPO)}

        ${renderSectionTitle('Retículas 2009', COLOR)}
        <div class="carrera-reticulas">
          ${_reticulas.map((r) => renderReticulaItem(r, COLOR)).join('')}
        </div>

        ${renderSectionTitle('Plan de Estudios', COLOR)}
        <div class="carrera-semestres">
          ${_semestres.map((s) => renderSemestreExpansion(s, COLOR)).join('')}
        </div>

        ${renderSectionTitle('Especialidades', COLOR)}
        <div class="carrera-especialidades">
          ${_especialidades.map((e) => renderEspecialidadExpansion(e, e.color)).join('')}
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
    descripcion: 'Aplica métodos, técnicas y herramientas para la solución de problemas en la gestión empresarial con una visión estratégica.',
  },
  {
    numero: 2,
    titulo: 'Saber Diseñar',
    descripcion:
      'Aplica habilidades directivas y de ingeniería en el diseño, gestión, fortalecimiento e innovación de las organizaciones para la toma de decisiones en forma efectiva, con una orientación sistémica y sustentable.',
  },
  {
    numero: 3,
    titulo: 'Hacer Experimentos',
    descripcion:
      'Aplica métodos de investigación para desarrollar e innovar modelos, sistemas, procesos y productos en las diferentes dimensiones de la organización.',
  },
  {
    numero: 4,
    titulo: 'Saber Comunicarse',
    descripcion:
      'Utiliza las nuevas tecnologías de información y comunicación en la organización, para optimizar los procesos y la eficaz toma de decisiones.',
  },
  {
    numero: 5,
    titulo: 'Ser Ético',
    descripcion:
      'Promueve el desarrollo del capital humano, para la realización de los objetivos organizacionales, dentro de un marco ético y un contexto multicultural.',
  },
  {
    numero: 6,
    titulo: 'Actualizarse',
    descripcion: 'Actualiza sus conocimientos permanentemente para responder a los cambios globales.',
  },
  {
    numero: 7,
    titulo: 'Trabajar en Equipo',
    descripcion: 'Dirige equipos de trabajo para la mejora continua y el crecimiento integral de las organizaciones.',
  },
];

const _perfilIngreso = ['Capacidad de razonamiento.', 'Sentido de la organización y el método.', 'Planificador.'];

const _perfilEgreso = [
  'Aplica habilidades directivas y de ingeniería en el diseño, gestión, fortalecimiento e innovación de las organizaciones para la toma de decisiones en forma efectiva, con una orientación sistémica y sustentable.',
  'Diseña e innova estructuras administrativas y procesos, con base en las necesidades de las organizaciones para competir eficientemente en mercados globales.',
  'Gestiona eficientemente los recursos de la organización con visión compartida, con el fin de suministrar bienes y servicios de calidad.',
  'Aplica métodos cuantitativos y cualitativos en el análisis e interpretación de datos y modelado de sistemas en los procesos organizacionales, para la mejora continua atendiendo estándares de calidad mundial.',
  'Diseña, y emprende nuevos negocios y proyectos empresariales sustentables en mercados competitivos, para promover el desarrollo.',
  'Diseña e implementa estrategias de mercadotecnia basadas en información recopilada de fuentes primarias y secundarias, para incrementar la competitividad de las organizaciones.',
  'Implementa planes y programas de seguridad e higiene para el fortalecimiento del entorno laboral.',
  'Gestiona sistemas integrales de calidad para la mejora de los procesos, ejerciendo un liderazgo estratégico y un compromiso ético.',
  'Aplica las normas legales para la creación y desarrollo de las organizaciones.',
  'Dirige equipos de trabajo para la mejora continua y el crecimiento integral de las organizaciones.',
  'Interpreta la información financiera para detectar oportunidades de mejora e inversión en un mundo global, que propicien la rentabilidad del negocio.',
  'Utiliza las nuevas tecnologías de información y comunicación en la organización, para optimizar los procesos y la eficaz toma de decisiones.',
  'Promueve el desarrollo del capital humano, para la realización de los objetivos organizacionales, dentro de un marco ético y un contexto multicultural.',
  'Aplica métodos de investigación para desarrollar e innovar modelos, sistemas, procesos y productos en las diferentes dimensiones de la organización.',
  'Gestiona la cadena de suministro de las organizaciones con un enfoque orientado a procesos para incrementar la productividad.',
  'Analiza las variables económicas para facilitar la toma estratégica de decisiones en la organización.',
  'Actúa como agente de cambio para facilitar la mejora continua y el desempeño de las organizaciones.',
  'Aplica métodos, técnicas y herramientas para la solución de problemas en la gestión empresarial con una visión estratégica.',
];

const _campoLaboral = ['Avar Corporation.', 'Pemex.', 'Secretaría de Gobierno.'];

const _reticulas = [
  {
    clave: 'IGEE-PES-2017-01',
    nombre: 'Proyectos Empresariales Sustentables',
    url: 'https://pub-f883231412d746839d3a41f6bc354031.r2.dev/IGEE/IGEE_CON_PROYECTOS_EMPRESARIALES_RETICULA.pdf',
  },
  {
    clave: 'INTE-AFI-2018-01',
    nombre: 'Administración y Finanzas',
    url: 'https://pub-f883231412d746839d3a41f6bc354031.r2.dev/IGEE/IGEE_CON_%20ADMON_Y_FINANZAS_RETICULA.pdf',
  },
  {
    clave: 'IGEE-CHT-2017-01',
    nombre: "Capital Humano y Tic's",
    url: 'http://cc.villahermosa.tecnm.mx/sys/estpro/reticulas/IGEM-2009-201--IGEE-CHT-2023-02.pdf',
  },
];

// URL base de los temarios para no repetirla en cada materia.
const _base = 'https://villahermosa.tecnm.mx/docs/oferta/inggestion/temario2009';
const _baseEsp = 'https://villahermosa.tecnm.mx/docs/oferta/inggestion/temario2009/Especialidad';

const _semestres = [
  {
    numero: 1,
    materias: [
      { nombre: 'Fundamentos de Investigación', url: `${_base}/1semestre/FundamentosdeInvestigacion-ACC-0906.pdf` },
      { nombre: 'Cálculo Diferencial', url: `${_base}/1semestre/CalculoDiferencial-ACF-0901.pdf` },
      { nombre: 'Desarrollo Humano', url: `${_base}/1semestre/DesarrolloHumano.pdf` },
      { nombre: 'Fundamentos de Gestión Empresarial', url: `${_base}/1semestre/FundamentosdeGestionEmpresarial-AEF-1074.pdf` },
      { nombre: 'Fundamentos de Física', url: `${_base}/1semestre/FundamentosdeFisica.pdf` },
      { nombre: 'Fundamentos de Química', url: `${_base}/1semestre/FundamentosdeQuimica.pdf` },
    ],
  },
  {
    numero: 2,
    materias: [
      { nombre: 'Software de Aplicación Ejecutivo', url: `${_base}/2semestre/SoftwaredeAplicacionEjecutivo-AEB-1082.pdf` },
      { nombre: 'Cálculo Integral', url: `${_base}/2semestre/CalculoIntegral-ACF-0902.pdf` },
      { nombre: 'Contabilidad Orientada a los Negocios', url: `${_base}/2semestre/ContabilidadorientadaalosNegocios.pdf` },
      { nombre: 'Dinámica Social', url: `${_base}/2semestre/DinamicaSocial-AEC-1014.pdf` },
      { nombre: 'Taller de Ética', url: `${_base}/2semestre/TallerdeEtica-ACA-0907.pdf` },
      { nombre: 'Legislación Laboral', url: `${_base}/2semestre/LegislacionLaboral.pdf` },
    ],
  },
  {
    numero: 3,
    materias: [
      { nombre: 'Marco Legal de las Organizaciones', url: `${_base}/3semestre/MarcoLegaldelasOrganizaciones-AE078.pdf` },
      { nombre: 'Probabilidad y Estadística Descriptiva', url: `${_base}/3semestre/ProbabilidadyEstadisticaDescriptiva.pdf` },
      { nombre: 'Costos Empresariales', url: `${_base}/3semestre/CostosEmpresariales.pdf` },
      { nombre: 'Habilidades Directivas I', url: `${_base}/3semestre/HabilidadesDirectivas-I.pdf` },
      { nombre: 'Economía Empresarial', url: `${_base}/3semestre/EconomiaEmpresarial-AEF-1071.pdf` },
      { nombre: 'Álgebra Lineal', url: `${_base}/3semestre/AlgebraLineal-ACF%E2%80%930903.pdf` },
    ],
  },
  {
    numero: 4,
    materias: [
      { nombre: 'Ingeniería Económica', url: `${_base}/4semestre/IngenieriaEconomica.pdf` },
      { nombre: 'Estadística Inferencial I', url: `${_base}/4semestre/EstadisticaInferencial-I.pdf` },
      {
        nombre: 'Instrumentos de Presupuestación Empresarial',
        url: `${_base}/4semestre/InstrumentosdePresupuestacionEmpresarial.pdf`,
      },
      { nombre: 'Habilidades Directivas II', url: `${_base}/4semestre/HabilidadesDirectivas-II.pdf` },
      { nombre: 'Entorno Macroeconómico', url: `${_base}/4semestre/EntornoMacroeconomico.pdf` },
      { nombre: 'Investigación de Operaciones', url: `${_base}/4semestre/InvestigaciondeOperaciones-AEF-1076.pdf` },
    ],
  },
  {
    numero: 5,
    materias: [
      { nombre: 'Finanzas en las Organizaciones', url: `${_base}/5semestre/FinanzasdelasOrganizaciones-AEF-1073.pdf` },
      { nombre: 'Estadística Inferencial II', url: `${_base}/5semestre/EstadisticaInferencial-II.pdf` },
      { nombre: 'Ingeniería de Procesos', url: `${_base}/5semestre/IngenieriadeProcesos.pdf` },
      { nombre: 'Gestión del Capital Humano', url: `${_base}/5semestre/GestiondelCapitalHumano-AEG-1075.pdf` },
      { nombre: 'Taller de Investigación I', url: `${_base}/5semestre/TallerdeInvestigacion-I-ACA-0909.pdf` },
      { nombre: 'Mercadotecnia', url: `${_base}/5semestre/Mercadotecnia.pdf` },
    ],
  },
  {
    numero: 6,
    materias: [
      {
        nombre: 'Administración de la Salud y Seguridad Ocupacional',
        url: `${_base}/6semestre/AdministraciondelaSaludySeguridadOcupacional.pdf`,
      },
      { nombre: 'El Emprendedor y la Innovación', url: `${_base}/6semestre/ElemprendedorylaInnovacion-AED-1072.pdf` },
      { nombre: 'Gestión de la Producción I', url: `${_base}/6semestre/GestiondelaProduccion-I.pdf` },
      { nombre: 'Diseño Organizacional', url: `${_base}/6semestre/DisenoOrganizacional-AED-1015.pdf` },
      { nombre: 'Taller de Investigación II', url: `${_base}/6semestre/TallerdeInvestigacion-II-ACA-0910.pdf` },
      {
        nombre: 'Sistemas de Información de Mercadotecnia',
        url: `${_base}/6semestre/SistemasdeInformaciondeMercadotecnia.pdf`,
      },
    ],
  },
  {
    numero: 7,
    materias: [
      {
        nombre: 'Calidad Aplicada a la Gestión Empresarial',
        url: `${_base}/7semestre/CalidadAplicadaalaGestionEmpresarial-AED-1069.pdf`,
      },
      { nombre: 'Plan de Negocios', url: `${_base}/7semestre/PlandeNegocios.pdf` },
      { nombre: 'Gestión de la Producción II', url: `${_base}/7semestre/GestiondelaProduccion-II.pdf` },
      { nombre: 'Gestión Estratégica', url: `${_base}/7semestre/GestionEstrategica-AED-1035.pdf` },
      { nombre: 'Desarrollo Sustentable', url: `${_base}/7semestre/DesarrolloSustentable-ACD-0908.pdf` },
      { nombre: 'Mercadotecnia Electrónica', url: `${_base}/7semestre/MercadotecniaElectronica-AEB-1045.pdf` },
    ],
  },
  {
    numero: 8,
    materias: [{ nombre: 'Cadena de Suministros', url: `${_base}/8semestre/CadenadeSumunistros.pdf` }],
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

// Tres especialidades, cada una con su propio color de acento
// (primary, secondary, tertiary) — igual que en el Dart original.
const _especialidades = [
  {
    nombre: 'Proyectos Empresariales Sustentables',
    icono: '🌿',
    color: 'var(--color-primary)',
    materias: [
      {
        nombre: 'Normas de Calidad y su Aplicación',
        url: `${_baseEsp}/INTE-PES-2017-03/NormasdeCalidadysuAplicacion-PEF-1701.pdf`,
      },
      {
        nombre: 'Estrategias Corporativas y Sustentabilidad',
        url: `${_baseEsp}/INTE-PES-2017-03/EstrategiasCorporativasySustentabilidad-PEF-1703.pdf`,
      },
      { nombre: 'Comercio Exterior', url: `${_baseEsp}/INTE-PES-2017-03/ComercioExterior-PEF-1704.pdf` },
      { nombre: 'Marketing Ecológico', url: `${_baseEsp}/INTE-PES-2017-03/MarketingEcologico-PED-1705.pdf` },
      {
        nombre: 'Modelo de Negocios Sustentables',
        url: `${_baseEsp}/INTE-PES-2017-03/ModelosdeNegociosSustentables-PED-1706.pdf`,
      },
    ],
  },
  {
    nombre: 'Administración y Finanzas',
    icono: '🏛️',
    color: 'var(--color-secondary)',
    materias: [
      { nombre: 'Mercados Financieros I', url: `${_baseEsp}/INTE-AFI-2018-01/MercadosFinancierosI-AFD-1801.pdf` },
      {
        nombre: 'Modelo de Negocios Sustentables',
        url: `${_baseEsp}/INTE-AFI-2018-01/ModelodeNegociosSustentables-AFD-1802.pdf`,
      },
      {
        nombre: 'Estrategias Corporativas y Sustentabilidad',
        url: `${_baseEsp}/INTE-AFI-2018-01/EstrategiasCorporativasySustentabilidad-AFF-1803.pdf`,
      },
      { nombre: 'Comercio Exterior', url: `${_baseEsp}/INTE-AFI-2018-01/ComercioExterior-AFF-1804.pdf` },
      { nombre: 'Auditoría Interna', url: `${_baseEsp}/INTE-AFI-2018-01/AuditoriaInterna-AFD-1805.pdf` },
      { nombre: 'Mercados Financieros II', url: `${_baseEsp}/INTE-AFI-2018-01/MercadosFinancieros%20II-AFD-1806.pdf` },
    ],
  },
  {
    nombre: "Capital Humano y Tic's",
    icono: '👥',
    color: 'var(--color-tertiary)',
    materias: [
      {
        nombre: 'Productividad y Competitividad del Talento Humano',
        url: `${_baseEsp}/INTE-CHT-2017-03/ProductividadyCompetitividaddelTalentoHumano-CHC-1701.pdf`,
      },
      {
        nombre: 'Nuevas Herramientas como Apoyo a la Gestión del Talento Humano',
        url: `${_baseEsp}/INTE-CHT-2017-03/NuevasHerramientascomoApoyoalaGestiondelTalentoHumano-CHH-1702.pdf`,
      },
      {
        nombre: 'Capital Humano en la Era Digital: Oportunidades y Desafíos',
        url: `${_baseEsp}/INTE-CHT-2017-03/CapitalHumanoenlaEraDigital-CHC-1703.pdf`,
      },
      {
        nombre: 'Taller de Valoración de Empresas por Simulación',
        url: `${_baseEsp}/INTE-CHT-2017-03/TallerdeValoraciondeEmpresasporsimulacion-CHC-1704.pdf`,
      },
      {
        nombre: 'Seminario de Gestión del Talento Humano',
        url: `${_baseEsp}/INTE-CHT-2017-03/SeminariodeGestiondelTalentoHumano-CHB-1705.pdf`,
      },
      { nombre: 'Nómina Electrónica', url: `${_baseEsp}/INTE-CHT-2017-03/NominaelectronicaCHC1706.pdf` },
    ],
  },
];