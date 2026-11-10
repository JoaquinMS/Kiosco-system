// Reglas de negocio de ventas. Una venta es UNA transacción: se guarda todo o nada.
import { transaccion } from '../db/conexion.js';
import * as repo from '../repositorios/ventas.js';
import * as repoProductos from '../repositorios/productos.js';
import * as repoMov from '../repositorios/movimientos.js';
import { ErrorApp } from '../lib/errores.js';
import { subtotalLinea, calcularDescuento, MAX_MONTO } from '../lib/dinero.js';
import { PERMITIR_STOCK_NEGATIVO } from '../config.js';
import * as repoLotes from '../repositorios/lotes.js';

const MEDIOS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'];
const MAX_CANTIDAD = 1_000_000; // 1.000.000 de unidades, o 1000 kg

const esEnteroPositivo = (n) => Number.isInteger(n) && n > 0;

// Valida la FORMA de lo que llega (tipos y rangos). Las reglas que dependen de la base
// (¿existe el producto?, ¿alcanza el pago?) se comprueban después, dentro de la transacción.
function validar(datos) {
  if (datos === null || typeof datos !== 'object') {
    throw new ErrorApp(400, 'VALIDACION', 'Faltan los datos de la venta');
  }
  const errores = {};

  const uuid = typeof datos.client_uuid === 'string' ? datos.client_uuid.trim() : '';
  if (uuid.length < 8 || uuid.length > 64) errores.client_uuid = 'Identificador de venta no válido';

  // Items: si el mismo producto viene dos veces, se suman las cantidades.
  let items = [];
  if (!Array.isArray(datos.items) || datos.items.length === 0 || datos.items.length > 100) {
    errores.items = 'La venta necesita entre 1 y 100 productos';
  } else {
    const fusion = new Map();
    for (const it of datos.items) {
      if (!it || !esEnteroPositivo(it.producto_id) || !esEnteroPositivo(it.cantidad)) {
        errores.items = 'Hay un producto con datos o cantidad no válidos';
        break;
      }
      fusion.set(it.producto_id, (fusion.get(it.producto_id) ?? 0) + it.cantidad);
    }
    items = [...fusion].map(([producto_id, cantidad]) => ({ producto_id, cantidad }));
    if (items.some((i) => i.cantidad > MAX_CANTIDAD)) errores.items = 'Una cantidad es demasiado grande';
  }

  // Descuento (opcional)
  let descuento = null;
  if (datos.descuento !== null && datos.descuento !== undefined) {
    const d = datos.descuento;
    const tipoOk = d && (d.tipo === 'PORCENTAJE' || d.tipo === 'MONTO');
    const max = d?.tipo === 'PORCENTAJE' ? 10000 : MAX_MONTO;
    if (!tipoOk || !Number.isInteger(d.valor) || d.valor < 0 || d.valor > max) {
      errores.descuento = 'El descuento no es válido';
    } else if (d.valor > 0) {
      descuento = { tipo: d.tipo, valor: d.valor };
    }
  }

  // Pagos: lo que entrega el cliente por cada medio (puede superar el total, por el vuelto).
  let pagos = [];
  if (!Array.isArray(datos.pagos) || datos.pagos.length === 0 || datos.pagos.length > 3) {
    errores.pagos = 'Indicá cómo se paga (hasta 3 medios)';
  } else if (datos.pagos.some((p) => !p || !MEDIOS.includes(p.medio) || !esEnteroPositivo(p.monto) || p.monto > MAX_MONTO)) {
    errores.pagos = 'Hay un pago con medio o monto no válido';
  } else if (new Set(datos.pagos.map((p) => p.medio)).size !== datos.pagos.length) {
    errores.pagos = 'No repitas el mismo medio de pago';
  } else {
    pagos = datos.pagos.map((p) => ({ medio: p.medio, monto: p.monto }));
  }

  if (Object.keys(errores).length > 0) {
    throw new ErrorApp(400, 'VALIDACION', 'Hay datos que corregir', errores);
  }
  return { client_uuid: uuid, items, descuento, pagos };
}

function armarVenta(id) {
  return { ...repo.buscarPorId(id), items: repo.itemsDe(id), pagos: repo.pagosDe(id) };
}

