// Lectura y armado de la cookie de sesión (sin librerías).
import { SESION_HORAS } from '../config.js';

export const COOKIE = 'kiosco_sesion';

export function leerCookie(request, nombre) {
  const encabezado = request.headers.cookie;
  if (!encabezado) return null;
  for (const parte of encabezado.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    if (parte.slice(0, i).trim() === nombre) {
      try { return decodeURIComponent(parte.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

// HttpOnly: JavaScript de la página no puede leerla. SameSite=Strict: no viaja desde otros sitios.
// Si algún día usás HTTPS, agregale "; Secure".
export const cookieSesion = (token) =>
  `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESION_HORAS * 3600}`;

export const cookieBorrar = () => `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;