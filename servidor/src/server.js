// Punto de entrada: arma el servidor web, la guardia de seguridad y lo pone a escuchar.
import Fastify from 'fastify';
import db from './db/conexion.js';
import { crearTablas } from './db/esquema.js';
import { ErrorApp } from './lib/errores.js';
import { REGLAS, PUBLICA, SESION, RUTAS_CLAVE } from './auth/reglas.js';
import { COOKIE, leerCookie } from './auth/cookies.js';
import { crearAdminInicial } from './auth/inicial.js';
import { usuarioDeSesion } from './servicios/auth.js';
import rutasAuth from './rutas/auth.js';
import rutasUsuarios from './rutas/usuarios.js';
import rutasPrecios from './rutas/precios.js';
import rutasProductos from './rutas/productos.js';
import rutasCategorias from './rutas/categorias.js';
import rutasVentas from './rutas/ventas.js';
import rutasCompras from './rutas/compras.js';
import rutasProveedores from './rutas/proveedores.js';
import rutasStock from './rutas/stock.js';
import rutasAlertas from './rutas/alertas.js';
import rutasReportes from './rutas/reportes.js';

crearTablas();
await crearAdminInicial(); // crea el usuario "admin" la primera vez

const app = Fastify({ logger: true });
app.decorateRequest('usuario', null);

// Todos los errores salen con el mismo formato: { error: { code, message, details } }
app.setErrorHandler((error, request, reply) => {
  if (error instanceof ErrorApp) {
    return reply.status(error.status).send({
      error: { code: error.codigo, message: error.message, details: error.detalles },
    });
  }
  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      error: { code: 'PETICION_INVALIDA', message: error.message, details: null },
    });
  }
  request.log.error(error);
  return reply.status(500).send({
    error: { code: 'ERROR_INTERNO', message: 'Ocurrió un error inesperado en el servidor', details: null },
  });
});

// ===== GUARDIA DE SEGURIDAD =====
// Se ejecuta ANTES de cada pedido a /api: identifica al usuario y revisa el permiso en la tabla de reglas.
app.addHook('onRequest', async (request) => {
  const patron = request.routeOptions?.url;
  if (!patron || !patron.startsWith('/api/')) return; // rutas inexistentes (404) y la raíz
  const clave = `${request.method} ${patron.replace(/\/$/, '')}`;

  const regla = REGLAS[clave];
  if (regla === undefined) {
    throw new ErrorApp(403, 'SIN_REGLA', 'Esta ruta no tiene un permiso definido'); // cerrado por defecto
  }
  if (regla === PUBLICA) return;

  const token = leerCookie(request, COOKIE);
  const usuario = token ? usuarioDeSesion(token) : null;
  if (!usuario) throw new ErrorApp(401, 'NO_AUTENTICADO', 'Tu sesión terminó. Volvé a iniciar sesión');
  request.usuario = usuario;

  if (usuario.debe_cambiar_clave && !RUTAS_CLAVE.has(clave)) {
    throw new ErrorApp(403, 'CAMBIAR_CLAVE', 'Tenés que cambiar tu contraseña antes de continuar');
  }
  if (regla !== SESION && !usuario.permisos.includes(regla)) {
    throw new ErrorApp(403, 'SIN_PERMISO', 'No tenés permiso para hacer esto');
  }
});

app.get('/', async () => ({ mensaje: 'Hola, el servidor del kiosco funciona' }));

app.get('/api/salud', async () => {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM productos').get();
  return { ok: true, productos: total, hora: new Date().toISOString() };
});

await app.register(rutasAuth, { prefix: '/api/auth' });
await app.register(rutasUsuarios, { prefix: '/api/usuarios' });
await app.register(rutasPrecios, { prefix: '/api/precios' });
await app.register(rutasProductos, { prefix: '/api/productos' });
await app.register(rutasCategorias, { prefix: '/api/categorias' });
await app.register(rutasVentas, { prefix: '/api/ventas' });
await app.register(rutasCompras, { prefix: '/api/compras' });
await app.register(rutasProveedores, { prefix: '/api/proveedores' });
await app.register(rutasStock, { prefix: '/api/stock' });
await app.register(rutasAlertas, { prefix: '/api/alertas' });
await app.register(rutasReportes, { prefix: '/api/reportes' });

try {
  // 127.0.0.1 = solo accesible desde esta PC. Más adelante lo abrimos a la red del local.
  await app.listen({ port: 3000, host: '127.0.0.1' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}