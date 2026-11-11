import { useEffect, useState } from 'react';
import { api } from './api.js';
import { formatearCantidad, formatearFecha } from './formato.js';

function textoDias(d) {
  if (d < 0) return `VENCIDO hace ${-d} día${d === -1 ? '' : 's'}`;
  if (d === 0) return 'Vence hoy';
  return `Vence en ${d} día${d === 1 ? '' : 's'}`;
}

export default function PantallaAlertas() {
  const [dias, setDias] = useState(15);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    api.alertas(dias)
      .then((d) => { if (vigente) { setDatos(d); setError(''); } })
      .catch((e) => vigente && setError(e.message));
    return () => { vigente = false; };
  }, [dias]);

  if (error) return <div className="error-general">{error}</div>;
  if (!datos) return <p className="vacio">Cargando…</p>;

  return (
    <section className="alertas">
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Stock bajo ({datos.stock_bajo.length})</h2>
        <p className="detalle">
          Productos que llegaron a su stock mínimo (o quedaron en negativo). La reposición sugerida
          lleva el stock al doble del mínimo.
        </p>
        <table>
          <thead>
            <tr>
              <th>Producto</th><th>Categoría</th>
              <th className="num">Stock</th><th className="num">Mínimo</th>
              <th className="num">Reponer (sugerido)</th><th></th>
            </tr>
          </thead>
          <tbody>
            {datos.stock_bajo.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}</td>
                <td>{p.categoria ?? '—'}</td>
                <td className="num stock-bajo">{formatearCantidad(p.stock_actual, p.tipo_unidad)}</td>
                <td className="num">{formatearCantidad(p.stock_minimo, p.tipo_unidad)}</td>
                <td className="num">{formatearCantidad(p.sugerido, p.tipo_unidad)}</td>
                <td>
                  {p.stock_actual < 0 && <span className="etiqueta roja">NEGATIVO</span>}
                  {p.stock_actual === 0 && <span className="etiqueta roja">AGOTADO</span>}
                  {p.stock_actual > 0 && <span className="etiqueta naranja">BAJO</span>}
                </td>
              </tr>
            ))}
            {datos.stock_bajo.length === 0 && (
              <tr><td colSpan="6" className="vacio">No hay productos con stock bajo. 👍</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="barra" style={{ marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>Vencimientos ({datos.vencimientos.length})</h2>
          <label>Avisar con{' '}
            <select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
              {[7, 15, 30, 60].map((d) => <option key={d} value={d}>{d} días</option>)}
            </select>
          </label>
        </div>
        <p className="detalle">
          Lotes con stock que vencen pronto o ya vencieron. Para sacar lo vencido del stock, usá
          <strong> Stock / ajustes → Vencimiento</strong>: descuenta primero del lote que vence antes.
        </p>
        <table>
          <thead>
            <tr><th>Producto</th><th>Vence</th><th>Estado</th><th className="num">Cantidad en el lote</th></tr>
          </thead>
          <tbody>
            {datos.vencimientos.map((l) => (
              <tr key={l.lote_id} className={l.dias_restantes < 0 ? 'fila-roja' : ''}>
                <td>{l.nombre}</td>
                <td>{formatearFecha(l.fecha_vencimiento)}</td>
                <td>
                  <span className={'etiqueta ' + (l.dias_restantes < 0 ? 'roja' : l.dias_restantes <= 7 ? 'naranja' : 'amarilla')}>
                    {textoDias(l.dias_restantes)}
                  </span>
                </td>
                <td className="num">{formatearCantidad(l.cantidad_restante, l.tipo_unidad)}</td>
              </tr>
            ))}
            {datos.vencimientos.length === 0 && (
              <tr><td colSpan="4" className="vacio">No hay lotes por vencer en los próximos {dias} días. 👍</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}