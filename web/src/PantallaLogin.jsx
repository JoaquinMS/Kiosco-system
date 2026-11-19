import { useState } from 'react';
import { api } from './api.js';

export default function PantallaLogin({ onEntrar }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      onEntrar(await api.login(username.trim(), password));
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <form className="panel" onSubmit={enviar}>
        <img src="/logo.png" alt="Logo" style={{ maxWidth: 160, display: 'block', margin: '0 auto 12px' }} />
        <p className="detalle">Iniciá sesión para continuar.</p>
        {error && <div className="error-general">{error}</div>}
        <label className="campo-form">Usuario
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        </label>
        <label className="campo-form">Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        <button type="submit" className="primario" disabled={enviando || !username.trim() || !password} style={{ width: '100%' }}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}