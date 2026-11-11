import * as servicio from '../servicios/reportes.js';

function enviarCsv(reply, { nombre, contenido }) {
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${nombre}"`)
    .send(contenido);
}

export default async function rutasReportes(app) {
  app.get('/ventas', async (request) => servicio.ventas(request.query));
  app.get('/mas-vendidos', async (request) => servicio.masVendidos(request.query));
  app.get('/caja', async (request) => servicio.caja(request.query));

  app.get('/ventas.csv', async (request, reply) => enviarCsv(reply, servicio.ventasCsv(request.query)));
  app.get('/mas-vendidos.csv', async (request, reply) =>
    enviarCsv(reply, servicio.masVendidosCsv(request.query)));
}