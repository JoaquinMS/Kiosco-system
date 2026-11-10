import * as servicioAjustes from '../servicios/ajustes.js';

export default async function rutasStock(app) {
  app.post('/ajustes', async (request, reply) => {
    return reply.status(201).send(servicioAjustes.crear(request.body));
  });
}