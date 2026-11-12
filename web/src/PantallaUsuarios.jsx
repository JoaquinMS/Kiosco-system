import { useEffect, useState } from 'react';
import { api } from './api.js';
import { useSesion } from './SesionContext.jsx';

const NOMBRE_ROL = { ADMIN: 'Administrador', DUENO: 'Dueño', EMPLEADO: 'Empleado' };

function FormUsuario({ usuario, roles, onGuardado, onCancelar }) {
  const esEdicion = usuario !== null;
  const [f, setF] = useState({
    username: usuario?.username ?? '', nombre: usuario?.nombre ?? '',
    rol: usuario?.rol ?? roles[0], password: '',
  });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState('');
  const [guardando, setGuardando] = useState(false);
  const cambiar = (campo) => (e) => setF((p) => ({ ...p, [campo]: e.target.value }));
  const msg = (campo) => errores[campo] && <div className="error">{errores[campo]}</div>;

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setErrores({});
    setErrorGeneral('');
    try {
      if (esEdicion) {
        await api.actualizarUsuario(usuario.id, { nombre: f.nombre, rol: f.rol, activo: usuario.activo === 1 });
      } else {
        await api.crearUsuario(f);
      }
      onGuardado();
    } catch (err) {
      setErrores(err.detalles ?? {});
      setErrorGeneral(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fondo-modal">
      <form className="modal" onSubmit={guardar}>
        <h2>{esEdicion ? 'Editar usuario' : 'Nuevo usuario'}</h2>
        {errorGeneral && <div className="error-general">{errorGeneral}</div>}
        <label>Usuario (para iniciar sesión)
          <input value={f.username} onChange={cambiar('username')} disabled={esEdicion} autoFocus={!esEdicion} />
        </label>
        {msg('username')}
        <label>Nombre
          <input value={f.nombre} onChange={cambiar('nombre')} autoFocus={esEdicion} />
        </label>
        {msg('nombre')}
        <label>Rol
          <select value={f.rol} onChange={cambiar('rol')}>
            {roles.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
          </select>
        </label>
        {msg('rol')}
        {!esEdicion && (
          <>
            <label>Contraseña temporal (mínimo 8 caracteres)
              <input value={f.password} onChange={cambiar('password')} autoComplete="off" />
            </label>
            {msg('password')}
            <div className="ayuda">La persona tendrá que cambiarla la primera vez que entre.</div>
          </>
        )}
        <div className="botones">
          <button type="button" onClick={onCancelar}>Cancelar</button>
          <button type="submit" className="primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  );
}

export default function PantallaUsuarios() {
  const { usuario: yo, puede } = useSesion();
  const [usuarios, setUsuarios] = useState([]);
  const [formulario, setFormulario] = useState(null); // null | 'nuevo' | usuario
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [recarga, setRecarga] = useState(0);

  const roles = puede('usuarios:gestionar_todos') ? ['EMPLEADO', 'DUENO', 'ADMIN'] : ['EMPLEADO'];

  useEffect(() => {
    let vigente = true;
    api.listarUsuarios()
      .then((d) => vigente && setUsuarios(d))
      .catch((e) => vigente && setError(e.message));
    return () => { vigente = false; };
  }, [recarga]);

  async function alternarActivo(u) {
    setError(''); setExito('');
    try {
      await api.actualizarUsuario(u.id, { nombre: u.nombre, rol: u.rol, activo: u.activo !== 1 });
      setRecarga((n) => n + 1);
    } catch (e) {
      setError(e.message);
    }
  }

  async function resetear(u) {
    const clave = window.prompt(`Nueva contraseña temporal para ${u.nombre} (mínimo 8 caracteres):`);
    if (!clave) return;
    setError(''); setExito('');
    try {
      await api.resetearClave(u.id, clave);
      setExito(`Listo: ${u.nombre} deberá cambiar la contraseña al entrar.`);
    } catch (e) {
      setError(e.detalles ? Object.values(e.detalles).join(' · ') : e.message);
    }
  }

  return (
    <section>
      <div className="barra">
        <button className="primario" onClick={() => setFormulario('nuevo')}>+ Nuevo usuario</button>
      </div>
      {error && <div className="error-general">{error}</div>}
      {exito && <div className="exito">{exito}</div>}

      <table>
        <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id} className={u.activo ? '' : 'inactivo'}>
              <td>{u.username}{u.id === yo.id && ' (vos)'}</td>
              <td>{u.nombre}</td>
              <td>{NOMBRE_ROL[u.rol]}</td>
              <td>{u.activo ? 'Activo' : 'Desactivado'}{u.debe_cambiar_clave === 1 && ' · clave temporal'}</td>
              <td className="acciones">
                {u.id !== yo.id && (
                  <>
                    <button onClick={() => setFormulario(u)}>Editar</button>
                    <button onClick={() => resetear(u)}>Resetear clave</button>
                    <button className={u.activo ? 'peligro' : ''} onClick={() => alternarActivo(u)}>
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="detalle">Los usuarios no se borran: se desactivan, porque las ventas y movimientos los mencionan.</p>

      {formulario !== null && (
        <FormUsuario
          usuario={formulario === 'nuevo' ? null : formulario}
          roles={roles}
          onGuardado={() => { setFormulario(null); setRecarga((n) => n + 1); }}
          onCancelar={() => setFormulario(null)}
        />
      )}
    </section>
  );
}