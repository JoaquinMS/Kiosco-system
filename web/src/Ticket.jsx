// Resumen de la venta ya registrada.
import { formatearPesos, formatearCantidad, formatearFechaHora } from './formato.js';

const NOMBRE_MEDIO = { EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', TARJETA: 'Tarjeta' };

export default function Ticket({ venta, onCerrar }) {
  return (
    <div className="fondo-modal">
      <div className="modal ticket-venta">
        <h2>Venta #{venta.id} registrada</h2>
        <div className="detalle">{formatearFechaHora(venta.creado_en)}</div>

        <table>
          <thead>
            <tr><th>Producto</th><th className="num">Cant.</th><th className="num">Subtotal</th></tr>
          </thead>
          <tbody>
            {venta.items.map((i, n) => (
              <tr key={n}>
                <td>{i.nombre}</td>
                <td className="num">{formatearCantidad(i.cantidad, i.tipo_unidad)}</td>
                <td className="num">{formatearPesos(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="fila-total"><span>Subtotal</span><span>{formatearPesos(venta.subtotal)}</span></div>
        {venta.descuento > 0 && (
          <div className="fila-total"><span>Descuento</span><span>- {formatearPesos(venta.descuento)}</span></div>
        )}
        <div className="fila-total"><strong>TOTAL</strong><strong>{formatearPesos(venta.total)}</strong></div>
        {venta.pagos.map((p) => (
          <div className="fila-total" key={p.medio}>
            <span>{NOMBRE_MEDIO[p.medio]}</span><span>{formatearPesos(p.monto)}</span>
          </div>
        ))}
        {venta.vuelto > 0 && (
          <div className="fila-total"><span>Vuelto</span><span>{formatearPesos(venta.vuelto)}</span></div>
        )}

        {venta.advertencias.map((a) => (
          <div className="advertencia" key={a.producto_id}>
            ⚠ El stock de <strong>{a.nombre}</strong> quedó en {formatearCantidad(a.stock_resultante, a.tipo_unidad)}.
            Revisalo y ajustalo cuando hagas el conteo.
          </div>
        ))}

        <div className="botones">
          <button className="primario" autoFocus onClick={onCerrar}>Nueva venta</button>
        </div>
      </div>
    </div>
  );
}