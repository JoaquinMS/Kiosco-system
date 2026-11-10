import { useRef, useState } from 'react';
import { api } from './api.js';
import {
  formatearPesos, formatearCantidad, formatearCantidadConSigno, formatearFechaHora,
  formatearFecha, cantidadABase, hoyISO,
} from './formato.js';
import CampoEscaneo from './CampoEscaneo.jsx';

const PARECE_CODIGO = /^[0-9]{6,}$/;

const MOTIVOS = [
  { id: 'ROTURA', nombre: 'Rotura' },
  { id: 'MERMA', nombre: 'Merma' },
  { id: 'VENCIMIENTO', nombre: 'Vencimiento' },
  { id: 'ROBO', nombre: 'Robo / faltante' },
  { id: 'CONSUMO_PROPIO', nombre: 'Consumo propio' },
  { id: 'CONTEO', nombre: 'Conteo físico (stock real)' },
];
const NOMBRE_MOTIVO = Object.fromEntries(MOTIVOS.map((m) => [m.id, m.nombre]));
const NOMBRE_TIPO = {
  STOCK_INICIAL: 'Stock inicial', VENTA: 'Venta', COMPRA: 'Ingreso',
  AJUSTE: 'Ajuste', ANULACION_VENTA: 'Anulación de venta',
};

function detalle(m) {
  if (m.tipo === 'AJUSTE') return [NOMBRE_MOTIVO[m.motivo] ?? m.motivo, m.nota].filter(Boolean).join(' · ');
  if (m.tipo === 'VENTA' && m.ref_id) return `Venta #${m.ref_id}`;
  if (m.tipo === 'COMPRA' && m.ref_id) return `Ingreso #${m.ref_id}`;
  return m.motivo ?? '';
}

