// Consultas SQL de cambios e historial de precios.
import db from '../db/conexion.js';

export function productosParaActualizar({ categoriaId, proveedorId }) {
  const cond = ['p.activo = 1', 'p.precio_venta > 0'];
  const params = [];
  if (categoriaId) { cond.push('p.categoria_id = ?'); params.push(categoriaId); }
  if (proveedorId) { cond.push('p.proveedor_id = ?'); params.push(proveedorId); }
  return db.prepare(`
    SELECT p.id, p.nombre, p.tipo_unidad, p.precio_venta, c.nombre AS categoria
    FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE ${cond.join(' AND ')}
    ORDER BY p.nombre COLLATE NOCASE
  `).all(...params);
}

export const nombreCategoria = (id) =>
  db.prepare('SELECT nombre FROM categorias WHERE id = ?').get(id)?.nombre ?? null;
export const nombreProveedor = (id) =>
  db.prepare('SELECT nombre FROM proveedores WHERE id = ?').get(id)?.nombre ?? null;

export function crearCambio({ descripcion, porcentaje, usuarioId }) {
  const r = db.prepare('INSERT INTO cambios_precios (descripcion, porcentaje, usuario_id) VALUES (?, ?, ?)')
    .run(descripcion, porcentaje, usuarioId);
  return Number(r.lastInsertRowid);
}

export const buscarCambio = (id) => db.prepare('SELECT * FROM cambios_precios WHERE id = ?').get(id);

export const marcarDeshecho = (id, usuarioId) =>
  db.prepare("UPDATE cambios_precios SET deshecho_en = datetime('now'), deshecho_por = ? WHERE id = ?")
    .run(usuarioId, id);

export function registrarHistorial({ productoId, anterior, nuevo, motivo, cambioId = null, usuarioId = null }) {
  db.prepare(`
    INSERT INTO historial_precios (producto_id, precio_anterior, precio_nuevo, motivo, cambio_id, usuario_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(productoId, anterior, nuevo, motivo, cambioId, usuarioId);
}

// Solo las filas "originales" del cambio masivo (no los deshacer).
export const historialDeCambio = (cambioId) =>
  db.prepare("SELECT * FROM historial_precios WHERE cambio_id = ? AND motivo = 'MASIVO'").all(cambioId);

export function ultimosCambios(limite) {
  return db.prepare(`
    SELECT cp.id, cp.descripcion, cp.porcentaje, cp.creado_en, cp.deshecho_en,
           u.nombre AS usuario,
           (SELECT COUNT(*) FROM historial_precios h WHERE h.cambio_id = cp.id AND h.motivo = 'MASIVO') AS cantidad
    FROM cambios_precios cp LEFT JOIN usuarios u ON u.id = cp.usuario_id
    ORDER BY cp.id DESC LIMIT ?
  `).all(limite);
}

export function historialReciente(limite) {
  return db.prepare(`
    SELECT h.id, p.nombre AS producto, p.tipo_unidad, h.precio_anterior, h.precio_nuevo,
           h.motivo, h.creado_en, u.nombre AS usuario
    FROM historial_precios h
    JOIN productos p ON p.id = h.producto_id
    LEFT JOIN usuarios u ON u.id = h.usuario_id
    ORDER BY h.id DESC LIMIT ?
  `).all(limite);
}