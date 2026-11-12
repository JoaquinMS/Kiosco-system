// Ajustes manuales de stock. Nunca se edita el stock: se registra un movimiento con motivo.
import { transaccion } from '../db/conexion.js';
import * as repoProductos from '../repositorios/productos.js';
import * as repoMov from '../repositorios/movimientos.js';
import * as repoLotes from '../repositorios/lotes.js';
import { ErrorApp } from '../lib/errores.js';

const MOTIVOS_SALIDA = ['ROTURA', 'MERMA', 'VENCIMIENTO', 'ROBO', 'CONSUMO_PROPIO'];
const MOTIVOS = [...MOTIVOS_SALIDA, 'CONTEO'];
const MAX_CANTIDAD = 1_000_000;

function validar(datos) {
  if (datos === null || typeof datos !== 'object') {
    throw new ErrorApp(400, 'VALIDACION', 'Faltan los datos del ajuste');
  }
  const errores = {};

  if (!Number.isInteger(datos.producto_id) || datos.producto_id <= 0) errores.producto_id = 'Producto no válido';
  if (!MOTIVOS.includes(datos.motivo)) errores.motivo = 'Elegí un motivo';

  let nota = null;
  if (datos.nota !== null && datos.nota !== undefined) {
    nota = String(datos.nota).trim();
    if (nota.length > 200) errores.nota = 'Hasta 200 caracteres';
    if (nota === '') nota = null;
  }

  // CONTEO trae el stock real contado. Los demás motivos traen la cantidad que SALE.
  let valor = 0;
  if (datos.motivo === 'CONTEO') {
    valor = datos.stock_real;
    if (!Number.isInteger(valor) || valor < 0 || valor > MAX_CANTIDAD * 10) errores.stock_real = 'El stock contado no es válido';
  } else {
    valor = datos.cantidad;
    if (!Number.isInteger(valor) || valor <= 0 || valor > MAX_CANTIDAD * 10) errores.cantidad = 'La cantidad no es válida';
  }

  if (Object.keys(errores).length > 0) {
    throw new ErrorApp(400, 'VALIDACION', 'Hay datos que corregir', errores);
  }
  return { producto_id: datos.producto_id, motivo: datos.motivo, nota, valor };
}

export function crear(datos, usuario) {
  const v = validar(datos);

  return transaccion(() => {
    const p = repoProductos.buscarPorId(v.producto_id);
    if (!p) throw new ErrorApp(404, 'PRODUCTO_NO_ENCONTRADO', 'El producto no existe');

    let delta;
    if (v.motivo === 'CONTEO') {
      delta = v.valor - p.stock_actual; // la diferencia se calcula ACÁ, con el stock actual real
      if (delta === 0) {
        throw new ErrorApp(409, 'SIN_CAMBIOS', 'El stock contado coincide con el del sistema: no hay nada que ajustar');
      }
    } else {
      if (v.valor > p.stock_actual) {
        throw new ErrorApp(409, 'STOCK_INSUFICIENTE',
          'No podés dar de baja más de lo que el sistema tiene. Si el stock está mal, usá "Conteo físico".',
          { stock_actual: p.stock_actual, pedido: v.valor });
      }
      delta = -v.valor;
    }

    const stockNuevo = p.stock_actual + delta;
    repoProductos.cambiarStock(p.id, delta);
    if (delta < 0 && p.controla_vencimiento) repoLotes.consumirFEFO(p.id, -delta);
    repoMov.registrar({
      productoId: p.id, tipo: 'AJUSTE', cantidad: delta, stockResultante: stockNuevo, usuarioId: usuario.id,
      motivo: v.motivo, nota: v.nota,
    });

    return { producto: repoProductos.buscarPorId(p.id), delta };
  });
}