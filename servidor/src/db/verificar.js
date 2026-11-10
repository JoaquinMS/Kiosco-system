// Comprueba la integridad del stock. Se ejecuta con: npm run db:verificar
import { crearTablas } from './esquema.js';
import { verificarConsistencia } from '../repositorios/movimientos.js';
import { verificarConsistencia as verificarLotes } from '../repositorios/lotes.js';

crearTablas();
let hayProblemas = false;

const stock = verificarConsistencia();
if (stock.length === 0) {
  console.log('OK: el stock de todos los productos coincide con su historial de movimientos.');
} else {
  hayProblemas = true;
  console.log('ATENCIÓN: hay productos con stock que NO coincide con su historial:');
  console.table(stock);
}

const lotes = verificarLotes();
if (lotes.length === 0) {
  console.log('OK: los lotes nunca superan el stock de su producto.');
} else {
  hayProblemas = true;
  console.log('ATENCIÓN: hay productos cuyos lotes superan su stock:');
  console.table(lotes);
}

if (hayProblemas) process.exitCode = 1;