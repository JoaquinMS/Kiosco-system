import * as servicio from '../servicios/usuarios.js';

export default async function rutasUsuarios(app) {
  app.get('/', async (request) => servicio.listar(request.usuario));

  app.post('/', async (request, reply) =>
    reply.status(201).send(await servicio.crear(request.body, request.usuario)));

  app.put('/:id', async (request) =>
    servicio.actualizar(request.params.id, request.body, request.usuario));

  app.post('/:id/resetear-clave', async (request) => {
    await servicio.resetearClave(request.params.id, request.body, request.usuario);
    return { ok: true };
  });
}