// Todas las llamadas al servidor en un solo lugar.

async function pedir(url, opciones = {}) {
  const headers = {};
  // Solo se declara JSON si hay cuerpo: Fastify rechaza un "JSON vacío".
  if (opciones.body) headers['Content-Type'] = 'application/json';

  let respuesta;
  try {
    respuesta = await fetch(url, { ...opciones, headers });
  } catch {
    throw new Error('No se pudo conectar con el servidor. ¿Está corriendo?');
  }

  const datos = await respuesta.json().catch(() => null);

  // Si el servidor dice que la sesión terminó, se lo avisamos a la aplicación.
  if (respuesta.status === 401 && datos?.error?.code === 'NO_AUTENTICADO') {
    window.dispatchEvent(new Event('sesion-expirada'));
  }

  if (!respuesta.ok) {
    const error = new Error(datos?.error?.message ?? 'Error de comunicación con el servidor');
    error.codigo = datos?.error?.code;
    error.detalles = datos?.error?.details ?? null; // errores por campo
    throw error;
  }
  return datos;
}

export const api = {
  listarCategorias: () => pedir('/api/categorias'),

  crearVenta: (datos) => pedir('/api/ventas', { method: 'POST', body: JSON.stringify(datos) }),
  
  buscarPorCodigo: (codigo) => pedir(`/api/productos/por-codigo/${encodeURIComponent(codigo)}`),

  alertas: (dias) => pedir(dias ? `/api/alertas?dias=${dias}` : '/api/alertas'),
  reporteVentas: (p) => pedir(`/api/reportes/ventas?${new URLSearchParams(p)}`),
  reporteMasVendidos: (p) => pedir(`/api/reportes/mas-vendidos?${new URLSearchParams(p)}`),
  reporteCaja: (fecha) => pedir(`/api/reportes/caja?fecha=${fecha}`),

  listarProductos: (filtros) => {
    const params = new URLSearchParams();
    if (filtros.buscar) params.set('buscar', filtros.buscar);
    if (filtros.categoriaId) params.set('categoriaId', filtros.categoriaId);
    if (filtros.soloBajo) params.set('soloBajo', '1');
    if (filtros.incluirInactivos) params.set('incluirInactivos', '1');
    return pedir(`/api/productos?${params}`);
  },

  crearProducto: (datos) =>
    pedir('/api/productos', { method: 'POST', body: JSON.stringify(datos) }),

  actualizarProducto: (id, datos) =>
    pedir(`/api/productos/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),

  darDeBaja: (id) => pedir(`/api/productos/${id}`, { method: 'DELETE' }),

  reactivar: (id) => pedir(`/api/productos/${id}/reactivar`, { method: 'POST' }),

    obtenerProducto: (id) => pedir(`/api/productos/${id}`),
  movimientosProducto: (id) => pedir(`/api/productos/${id}/movimientos`),
  lotesProducto: (id) => pedir(`/api/productos/${id}/lotes`),
  cambiarPrecio: (id, precio_venta) =>
    pedir(`/api/productos/${id}/precio`, { method: 'PUT', body: JSON.stringify({ precio_venta }) }),

  listarProveedores: () => pedir('/api/proveedores'),
  crearProveedor: (nombre) =>
    pedir('/api/proveedores', { method: 'POST', body: JSON.stringify({ nombre }) }),

  crearCompra: (datos) => pedir('/api/compras', { method: 'POST', body: JSON.stringify(datos) }),
  crearAjuste: (datos) => pedir('/api/stock/ajustes', { method: 'POST', body: JSON.stringify(datos) }),

  login: (username, password) =>
    pedir('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => pedir('/api/auth/logout', { method: 'POST' }),
  me: () => pedir('/api/auth/me'),
  cambiarClave: (actual, nueva) =>
    pedir('/api/auth/cambiar-clave', { method: 'POST', body: JSON.stringify({ actual, nueva }) }),

  listarUsuarios: () => pedir('/api/usuarios'),
  crearUsuario: (datos) => pedir('/api/usuarios', { method: 'POST', body: JSON.stringify(datos) }),
  actualizarUsuario: (id, datos) =>
    pedir(`/api/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  resetearClave: (id, password) =>
    pedir(`/api/usuarios/${id}/resetear-clave`, { method: 'POST', body: JSON.stringify({ password }) }),

  listarVentas: (p) => pedir(`/api/ventas?${new URLSearchParams(p)}`),
  obtenerVenta: (id) => pedir(`/api/ventas/${id}`),
  anularVenta: (id, motivo) =>
    pedir(`/api/ventas/${id}/anular`, { method: 'POST', body: JSON.stringify({ motivo }) }),

  vistaPreviaPrecios: (d) => pedir('/api/precios/vista-previa', { method: 'POST', body: JSON.stringify(d) }),
  aplicarPrecios: (d) => pedir('/api/precios/aplicar', { method: 'POST', body: JSON.stringify(d) }),
  deshacerPrecios: (id) => pedir(`/api/precios/${id}/deshacer`, { method: 'POST' }),
  cambiosPrecios: () => pedir('/api/precios/cambios'),
  historialPrecios: () => pedir('/api/precios/historial'),

};

// Dirección para descargar un CSV (el navegador lo baja solo gracias a Content-Disposition).
export function urlCsv(ruta, params) {
  return `/api/reportes/${ruta}?${new URLSearchParams(params)}`;
}