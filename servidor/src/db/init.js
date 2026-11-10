// Crea las tablas y carga datos de ejemplo. Se ejecuta con: npm run db:init
import db from './conexion.js';
import { crearTablas } from './esquema.js';

crearTablas();

// Categorías iniciales. INSERT OR IGNORE: si ya existen, no hace nada.
const insertarCategoria = db.prepare('INSERT OR IGNORE INTO categorias (nombre) VALUES (?)');
for (const nombre of ['Golosinas', 'Bebidas', 'Lácteos', 'Fiambres', 'Cigarrillos', 'Panadería', 'Snacks', 'Varios']) {
  insertarCategoria.run(nombre);
}

// Dos productos de ejemplo para probar (después los podés borrar).
const categoria = db.prepare('SELECT id FROM categorias WHERE nombre = ?');
const insertarProducto = db.prepare(`
  INSERT OR IGNORE INTO productos
    (codigo_barras, nombre, categoria_id, tipo_unidad, costo, precio_venta, stock_actual, stock_minimo)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// Alfajor: costo $800,00 -> 80000 centavos; precio $1.200,00 -> 120000; stock 24 unidades.
insertarProducto.run('7790000000011', 'Alfajor de ejemplo', categoria.get('Golosinas').id, 'UNIDAD', 80000, 120000, 24, 10);
// Jamón: se vende por kg. Costo $12.000/kg, precio $18.000/kg, stock 1800 g (1,8 kg), mínimo 1000 g.
insertarProducto.run(null, 'Jamón cocido (ejemplo)', categoria.get('Fiambres').id, 'PESO', 1200000, 1800000, 1800, 1000);

const { c } = db.prepare('SELECT COUNT(*) AS c FROM productos').get();
console.log(`Base lista. Productos en la base: ${c}`);