// Campo de texto que siempre intenta tener el foco, para recibir lo que "tipea" el lector.
import { useEffect } from 'react';
import { useDetectorEscaneo } from './useDetectorEscaneo.js';

// onCodigo(texto, { esEscaneo, promedioMs }) se llama al apretar Enter.
// bloqueado = true cuando hay una ventana abierta: no hay que robarle el foco.
// refCampo permite que la pantalla pueda devolverle el foco cuando quiera.
export default function CampoEscaneo({ onCodigo, bloqueado = false, refCampo }) {
  const detector = useDetectorEscaneo();

  // Enfocar al abrir la pantalla y cada vez que se cierra una ventana.
  useEffect(() => {
    if (!bloqueado) refCampo.current?.focus();
  }, [bloqueado, refCampo]);

  function alTecla(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const texto = e.currentTarget.value.trim();
      if (texto === '') return;

      const medicion = detector.evaluar(texto);
      e.currentTarget.value = ''; // listo para el próximo producto
      detector.reiniciar();
      onCodigo(texto, medicion);
      return;
    }
    detector.registrarTecla(e);
  }

  // Si el foco se perdió "en el vacío" (clic en una zona sin nada), lo recuperamos.
  // Si pasó a otro control (un botón, un modal), lo respetamos.
  function alPerderFoco() {
    setTimeout(() => {
      if (!bloqueado && document.activeElement === document.body) {
        refCampo.current?.focus();
      }
    }, 100);
  }

  return (
    <input
      ref={refCampo}
      className="campo-escaneo"
      placeholder="Escaneá un producto o escribí un nombre y apretá Enter…"
      onKeyDown={alTecla}
      onBlur={alPerderFoco}
      autoComplete="off"
      spellCheck={false}
    />
  );
}