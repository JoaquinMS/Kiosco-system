import { useEffect, useState } from 'react';
import { api } from './api.js';
import { formatearPesos, formatearFechaHora, porcentajeACentesimas } from './formato.js';

const MOTIVOS = {
  EDICION: 'Edición', SUGERENCIA: 'Sugerencia de ingreso', MASIVO: 'Actualización masiva', DESHACER: 'Deshacer',
};

export default function PantallaPrecios() {
  const [categorias, setCategorias] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [categoriaId, setCategoriaId] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [pctTxt, setPctTxt] = useState('');
  const [redondeo, setRedondeo] = useState('0');
  const [vista, setVista] = useState(null);
  const [excluidos, setExcluidos] = useState(() => new Set());
  const [cambios, setCambios] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  const porcentaje = porcentajeACentesimas(pctTxt);
  const pctValido = !Number.isNaN(porcentaje) && porcentaje !== 0;

  function cargarHistorial() {
    Promise.all([api.cambiosPrecios(), api.historialPrecios()])
      .then(([c, h]) => { setCambios(c); setHistorial(h); })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    api.listarCategorias().then(setCategorias).catch((e) => setError(e.message));
    api.listarProveedores().then(setProveedores).catch((e) => setError(e.message));
    cargarHistorial();
  }, []);

  const cuerpo = () => ({
    categoria_id: categoriaId === '' ? null : Number(categoriaId),
    proveedor_id: proveedorId === '' ? null : Number(proveedorId),
    porcentaje,
    redondeo: Number(redondeo),
  });

  // Cualquier cambio en el formulario invalida la vista previa anterior.
  const alCambiar = (setter) => (e) => { setter(e.target.value); setVista(null); setExito(''); };

  async function previsualizar() {
    setError(''); setExito('');
    try {
      setVista(await api.vistaPreviaPrecios(cuerpo()));
      setExcluidos(new Set());
    } catch (e) {
      setError(e.detalles ? Object.values(e.detalles).join(' · ') : e.message);
    }
  }

  function alternar(id) {
    setExcluidos((previo) => {
      const nuevo = new Set(previo);
      if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id);
      return nuevo;
    });
  }

  const cantidad = vista ? vista.filas.length - excluidos.size : 0;

  async function aplicar() {
    if (cantidad === 0) return;
    if (!window.confirm(`¿Cambiar el precio de ${cantidad} producto(s)?\n${vista.descripcion}`)) return;
    setTrabajando(true);
    setError('');
    try {
      const r = await api.aplicarPrecios({ ...cuerpo(), excluir: [...excluidos] });
      setExito(`Listo: se actualizaron ${r.cantidad} precios.`);
      setVista(null);
      cargarHistorial();
    } catch (e) {
      setError(e.message);
    } finally {
      setTrabajando(false);
    }
  }

  async function deshacer(c) {
    if (!window.confirm(`¿Deshacer "${c.descripcion}"?\nSolo se revierten los productos que no se modificaron después.`)) return;
    setError('');
    try {
      const r = await api.deshacerPrecios(c.id);
      setExito(`Se revirtieron ${r.revertidos} precios`
        + (r.omitidos ? ` (${r.omitidos} omitidos porque se modificaron después).` : '.'));
      cargarHistorial();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Actualización masiva de precios</h2>
        <div className="barra">
          <label>Categoría{' '}
            <select value={categoriaId} onChange={alCambiar(setCategoriaId)}>
              <option value="">Todas</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label>Proveedor{' '}
            <select value={proveedorId} onChange={alCambiar(setProveedorId)}>
              <option value="">Todos</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label>Porcentaje (%){' '}
            <input value={pctTxt} onChange={alCambiar(setPctTxt)} inputMode="decimal" placeholder="10 o -5" style={{ width: 90 }} />
          </label>
          <label>Redondeo{' '}
            <select value={redondeo} onChange={alCambiar(setRedondeo)}>
              <option value="0">Sin redondeo</option>
              <option value="1000">A $10</option>
              <option value="5000">A $50</option>
              <option value="10000">A $100</option>
            </select>
          </label>
          <button className="primario" disabled={!pctValido} onClick={previsualizar}>Ver vista previa</button>
        </div>
        <p className="detalle">
          Un número positivo sube los precios y uno negativo los baja. El proveedor es el "habitual" de cada
          producto (el del último ingreso de mercadería).
        </p>

        {error && <div className="error-general">{error}</div>}
        {exito && <div className="exito">{exito}</div>}

        {vista && (
          <>
            <h3>{vista.descripcion}</h3>
            <table>
              <thead>
                <tr><th></th><th>Producto</th><th>Categoría</th><th className="num">Precio actual</th><th className="num">Precio nuevo</th><th className="num">Cambio</th></tr>
              </thead>
              <tbody>
                {vista.filas.map((f) => {
                  const sufijo = f.tipo_unidad === 'PESO' ? ' /kg' : '';
                  const variacion = ((f.precio_nuevo - f.precio_actual) / f.precio_actual) * 100;
                  return (
                    <tr key={f.producto_id} className={excluidos.has(f.producto_id) ? 'inactivo' : ''}>
                      <td><input type="checkbox" checked={!excluidos.has(f.producto_id)} onChange={() => alternar(f.producto_id)} /></td>
                      <td>{f.nombre}</td>
                      <td>{f.categoria ?? '—'}</td>
                      <td className="num">{formatearPesos(f.precio_actual)}{sufijo}</td>
                      <td className="num"><strong>{formatearPesos(f.precio_nuevo)}{sufijo}</strong></td>
                      <td className={'num ' + (variacion > 0 ? 'neg' : 'pos')}>
                        {variacion > 0 ? '+' : ''}{variacion.toFixed(1).replace('.', ',')} %
                      </td>
                    </tr>
                  );
                })}
                {vista.filas.length === 0 && (
                  <tr><td colSpan="6" className="vacio">
                    Con estos filtros no hay precios que cambiar ({vista.total_filtrados} producto(s) coinciden).
                  </td></tr>
                )}
              </tbody>
            </table>
            {vista.filas.length > 0 && (
              <div className="pie-compra">
                <span className="detalle">
                  {!categoriaId && !proveedorId && '⚠ Sin filtros: se aplica a TODOS los productos. '}
                  Destildá los que no querés cambiar.
                </span>
                <button className="primario" disabled={trabajando || cantidad === 0} onClick={aplicar}>
                  {trabajando ? 'Aplicando…' : `Aplicar ${cantidad} cambio(s)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="reportes">
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Actualizaciones masivas recientes</h3>
          <table>
            <thead><tr><th>Fecha</th><th>Detalle</th><th className="num">Productos</th><th></th></tr></thead>
            <tbody>
              {cambios.map((c) => (
                <tr key={c.id}>
                  <td>{formatearFechaHora(c.creado_en)}<div className="detalle">{c.usuario ?? '—'}</div></td>
                  <td>{c.descripcion}</td>
                  <td className="num">{c.cantidad}</td>
                  <td className="acciones">
                    {c.deshecho_en ? <span className="etiqueta amarilla">DESHECHO</span>
                      : <button onClick={() => deshacer(c)}>Deshacer</button>}
                  </td>
                </tr>
              ))}
              {cambios.length === 0 && <tr><td colSpan="4" className="vacio">Todavía no hay actualizaciones masivas.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Últimos cambios de precio</h3>
          <table>
            <thead><tr><th>Fecha</th><th>Producto</th><th className="num">Antes → Ahora</th></tr></thead>
            <tbody>
              {historial.map((h) => (
                <tr key={h.id}>
                  <td>{formatearFechaHora(h.creado_en)}</td>
                  <td>{h.producto}<div className="detalle">{MOTIVOS[h.motivo]} · {h.usuario ?? '—'}</div></td>
                  <td className="num">{formatearPesos(h.precio_anterior)} → {formatearPesos(h.precio_nuevo)}</td>
                </tr>
              ))}
              {historial.length === 0 && <tr><td colSpan="3" className="vacio">Sin cambios de precio registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}