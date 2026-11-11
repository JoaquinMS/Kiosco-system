// Punto de entrada: arma el servidor web y lo pone a escuchar.
import Fastify from 'fastify';
import db from './db/conexion.js';
import { crearTablas } from './db/esquema.js';
import { ErrorApp } from './lib/errores.js';
import rutasProductos from './rutas/productos.js';
import rutasCategorias from './rutas/categorias.js';
import rutasVentas from './rutas/ventas.js';
import rutasCompras from './rutas/compras.js';
import rutasProveedores from './rutas/proveedores.js';
import rutasStock from './rutas/stock.js';
import rutasAlertas from './rutas/alertas.js';
import rutasReportes from './rutas/reportes.js';

crearTablas(); // se asegura de que las tablas existan al arrancar

const app = Fastify({ logger: true });

// Todos los errores salen con el mismo formato: { error: { code, message, details } }
app.setErrorHandler((error, request, reply) => {
  if (error instanceof ErrorApp) {
    return reply.status(error.status).send({
      error: { code: error.codigo, message: error.message, details: error.detalles },
    });
  }
  // Errores de Fastify por pedidos mal armados (por ejemplo, un JSON roto)
  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      error: { code: 'PETICION_INVALIDA', message: error.message, details: null },
    });
  }
  // Cualquier otra cosa es un bug nuestro: se registra y no se le muestra el detalle al usuario.
  request.log.error(error);
  return reply.status(500).send({
    error: { code: 'ERROR_INTERNO', message: 'Ocurrió un error inesperado en el servidor', details: null },
  });
});

app.get('/', async () => ({ mensaje: 'Hola, el servidor del kiosco funciona' }));

// Antes estaba en /salud; ahora todo lo de la API cuelga de /api
app.get('/api/salud', async () => {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM productos').get();
  return { ok: true, productos: total, hora: new Date().toISOString() };
});

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