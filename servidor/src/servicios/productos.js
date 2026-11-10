// Reglas de negocio de productos: validar, comprobar duplicados y abrir transacciones.
import { transaccion } from '../db/conexion.js';
import * as repo from '../repositorios/productos.js';
import * as repoCategorias from '../repositorios/categorias.js';
import * as repoMov from '../repositorios/movimientos.js';
import { ErrorApp } from '../lib/errores.js';
import * as repoLotes from '../repositorios/lotes.js';


const MAXIMO = 2_000_000_000;

// Convierte el id que llega por la URL ("12") en número y verifica que sea válido.
function aId(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ErrorApp(400, 'ID_INVALIDO', 'El identificador no es válido');
  }
  return n;
}

function leerEntero(valor, campo, etiqueta, errores) {
  if (!Number.isInteger(valor) || valor < 0 || valor > MAXIMO) {
    errores[campo] = `${etiqueta} debe ser un número entero mayor o igual a 0`;
    return 0;
  }
  return valor;
}

// Revisa TODOS los campos y, si hay errores, los devuelve juntos (no de a uno).
function validar(datos, { esCreacion }) {
  if (datos === null || typeof datos !== 'object') {
    throw new ErrorApp(400, 'VALIDACION', 'Faltan los datos del producto');
  }
  const errores = {};

  const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : '';
  if (nombre.length < 1 || nombre.length > 120) {
    errores.nombre = 'El nombre es obligatorio (hasta 120 caracteres)';
  }

  // El código de barras es opcional: vacío se guarda como NULL.
  let codigo = null;
  const crudo = datos.codigo_barras;
  if (crudo !== null && crudo !== undefined && String(crudo).trim() !== '') {
    codigo = String(crudo).trim();
    if (!/^[A-Za-z0-9-]{3,50}$/.test(codigo)) {
      errores.codigo_barras = 'El código debe tener entre 3 y 50 letras, números o guiones';
    }
  }

  let categoriaId = null;
  if (datos.categoria_id !== null && datos.categoria_id !== undefined && datos.categoria_id !== '') {
    categoriaId = datos.categoria_id;
    if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
      errores.categoria_id = 'La categoría no es válida';
    }
  }

  if (!['UNIDAD', 'PESO'].includes(datos.tipo_unidad)) {
    errores.tipo_unidad = 'El tipo de unidad debe ser UNIDAD o PESO';
  }

  const costo = leerEntero(datos.costo ?? 0, 'costo', 'El costo', errores);
  const precio = leerEntero(datos.precio_venta ?? 0, 'precio_venta', 'El precio de venta', errores);
  const stockMinimo = leerEntero(datos.stock_minimo ?? 0, 'stock_minimo', 'El stock mínimo', errores);
  const stockActual = esCreacion
    ? leerEntero(datos.stock_actual ?? 0, 'stock_actual', 'El stock inicial', errores)
    : 0;

  const controla = datos.controla_vencimiento === true || datos.controla_vencimiento === 1 ? 1 : 0;

  if (Object.keys(errores).length > 0) {
    throw new ErrorApp(400, 'VALIDACION', 'Hay datos que corregir', errores);
  }

  return {
    codigo_barras: codigo,
    nombre,
    categoria_id: categoriaId,
    tipo_unidad: datos.tipo_unidad,
    costo,
    precio_venta: precio,
    stock_actual: stockActual,
    stock_minimo: stockMinimo,
    controla_vencimiento: controla,
  };
}

function verificarCategoria(categoriaId) {
  if (categoriaId !== null && !repoCategorias.existe(categoriaId)) {
    throw new ErrorApp(400, 'VALIDACION', 'Hay datos que corregir', {
      categoria_id: 'La categoría elegida no existe',
    });
  }
}

