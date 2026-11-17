// Entrega los archivos de la pantalla ya compilada (web/dist) desde el mismo servidor.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(__dirname, '..', '..', 'web', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.map': 'application/json',
};

const esArchivo = (ruta) => {
  try { return fs.statSync(ruta).isFile(); } catch { return false; }
};

export function registrarEstaticos(app) {
  const indice = path.join(RAIZ, 'index.html');
  if (!fs.existsSync(indice)) {
    app.log.warn('No existe web/dist: la pantalla no se sirve desde acá (usá "npm run build" en web).');
    return;
  }

  // Todo lo que no es una ruta de la API cae acá: si es un archivo se entrega; si no, index.html.
  app.setNotFoundHandler(async (request, reply) => {
    const url = request.raw.url.split('?')[0];
    if (request.method !== 'GET' || url.startsWith('/api/')) {
      return reply.status(404).send({
        error: { code: 'NO_ENCONTRADO', message: 'Ruta inexistente', details: null },
      });
    }
    let ruta = '/';
    try { ruta = decodeURIComponent(url); } catch { /* queda "/" */ }

    let archivo = path.normalize(path.join(RAIZ, ruta));
    // Protección: nunca salir de la carpeta web/dist (por ejemplo con "../").
    if (!archivo.startsWith(RAIZ + path.sep) || !esArchivo(archivo)) archivo = indice;

    const esActivo = archivo.includes(`${path.sep}assets${path.sep}`);
    return reply
      .header('Content-Type', MIME[path.extname(archivo)] ?? 'application/octet-stream')
      // Los archivos de /assets llevan un código en el nombre: se pueden guardar para siempre.
      .header('Cache-Control', esActivo ? 'public, max-age=31536000, immutable' : 'no-cache')
      .send(fs.createReadStream(archivo));
  });
}