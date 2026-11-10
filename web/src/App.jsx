import { useState } from 'react';
import PantallaCaja from './PantallaCaja.jsx';
import PantallaEscaneo from './PantallaEscaneo.jsx';
import PantallaCompras from './PantallaCompras.jsx';
import PantallaStock from './PantallaStock.jsx';
import ListaProductos from './ListaProductos.jsx';

const PESTANAS = [
  { id: 'caja', nombre: 'Caja (vender)' },
  { id: 'escanear', nombre: 'Consultar precio' },
  { id: 'compras', nombre: 'Ingreso de mercadería' },
  { id: 'stock', nombre: 'Stock / ajustes' },
  { id: 'productos', nombre: 'Productos' },
];

export default function App() {
  const [pestana, setPestana] = useState('caja');

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
          </button>
        ))}
      </nav>

      {pestana === 'caja' && <PantallaCaja />}
      {pestana === 'escanear' && <PantallaEscaneo />}
      {pestana === 'compras' && <PantallaCompras />}
      {pestana === 'stock' && <PantallaStock />}
      {pestana === 'productos' && <ListaProductos />}
    </div>
  );
}