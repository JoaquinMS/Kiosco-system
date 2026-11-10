// Tablas de la Etapa 5: proveedores, compras, lotes. También agrega columnas nuevas
// a tablas que ya existen (SQLite lo permite con ALTER TABLE ... ADD COLUMN).
import db from './conexion.js';

function tieneColumna(tabla, columna) {
  return db.prepare(`PRAGMA table_info(${tabla})`).all().some((c) => c.name === columna);
}

export function crearTablasEtapa5() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS proveedores (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre  TEXT COLLATE NOCASE NOT NULL UNIQUE,
      activo  INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1))
    );

    CREATE TABLE IF NOT EXISTS compras (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      client_uuid     TEXT NOT NULL UNIQUE,      -- evita sumar el stock dos veces
      proveedor_id    INTEGER REFERENCES proveedores(id),
      nro_comprobante TEXT,
      total           INTEGER NOT NULL CHECK (total >= 0),   -- centavos
      creado_en       TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras(creado_en);

    CREATE TABLE IF NOT EXISTS compra_items (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      compra_id         INTEGER NOT NULL REFERENCES compras(id),
      producto_id       INTEGER NOT NULL REFERENCES productos(id),
      cantidad          INTEGER NOT NULL CHECK (cantidad > 0),         -- unidad base
      costo_unitario    INTEGER NOT NULL CHECK (costo_unitario >= 0),  -- por unidad o por kg
      fecha_vencimiento TEXT,                                          -- 'AAAA-MM-DD' o NULL
      subtotal          INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_compra_items_compra ON compra_items(compra_id);

    -- Un lote = una entrada de un producto que vence, con su fecha.
    CREATE TABLE IF NOT EXISTS lotes (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id       INTEGER NOT NULL REFERENCES productos(id),
      compra_item_id    INTEGER REFERENCES compra_items(id),
      fecha_vencimiento TEXT NOT NULL,
      cantidad_inicial  INTEGER NOT NULL CHECK (cantidad_inicial > 0),
      cantidad_restante INTEGER NOT NULL CHECK (cantidad_restante >= 0),
      creado_en         TEXT NOT NULL DEFAULT (datetime('now'))
    );
    -- Índice parcial: solo lotes con stock. Sirve para FEFO y para las alertas de vencimiento.
    CREATE INDEX IF NOT EXISTS idx_lotes_producto
      ON lotes(producto_id, fecha_vencimiento) WHERE cantidad_restante > 0;
  `);

  // Costo promedio ponderado: columna nueva en productos.
  if (!tieneColumna('productos', 'costo_promedio')) {
    db.exec('ALTER TABLE productos ADD COLUMN costo_promedio INTEGER NOT NULL DEFAULT 0');
    db.exec('UPDATE productos SET costo_promedio = costo'); // punto de partida
  }
  // Nota libre en los movimientos (por ejemplo, el detalle de una rotura).
  if (!tieneColumna('movimientos_stock', 'nota')) {
    db.exec('ALTER TABLE movimientos_stock ADD COLUMN nota TEXT');
  }
}