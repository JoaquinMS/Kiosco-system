import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import {
  formatearPesos, formatearCantidad, baseATexto,
  subtotalLinea, resolverDescuento, nuevoUuid,
} from './formato.js';
import CampoEscaneo from './CampoEscaneo.jsx';
import FormularioProducto from './FormularioProducto.jsx';
import ModalPeso from './ModalPeso.jsx';
import ModalCobro from './ModalCobro.jsx';
import Ticket from './Ticket.jsx';

const PARECE_CODIGO = /^[0-9]{6,}$/;
const MAX_CANTIDAD = 1_000_000;

// Cantidad de un producto por unidad: [-] [ 3 ] [+]
function CantidadUnidades({ valor, onCambiar, onTerminar }) {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => setTexto(String(valor)), [valor]);

  function alEscribir(e) {
    const t = e.target.value.replace(/\D/g, '');
    setTexto(t);
    const n = Number(t);
    if (t !== '' && n >= 1 && n <= MAX_CANTIDAD) onCambiar(n);
  }

  // onMouseDown + preventDefault: el botón funciona pero NO le quita el foco al campo de escaneo.
  const sinRobarFoco = (e) => e.preventDefault();

  return (
    <span className="cantidad">
      <button onMouseDown={sinRobarFoco} disabled={valor <= 1} onClick={() => onCambiar(valor - 1)}>−</button>
      <input
        value={texto}
        onChange={alEscribir}
        onBlur={() => { setTexto(String(valor)); onTerminar(); }}
        onKeyDown={(e) => e.key === 'Enter' && onTerminar(true)}
        inputMode="numeric"
      />
      <button onMouseDown={sinRobarFoco} disabled={valor >= MAX_CANTIDAD} onClick={() => onCambiar(valor + 1)}>+</button>
    </span>
  );
}

