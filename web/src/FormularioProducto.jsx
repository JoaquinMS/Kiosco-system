import { useRef, useState } from 'react';
import { api } from './api.js';
import { pesosACentavos, cantidadABase, centavosATexto, baseATexto } from './formato.js';

// producto = null  -> alta de un producto nuevo
// producto = {...} -> edición
export default function FormularioProducto({ producto, codigoInicial = '', categorias, onGuardado, onCancelar }) {
  const esEdicion = producto !== null;
  const refNombre = useRef(null);

  const [f, setF] = useState(() => ({
    codigo_barras: producto?.codigo_barras ?? codigoInicial,
    nombre: producto?.nombre ?? '',
    categoria_id: producto?.categoria_id ?? '',
    tipo_unidad: producto?.tipo_unidad ?? 'UNIDAD',
    costo: producto ? centavosATexto(producto.costo) : '',
    precio_venta: producto ? centavosATexto(producto.precio_venta) : '',
    stock_actual: producto ? baseATexto(producto.stock_actual, producto.tipo_unidad) : '0',
    stock_minimo: producto ? baseATexto(producto.stock_minimo, producto.tipo_unidad) : '0',
    controla_vencimiento: producto ? producto.controla_vencimiento === 1 : false,
  }));
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [guardando, setGuardando] = useState(false);

  const esPeso = f.tipo_unidad === 'PESO';
  const porKg = esPeso ? ' (por kg)' : '';
  const enKg = esPeso ? ' (kg)' : '';

  function cambiar(campo) {
    return (e) => {
      const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      setF((previo) => ({ ...previo, [campo]: valor }));
    };
  }

  function mensaje(campo) {
    return errores[campo] ? <div className="error">{errores[campo]}</div> : null;
  }

  async function guardar(e) {
    e.preventDefault();
    setErrorGeneral('');

    // 1) Convertir lo escrito a centavos / unidad base y detectar números inválidos.
    const costo = pesosACentavos(f.costo === '' ? '0' : f.costo);
    const precio = pesosACentavos(f.precio_venta === '' ? '0' : f.precio_venta);
    const stockMinimo = cantidadABase(f.stock_minimo === '' ? '0' : f.stock_minimo, f.tipo_unidad);
    const stockActual = cantidadABase(f.stock_actual === '' ? '0' : f.stock_actual, f.tipo_unidad);

    const locales = {};
    if (Number.isNaN(costo)) locales.costo = 'Escribí un número válido, por ejemplo 1200,50';
    if (Number.isNaN(precio)) locales.precio_venta = 'Escribí un número válido, por ejemplo 1500,00';
    if (Number.isNaN(stockMinimo)) locales.stock_minimo = esPeso ? 'Número no válido (kg)' : 'Debe ser un número entero';
    if (!esEdicion && Number.isNaN(stockActual)) locales.stock_actual = esPeso ? 'Número no válido (kg)' : 'Debe ser un número entero';
    if (Object.keys(locales).length > 0) {
      setErrores(locales);
      return;
    }

    // 2) Armar lo que se envía al servidor.
    const datos = {
      codigo_barras: producto?.codigo_barras ?? codigoInicial,
      nombre: f.nombre,
      categoria_id: f.categoria_id === '' ? null : Number(f.categoria_id),
      tipo_unidad: f.tipo_unidad,
      costo,
      precio_venta: precio,
      stock_minimo: stockMinimo,
      controla_vencimiento: f.controla_vencimiento,
    };
    if (!esEdicion) datos.stock_actual = stockActual;

    // 3) Enviar.
    setGuardando(true);
    try {
      const guardado = esEdicion
        ? await api.actualizarProducto(producto.id, datos)
        : await api.crearProducto(datos);
      onGuardado(guardado);
    } catch (err) {
      setErrores(err.detalles ?? {}); // errores por campo que manda el servidor
      setErrorGeneral(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fondo-modal">
      <form className="modal" onSubmit={guardar}>
        <h2>{esEdicion ? 'Editar producto' : 'Nuevo producto'}</h2>

        {errorGeneral && <div className="error-general">{errorGeneral}</div>}

        <label>Código de barras (opcional)
          <input
            value={f.codigo_barras}
            onChange={cambiar('codigo_barras')}
            autoFocus={!codigoInicial}
            // El lector USB manda "Enter" al terminar de escanear. Sin esto, enviaría
            // el formulario incompleto. Mejor: saltar al campo siguiente.
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                refNombre.current?.focus();
              }
            }}
          />
        </label>
        {mensaje('codigo_barras')}

        <label>Nombre
          <input ref={refNombre} value={f.nombre} autoFocus={!!codigoInicial} onChange={cambiar('nombre')} />
        </label>
        {mensaje('nombre')}

        <div className="fila">
          <label>Categoría
            <select value={f.categoria_id} onChange={cambiar('categoria_id')}>
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </label>
          <label>Se vende por
            <select value={f.tipo_unidad} onChange={cambiar('tipo_unidad')} disabled={esEdicion}>
              <option value="UNIDAD">Unidad</option>
              <option value="PESO">Peso (kg)</option>
            </select>
          </label>
        </div>
        {mensaje('tipo_unidad')}
        {esEdicion && <div className="ayuda">El tipo de unidad no se puede cambiar una vez creado el producto.</div>}

        <div className="fila">
          <label>Costo{porKg} ($)
            <input value={f.costo} onChange={cambiar('costo')} inputMode="decimal" placeholder="1200,50" />
          </label>
          <label>Precio de venta{porKg} ($)
            <input value={f.precio_venta} onChange={cambiar('precio_venta')} inputMode="decimal" placeholder="1500,00" />
          </label>
        </div>
        {mensaje('costo')}
        {mensaje('precio_venta')}

        <div className="fila">
          {!esEdicion && (
            <label>Stock inicial{enKg}
              <input value={f.stock_actual} onChange={cambiar('stock_actual')} inputMode="decimal" />
            </label>
          )}
          <label>Stock mínimo{enKg}
            <input value={f.stock_minimo} onChange={cambiar('stock_minimo')} inputMode="decimal" />
          </label>
        </div>
        {mensaje('stock_actual')}
        {mensaje('stock_minimo')}
        {esEdicion && <div className="ayuda">El stock se modifica con ingresos de mercadería y ajustes (próximas etapas).</div>}

        <label className="check">
          <input type="checkbox" checked={f.controla_vencimiento} onChange={cambiar('controla_vencimiento')} />
          Controlar fecha de vencimiento
        </label>

        <div className="botones">
          <button type="button" onClick={onCancelar}>Cancelar</button>
          <button type="submit" className="primario" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}