import { useEffect, useState } from 'react';
import { api, urlExportar } from './api.js';
import { formatearFechaHora, hoyISO, sumarDiasISO } from './formato.js';
import { useSesion } from './SesionContext.jsx';

const tamano = (b) => (b >= 1048576
  ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB`
  : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function PantallaDatos() {
  const { puede } = useSesion();
  const veRespaldos = puede('backups:gestionar');

  const [desde, setDesde] = useState(() => sumarDiasISO(hoyISO(), -29));
  const [hasta, setHasta] = useState(() => hoyISO());
  const [respaldos, setRespaldos] = useState([]);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const rangoValido = desde !== '' && hasta !== '' && desde <= hasta;

  function cargar() {
    api.listarRespaldos().then(setRespaldos).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (veRespaldos) cargar();
  }, [veRespaldos]);

  async function crear() {
    setCreando(true);
    setError('');
    setExito('');
    try {
      const r = await api.crearRespaldo();
      setExito(`Respaldo creado: ${r.nombre}${r.copia_extra ? ' (y copiado a la carpeta extra)' : ''}.`);
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreando(false);
    }
  }

  return (
    <section>
      {error && <div className="error-general">{error}</div>}
      {exito && <div className="exito">{exito}</div>}

      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Exportar a Excel (CSV)</h2>
        <p className="detalle">
          Los archivos se abren con Excel: columnas separadas, tildes correctas y números con coma decimal.
        </p>
        <div className="barra">
          <label>Desde <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
          <label>Hasta <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
          <span className="detalle">(el rango se aplica a Ventas y Movimientos de stock)</span>
        </div>

        <div className="barra">
          <a className="enlace-boton" style={{ marginLeft: 0 }} href={urlExportar('productos.csv')}>
            ⬇ Productos y stock actual
          </a>
          {rangoValido ? (
            <>
              <a className="enlace-boton" style={{ marginLeft: 0 }} href={urlExportar('ventas.csv', { desde, hasta })}>
                ⬇ Ventas (detalle por producto)
              </a>
              <a className="enlace-boton" style={{ marginLeft: 0 }} href={urlExportar('movimientos.csv', { desde, hasta })}>
                ⬇ Movimientos de stock
              </a>
            </>
          ) : (
            <span className="error">Elegí un rango de fechas válido para exportar ventas y movimientos.</span>
          )}
        </div>
      </div>
      
      {veRespaldos && (
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>Respaldos de la base de datos</h2>
          <p className="detalle">
            Se hace uno automático al arrancar el servidor (y uno por día). Se conservan los últimos 30.
            Descargá uno de vez en cuando y guardalo <strong>fuera de esta PC</strong> (pendrive, nube).
          </p>
          <div className="barra">
            <button className="primario" disabled={creando} onClick={crear}>
              {creando ? 'Creando…' : 'Crear respaldo ahora'}
            </button>
          </div>
          <table>
            <thead><tr><th>Archivo</th><th>Creado</th><th className="num">Tamaño</th><th></th></tr></thead>
            <tbody>
              {respaldos.map((r) => (
                <tr key={r.nombre}>
                  <td>{r.nombre}</td>
                  <td>{formatearFechaHora(r.creado)}</td>
                  <td className="num">{tamano(r.tamano)}</td>
                  <td className="acciones">
                    <a className="enlace-boton" href={`/api/admin/backups/${r.nombre}`}>⬇ Descargar</a>
                  </td>
                </tr>
              ))}
              {respaldos.length === 0 && <tr><td colSpan="4" className="vacio">Todavía no hay respaldos.</td></tr>}
            </tbody>
          </table>
          <p className="detalle">
            Para restaurar uno: apagá el servidor y ejecutá <code>npm run db:restaurar -- respaldos\archivo.db</code>.
          </p>
        </div>
      )}
    </section>
  );
}