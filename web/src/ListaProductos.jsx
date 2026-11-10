import { useEffect, useState } from 'react';
import { api } from './api.js';
import { formatearPesos, formatearCantidad } from './formato.js';
import FormularioProducto from './FormularioProducto.jsx';

export default function ListaProductos() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [soloBajo, setSoloBajo] = useState(false);
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  // null = formulario cerrado | 'nuevo' = alta | objeto producto = edición
  const [formulario, setFormulario] = useState(null);
  const [recarga, setRecarga] = useState(0); // al subirlo, se vuelve a pedir la lista

  // Las categorías se piden una sola vez.
  useEffect(() => {
    api.listarCategorias().then(setCategorias).catch((e) => setError(e.message));
  }, []);

  // La lista se vuelve a pedir cuando cambia un filtro (con una pequeña espera
  // para no consultar en cada tecla) o cuando se guarda algo.
  useEffect(() => {
    let vigente = true; // evita que una respuesta vieja pise a una más nueva
    setCargando(true);
    const timer = setTimeout(async () => {
      try {
        const datos = await api.listarProductos({ buscar, categoriaId, soloBajo, incluirInactivos });
        if (vigente) {
          setProductos(datos);
          setError('');
        }
      } catch (e) {
        if (vigente) setError(e.message);
      } finally {
        if (vigente) setCargando(false);
      }
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(timer);
    };
  }, [buscar, categoriaId, soloBajo, incluirInactivos, recarga]);

  async function darDeBaja(producto) {
    if (!window.confirm(`¿Dar de baja "${producto.nombre}"?\nDeja de aparecer, pero no se pierde su historial.`)) return;
    try {
      await api.darDeBaja(producto.id);
      setRecarga((n) => n + 1);
    } catch (e) {
      setError(e.message);
    }
  }

  async function reactivar(producto) {
    try {
      await api.reactivar(producto.id);
      setRecarga((n) => n + 1);
    } catch (e) {
      setError(e.message);
    }
  }

  function alGuardar() {
    setFormulario(null);
    setRecarga((n) => n + 1);
  }

  return (
    <section>
      <div className="barra">
        <input
          type="search"
          placeholder="Buscar por nombre o código…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <label>
          <input type="checkbox" checked={soloBajo} onChange={(e) => setSoloBajo(e.target.checked)} />
          Solo stock bajo
        </label>
        <label>
          <input type="checkbox" checked={incluirInactivos} onChange={(e) => setIncluirInactivos(e.target.checked)} />
          Mostrar dados de baja
        </label>
        <button className="primario" onClick={() => setFormulario('nuevo')}>+ Nuevo producto</button>
      </div>

      {error && <div className="error-general">{error}</div>}

      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Categoría</th>
            <th className="num">Costo</th>
            <th className="num">Precio</th>
            <th className="num">Stock</th>
            <th className="num">Mínimo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {productos.map((p) => {
            const bajo = p.stock_actual <= p.stock_minimo;
            const sufijo = p.tipo_unidad === 'PESO' ? ' /kg' : '';
            return (
              <tr key={p.id} className={p.activo ? '' : 'inactivo'}>
                <td>{p.codigo_barras ?? '—'}</td>
                <td>{p.nombre}{!p.activo && ' (de baja)'}</td>
                <td>{p.categoria ?? '—'}</td>
                <td className="num">{formatearPesos(p.costo)}{sufijo}</td>
                <td className="num">{formatearPesos(p.precio_venta)}{sufijo}</td>
                <td className={'num' + (bajo && p.activo ? ' stock-bajo' : '')}>
                  {formatearCantidad(p.stock_actual, p.tipo_unidad)}
                </td>
                <td className="num">{formatearCantidad(p.stock_minimo, p.tipo_unidad)}</td>
                <td className="acciones">
                  <button onClick={() => setFormulario(p)}>Editar</button>
                  {p.activo
                    ? <button className="peligro" onClick={() => darDeBaja(p)}>Dar de baja</button>
                    : <button onClick={() => reactivar(p)}>Reactivar</button>}
                </td>
              </tr>
            );
          })}
          {!cargando && productos.length === 0 && (
            <tr><td colSpan="8" className="vacio">No hay productos para mostrar.</td></tr>
          )}
        </tbody>
      </table>
      {cargando && <p className="vacio">Cargando…</p>}

      {formulario !== null && (
        <FormularioProducto
          producto={formulario === 'nuevo' ? null : formulario}
          categorias={categorias}
          onGuardado={alGuardar}
          onCancelar={() => setFormulario(null)}
        />
      )}
    </section>
  );
}