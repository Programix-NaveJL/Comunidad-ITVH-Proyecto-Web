// ═════════════════════════════════════════════════════════════════
// icda.js
//
// Pantalla informativa de la Ingeniería en Ciencias de Datos.
// Réplica funcional de ICDA.dart.
//
// Color de acento: cs.tertiary de Flutter → var(--color-tertiary),
// igual que IINF, para distinguirse de ISC (primary) e ITIC
// (secondary) dentro del mismo departamento. El Perfil de Egreso
// usa cs.primary para diferenciarse del de Ingreso.
//
// Nota de fidelidad: ICDA es la carrera más nueva del campus (plan
// 2024) y aún no tiene especialidades definidas, así que esta
// pantalla omite esa sección — a diferencia de ISC/ITIC/IINF, que sí
// la tienen.
// ═════════════════════════════════════════════════════════════════

import {
  renderHeroCarrera,
  renderSectionTitle,
  renderObjetivoGeneral,
  renderPerfilSection,
  renderReticulaItem,
  renderSemestreExpansion,
  inicializarCarrera,
} from './comun.js';

const COLOR = 'var(--color-tertiary)';
const COLOR_EGRESO = 'var(--color-primary)';

/** Pinta la pantalla de ICDA completa dentro de `contenedor`. */
export function renderICDA(contenedor) {
  contenedor.innerHTML = `
    <div class="carrera">
      ${renderHeroCarrera({
        color: COLOR,
        icono: '📊',
        departamento: 'Departamento de Sistemas y Computación',
        titulo: 'Ing. en Ciencias de Datos',
        chipExtra: 'Nueva carrera',
      })}

      <div class="carrera-cuerpo">

        ${renderSectionTitle('Objetivo General', COLOR)}
        ${renderObjetivoGeneral(
          'Formar ingenieros competentes que modelan, implementan y evalúan datos provenientes de entornos complejos, utilizando técnicas de vanguardia que le permitan la identificación, visualización y comprensión de patrones, que facilitan la toma de decisiones estratégicas en los sectores educativo, empresarial, social e industrial a través de equipos multidisciplinarios con enfoque ético y sostenible.',
          COLOR
        )}

        ${renderSectionTitle('Perfil de Ingreso', COLOR)}
        ${renderPerfilSection(_perfilIngreso, COLOR)}

        ${renderSectionTitle('Perfil de Egreso', COLOR)}
        ${renderPerfilSection(_perfilEgreso, COLOR_EGRESO)}

        ${renderSectionTitle('Retícula ICDA-2024-247', COLOR)}
        <div class="carrera-reticulas">
          ${renderReticulaItem(_reticula, COLOR)}
        </div>

        ${renderSectionTitle('Plan de Estudios', COLOR)}
        <div class="carrera-semestres">
          ${_semestres.map((s) => renderSemestreExpansion(s, COLOR)).join('')}
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
  'Habilidades lógico-matemáticas, de programación, pensamiento crítico, comunicación y curiosidad y disposición para el aprendizaje.',
  'Capacidad creativa, analítica, de resolución de problemas y emprendedora.',
  'Liderazgo y capacidad de trabajo en equipos multidisciplinarios.',
  'Razonamiento cuantitativo y pensamiento analítico.',
  'Conciencia ética y social.',
  'Compromiso con el desarrollo sostenible.',
  'Habilidades de aprendizaje autónomo y capacidad de síntesis.',
  'Capacidad para reconocer y valorar el diseño estético y funcional de productos tecnológicos.',
];

const _perfilEgreso = [
  'Domina técnicas de recolección, limpieza y preparación de datos para garantizar la confiabilidad de los usuarios elevando su productividad y competitividad.',
  'Implementa estrategias tecnológicas para la administración, almacenamiento y gobernanza de los datos considerando las implicaciones éticas y legales.',
  'Diseña y desarrolla arquitecturas de datos escalables, procesos de extracción, transformación y carga (ETL) así como secuencias de datos para gestionar grandes volúmenes de información con responsabilidad social.',
  'Construye modelos de aprendizaje máquina y aprendizaje profundo en el desarrollo de soluciones de alta especialidad para entornos complejos, respetando el marco legal internacional con responsabilidad social y respeto a los derechos humanos.',
  'Aplica la lógica de los lenguajes de programación para generar código y funciones que permitan la manipulación y análisis de datos con excelencia.',
  'Implementa y gestiona sistemas embebidos en dispositivos de internet de las cosas para garantizar la recopilación y transmisión de datos de manera eficiente y confiable.',
  'Planifica, ejecuta y gestiona proyectos de ciencia de datos para asegurar soluciones que cumplan con los objetivos y requisitos de la organización con sentido ético.',
];

// Instancia única: ICDA solo tiene un plan de estudios disponible.
const _reticula = {
  clave: 'ICDA-2024-247',
  nombre: 'Retícula 2024',
  url: 'https://pub-f883231412d746839d3a41f6bc354031.r2.dev/ICDA/ICDA-2024-247P.pdf',
};

// URL base en el servidor de Acapulco TecNM: el plan 2024 es
// nacional y los PDFs aún no tienen espejo en el servidor de
// Villahermosa.
const _base = 'https://acapulco.tecnm.mx/wp-content/uploads/carreras/ingenieria_en_ciencias_de_datos';

const _semestres = [
  {
    numero: 1,
    materias: [
      { nombre: 'Cálculo Diferencial', url: `${_base}/01/ACF-2301-Calculo-diferencial.pdf` },
      { nombre: 'Fundamentos de Investigación', url: `${_base}/01/ACC-0906-Fundamentos-de-investigacion.pdf` },
      { nombre: 'Química', url: `${_base}/01/AEC-1058-Quimica.pdf` },
      { nombre: 'Fundamentos de Programación', url: `${_base}/01/CDB-2408-Fundamentos-de-programacion.pdf` },
      { nombre: 'Matemáticas Discretas', url: `${_base}/01/CDF-2416-Matematicas-discretas.pdf` },
      {
        nombre: 'Introducción a la Ing. en Ciencia de Datos',
        url: `${_base}/01/CDI-2413-Introduccion-a-la-ingenieria-en-ciencia-de-datos.pdf`,
      },
    ],
  },
  {
    numero: 2,
    materias: [
      { nombre: 'Cálculo Integral', url: `${_base}/02/ACF-0902-Calculo-integral.pdf` },
      { nombre: 'Programación Orientada a Objetos', url: `${_base}/02/CDD-2421-Programacion-orientada-a-objetos.pdf` },
      {
        nombre: 'Principios Eléctricos y Aplicaciones Digitales',
        url: `${_base}/02/CDF-2418-Principios-electricos-y-aplicaciones-digitales.pdf`,
      },
      { nombre: 'Taller de Ética', url: `${_base}/02/ACH-2307-Taller-de-etica.pdf` },
      { nombre: 'Desarrollo Sustentable', url: `${_base}/02/ACD-0908-Desarrollo-sustentable.pdf` },
      { nombre: 'Física General', url: `${_base}/02/AEF-24129-Fisica-General.pdf` },
    ],
  },
  {
    numero: 3,
    materias: [
      { nombre: 'Cálculo Vectorial', url: `${_base}/03/ACF-0904-Calculo-vectorial.pdf` },
      { nombre: 'Estructura de Datos', url: `${_base}/03/CDD-2407-Estructura-de-datos.pdf` },
      { nombre: 'Álgebra Lineal', url: `${_base}/03/ACF-0903-Algebra-lineal.pdf` },
      { nombre: 'Arquitectura de Computadoras', url: `${_base}/03/AEE-24123-Arquitectura-de-computadoras.pdf` },
      { nombre: 'Probabilidad y Estadística', url: `${_base}/03/AEF-24126-Probabilidad-y-estadistica.pdf` },
      { nombre: 'Taller de Liderazgo', url: `${_base}/03/AEC-24130-Taller-de-liderazgo.pdf` },
    ],
  },
  {
    numero: 4,
    materias: [
      { nombre: 'Ecuaciones Diferenciales', url: `${_base}/04/ACF-0905-Ecuaciones-diferenciales.pdf` },
      { nombre: 'Métodos Numéricos', url: `${_base}/04/AEC-24128-Metodos-numericos.pdf` },
      { nombre: 'Fundamentos de Redes', url: `${_base}/04/CDJ-2409-Fundamentos-de-redes.pdf` },
      {
        nombre: 'Programación Avanzada para Ciencia de Datos',
        url: `${_base}/04/CDC-2420-Programacion-avanzada-para-ciencia-de-datos.pdf`,
      },
      { nombre: 'Fundamentos de Bases de Datos', url: `${_base}/04/AEF-24124-Fundamentos-de-bases-de-datos.pdf` },
      { nombre: 'Estadística Inferencial', url: `${_base}/04/AEF-24121-Estadistica-inferencial.pdf` },
    ],
  },
  {
    numero: 5,
    materias: [
      { nombre: 'Lenguajes y Autómatas', url: `${_base}/05/CDD-2415-Lenguajes-y-automatas.pdf` },
      { nombre: 'Inteligencia Artificial', url: `${_base}/05/CDC-2411-Inteligencia-artificial.pdf` },
      { nombre: 'Ciberseguridad', url: `${_base}/05/CDH-2405-Ciberseguridad.pdf` },
      { nombre: 'Adquisición de Datos', url: `${_base}/05/CDD-2401-Adquisicion-de-datos.pdf` },
      { nombre: 'Bases de Datos No Relacionales', url: `${_base}/05/AEC-24125-Bases-de-datos-no-relacionales.pdf` },
      { nombre: 'Estadística para Ciencia de Datos', url: `${_base}/05/CDD-2406-Estadistica-para-ciencia-de-datos.pdf` },
    ],
  },
  {
    numero: 6,
    materias: [
      { nombre: 'Inteligencia de Negocios', url: `${_base}/06/CDC-2412-Inteligencia-de-negocios.pdf` },
      { nombre: 'Investigación de Operaciones', url: `${_base}/06/CDD-2414-Investigacion-de-operaciones.pdf` },
      { nombre: 'Aprendizaje Automático', url: `${_base}/06/CDF-2402-Aprendizaje-automatico.pdf` },
      { nombre: 'Internet de las Cosas', url: `${_base}/06/AED-2A122-Internet-de-las-cosas.pdf` },
      { nombre: 'Ingeniería de Software', url: `${_base}/06/CDC-2410-Ingenieria-software.pdf` },
      { nombre: 'Taller de Investigación I', url: `${_base}/06/AC009-Taller-de-investigacion-I.pdf` },
    ],
  },
  {
    numero: 7,
    materias: [
      { nombre: 'Taller de Investigación II', url: `${_base}/07/AC010-Taller-de-investigacion-II.pdf` },
      { nombre: 'Visión Artificial', url: `${_base}/07/CDF-2424-Vision-artificial.pdf` },
      { nombre: 'Procesamiento de Lenguaje Natural', url: `${_base}/07/CDF-2419-Procesamiento-de-lenguaje-natural.pdf` },
      { nombre: 'Taller de Desarrollo Ágil', url: `${_base}/07/CDD-2422-Taller-de-desarrollo-agil.pdf` },
      { nombre: 'Arquitectura de Datos en la Nube', url: `${_base}/07/CDC-2403-Arquitectura-de-datos-en-la-nube.pdf` },
    ],
  },
  {
    numero: 8,
    materias: [
      {
        nombre: 'Tópicos Selectos para Ciencia de Datos',
        url: `${_base}/08/CDA-2423-Topicos-selectos-para-ciencia-de-datos.pdf`,
      },
      { nombre: 'Big Data', url: `${_base}/08/CDD-2404-Big-Data.pdf` },
      { nombre: 'Visualización de Datos', url: `${_base}/08/CDF-2425-Visualizacion-de-datos.pdf` },
    ],
  },
  // 9no semestre: mezcla una materia con PDF real y tres sin URL;
  // comun.js detecta el `url` vacío y las renderiza sin tap.
  {
    numero: 9,
    materias: [
      {
        nombre: 'Metodologías para Proyectos en Ciencia de Datos',
        url: `${_base}/09/CDH-2417-Metodologias-para-proyectos-en-ciencia-de-datos.pdf`,
      },
      { nombre: 'Residencia Profesional', url: '' },
      { nombre: 'Servicio Social', url: '' },
      { nombre: 'Actividades Complementarias', url: '' },
    ],
  },
];