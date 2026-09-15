// ═════════════════════════════════════════════════════════════════
// maestro-model.js
// Ubicación: js/features/chat/maestros/maestro-model.js
//
// Réplica web de Referencias de maestros/maestro_model.dart. Modelos
// planos (sin lógica de UI): Maestro y Evaluacion. Igual que
// mensaje-model.js/chat-model.js, son funciones factory + helpers de
// conversión desde/hacia Supabase, no clases.
// ═════════════════════════════════════════════════════════════════

export function crearMaestro({
  id = '',
  nombre,
  apellidoPat,
  apellidoMat,
  titulo = 'Profe',
  departamento = null,
  materias = [],
  semestres = [],
  creadoPor = null,
  createdAt = new Date().toISOString(),
  promedioEstrellas = 0,
  totalEvaluaciones = 0,
}) {
  return { id, nombre, apellidoPat, apellidoMat, titulo, departamento, materias, semestres, creadoPor, createdAt, promedioEstrellas, totalEvaluaciones };
}

export function nombreCompletoMaestro(m) {
  return `${m.titulo} ${m.nombre} ${m.apellidoPat} ${m.apellidoMat}`;
}

export function maestroDesdeFila(fila) {
  return crearMaestro({
    id: fila.id,
    nombre: fila.nombre,
    apellidoPat: fila.apellido_pat,
    apellidoMat: fila.apellido_mat,
    titulo: fila.titulo || 'Profe',
    departamento: fila.departamento ?? null,
    materias: fila.materias || [],
    semestres: fila.semestres || [],
    creadoPor: fila.creado_por ?? null,
    createdAt: fila.created_at,
    promedioEstrellas: Number(fila.promedio_estrellas ?? 0),
    totalEvaluaciones: Number(fila.total_evaluaciones ?? 0),
  });
}

export function maestroAInsertMap(m) {
  return {
    nombre: m.nombre,
    apellido_pat: m.apellidoPat,
    apellido_mat: m.apellidoMat,
    titulo: m.titulo,
    departamento: m.departamento,
    materias: m.materias,
    semestres: m.semestres,
  };
}

export function crearEvaluacion({ id = '', maestroId, usuarioId, estrellas, comentario = null, createdAt = new Date().toISOString() }) {
  return { id, maestroId, usuarioId, estrellas, comentario, createdAt };
}

export function evaluacionDesdeFila(fila) {
  return crearEvaluacion({
    id: fila.id,
    maestroId: fila.maestro_id,
    usuarioId: fila.usuario_id,
    estrellas: fila.estrellas,
    comentario: fila.comentario ?? null,
    createdAt: fila.created_at,
  });
}

export function evaluacionAInsertMap(e) {
  return { maestro_id: e.maestroId, usuario_id: e.usuarioId, estrellas: e.estrellas, comentario: e.comentario };
}