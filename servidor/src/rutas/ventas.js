import * as servicio from '../servicios/ventas.js';

export default async function rutasVentas(app) {
  app.post('/', async (request, reply) => {
    const venta = servicio.crear(request.body);
    // 201 = creada. Si era una repetición (misma client_uuid), 200.
    return reply.status(venta.repetida ? 200 : 201).send(venta);
  });

  app.get('/', async (request) => servicio.listar(request.query));

  app.get('/:id', async (request) => servicio.obtener(request.params.id));
}