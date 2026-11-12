import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { SesionContext } from './SesionContext.jsx';
import PantallaLogin from './PantallaLogin.jsx';
import CambiarClave from './CambiarClave.jsx';
import PantallaCaja from './PantallaCaja.jsx';
import PantallaEscaneo from './PantallaEscaneo.jsx';
import PantallaCompras from './PantallaCompras.jsx';
import PantallaStock from './PantallaStock.jsx';
import PantallaAlertas from './PantallaAlertas.jsx';
import PantallaReportes from './PantallaReportes.jsx';
import PantallaVentas from './PantallaVentas.jsx';
import PantallaPrecios from './PantallaPrecios.jsx';
import PantallaUsuarios from './PantallaUsuarios.jsx';
import ListaProductos from './ListaProductos.jsx';

// Cada pestaña declara el permiso que necesita. (El servidor lo vuelve a controlar.)
const PESTANAS = [
  { id: 'caja', nombre: 'Caja (vender)', permiso: 'ventas:crear', Pantalla: PantallaCaja },
  { id: 'escanear', nombre: 'Consultar precio', permiso: 'productos:ver', Pantalla: PantallaEscaneo },
  { id: 'ventas', nombre: 'Ventas', permiso: 'ventas:ver', Pantalla: PantallaVentas },
  { id: 'compras', nombre: 'Ingreso de mercadería', permiso: 'compras:gestionar', Pantalla: PantallaCompras },
  { id: 'stock', nombre: 'Stock / ajustes', permiso: 'stock:ajustar', Pantalla: PantallaStock },
  { id: 'alertas', nombre: 'Alertas', permiso: 'alertas:ver', Pantalla: PantallaAlertas },
  { id: 'reportes', nombre: 'Reportes', permiso: 'reportes:ver', Pantalla: PantallaReportes },
  { id: 'productos', nombre: 'Productos', permiso: 'productos:escribir', Pantalla: ListaProductos },
  { id: 'precios', nombre: 'Precios', permiso: 'precios:masivos', Pantalla: PantallaPrecios },
  { id: 'usuarios', nombre: 'Usuarios', permiso: 'usuarios:gestionar', Pantalla: PantallaUsuarios },
];

const NOMBRE_ROL = { ADMIN: 'Administrador', DUENO: 'Dueño', EMPLEADO: 'Empleado' };

export default function App() {
  const [usuario, setUsuario] = useState(undefined); // undefined = cargando | null = sin sesión
  const [pestana, setPestana] = useState(null);
  const [cantidadAlertas, setCantidadAlertas] = useState(0);
  const [cambiandoClave, setCambiandoClave] = useState(false);

  // Al abrir la página: ¿ya hay una sesión activa?
  useEffect(() => {
    api.me().then(setUsuario).catch(() => setUsuario(null));
  }, []);

  // Si el servidor avisa que la sesión terminó (venció, o te desactivaron), volvemos al login.
  useEffect(() => {
    const alExpirar = () => { setUsuario(null); setPestana(null); };
    window.addEventListener('sesion-expirada', alExpirar);
    return () => window.removeEventListener('sesion-expirada', alExpirar);
  }, []);

  const puede = useCallback((permiso) => usuario?.permisos.includes(permiso) ?? false, [usuario]);
  const contexto = useMemo(() => ({ usuario, puede }), [usuario, puede]);

  const visibles = PESTANAS.filter((p) => puede(p.permiso));
  const actual = visibles.find((p) => p.id === pestana) ?? visibles[0];

  // El globito rojo se actualiza al cambiar de pestaña (solo si puede ver alertas).
  useEffect(() => {
    if (!usuario || usuario.debe_cambiar_clave || !puede('alertas:ver')) return;
    api.alertas()
      .then((a) => setCantidadAlertas(a.stock_bajo.length + a.vencimientos.length))
      .catch(() => {});
  }, [pestana, usuario, puede]);

  async function salir() {
    try { await api.logout(); } catch { /* da igual: igual cerramos la pantalla */ }
    setUsuario(null);
    setPestana(null);
  }

  if (usuario === undefined) return <p className="vacio">Cargando…</p>;
  if (usuario === null) return <PantallaLogin onEntrar={setUsuario} />;

  if (usuario.debe_cambiar_clave) {
    return (
      <CambiarClave
        obligatorio
        onListo={() => setUsuario((u) => ({ ...u, debe_cambiar_clave: 0 }))}
      />
    );
  }

  return (
    <SesionContext.Provider value={contexto}>
      <div className="contenedor">
        <header className="encabezado">
          <h1>Kiosco</h1>
          <div className="sesion">
            <span>{usuario.nombre} · {NOMBRE_ROL[usuario.rol]}</span>
            <button onClick={() => setCambiandoClave(true)}>Cambiar contraseña</button>
            <button onClick={salir}>Salir</button>
          </div>
        </header>

        <nav className="pestanas">
          {visibles.map((p) => (
            <button key={p.id} className={actual?.id === p.id ? 'activa' : ''} onClick={() => setPestana(p.id)}>
              {p.nombre}
              {p.id === 'alertas' && cantidadAlertas > 0 && <span className="globito">{cantidadAlertas}</span>}
            </button>
          ))}
        </nav>

        {actual ? <actual.Pantalla key={actual.id} /> : <p className="vacio">Tu usuario no tiene pantallas habilitadas.</p>}

        {cambiandoClave && (
          <CambiarClave onListo={() => setCambiandoClave(false)} onCancelar={() => setCambiandoClave(false)} />
        )}
      </div>
    </SesionContext.Provider>
  );
}