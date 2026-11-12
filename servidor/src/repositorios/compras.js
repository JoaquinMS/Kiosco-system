import db from '../db/conexion.js';

export function buscarPorUuid(uuid) {
  return db.prepare('SELECT id FROM compras WHERE client_uuid = ?').get(uuid);
}

export function insertarCompra(c) {
  const r = db.prepare(`
    INSERT INTO compras (client_uuid, proveedor_id, nro_comprobante, total, usuario_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(c.client_uuid, c.proveedor_id, c.nro_comprobante, c.total, c.usuario_id);
  return Number(r.lastInsertRowid);
}

export function insertarItem(compraId, i) {
  const r = db.prepare(`
    INSERT INTO compra_items
      (compra_id, producto_id, cantidad, costo_unitario, fecha_vencimiento, subtotal)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(compraId, i.producto_id, i.cantidad, i.costo_unitario, i.fecha_vencimiento, i.subtotal);
  return Number(r.lastInsertRowid);
}

export function buscarPorId(id) {
  return db.prepare(`
    SELECT c.id, c.client_uuid, c.proveedor_id, pr.nombre AS proveedor,
           c.nro_comprobante, c.total, c.creado_en
    FROM compras c
    LEFT JOIN proveedores pr ON pr.id = c.proveedor_id
    WHERE c.id = ?
  `).get(id);
}

export function itemsDe(compraId) {
  return db.prepare(`
    SELECT ci.producto_id, p.nombre, p.tipo_unidad, ci.cantidad, ci.costo_unitario,
           ci.fecha_vencimiento, ci.subtotal
    FROM compra_items ci
    JOIN productos p ON p.id = ci.producto_id
    WHERE ci.compra_id = ?
    ORDER BY ci.id
  `).all(compraId);
}

export function listarRecientes(limite) {
  return db.prepare(`
    SELECT c.id, pr.nombre AS proveedor, c.nro_comprobante, c.total, c.creado_en
    FROM compras c
    LEFT JOIN proveedores pr ON pr.id = c.proveedor_id
    ORDER BY c.id DESC LIMIT ?
  `).all(limite);
}