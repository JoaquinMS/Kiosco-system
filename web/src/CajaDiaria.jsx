import { useEffect, useState } from 'react';
import { api } from './api.js';
import { formatearPesos, formatearFechaHora, pesosACentavos, hoyISO } from './formato.js';

const NOMBRE_MEDIO = { EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', TARJETA: 'Tarjeta' };

// Texto -> centavos. Vacío = 0. Inválido = NaN.
const leer = (txt) => (txt.trim() === '' ? 0 : pesosACentavos(txt));

export default function CajaDiaria() {
  const [fecha, setFecha] = useState(() => hoyISO());
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [inicialTxt, setInicialTxt] = useState('');
  const [contadoTxt, setContadoTxt] = useState('');

  useEffect(() => {
    if (!fecha) return;
    let vigente = true;
    api.reporteCaja(fecha)
      .then((d) => { if (vigente) { setDatos(d); setError(''); } })
      .catch((e) => vigente && setError(e.message));
    return () => { vigente = false; };
  }, [fecha, recarga]);

  const inicial = leer(inicialTxt);
  const contado = leer(contadoTxt);
  const hayInvalido = Number.isNaN(inicial) || Number.isNaN(contado);
  const esperado = datos && !Number.isNaN(inicial) ? inicial + datos.por_medio.EFECTIVO : null;
  const diferencia = esperado !== null && !Number.isNaN(contado) && contadoTxt.trim() !== ''
    ? contado - esperado : null;

  return (
    <section>
      <div className="barra">
        <label>Día <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
        <button onClick={() => setFecha(hoyISO())}>Hoy</button>
        <button onClick={() => setRecarga((n) => n + 1)}>Actualizar</button>
      </div>

      {error && <div className="error-general">{error}</div>}

      {datos && (
        <div className="caja-diaria">
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Cobrado en el día</h3>
            <div className="kpis" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="kpi"><span>Total vendido</span><strong>{formatearPesos(datos.total)}</strong></div>
              <div className="kpi"><span>Tickets</span><strong>{datos.tickets}</strong></div>
            </div>
            {Object.entries(datos.por_medio).map(([medio, monto]) => (
              <div className="fila-total" key={medio}>
                <span>{NOMBRE_MEDIO[medio]}</span><strong>{formatearPesos(monto)}</strong>
              </div>
            ))}
            <div className="detalle">Descuentos otorgados: {formatearPesos(datos.descuentos)}</div>

            <h3>Arqueo de efectivo</h3>
            <label className="campo-form">Efectivo inicial en la caja ($)
              <input value={inicialTxt} onChange={(e) => setInicialTxt(e.target.value)} inputMode="decimal" placeholder="0,00" />
            </label>
            <div className="fila-total">
              <span>+ Efectivo cobrado (ya sin vuelto)</span><span>{formatearPesos(datos.por_medio.EFECTIVO)}</span>
            </div>
            <div className="fila-total">
              <strong>Efectivo esperado</strong>
              <strong>{esperado === null ? '—' : formatearPesos(esperado)}</strong>
            </div>
            <label className="campo-form">Efectivo contado ($)
              <input value={contadoTxt} onChange={(e) => setContadoTxt(e.target.value)} inputMode="decimal" placeholder="0,00" />
            </label>
            {hayInvalido && <div className="error">Hay un monto que no es válido.</div>}
            {diferencia !== null && (
              <div className={'resumen-pago ' + (diferencia === 0 ? 'ok' : 'falta')}>
                {diferencia === 0 && 'La caja cierra justa ✓'}
                {diferencia > 0 && `Sobran ${formatearPesos(diferencia)}`}
                {diferencia < 0 && `Faltan ${formatearPesos(-diferencia)}`}
              </div>
            )}
            <p className="detalle">
              Estos dos montos no se guardan: si cambiás de pantalla o recargás, hay que volver a escribirlos.
              Los retiros y gastos de caja todavía no se registran.
            </p>
          </div>

          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Tickets del día</h3>
            <table>
              <thead><tr><th>N°</th><th>Hora</th><th>Medios</th><th className="num">Total</th></tr></thead>
              <tbody>
                {datos.ventas.map((v) => (
                  <tr key={v.id}>
                    <td>#{v.id}</td>
                    <td>{formatearFechaHora(v.creado_en)}</td>
                    <td>{(v.medios ?? '').split(', ').map((m) => NOMBRE_MEDIO[m] ?? m).join(', ')}</td>
                    <td className="num">{formatearPesos(v.total)}</td>
                  </tr>
                ))}
                {datos.ventas.length === 0 && <tr><td colSpan="4" className="vacio">No hubo ventas este día.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}