import * as servicio from '../servicios/auth.js';
import { COOKIE, leerCookie, cookieSesion, cookieBorrar } from '../auth/cookies.js';

export default async function rutasAuth(app) {
  app.post('/login', async (request, reply) => {
    const { token, usuario } = await servicio.login(request.body, request.ip);
    reply.header('Set-Cookie', cookieSesion(token));
    return usuario;
  });

  app.post('/logout', async (request, reply) => {
    servicio.logout(leerCookie(request, COOKIE));
    reply.header('Set-Cookie', cookieBorrar());
    return { ok: true };
  });

  app.get('/me', async (request) => servicio.datosPublicos(request.usuario));

  app.post('/cambiar-clave', async (request) => {
    await servicio.cambiarClave(request.usuario, request.body);
    return { ok: true };
  });
}