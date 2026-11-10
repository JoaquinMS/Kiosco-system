// Pide el peso (en kg) de un producto que se vende por peso.
import { useState } from 'react';
import { cantidadABase, formatearPesos, subtotalLinea } from './formato.js';

export default function ModalPeso({ producto, titulo, inicial = '', onConfirmar, onCancelar }) {
  const [texto, setTexto] = useState(inicial);
  const gramos = texto.trim() === '' ? NaN : cantidadABase(texto, 'PESO');
  const valido = Number.isFinite(gramos) && gramos > 0 && gramos <= 1_000_000;

  function enviar(e) {
    e.preventDefault();
    if (valido) onConfirmar(gramos);
  }

  return (
    <div className="fondo-modal">
      <form className="modal" onSubmit={enviar} onKeyDown={(e) => e.key === 'Escape' && onCancelar()}>
        <h2>{producto.nombre}</h2>
        <p className="detalle">{titulo} · {formatearPesos(producto.precio_venta)} /kg</p>
        <label>Peso en kg (ejemplo: 0,250)
          <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} inputMode="decimal" />
        </label>
        {valido && (
          <div className="detalle">
            {gramos} g = {formatearPesos(subtotalLinea(producto.precio_venta, gramos, 'PESO'))}
          </div>
        )}
        <div className="botones">
          <button type="button" onClick={onCancelar}>Cancelar</button>
          <button type="submit" className="primario" disabled={!valido}>Aceptar</button>
        </div>
      </form>
    </div>
  );
}