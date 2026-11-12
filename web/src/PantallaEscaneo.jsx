import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { formatearPesos, formatearCantidad } from './formato.js';
import CampoEscaneo from './CampoEscaneo.jsx';
import FormularioProducto from './FormularioProducto.jsx';
import { useSesion } from './SesionContext.jsx';

// Un texto de 6 o más dígitos lo tratamos como código aunque lo hayan tipeado a mano.
const PARECE_CODIGO = /^[0-9]{6,}$/;

function TarjetaProducto({ producto: p, etiqueta }) {
  const bajo = p.stock_actual <= p.stock_minimo;
  const sufijo = p.tipo_unidad === 'PESO' ? ' /kg' : '';
  return (
    <div className="tarjeta">
      <h2>
        {p.nombre}
        <span className="insignia">{etiqueta}</span>
      </h2>
      <div className="detalle">
        {p.categoria ?? 'Sin categoría'} · Código: {p.codigo_barras ?? '—'}
      </div>
      {/* Consulta de precio: no se muestra el costo. */}
      <div className="precio">{formatearPesos(p.precio_venta)}{sufijo}</div>
      <div className={bajo ? 'stock-bajo' : ''}>
        Stock: {formatearCantidad(p.stock_actual, p.tipo_unidad)}
        {bajo && ' (stock bajo)'}
      </div>
      {!p.activo && <div className="error-general">Este producto está dado de baja.</div>}
    </div>
  );
}

// Devuelve el producto, o null si ese código no existe.
async function buscarPorCodigo(codigo) {
  try {
    return await api.buscarPorCodigo(codigo);
  } catch (e) {
    if (e.codigo === 'PRODUCTO_NO_ENCONTRADO') return null;
    throw e;
  }
}

export default function PantallaEscaneo() {
  const { puede } = useSesion();
  const refCampo = useRef(null);
  const ultimaPeticion = useRef(0); // para ignorar respuestas viejas
  const idHistorial = useRef(0);

  const [categorias, setCategorias] = useState([]);
  const [actual, setActual] = useState(null); // { producto, etiqueta }
  const [resultados, setResultados] = useState([]); // búsqueda por nombre con varias coincidencias
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [codigoNuevo, setCodigoNuevo] = useState(null); // código que no existe
  const [altaAbierta, setAltaAbierta] = useState(false);
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    api.listarCategorias().then(setCategorias).catch((e) => setError(e.message));
  }, []);

  function anotar(texto, medicion, resultado) {
    const entrada = {
      id: ++idHistorial.current,
      hora: new Date().toLocaleTimeString('es-AR'),
      texto,
      origen: medicion.esEscaneo ? 'escaneo' : 'manual',
      ms: medicion.promedioMs,
      resultado,
    };
    setHistorial((h) => [entrada, ...h].slice(0, 8));
  }

  function mostrar(producto, etiqueta) {
    setActual({ producto, etiqueta });
    setResultados([]);
    setAviso('');
  }

  async function alIngresar(texto, medicion) {
    const numero = ++ultimaPeticion.current;
    setError('');
    setAviso('');

    try {
      if (medicion.esEscaneo || PARECE_CODIGO.test(texto)) {
        // ---- Búsqueda por código ----
        const producto = await buscarPorCodigo(texto);
        anotar(texto, medicion, producto ? producto.nombre : 'NO EXISTE');
        if (numero !== ultimaPeticion.current) return; // llegó otro escaneo después
        if (producto) {
          mostrar(producto, medicion.esEscaneo ? 'escaneo' : 'código manual');
        } else {
          setActual(null);
          setCodigoNuevo(texto); // abre la ventana "no existe"
        }
      } else {
        // ---- Búsqueda por nombre ----
        const lista = await api.listarProductos({ buscar: texto });
        anotar(texto, medicion, `${lista.length} resultado(s)`);
        if (numero !== ultimaPeticion.current) return;
        if (lista.length === 1) {
          mostrar(lista[0], 'búsqueda por nombre');
        } else if (lista.length === 0) {
          setActual(null);
          setResultados([]);
          setAviso(`No hay productos que coincidan con "${texto}".`);
        } else {
          setActual(null);
          setResultados(lista);
        }
      }
    } catch (e) {
      setError(e.message);
    }
  }

  function elegirResultado(producto) {
    mostrar(producto, 'búsqueda por nombre');
    refCampo.current?.focus();
  }

  function cerrarNuevo() {
    setCodigoNuevo(null);
    setAltaAbierta(false);
  }

  return (
    <section>
      <div className="escaneo">
        <div>
          <CampoEscaneo
            onCodigo={alIngresar}
            bloqueado={codigoNuevo !== null}
            refCampo={refCampo}
          />

          {error && <div className="error-general" style={{ marginTop: 12 }}>{error}</div>}
          {aviso && <div className="aviso">{aviso}</div>}

          {actual && <TarjetaProducto producto={actual.producto} etiqueta={actual.etiqueta} />}

          {resultados.length > 0 && (
            <ul className="resultados">
              {resultados.map((p) => (
                <li key={p.id}>
                  <button onClick={() => elegirResultado(p)}>
                    <span>{p.nombre}</span>
                    <span>{formatearPesos(p.precio_venta)}{p.tipo_unidad === 'PESO' ? ' /kg' : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!actual && resultados.length === 0 && !aviso && (
            <p className="vacio">Esperando un escaneo…</p>
          )}
        </div>

        <aside className="historial">
          <h3>Últimas lecturas</h3>
          {historial.length === 0 && <div className="detalle">Todavía no hay lecturas.</div>}
          <ul>
            {historial.map((h) => (
              <li key={h.id} className={h.resultado === 'NO EXISTE' ? 'no-existe' : ''}>
                <div>{h.hora} · <strong>{h.texto}</strong></div>
                <div>
                  {h.resultado} · {h.origen}
                  {h.ms !== null && ` (${h.ms} ms/tecla)`}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {/* Ventana 1: el código no existe */}
      {codigoNuevo !== null && !altaAbierta && (
        <div className="fondo-modal">
          <div className="modal">
            <h2>Código no encontrado</h2>
            <p>El código <strong>{codigoNuevo}</strong> todavía no existe en el sistema.</p>
            <div className="botones">
              <button onClick={cerrarNuevo}>Cancelar</button>
              {puede('productos:crear')
                ? <button className="primario" autoFocus onClick={() => setAltaAbierta(true)}>Crear producto</button>
                : <span className="detalle">Pedile al dueño que cargue este producto.</span>}
            </div>
          </div>
        </div>
      )}

      {/* Ventana 2: alta rápida con el código ya cargado */}
      {altaAbierta && (
        <FormularioProducto
          producto={null}
          codigoInicial={codigoNuevo}
          categorias={categorias}
          onGuardado={(creado) => {
            cerrarNuevo();
            mostrar(creado, 'recién creado');
          }}
          onCancelar={cerrarNuevo}
        />
      )}
    </section>
  );
}