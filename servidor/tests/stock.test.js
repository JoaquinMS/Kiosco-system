import './env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { crearUsuario, crearProducto, stockDe, unico } from './ayuda.js';
import * as compras from '../src/servicios/compras.js';
import * as ajustes from '../src/servicios/ajustes.js';
import * as ventas from '../src/servicios/ventas.js';
import * as productosServ from '../src/servicios/productos.js';
import * as respaldos from '../src/servicios/respaldos.js';
import * as repoMov from '../src/repositorios/movimientos.js';
import * as repoLotes from '../src/repositorios/lotes.js';

const comprar = (usuario, items) => compras.crear({ client_uuid: unico('compra'), items }, usuario);

test('un ingreso suma stock y calcula el costo promedio ponderado', async () => {
  const dueno = await crearUsuario('DUENO');
  const p = crearProducto();                                   // 24 u. a $800
  const c = comprar(dueno, [{ producto_id: p.id, cantidad: 24, costo_unitario: 100000 }]); // 24 u. a $1.000
  assert.equal(c.total, 2400000);

  const despues = productosServ.obtener(p.id);
  assert.equal(despues.stock_actual, 48);
  assert.equal(despues.costo, 100000);                         // último costo
  assert.equal(despues.costo_promedio, 90000);                 // (24x800 + 24x1000) / 48 = $900
  assert.equal(c.sugerencias[0].precio_sugerido, 150000);      // mantiene el margen: $1.200 -> $1.500
});

test('el costo promedio también funciona en productos por peso', async () => {
  const dueno = await crearUsuario('DUENO');
  const p = crearProducto({ tipo_unidad: 'PESO', costo: 1000000, precio_venta: 1800000, stock_actual: 1000, stock_minimo: 500 });
  comprar(dueno, [{ producto_id: p.id, cantidad: 1000, costo_unitario: 1400000 }]);       // 1 kg a $14.000/kg
  assert.equal(productosServ.obtener(p.id).costo_promedio, 1200000);                       // $12.000/kg
});

test('repetir el mismo ingreso no suma el stock dos veces', async () => {
  const dueno = await crearUsuario('DUENO');
  const p = crearProducto();
  const datos = {
    client_uuid: unico('compra-repetida'),
    items: [{ producto_id: p.id, cantidad: 10, costo_unitario: 80000 }],
  };
  const a = compras.crear(datos, dueno);
  const b = compras.crear(datos, dueno);
  assert.equal(b.repetida, true);
  assert.equal(b.id, a.id);
  assert.equal(stockDe(p.id), 34);
});

test('un producto que vence exige una fecha futura', async () => {
  const dueno = await crearUsuario('DUENO');
  const p = crearProducto({ controla_vencimiento: true });
  assert.throws(
    () => comprar(dueno, [{ producto_id: p.id, cantidad: 5, costo_unitario: 80000 }]),
    { codigo: 'VALIDACION' },
  );
  assert.throws(
    () => comprar(dueno, [{ producto_id: p.id, cantidad: 5, costo_unitario: 80000, fecha_vencimiento: '2020-01-01' }]),
    { codigo: 'VALIDACION' },
  );
});

test('FEFO: se vende primero del lote que vence antes', async () => {
  const dueno = await crearUsuario('DUENO');
  const p = crearProducto({ controla_vencimiento: true, stock_actual: 0 });
  comprar(dueno, [{ producto_id: p.id, cantidad: 10, costo_unitario: 80000, fecha_vencimiento: '2099-06-01' }]);
  comprar(dueno, [{ producto_id: p.id, cantidad: 10, costo_unitario: 80000, fecha_vencimiento: '2099-01-01' }]);

  await ventas.crear({
    client_uuid: unico('uuid-fefo'),
    items: [{ producto_id: p.id, cantidad: 12 }],
    pagos: [{ medio: 'EFECTIVO', monto: 1440000 }],
  }, dueno, '127.0.0.1');

  const lotes = repoLotes.listarActivos(p.id);
  assert.equal(lotes.length, 1);                               // el lote más cercano se agotó
  assert.equal(lotes[0].fecha_vencimiento, '2099-06-01');
  assert.equal(lotes[0].cantidad_restante, 8);
  assert.equal(stockDe(p.id), 8);
  assert.deepEqual(repoLotes.verificarConsistencia(), []);
});

test('un ajuste por rotura baja el stock y queda con motivo', async () => {
  const dueno = await crearUsuario('DUENO');
  const p = crearProducto();
  ajustes.crear({ producto_id: p.id, motivo: 'ROTURA', cantidad: 2, nota: 'se cayó' }, dueno);
  assert.equal(stockDe(p.id), 22);
  const mov = repoMov.listarPorProducto(p.id)[0];
  assert.equal(mov.tipo, 'AJUSTE');
  assert.equal(mov.motivo, 'ROTURA');
  assert.equal(mov.cantidad, -2);
});

test('no se puede dar de baja más de lo que hay', async () => {
  const dueno = await crearUsuario('DUENO');
  const p = crearProducto();
  assert.throws(
    () => ajustes.crear({ producto_id: p.id, motivo: 'MERMA', cantidad: 50 }, dueno),
    { codigo: 'STOCK_INSUFICIENTE' },
  );
  assert.equal(stockDe(p.id), 24);
});

test('el conteo físico calcula la diferencia contra el stock actual', async () => {
  const dueno = await crearUsuario('DUENO');
  const p = crearProducto();
  ajustes.crear({ producto_id: p.id, motivo: 'CONTEO', stock_real: 10 }, dueno);
  assert.equal(stockDe(p.id), 10);
  assert.equal(repoMov.listarPorProducto(p.id)[0].cantidad, -14);
  assert.throws(
    () => ajustes.crear({ producto_id: p.id, motivo: 'CONTEO', stock_real: 10 }, dueno),
    { codigo: 'SIN_CAMBIOS' },
  );
  ajustes.crear({ producto_id: p.id, motivo: 'CONTEO', stock_real: 30 }, dueno);
  assert.equal(stockDe(p.id), 30);
  assert.deepEqual(repoMov.verificarConsistencia(), []);
});

test('el respaldo es una copia válida de la base', () => {
  const p = crearProducto();
  const r = respaldos.crearRespaldo();
  assert.match(r.nombre, /^kiosco-\d{4}-\d{2}-\d{2}_\d{6}\.db$/);

  const copia = new DatabaseSync(respaldos.rutaRespaldo(r.nombre));
  const fila = copia.prepare('SELECT nombre FROM productos WHERE id = ?').get(p.id);
  copia.close();
  assert.equal(fila.nombre, p.nombre);
  assert.ok(respaldos.listarRespaldos().some((x) => x.nombre === r.nombre));
});

test('no se aceptan nombres de respaldo peligrosos', () => {
  assert.throws(() => respaldos.rutaRespaldo('../../datos/kiosco.db'), { codigo: 'NOMBRE_INVALIDO' });
  assert.throws(() => respaldos.rutaRespaldo('kiosco-2020-01-01_000000.db.exe'), { codigo: 'NOMBRE_INVALIDO' });
});