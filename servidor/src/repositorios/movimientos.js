// Consultas SQL del historial de stock.
import db from '../db/conexion.js';

export function registrar({
  productoId, tipo, cantidad, stockResultante,
  motivo = null, nota = null, refTipo = null, refId = null, usuarioId = null,
}) {
  db.prepare(`
    INSERT INTO movimientos_stock
      (producto_id, tipo, cantidad, stock_resultante, motivo, nota, ref_tipo, ref_id, usuario_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(productoId, tipo, cantidad, stockResultante, motivo, nota, refTipo, refId, usuarioId);
}

export function listarPorProducto(productoId, limite = 200) {
  return db.prepare(`
    SELECT m.id, m.tipo, m.cantidad, m.stock_resultante, m.motivo, m.nota,
           m.ref_tipo, m.ref_id, m.creado_en, u.nombre AS usuario
    FROM movimientos_stock m
    LEFT JOIN usuarios u ON u.id = m.usuario_id
    WHERE m.producto_id = ?
    ORDER BY m.id DESC
    LIMIT ?
  `).all(productoId, limite);
}

// Productos cuyo stock_actual NO coincide con la suma de sus movimientos.
// Si la lista viene vacía, todo está en orden.
export function verificarConsistencia() {
  return db.prepare(`
    SELECT p.id, p.nombre, p.stock_actual, COALESCE(SUM(m.cantidad), 0) AS suma_movimientos
    FROM productos p
    LEFT JOIN movimientos_stock m ON m.producto_id = p.id
    GROUP BY p.id
    HAVING p.stock_actual <> COALESCE(SUM(m.cantidad), 0)
  `).all();
}