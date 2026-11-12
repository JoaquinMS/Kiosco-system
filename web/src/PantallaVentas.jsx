// Historial de ventas del día, con detalle y anulación.
import { useEffect, useState } from 'react';
import { api } from './api.js';
import { formatearPesos, formatearCantidad, formatearFechaHora, hoyISO } from './formato.js';

const NOMBRE_MEDIO = { EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', TARJETA: 'Tarjeta' };
const mediosTxt = (m) => (m ?? '').split(', ').filter(Boolean).map((x) => NOMBRE_MEDIO[x] ?? x).join(', ');

export default function PantallaVentas() {
  const [fecha, setFecha] = useState(() => hoyISO());
  const [ventas, setVentas] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [errorAnular, setErrorAnular] = useState('');
  const [anulando, setAnulando] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!fecha) return;
    let vigente = true;
    api.listarVentas({ fecha, limite: 200 })
      .then((d) => { if (vigente) { setVentas(d); setError(''); } })
      .catch((e) => vigente && setError(e.message));
    return () => { vigente = false; };
  }, [fecha, recarga]);

  async function ver(id) {
    try {
      setDetalle(await api.obtenerVenta(id));
      setMotivo('');
      setErrorAnular('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function anular() {
    if (!window.confirm(`¿Anular la venta #${detalle.id}? Se repone el stock y deja de contar en la caja y los reportes.`)) return;
    setAnulando(true);
    setErrorAnular('');
    try {
      setDetalle(await api.anularVenta(detalle.id, motivo));
      setRecarga((n) => n + 1);
    } catch (e) {
      setErrorAnular(e.detalles ? Object.values(e.detalles).join(' · ') : e.message);
    } finally {
      setAnulando(false);
    }
  }

  const totalDia = ventas.filter((v) => v.estado === 'COMPLETADA').reduce((s, v) => s + v.total, 0);

  return (
    <section>
      <div className="barra">
        <label>Día <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
        <button onClick={() => setFecha(hoyISO())}>Hoy</button>
        <button onClick={() => setRecarga((n) => n + 1)}>Actualizar</button>
      </div>
      {error && <div className="error-general">{error}</div>}

      <table>
        <thead>
          <tr><th>N°</th><th>Hora</th><th>Vendedor</th><th>Medios</th><th className="num">Total</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          {ventas.map((v) => (
            <tr key={v.id} className={v.estado === 'ANULADA' ? 'inactivo' : ''}>
              <td>#{v.id}</td>
              <td>{formatearFechaHora(v.creado_en)}</td>
              <td>{v.vendedor ?? '—'}</td>
              <td>{mediosTxt(v.medios)}</td>
              <td className="num">{formatearPesos(v.total)}</td>
              <td>{v.estado === 'ANULADA' ? <span className="etiqueta roja">ANULADA</span> : 'Completada'}</td>
              <td className="acciones"><button onClick={() => ver(v.id)}>Ver</button></td>
            </tr>
          ))}
          {ventas.length === 0 && <tr><td colSpan="7" className="vacio">No hubo ventas este día.</td></tr>}
        </tbody>
      </table>
      <p className="detalle">Total del día (sin contar anuladas): <strong>{formatearPesos(totalDia)}</strong></p>

      {detalle && (
        <div className="fondo-modal">
          <div className="modal ancho">
            <h2>Venta #{detalle.id} {detalle.estado === 'ANULADA' && <span className="etiqueta roja">ANULADA</span>}</h2>
            <div className="detalle">
              {formatearFechaHora(detalle.creado_en)} · Vendedor: {detalle.vendedor ?? '—'}
            </div>
            <table style={{ margin: '12px 0' }}>
              <thead><tr><th>Producto</th><th className="num">Cant.</th><th className="num">Precio</th><th className="num">Subtotal</th></tr></thead>
              <tbody>
                {detalle.items.map((i, n) => (
                  <tr key={n}>
                    <td>{i.nombre}</td>
                    <td className="num">{formatearCantidad(i.cantidad, i.tipo_unidad)}</td>
                    <td className="num">{formatearPesos(i.precio_unitario)}</td>
                    <td className="num">{formatearPesos(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="fila-total"><span>Subtotal</span><span>{formatearPesos(detalle.subtotal)}</span></div>
            {detalle.descuento > 0 && (
              <div className="fila-total"><span>Descuento</span><span>- {formatearPesos(detalle.descuento)}</span></div>
            )}
            <div className="fila-total"><strong>TOTAL</strong><strong>{formatearPesos(detalle.total)}</strong></div>
            {detalle.pagos.map((p) => (
              <div className="fila-total" key={p.medio}><span>{NOMBRE_MEDIO[p.medio]}</span><span>{formatearPesos(p.monto)}</span></div>
            ))}
            {detalle.vuelto > 0 && (
              <div className="fila-total"><span>Vuelto</span><span>{formatearPesos(detalle.vuelto)}</span></div>
            )}

            {detalle.estado === 'ANULADA' ? (
              <div className="aviso">
                Anulada el {formatearFechaHora(detalle.anulada_en)}. Motivo: {detalle.anulada_motivo}
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ marginBottom: 6 }}>Anular esta venta</h3>
                {errorAnular && <div className="error-general">{errorAnular}</div>}
                <label className="campo-form">Motivo (obligatorio)
                  <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ej.: error de carga, el cliente se arrepintió" />
                </label>
                <button className="peligro" disabled={anulando || motivo.trim().length < 3} onClick={anular}>
                  {anulando ? 'Anulando…' : 'Anular venta'}
                </button>
              </div>
            )}

            <div className="botones"><button onClick={() => setDetalle(null)}>Cerrar</button></div>
          </div>
        </div>
      )}
    </section>
  );
}