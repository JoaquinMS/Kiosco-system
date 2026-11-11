import { useEffect, useState } from 'react';
import { api, urlCsv } from './api.js';
import {
  formatearPesos, formatearCantidad, hoyISO, sumarDiasISO, etiquetaPeriodo, porcentaje,
} from './formato.js';
import CajaDiaria from './CajaDiaria.jsx';

export default function PantallaReportes() {
  const [vista, setVista] = useState('ventas'); // 'ventas' | 'caja'
  const [desde, setDesde] = useState(() => sumarDiasISO(hoyISO(), -6));
  const [hasta, setHasta] = useState(() => hoyISO());
  const [agrupar, setAgrupar] = useState('dia');
  const [costo, setCosto] = useState('ultimo');
  const [orden, setOrden] = useState('ingresos');
  const [datos, setDatos] = useState(null);
  const [top, setTop] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const rangoValido = desde !== '' && hasta !== '' && desde <= hasta;

  useEffect(() => {
    if (vista !== 'ventas' || !rangoValido) return;
    let vigente = true;
    setCargando(true);
    Promise.all([
      api.reporteVentas({ desde, hasta, agrupar, costo }),
      api.reporteMasVendidos({ desde, hasta, costo, orden }),
    ])
      .then(([v, t]) => {
        if (!vigente) return;
        setDatos(v);
        setTop(t.filas);
        setError('');
      })
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [vista, desde, hasta, agrupar, costo, orden, rangoValido]);

  function preset(tipo) {
    const hoy = hoyISO();
    setHasta(hoy);
    if (tipo === 'hoy') setDesde(hoy);
    if (tipo === '7') setDesde(sumarDiasISO(hoy, -6));
    if (tipo === '30') setDesde(sumarDiasISO(hoy, -29));
    if (tipo === 'mes') setDesde(hoy.slice(0, 8) + '01');
  }

  const t = datos?.totales;
  const maxVentas = datos ? Math.max(1, ...datos.filas.map((f) => f.ventas)) : 1;
  const parametros = { desde, hasta, agrupar, costo };

  return (
    <section>
      <nav className="pestanas">
        <button className={vista === 'ventas' ? 'activa' : ''} onClick={() => setVista('ventas')}>
          Ventas y ganancia
        </button>
        <button className={vista === 'caja' ? 'activa' : ''} onClick={() => setVista('caja')}>
          Caja diaria
        </button>
      </nav>

      {vista === 'caja' && <CajaDiaria />}

      {vista === 'ventas' && (
        <>
          <div className="barra">
            <label>Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
            <label>Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
            <button onClick={() => preset('hoy')}>Hoy</button>
            <button onClick={() => preset('7')}>7 días</button>
            <button onClick={() => preset('30')}>30 días</button>
            <button onClick={() => preset('mes')}>Este mes</button>
          </div>
          <div className="barra">
            <label>Agrupar por{' '}
              <select value={agrupar} onChange={(e) => setAgrupar(e.target.value)}>
                <option value="dia">Día</option>
                <option value="semana">Semana</option>
                <option value="mes">Mes</option>
              </select>
            </label>
            <label>Costo para la ganancia{' '}
              <select value={costo} onChange={(e) => setCosto(e.target.value)}>
                <option value="ultimo">Último costo</option>
                <option value="promedio">Costo promedio</option>
              </select>
            </label>
          </div>

          {!rangoValido && <div className="aviso">Elegí un rango de fechas válido ("desde" no puede ser posterior a "hasta").</div>}
          {error && <div className="error-general">{error}</div>}
          {cargando && <p className="vacio">Cargando…</p>}

          {datos && rangoValido && (
            <>
              <div className="kpis">
                <div className="kpi"><span>Ventas</span><strong>{formatearPesos(t.ventas)}</strong></div>
                <div className="kpi"><span>Tickets</span><strong>{t.tickets}</strong></div>
                <div className="kpi"><span>Ticket promedio</span><strong>{formatearPesos(t.ticket_promedio)}</strong></div>
                <div className="kpi">
                  <span>Ganancia estimada</span>
                  <strong>{formatearPesos(t.ganancia)}</strong>
                  <small>Margen {porcentaje(t.ganancia, t.ventas)}</small>
                </div>
              </div>

              {t.items_sin_costo > 0 && (
                <div className="aviso">
                  ⚠ {t.items_sin_costo} línea(s) vendida(s) en este período son de productos sin costo cargado:
                  la ganancia real es menor a la mostrada. Cargá los costos en Productos o con un ingreso de mercadería.
                </div>
              )}

              <div className="reportes">
                <div className="panel">
                  <div className="barra" style={{ marginBottom: 8 }}>
                    <h3 style={{ margin: 0 }}>Ventas por {agrupar === 'dia' ? 'día' : agrupar}</h3>
                    <a className="enlace-boton" href={urlCsv('ventas.csv', parametros)}>⬇ Exportar CSV</a>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Período</th><th className="num">Tickets</th><th className="num">Ventas</th>
                        <th style={{ width: '25%' }}></th><th className="num">Ganancia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.filas.map((f) => (
                        <tr key={f.periodo}>
                          <td>{etiquetaPeriodo(f.periodo, agrupar)}</td>
                          <td className="num">{f.tickets}</td>
                          <td className="num">{formatearPesos(f.ventas)}</td>
                          <td><div className="barra-valor" style={{ width: `${(f.ventas / maxVentas) * 100}%` }} /></td>
                          <td className={'num ' + (f.ganancia < 0 ? 'neg' : 'pos')}>{formatearPesos(f.ganancia)}</td>
                        </tr>
                      ))}
                      {datos.filas.length === 0 && (
                        <tr><td colSpan="5" className="vacio">No hubo ventas en este período.</td></tr>
                      )}
                    </tbody>
                  </table>
                  <p className="detalle">
                    La semana empieza el lunes. Los períodos de los extremos del rango pueden estar incompletos.
                    Descuentos otorgados: {formatearPesos(t.descuentos)}.
                  </p>
                </div>

                <div className="panel">
                  <div className="barra" style={{ marginBottom: 8 }}>
                    <h3 style={{ margin: 0 }}>Más vendidos</h3>
                    <select value={orden} onChange={(e) => setOrden(e.target.value)}>
                      <option value="ingresos">Por ingresos</option>
                      <option value="cantidad">Por cantidad</option>
                      <option value="ganancia">Por ganancia</option>
                    </select>
                    <a className="enlace-boton" href={urlCsv('mas-vendidos.csv', { desde, hasta, costo, orden })}>⬇ CSV</a>
                  </div>
                  <table>
                    <thead>
                      <tr><th>#</th><th>Producto</th><th className="num">Cant.</th><th className="num">Ingresos</th><th className="num">Ganancia</th></tr>
                    </thead>
                    <tbody>
                      {top.map((p, i) => (
                        <tr key={p.producto_id}>
                          <td>{i + 1}</td>
                          <td>{p.nombre}</td>
                          <td className="num">{formatearCantidad(p.cantidad, p.tipo_unidad)}</td>
                          <td className="num">{formatearPesos(p.ingresos)}</td>
                          <td className="num">{formatearPesos(p.ganancia)}</td>
                        </tr>
                      ))}
                      {top.length === 0 && <tr><td colSpan="5" className="vacio">Sin ventas.</td></tr>}
                    </tbody>
                  </table>
                  <p className="detalle">La ganancia por producto no incluye el descuento global del ticket.</p>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}