export function crear(datos) {
  const v = validar(datos);

  return transaccion(() => {
    // 0) ¿Ya registramos esta venta? Se devuelve la misma, sin tocar nada.
    const previa = repo.buscarPorUuid(v.client_uuid);
    if (previa) return { ...armarVenta(previa.id), repetida: true, advertencias: [] };

    // 1) Armar las líneas con los datos REALES de la base (nunca los del navegador).
    const lineas = [];
    for (const it of v.items) {
      const p = repoProductos.buscarPorId(it.producto_id);
      if (!p) throw new ErrorApp(404, 'PRODUCTO_NO_ENCONTRADO', `El producto #${it.producto_id} no existe`);
      if (!p.activo) throw new ErrorApp(409, 'PRODUCTO_DE_BAJA', `"${p.nombre}" está dado de baja`);
      if (p.precio_venta <= 0) throw new ErrorApp(409, 'PRECIO_NO_CARGADO', `"${p.nombre}" no tiene precio cargado`);

      const stockNuevo = p.stock_actual - it.cantidad;
      if (stockNuevo < 0 && !PERMITIR_STOCK_NEGATIVO) {
        throw new ErrorApp(409, 'STOCK_INSUFICIENTE', `No hay stock suficiente de "${p.nombre}"`, {
          producto_id: p.id, stock_actual: p.stock_actual, pedido: it.cantidad,
        });
      }

      const subtotal = subtotalLinea(p.precio_venta, it.cantidad, p.tipo_unidad);
      if (subtotal > MAX_MONTO) throw new ErrorApp(400, 'MONTO_EXCESIVO', 'El monto de una línea es demasiado grande');
      lineas.push({ producto: p, cantidad: it.cantidad, subtotal, stockNuevo });
    }

    // 2) Totales
    const subtotal = lineas.reduce((suma, l) => suma + l.subtotal, 0);
    if (subtotal > MAX_MONTO) throw new ErrorApp(400, 'MONTO_EXCESIVO', 'El total de la venta es demasiado grande');
    const descuento = calcularDescuento(subtotal, v.descuento);
    if (descuento > subtotal) {
      throw new ErrorApp(400, 'VALIDACION', 'Hay datos que corregir', {
        descuento: 'El descuento no puede superar el subtotal',
      });
    }
    const total = subtotal - descuento;
    if (total <= 0) throw new ErrorApp(400, 'TOTAL_INVALIDO', 'La venta no puede quedar en $ 0');

    // 3) Pagos: tienen que cubrir el total. El vuelto solo puede salir del efectivo.
    const recibido = v.pagos.reduce((suma, p) => suma + p.monto, 0);
    if (recibido < total) {
      throw new ErrorApp(400, 'PAGO_INSUFICIENTE', 'El pago no alcanza para cubrir el total', {
        faltan: total - recibido,
      });
    }
    const vuelto = recibido - total;
    const efectivo = v.pagos.find((p) => p.medio === 'EFECTIVO')?.monto ?? 0;
    if (vuelto > efectivo) {
      throw new ErrorApp(400, 'PAGO_EXCEDIDO', 'El vuelto no puede ser mayor al efectivo recibido');
    }
    // Se guarda lo que realmente se aplicó a la venta (el efectivo, sin el vuelto).
    const pagosAplicados = v.pagos
      .map((p) => (p.medio === 'EFECTIVO' ? { ...p, monto: p.monto - vuelto } : p))
      .filter((p) => p.monto > 0);

    // 4) Guardar: venta, ítems, descuento de stock y su movimiento.
    const ventaId = repo.insertarVenta({
      client_uuid: v.client_uuid, subtotal, descuento, total, vuelto,
    });

    const advertencias = [];
    for (const l of lineas) {
      const p = l.producto;
      repo.insertarItem(ventaId, {
        producto_id: p.id, nombre: p.nombre, tipo_unidad: p.tipo_unidad, cantidad: l.cantidad,
        precio_unitario: p.precio_venta, costo_unitario: p.costo, subtotal: l.subtotal,
      });
      repoProductos.cambiarStock(p.id, -l.cantidad);
      if (p.controla_vencimiento) repoLotes.consumirFEFO(p.id, l.cantidad);
      repoMov.registrar({
        productoId: p.id, tipo: 'VENTA', cantidad: -l.cantidad,
        stockResultante: l.stockNuevo, refTipo: 'VENTA', refId: ventaId,
      });
      if (l.stockNuevo < 0) {
        advertencias.push({
          producto_id: p.id, nombre: p.nombre, tipo_unidad: p.tipo_unidad, stock_resultante: l.stockNuevo,
        });
      }
    }
    for (const pago of pagosAplicados) repo.insertarPago(ventaId, pago.medio, pago.monto);

    return { ...armarVenta(ventaId), repetida: false, advertencias };
  });
}

export function listar(query = {}) {
  const limite = Math.min(Math.max(parseInt(query.limite, 10) || 20, 1), 200);
  return repo.listarRecientes(limite);
}

export function obtener(idCrudo) {
  const id = Number(idCrudo);
  if (!Number.isInteger(id) || id <= 0) throw new ErrorApp(400, 'ID_INVALIDO', 'El identificador no es válido');
  if (!repo.buscarPorId(id)) throw new ErrorApp(404, 'VENTA_NO_ENCONTRADA', 'La venta no existe');
  return armarVenta(id);
}