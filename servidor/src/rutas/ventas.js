import * as servicio from '../servicios/ventas.js';

export default async function rutasVentas(app) {
  app.post('/', async (request, reply) => {
    const venta = await servicio.crear(request.body, request.usuario, request.ip);
    // 201 = creada. Si era una repetición (misma client_uuid), 200.
    return reply.status(venta.repetida ? 200 : 201).send(venta);
  });

  app.get('/', async (request) => servicio.listar(request.query));
  app.get('/:id', async (request) => servicio.obtener(request.params.id));
  app.post('/:id/anular', async (request) =>
    servicio.anular(request.params.id, request.body, request.usuario));
}