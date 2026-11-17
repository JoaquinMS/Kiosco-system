import './env.js';
import { crearTablas } from '../src/db/esquema.js';
import db from '../src/db/conexion.js';
import * as productos from '../src/servicios/productos.js';
import * as repoUsuarios from '../src/repositorios/usuarios.js';
import { permisosDe } from '../src/auth/permisos.js';
import { hashear } from '../src/auth/clave.js';

crearTablas();

let contador = 0;
export const unico = (prefijo) => `${prefijo}-${++contador}`;

// Crea un usuario real (con contraseña hasheada) del rol indicado.
export async function crearUsuario(rol, clave = 'clave-segura-1') {
  const username = unico(rol.toLowerCase());
  const id = repoUsuarios.crear({
    username, nombre: username, hash: await hashear(clave), rol, debeCambiarClave: 0,
  });
  return { id, username, nombre: username, rol, permisos: permisosDe(rol), clave };
}

// Producto por defecto: stock 24, costo $800,00, precio $1.200,00 (todo en centavos).
export function crearProducto(extra = {}) {
  return productos.crear({
    codigo_barras: null, nombre: unico('Producto'), categoria_id: null, tipo_unidad: 'UNIDAD',
    costo: 80000, precio_venta: 120000, stock_actual: 24, stock_minimo: 10,
    controla_vencimiento: false, ...extra,
  }, null);
}

export const stockDe = (id) =>
  db.prepare('SELECT stock_actual FROM productos WHERE id = ?').get(id).stock_actual;

export const contarVentas = () => db.prepare('SELECT COUNT(*) AS n FROM ventas').get().n;