// Actualización masiva de precios, con vista previa y deshacer.
import { transaccion } from '../db/conexion.js';
import * as repo from '../repositorios/precios.js';
import * as repoProductos from '../repositorios/productos.js';
import { ErrorApp } from '../lib/errores.js';

const PASOS = [0, 1000, 5000, 10000]; // redondeo en centavos: ninguno, $10, $50, $100
const MAX_PRECIO = 2_000_000_000;

function fallar(campo, mensaje) {
  throw new ErrorApp(400, 'VALIDACION', 'Hay datos que corregir', { [campo]: mensaje });
}

function leer(datos) {
  if (datos === null || typeof datos !== 'object') throw new ErrorApp(400, 'VALIDACION', 'Faltan los datos');
  const idOpcional = (v, campo) => {
    if (v === null || v === undefined || v === '') return null;
    if (!Number.isInteger(v) || v <= 0) fallar(campo, 'No es válido');
    return v;
  };
  const categoriaId = idOpcional(datos.categoria_id, 'categoria_id');
  const proveedorId = idOpcional(datos.proveedor_id, 'proveedor_id');

  // Porcentaje en CENTÉSIMAS de punto: 12,5 % = 1250. Negativo = baja.
  const porcentaje = datos.porcentaje;
  if (!Number.isInteger(porcentaje) || porcentaje === 0 || porcentaje < -9000 || porcentaje > 100000) {
    fallar('porcentaje', 'El porcentaje debe estar entre -90 % y 1000 %, y no puede ser 0');
  }
  const paso = datos.redondeo ?? 0;
  if (!PASOS.includes(paso)) fallar('redondeo', 'Redondeo no válido');

  let excluir = new Set();
  if (datos.excluir !== undefined) {
    if (!Array.isArray(datos.excluir) || datos.excluir.length > 5000
        || datos.excluir.some((n) => !Number.isInteger(n))) fallar('excluir', 'Lista no válida');
    excluir = new Set(datos.excluir);
  }
  return { categoriaId, proveedorId, porcentaje, paso, excluir };
}

// Fórmula única: la usan la vista previa y la aplicación real.
function calcular(f) {
  const productos = repo.productosParaActualizar(f);
  const filas = [];
  for (const p of productos) {
    if (f.excluir.has(p.id)) continue;
    let nuevo = Math.round((p.precio_venta * (10000 + f.porcentaje)) / 10000);
    if (f.paso > 0) nuevo = Math.round(nuevo / f.paso) * f.paso;
    if (nuevo <= 0 || nuevo > MAX_PRECIO || nuevo === p.precio_venta) continue;
    filas.push({
      producto_id: p.id, nombre: p.nombre, categoria: p.categoria, tipo_unidad: p.tipo_unidad,
      precio_actual: p.precio_venta, precio_nuevo: nuevo,
    });
  }
  return { filas, total_filtrados: productos.length };
}

function describir(f) {
  const signo = f.porcentaje > 0 ? '+' : '−';
  const pct = (Math.abs(f.porcentaje) / 100).toFixed(2).replace('.', ',');
  const partes = [`${signo}${pct} %`];
  if (f.categoriaId) partes.push(`Categoría: ${repo.nombreCategoria(f.categoriaId) ?? '#' + f.categoriaId}`);
  if (f.proveedorId) partes.push(`Proveedor: ${repo.nombreProveedor(f.proveedorId) ?? '#' + f.proveedorId}`);
  if (!f.categoriaId && !f.proveedorId) partes.push('Todos los productos');
  if (f.paso > 0) partes.push(`Redondeo a $${f.paso / 100}`);
  return partes.join(' · ');
}

export function vistaPrevia(datos) {
  const f = leer(datos);
  return { descripcion: describir(f), ...calcular(f) };
}

export function aplicar(datos, usuario) {
  const f = leer(datos);
  return transaccion(() => {
    const { filas } = calcular(f); // se recalcula ACÁ: el servidor no confía en la vista previa
    if (filas.length === 0) throw new ErrorApp(409, 'SIN_CAMBIOS', 'Con esos filtros no hay precios que cambiar');
    const cambioId = repo.crearCambio({
      descripcion: describir(f), porcentaje: f.porcentaje, usuarioId: usuario.id,
    });
    for (const fila of filas) {
      repoProductos.cambiarPrecio(fila.producto_id, fila.precio_nuevo);
      repo.registrarHistorial({
        productoId: fila.producto_id, anterior: fila.precio_actual, nuevo: fila.precio_nuevo,
        motivo: 'MASIVO', cambioId, usuarioId: usuario.id,
      });
    }
    return { cambio_id: cambioId, cantidad: filas.length };
  });
}

// Revierte SOLO los productos cuyo precio sigue siendo el que puso ese cambio masivo.
// Si alguien lo modificó después, no se pisa.
export function deshacer(idCrudo, usuario) {
  const id = Number(idCrudo);
  if (!Number.isInteger(id) || id <= 0) throw new ErrorApp(400, 'ID_INVALIDO', 'El identificador no es válido');

  return transaccion(() => {
    const cambio = repo.buscarCambio(id);
    if (!cambio) throw new ErrorApp(404, 'CAMBIO_NO_ENCONTRADO', 'Ese cambio de precios no existe');
    if (cambio.deshecho_en) throw new ErrorApp(409, 'YA_DESHECHO', 'Ese cambio ya fue deshecho');

    let revertidos = 0;
    let omitidos = 0;
    for (const h of repo.historialDeCambio(id)) {
      const p = repoProductos.buscarPorId(h.producto_id);
      if (p && p.precio_venta === h.precio_nuevo) {
        repoProductos.cambiarPrecio(p.id, h.precio_anterior);
        repo.registrarHistorial({
          productoId: p.id, anterior: h.precio_nuevo, nuevo: h.precio_anterior,
          motivo: 'DESHACER', cambioId: id, usuarioId: usuario.id,
        });
        revertidos += 1;
      } else {
        omitidos += 1;
      }
    }
    repo.marcarDeshecho(id, usuario.id);
    return { revertidos, omitidos };
  });
}

export const cambios = () => repo.ultimosCambios(20);
export const historial = () => repo.historialReciente(50);