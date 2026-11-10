// Consultas SQL de lotes (productos con fecha de vencimiento).
import db from '../db/conexion.js';

export function crear({ productoId, compraItemId, fecha, cantidad }) {
  db.prepare(`
    INSERT INTO lotes (producto_id, compra_item_id, fecha_vencimiento, cantidad_inicial, cantidad_restante)
    VALUES (?, ?, ?, ?, ?)
  `).run(productoId, compraItemId, fecha, cantidad, cantidad);
}

export function listarActivos(productoId) {
  return db.prepare(`
    SELECT id, fecha_vencimiento, cantidad_inicial, cantidad_restante
    FROM lotes
    WHERE producto_id = ? AND cantidad_restante > 0
    ORDER BY fecha_vencimiento, id
  `).all(productoId);
}

// FEFO (First Expired, First Out): descuenta primero del lote que vence antes.
// Si no alcanzan los lotes, el resto es stock sin fecha y no se toca acá.
export function consumirFEFO(productoId, cantidad) {
  let faltante = cantidad;
  const actualizar = db.prepare('UPDATE lotes SET cantidad_restante = ? WHERE id = ?');
  for (const lote of listarActivos(productoId)) {
    if (faltante <= 0) break;
    const tomar = Math.min(lote.cantidad_restante, faltante);
    actualizar.run(lote.cantidad_restante - tomar, lote.id);
    faltante -= tomar;
  }
}

// Regla: lo que hay en lotes nunca puede superar el stock del producto.
export function verificarConsistencia() {
  return db.prepare(`
    SELECT p.id, p.nombre, p.stock_actual, SUM(l.cantidad_restante) AS suma_lotes
    FROM productos p
    JOIN lotes l ON l.producto_id = p.id
    GROUP BY p.id
    HAVING SUM(l.cantidad_restante) > MAX(p.stock_actual, 0)
  `).all();
}