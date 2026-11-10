import * as repo from '../repositorios/proveedores.js';
import { ErrorApp } from '../lib/errores.js';

export function listar() {
  return repo.listar();
}

export function crear(datos) {
  const nombre = typeof datos?.nombre === 'string' ? datos.nombre.trim() : '';
  if (nombre.length < 1 || nombre.length > 80) {
    throw new ErrorApp(400, 'VALIDACION', 'Hay datos que corregir', {
      nombre: 'El nombre es obligatorio (hasta 80 caracteres)',
    });
  }
  if (repo.buscarPorNombre(nombre)) {
    throw new ErrorApp(409, 'PROVEEDOR_DUPLICADO', 'Ese proveedor ya existe');
  }
  return repo.buscarPorId(repo.crear(nombre));
}