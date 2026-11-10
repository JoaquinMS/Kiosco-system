// Ventana de cobro: medios de pago, pago mixto y vuelto.
import { useState } from 'react';
import { pesosACentavos, centavosATexto, formatearPesos } from './formato.js';

const MEDIOS = [
  { id: 'EFECTIVO', nombre: 'Efectivo' },
  { id: 'TRANSFERENCIA', nombre: 'Transferencia' },
  { id: 'TARJETA', nombre: 'Tarjeta' },
];

export default function ModalCobro({ total, guardando, error, onConfirmar, onCancelar }) {
  const [montos, setMontos] = useState({ EFECTIVO: '', TRANSFERENCIA: '', TARJETA: '' });

  // Convertir lo escrito a centavos
  const centavos = {};
  let hayInvalido = false;
  for (const m of MEDIOS) {
    const texto = montos[m.id].trim();
    const c = texto === '' ? 0 : pesosACentavos(texto);
    if (Number.isNaN(c)) hayInvalido = true;
    centavos[m.id] = Number.isNaN(c) ? 0 : c;
  }

  const recibido = centavos.EFECTIVO + centavos.TRANSFERENCIA + centavos.TARJETA;
  const vuelto = Math.max(recibido - total, 0);
  const faltante = Math.max(total - recibido, 0);
  const vueltoOk = vuelto <= centavos.EFECTIVO; // el vuelto solo sale del efectivo
  const puedeCobrar = !hayInvalido && recibido >= total && vueltoOk && !guardando;

  // Atajo: todo el total en un solo medio.
  function pagarTodoCon(medio) {
    setMontos({ EFECTIVO: '', TRANSFERENCIA: '', TARJETA: '', [medio]: centavosATexto(total) });
  }

  function enviar(e) {
    e.preventDefault();
    if (!puedeCobrar) return;
    const pagos = MEDIOS
      .filter((m) => centavos[m.id] > 0)
      .map((m) => ({ medio: m.id, monto: centavos[m.id] }));
    onConfirmar(pagos);
  }

  let claseResumen = 'resumen-pago';
  let textoResumen = 'Ingresá cuánto se recibe';
  if (hayInvalido) {
    textoResumen = 'Hay un monto que no es válido';
  } else if (recibido > 0 && faltante > 0) {
    claseResumen += ' falta';
    textoResumen = `Falta ${formatearPesos(faltante)}`;
  } else if (recibido >= total && !vueltoOk) {
    claseResumen += ' falta';
    textoResumen = 'El vuelto no puede ser mayor al efectivo recibido';
  } else if (recibido >= total) {
    claseResumen += ' ok';
    textoResumen = vuelto > 0 ? `Vuelto: ${formatearPesos(vuelto)}` : 'Pago exacto';
  }

  return (
    <div className="fondo-modal">
      <form className="modal" onSubmit={enviar} onKeyDown={(e) => e.key === 'Escape' && onCancelar()}>
        <h2>Cobrar {formatearPesos(total)}</h2>

        {error && <div className="error-general">{error}</div>}

        <div className="atajos">
          <button type="button" onClick={() => pagarTodoCon('EFECTIVO')}>Efectivo exacto</button>
          <button type="button" onClick={() => pagarTodoCon('TRANSFERENCIA')}>Todo transferencia</button>
          <button type="button" onClick={() => pagarTodoCon('TARJETA')}>Todo tarjeta</button>
        </div>

        {MEDIOS.map((m, i) => (
          <div className="pago-fila" key={m.id}>
            <span>{m.nombre}</span>
            <input
              autoFocus={i === 0}
              value={montos[m.id]}
              onChange={(e) => setMontos((previo) => ({ ...previo, [m.id]: e.target.value }))}
              inputMode="decimal"
              placeholder="0,00"
            />
          </div>
        ))}

        <div className={claseResumen}>{textoResumen}</div>

        <div className="botones">
          <button type="button" onClick={onCancelar}>Volver</button>
          <button type="submit" className="primario" disabled={!puedeCobrar}>
            {guardando ? 'Registrando…' : 'Confirmar venta'}
          </button>
        </div>
      </form>
    </div>
  );
}