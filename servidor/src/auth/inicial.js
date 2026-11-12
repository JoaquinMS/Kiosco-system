// Si no hay ningún usuario, crea "admin" con una contraseña aleatoria y la muestra UNA vez.
import * as repo from '../repositorios/usuarios.js';
import { hashear, generarClaveTemporal } from './clave.js';

export async function crearAdminInicial() {
  if (repo.contar() > 0) return;
  const clave = generarClaveTemporal();
  repo.crear({
    username: 'admin', nombre: 'Administrador',
    hash: await hashear(clave), rol: 'ADMIN', debeCambiarClave: 1,
  });
  console.log('\n==================================================');
  console.log(' USUARIO INICIAL CREADO (solo se muestra esta vez)');
  console.log(`   Usuario:     admin`);
  console.log(`   Contraseña:  ${clave}`);
  console.log(' Al entrar, el sistema te pide cambiarla.');
  console.log(' Si la perdés: npm run admin:reset');
  console.log('==================================================\n');
}