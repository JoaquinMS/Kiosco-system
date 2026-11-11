// Valida los parámetros de los reportes y arma las respuestas (JSON y CSV).
import * as repo from '../repositorios/reportes.js';
import { ErrorApp } from '../lib/errores.js';
import { hoyArgentina, fechaValida, sumarDias, diasEntre } from '../lib/fechas.js';
import { aCsv, pesosCsv, cantidadCsv, textoSeguro } from '../lib/csv.js';

const AGRUPACIONES = ['dia', 'semana', 'mes'];
const ORDENES = ['ingresos', 'cantidad', 'ganancia'];
const MAX_DIAS = 800;

function fallar(campo, mensaje) {
  throw new ErrorApp(400, 'VALIDACION', 'Hay datos que corregir', { [campo]: mensaje });
}

function leerRango(q) {
  const hasta = q.hasta ?? hoyArgentina();
  const desde = q.desde ?? sumarDias(hasta, -6);
  if (!fechaValida(desde)) fallar('desde', 'La fecha "desde" no es válida');
  if (!fechaValida(hasta)) fallar('hasta', 'La fecha "hasta" no es válida');
  if (desde > hasta) fallar('desde', 'La fecha "desde" no puede ser posterior a "hasta"');
  if (diasEntre(desde, hasta) > MAX_DIAS) fallar('hasta', `El rango no puede superar ${MAX_DIAS} días`);
  return { desde, hasta };
}

function leerCosto(q) {
  const tipo = q.costo ?? 'ultimo';
  if (tipo !== 'ultimo' && tipo !== 'promedio') fallar('costo', 'El costo debe ser "ultimo" o "promedio"');
  return {
    tipo,
    columna: tipo === 'promedio' ? 'costo_promedio_unitario' : 'costo_unitario',
  };
}

export function ventas(q = {}) {
  const { desde, hasta } = leerRango(q);
  const agrupar = q.agrupar ?? 'dia';
  if (!AGRUPACIONES.includes(agrupar)) fallar('agrupar', 'Agrupá por dia, semana o mes');
  const costo = leerCosto(q);

  const filas = repo.ventasPorPeriodo({ desde, hasta, agrupar, columna: costo.columna });
  const totales = filas.reduce(
    (t, f) => ({
      tickets: t.tickets + f.tickets,
      ventas: t.ventas + f.ventas,
      descuentos: t.descuentos + f.descuentos,
      costo: t.costo + f.costo,
      ganancia: t.ganancia + f.ganancia,
    }),
    { tickets: 0, ventas: 0, descuentos: 0, costo: 0, ganancia: 0 },
  );
  totales.ticket_promedio = totales.tickets > 0 ? Math.round(totales.ventas / totales.tickets) : 0;
  totales.items_sin_costo = repo.itemsSinCosto({ desde, hasta, columna: costo.columna });

  return { desde, hasta, agrupar, costo: costo.tipo, filas, totales };
}

export function masVendidos(q = {}) {
  const { desde, hasta } = leerRango(q);
  const costo = leerCosto(q);
  const orden = q.orden ?? 'ingresos';
  if (!ORDENES.includes(orden)) fallar('orden', 'Ordená por ingresos, cantidad o ganancia');
  const limite = Math.min(Math.max(parseInt(q.limite, 10) || 20, 1), 200);

  const filas = repo.masVendidos({ desde, hasta, columna: costo.columna, orden, limite });
  return { desde, hasta, orden, costo: costo.tipo, filas };
}

export function caja(q = {}) {
  const fecha = q.fecha ?? hoyArgentina();
  if (!fechaValida(fecha)) fallar('fecha', 'La fecha no es válida');

  const { resumen, medios, ventas: lista } = repo.caja(fecha);
  const porMedio = { EFECTIVO: 0, TRANSFERENCIA: 0, TARJETA: 0 };
  for (const m of medios) porMedio[m.medio] = m.monto;

  return {
    fecha,
    tickets: resumen.tickets,
    total: resumen.total,
    descuentos: resumen.descuentos,
    vuelto: resumen.vuelto,
    por_medio: porMedio, // el efectivo ya viene SIN el vuelto
    ventas: lista,
  };
}

// ---------- CSV ----------
export function ventasCsv(q = {}) {
  const d = ventas(q);
  const etiqueta = d.costo === 'promedio' ? 'promedio' : 'último';
  const contenido = aCsv(
    ['Período', 'Tickets', 'Ventas', 'Descuentos', `Costo (${etiqueta})`, 'Ganancia'],
    d.filas.map((f) => [
      f.periodo, f.tickets, pesosCsv(f.ventas), pesosCsv(f.descuentos), pesosCsv(f.costo), pesosCsv(f.ganancia),
    ]),
  );
  return { nombre: `ventas_${d.agrupar}_${d.desde}_${d.hasta}.csv`, contenido };
}

export function masVendidosCsv(q = {}) {
  const d = masVendidos(q);
  const etiqueta = d.costo === 'promedio' ? 'promedio' : 'último';
  const contenido = aCsv(
    ['Producto', 'Unidad', 'Cantidad', 'Ingresos', `Costo (${etiqueta})`, 'Ganancia'],
    d.filas.map((f) => [
      textoSeguro(f.nombre), f.tipo_unidad === 'PESO' ? 'kg' : 'u',
      cantidadCsv(f.cantidad, f.tipo_unidad),
      pesosCsv(f.ingresos), pesosCsv(f.costo), pesosCsv(f.ganancia),
    ]),
  );
  return { nombre: `mas_vendidos_${d.desde}_${d.hasta}.csv`, contenido };
}