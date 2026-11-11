// Define las tablas. "IF NOT EXISTS" permite ejecutarlo muchas veces sin romper nada.
import db from './conexion.js';
import { crearTablasEtapa5 } from './esquema5.js';
import { crearTablasEtapa6 } from './esquema6.js';

export function crearTablas() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categorias (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre  TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS productos (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_barras       TEXT UNIQUE,                      -- puede ser NULL (pan, fiambre suelto)
      nombre              TEXT NOT NULL,
      categoria_id        INTEGER REFERENCES categorias(id),
      tipo_unidad         TEXT NOT NULL DEFAULT 'UNIDAD'
                          CHECK (tipo_unidad IN ('UNIDAD', 'PESO')),
      costo               INTEGER NOT NULL DEFAULT 0 CHECK (costo >= 0),         -- centavos
      precio_venta        INTEGER NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),  -- centavos
      stock_actual        INTEGER NOT NULL DEFAULT 0,       -- unidades o gramos
      stock_minimo        INTEGER NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
      controla_vencimiento INTEGER NOT NULL DEFAULT 0 CHECK (controla_vencimiento IN (0, 1)),
      activo              INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
      creado_en           TEXT NOT NULL DEFAULT (datetime('now')),   -- hora UTC
      actualizado_en      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);
    CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);

    -- ====== Etapa 4 ======

    -- Libro mayor del stock: SOLO se insertan filas. cantidad > 0 entra, cantidad < 0 sale.
    CREATE TABLE IF NOT EXISTS movimientos_stock (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id      INTEGER NOT NULL REFERENCES productos(id),
      tipo             TEXT NOT NULL CHECK (tipo IN
                         ('STOCK_INICIAL', 'VENTA', 'COMPRA', 'AJUSTE', 'ANULACION_VENTA')),
      cantidad         INTEGER NOT NULL CHECK (cantidad <> 0),  -- con signo, en unidad base
      stock_resultante INTEGER NOT NULL,                        -- stock después del movimiento
      motivo           TEXT,
      ref_tipo         TEXT,                                    -- 'VENTA', 'COMPRA'...
      ref_id           INTEGER,                                 -- id de la venta o compra de origen
      creado_en        TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_mov_producto ON movimientos_stock(producto_id, creado_en);
    CREATE INDEX IF NOT EXISTS idx_mov_ref ON movimientos_stock(ref_tipo, ref_id);

    -- Inmutabilidad: la base rechaza cualquier intento de modificar o borrar el historial.
    CREATE TRIGGER IF NOT EXISTS mov_stock_no_update BEFORE UPDATE ON movimientos_stock
    BEGIN
      SELECT RAISE(ABORT, 'movimientos_stock es de solo inserción');
    END;
    CREATE TRIGGER IF NOT EXISTS mov_stock_no_delete BEFORE DELETE ON movimientos_stock
    BEGIN
      SELECT RAISE(ABORT, 'movimientos_stock es de solo inserción');
    END;

    CREATE TABLE IF NOT EXISTS ventas (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      client_uuid  TEXT NOT NULL UNIQUE,     -- evita cobrar dos veces la misma venta
      subtotal     INTEGER NOT NULL CHECK (subtotal >= 0),   -- centavos
      descuento    INTEGER NOT NULL DEFAULT 0 CHECK (descuento >= 0),
      total        INTEGER NOT NULL CHECK (total >= 0),
      vuelto       INTEGER NOT NULL DEFAULT 0 CHECK (vuelto >= 0),
      estado       TEXT NOT NULL DEFAULT 'COMPLETADA' CHECK (estado IN ('COMPLETADA', 'ANULADA')),
      creado_en    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(creado_en);

    -- Snapshots: nombre, precio y costo del MOMENTO de la venta.
    CREATE TABLE IF NOT EXISTS venta_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id        INTEGER NOT NULL REFERENCES ventas(id),
      producto_id     INTEGER NOT NULL REFERENCES productos(id),
      nombre_snapshot TEXT NOT NULL,
      tipo_unidad     TEXT NOT NULL,
      cantidad        INTEGER NOT NULL CHECK (cantidad > 0),  -- unidad base
      precio_unitario INTEGER NOT NULL,                       -- por unidad o por kg
      costo_unitario  INTEGER NOT NULL,
      subtotal        INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_venta_items_venta ON venta_items(venta_id);
    CREATE INDEX IF NOT EXISTS idx_venta_items_producto ON venta_items(producto_id);

    CREATE TABLE IF NOT EXISTS venta_pagos (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id  INTEGER NOT NULL REFERENCES ventas(id),
      medio     TEXT NOT NULL CHECK (medio IN ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA')),
      monto     INTEGER NOT NULL CHECK (monto > 0)
    );
    CREATE INDEX IF NOT EXISTS idx_venta_pagos_venta ON venta_pagos(venta_id);
  `);

  migrarStockInicial();
  crearTablasEtapa5();
  migrarStockInicial();
  crearTablasEtapa5();
  crearTablasEtapa6();
}

// Los productos creados antes de esta etapa tienen stock pero ningún movimiento.
// Les creamos un movimiento STOCK_INICIAL para que el historial explique su stock.
// Es seguro ejecutarlo muchas veces: solo afecta a productos sin movimientos.
function migrarStockInicial() {
  db.exec(`
    INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_resultante, motivo)
    SELECT p.id, 'STOCK_INICIAL', p.stock_actual, p.stock_actual, 'Stock inicial (migración)'
    FROM productos p
    WHERE p.stock_actual <> 0
      AND NOT EXISTS (SELECT 1 FROM movimientos_stock m WHERE m.producto_id = p.id)
  `);
}