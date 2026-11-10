// Conversión entre lo que escribe/ve la persona (pesos, kilos) y lo que guarda la base
// (centavos, gramos). TODA la conversión vive en este archivo.

// "1.200,50" -> 1200.5 | "1200,50" -> 1200.5 | "1200.50" -> 1200.5 | "abc" -> NaN
// Regla: si hay coma, la coma es el decimal y los puntos son miles.
function leerNumero(texto) {
  let t = String(texto).trim().replace(/\s/g, '').replace('$', '');
  if (t === '') return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return Number(t);
}

// Texto en pesos -> centavos enteros. "1200,50" -> 120050
export function pesosACentavos(texto) {
  const n = leerNumero(texto);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}

// Texto de cantidad -> unidad base. UNIDAD: "3" -> 3 | PESO: "1,8" (kg) -> 1800 (g)
export function cantidadABase(texto, tipoUnidad) {
  const n = leerNumero(texto);
  if (!Number.isFinite(n) || n < 0) return NaN;
  if (tipoUnidad === 'PESO') return Math.round(n * 1000);
  return Number.isInteger(n) ? n : NaN; // las unidades no pueden ser decimales
}

// ---- Para mostrar en la lista ----
export function formatearPesos(centavos) {
  return '$ ' + (centavos / 100).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatearCantidad(base, tipoUnidad) {
  if (tipoUnidad === 'PESO') {
    return (base / 1000).toLocaleString('es-AR', { maximumFractionDigits: 3 }) + ' kg';
  }
  return String(base);
}

// ---- Para rellenar los campos del formulario al editar ----
export function centavosATexto(centavos) {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

export function baseATexto(base, tipoUnidad) {
  return tipoUnidad === 'PESO' ? String(base / 1000).replace('.', ',') : String(base);
}

// ---- Etapa 4: cálculos de la caja ----
// Misma fórmula que el servidor (servidor/src/lib/dinero.js). El servidor es la autoridad;
// acá solo se usa para mostrar el total antes de cobrar.
export function subtotalLinea(precio, cantidad, tipoUnidad) {
  const divisor = tipoUnidad === 'PESO' ? 1000 : 1;
  return Math.round((precio * cantidad) / divisor);
}

// Convierte el descuento escrito en { centavos (para mostrar), payload (para enviar), error }.
export function resolverDescuento(subtotal, tipo, texto) {
  const vacio = { centavos: 0, payload: null, error: null };
  if (texto.trim() === '') return vacio;

  if (tipo === 'PORCENTAJE') {
    const n = leerNumero(texto);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return { ...vacio, error: 'El porcentaje debe estar entre 0 y 100' };
    }
    const puntos = Math.round(n * 100); // 10 % -> 1000 (centésimas de punto)
    if (puntos === 0) return vacio;
    return {
      centavos: Math.round((subtotal * puntos) / 10000),
      payload: { tipo: 'PORCENTAJE', valor: puntos },
      error: null,
    };
  }

  const c = pesosACentavos(texto);
  if (Number.isNaN(c)) return { ...vacio, error: 'Escribí un monto válido, por ejemplo 150' };
  if (c > subtotal) return { ...vacio, error: 'El descuento no puede superar el subtotal' };
  if (c === 0) return vacio;
  return { centavos: c, payload: { tipo: 'MONTO', valor: c }, error: null };
}

// La base guarda la hora en UTC ("2026-10-13 15:30:00"). Se muestra en hora de Mendoza.
export function formatearFechaHora(utc) {
  const fecha = new Date(utc.replace(' ', 'T') + 'Z');
  return fecha.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Mendoza',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

// Identificador único de venta. crypto.randomUUID solo existe en "contextos seguros"
// (localhost o https); si abrís el sistema por la IP de la red, usamos una alternativa.
export function nuevoUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}

// ---- Etapa 5 ----
// Fecha de hoy en Argentina, 'AAAA-MM-DD' (el mismo formato que usa <input type="date">).
export function hoyISO() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Mendoza' });
}

// '2026-11-15' -> '15/11/2026'
export function formatearFecha(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

// 24 -> '+24' | -3 -> '−3' | 250 (PESO) -> '+0,25 kg'
export function formatearCantidadConSigno(base, tipoUnidad) {
  const signo = base > 0 ? '+' : base < 0 ? '−' : '';
  return signo + formatearCantidad(Math.abs(base), tipoUnidad);
}