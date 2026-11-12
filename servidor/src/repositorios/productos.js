// Consultas SQL de productos. Los "?" se reemplazan por los valores que pasamos a
// .run/.get/.all, y NUNCA se arma el SQL pegando texto del usuario (evita inyección SQL).
import db from '../db/conexion.js';

const BASE = `
  SELECT p.id, p.codigo_barras, p.nombre, p.categoria_id, c.nombre AS categoria,
         p.tipo_unidad, p.costo, p.costo_promedio, p.precio_venta, p.stock_actual, p.stock_minimo,
         p.controla_vencimiento, p.activo, p.creado_en, p.actualizado_en
  FROM productos p
  LEFT JOIN categorias c ON c.id = p.categoria_id
`;

export function listar({ buscar, categoriaId, soloBajo, incluirInactivos }) {
  const condiciones = [];
  const params = [];

  if (!incluirInactivos) condiciones.push('p.activo = 1');
  if (buscar) {
    condiciones.push('(p.nombre LIKE ? OR p.codigo_barras LIKE ?)');
    params.push(`%${buscar}%`, `%${buscar}%`);
  }
  if (categoriaId) {
    condiciones.push('p.categoria_id = ?');
    params.push(categoriaId);
  }
  if (soloBajo) condiciones.push('p.stock_actual <= p.stock_minimo');

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  return db
    .prepare(`${BASE} ${where} ORDER BY p.nombre COLLATE NOCASE LIMIT 500`)
    .all(...params);
}

export function buscarPorId(id) {
  return db.prepare(`${BASE} WHERE p.id = ?`).get(id);
}

export function buscarPorCodigo(codigo) {
  return db.prepare(`${BASE} WHERE p.codigo_barras = ?`).get(codigo);
}

export function insertar(p) {
  const r = db.prepare(`
    INSERT INTO productos
      (codigo_barras, nombre, categoria_id, tipo_unidad, costo, costo_promedio, precio_venta,
       stock_actual, stock_minimo, controla_vencimiento)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    p.codigo_barras, p.nombre, p.categoria_id, p.tipo_unidad, p.costo, p.costo,
    p.precio_venta, p.stock_actual, p.stock_minimo, p.controla_vencimiento
  );
  return Number(r.lastInsertRowid);
}

// No toca stock_actual ni tipo_unidad (ver explicación de la etapa).
export function actualizar(id, p) {
  db.prepare(`
    UPDATE productos
    SET codigo_barras = ?, nombre = ?, categoria_id = ?, costo = ?, precio_venta = ?,
        stock_minimo = ?, controla_vencimiento = ?, actualizado_en = datetime('now')
    WHERE id = ?
  `).run(
    p.codigo_barras, p.nombre, p.categoria_id, p.costo, p.precio_venta,
    p.stock_minimo, p.controla_vencimiento, id
  );
}

export function cambiarActivo(id, activo) {
  db.prepare(`UPDATE productos SET activo = ?, actualizado_en = datetime('now') WHERE id = ?`)
    .run(activo, id);
}

// Suma o resta stock (delta negativo = sale). SOLO se llama junto con un movimiento de stock,
// dentro de la misma transacción.
export function cambiarStock(id, delta) {
  db.prepare(`
    UPDATE productos SET stock_actual = stock_actual + ?, actualizado_en = datetime('now')
    WHERE id = ?
  `).run(delta, id);
}

// Entrada de mercadería: suma stock y actualiza último costo y costo promedio.
// SOLO se llama junto con un movimiento COMPRA, dentro de la misma transacción.
export function aplicarCompra(id, cantidad, costoUltimo, costoPromedio) {
  db.prepare(`
    UPDATE productos
    SET stock_actual = stock_actual + ?, costo = ?, costo_promedio = ?, actualizado_en = datetime('now')
    WHERE id = ?
  `).run(cantidad, costoUltimo, costoPromedio, id);
}

export function cambiarPrecio(id, precio) {
  db.prepare(`UPDATE productos SET precio_venta = ?, actualizado_en = datetime('now') WHERE id = ?`)
    .run(precio, id);
}

export function asignarProveedor(id, proveedorId) {
  db.prepare('UPDATE productos SET proveedor_id = ? WHERE id = ?').run(proveedorId, id);
}