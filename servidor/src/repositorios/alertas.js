import db from '../db/conexion.js';

// Stock bajo: tiene mínimo definido y el stock llegó a él, o el stock quedó en negativo.
// (Un producto con mínimo 0 y stock 0 no alerta: sería ruido.)
export function stockBajo() {
  return db.prepare(`
    SELECT p.id, p.nombre, p.tipo_unidad, p.stock_actual, p.stock_minimo, c.nombre AS categoria
    FROM productos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.activo = 1
      AND ((p.stock_minimo > 0 AND p.stock_actual <= p.stock_minimo) OR p.stock_actual < 0)
    ORDER BY (p.stock_actual <= 0) DESC, p.nombre COLLATE NOCASE
  `).all();
}

// Lotes con stock que vencen dentro de "dias" días (o que ya vencieron).
// dias_restantes: negativo = ya venció.
export function lotesPorVencer(dias) {
  return db.prepare(`
    SELECT l.id AS lote_id, p.id AS producto_id, p.nombre, p.tipo_unidad,
           l.fecha_vencimiento, l.cantidad_restante,
           CAST(julianday(l.fecha_vencimiento) - julianday(date('now', '-3 hours')) AS INTEGER)
             AS dias_restantes
    FROM lotes l
    JOIN productos p ON p.id = l.producto_id
    WHERE l.cantidad_restante > 0
      AND p.activo = 1
      AND l.fecha_vencimiento <= date('now', '-3 hours', '+' || ? || ' days')
    ORDER BY l.fecha_vencimiento, p.nombre COLLATE NOCASE
  `).all(dias);
}