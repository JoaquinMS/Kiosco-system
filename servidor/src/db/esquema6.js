// Etapa 6: guarda también el costo promedio en cada ítem vendido, para poder
// calcular la ganancia con cualquiera de los dos costos.
import db from './conexion.js';

function tieneColumna(tabla, columna) {
  return db.prepare(`PRAGMA table_info(${tabla})`).all().some((c) => c.name === columna);
}

export function crearTablasEtapa6() {
  if (!tieneColumna('venta_items', 'costo_promedio_unitario')) {
    db.exec('ALTER TABLE venta_items ADD COLUMN costo_promedio_unitario INTEGER NOT NULL DEFAULT 0');
    // Las ventas anteriores no guardaron el promedio: se usa el último costo que sí tenían.
    db.exec('UPDATE venta_items SET costo_promedio_unitario = costo_unitario');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_ventas_estado_fecha ON ventas(estado, creado_en)');
}