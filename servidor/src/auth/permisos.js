// Qué puede hacer cada rol. Las rutas piden un PERMISO, nunca preguntan "¿es dueño?".
import { EMPLEADO_PUEDE_ALTA_RAPIDA } from '../config.js';

const EMPLEADO = [
  'ventas:crear',      // vender
  'productos:ver',     // buscar y consultar precio (sin costos)
  ...(EMPLEADO_PUEDE_ALTA_RAPIDA ? ['productos:crear'] : []),
];

const DUENO = [...new Set([
  ...EMPLEADO,
  'productos:crear',
  'productos:ver_costos',
  'productos:escribir',
  'stock:ver',
  'stock:ajustar',
  'compras:gestionar',
  'alertas:ver',
  'reportes:ver',
  'precios:masivos',
  'ventas:ver',
  'ventas:anular',
  'descuentos:sin_limite',
  'usuarios:gestionar',        // gestiona empleados
])];

const ADMIN = [...DUENO, 'usuarios:gestionar_todos'];

const POR_ROL = { EMPLEADO, DUENO, ADMIN };

export const permisosDe = (rol) => POR_ROL[rol] ?? [];