import * as repo from '../repositorios/categorias.js';

export default async function rutasCategorias(app) {
  // Para algo tan simple, la ruta llama directo al repositorio.
  app.get('/', async () => repo.listar());
}