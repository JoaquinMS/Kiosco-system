import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import {
  formatearPesos, formatearCantidad, pesosACentavos, cantidadABase, centavosATexto,
  subtotalLinea, nuevoUuid, hoyISO,
} from './formato.js';
import CampoEscaneo from './CampoEscaneo.jsx';
import FormularioProducto from './FormularioProducto.jsx';
import ResultadoCompra from './ResultadoCompra.jsx';

const PARECE_CODIGO = /^[0-9]{6,}$/;
const MAX_CANTIDAD = 1_000_000;

// Convierte lo escrito en una línea a números, y detecta el problema (si lo hay).
function interpretar(l) {
  const p = l.producto;
  const cantidad = cantidadABase(l.cantidadTxt, p.tipo_unidad);
  const costo = l.costoTxt.trim() === '' ? NaN : pesosACentavos(l.costoTxt);

  let problema = null;
  if (l.cantidadTxt.trim() === '') problema = 'Falta la cantidad';
  else if (!(cantidad > 0)) problema = 'Cantidad no válida';
  else if (cantidad > MAX_CANTIDAD) problema = 'Cantidad demasiado grande';
  else if (l.costoTxt.trim() === '') problema = 'Falta el costo';
  else if (Number.isNaN(costo)) problema = 'Costo no válido';
  else if (p.controla_vencimiento && !l.vencTxt) problema = 'Falta la fecha de vencimiento';
  else if (p.controla_vencimiento && l.vencTxt < hoyISO()) problema = 'La fecha de vencimiento ya pasó';

  const subtotal = problema ? 0 : subtotalLinea(costo, cantidad, p.tipo_unidad);
  return { cantidad, costo, problema, subtotal };
}

