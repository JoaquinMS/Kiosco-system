// Generación de CSV pensado para Excel en español: separador ";", coma decimal, BOM UTF-8.

function celda(valor) {
  const t = valor === null || valor === undefined ? '' : String(valor);
  return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function aCsv(encabezados, filas) {
  const lineas = [encabezados, ...filas].map((fila) => fila.map(celda).join(';'));
  return '\uFEFF' + lineas.join('\r\n') + '\r\n'; // \uFEFF = BOM: Excel reconoce las tildes
}

// 150050 centavos -> "1500,50"
export const pesosCsv = (centavos) => (centavos / 100).toFixed(2).replace('.', ',');

// UNIDAD: "3" | PESO (gramos): "0,250" (kg)
export const cantidadCsv = (cantidad, tipoUnidad) =>
  tipoUnidad === 'PESO' ? (cantidad / 1000).toFixed(3).replace('.', ',') : String(cantidad);

// Un texto que empieza con = + - @ podría ejecutarse como fórmula en Excel: se neutraliza.
export const textoSeguro = (t) => (/^[=+\-@]/.test(t) ? `'${t}` : t);