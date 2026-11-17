// Punto de entrada: prepara la base, enciende el servidor y programa los respaldos.
import db from './db/conexion.js';
import { crearTablas } from './db/esquema.js';
import { crearAdminInicial } from './auth/inicial.js';
import { construirApp } from './app.js';
import { iniciarAutomatico } from './servicios/respaldos.js';
import { HOST, PUERTO } from './config.js';

crearTablas();
await crearAdminInicial(); // crea el usuario "admin" la primera vez

const app = await construirApp();

try {
  await app.listen({ port: PUERTO, host: HOST });
  iniciarAutomatico(app.log);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

// Al apagar (Ctrl + C, o al cerrar la ventana), se cierra la base prolijamente.
for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, async () => {
    await app.close();
    db.close();
    process.exit(0);
  });
}