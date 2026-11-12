// Gestión de usuarios. El ADMIN gestiona a todos; el DUEÑO solo a los empleados.
import { transaccion } from '../db/conexion.js';
import * as repo from '../repositorios/usuarios.js';
import { ErrorApp } from '../lib/errores.js';
import { hashear } from '../auth/clave.js';
import { permisosDe } from '../auth/permisos.js';

const ROLES = ['ADMIN', 'DUENO', 'EMPLEADO'];
const esAdmin = (actor) => permisosDe(actor.rol).includes('usuarios:gestionar_todos');
const rolesPermitidos = (actor) => (esAdmin(actor) ? ROLES : ['EMPLEADO']);
const puedeGestionar = (actor, objetivo) => esAdmin(actor) || objetivo.rol === 'EMPLEADO';

function fallar(errores) {
  throw new ErrorApp(400, 'VALIDACION', 'Hay datos que corregir', errores);
}
function aId(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new ErrorApp(400, 'ID_INVALIDO', 'El identificador no es válido');
  return n;
}
const leerNombre = (v) => (typeof v === 'string' ? v.trim() : '');
const claveValida = (v) => typeof v === 'string' && v.length >= 8 && v.length <= 200;

export function listar(actor) {
  return repo.listar(!esAdmin(actor));
}

export async function crear(datos, actor) {
  const errores = {};
  const username = typeof datos?.username === 'string' ? datos.username.trim() : '';
  const nombre = leerNombre(datos?.nombre);
  if (!/^[a-z0-9._-]{3,30}$/i.test(username)) errores.username = '3 a 30 letras, números, punto, guion o guion bajo';
  if (nombre.length < 1 || nombre.length > 60) errores.nombre = 'El nombre es obligatorio (hasta 60 caracteres)';
  if (!rolesPermitidos(actor).includes(datos?.rol)) errores.rol = 'Rol no permitido';
  if (!claveValida(datos?.password)) errores.password = 'La contraseña temporal debe tener al menos 8 caracteres';
  if (Object.keys(errores).length > 0) fallar(errores);

  const hash = await hashear(datos.password); // lento: se hace antes de tocar la base
  if (repo.buscarPorUsername(username)) {
    throw new ErrorApp(409, 'USUARIO_DUPLICADO', 'Ese nombre de usuario ya existe', { username: 'Ya existe' });
  }
  const id = repo.crear({ username, nombre, hash, rol: datos.rol, debeCambiarClave: 1 });
  return repo.buscarPorId(id);
}

export function actualizar(idCrudo, datos, actor) {
  const id = aId(idCrudo);
  const errores = {};
  const nombre = leerNombre(datos?.nombre);
  if (nombre.length < 1 || nombre.length > 60) errores.nombre = 'El nombre es obligatorio (hasta 60 caracteres)';
  if (!ROLES.includes(datos?.rol)) errores.rol = 'Rol no válido';
  if (typeof datos?.activo !== 'boolean') errores.activo = 'Valor no válido';
  if (Object.keys(errores).length > 0) fallar(errores);

  return transaccion(() => {
    const objetivo = repo.buscarPorId(id);
    if (!objetivo) throw new ErrorApp(404, 'USUARIO_NO_ENCONTRADO', 'El usuario no existe');
    if (!puedeGestionar(actor, objetivo) || !rolesPermitidos(actor).includes(datos.rol)) {
      throw new ErrorApp(403, 'SIN_PERMISO', 'No tenés permiso para hacer esto con ese usuario');
    }
    if (objetivo.id === actor.id && (datos.rol !== objetivo.rol || !datos.activo)) {
      throw new ErrorApp(409, 'AUTOEDICION', 'No podés cambiar tu propio rol ni desactivarte');
    }
    const dejaDeSerAdmin = objetivo.rol === 'ADMIN' && objetivo.activo === 1
      && (datos.rol !== 'ADMIN' || !datos.activo);
    if (dejaDeSerAdmin && repo.contarAdminsActivos() <= 1) {
      throw new ErrorApp(409, 'ULTIMO_ADMIN', 'Tiene que quedar al menos un administrador activo');
    }
    repo.actualizar(id, { nombre, rol: datos.rol, activo: datos.activo ? 1 : 0 });
    if (!datos.activo || datos.rol !== objetivo.rol) repo.borrarSesionesDe(id); // cierra sus sesiones
    return repo.buscarPorId(id);
  });
}

export async function resetearClave(idCrudo, datos, actor) {
  const id = aId(idCrudo);
  if (!claveValida(datos?.password)) fallar({ password: 'La contraseña temporal debe tener al menos 8 caracteres' });
  const hash = await hashear(datos.password);

  transaccion(() => {
    const objetivo = repo.buscarPorId(id);
    if (!objetivo) throw new ErrorApp(404, 'USUARIO_NO_ENCONTRADO', 'El usuario no existe');
    if (!puedeGestionar(actor, objetivo)) {
      throw new ErrorApp(403, 'SIN_PERMISO', 'No tenés permiso para hacer esto con ese usuario');
    }
    if (objetivo.id === actor.id) {
      throw new ErrorApp(409, 'AUTOEDICION', 'Para cambiar tu propia contraseña usá "Cambiar contraseña"');
    }
    repo.cambiarClave(id, hash, 1);   // la tendrá que cambiar al entrar
    repo.borrarSesionesDe(id);
  });
}