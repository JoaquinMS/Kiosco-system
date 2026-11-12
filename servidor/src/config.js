// Ajustes del negocio que podrías querer cambiar.

// true  = se puede vender aunque el sistema crea que no hay stock (queda en negativo y se avisa).
// false = se bloquea la venta si no alcanza el stock.
export const PERMITIR_STOCK_NEGATIVO = true;

// Cuántos días antes del vencimiento aparece un lote en las alertas.
export const DIAS_AVISO_VENCIMIENTO = 15;

// ---- Etapa 7 ----
// Descuento máximo que puede dar un empleado sin autorización, en centésimas de punto (10 % = 1000).
export const DESCUENTO_MAX_EMPLEADO = 1000;

// ¿El empleado puede crear productos desde la caja (alta rápida)?
export const EMPLEADO_PUEDE_ALTA_RAPIDA = false;

// Horas que dura una sesión.
export const SESION_HORAS = 12;