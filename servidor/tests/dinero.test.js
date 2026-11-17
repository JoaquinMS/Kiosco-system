import './env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { subtotalLinea, calcularDescuento } from '../src/lib/dinero.js';
import { aCsv, pesosCsv, cantidadCsv, textoSeguro } from '../src/lib/csv.js';

test('subtotal de un producto por unidad', () => {
  assert.equal(subtotalLinea(120000, 3, 'UNIDAD'), 360000);
});

test('subtotal de un producto por peso: precio por kg x gramos / 1000', () => {
  assert.equal(subtotalLinea(1800000, 250, 'PESO'), 450000);   // 250 g a $18.000/kg = $4.500
  assert.equal(subtotalLinea(1800000, 1, 'PESO'), 1800);       // 1 g, redondeado al centavo
});

test('descuentos por porcentaje y por monto', () => {
  assert.equal(calcularDescuento(100000, { tipo: 'PORCENTAJE', valor: 1000 }), 10000); // 10 %
  assert.equal(calcularDescuento(100000, { tipo: 'PORCENTAJE', valor: 1250 }), 12500); // 12,5 %
  assert.equal(calcularDescuento(100000, { tipo: 'MONTO', valor: 5000 }), 5000);
  assert.equal(calcularDescuento(100000, null), 0);
});

test('CSV: formato argentino y protección contra fórmulas', () => {
  assert.equal(pesosCsv(150050), '1500,50');
  assert.equal(cantidadCsv(250, 'PESO'), '0,250');
  assert.equal(cantidadCsv(24, 'UNIDAD'), '24');
  assert.equal(textoSeguro('=SUMA(A1)'), "'=SUMA(A1)");
  const csv = aCsv(['A', 'B'], [['x;y', 'dijo "hola"']]);
  assert.ok(csv.startsWith('\uFEFF'));                       // BOM para Excel
  assert.ok(csv.includes('"x;y";"dijo ""hola"""'));          // comillas y separador escapados
});