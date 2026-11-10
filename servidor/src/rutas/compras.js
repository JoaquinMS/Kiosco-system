import * as servicio from '../servicios/compras.js';

export default async function rutasCompras(app) {
  app.post('/', async (request, reply) => {
    const compra = servicio.crear(request.body);
    return reply.status(compra.repetida ? 200 : 201).send(compra);
  });
  app.get('/', async (request) => servicio.listar(request.query));
  app.get('/:id', async (request) => servicio.obtener(request.params.id));
}