export default function PantallaCaja() {
  const refCampo = useRef(null);
  const cola = useRef(Promise.resolve()); // los escaneos se procesan de a uno, EN ORDEN
  const uuidVenta = useRef('');

  const [categorias, setCategorias] = useState([]);
  const [carrito, setCarrito] = useState([]); // [{ producto, cantidad }]  (cantidad en unidad base)
  const [tipoDesc, setTipoDesc] = useState('PORCENTAJE');
  const [textoDesc, setTextoDesc] = useState('');
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [resultados, setResultados] = useState([]);
  const [pesoPendiente, setPesoPendiente] = useState(null); // { producto, modo, inicial }
  const [codigoNuevo, setCodigoNuevo] = useState(null);
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorCobro, setErrorCobro] = useState('');
  const [ticket, setTicket] = useState(null);

  useEffect(() => {
    api.listarCategorias().then(setCategorias).catch((e) => setError(e.message));
  }, []);

  // ---- Totales (solo para mostrar; el servidor los recalcula) ----
  const subtotal = carrito.reduce(
    (suma, l) => suma + subtotalLinea(l.producto.precio_venta, l.cantidad, l.producto.tipo_unidad), 0);
  const desc = resolverDescuento(subtotal, tipoDesc, textoDesc);
  const total = subtotal - desc.centavos;
  const puedeCobrar = carrito.length > 0 && !desc.error && total > 0;

  const hayVentana = codigoNuevo !== null || pesoPendiente !== null || cobrando || ticket !== null;

  // ---- Atajos de teclado: F8 cobrar, F9 cancelar ----
  // Sin lista de dependencias: se vuelve a registrar en cada render y siempre ve el estado actual.
  useEffect(() => {
    function alTecla(e) {
      if (e.key === 'F8') {
        e.preventDefault();
        if (!hayVentana && puedeCobrar) abrirCobro();
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (!hayVentana) cancelarVenta();
      }
    }
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  });

  // Si el foco quedó "en el vacío", se lo devolvemos al campo de escaneo.
  function devolverFoco(inmediato = false) {
    const accion = () => {
      if (inmediato || document.activeElement === document.body) refCampo.current?.focus();
    };
    if (inmediato) accion();
    else setTimeout(accion, 50);
  }

  // ---- Carrito ----
  function sumarCantidad(producto, cantidad) {
    setCarrito((previo) => {
      const i = previo.findIndex((l) => l.producto.id === producto.id);
      if (i === -1) return [...previo, { producto, cantidad }];
      return previo.map((l, j) =>
        j === i ? { producto, cantidad: Math.min(l.cantidad + cantidad, MAX_CANTIDAD) } : l);
    });
  }

  function fijarCantidad(id, cantidad) {
    setCarrito((previo) => previo.map((l) => (l.producto.id === id ? { ...l, cantidad } : l)));
  }

  function quitar(id) {
    setCarrito((previo) => previo.filter((l) => l.producto.id !== id));
    devolverFoco(true);
  }

  function agregar(producto) {
    setResultados([]);
    if (!producto.activo) {
      setAviso(`"${producto.nombre}" está dado de baja.`);
      return;
    }
    if (producto.precio_venta <= 0) {
      setAviso(`"${producto.nombre}" no tiene precio cargado. Cargalo en la pestaña Productos.`);
      return;
    }
    setAviso('');
    if (producto.tipo_unidad === 'PESO') {
      setPesoPendiente({ producto, modo: 'sumar', inicial: '' });
    } else {
      sumarCantidad(producto, 1);
    }
  }

  function confirmarPeso(gramos) {
    const { producto, modo } = pesoPendiente;
    if (modo === 'sumar') sumarCantidad(producto, gramos);
    else fijarCantidad(producto.id, gramos);
    setPesoPendiente(null);
  }

  function cancelarVenta() {
    if (carrito.length === 0) return;
    if (!window.confirm('¿Cancelar la venta y vaciar el carrito?')) return;
    setCarrito([]);
    setTextoDesc('');
    setAviso('');
    setResultados([]);
    devolverFoco(true);
  }

  // ---- Escaneo / búsqueda ----
  // Cada escaneo se encadena al anterior: si el lector manda dos códigos muy seguidos,
  // se agregan los dos, en el orden en que se escanearon.
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
        else setCodigoNuevo(texto); // abre "código no encontrado"
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

  // ---- Cobro ----
  function abrirCobro() {
    uuidVenta.current = nuevoUuid(); // un identificador por intento de cobro
    setErrorCobro('');
    setCobrando(true);
  }

  async function confirmarCobro(pagos) {
    setGuardando(true);
    setErrorCobro('');
    try {
      const venta = await api.crearVenta({
        client_uuid: uuidVenta.current,
        items: carrito.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad })),
        descuento: desc.payload,
        pagos,
      });
      setCobrando(false);
      setTicket(venta);
      setCarrito([]);
      setTextoDesc('');
    } catch (e) {
      setErrorCobro(e.message); // la ventana queda abierta para reintentar (mismo uuid)
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section>
      <div className="caja">
        <div>
          <CampoEscaneo onCodigo={alIngresar} bloqueado={hayVentana} refCampo={refCampo} />

          {error && <div className="error-general" style={{ marginTop: 12 }}>{error}</div>}
          {aviso && <div className="aviso">{aviso}</div>}

          {resultados.length > 0 && (
            <ul className="resultados">
              {resultados.map((p) => (
                <li key={p.id}>
                  <button onClick={() => { agregar(p); devolverFoco(true); }}>
                    <span>{p.nombre}</span>
                    <span>{formatearPesos(p.precio_venta)}{p.tipo_unidad === 'PESO' ? ' /kg' : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th className="num">Precio</th>
                <th className="num">Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {carrito.map((l) => {
                const p = l.producto;
                const esPeso = p.tipo_unidad === 'PESO';
                return (
                  <tr key={p.id}>
                    <td>
                      {p.nombre}
                      {l.cantidad > p.stock_actual && (
                        <div className="aviso-linea">
                          ⚠ Stock del sistema: {formatearCantidad(p.stock_actual, p.tipo_unidad)}
                        </div>
                      )}
                    </td>
                    <td>
                      {esPeso ? (
                        <button
                          onClick={() => setPesoPendiente({
                            producto: p, modo: 'reemplazar', inicial: baseATexto(l.cantidad, 'PESO'),
                          })}
                        >
                          {formatearCantidad(l.cantidad, 'PESO')}
                        </button>
                      ) : (
                        <CantidadUnidades
                          valor={l.cantidad}
                          onCambiar={(n) => fijarCantidad(p.id, n)}
                          onTerminar={devolverFoco}
                        />
                      )}
                    </td>
                    <td className="num">{formatearPesos(p.precio_venta)}{esPeso ? ' /kg' : ''}</td>
                    <td className="num">{formatearPesos(subtotalLinea(p.precio_venta, l.cantidad, p.tipo_unidad))}</td>
                    <td>
                      <button className="quitar" onMouseDown={(e) => e.preventDefault()} onClick={() => quitar(p.id)}>✕</button>
                    </td>
                  </tr>
                );
              })}
              {carrito.length === 0 && (
                <tr><td colSpan="5" className="vacio">El carrito está vacío. Escaneá un producto.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <aside className="panel panel-total">
          <div className="fila-total"><span>Subtotal</span><span>{formatearPesos(subtotal)}</span></div>

          <div className="descuento">
            <select value={tipoDesc} onChange={(e) => setTipoDesc(e.target.value)}>
              <option value="PORCENTAJE">Descuento %</option>
              <option value="MONTO">Descuento $</option>
            </select>
            <input
              value={textoDesc}
              onChange={(e) => setTextoDesc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && devolverFoco(true)}
              inputMode="decimal"
              placeholder="0"
            />
          </div>
          {desc.error && <div className="error">{desc.error}</div>}
          {desc.centavos > 0 && (
            <div className="fila-total"><span>Descuento</span><span>- {formatearPesos(desc.centavos)}</span></div>
          )}

          <div className="total-grande">{formatearPesos(total)}</div>

          <button className="primario" disabled={!puedeCobrar} onClick={abrirCobro}>Cobrar (F8)</button>
          <button className="peligro" disabled={carrito.length === 0} onClick={cancelarVenta}>Cancelar venta (F9)</button>
        </aside>
      </div>

      {/* Peso de un producto por kg */}
      {pesoPendiente && (
        <ModalPeso
          producto={pesoPendiente.producto}
          titulo={pesoPendiente.modo === 'sumar' ? 'Agregar al carrito' : 'Cambiar el peso'}
          inicial={pesoPendiente.inicial}
          onConfirmar={confirmarPeso}
          onCancelar={() => setPesoPendiente(null)}
        />
      )}

      {/* Código inexistente */}
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

      {/* Alta rápida: al guardar, el producto nuevo se agrega al carrito */}
      {altaAbierta && (
        <FormularioProducto
          producto={null}
          codigoInicial={codigoNuevo}
          categorias={categorias}
          onGuardado={(creado) => { cerrarNuevo(); agregar(creado); }}
          onCancelar={cerrarNuevo}
        />
      )}

      {cobrando && (
        <ModalCobro
          total={total}
          guardando={guardando}
          error={errorCobro}
          onConfirmar={confirmarCobro}
          onCancelar={() => setCobrando(false)}
        />
      )}

      {ticket && <Ticket venta={ticket} onCerrar={() => setTicket(null)} />}
    </section>
  );
}