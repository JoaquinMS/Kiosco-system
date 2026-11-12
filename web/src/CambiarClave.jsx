// Cambio de contraseña. Si es "obligatorio" (primer ingreso o clave reseteada) no se puede cancelar.
import { useState } from 'react';
import { api } from './api.js';

export default function CambiarClave({ obligatorio = false, onListo, onCancelar }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    if (nueva.length < 8) return setError('La contraseña nueva debe tener al menos 8 caracteres');
    if (nueva !== repetir) return setError('Las dos contraseñas nuevas no coinciden');
    setGuardando(true);
    try {
      await api.cambiarClave(actual, nueva);
      onListo();
    } catch (err) {
      setError(err.detalles ? Object.values(err.detalles).join(' · ') : err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fondo-modal">
      <form className="modal" onSubmit={enviar}>
        <h2>{obligatorio ? 'Elegí tu contraseña' : 'Cambiar contraseña'}</h2>
        {obligatorio && <p className="detalle">Tenés que reemplazar la contraseña temporal antes de seguir.</p>}
        {error && <div className="error-general">{error}</div>}
        <label className="campo-form">Contraseña actual
          <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoFocus autoComplete="current-password" />
        </label>
        <label className="campo-form">Contraseña nueva (mínimo 8 caracteres)
          <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" />
        </label>
        <label className="campo-form">Repetí la contraseña nueva
          <input type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" />
        </label>
        <div className="botones">
          {!obligatorio && <button type="button" onClick={onCancelar}>Cancelar</button>}
          <button type="submit" className="primario" disabled={guardando || !actual || !nueva}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}