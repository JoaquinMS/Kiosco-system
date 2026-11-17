import fs from 'node:fs';
import * as servicio from '../servicios/respaldos.js';

export default async function rutasAdmin(app) {
  app.post('/backup', async (request, reply) => reply.status(201).send(servicio.crearRespaldo()));

  app.get('/backups', async () => servicio.listarRespaldos());

  app.get('/backups/:nombre', async (request, reply) => {
    const ruta = servicio.rutaRespaldo(request.params.nombre); // valida el nombre primero
    return reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${request.params.nombre}"`)
      .send(fs.createReadStream(ruta));
  });
}