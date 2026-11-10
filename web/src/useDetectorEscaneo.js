// Mide la velocidad de tipeo para distinguir un escaneo de una persona escribiendo.
import { useRef } from 'react';

export function useDetectorEscaneo({ minLongitud = 4, maxMsPromedio = 50 } = {}) {
  // Guarda la hora de cada tecla del texto actual (no provoca re-dibujado: es un ref).
  const tiempos = useRef([]);

  // Se llama en cada keydown del campo.
  function registrarTecla(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    // Si la persona borra, el texto ya no es "de corrido": se descarta la medición.
    if (e.key === 'Backspace' || e.key === 'Delete') {
      tiempos.current = [];
      return;
    }
    if (e.key.length !== 1) return; // Shift, Tab, flechas, etc. no cuentan

    // Si el campo estaba vacío, arranca una medición nueva.
    if (e.currentTarget.value === '') tiempos.current = [];
    tiempos.current.push(e.timeStamp);
  }

  // Se llama al apretar Enter, con el texto final.
  // Devuelve { esEscaneo, promedioMs }.
  function evaluar(texto) {
    // Si hay menos teclas que letras, parte del texto se pegó (Ctrl+V): no es un escaneo.
    if (texto.length < minLongitud || tiempos.current.length < texto.length) {
      return { esEscaneo: false, promedioMs: null };
    }
    const t = tiempos.current.slice(-texto.length);
    const promedioMs = (t[t.length - 1] - t[0]) / (t.length - 1);
    return { esEscaneo: promedioMs <= maxMsPromedio, promedioMs: Math.round(promedioMs) };
  }

  function reiniciar() {
    tiempos.current = [];
  }

  return { registrarTecla, evaluar, reiniciar };
}