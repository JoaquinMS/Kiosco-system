import { useEffect, useState } from 'react';
import { api } from './api.js';
import PantallaCaja from './PantallaCaja.jsx';
import PantallaEscaneo from './PantallaEscaneo.jsx';
import PantallaCompras from './PantallaCompras.jsx';
import PantallaStock from './PantallaStock.jsx';
import PantallaAlertas from './PantallaAlertas.jsx';
import PantallaReportes from './PantallaReportes.jsx';
import ListaProductos from './ListaProductos.jsx';

const PESTANAS = [
  { id: 'caja', nombre: 'Caja (vender)' },
  { id: 'escanear', nombre: 'Consultar precio' },
  { id: 'compras', nombre: 'Ingreso de mercadería' },
  { id: 'stock', nombre: 'Stock / ajustes' },
  { id: 'alertas', nombre: 'Alertas' },
  { id: 'reportes', nombre: 'Reportes' },
  { id: 'productos', nombre: 'Productos' },
];

export default function App() {
  const [pestana, setPestana] = useState('caja');
  const [cantidadAlertas, setCantidadAlertas] = useState(0);

  // El globito rojo se actualiza cada vez que se cambia de pestaña.
  useEffect(() => {
    api.alertas()
      .then((a) => setCantidadAlertas(a.stock_bajo.length + a.vencimientos.length))
      .catch(() => {}); // si falla, simplemente no se muestra el globito
  }, [pestana]);

  return (
    <div className="contenedor">
      <header className="encabezado">
        <h1>Kiosco</h1>
      </header>

      <nav className="pestanas">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            className={pestana === p.id ? 'activa' : ''}
            onClick={() => setPestana(p.id)}
          >
            {p.nombre}
            {p.id === 'alertas' && cantidadAlertas > 0 && <span className="globito">{cantidadAlertas}</span>}
          </button>
        ))}
      </nav>

      {pestana === 'caja' && <PantallaCaja />}
      {pestana === 'escanear' && <PantallaEscaneo />}
      {pestana === 'compras' && <PantallaCompras />}
      {pestana === 'stock' && <PantallaStock />}
      {pestana === 'alertas' && <PantallaAlertas />}
      {pestana === 'reportes' && <PantallaReportes />}
      {pestana === 'productos' && <ListaProductos />}
    </div>
  );
}