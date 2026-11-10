// Cálculos de dinero. Todo en centavos enteros. El servidor es la autoridad:
// la pantalla usa la misma fórmula solo para mostrar el total antes de cobrar.

// Tope por seguridad: $100.000.000,00. Evita números que JavaScript no maneja con exactitud.
export const MAX_MONTO = 10_000_000_000;

// Subtotal de una línea.
//   UNIDAD: precio por unidad x cantidad de unidades.
//   PESO:   precio por KG x gramos / 1000.
export function subtotalLinea(precioUnitario, cantidad, tipoUnidad) {
  const divisor = tipoUnidad === 'PESO' ? 1000 : 1;
  return Math.round((precioUnitario * cantidad) / divisor);
}

// descuento = null | { tipo: 'PORCENTAJE', valor } | { tipo: 'MONTO', valor }
//   PORCENTAJE: valor en centésimas de punto (10 % = 1000, 12,5 % = 1250).
//   MONTO: valor en centavos.
export function calcularDescuento(subtotal, descuento) {
  if (!descuento) return 0;
  if (descuento.tipo === 'PORCENTAJE') return Math.round((subtotal * descuento.valor) / 10000);
  return descuento.valor;
}