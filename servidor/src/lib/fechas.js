// Fechas en formato 'AAAA-MM-DD'. Argentina (Mendoza) es UTC-3 todo el año.

// Fecha de hoy en Argentina (el idioma sueco usa el formato AAAA-MM-DD).
export const hoyArgentina = () =>
  new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Mendoza' });

export function fechaValida(txt) {
  if (typeof txt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(txt)) return false;
  const d = new Date(`${txt}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === txt; // rechaza 30/02
}

export function sumarDias(iso, dias) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(desde, hasta) {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);
}