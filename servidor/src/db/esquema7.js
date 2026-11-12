// Etapa 7: usuarios, sesiones e historial de precios. También agrega columnas a tablas existentes.
import db from './conexion.js';

const tieneColumna = (tabla, columna) =>
  db.prepare(`PRAGMA table_info(${tabla})`).all().some((c) => c.name === columna);

function agregarColumna(tabla, columna, definicion) {
  if (tieneColumna(tabla, columna)) return false;
  db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
  return true;
}

export function crearTablasEtapa7() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      username           TEXT COLLATE NOCASE NOT NULL UNIQUE,
      nombre             TEXT NOT NULL,
      password_hash      TEXT NOT NULL,
      rol                TEXT NOT NULL CHECK (rol IN ('ADMIN', 'DUENO', 'EMPLEADO')),
      activo             INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
      debe_cambiar_clave INTEGER NOT NULL DEFAULT 0 CHECK (debe_cambiar_clave IN (0, 1)),
      creado_en          TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- "id" es el HASH del token (el token real solo vive en la cookie del navegador).
    CREATE TABLE IF NOT EXISTS sesiones (
      id          TEXT PRIMARY KEY,
      usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
      creada_en   TEXT NOT NULL DEFAULT (datetime('now')),
      expira_en   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);

    -- Una fila por cada actualización masiva (sirve para deshacerla).
    CREATE TABLE IF NOT EXISTS cambios_precios (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      descripcion   TEXT NOT NULL,
      porcentaje    INTEGER NOT NULL,                 -- centésimas de punto
      usuario_id    INTEGER REFERENCES usuarios(id),
      creado_en     TEXT NOT NULL DEFAULT (datetime('now')),
      deshecho_en   TEXT,
      deshecho_por  INTEGER REFERENCES usuarios(id)
    );

    -- Cada cambio de precio de cada producto deja una fila.
    CREATE TABLE IF NOT EXISTS historial_precios (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id      INTEGER NOT NULL REFERENCES productos(id),
      precio_anterior  INTEGER NOT NULL,
      precio_nuevo     INTEGER NOT NULL,
      motivo           TEXT NOT NULL CHECK (motivo IN ('EDICION', 'SUGERENCIA', 'MASIVO', 'DESHACER')),
      cambio_id        INTEGER REFERENCES cambios_precios(id),
      usuario_id       INTEGER REFERENCES usuarios(id),
      creado_en        TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_hist_precios_producto ON historial_precios(producto_id, creado_en);
    CREATE INDEX IF NOT EXISTS idx_hist_precios_cambio ON historial_precios(cambio_id);
  `);

  // Quién hizo cada cosa (queda NULL en lo registrado antes de esta etapa).
  agregarColumna('ventas', 'usuario_id', 'INTEGER REFERENCES usuarios(id)');
  agregarColumna('ventas', 'autorizado_por', 'INTEGER REFERENCES usuarios(id)');
  agregarColumna('ventas', 'anulada_en', 'TEXT');
  agregarColumna('ventas', 'anulada_por', 'INTEGER REFERENCES usuarios(id)');
  agregarColumna('ventas', 'anulada_motivo', 'TEXT');
  agregarColumna('movimientos_stock', 'usuario_id', 'INTEGER REFERENCES usuarios(id)');
  agregarColumna('compras', 'usuario_id', 'INTEGER REFERENCES usuarios(id)');

  // Proveedor habitual: el del último ingreso. Los ingresos anteriores se copian una sola vez.
  if (agregarColumna('productos', 'proveedor_id', 'INTEGER REFERENCES proveedores(id)')) {
    db.exec(`
      UPDATE productos SET proveedor_id = (
        SELECT c.proveedor_id
        FROM compra_items ci JOIN compras c ON c.id = ci.compra_id
        WHERE ci.producto_id = productos.id AND c.proveedor_id IS NOT NULL
        ORDER BY c.id DESC LIMIT 1
      )
    `);
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_productos_proveedor ON productos(proveedor_id)');
}