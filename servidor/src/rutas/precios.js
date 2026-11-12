import * as servicio from '../servicios/precios.js';

export default async function rutasPrecios(app) {
  app.post('/vista-previa', async (request) => servicio.vistaPrevia(request.body));
  app.post('/aplicar', async (request) => servicio.aplicar(request.body, request.usuario));
  app.post('/:id/deshacer', async (request) => servicio.deshacer(request.params.id, request.usuario));
  app.get('/cambios', async () => servicio.cambios());
  app.get('/historial', async () => servicio.historial());
}