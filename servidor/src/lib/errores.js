// Error "esperado" de la aplicación: lleva un código HTTP y un código propio
// para que la pantalla pueda reaccionar sin depender del texto del mensaje.
export class ErrorApp extends Error {
  constructor(status, codigo, mensaje, detalles = null) {
    super(mensaje);
    this.status = status;      // 400, 404, 409...
    this.codigo = codigo;      // 'VALIDACION', 'PRODUCTO_NO_ENCONTRADO'...
    this.detalles = detalles;  // por ejemplo { nombre: 'es obligatorio' }
  }
}