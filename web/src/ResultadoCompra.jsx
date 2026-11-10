// Resumen del ingreso registrado, con las sugerencias de nuevo precio.
import { useState } from 'react';
import { api } from './api.js';
import { formatearPesos, formatearCantidad, formatearFechaHora, pesosACentavos, centavosATexto } from './formato.js';

function FilaSugerencia({ s }) {
  const [texto, setTexto] = useState(centavosATexto(s.precio_sugerido));
  const [estado, setEstado] = useState('pendiente'); // pendiente | guardando | aplicado
  const [error, setError] = useState('');
  const sufijo = s.tipo_unidad === 'PESO' ? ' /kg' : '';
  const variacion = ((s.costo_nuevo - s.costo_anterior) / s.costo_anterior) * 100;

  async function aplicar() {
    const centavos = pesosACentavos(texto);
    if (Number.isNaN(centavos) || centavos <= 0) {
      setError('Precio no válido');
      return;
    }
    setEstado('guardando');
    setError('');
    try {
      await api.cambiarPrecio(s.producto_id, centavos);
      setEstado('aplicado');
    } catch (e) {
      setError(e.message);
      setEstado('pendiente');
    }
  }

  return (
    <tr>
      <td>{s.nombre}</td>
      <td className="num">
        {formatearPesos(s.costo_anterior)} → {formatearPesos(s.costo_nuevo)}
        <div className={variacion > 0 ? 'neg' : 'pos'}>
          {variacion > 0 ? '+' : ''}{variacion.toFixed(1).replace('.', ',')} %
        </div>
      </td>
      <td className="num">{formatearPesos(s.precio_actual)}{sufijo}</td>
      <td className="num">
        {estado === 'aplicado' ? (
          <span className="pos">✓ Aplicado: $ {texto}</span>
        ) : (
          <span className="cantidad">
            <input value={texto} onChange={(e) => setTexto(e.target.value)} inputMode="decimal" style={{ width: 110, textAlign: 'right' }} />
            <button type="button" onClick={aplicar} disabled={estado === 'guardando'}>Aplicar</button>
          </span>
        )}
        {error && <div className="error">{error}</div>}
      </td>
    </tr>
  );
}

export default function ResultadoCompra({ compra, onCerrar }) {
  return (
    <div className="fondo-modal">
      <div className="modal ancho">
        <h2>Ingreso #{compra.id} registrado</h2>
        <div className="detalle">
          {formatearFechaHora(compra.creado_en)}
          {compra.proveedor && ` · ${compra.proveedor}`}
          {compra.nro_comprobante && ` · Comprobante ${compra.nro_comprobante}`}
        </div>

        <table style={{ margin: '12px 0' }}>
          <thead>
            <tr><th>Producto</th><th className="num">Cantidad</th><th className="num">Subtotal</th></tr>
          </thead>
          <tbody>
            {compra.items.map((i, n) => (
              <tr key={n}>
                <td>{i.nombre}</td>
                <td className="num">{formatearCantidad(i.cantidad, i.tipo_unidad)}</td>
                <td className="num">{formatearPesos(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="fila-total"><strong>TOTAL</strong><strong>{formatearPesos(compra.total)}</strong></div>

        {compra.sugerencias.length > 0 && (
          <>
            <h3>El costo cambió: ¿actualizás los precios?</h3>
            <p className="detalle">Cada sugerencia mantiene tu margen. Podés cambiar el valor antes de aplicarlo.</p>
            <table>
              <thead>
                <tr><th>Producto</th><th className="num">Costo</th><th className="num">Precio actual</th><th className="num">Nuevo precio</th></tr>
              </thead>
              <tbody>
                {compra.sugerencias.map((s) => <FilaSugerencia key={s.producto_id} s={s} />)}
              </tbody>
            </table>
          </>
        )}

        <div className="botones">
          <button className="primario" autoFocus onClick={onCerrar}>Listo</button>
        </div>
      </div>
    </div>
  );
}