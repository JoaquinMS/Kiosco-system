import './env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearUsuario, crearProducto, stockDe, contarVentas, unico } from './ayuda.js';
import * as ventas from '../src/servicios/ventas.js';
import * as reportes from '../src/servicios/reportes.js';
import * as productosServ from '../src/servicios/productos.js';
import * as repoMov from '../src/repositorios/movimientos.js';
import db from '../src/db/conexion.js';

const IP = '127.0.0.1';
const vender = (usuario, items, pagos, extra = {}) =>
  ventas.crear({ client_uuid: unico('uuid-prueba'), items, pagos, ...extra }, usuario, IP);

test('una venta descuenta el stock y deja un movimiento', async () => {
  const emp = await crearUsuario('EMPLEADO');
  const p = crearProducto();
  const v = await vender(emp, [{ producto_id: p.id, cantidad: 2 }], [{ medio: 'EFECTIVO', monto: 300000 }]);

  assert.equal(v.total, 240000);
  assert.equal(v.vuelto, 60000);
  assert.equal(v.pagos[0].monto, 240000);        // se guarda el efectivo SIN el vuelto
  assert.equal(stockDe(p.id), 22);

  const mov = repoMov.listarPorProducto(p.id)[0];
  assert.equal(mov.tipo, 'VENTA');
  assert.equal(mov.cantidad, -2);
  assert.equal(mov.stock_resultante, 22);
});

test('un producto por peso se cobra por kilo', async () => {
  const emp = await crearUsuario('EMPLEADO');
  const p = crearProducto({ tipo_unidad: 'PESO', costo: 1200000, precio_venta: 1800000, stock_actual: 1800, stock_minimo: 1000 });
  const v = await vender(emp, [{ producto_id: p.id, cantidad: 250 }], [{ medio: 'TRANSFERENCIA', monto: 450000 }]);
  assert.equal(v.total, 450000);
  assert.equal(stockDe(p.id), 1550);
});

test('sin stock suficiente se vende igual, con advertencia', async () => {
  const emp = await crearUsuario('EMPLEADO');
  const p = crearProducto({ stock_actual: 1 });
  const v = await vender(emp, [{ producto_id: p.id, cantidad: 3 }], [{ medio: 'TARJETA', monto: 360000 }]);
  assert.equal(stockDe(p.id), -2);
  assert.equal(v.advertencias.length, 1);
});

test('si el pago no alcanza, no queda NADA registrado (transacción)', async () => {
  const emp = await crearUsuario('EMPLEADO');
  const p = crearProducto();
  const antes = contarVentas();
  await assert.rejects(
    () => vender(emp, [{ producto_id: p.id, cantidad: 2 }], [{ medio: 'EFECTIVO', monto: 1000 }]),
    { codigo: 'PAGO_INSUFICIENTE' },
  );
  assert.equal(stockDe(p.id), 24);
  assert.equal(contarVentas(), antes);
});

test('el vuelto solo puede salir del efectivo', async () => {
  const emp = await crearUsuario('EMPLEADO');
  const p = crearProducto();
  await assert.rejects(
    () => vender(emp, [{ producto_id: p.id, cantidad: 2 }], [{ medio: 'TARJETA', monto: 300000 }]),
    { codigo: 'PAGO_EXCEDIDO' },
  );
});

test('repetir el mismo client_uuid no cobra dos veces', async () => {
  const emp = await crearUsuario('EMPLEADO');
  const p = crearProducto();
  const datos = {
    client_uuid: unico('uuid-repetido'),
    items: [{ producto_id: p.id, cantidad: 1 }],
    pagos: [{ medio: 'EFECTIVO', monto: 120000 }],
  };
  const a = await ventas.crear(datos, emp, IP);
  const b = await ventas.crear(datos, emp, IP);
  assert.equal(a.repetida, false);
  assert.equal(b.repetida, true);
  assert.equal(b.id, a.id);
  assert.equal(stockDe(p.id), 23);
});

test('no se vende un producto dado de baja ni uno sin precio', async () => {
  const emp = await crearUsuario('EMPLEADO');
  const baja = crearProducto();
  productosServ.darDeBaja(baja.id);
  await assert.rejects(
    () => vender(emp, [{ producto_id: baja.id, cantidad: 1 }], [{ medio: 'EFECTIVO', monto: 120000 }]),
    { codigo: 'PRODUCTO_DE_BAJA' },
  );
  const sinPrecio = crearProducto({ precio_venta: 0 });
  await assert.rejects(
    () => vender(emp, [{ producto_id: sinPrecio.id, cantidad: 1 }], [{ medio: 'EFECTIVO', monto: 1000 }]),
    { codigo: 'PRECIO_NO_CARGADO' },
  );
});

