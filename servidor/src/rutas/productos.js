// Capa HTTP: recibe el pedido, llama al servicio y devuelve la respuesta. Sin lógica de negocio.
import * as servicio from '../servicios/productos.js';

export default async function rutasProductos(app) {
  app.get('/', async (request) => servicio.listar(request.query));

  // Esta ruta se usa en la Etapa 3 con el lector de códigos de barras.
  app.get('/por-codigo/:codigo', async (request) => servicio.obtenerPorCodigo(request.params.codigo));

  app.get('/:id', async (request) => servicio.obtener(request.params.id));

  // Historial de stock del producto (kardex).
  app.get('/:id/movimientos', async (request) => servicio.movimientos(request.params.id));

  app.post('/', async (request, reply) => {
    const producto = servicio.crear(request.body);
    return reply.status(201).send(producto);
  });

  app.put('/:id', async (request) => servicio.actualizar(request.params.id, request.body));

  // "Borrar" = dar de baja (activo = 0). No se elimina la fila.
  app.delete('/:id', async (request) => servicio.darDeBaja(request.params.id));

  app.post('/:id/reactivar', async (request) => servicio.reactivar(request.params.id));

  app.get('/:id/lotes', async (request) => servicio.lotes(request.params.id));
  app.put('/:id/precio', async (request) => servicio.cambiarPrecio(request.params.id, request.body));
}