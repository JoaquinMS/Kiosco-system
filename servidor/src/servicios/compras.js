// Ingreso de mercadería. Una compra es UNA transacción: se guarda todo o nada.
import { transaccion } from '../db/conexion.js';
import * as repo from '../repositorios/compras.js';
import * as repoProductos from '../repositorios/productos.js';
import * as repoMov from '../repositorios/movimientos.js';
import * as repoLotes from '../repositorios/lotes.js';
import * as repoProveedores from '../repositorios/proveedores.js';
import { ErrorApp } from '../lib/errores.js';
import { subtotalLinea, MAX_MONTO } from '../lib/dinero.js';

const MAX_CANTIDAD = 1_000_000;
const esEnteroPositivo = (n) => Number.isInteger(n) && n > 0;

// Fecha de hoy en Argentina, formato 'AAAA-MM-DD' (el idioma sueco usa ese formato).
const hoyArgentina = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Mendoza' });

function fechaValida(txt) {
  if (typeof txt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(txt)) return false;
  const d = new Date(`${txt}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === txt; // rechaza 30/02
}

// Valida la FORMA de lo que llega. Lo que depende de la base se comprueba en la transacción.
function validar(datos) {
  if (datos === null || typeof datos !== 'object') {
    throw new ErrorApp(400, 'VALIDACION', 'Faltan los datos del ingreso');
  }
  const errores = {};

  const uuid = typeof datos.client_uuid === 'string' ? datos.client_uuid.trim() : '';
  if (uuid.length < 8 || uuid.length > 64) errores.client_uuid = 'Identificador no válido';

  let proveedorId = null;
  if (datos.proveedor_id !== null && datos.proveedor_id !== undefined) {
    if (esEnteroPositivo(datos.proveedor_id)) proveedorId = datos.proveedor_id;
    else errores.proveedor_id = 'Proveedor no válido';
  }

  let nro = null;
  if (datos.nro_comprobante !== null && datos.nro_comprobante !== undefined) {
    nro = String(datos.nro_comprobante).trim();
    if (nro.length > 40) errores.nro_comprobante = 'Hasta 40 caracteres';
    if (nro === '') nro = null;
  }

  let items = [];
  if (!Array.isArray(datos.items) || datos.items.length === 0 || datos.items.length > 200) {
    errores.items = 'El ingreso necesita entre 1 y 200 líneas';
  } else {
    const invalido = datos.items.some((it) =>
      !it || !esEnteroPositivo(it.producto_id)
      || !esEnteroPositivo(it.cantidad) || it.cantidad > MAX_CANTIDAD
      || !Number.isInteger(it.costo_unitario) || it.costo_unitario < 0 || it.costo_unitario > MAX_MONTO
      || (it.fecha_vencimiento != null && !fechaValida(it.fecha_vencimiento)));
    if (invalido) errores.items = 'Hay una línea con producto, cantidad, costo o fecha no válidos';
    else {
      items = datos.items.map((it) => ({
        producto_id: it.producto_id, cantidad: it.cantidad,
        costo_unitario: it.costo_unitario, fecha_vencimiento: it.fecha_vencimiento ?? null,
      }));
    }
  }

  if (Object.keys(errores).length > 0) {
    throw new ErrorApp(400, 'VALIDACION', 'Hay datos que corregir', errores);
  }
  return { client_uuid: uuid, proveedor_id: proveedorId, nro_comprobante: nro, items };
}

// Costo promedio ponderado. Para productos por peso las cantidades están en gramos y el
// costo es por kg, por eso subtotalLinea divide por 1000 y acá se vuelve a multiplicar.
function calcularPromedio(p, cantidad, costoUnitario) {
  if (p.stock_actual <= 0 || p.costo_promedio <= 0) return costoUnitario;
  const divisor = p.tipo_unidad === 'PESO' ? 1000 : 1;
  const valorActual = subtotalLinea(p.costo_promedio, p.stock_actual, p.tipo_unidad);
  const valorNuevo = subtotalLinea(costoUnitario, cantidad, p.tipo_unidad);
  return Math.round(((valorActual + valorNuevo) * divisor) / (p.stock_actual + cantidad));
}

function armarCompra(id) {
  return { ...repo.buscarPorId(id), items: repo.itemsDe(id) };
}

export function crear(datos) {
  const v = validar(datos);

  return transaccion(() => {
    // 0) ¿Ya registramos este ingreso? Se devuelve el mismo, sin tocar nada.
    const previa = repo.buscarPorUuid(v.client_uuid);
    if (previa) return { ...armarCompra(previa.id), repetida: true, sugerencias: [] };

    if (v.proveedor_id !== null && !repoProveedores.buscarPorId(v.proveedor_id)) {
      throw new ErrorApp(400, 'VALIDACION', 'Hay datos que corregir', { proveedor_id: 'El proveedor no existe' });
    }

    // 1) Revisar cada línea contra la base y calcular subtotales.
    const hoy = hoyArgentina();
    const lineas = [];
    for (const it of v.items) {
      const p = repoProductos.buscarPorId(it.producto_id);
      if (!p) throw new ErrorApp(404, 'PRODUCTO_NO_ENCONTRADO', `El producto #${it.producto_id} no existe`);
      if (!p.activo) throw new ErrorApp(409, 'PRODUCTO_DE_BAJA', `"${p.nombre}" está dado de baja`);

      let fecha = null;
      if (p.controla_vencimiento) {
        if (!it.fecha_vencimiento) {
          throw new ErrorApp(400, 'VALIDACION', 'Hay datos que corregir', {
            items: `"${p.nombre}" necesita fecha de vencimiento`,
          });
        }
        if (it.fecha_vencimiento < hoy) { // las fechas 'AAAA-MM-DD' se comparan como texto
          throw new ErrorApp(400, 'VALIDACION', 'Hay datos que corregir', {
            items: `La fecha de vencimiento de "${p.nombre}" ya pasó`,
          });
        }
        fecha = it.fecha_vencimiento;
      }

      const subtotal = subtotalLinea(it.costo_unitario, it.cantidad, p.tipo_unidad);
      if (subtotal > MAX_MONTO) throw new ErrorApp(400, 'MONTO_EXCESIVO', 'El monto de una línea es demasiado grande');
      lineas.push({ productoId: p.id, cantidad: it.cantidad, costo: it.costo_unitario, fecha, subtotal });
    }
    const total = lineas.reduce((suma, l) => suma + l.subtotal, 0);
    if (total > MAX_MONTO) throw new ErrorApp(400, 'MONTO_EXCESIVO', 'El total del ingreso es demasiado grande');

    // 2) Guardar: compra, ítems, stock, costos, movimiento y lote.
    const compraId = repo.insertarCompra({
      client_uuid: v.client_uuid, proveedor_id: v.proveedor_id,
      nro_comprobante: v.nro_comprobante, total,
    });

    const cambios = new Map(); // producto -> costo anterior y nuevo (para sugerir precio)
    for (const l of lineas) {
      // Se vuelve a leer el producto: si viene dos veces, la 2ª línea ve el stock de la 1ª.
      const p = repoProductos.buscarPorId(l.productoId);
      const promedio = calcularPromedio(p, l.cantidad, l.costo);
      const itemId = repo.insertarItem(compraId, {
        producto_id: p.id, cantidad: l.cantidad, costo_unitario: l.costo,
        fecha_vencimiento: l.fecha, subtotal: l.subtotal,
      });
      repoProductos.aplicarCompra(p.id, l.cantidad, l.costo, promedio);
      repoMov.registrar({
        productoId: p.id, tipo: 'COMPRA', cantidad: l.cantidad,
        stockResultante: p.stock_actual + l.cantidad, refTipo: 'COMPRA', refId: compraId,
      });
      if (p.controla_vencimiento) {
        repoLotes.crear({ productoId: p.id, compraItemId: itemId, fecha: l.fecha, cantidad: l.cantidad });
      }
      const previo = cambios.get(p.id);
      if (previo) previo.costo_nuevo = l.costo;
      else cambios.set(p.id, { producto_id: p.id, costo_anterior: p.costo, costo_nuevo: l.costo });
    }

    // 3) Sugerencias de precio: mantienen el margen, redondeado a $10 (1000 centavos).
    const sugerencias = [];
    for (const c of cambios.values()) {
      const p = repoProductos.buscarPorId(c.producto_id);
      if (c.costo_anterior <= 0 || c.costo_nuevo === c.costo_anterior || p.precio_venta <= 0) continue;
      const sugerido = Math.round((p.precio_venta * c.costo_nuevo) / c.costo_anterior / 1000) * 1000;
      if (sugerido <= 0 || sugerido === p.precio_venta) continue;
      sugerencias.push({
        producto_id: p.id, nombre: p.nombre, tipo_unidad: p.tipo_unidad,
        costo_anterior: c.costo_anterior, costo_nuevo: c.costo_nuevo,
        precio_actual: p.precio_venta, precio_sugerido: sugerido,
      });
    }

    return { ...armarCompra(compraId), repetida: false, sugerencias };
  });
}

export function listar(query = {}) {
  const limite = Math.min(Math.max(parseInt(query.limite, 10) || 20, 1), 200);
  return repo.listarRecientes(limite);
}

export function obtener(idCrudo) {
  const id = Number(idCrudo);
  if (!Number.isInteger(id) || id <= 0) throw new ErrorApp(400, 'ID_INVALIDO', 'El identificador no es válido');
  if (!repo.buscarPorId(id)) throw new ErrorApp(404, 'COMPRA_NO_ENCONTRADA', 'La compra no existe');
  return armarCompra(id);
}