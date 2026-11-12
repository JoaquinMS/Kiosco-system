// Capa HTTP de productos. Sin lógica de negocio.
import * as servicio from '../servicios/productos.js';

// Quien no tiene el permiso "ver costos" (el empleado) recibe el producto SIN costo ni costo promedio.
function visible(request, dato) {
  if (request.usuario.permisos.includes('productos:ver_costos')) return dato;
  const sinCostos = ({ costo, costo_promedio, ...resto }) => resto;
  return Array.isArray(dato) ? dato.map(sinCostos) : sinCostos(dato);
}

export default async function rutasProductos(app) {
  app.get('/', async (request) => visible(request, servicio.listar(request.query)));

  app.get('/por-codigo/:codigo', async (request) =>
    visible(request, servicio.obtenerPorCodigo(request.params.codigo)));

  app.get('/:id', async (request) => visible(request, servicio.obtener(request.params.id)));
  app.get('/:id/movimientos', async (request) => servicio.movimientos(request.params.id));
  app.get('/:id/lotes', async (request) => servicio.lotes(request.params.id));

  app.post('/', async (request, reply) => {
    const producto = servicio.crear(request.body, request.usuario);
    return reply.status(201).send(visible(request, producto));
  });

  app.put('/:id', async (request) => servicio.actualizar(request.params.id, request.body, request.usuario));
  app.put('/:id/precio', async (request) => servicio.cambiarPrecio(request.params.id, request.body, request.usuario));

  // "Borrar" = dar de baja (activo = 0). No se elimina la fila.
  app.delete('/:id', async (request) => servicio.darDeBaja(request.params.id));
  app.post('/:id/reactivar', async (request) => servicio.reactivar(request.params.id));
}