// Consultas SQL de categorías. Acá no hay reglas, solo consultas.
import db from '../db/conexion.js';

export function listar() {
  return db.prepare('SELECT id, nombre FROM categorias ORDER BY nombre').all();
}

export function existe(id) {
  return db.prepare('SELECT 1 AS ok FROM categorias WHERE id = ?').get(id) !== undefined;
}