import * as servicio from '../servicios/exportar.js';

function enviarCsv(reply, { nombre, contenido }) {
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${nombre}"`)
    .send(contenido);
}

export default async function rutasExportar(app) {
  app.get('/productos.csv', async (request, reply) => enviarCsv(reply, servicio.productosCsv()));
  app.get('/ventas.csv', async (request, reply) => enviarCsv(reply, servicio.ventasDetalleCsv(request.query)));
  app.get('/movimientos.csv', async (request, reply) => enviarCsv(reply, servicio.movimientosCsv(request.query)));
}