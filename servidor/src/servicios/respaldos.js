// Respaldos de la base. VACUUM INTO genera una copia coherente aunque el servidor esté en uso.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import db from '../db/conexion.js';
import { ErrorApp } from '../lib/errores.js';
import { hoyArgentina } from '../lib/fechas.js';
import { RESPALDOS_A_CONSERVAR, CARPETA_COPIA_EXTRA } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARPETA = process.env.KIOSCO_RESPALDOS ?? path.join(__dirname, '..', '..', 'respaldos');
const PATRON = /^kiosco-\d{4}-\d{2}-\d{2}_\d{6}\.db$/;

// 2026-11-17_140509 (hora argentina, UTC-3)
function marca() {
  const local = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  return `${local.slice(0, 10)}_${local.slice(11, 13)}${local.slice(14, 16)}${local.slice(17, 19)}`;
}

export function listarRespaldos() {
  if (!fs.existsSync(CARPETA)) return [];
  return fs.readdirSync(CARPETA)
    .filter((n) => PATRON.test(n))
    .sort()
    .reverse() // el más nuevo primero
    .map((nombre) => {
      const st = fs.statSync(path.join(CARPETA, nombre));
      return {
        nombre,
        tamano: st.size,
        creado: st.mtime.toISOString().slice(0, 19).replace('T', ' '), // UTC, como la base
      };
    });
}

// Valida el nombre ANTES de tocar el disco (evita que pidan "../../algo").
export function rutaRespaldo(nombre) {
  if (typeof nombre !== 'string' || !PATRON.test(nombre)) {
    throw new ErrorApp(400, 'NOMBRE_INVALIDO', 'El nombre del respaldo no es válido');
  }
  const ruta = path.join(CARPETA, nombre);
  if (!fs.existsSync(ruta)) throw new ErrorApp(404, 'RESPALDO_NO_ENCONTRADO', 'Ese respaldo no existe');
  return ruta;
}

function rotar() {
  for (const viejo of listarRespaldos().slice(RESPALDOS_A_CONSERVAR)) {
    fs.rmSync(path.join(CARPETA, viejo.nombre), { force: true });
  }
}

function copiarAExtra(origen, nombre) {
  if (!CARPETA_COPIA_EXTRA) return false;
  try {
    fs.mkdirSync(CARPETA_COPIA_EXTRA, { recursive: true });
    fs.copyFileSync(origen, path.join(CARPETA_COPIA_EXTRA, nombre));
    return true;
  } catch (error) {
    console.error('No se pudo copiar el respaldo a la carpeta extra:', error.message);
    return false;
  }
}

export function crearRespaldo() {
  fs.mkdirSync(CARPETA, { recursive: true });
  const nombre = `kiosco-${marca()}.db`;
  const destino = path.join(CARPETA, nombre);

  // El nombre lo generamos nosotros (sin datos del usuario), pero igual se escapan las comillas.
  db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);

  // Se comprueba que la copia sea una base sana. Si no, se descarta.
  const copia = new DatabaseSync(destino);
  let estado;
  try {
    estado = copia.prepare('PRAGMA integrity_check').get().integrity_check;
  } finally {
    copia.close();
  }
  if (estado !== 'ok') {
    fs.rmSync(destino, { force: true });
    throw new Error('El respaldo no pasó la verificación de integridad');
  }

  const copiaExtra = copiarAExtra(destino, nombre);
  rotar();
  return { nombre, tamano: fs.statSync(destino).size, copia_extra: copiaExtra };
}

// Hace un respaldo al arrancar y, después, cada vez que cambia el día y todavía no hay uno de hoy.
export function iniciarAutomatico(log) {
  function revisar() {
    try {
      const hoy = hoyArgentina();
      if (!listarRespaldos().some((r) => r.nombre.startsWith(`kiosco-${hoy}_`))) {
        const r = crearRespaldo();
        log.info(`Respaldo automático creado: ${r.nombre}`);
      }
    } catch (error) {
      log.error(error, 'Falló el respaldo automático');
    }
  }
  revisar();
  setInterval(revisar, 30 * 60 * 1000).unref(); // revisa cada 30 minutos
}