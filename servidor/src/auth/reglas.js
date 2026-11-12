// TABLA ÚNICA de acceso: "MÉTODO patrón-de-ruta" -> permiso necesario.
// Lo que no figure acá se RECHAZA (cerrado por defecto).
export const PUBLICA = Symbol('publica'); // sin sesión
export const SESION = Symbol('sesion');   // cualquier usuario con sesión

const R = (permiso, ...rutas) => rutas.map((r) => [r, permiso]);

export const REGLAS = Object.fromEntries([
  ...R(PUBLICA, 'GET /api/salud', 'POST /api/auth/login'),
  ...R(SESION, 'POST /api/auth/logout', 'GET /api/auth/me', 'POST /api/auth/cambiar-clave'),

  ...R('productos:ver',
    'GET /api/categorias', 'GET /api/productos',
    'GET /api/productos/por-codigo/:codigo', 'GET /api/productos/:id'),
  ...R('productos:crear', 'POST /api/productos'),
  ...R('productos:escribir',
    'PUT /api/productos/:id', 'DELETE /api/productos/:id',
    'POST /api/productos/:id/reactivar', 'PUT /api/productos/:id/precio'),
  ...R('stock:ver', 'GET /api/productos/:id/movimientos', 'GET /api/productos/:id/lotes'),

  ...R('ventas:crear', 'POST /api/ventas'),
  ...R('ventas:ver', 'GET /api/ventas', 'GET /api/ventas/:id'),
  ...R('ventas:anular', 'POST /api/ventas/:id/anular'),

  ...R('compras:gestionar',
    'POST /api/compras', 'GET /api/compras', 'GET /api/compras/:id',
    'GET /api/proveedores', 'POST /api/proveedores'),
  ...R('stock:ajustar', 'POST /api/stock/ajustes'),
  ...R('alertas:ver', 'GET /api/alertas'),
  ...R('reportes:ver',
    'GET /api/reportes/ventas', 'GET /api/reportes/mas-vendidos', 'GET /api/reportes/caja',
    'GET /api/reportes/ventas.csv', 'GET /api/reportes/mas-vendidos.csv'),

  ...R('precios:masivos',
    'POST /api/precios/vista-previa', 'POST /api/precios/aplicar', 'POST /api/precios/:id/deshacer',
    'GET /api/precios/cambios', 'GET /api/precios/historial'),

  ...R('usuarios:gestionar',
    'GET /api/usuarios', 'POST /api/usuarios', 'PUT /api/usuarios/:id',
    'POST /api/usuarios/:id/resetear-clave'),
]);

// Lo único permitido mientras el usuario todavía tiene que cambiar su contraseña.
export const RUTAS_CLAVE = new Set([
  'GET /api/auth/me', 'POST /api/auth/logout', 'POST /api/auth/cambiar-clave',
]);