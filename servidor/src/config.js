// Ajustes del negocio que podrías querer cambiar.

// true  = se puede vender aunque el sistema crea que no hay stock (queda en negativo y se avisa).
// false = se bloquea la venta si no alcanza el stock.
export const PERMITIR_STOCK_NEGATIVO = true;

// Cuántos días antes del vencimiento aparece un lote en las alertas.
export const DIAS_AVISO_VENCIMIENTO = 15;