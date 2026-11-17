// Exportaciones a CSV (para Excel en español: separador ";", coma decimal, BOM UTF-8).
import db from '../db/conexion.js';
import { aCsv, pesosCsv, cantidadCsv, textoSeguro } from '../lib/csv.js';
import { hoyArgentina } from '../lib/fechas.js';
import { leerRango } from './reportes.js';

const t = (x) => textoSeguro(x ?? '');                  // texto escrito por personas
const codigoExcel = (c) => (c ? `="${c}"` : '');        // evita que Excel lo convierta en 7,79E+12
const unidad = (tipo) => (tipo === 'PESO' ? 'kg' : 'u');
const siNo = (n) => (n ? 'Sí' : 'No');

export function productosCsv() {
  const filas = db.prepare(`
    SELECT p.codigo_barras, p.nombre, c.nombre AS categoria, pr.nombre AS proveedor,
           p.tipo_unidad, p.costo, p.costo_promedio, p.precio_venta,
           p.stock_actual, p.stock_minimo, p.controla_vencimiento, p.activo
    FROM productos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
    ORDER BY p.nombre COLLATE NOCASE
  `).all();

  return {
    nombre: `productos_${hoyArgentina()}.csv`,
    contenido: aCsv(
      ['Código', 'Nombre', 'Categoría', 'Proveedor', 'Unidad', 'Costo', 'Costo promedio',
        'Precio', 'Stock', 'Stock mínimo', 'Vence', 'Activo'],
      filas.map((f) => [
        codigoExcel(f.codigo_barras), t(f.nombre), t(f.categoria), t(f.proveedor), unidad(f.tipo_unidad),
        pesosCsv(f.costo), pesosCsv(f.costo_promedio), pesosCsv(f.precio_venta),
        cantidadCsv(f.stock_actual, f.tipo_unidad), cantidadCsv(f.stock_minimo, f.tipo_unidad),
        siNo(f.controla_vencimiento), siNo(f.activo),
      ]),
    ),
  };
}

// Una fila por producto vendido. Las fechas salen en hora argentina.
export function ventasDetalleCsv(q = {}) {
  const { desde, hasta } = leerRango(q);
  const filas = db.prepare(`
    SELECT v.id AS venta, datetime(v.creado_en, '-3 hours') AS fecha, u.nombre AS vendedor,
           v.estado, i.nombre_snapshot AS producto, i.tipo_unidad, i.cantidad,
           i.precio_unitario, i.subtotal
    FROM venta_items i
    JOIN ventas v ON v.id = i.venta_id
    LEFT JOIN usuarios u ON u.id = v.usuario_id
    WHERE v.creado_en >= datetime(?, '+3 hours') AND v.creado_en < datetime(?, '+1 day', '+3 hours')
    ORDER BY v.id, i.id
  `).all(desde, hasta);

  return {
    nombre: `ventas_detalle_${desde}_${hasta}.csv`,
    contenido: aCsv(
      ['Venta', 'Fecha', 'Vendedor', 'Estado', 'Producto', 'Unidad', 'Cantidad', 'Precio', 'Subtotal'],
      filas.map((f) => [
        f.venta, f.fecha, t(f.vendedor), f.estado === 'ANULADA' ? 'Anulada' : 'Completada',
        t(f.producto), unidad(f.tipo_unidad), cantidadCsv(f.cantidad, f.tipo_unidad),
        pesosCsv(f.precio_unitario), pesosCsv(f.subtotal),
      ]),
    ),
  };
}

export function movimientosCsv(q = {}) {
  const { desde, hasta } = leerRango(q);
  const filas = db.prepare(`
    SELECT datetime(m.creado_en, '-3 hours') AS fecha, p.nombre, p.tipo_unidad, m.tipo, m.motivo,
           m.nota, m.cantidad, m.stock_resultante, u.nombre AS usuario
    FROM movimientos_stock m
    JOIN productos p ON p.id = m.producto_id
    LEFT JOIN usuarios u ON u.id = m.usuario_id
    WHERE m.creado_en >= datetime(?, '+3 hours') AND m.creado_en < datetime(?, '+1 day', '+3 hours')
    ORDER BY m.id
  `).all(desde, hasta);

  return {
    nombre: `movimientos_stock_${desde}_${hasta}.csv`,
    contenido: aCsv(
      ['Fecha', 'Producto', 'Unidad', 'Tipo', 'Motivo', 'Nota', 'Cantidad', 'Stock resultante', 'Usuario'],
      filas.map((f) => [
        f.fecha, t(f.nombre), unidad(f.tipo_unidad), f.tipo, t(f.motivo), t(f.nota),
        cantidadCsv(f.cantidad, f.tipo_unidad), cantidadCsv(f.stock_resultante, f.tipo_unidad), t(f.usuario),
      ]),
    ),
  };
}