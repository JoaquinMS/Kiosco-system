// Consultas SQL de ventas. Nada de reglas acá.
import db from '../db/conexion.js';

export function buscarPorUuid(uuid) {
  return db.prepare('SELECT id FROM ventas WHERE client_uuid = ?').get(uuid);
}

export function insertarVenta(v) {
  const r = db.prepare(`
    INSERT INTO ventas (client_uuid, subtotal, descuento, total, vuelto)
    VALUES (?, ?, ?, ?, ?)
  `).run(v.client_uuid, v.subtotal, v.descuento, v.total, v.vuelto);
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
    SELECT id, client_uuid, subtotal, descuento, total, vuelto, estado, creado_en
    FROM ventas WHERE id = ?
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

export function listarRecientes(limite) {
  return db.prepare(`
    SELECT id, subtotal, descuento, total, estado, creado_en
    FROM ventas ORDER BY id DESC LIMIT ?
  `).all(limite);
}