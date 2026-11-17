import './env.js';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { crearUsuario, crearProducto, unico } from './ayuda.js';
import { construirApp } from '../src/app.js';
import { hashear, verificar } from '../src/auth/clave.js';
import { permisosDe } from '../src/auth/permisos.js';
import { REGLAS, PUBLICA, SESION } from '../src/auth/reglas.js';
import * as repoUsuarios from '../src/repositorios/usuarios.js';

const app = await construirApp({ logger: false });
after(() => app.close());

async function entrar(usuario) {
  const r = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { username: usuario.username, password: usuario.clave },
  });
  assert.equal(r.statusCode, 200);
  return r.headers['set-cookie'].split(';')[0]; // "kiosco_sesion=..."
}

test('las contraseñas se hashean con sal y se verifican', async () => {
  const a = await hashear('mi-clave-123');
  const b = await hashear('mi-clave-123');
  assert.notEqual(a, b);                                       // cada hash lleva su propia sal
  assert.ok(await verificar('mi-clave-123', a));
  assert.ok(!(await verificar('otra-clave', a)));
});

test('cada rol tiene los permisos que corresponden', () => {
  const emp = permisosDe('EMPLEADO');
  assert.ok(emp.includes('ventas:crear'));
  assert.ok(!emp.includes('reportes:ver'));
  assert.ok(!emp.includes('productos:ver_costos'));
  assert.ok(!emp.includes('stock:ajustar'));

  const dueno = permisosDe('DUENO');
  assert.ok(dueno.includes('reportes:ver') && dueno.includes('ventas:anular'));
  assert.ok(!dueno.includes('backups:gestionar'));
  assert.ok(!dueno.includes('usuarios:gestionar_todos'));

  const admin = permisosDe('ADMIN');
  assert.ok(admin.includes('backups:gestionar') && admin.includes('usuarios:gestionar_todos'));
});

test('toda regla usa un permiso que existe', () => {
  const validos = new Set(permisosDe('ADMIN'));
  for (const [ruta, regla] of Object.entries(REGLAS)) {
    if (regla === PUBLICA || regla === SESION) continue;
    assert.ok(validos.has(regla), `La regla "${ruta}" usa un permiso inexistente: ${regla}`);
  }
});

test('toda ruta /api tiene su regla, y toda regla corresponde a una ruta real', () => {
  const rutas = new Set(
    app.rutasApi
      .filter((r) => r.metodo !== 'HEAD' && r.metodo !== 'OPTIONS')
      .map((r) => `${r.metodo} ${r.url.replace(/\/$/, '')}`),
  );
  for (const ruta of rutas) assert.ok(ruta in REGLAS, `Falta la regla de permisos para: ${ruta}`);
  for (const regla of Object.keys(REGLAS)) assert.ok(rutas.has(regla), `La regla "${regla}" no corresponde a ninguna ruta`);
});

test('sin sesión no se accede a nada, y un login incorrecto se rechaza', async () => {
  const r = await app.inject({ method: 'GET', url: '/api/productos' });
  assert.equal(r.statusCode, 401);
  assert.equal(r.json().error.code, 'NO_AUTENTICADO');

  const mal = await app.inject({
    method: 'POST', url: '/api/auth/login', payload: { username: 'nadie', password: 'cualquiera' },
  });
  assert.equal(mal.statusCode, 401);
  assert.equal(mal.json().error.code, 'CREDENCIALES_INVALIDAS');
});

test('el empleado vende, no ve costos y no accede a reportes ni a respaldos', async () => {
  const emp = await crearUsuario('EMPLEADO');
  const dueno = await crearUsuario('DUENO');
  const p = crearProducto({ stock_actual: 50 });
  const cookieEmp = await entrar(emp);
  const cookieDueno = await entrar(dueno);

  // Productos: el empleado NO recibe el costo; el dueño sí.
  const listaEmp = await app.inject({ url: `/api/productos?buscar=${p.nombre}`, headers: { cookie: cookieEmp } });
  assert.equal(listaEmp.statusCode, 200);
  assert.equal('costo' in listaEmp.json()[0], false);
  assert.equal('costo_promedio' in listaEmp.json()[0], false);
  const listaDueno = await app.inject({ url: `/api/productos?buscar=${p.nombre}`, headers: { cookie: cookieDueno } });
  assert.equal('costo' in listaDueno.json()[0], true);

  // Acciones prohibidas para el empleado (aunque la pantalla no tenga el botón).
  for (const url of ['/api/reportes/ventas', '/api/alertas', '/api/admin/backups', '/api/exportar/productos.csv', '/api/usuarios']) {
    const r = await app.inject({ url, headers: { cookie: cookieEmp } });
    assert.equal(r.statusCode, 403, `El empleado no debería acceder a ${url}`);
  }
  const alta = await app.inject({
    method: 'POST', url: '/api/productos', headers: { cookie: cookieEmp },
    payload: { nombre: 'X', tipo_unidad: 'UNIDAD' },
  });
  assert.equal(alta.statusCode, 403);

  // El dueño puede exportar, pero no hacer respaldos (eso es del admin).
  assert.equal((await app.inject({ url: '/api/exportar/productos.csv', headers: { cookie: cookieDueno } })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/admin/backups', headers: { cookie: cookieDueno } })).statusCode, 403);

  // Y el empleado sí puede vender, por HTTP.
  const venta = await app.inject({
    method: 'POST', url: '/api/ventas', headers: { cookie: cookieEmp },
    payload: {
      client_uuid: unico('uuid-http'),
      items: [{ producto_id: p.id, cantidad: 1 }],
      pagos: [{ medio: 'EFECTIVO', monto: 120000 }],
    },
  });
  assert.equal(venta.statusCode, 201);
});

test('el admin puede crear y listar respaldos', async () => {
  const admin = await crearUsuario('ADMIN');
  const cookie = await entrar(admin);
  const crear = await app.inject({ method: 'POST', url: '/api/admin/backup', headers: { cookie } });
  assert.equal(crear.statusCode, 201);
  const lista = await app.inject({ url: '/api/admin/backups', headers: { cookie } });
  assert.ok(lista.json().some((r) => r.nombre === crear.json().nombre));
  const bajar = await app.inject({ url: `/api/admin/backups/${crear.json().nombre}`, headers: { cookie } });
  assert.equal(bajar.statusCode, 200);
});

test('con la clave temporal solo se puede cambiar la clave', async () => {
  const username = unico('temporal');
  repoUsuarios.crear({
    username, nombre: 'Temporal', hash: await hashear('temporal-123'), rol: 'EMPLEADO', debeCambiarClave: 1,
  });
  const r = await app.inject({
    method: 'POST', url: '/api/auth/login', payload: { username, password: 'temporal-123' },
  });
  const cookie = r.headers['set-cookie'].split(';')[0];
  const bloqueado = await app.inject({ url: '/api/productos', headers: { cookie } });
  assert.equal(bloqueado.statusCode, 403);
  assert.equal(bloqueado.json().error.code, 'CAMBIAR_CLAVE');
  assert.equal((await app.inject({ url: '/api/auth/me', headers: { cookie } })).statusCode, 200);
});

test('desactivar a un usuario le corta la sesión al instante', async () => {
  const emp = await crearUsuario('EMPLEADO');
  const cookie = await entrar(emp);
  assert.equal((await app.inject({ url: '/api/productos', headers: { cookie } })).statusCode, 200);

  repoUsuarios.actualizar(emp.id, { nombre: emp.nombre, rol: 'EMPLEADO', activo: 0 });
  assert.equal((await app.inject({ url: '/api/productos', headers: { cookie } })).statusCode, 401);
});