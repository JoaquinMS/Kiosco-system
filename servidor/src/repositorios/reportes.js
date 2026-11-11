// Consultas SQL de reportes. Las fechas llegan como 'AAAA-MM-DD' en hora argentina
// y se convierten a límites UTC: [desde 03:00, día siguiente a "hasta" 03:00).
import db from '../db/conexion.js';

const COLUMNAS_COSTO = new Set(['costo_unitario', 'costo_promedio_unitario']);

// Cómo se agrupa el día local (columna "dia"). La semana empieza el lunes.
const PERIODOS = {
  dia: 'dia',
  semana: "date(dia, 'weekday 0', '-6 days')",
  mes: "strftime('%Y-%m', dia)",
};

// Se usa con dos parámetros: (desde, hasta).
const ENTRE = `v.creado_en >= datetime(?, '+3 hours')
               AND v.creado_en < datetime(?, '+1 day', '+3 hours')`;

// Costo de una línea. PESO: costo por kg x gramos / 1000. "columna" viene de una lista
// cerrada (se valida acá), nunca directamente del usuario.
function costoLinea(columna) {
  if (!COLUMNAS_COSTO.has(columna)) throw new Error('Columna de costo no válida');
  return `CAST(ROUND(i.${columna} * i.cantidad /
          CASE i.tipo_unidad WHEN 'PESO' THEN 1000.0 ELSE 1.0 END) AS INTEGER)`;
}

export function ventasPorPeriodo({ desde, hasta, agrupar, columna }) {
  const periodo = PERIODOS[agrupar];
  if (!periodo) throw new Error('Agrupación no válida');
  return db.prepare(`
    WITH base AS (
      SELECT v.total, v.descuento, date(v.creado_en, '-3 hours') AS dia,
             COALESCE((SELECT SUM(${costoLinea(columna)})
                       FROM venta_items i WHERE i.venta_id = v.id), 0) AS costo_total
      FROM ventas v
      WHERE v.estado = 'COMPLETADA' AND ${ENTRE}
    )
    SELECT ${periodo} AS periodo,
           COUNT(*) AS tickets,
           SUM(total) AS ventas,
           SUM(descuento) AS descuentos,
           SUM(costo_total) AS costo,
           SUM(total - costo_total) AS ganancia
    FROM base
    GROUP BY periodo
    ORDER BY periodo
  `).all(desde, hasta);
}

// Líneas vendidas sin costo cargado (distorsionan la ganancia).
export function itemsSinCosto({ desde, hasta, columna }) {
  if (!COLUMNAS_COSTO.has(columna)) throw new Error('Columna de costo no válida');
  return db.prepare(`
    SELECT COUNT(*) AS n
    FROM venta_items i JOIN ventas v ON v.id = i.venta_id
    WHERE v.estado = 'COMPLETADA' AND ${ENTRE} AND i.${columna} = 0
  `).get(desde, hasta).n;
}

const ORDENES = { ingresos: 'ingresos', cantidad: 'cantidad', ganancia: 'ganancia' };

// "ganancia" de un producto = ingresos de sus líneas - costo. No incluye el descuento
// global de la venta (que es de todo el ticket, no de un producto).
export function masVendidos({ desde, hasta, columna, orden, limite }) {
  const campo = ORDENES[orden];
  if (!campo) throw new Error('Orden no válido');
  return db.prepare(`
    SELECT *, (ingresos - costo) AS ganancia FROM (
      SELECT p.id AS producto_id, p.nombre, p.tipo_unidad,
             SUM(i.cantidad) AS cantidad,
             SUM(i.subtotal) AS ingresos,
             SUM(${costoLinea(columna)}) AS costo
      FROM venta_items i
      JOIN ventas v ON v.id = i.venta_id
      JOIN productos p ON p.id = i.producto_id
      WHERE v.estado = 'COMPLETADA' AND ${ENTRE}
      GROUP BY p.id
    )
    ORDER BY ${campo} DESC, nombre
    LIMIT ?
  `).all(desde, hasta, limite);
}

// Caja de UN día local.
export function caja(fecha) {
  const resumen = db.prepare(`
    SELECT COUNT(*) AS tickets,
           COALESCE(SUM(v.total), 0) AS total,
           COALESCE(SUM(v.descuento), 0) AS descuentos,
           COALESCE(SUM(v.vuelto), 0) AS vuelto
    FROM ventas v
    WHERE v.estado = 'COMPLETADA' AND ${ENTRE}
  `).get(fecha, fecha);

  const medios = db.prepare(`
    SELECT pg.medio, SUM(pg.monto) AS monto
    FROM venta_pagos pg JOIN ventas v ON v.id = pg.venta_id
    WHERE v.estado = 'COMPLETADA' AND ${ENTRE}
    GROUP BY pg.medio
  `).all(fecha, fecha);

  const ventas = db.prepare(`
    SELECT v.id, v.creado_en, v.total,
           (SELECT group_concat(medio, ', ') FROM venta_pagos WHERE venta_id = v.id) AS medios
    FROM ventas v
    WHERE v.estado = 'COMPLETADA' AND ${ENTRE}
    ORDER BY v.id DESC
  `).all(fecha, fecha);

  return { resumen, medios, ventas };
}