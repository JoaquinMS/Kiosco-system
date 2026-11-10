import db from '../db/conexion.js';

export function listar() {
  return db.prepare('SELECT id, nombre FROM proveedores WHERE activo = 1 ORDER BY nombre').all();
}

export function buscarPorId(id) {
  return db.prepare('SELECT id, nombre FROM proveedores WHERE id = ? AND activo = 1').get(id);
}

export function buscarPorNombre(nombre) {
  return db.prepare('SELECT id, nombre FROM proveedores WHERE nombre = ?').get(nombre);
}

export function crear(nombre) {
  const r = db.prepare('INSERT INTO proveedores (nombre) VALUES (?)').run(nombre);
  return Number(r.lastInsertRowid);
}