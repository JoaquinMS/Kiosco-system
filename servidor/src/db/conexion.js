// Abre (o crea) el archivo de la base de datos y lo comparte con el resto del programa.
// Usamos el SQLite incluido en Node (node:sqlite): no hay que instalar ni compilar nada.
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// La base vive en servidor/datos/kiosco.db
const carpetaDatos = path.join(__dirname, '..', '..', 'datos');
fs.mkdirSync(carpetaDatos, { recursive: true });

const db = new DatabaseSync(path.join(carpetaDatos, 'kiosco.db'));

// WAL: más rápido y más seguro ante cortes de luz.
db.exec('PRAGMA journal_mode = WAL');
// SQLite no verifica las claves foráneas salvo que se lo pidas, así que lo activamos.
db.exec('PRAGMA foreign_keys = ON');

/**
 * Ejecuta una función dentro de una transacción: o se guarda TODO o no se guarda NADA.
 * Si la función lanza un error, se hace ROLLBACK y la base queda como estaba.
 * La vamos a usar en las ventas, ingresos y ajustes de stock.
 */
export function transaccion(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export default db;