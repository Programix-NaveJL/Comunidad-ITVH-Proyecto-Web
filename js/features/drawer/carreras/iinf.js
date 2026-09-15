// ═════════════════════════════════════════════════════════════════
// iinf.js
//
// Pantalla informativa de la Ingeniería Informática. Réplica
// funcional de IINF.dart.
//
// Color de acento: cs.tertiary de Flutter → var(--color-tertiary),
// usado en semestres, especialidades y Perfil de Ingreso. El Perfil
// de Egreso usa cs.primary y Campo Laboral usa cs.secondary, para
// diferenciar las tres secciones de bullets entre sí — igual que
// en el Dart original.
// ═════════════════════════════════════════════════════════════════

import {
  renderHeroCarrera,
  renderSectionTitle,
  renderInfoCard,
  renderObjetivoGeneral,
  renderPerfilSection,
  renderReticulaItem,
  renderSemestreExpansion,
  renderEspecialidadExpansion,
  inicializarCarrera,
} from './comun.js';

const COLOR = 'var(--color-tertiary)';
const COLOR_EGRESO = 'var(--color-primary)';
const COLOR_CAMPO = 'var(--color-secondary)';

/** Pinta la pantalla de IINF completa dentro de `contenedor`. */
export function renderIINF(contenedor) {
  contenedor.innerHTML = `
    <div class="carrera">
      ${renderHeroCarrera({
        color: COLOR,
        icono: '🖥️',
        departamento: 'Departamento de Sistemas y Computación',
        titulo: 'Ing. Informática',
      })}

      <div class="carrera-cuerpo">

        <div class="carrera-cards">
          ${renderInfoCard({
            icono: '🚩',
            titulo: 'Objetivo General',
            contenido:
              'Formar profesionales competentes en el diseño, desarrollo, implementación y administración de proyectos informáticos con una visión sistemática, tecnológica y estratégica.',
            color: COLOR,
          })}
          ${renderInfoCard({
            icono: '💼',
            titulo: 'Campo Laboral',
            contenido:
              'Empresas nacionales e internacionales en áreas de TI, sector público, instituciones educativas y consultoría independiente.',
            color: COLOR_EGRESO,
          })}
        </div>

        ${renderSectionTitle('Objetivo General', COLOR)}
        ${renderObjetivoGeneral(
          'Formar profesionales competentes en el diseño, desarrollo, implementación y administración de proyectos informáticos con una visión sistemática, tecnológica y estratégica; ofreciendo soluciones innovadoras e integrales a las organizaciones de acuerdo con las necesidades actuales; comprometidos con su entorno, desempeñándose con actitud ética, emprendedora y de liderazgo.',
          COLOR
        )}

        ${renderSectionTitle('Perfil de Ingreso', COLOR)}
        ${renderPerfilSection(_perfilIngreso, COLOR)}

        ${renderSectionTitle('Perfil de Egreso', COLOR)}
        ${renderPerfilSection(_perfilEgreso, COLOR_EGRESO)}

        ${renderSectionTitle('Campo Laboral', COLOR)}
        ${renderPerfilSection(_campoLaboral, COLOR_CAMPO)}

        ${renderSectionTitle('Retícula IINF-2010-220', COLOR)}
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

const _perfilIngreso = [
  'Gusto por la Informática, capacidad de lógica para plantear y resolver problemas en base al razonamiento, síntesis, abstracción y creatividad.',
  'Espíritu emprendedor.',
  'Capacidad de adaptación.',
  'Creatividad e innovación.',
  'Comprometido con su entorno.',
  'Capacidad de trabajo en equipo y de conquistar metas y objetivos.',
];

const _perfilEgreso = [
  'Aplica conocimientos científicos y tecnológicos en el área informática para la solución de problemas con un enfoque multidisciplinario.',
  'Formula, desarrolla y gestiona el desarrollo de proyectos de software para incrementar la competitividad en las organizaciones, considerando las normas de calidad vigentes.',
  'Aplica herramientas computacionales actuales y emergentes para optimizar los procesos en las organizaciones.',
  'Diseña e implementa Bases de Datos para el almacenamiento, recuperación, distribución, visualización y manejo de la información en las organizaciones.',
  'Crea y administra redes de computadoras, considerando el diseño, selección, instalación y mantenimiento para la operación eficiente de los recursos informáticos.',
  'Realiza consultorías relacionadas con la función informática para la mejora continua de la organización.',
  'Se desempeña profesionalmente con ética, respetando el marco legal, la pluralidad y la conservación del medio ambiente.',
  'Participa y dirige grupos de trabajo interdisciplinarios para el desarrollo de proyectos que requieran soluciones innovadoras basadas en tecnologías y sistemas de información.',
];

const _campoLaboral = [
  'Empresas de producción y servicios nacionales e internacionales en áreas de TI, administración de redes y sistemas, reingeniería de procesos y desarrollo de productos y servicios de TI.',
  'Sector Público e Instituciones Educativas.',
  'Empresario o empresaria independiente, integrando tecnologías de vanguardia para optimizar procesos y gestión en el diseño, ejecución y mantenimiento de sistemas de telecomunicación.',
];

const _reticulas = [
  {
    clave: 'IINF-2010-220',
    nombre: 'Gestión De Datos',
    url: 'http://cc.villahermosa.tecnm.mx/sys/estpro/reticulas/IINF-2010-220--IINE-GDD-2023-01.pdf',
  },
  {
    clave: 'IINF-2010-220',
    nombre: 'Desarrollo de Aplicaciones Multiplataforma',
    url: 'http://cc.villahermosa.tecnm.mx/sys/estpro/reticulas/IINF-2010-220--IINE-DAM-2023-02.pdf',
  },
  {
    clave: 'IINF-2010-220',
    nombre: 'Infraestructura y Seguridad en Redes',
    url: 'http://cc.villahermosa.tecnm.mx/sys/estpro/reticulas/IINF-2010-220--IINE-ISR-2023-03.pdf',
  },
];

// URL base de los temarios de IINF; las especialidades reutilizan
// la carpeta de ISC porque los planes de especialidad son compartidos.
const _base = 'https://villahermosa.tecnm.mx/docs/oferta/inginformatica/temario2010';
const _esp = 'https://villahermosa.tecnm.mx/docs/oferta/ingsistemas/especialidades';

const _semestres = [
  {
    numero: 1,
    materias: [
      { nombre: 'Administración para Informática', url: `${_base}/1semestre/Administracionparainformatica.pdf` },
      { nombre: 'Fundamentos de Investigación', url: `${_base}/1semestre/FundamentosdeInvestigacion-AC006.pdf` },
      { nombre: 'Fundamentos de Programación', url: `${_base}/1semestre/FundamentosdeProgramacion-AE032.pdf` },
      { nombre: 'Taller de Ética', url: `${_base}/1semestre/TallerdeEtica-AC007.pdf` },
      { nombre: 'Cálculo Diferencial', url: `${_base}/1semestre/CalculoDiferencial-AC001.pdf` },
      { nombre: 'Desarrollo Sustentable', url: `${_base}/1semestre/DesarrolloSustentable-AC008.pdf` },
    ],
  },
  {
    numero: 2,
    materias: [
      {
        nombre: 'Administración de los Recursos y Función Informática',
        url: `${_base}/2semestre/Administracion_de_los_recursos_y_funcion_informatica.pdf`,
      },
      { nombre: 'Física para Informática', url: `${_base}/2semestre/FisicaparaInformatica.pdf` },
      { nombre: 'Programación Orientada a Objetos', url: `${_base}/2semestre/ProgramacionOrientadaaObjetos-AE054.pdf` },
      { nombre: 'Contabilidad Financiera', url: `${_base}/2semestre/ContabilidadFinanciera-AE008.pdf` },
      { nombre: 'Cálculo Integral', url: `${_base}/2semestre/CalculaIntegral-AC002.pdf` },
      { nombre: 'Matemáticas Discretas', url: `${_base}/2semestre/MatematicasDiscretas-AE041.pdf` },
    ],
  },
  {
    numero: 3,
    materias: [
      { nombre: 'Fundamentos de Sistemas de Información', url: `${_base}/3semestre/FundamentosdeSistemasdeInformacion.pdf` },
      { nombre: 'Sistemas Electrónicos para Informática', url: `${_base}/3semestre/Sistemaselectronicosparainformatica.pdf` },
      { nombre: 'Estructura de Datos', url: `${_base}/3semestre/EstructuradeDatos-AE026.pdf` },
      { nombre: 'Costos Empresariales', url: `${_base}/3semestre/Costosempresariales..pdf` },
      { nombre: 'Álgebra Lineal', url: `${_base}/3semestre/AlgebraLineal-AC003.pdf` },
      { nombre: 'Probabilidad y Estadística', url: `${_base}/3semestre/ProbabilidadyEstadistica-AE052.pdf` },
    ],
  },
  {
    numero: 4,
    materias: [
      { nombre: 'Taller de Investigación I', url: `${_base}/4semestre/TallerdeInvestigacion-I-AC009.pdf` },
      { nombre: 'Arquitectura de Computadoras', url: `${_base}/4semestre/ArquitecturadeComputadoras.pdf` },
      { nombre: 'Administración y Organización de Datos', url: `${_base}/4semestre/Administracionyorganizaciondedatos.pdf` },
      { nombre: 'Fundamentos de Telecomunicaciones', url: `${_base}/4semestre/FundamentosdeTelecomunicaciones-AE034.pdf` },
      { nombre: 'Sistemas Operativos I', url: `${_base}/4semestre/SistemasOperativos-I-AE061.pdf` },
      { nombre: 'Investigación de Operaciones', url: `${_base}/4semestre/InvestigaciondeOperaciones.pdf` },
    ],
  },
  {
    numero: 5,
    materias: [
      {
        nombre: 'Análisis y Modelado de Sistemas de Información',
        url: `${_base}/5semestre/AnalisisymodeladodeSistemasdeInformacion.pdf`,
      },
      { nombre: 'Tecnologías e Interfaces de Computadoras', url: `${_base}/5semestre/TecnologiaseInterfacesdeComputadoras.pdf` },
      { nombre: 'Fundamentos de Base de Datos', url: `${_base}/5semestre/FundamentosdeBasedeDatos-AE031.pdf` },
      { nombre: 'Redes de Computadoras', url: `${_base}/5semestre/Redesdecomputadoras.pdf` },
      { nombre: 'Sistemas Operativos II', url: `${_base}/5semestre/SistemasOperativos-II-AE062.pdf` },
      { nombre: 'Taller de Legislación Informática', url: `${_base}/5semestre/TallerdeLegislacionInformatica.pdf` },
    ],
  },
  {
    numero: 6,
    materias: [
      {
        nombre: 'Desarrollo e Implementación de Sistemas de Información',
        url: `${_base}/6semestre/DesarrolloeimplementaciondeSistemasdeInformacion.pdf`,
      },
      { nombre: 'Auditoría Informática', url: `${_base}/6semestre/AuditoriaInformatica.pdf` },
      { nombre: 'Taller de Base de Datos', url: `${_base}/6semestre/TallerdeBasedeDatos-AE063.pdf` },
      { nombre: 'Interconectividad de Redes', url: `${_base}/6semestre/Interconectividadderedes..pdf` },
      { nombre: 'Desarrollo de Aplicaciones Web', url: `${_base}/6semestre/DesarrollodeAplicaciones%20eb.pdf` },
    ],
  },
  {
    numero: 7,
    materias: [
      { nombre: 'Calidad en los Sistemas de Información', url: `${_base}/7semestre/CalidadenlosSistemasdeInformacion.pdf` },
      {
        nombre: 'Fundamentos de Gestión de Servicios de TI',
        url: `${_base}/7semestre/Fundamentosgestionserviciostecnologiasinformacion.pdf`,
      },
      { nombre: 'Tópicos de Base de Datos', url: `${_base}/7semestre/Topicosdebasededatos.pdf` },
      { nombre: 'Administración de Servidores', url: `${_base}/7semestre/Administraciondeservidores.pdf` },
      {
        nombre: 'Programación en Ambiente Cliente Servidor',
        url: `${_base}/7semestre/ProgramacionenambienteclienteServidor.pdf`,
      },
      { nombre: 'Taller de Investigación II', url: `${_base}/7semestre/TallerdeInvestigacion-II-AC010.pdf` },
    ],
  },
  {
    numero: 8,
    materias: [
      { nombre: 'Taller de Emprendedores', url: `${_base}/8semestre/Tallerdeemprendedores.pdf` },
      {
        nombre: 'Estrategias de Gestión de Servicios de TI',
        url: `${_base}/8semestre/Estrategiasdegestiondeserviciosdetecnologiasdeinformacion.pdf`,
      },
      { nombre: 'Inteligencia de Negocios', url: `${_base}/8semestre/InteligenciadeNegocios.pdf` },
      {
        nombre: 'Desarrollo de Aplicaciones para Dispositivos Móviles',
        url: `${_base}/8semestre/DesarrolloAplicacionesDispositivosMoviles-AEB-1011.pdf`,
      },
      { nombre: 'Seguridad Informática', url: `${_base}/8semestre/SeguridadInformatica.pdf` },
    ],
  },
  // 9no semestre: contenido institucional sin PDFs de temario.
  // soloInformativo: true hace que comun.js renderice estas filas
  // como texto (sin tap), igual que _MateriaInfoItem en el Dart.
  {
    numero: 9,
    soloInformativo: true,
    materias: [
      { nombre: 'Especialidad', url: '' },
      { nombre: 'Residencia Profesional', url: '' },
      { nombre: 'Servicio Social', url: '' },
      { nombre: 'Actividades Complementarias', url: '' },
    ],
  },
];

const _especialidades = [
  {
    nombre: 'Infraestructura y Seguridad en Redes',
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
    nombre: 'Gestión De Datos',
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
    nombre: 'Desarrollo de Aplicaciones Multiplataforma',
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