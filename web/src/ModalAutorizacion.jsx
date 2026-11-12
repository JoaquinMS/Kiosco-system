// Pide el usuario y la contraseña de un dueño para autorizar un descuento alto.
import { useState } from 'react';

export default function ModalAutorizacion({ error, enviando, onConfirmar, onCancelar }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  function enviar(e) {
    e.preventDefault();
    if (username.trim() && password) onConfirmar({ username: username.trim(), password });
  }

  return (
    <div className="fondo-modal">
      <form className="modal" onSubmit={enviar} onKeyDown={(e) => e.key === 'Escape' && onCancelar()}>
        <h2>Autorización de un dueño</h2>
        <p className="detalle">El descuento supera el máximo permitido. Un dueño tiene que autorizarlo.</p>
        {error && <div className="error-general">{error}</div>}
        <label className="campo-form">Usuario del dueño
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="off" />
        </label>
        <label className="campo-form">Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
        </label>
        <div className="botones">
          <button type="button" onClick={onCancelar}>Volver</button>
          <button type="submit" className="primario" disabled={enviando || !username.trim() || !password}>
            {enviando ? 'Verificando…' : 'Autorizar y cobrar'}
          </button>
        </div>
      </form>
    </div>
  );
}