import * as servicio from '../servicios/alertas.js';

export default async function rutasAlertas(app) {
  app.get('/', async (request) => servicio.obtener(request.query));
}