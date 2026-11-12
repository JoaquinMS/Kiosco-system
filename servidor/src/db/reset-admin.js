// Genera una contraseña nueva para "admin". Se ejecuta con: npm run admin:reset
import { crearTablas } from './esquema.js';
import * as repo from '../repositorios/usuarios.js';
import { hashear, generarClaveTemporal } from '../auth/clave.js';

crearTablas();
const admin = repo.buscarPorUsername('admin');
if (!admin) {
  console.log('No existe el usuario "admin". Se crea al arrancar el servidor por primera vez.');
  process.exit(1);
}
const clave = generarClaveTemporal();
repo.actualizar(admin.id, { nombre: admin.nombre, rol: 'ADMIN', activo: 1 });
repo.cambiarClave(admin.id, await hashear(clave), 1);
repo.borrarSesionesDe(admin.id);
console.log(`Usuario: admin\nContraseña nueva: ${clave}\n(Se te pedirá cambiarla al entrar.)`);