// Login, sesiones y cambio de contraseña.
import { randomBytes, createHash } from 'node:crypto';
import * as repo from '../repositorios/usuarios.js';
import { ErrorApp } from '../lib/errores.js';
import { hashear, verificar } from '../auth/clave.js';
import { permisosDe } from '../auth/permisos.js';
import { SESION_HORAS } from '../config.js';

const hashToken = (t) => createHash('sha256').update(t).digest('hex');

export const datosPublicos = (u) => ({
  id: u.id, username: u.username, nombre: u.nombre, rol: u.rol,
  debe_cambiar_clave: u.debe_cambiar_clave, permisos: permisosDe(u.rol),
});

// ---- Freno a la fuerza bruta: 5 fallos seguidos bloquean 5 minutos (en memoria) ----
const MAX_FALLOS = 5;
const BLOQUEO_MS = 5 * 60 * 1000;
const intentos = new Map();

function controlarBloqueo(k) {
  const r = intentos.get(k);
  if (!r) return;
  if (r.hasta && r.hasta <= Date.now()) { intentos.delete(k); return; }
  if (r.hasta) {
    const min = Math.ceil((r.hasta - Date.now()) / 60000);
    throw new ErrorApp(429, 'DEMASIADOS_INTENTOS', `Demasiados intentos fallidos. Probá de nuevo en ${min} minuto(s).`);
  }
}
function registrarFallo(k) {
  const r = intentos.get(k) ?? { fallos: 0, hasta: 0 };
  r.fallos += 1;
  if (r.fallos >= MAX_FALLOS) r.hasta = Date.now() + BLOQUEO_MS;
  intentos.set(k, r);
}

// Hash "de mentira" para gastar el mismo tiempo cuando el usuario no existe
// (así no se puede descubrir qué usuarios existen midiendo la demora).
let falso = null;
async function hashFalso() {
  falso ??= await hashear('no-importa');
  return falso;
}

function leerCredenciales(datos) {
  const { username, password } = datos ?? {};
  if (typeof username !== 'string' || typeof password !== 'string'
      || !username.trim() || !password || username.length > 100 || password.length > 200) {
    throw new ErrorApp(400, 'VALIDACION', 'Escribí tu usuario y contraseña');
  }
  return { username: username.trim(), password };
}

// Devuelve la fila del usuario si las credenciales son correctas. También la usa el
// descuento autorizado por un dueño.
export async function verificarCredenciales(username, password, ip) {
  const k = `${username.toLowerCase()}|${ip}`;
  controlarBloqueo(k);
  const fila = repo.buscarPorUsername(username);
  const correcta = await verificar(password, fila?.password_hash ?? (await hashFalso()));
  if (!fila || !fila.activo || !correcta) {
    registrarFallo(k);
    throw new ErrorApp(401, 'CREDENCIALES_INVALIDAS', 'Usuario o contraseña incorrectos');
  }
  intentos.delete(k);
  return fila;
}

export async function login(datos, ip) {
  const { username, password } = leerCredenciales(datos);
  const fila = await verificarCredenciales(username, password, ip);
  repo.borrarSesionesVencidas();
  const token = randomBytes(32).toString('base64url');
  repo.crearSesion(hashToken(token), fila.id, SESION_HORAS);
  return { token, usuario: datosPublicos(fila) };
}

export function logout(token) {
  if (token) repo.borrarSesion(hashToken(token));
}

export function usuarioDeSesion(token) {
  const s = repo.buscarSesion(hashToken(token));
  return s ? { ...s, permisos: permisosDe(s.rol) } : null;
}

export async function cambiarClave(usuario, datos) {
  const { actual, nueva } = datos ?? {};
  const fallar = (campo, msg) => {
    throw new ErrorApp(400, 'VALIDACION', 'Hay datos que corregir', { [campo]: msg });
  };
  if (typeof actual !== 'string' || !actual) fallar('actual', 'Escribí tu contraseña actual');
  if (typeof nueva !== 'string' || nueva.length < 8 || nueva.length > 200) {
    fallar('nueva', 'La contraseña nueva debe tener al menos 8 caracteres');
  }
  if (nueva === actual) fallar('nueva', 'La contraseña nueva tiene que ser distinta de la actual');

  const fila = repo.buscarPorUsername(usuario.username);
  // 400 y no 401: un 401 haría que la pantalla crea que la sesión terminó.
  if (!(await verificar(actual, fila.password_hash))) {
    throw new ErrorApp(400, 'CLAVE_ACTUAL_INCORRECTA', 'La contraseña actual no es correcta');
  }
  repo.cambiarClave(usuario.id, await hashear(nueva), 0);
  repo.borrarSesionesDe(usuario.id, usuario.sesion_id); // cierra las demás sesiones
}