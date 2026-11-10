// Consultas SQL del historial de stock.
import db from '../db/conexion.js';

export function registrar({
  productoId, tipo, cantidad, stockResultante,
  motivo = null, nota = null, refTipo = null, refId = null,
}) {
  db.prepare(`
    INSERT INTO movimientos_stock
      (producto_id, tipo, cantidad, stock_resultante, motivo, nota, ref_tipo, ref_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(productoId, tipo, cantidad, stockResultante, motivo, nota, refTipo, refId);
}

export function listarPorProducto(productoId, limite = 200) {
  return db.prepare(`
    SELECT id, tipo, cantidad, stock_resultante, motivo, nota, ref_tipo, ref_id, creado_en
    FROM movimientos_stock
    WHERE producto_id = ?
    ORDER BY id DESC
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