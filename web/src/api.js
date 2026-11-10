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

};