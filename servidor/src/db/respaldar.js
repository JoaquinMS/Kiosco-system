// Hace un respaldo ahora mismo. Se ejecuta con: npm run db:respaldar
import { crearTablas } from './esquema.js';
import { crearRespaldo } from '../servicios/respaldos.js';

crearTablas();
const r = crearRespaldo();
console.log(`Respaldo creado: ${r.nombre} (${Math.round(r.tamano / 1024)} KB)`);
if (r.copia_extra) console.log('También se copió a la carpeta extra.');