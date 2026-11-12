// Consultas SQL de usuarios y sesiones.
import db from '../db/conexion.js';

const PUBLICOS = 'id, username, nombre, rol, activo, debe_cambiar_clave, creado_en';

export const contar = () => db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;

// Incluye el hash: solo para verificar contraseñas.
export const buscarPorUsername = (username) =>
  db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);

export const buscarPorId = (id) =>
  db.prepare(`SELECT ${PUBLICOS} FROM usuarios WHERE id = ?`).get(id);

export function listar(soloEmpleados) {
  const where = soloEmpleados ? "WHERE rol = 'EMPLEADO'" : '';
  return db.prepare(`
    SELECT ${PUBLICOS} FROM usuarios ${where}
    ORDER BY activo DESC, rol, nombre COLLATE NOCASE
  `).all();
}

export function crear({ username, nombre, hash, rol, debeCambiarClave = 1 }) {
  const r = db.prepare(`
    INSERT INTO usuarios (username, nombre, password_hash, rol, debe_cambiar_clave)
    VALUES (?, ?, ?, ?, ?)
  `).run(username, nombre, hash, rol, debeCambiarClave);
  return Number(r.lastInsertRowid);
}

export function actualizar(id, { nombre, rol, activo }) {
  db.prepare('UPDATE usuarios SET nombre = ?, rol = ?, activo = ? WHERE id = ?')
    .run(nombre, rol, activo, id);
}

export function cambiarClave(id, hash, debeCambiar) {
  db.prepare('UPDATE usuarios SET password_hash = ?, debe_cambiar_clave = ? WHERE id = ?')
    .run(hash, debeCambiar, id);
}

export const contarAdminsActivos = () =>
  db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'ADMIN' AND activo = 1").get().n;

// ---- Sesiones ----
export function crearSesion(idHash, usuarioId, horas) {
  db.prepare(`INSERT INTO sesiones (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', ?))`)
    .run(idHash, usuarioId, `+${horas} hours`);
}

// Solo devuelve la sesión si no venció Y el usuario sigue activo.
export function buscarSesion(idHash) {
  return db.prepare(`
    SELECT u.id, u.username, u.nombre, u.rol, u.debe_cambiar_clave, s.id AS sesion_id
    FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.id = ? AND s.expira_en > datetime('now') AND u.activo = 1
  `).get(idHash);
}

export const borrarSesion = (idHash) =>
  db.prepare('DELETE FROM sesiones WHERE id = ?').run(idHash);

export const borrarSesionesDe = (usuarioId, excepto = null) =>
  db.prepare("DELETE FROM sesiones WHERE usuario_id = ? AND id <> COALESCE(?, '')")
    .run(usuarioId, excepto);

export const borrarSesionesVencidas = () =>
  db.prepare("DELETE FROM sesiones WHERE expira_en <= datetime('now')").run();