export default function PantallaCompras() {
  const refCampo = useRef(null);
  const cola = useRef(Promise.resolve());
  const contador = useRef(0);
  const uuid = useRef(nuevoUuid());
  const lineasRef = useRef([]);

  const [categorias, setCategorias] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [proveedorId, setProveedorId] = useState('');
  const [nroComprobante, setNroComprobante] = useState('');
  const [lineas, setLineas] = useState([]); // [{ key, producto, cantidadTxt, costoTxt, vencTxt }]
  const [enfocar, setEnfocar] = useState(null);
  const [resultados, setResultados] = useState([]);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [codigoNuevo, setCodigoNuevo] = useState(null);
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);

  lineasRef.current = lineas; // copia siempre actualizada, para leerla desde funciones asíncronas

  useEffect(() => {
    api.listarCategorias().then(setCategorias).catch((e) => setError(e.message));
    api.listarProveedores().then(setProveedores).catch((e) => setError(e.message));
  }, []);

  // Cuando se agrega una línea, el cursor salta a su campo "cantidad".
  useEffect(() => {
    if (enfocar === null) return;
    document.querySelector(`[data-fila="${enfocar}"] input`)?.focus();
    setEnfocar(null);
  }, [enfocar, lineas]);

  const interpretadas = lineas.map(interpretar);
  const hayProblemas = interpretadas.some((i) => i.problema);
  const total = interpretadas.reduce((suma, i) => suma + i.subtotal, 0);
  const puedeConfirmar = lineas.length > 0 && !hayProblemas && !guardando;
  const hayVentana = codigoNuevo !== null || resultado !== null;

  // ---- Líneas ----
  function agregar(producto) {
    setResultados([]);
    setAviso('');
    const existente = lineasRef.current.find((l) => l.producto.id === producto.id);
    if (existente && !producto.controla_vencimiento) {
      setAviso(`"${producto.nombre}" ya está en la lista. Corregí su cantidad ahí.`);
      setEnfocar(existente.key);
      return;
    }
    // (Si el producto vence, se permite otra línea: puede ser otro lote con otra fecha.)
    const key = ++contador.current;
    setLineas((previo) => [...previo, {
      key, producto, cantidadTxt: '',
      costoTxt: producto.costo > 0 ? centavosATexto(producto.costo) : '',
      vencTxt: '',
    }]);
    setEnfocar(key);
  }

  function cambiarLinea(key, campo, valor) {
    setLineas((previo) => previo.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)));
  }

  function quitar(key) {
    setLineas((previo) => previo.filter((l) => l.key !== key));
    refCampo.current?.focus();
  }

  // Enter dentro de una fila: pasa al campo siguiente; en el último, vuelve al escaneo.
  function alEnterEnFila(e) {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    e.preventDefault();
    const campos = [...e.currentTarget.querySelectorAll('input')];
    const i = campos.indexOf(e.target);
    if (i >= 0 && i < campos.length - 1) campos[i + 1].focus();
    else refCampo.current?.focus();
  }

  // ---- Escaneo / búsqueda (de a uno, en orden) ----
  function alIngresar(texto, medicion) {
    cola.current = cola.current.then(() => procesar(texto, medicion));
  }

  async function procesar(texto, medicion) {
    setError('');
    setAviso('');
    try {
      if (medicion.esEscaneo || PARECE_CODIGO.test(texto)) {
        let producto = null;
        try {
          producto = await api.buscarPorCodigo(texto);
        } catch (e) {
          if (e.codigo !== 'PRODUCTO_NO_ENCONTRADO') throw e;
        }
        if (producto) agregar(producto);
        else setCodigoNuevo(texto);
      } else {
        const lista = await api.listarProductos({ buscar: texto });
        if (lista.length === 1) agregar(lista[0]);
        else if (lista.length === 0) setAviso(`No hay productos que coincidan con "${texto}".`);
        else setResultados(lista);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  function cerrarNuevo() {
    setCodigoNuevo(null);
    setAltaAbierta(false);
  }

  // ---- Proveedores ----
  async function nuevoProveedor() {
    const nombre = window.prompt('Nombre del proveedor:');
    if (nombre && nombre.trim()) {
      try {
        const p = await api.crearProveedor(nombre.trim());
        setProveedores((previo) => [...previo, p].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
        setProveedorId(String(p.id));
      } catch (e) {
        setError(e.message);
      }
    }
    refCampo.current?.focus();
  }

  // ---- Confirmar ----
  async function confirmar() {
    setGuardando(true);
    setError('');
    try {
      const compra = await api.crearCompra({
        client_uuid: uuid.current,
        proveedor_id: proveedorId === '' ? null : Number(proveedorId),
        nro_comprobante: nroComprobante.trim() || null,
        items: lineas.map((l, i) => ({
          producto_id: l.producto.id,
          cantidad: interpretadas[i].cantidad,
          costo_unitario: interpretadas[i].costo,
          fecha_vencimiento: l.producto.controla_vencimiento ? l.vencTxt : null,
        })),
      });
      setResultado(compra);
    } catch (e) {
      const extra = e.detalles ? ' ' + Object.values(e.detalles).join(' · ') : '';
      setError(e.message + extra); // la lista queda intacta para reintentar (mismo uuid)
    } finally {
      setGuardando(false);
    }
  }

  function cerrarResultado() {
    setResultado(null);
    setLineas([]);
    setNroComprobante('');
    uuid.current = nuevoUuid(); // el próximo ingreso es otro
  }

  return (
    <section>
      <div className="barra">
        <label>Proveedor{' '}
          <select
            value={proveedorId}
            onChange={(e) => { setProveedorId(e.target.value); refCampo.current?.focus(); }}
          >
            <option value="">Sin proveedor</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
        <button type="button" onClick={nuevoProveedor}>+ Proveedor</button>
        <label>Comprobante{' '}
          <input
            value={nroComprobante}
            onChange={(e) => setNroComprobante(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && refCampo.current?.focus()}
            placeholder="Nº de remito o factura"
          />
        </label>
      </div>

      <CampoEscaneo onCodigo={alIngresar} bloqueado={hayVentana} refCampo={refCampo} />
      <p className="detalle">
        Flujo: escaneá → escribí la cantidad → Enter pasa al costo (y a la fecha) → Enter vuelve al escaneo.
      </p>

      {error && <div className="error-general">{error}</div>}
      {aviso && <div className="aviso">{aviso}</div>}

      {resultados.length > 0 && (
        <ul className="resultados">
          {resultados.map((p) => (
            <li key={p.id}>
              <button onClick={() => agregar(p)}>
                <span>{p.nombre}</span>
                <span>Costo: {formatearPesos(p.costo)}{p.tipo_unidad === 'PESO' ? ' /kg' : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Producto</th><th>Cantidad</th><th>Costo unitario ($)</th>
            <th>Vencimiento</th><th className="num">Subtotal</th><th></th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l, n) => {
            const p = l.producto;
            const esPeso = p.tipo_unidad === 'PESO';
            const calc = interpretadas[n];
            const variacion = p.costo > 0 && !Number.isNaN(calc.costo) && calc.costo !== p.costo
              ? ((calc.costo - p.costo) / p.costo) * 100 : null;
            return (
              <tr key={l.key} data-fila={l.key} onKeyDown={alEnterEnFila}>
                <td>
                  {p.nombre}
                  <div className="detalle">
                    Último costo: {p.costo > 0 ? formatearPesos(p.costo) + (esPeso ? ' /kg' : '') : '—'}
                    {' · '}Stock: {formatearCantidad(p.stock_actual, p.tipo_unidad)}
                  </div>
                  {calc.problema && <div className="aviso-linea">{calc.problema}</div>}
                </td>
                <td>
                  <input
                    className="campo-linea"
                    value={l.cantidadTxt}
                    onChange={(e) => cambiarLinea(l.key, 'cantidadTxt', e.target.value)}
                    inputMode="decimal"
                    placeholder={esPeso ? 'kg' : 'unidades'}
                  />
                </td>
                <td>
                  <input
                    className="campo-linea"
                    value={l.costoTxt}
                    onChange={(e) => cambiarLinea(l.key, 'costoTxt', e.target.value)}
                    inputMode="decimal"
                    placeholder={esPeso ? 'por kg' : '0,00'}
                  />
                  {variacion !== null && (
                    <div className={variacion > 0 ? 'neg' : 'pos'}>
                      {variacion > 0 ? '+' : ''}{variacion.toFixed(1).replace('.', ',')} %
                    </div>
                  )}
                </td>
                <td>
                  {p.controla_vencimiento ? (
                    <input
                      type="date"
                      min={hoyISO()}
                      value={l.vencTxt}
                      onChange={(e) => cambiarLinea(l.key, 'vencTxt', e.target.value)}
                    />
                  ) : (
                    <span className="detalle">no vence</span>
                  )}
                </td>
                <td className="num">{calc.problema ? '—' : formatearPesos(calc.subtotal)}</td>
                <td>
                  <button className="quitar" onMouseDown={(e) => e.preventDefault()} onClick={() => quitar(l.key)}>✕</button>
                </td>
              </tr>
            );
          })}
          {lineas.length === 0 && (
            <tr><td colSpan="6" className="vacio">Escaneá la mercadería que llegó.</td></tr>
          )}
        </tbody>
      </table>

      <div className="pie-compra">
        <div className="total-grande">{formatearPesos(total)}</div>
        <button className="primario" disabled={!puedeConfirmar} onClick={confirmar}>
          {guardando ? 'Registrando…' : 'Confirmar ingreso'}
        </button>
      </div>

      {codigoNuevo !== null && !altaAbierta && (
        <div className="fondo-modal">
          <div className="modal">
            <h2>Código no encontrado</h2>
            <p>El código <strong>{codigoNuevo}</strong> todavía no existe en el sistema.</p>
            <div className="botones">
              <button onClick={cerrarNuevo}>Cancelar</button>
              <button className="primario" autoFocus onClick={() => setAltaAbierta(true)}>Crear producto</button>
            </div>
          </div>
        </div>
      )}

      {altaAbierta && (
        <FormularioProducto
          producto={null}
          codigoInicial={codigoNuevo}
          categorias={categorias}
          onGuardado={(creado) => { cerrarNuevo(); agregar(creado); }}
          onCancelar={cerrarNuevo}
        />
      )}

      {resultado && <ResultadoCompra compra={resultado} onCerrar={cerrarResultado} />}
    </section>
  );
}