// Consultas SQL de ventas. Nada de reglas acá.
import db from '../db/conexion.js';

export function buscarPorUuid(uuid) {
  return db.prepare('SELECT id FROM ventas WHERE client_uuid = ?').get(uuid);
}

export function insertarVenta(v) {
  const r = db.prepare(`
    INSERT INTO ventas (client_uuid, subtotal, descuento, total, vuelto, usuario_id, autorizado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(v.client_uuid, v.subtotal, v.descuento, v.total, v.vuelto, v.usuario_id, v.autorizado_por);
  return Number(r.lastInsertRowid);
}

export function insertarItem(ventaId, i) {
  db.prepare(`
    INSERT INTO venta_items
      (venta_id, producto_id, nombre_snapshot, tipo_unidad, cantidad,
       precio_unitario, costo_unitario, costo_promedio_unitario, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(ventaId, i.producto_id, i.nombre, i.tipo_unidad, i.cantidad,
         i.precio_unitario, i.costo_unitario, i.costo_promedio_unitario, i.subtotal);
}

export function insertarPago(ventaId, medio, monto) {
  db.prepare('INSERT INTO venta_pagos (venta_id, medio, monto) VALUES (?, ?, ?)')
    .run(ventaId, medio, monto);
}

export function buscarPorId(id) {
  return db.prepare(`
    SELECT v.id, v.client_uuid, v.subtotal, v.descuento, v.total, v.vuelto, v.estado,
           v.creado_en, v.anulada_en, v.anulada_motivo, u.nombre AS vendedor
    FROM ventas v LEFT JOIN usuarios u ON u.id = v.usuario_id
    WHERE v.id = ?
  `).get(id);
}

// No se devuelve costo_unitario: el empleado no debe ver costos.
export function itemsDe(ventaId) {
  return db.prepare(`
    SELECT producto_id, nombre_snapshot AS nombre, tipo_unidad, cantidad, precio_unitario, subtotal
    FROM venta_items WHERE venta_id = ? ORDER BY id
  `).all(ventaId);
}

export function pagosDe(ventaId) {
  return db.prepare('SELECT medio, monto FROM venta_pagos WHERE venta_id = ? ORDER BY id').all(ventaId);
}

// "fecha" (opcional) = un día local 'AAAA-MM-DD' -> se convierte a límites UTC (Mendoza = UTC-3).
export function listar({ fecha, limite }) {
  const where = fecha
    ? "WHERE v.creado_en >= datetime(?, '+3 hours') AND v.creado_en < datetime(?, '+1 day', '+3 hours')"
    : '';
  const params = fecha ? [fecha, fecha, limite] : [limite];
  return db.prepare(`
    SELECT v.id, v.subtotal, v.descuento, v.total, v.estado, v.creado_en,
           u.nombre AS vendedor,
           (SELECT group_concat(medio, ', ') FROM venta_pagos WHERE venta_id = v.id) AS medios
    FROM ventas v LEFT JOIN usuarios u ON u.id = v.usuario_id
    ${where}
    ORDER BY v.id DESC LIMIT ?
  `).all(...params);
}

// Devuelve cuántas filas cambió: 0 si la venta ya estaba anulada.
export function marcarAnulada(id, usuarioId, motivo) {
  return db.prepare(`
    UPDATE ventas
    SET estado = 'ANULADA', anulada_en = datetime('now'), anulada_por = ?, anulada_motivo = ?
    WHERE id = ? AND estado = 'COMPLETADA'
  `).run(usuarioId, motivo, id).changes;
}