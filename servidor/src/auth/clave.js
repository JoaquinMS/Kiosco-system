// Hash de contraseñas con scrypt (incluido en Node, no requiere instalar ni compilar nada).
import { scrypt, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const N = 16384, R = 8, P = 1;

// Formato guardado: scrypt$N$r$p$sal$hash
export async function hashear(clave) {
  const sal = randomBytes(16);
  const hash = await scryptAsync(clave, sal, 64, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${hash.toString('base64')}`;
}

export async function verificar(clave, guardado) {
  const partes = String(guardado).split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, n, r, p, sal, hash] = partes;
  const esperado = Buffer.from(hash, 'base64');
  const calculado = await scryptAsync(clave, Buffer.from(sal, 'base64'), esperado.length,
    { N: Number(n), r: Number(r), p: Number(p) });
  return timingSafeEqual(calculado, esperado); // comparación en tiempo constante
}

// Sin letras confusas (0/O, 1/l/I).
const ALFABETO = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generarClaveTemporal(largo = 12) {
  return Array.from({ length: largo }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
}