// Si otro producto (distinto de "idPropio") ya usa ese código, se rechaza.
function verificarCodigoLibre(codigo, idPropio) {
  if (codigo === null) return;
  const existente = repo.buscarPorCodigo(codigo);
  if (existente && existente.id !== idPropio) {
    throw new ErrorApp(409, 'CODIGO_DUPLICADO', 'Ese código de barras ya existe', {
      codigo_barras: `Ese código ya pertenece a "${existente.nombre}"`,
    });
  }
}

function obtenerOFallar(id) {
  const producto = repo.buscarPorId(id);
  if (!producto) throw new ErrorApp(404, 'PRODUCTO_NO_ENCONTRADO', 'El producto no existe');
  return producto;
}

// ---------- Funciones que usan las rutas ----------

export function listar(query = {}) {
  return repo.listar({
    buscar: String(query.buscar ?? '').trim(),
    categoriaId: query.categoriaId ? aId(query.categoriaId) : null,
    soloBajo: query.soloBajo === '1',
    incluirInactivos: query.incluirInactivos === '1',
  });
}

export function obtener(idCrudo) {
  return obtenerOFallar(aId(idCrudo));
}

export function obtenerPorCodigo(codigoCrudo) {
  const producto = repo.buscarPorCodigo(String(codigoCrudo).trim());
  if (!producto) throw new ErrorApp(404, 'PRODUCTO_NO_ENCONTRADO', 'No hay un producto con ese código');
  return producto;
}

// Se hace dentro de una transacción: la comprobación de duplicado y el INSERT
// ocurren juntos, sin que nadie se pueda "colar" en el medio.
export function crear(datos) {
  const p = validar(datos, { esCreacion: true });
  return transaccion(() => {
    verificarCategoria(p.categoria_id);
    verificarCodigoLibre(p.codigo_barras, null);
    const id = repo.insertar(p);
    // El stock inicial también es un movimiento: así el historial explica TODO el stock.
    if (p.stock_actual > 0) {
      repoMov.registrar({
        productoId: id, tipo: 'STOCK_INICIAL', cantidad: p.stock_actual,
        stockResultante: p.stock_actual, motivo: 'Stock inicial al crear el producto',
      });
    }
    return repo.buscarPorId(id);
  });
}

export function actualizar(idCrudo, datos) {
  const id = aId(idCrudo);
  const p = validar(datos, { esCreacion: false });
  return transaccion(() => {
    const actual = obtenerOFallar(id);
    if (p.tipo_unidad !== actual.tipo_unidad) {
      throw new ErrorApp(409, 'TIPO_UNIDAD_INMUTABLE',
        'No se puede cambiar el tipo de unidad de un producto ya creado');
    }
    verificarCategoria(p.categoria_id);
    verificarCodigoLibre(p.codigo_barras, id);
    repo.actualizar(id, p);
    return repo.buscarPorId(id);
  });
}

export function darDeBaja(idCrudo) {
  const id = aId(idCrudo);
  obtenerOFallar(id);
  repo.cambiarActivo(id, 0);
  return repo.buscarPorId(id);
}

export function reactivar(idCrudo) {
  const id = aId(idCrudo);
  obtenerOFallar(id);
  repo.cambiarActivo(id, 1);
  return repo.buscarPorId(id);
}

export function movimientos(idCrudo) {
  const id = aId(idCrudo);
  obtenerOFallar(id);
  return repoMov.listarPorProducto(id);
}

export function lotes(idCrudo) {
  const id = aId(idCrudo);
  obtenerOFallar(id);
  return repoLotes.listarActivos(id);
}

// Cambio de precio puntual (lo usan las sugerencias del ingreso de mercadería).
export function cambiarPrecio(idCrudo, datos) {
  const id = aId(idCrudo);
  const precio = datos?.precio_venta;
  if (!Number.isInteger(precio) || precio <= 0 || precio > MAXIMO) {
    throw new ErrorApp(400, 'VALIDACION', 'Hay datos que corregir', {
      precio_venta: 'El precio debe ser mayor a 0',
    });
  }
  obtenerOFallar(id);
  repo.cambiarPrecio(id, precio);
  return repo.buscarPorId(id);
}