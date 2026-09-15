// ═════════════════════════════════════════════════════════════════
// isc.js
//
// Pantalla informativa de la Ingeniería en Sistemas Computacionales.
// Réplica funcional de ISC.dart, construida sobre los helpers
// compartidos de comun.js (reutilizados por el resto de carreras
// del Departamento de Sistemas y Computación).
//
// A diferencia de plantel.js, esta pantalla no se autorregistra en
// el router: todas las carreras viven bajo la ruta '/carreras' y es
// carreras.js quien registra esa ruta una sola vez y despacha entre
// ellas según la clave recibida como sub-segmento del hash
// (#/carreras/isc).
//
// Color de acento: cs.primary de Flutter → var(--color-primary), el
// único de los tres colores usados en esta pantalla (junto con
// cs.secondary y cs.tertiary del Perfil de Ingreso/Egreso y Visión)
// que reacciona al tema oscuro/claro.
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

const COLOR = 'var(--color-primary)';
const COLOR_VISION = 'var(--color-tertiary)'; // acento de la card "Visión", igual que cs.tertiary en el Dart

/** Pinta la pantalla de ISC completa dentro de `contenedor`. */
export function renderISC(contenedor) {
  contenedor.innerHTML = `
    <div class="carrera">
      ${renderHeroCarrera({
        color: COLOR,
        icono: '💻',
        departamento: 'Departamento de Sistemas y Computación',
        titulo: 'Ing. en Sistemas Computacionales',
      })}

      <div class="carrera-cuerpo">

        <div class="carrera-cards">
          ${renderInfoCard({
            icono: '🚩',
            titulo: 'Misión',
            contenido:
              'Formar Ingenieros en Sistemas Computacionales que desarrollen e impulsen soluciones innovadoras para los desafíos tecnológicos de la región.',
            color: COLOR,
          })}
          ${renderInfoCard({
            icono: '👁️',
            titulo: 'Visión',
            contenido:
              'Ser una carrera reconocida en Tabasco y en un entorno global, por su excelencia profesional y aportación al desarrollo tecnológico computacional.',
            color: COLOR_VISION,
          })}
        </div>

        ${renderSectionTitle('Objetivo General', COLOR)}
        ${renderObjetivoGeneral(
          'Formar profesionistas líderes con visión estratégica y amplio sentido ético; capaces de diseñar, desarrollar, implementar y administrar tecnología computacional para aportar soluciones innovadoras en beneficio de la sociedad; en un contexto global, multidisciplinario y sostenible.',
          COLOR
        )}

        ${renderSectionTitle('Objetivos Específicos', COLOR)}
        <div class="carrera-objetivos">
          ${_objetivos.map((o) => renderObjetivoItem(o.numero, o.titulo, o.descripcion, COLOR)).join('')}
        </div>

        ${renderSectionTitle('Perfil de Ingreso', COLOR)}
        ${renderPerfilSection(_perfilIngreso, 'var(--color-secondary)')}

        ${renderSectionTitle('Perfil de Egreso', COLOR)}
        ${renderPerfilSection(_perfilEgreso, COLOR_VISION)}

        ${renderSectionTitle('Retículas 2010-224', COLOR)}
        <div class="carrera-reticulas">
          ${_reticulas.map((r) => renderReticulaItem(r, COLOR)).join('')}
        </div>

        ${renderSectionTitle('Plan de Estudios', COLOR)}
        <div class="carrera-semestres">
          ${_semestres.map((s) => renderSemestreExpansion(s, COLOR)).join('')}
        </div>

        ${renderSectionTitle('Especialidades', COLOR)}
        <div class="carrera-especialidades">
          ${_especialidades.map((e) => renderEspecialidadExpansion(e, COLOR)).join('')}
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
    descripcion:
      'Desarrollar e implementar aplicaciones computacionales para solucionar problemas de diversos contextos, integrando diferentes tecnologías, plataformas o dispositivos.',
  },
  {
    numero: 2,
    titulo: 'Saber Diseñar',
    descripcion:
      'Analizar, diseñar y aplicar modelos computacionales para solucionar problemas, mediante la selección y uso de herramientas tecnológicas.',
  },
  {
    numero: 3,
    titulo: 'Hacer Experimentos',
    descripcion:
      'Desarrollar y administrar recursos tecnológicos para incrementar la productividad y competitividad de las organizaciones cumpliendo con normas nacionales e internacionales.',
  },
  {
    numero: 4,
    titulo: 'Saber Comunicarse',
    descripcion: 'Construir proyectos innovadores aplicando las TIC con una visión emprendedora e intercultural.',
  },
  {
    numero: 5,
    titulo: 'Ser Ético',
    descripcion:
      'Desarrollar conciencia sobre el significado y sentido de la ética para orientar un comportamiento armónico en el contexto comunitario y profesional.',
  },
  {
    numero: 6,
    titulo: 'Actualizarse',
    descripcion: 'Actualizar conocimientos profesionales para responder a las demandas de los cambios globales.',
  },
  {
    numero: 7,
    titulo: 'Trabajar en Equipo',
    descripcion:
      'Participar en equipos multidisciplinarios para el desarrollo de soluciones innovadoras y sostenibles en diferentes contextos.',
  },
];

const _perfilIngreso = [
  'Capacidad para la investigación, análisis y síntesis de información.',
  'Interés en las ciencias básicas y tecnologías de cómputo.',
  'Gusto por las tecnologías de información y comunicación.',
  'Disposición para la interacción y el trabajo en equipo.',
  'Habilidad para la toma de decisiones.',
  'Conocimientos de inglés.',
];

const _perfilEgreso = [
  'Implementa aplicaciones computacionales integrando diferentes tecnologías, plataformas o dispositivos.',
  'Diseña, desarrolla y aplica modelos computacionales mediante herramientas matemáticas.',
  'Diseña e implementa interfaces para automatización de sistemas de hardware y software.',
  'Coordina equipos multidisciplinarios para aplicar soluciones innovadoras.',
  'Diseña, implementa y administra bases de datos conforme a normas de seguridad.',
  'Desarrolla y administra software cumpliendo estándares de calidad.',
  'Evalúa tecnologías de hardware para soportar aplicaciones de manera efectiva.',
  'Detecta áreas de oportunidad con visión empresarial aplicando TIC.',
  'Diseña, configura y administra redes de computadoras aplicando normas vigentes.',
];

const _reticulas = [
  {
    clave: 'ISIC-2010-224--ISIE-GDD-2023-01',
    nombre: 'Gestión de Datos',
    url: 'https://pub-f883231412d746839d3a41f6bc354031.r2.dev/ISIC/ISIC-2010-224--ISIE-GDD-2023-01.pdf',
  },
  {
    clave: 'ISIC-2010-224--ISIE-DAM-2023-02',
    nombre: 'Desarrollo de Aplicaciones Multiplataforma',
    url: 'https://pub-f883231412d746839d3a41f6bc354031.r2.dev/ISIC/ISIC-2010-224--ISIE-DAM-2023-02.pdf',
  },
  {
    clave: 'ISIC-2010-224--ISIE-ISR-2023-03',
    nombre: 'Infraestructura y Seguridad en Redes',
    url: 'https://pub-f883231412d746839d3a41f6bc354031.r2.dev/ISIC/ISIC-2010-224--ISIE-ISR-2023-03.pdf',
  },
];

// URL base de los temarios para no repetirla en cada materia.
const _base = 'https://villahermosa.tecnm.mx/docs/oferta/ingsistemas/temario2010';
const _esp = 'https://villahermosa.tecnm.mx/docs/oferta/ingsistemas/especialidades';

const _semestres = [
  {
    numero: 1,
    materias: [
      { nombre: 'Cálculo Diferencial', url: `${_base}/1semestre/CalculoDiferencial-AC001.pdf` },
      { nombre: 'Fundamentos de Programación', url: `${_base}/1semestre/FundamentosdeProgramacion-AED-1285.pdf` },
      { nombre: 'Taller de Ética', url: `${_base}/1semestre/TallerdeEtica-AC007.pdf` },
      { nombre: 'Matemáticas Discretas', url: `${_base}/1semestre/MatematicasDiscretas-AE041.pdf` },
      { nombre: 'Taller de Administración', url: `${_base}/1semestre/TallerdeAdministracion.pdf` },
      { nombre: 'Fundamentos de Investigación', url: `${_base}/1semestre/FundamentosdeInvestigacion-AC006.pdf` },
    ],
  },
  {
    numero: 2,
    materias: [
      { nombre: 'Cálculo Integral', url: `${_base}/2semestre/CalculoIntegral-AC002.pdf` },
      { nombre: 'Programación Orientada a Objetos', url: `${_base}/2semestre/ProgramacionOrientadaaObjetos-AED-1286.pdf` },
      { nombre: 'Contabilidad Financiera', url: `${_base}/2semestre/ContabilidadFinanciera-AE008.pdf` },
      { nombre: 'Química', url: `${_base}/2semestre/Quimica-AE058.pdf` },
      { nombre: 'Álgebra Lineal', url: `${_base}/2semestre/AlgebraLineal-AC003.pdf` },
      { nombre: 'Probabilidad y Estadística', url: `${_base}/2semestre/ProbabilidadyEstadistica-AE052.pdf` },
    ],
  },
  {
    numero: 3,
    materias: [
      { nombre: 'Cálculo Vectorial', url: `${_base}/3semestre/CalculoVectorial-AC004.pdf` },
      { nombre: 'Estructura de Datos', url: `${_base}/3semestre/EstructuradeDatos-AE026.pdf` },
      { nombre: 'Cultura Empresarial', url: `${_base}/3semestre/CulturaEmpresarial.pdf` },
      { nombre: 'Investigación de Operaciones', url: `${_base}/3semestre/Investigaciondeoperaciones.pdf` },
      { nombre: 'Desarrollo Sustentable', url: `${_base}/3semestre/DesarrolloSustentable-AC008.pdf` },
      { nombre: 'Física General', url: `${_base}/3semestre/FisicaGeneral.pdf` },
    ],
  },
  {
    numero: 4,
    materias: [
      { nombre: 'Ecuaciones Diferenciales', url: `${_base}/4semestre/EcuacionesDiferenciales-AC005.pdf` },
      { nombre: 'Métodos Numéricos', url: `${_base}/4semestre/Metodosnumericos.pdf` },
      { nombre: 'Tópicos Avanzados de Programación', url: `${_base}/4semestre/TopicosAvanzadosdeProgramacion.pdf` },
      { nombre: 'Fundamentos de Bases de Datos', url: `${_base}/4semestre/FundamentosdeBasedeDatos-AE031.pdf` },
      { nombre: 'Simulación', url: `${_base}/4semestre/Simulacion.pdf` },
      { nombre: 'Principios Eléctricos y Aplic. Digitales', url: `${_base}/4semestre/PrincipiosElectricosyAplicacionesDigitales.pdf` },
    ],
  },
  {
    numero: 5,
    materias: [
      { nombre: 'Graficación', url: `${_base}/5semestre/Graficacion.pdf` },
      { nombre: 'Fundamentos de Telecomunicaciones', url: `${_base}/5semestre/FundamentosdeTelecomunicaciones-AE034.pdf` },
      { nombre: 'Sistemas Operativos', url: `${_base}/5semestre/SistemasOperativosI-AE061.pdf` },
      { nombre: 'Taller de Bases de Datos', url: `${_base}/5semestre/Tallerdebasededatos.pdf` },
      { nombre: 'Fundamentos de Ing. de Software', url: `${_base}/5semestre/FundamentosdeIngenieriadeSoftware.pdf` },
      { nombre: 'Arquitectura de Computadoras', url: `${_base}/5semestre/ArquitecturadeComputadoras.pdf` },
    ],
  },
  {
    numero: 6,
    materias: [
      { nombre: 'Lenguajes y Autómatas I', url: `${_base}/6semestre/LenguajesyAutomatasI.pdf` },
      { nombre: 'Redes de Computadoras', url: `${_base}/6semestre/RedesdeComputadoras.pdf` },
      { nombre: 'Taller de Sistemas Operativos', url: `${_base}/6semestre/TallerdeSistemasOperativos.pdf` },
      { nombre: 'Administración de Bases de Datos', url: `${_base}/6semestre/AdministraciondeBasedeDatos.pdf` },
      { nombre: 'Ingeniería de Software', url: `${_base}/6semestre/IngenieriadeSoftware.pdf` },
      { nombre: 'Lenguajes de Interfaz', url: `${_base}/6semestre/LenguajesdeInterfaz.pdf` },
    ],
  },
  {
    numero: 7,
    materias: [
      { nombre: 'Lenguajes y Autómatas II', url: `${_base}/7semestre/LenguajesyAutomatasII.pdf` },
      { nombre: 'Conmutación y Enrutamiento de Redes', url: `${_base}/7semestre/ConmutacionyEnrutamientoenRedesdeDatos.pdf` },
      { nombre: 'Taller de Investigación I', url: `${_base}/7semestre/TallerdeInvestigacionI-AC009.pdf` },
      { nombre: 'Gestión de Proyectos de Software', url: `${_base}/7semestre/GestiondeProyectosdeSoftware.pdf` },
      { nombre: 'Sistemas Programables', url: `${_base}/7semestre/SistemasProgramables.pdf` },
    ],
  },
  {
    numero: 8,
    materias: [
      { nombre: 'Programación Lógica y Funcional', url: `${_base}/8semestre/ProgramacionLogicayFuncional.pdf` },
      { nombre: 'Administración de Redes', url: `${_base}/8semestre/Administracionderedes.pdf` },
      { nombre: 'Taller de Investigación II', url: `${_base}/8semestre/TallerdeInvestigacionII-AC010.pdf` },
      { nombre: 'Programación Web', url: `${_base}/8semestre/AE055ProgramacionWeb.pdf` },
    ],
  },
  // 9no semestre: Inteligencia Artificial tiene PDF; el resto son
  // actividades institucionales sin temario descargable.
  {
    numero: 9,
    materias: [
      { nombre: 'Inteligencia Artificial', url: `${_base}/9semestre/InteligenciaArtificial.pdf` },
      { nombre: 'Residencia Profesional', url: '' },
      { nombre: 'Servicio Social', url: '' },
      { nombre: 'Actividades Complementarias', url: '' },
    ],
  },
];

const _especialidades = [
  {
    nombre: 'Gestión de Redes y Mejoramiento de la Seguridad',
    icono: '📡',
    color: 'var(--color-primary)',
    materias: [
      {
        nombre: 'Infraestructura de Telecomunicaciones',
        url: `${_esp}/GESTION_DE_REDES_Y_MEJORAMIENTO_DE_LA_SEGURIDAD/Infraestructura_de_Telecomunicaciones.pdf`,
      },
      { nombre: 'Redes Convergentes', url: `${_esp}/GESTION_DE_REDES_Y_MEJORAMIENTO_DE_LA_SEGURIDAD/Redes_Convergentes.pdf` },
      { nombre: 'Redes Inalámbricas', url: `${_esp}/GESTION_DE_REDES_Y_MEJORAMIENTO_DE_LA_SEGURIDAD/Redes_Inalambricas.pdf` },
      { nombre: 'Seguridad en Redes', url: `${_esp}/GESTION_DE_REDES_Y_MEJORAMIENTO_DE_LA_SEGURIDAD/Seguridad_en_Redes.pdf` },
      { nombre: 'Tópicos Selectos de Seguridad', url: `${_esp}/GESTION_DE_REDES_Y_MEJORAMIENTO_DE_LA_SEGURIDAD/Topicos_Selectos.pdf` },
    ],
  },
  {
    nombre: 'Tecnologías de Base de Datos',
    icono: '🗄️',
    color: 'var(--color-secondary)',
    materias: [
      {
        nombre: 'Nuevos Paradigmas de Base de Datos',
        url: `${_esp}/TECNOLOGIAS_DE_BASE_DE_DATOS/Nuevos_Paradigmas_de_Base_de_Datos.pdf`,
      },
      { nombre: 'Base de Datos NoSQL', url: `${_esp}/TECNOLOGIAS_DE_BASE_DE_DATOS/Base_de_Datos_NoSQL.pdf` },
      { nombre: 'Tecnologías de Big Data', url: `${_esp}/TECNOLOGIAS_DE_BASE_DE_DATOS/Tecnologias_de_Big_Data.pdf` },
      { nombre: 'Tratamiento de Datos', url: `${_esp}/TECNOLOGIAS_DE_BASE_DE_DATOS/Tratamiento_de_Datos.pdf` },
      {
        nombre: 'Diseño y Construcción de Data Warehouse',
        url: `${_esp}/TECNOLOGIAS_DE_BASE_DE_DATOS/Diseno_y_Construccion_de_Data_WareHouse.pdf`,
      },
    ],
  },
  {
    nombre: 'Tecnologías y Aplicaciones Multiplataforma',
    icono: '📱',
    color: 'var(--color-tertiary)',
    materias: [
      {
        nombre: 'Tópicos de Desarrollo de Aplicaciones',
        url: `${_esp}/TECNOLOGIAS_Y_APLICACIONES_MULTIPLATAFORMA/Topicos_de_Desarrollo_de_Aplicaciones.pdf`,
      },
      {
        nombre: 'Desarrollo de Apps para Móviles',
        url: `${_esp}/TECNOLOGIAS_Y_APLICACIONES_MULTIPLATAFORMA/Desarrollo_de_Aplicaciones_para_Dispositivos_Moviles.pdf`,
      },
      {
        nombre: 'Arquitectura Orientada a Servicios',
        url: `${_esp}/TECNOLOGIAS_Y_APLICACIONES_MULTIPLATAFORMA/Arquitectura_Orientada_a_Servicios.pdf`,
      },
      {
        nombre: 'Nuevas Tecnologías para Aplicaciones',
        url: `${_esp}/TECNOLOGIAS_Y_APLICACIONES_MULTIPLATAFORMA/Nuevas_Tecnologias_para_Desarrollo_de_Aplicaciones.pdf`,
      },
      {
        nombre: 'Seguridad, Producción y Despliegue',
        url: `${_esp}/TECNOLOGIAS_Y_APLICACIONES_MULTIPLATAFORMA/Seguridad_Produccion_y_Despliegue_de_Aplicaciones.pdf`,
      },
      { nombre: 'Diseño de Interfaces', url: `${_esp}/TECNOLOGIAS_Y_APLICACIONES_MULTIPLATAFORMA/Diseno_de_Interfaces.pdf` },
      {
        nombre: 'Metodologías para Desarrollo Ágil',
        url: `${_esp}/TECNOLOGIAS_Y_APLICACIONES_MULTIPLATAFORMA/Metodologias_para_el_Desarrollo_Agil.pdf`,
      },
    ],
  },
];