test('el empleado puede dar hasta 10 %; más necesita un dueño', async () => {
  const emp = await crearUsuario('EMPLEADO');
  const p = crearProducto({ stock_actual: 100 });
  const items = [{ producto_id: p.id, cantidad: 1 }];

  const ok = await vender(emp, items, [{ medio: 'EFECTIVO', monto: 108000 }],
    { descuento: { tipo: 'PORCENTAJE', valor: 1000 } });
  assert.equal(ok.descuento, 12000);
  assert.equal(ok.total, 108000);

  await assert.rejects(
    () => vender(emp, items, [{ medio: 'EFECTIVO', monto: 120000 }],
      { descuento: { tipo: 'PORCENTAJE', valor: 1500 } }),
    { codigo: 'DESCUENTO_REQUIERE_AUTORIZACION' },
  );
  await assert.rejects(  // $200 sobre $1.200 es más del 10 %
    () => vender(emp, items, [{ medio: 'EFECTIVO', monto: 120000 }],
      { descuento: { tipo: 'MONTO', valor: 20000 } }),
    { codigo: 'DESCUENTO_REQUIERE_AUTORIZACION' },
  );
});

test('un dueño autoriza el descuento y queda registrado quién fue', async () => {
  const emp = await crearUsuario('EMPLEADO');
  const dueno = await crearUsuario('DUENO');
  const p = crearProducto({ stock_actual: 100 });
  const items = [{ producto_id: p.id, cantidad: 1 }];

  const v = await vender(emp, items, [{ medio: 'EFECTIVO', monto: 84000 }], {
    descuento: { tipo: 'PORCENTAJE', valor: 3000 },
    autorizacion: { username: dueno.username, password: dueno.clave },
  });
  assert.equal(v.total, 84000);
  const fila = db.prepare('SELECT usuario_id, autorizado_por FROM ventas WHERE id = ?').get(v.id);
  assert.equal(fila.usuario_id, emp.id);
  assert.equal(fila.autorizado_por, dueno.id);

  // Un empleado no puede autorizar a otro empleado.
  const otro = await crearUsuario('EMPLEADO');
  await assert.rejects(
    () => vender(emp, items, [{ medio: 'EFECTIVO', monto: 84000 }], {
      descuento: { tipo: 'PORCENTAJE', valor: 3000 },
      autorizacion: { username: otro.username, password: otro.clave },
    }),
    { codigo: 'AUTORIZACION_INVALIDA' },
  );
});

test('un dueño no necesita autorización para descontar', async () => {
  const dueno = await crearUsuario('DUENO');
  const p = crearProducto({ stock_actual: 100 });
  const v = await vender(dueno, [{ producto_id: p.id, cantidad: 1 }], [{ medio: 'EFECTIVO', monto: 60000 }],
    { descuento: { tipo: 'PORCENTAJE', valor: 5000 } });
  assert.equal(v.total, 60000);
});

test('anular repone el stock, deja de contar en la caja y no se repite', async () => {
  const dueno = await crearUsuario('DUENO');
  const p = crearProducto();
  const antes = reportes.caja({}).total;

  const v = await vender(dueno, [{ producto_id: p.id, cantidad: 5 }], [{ medio: 'EFECTIVO', monto: 600000 }]);
  assert.equal(stockDe(p.id), 19);
  assert.equal(reportes.caja({}).total, antes + 600000);

  const anulada = ventas.anular(v.id, { motivo: 'error de carga' }, dueno);
  assert.equal(anulada.estado, 'ANULADA');
  assert.equal(stockDe(p.id), 24);
  assert.equal(reportes.caja({}).total, antes);
  assert.equal(repoMov.listarPorProducto(p.id)[0].tipo, 'ANULACION_VENTA');

  assert.throws(() => ventas.anular(v.id, { motivo: 'otra vez' }, dueno), { codigo: 'VENTA_YA_ANULADA' });
  assert.throws(() => ventas.anular(v.id, { motivo: 'x' }, dueno), { codigo: 'VALIDACION' });
  assert.equal(stockDe(p.id), 24);
});

test('el historial de stock no se puede modificar ni borrar', () => {
  const p = crearProducto();
  assert.throws(
    () => db.prepare('UPDATE movimientos_stock SET cantidad = 999 WHERE producto_id = ?').run(p.id),
    /solo inserción/,
  );
  assert.throws(
    () => db.prepare('DELETE FROM movimientos_stock WHERE producto_id = ?').run(p.id),
    /solo inserción/,
  );
});

test('el stock de cada producto coincide con la suma de sus movimientos', () => {
  assert.deepEqual(repoMov.verificarConsistencia(), []);
});