export default function PantallaStock() {
  const refCampo = useRef(null);

  const [producto, setProducto] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [resultados, setResultados] = useState([]);
  const [aviso, setAviso] = useState('');
  const [exito, setExito] = useState('');
  const [error, setError] = useState('');

  const [motivo, setMotivo] = useState('ROTURA');
  const [cantidadTxt, setCantidadTxt] = useState('');
  const [nota, setNota] = useState('');
  const [errorForm, setErrorForm] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function cargar(id) {
    const [p, mov, lot] = await Promise.all([
      api.obtenerProducto(id), api.movimientosProducto(id), api.lotesProducto(id),
    ]);
    setProducto(p);
    setMovimientos(mov);
    setLotes(lot);
  }

  function limpiarForm() {
    setCantidadTxt('');
    setNota('');
    setErrorForm('');
  }

  async function seleccionar(p) {
    setResultados([]);
    setAviso('');
    setExito('');
    limpiarForm();
    try {
      await cargar(p.id);
    } catch (e) {
      setError(e.message);
    }
  }

  async function alIngresar(texto, medicion) {
    setError('');
    setAviso('');
    setExito('');
    try {
      if (medicion.esEscaneo || PARECE_CODIGO.test(texto)) {
        let p = null;
        try {
          p = await api.buscarPorCodigo(texto);
        } catch (e) {
          if (e.codigo !== 'PRODUCTO_NO_ENCONTRADO') throw e;
        }
        if (p) await seleccionar(p);
        else setAviso(`No existe un producto con el código ${texto}.`);
      } else {
        const lista = await api.listarProductos({ buscar: texto });
        if (lista.length === 1) await seleccionar(lista[0]);
        else if (lista.length === 0) setAviso(`No hay productos que coincidan con "${texto}".`);
        else setResultados(lista);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  // ---- Ajuste ----
  const esConteo = motivo === 'CONTEO';
  const esPeso = producto?.tipo_unidad === 'PESO';
  const valor = producto && cantidadTxt.trim() !== '' ? cantidadABase(cantidadTxt, producto.tipo_unidad) : NaN;

  let vistaPrevia = '';
  if (producto && Number.isFinite(valor)) {
    if (esConteo) {
      const dif = valor - producto.stock_actual;
      vistaPrevia = dif === 0
        ? 'Coincide con el stock del sistema.'
        : `Diferencia: ${formatearCantidadConSigno(dif, producto.tipo_unidad)}`;
    } else {
      vistaPrevia = `El stock quedará en ${formatearCantidad(producto.stock_actual - valor, producto.tipo_unidad)}`;
    }
  }

  async function enviar(e) {
    e.preventDefault();
    setErrorForm('');
    setExito('');
    if (Number.isNaN(valor) || (!esConteo && valor <= 0)) {
      setErrorForm(esPeso ? 'Escribí una cantidad válida en kg, por ejemplo 0,250' : 'Escribí una cantidad entera válida');
      return;
    }
    setGuardando(true);
    try {
      await api.crearAjuste({
        producto_id: producto.id,
        motivo,
        nota: nota.trim() || null,
        ...(esConteo ? { stock_real: valor } : { cantidad: valor }),
      });
      await cargar(producto.id);
      limpiarForm();
      setExito('Ajuste registrado.');
      refCampo.current?.focus();
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const hoy = hoyISO();
  const sufijo = esPeso ? ' (kg)' : '';

  return (
    <section>
      <CampoEscaneo onCodigo={alIngresar} bloqueado={false} refCampo={refCampo} />

      {error && <div className="error-general" style={{ marginTop: 12 }}>{error}</div>}
      {aviso && <div className="aviso">{aviso}</div>}

      {resultados.length > 0 && (
        <ul className="resultados">
          {resultados.map((p) => (
            <li key={p.id}>
              <button onClick={() => seleccionar(p)}>
                <span>{p.nombre}</span>
                <span>Stock: {formatearCantidad(p.stock_actual, p.tipo_unidad)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!producto && resultados.length === 0 && !aviso && (
        <p className="vacio">Escaneá o buscá un producto para ver su historial y ajustar su stock.</p>
      )}

      {producto && (
        <div className="stock-detalle">
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>{producto.nombre}</h2>
            <div className="detalle">
              {producto.categoria ?? 'Sin categoría'} · Código: {producto.codigo_barras ?? '—'}
            </div>
            <div className="stock-grande">{formatearCantidad(producto.stock_actual, producto.tipo_unidad)}</div>
            <div className="detalle">
              Mínimo: {formatearCantidad(producto.stock_minimo, producto.tipo_unidad)}
              {' · '}Costo: {formatearPesos(producto.costo)}{' · '}Costo promedio: {formatearPesos(producto.costo_promedio)}
            </div>

            <form onSubmit={enviar} style={{ marginTop: 16 }}>
              <h3>Ajustar stock</h3>
              {exito && <div className="exito">{exito}</div>}
              {errorForm && <div className="error-general">{errorForm}</div>}

              <label className="campo-form">Motivo
                <select value={motivo} onChange={(e) => { setMotivo(e.target.value); setErrorForm(''); }}>
                  {MOTIVOS.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </label>
              <label className="campo-form">
                {esConteo ? `Stock real contado${sufijo}` : `Cantidad que sale${sufijo}`}
                <input value={cantidadTxt} onChange={(e) => setCantidadTxt(e.target.value)} inputMode="decimal" />
              </label>
              {vistaPrevia && <div className="detalle">{vistaPrevia}</div>}
              <label className="campo-form">Nota (opcional)
                <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} />
              </label>
              <button type="submit" className="primario" disabled={guardando}>
                {guardando ? 'Registrando…' : 'Registrar ajuste'}
              </button>
            </form>
          </div>

          <div>
            {producto.controla_vencimiento && (
              <div className="panel" style={{ marginBottom: 16 }}>
                <h3 style={{ marginTop: 0 }}>Lotes con stock</h3>
                {lotes.length === 0 ? (
                  <div className="detalle">No hay lotes con fecha cargada.</div>
                ) : (
                  <table>
                    <thead><tr><th>Vence</th><th className="num">Quedan</th><th className="num">Entraron</th></tr></thead>
                    <tbody>
                      {lotes.map((l) => (
                        <tr key={l.id}>
                          <td>
                            {formatearFecha(l.fecha_vencimiento)}
                            {l.fecha_vencimiento < hoy && <span className="vencido"> VENCIDO</span>}
                          </td>
                          <td className="num">{formatearCantidad(l.cantidad_restante, producto.tipo_unidad)}</td>
                          <td className="num">{formatearCantidad(l.cantidad_inicial, producto.tipo_unidad)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div className="panel">
              <h3 style={{ marginTop: 0 }}>Historial de movimientos</h3>
              <table>
                <thead>
                  <tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th className="num">Cantidad</th><th className="num">Stock</th></tr>
                </thead>
                <tbody>
                  {movimientos.map((m) => (
                    <tr key={m.id}>
                      <td>{formatearFechaHora(m.creado_en)}</td>
                      <td>{NOMBRE_TIPO[m.tipo] ?? m.tipo}</td>
                      <td>{detalle(m)}</td>
                      <td className={'num ' + (m.cantidad < 0 ? 'neg' : 'pos')}>
                        {formatearCantidadConSigno(m.cantidad, producto.tipo_unidad)}
                      </td>
                      <td className="num">{formatearCantidad(m.stock_resultante, producto.tipo_unidad)}</td>
                    </tr>
                  ))}
                  {movimientos.length === 0 && (
                    <tr><td colSpan="5" className="vacio">Este producto todavía no tiene movimientos.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}