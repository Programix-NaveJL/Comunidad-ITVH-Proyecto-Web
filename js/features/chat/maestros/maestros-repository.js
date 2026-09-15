// ═════════════════════════════════════════════════════════════════
// maestros-repository.js
// Ubicación: js/features/chat/maestros/maestros-repository.js
//
// Réplica web de Referencias de maestros/maestros_repository.dart.
// Toda la comunicación con Supabase de este módulo pasa por aquí.
// Tablas/vistas: maestros_con_promedio (vista, solo lectura, con
// promedio/total ya calculados) · maestros (tabla real) · evaluaciones.
// ═════════════════════════════════════════════════════════════════

import { supabaseClient } from '../../../core/supabase-client.js';
import { maestroDesdeFila, maestroAInsertMap, evaluacionDesdeFila, evaluacionAInsertMap } from './maestro-model.js';

export async function obtenerMaestros({ departamento = null } = {}) {
  let query = supabaseClient.from('maestros_con_promedio').select().order('apellido_pat', { ascending: true });
  if (departamento && departamento !== 'Todos') query = query.eq('departamento', departamento);

  const { data, error } = await query;
  if (error) {
    console.error('maestros-repository – obtenerMaestros:', error);
    return [];
  }
  return (data || []).map(maestroDesdeFila);
}

export async function maestroExiste({ apellidoPat, apellidoMat }) {
  const { data, error } = await supabaseClient
    .from('maestros')
    .select('id')
    .ilike('apellido_pat', apellidoPat.trim())
    .ilike('apellido_mat', apellidoMat.trim())
    .maybeSingle();
  if (error) {
    console.error('maestros-repository – maestroExiste:', error);
    return false;
  }
  return data != null;
}

export async function crearMaestro(maestro) {
  const { data, error } = await supabaseClient.from('maestros').insert(maestroAInsertMap(maestro)).select().single();
  if (error) throw error;
  return maestroDesdeFila(data);
}

export async function actualizarMaestro({ id, nombre, apellidoPat, apellidoMat, titulo, departamento, materias, semestres }) {
  const { error } = await supabaseClient
    .from('maestros')
    .update({ nombre, apellido_pat: apellidoPat, apellido_mat: apellidoMat, titulo, departamento, materias, semestres })
    .eq('id', id);
  if (error) throw error;
}

export async function obtenerEvaluaciones(maestroId) {
  const { data, error } = await supabaseClient.from('evaluaciones').select().eq('maestro_id', maestroId).order('created_at', { ascending: false });
  if (error) {
    console.error('maestros-repository – obtenerEvaluaciones:', error);
    return [];
  }
  return (data || []).map(evaluacionDesdeFila);
}

export async function yaEvaluo({ maestroId, usuarioId }) {
  const { data, error } = await supabaseClient.from('evaluaciones').select('id').eq('maestro_id', maestroId).eq('usuario_id', usuarioId).maybeSingle();
  if (error) {
    console.error('maestros-repository – yaEvaluo:', error);
    return false;
  }
  return data != null;
}

export async function crearEvaluacion(evaluacion) {
  const { error } = await supabaseClient.from('evaluaciones').insert(evaluacionAInsertMap(evaluacion));
  if (error) throw error;
}

export async function editarEvaluacion({ evaluacionId, estrellas, comentario }) {
  const { error } = await supabaseClient.from('evaluaciones').update({ estrellas, comentario }).eq('id', evaluacionId);
  if (error) throw error;
}