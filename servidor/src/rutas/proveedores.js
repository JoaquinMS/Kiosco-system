import * as servicio from '../servicios/proveedores.js';

export default async function rutasProveedores(app) {
  app.get('/', async () => servicio.listar());
  app.post('/', async (request, reply) => reply.status(201).send(servicio.crear(request.body)));
}