// Restaura un respaldo. Con el servidor APAGADO:  npm run db:restaurar -- respaldos\kiosco-AAAA-MM-DD_HHMMSS.db
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const datos = path.join(__dirname, '..', '..', 'datos');
const actual = path.join(datos, 'kiosco.db');

const origen = process.argv[2];
if (!origen || !fs.existsSync(origen)) {
  console.log('Uso: npm run db:restaurar -- respaldos\\kiosco-AAAA-MM-DD_HHMMSS.db');
  process.exit(1);
}

// 1) El respaldo tiene que ser una base sana.
const prueba = new DatabaseSync(origen);
const estado = prueba.prepare('PRAGMA integrity_check').get().integrity_check;
prueba.close();
if (estado !== 'ok') {
  console.log('Ese archivo está dañado. No se restauró nada.');
  process.exit(1);
}

// 2) Se guarda una copia de la base actual, por si te arrepentís.
if (fs.existsSync(actual)) {
  const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  const seguridad = path.join(datos, `kiosco.antes-de-restaurar-${sello}.db`);
  const base = new DatabaseSync(actual);
  base.exec(`VACUUM INTO '${seguridad.replace(/'/g, "''")}'`);
  base.close();
  console.log(`Copia de seguridad de la base actual: ${seguridad}`);
}

// 3) Se reemplaza. Se borran los archivos auxiliares del modo WAL para no mezclar datos.
fs.mkdirSync(datos, { recursive: true });
for (const extra of ['-wal', '-shm']) fs.rmSync(actual + extra, { force: true });
fs.copyFileSync(origen, actual);
console.log('Listo. Base restaurada. Ya podés iniciar el servidor.');