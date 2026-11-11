import * as repo from '../repositorios/alertas.js';
import { ErrorApp } from '../lib/errores.js';
import { DIAS_AVISO_VENCIMIENTO } from '../config.js';

// Sugerencia de reposición: llevar el stock al doble del mínimo.
function sugerido(p) {
  const falta = p.stock_minimo * 2 - p.stock_actual;
  return falta > 0 ? falta : p.stock_minimo;
}

export function obtener(query = {}) {
  let dias = DIAS_AVISO_VENCIMIENTO;
  if (query.dias !== undefined) {
    dias = Number(query.dias);
    if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
      throw new ErrorApp(400, 'VALIDACION', 'Hay datos que corregir', {
        dias: 'Los días de aviso deben ser un número entre 1 y 365',
      });
    }
  }
  return {
    dias_aviso: dias,
    stock_bajo: repo.stockBajo().map((p) => ({ ...p, sugerido: sugerido(p) })),
    vencimientos: repo.lotesPorVencer(dias),
  };
}