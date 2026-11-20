import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import Module from 'node:module';

// Esta prueba existe por una caida real en produccion.
//
// El modulo que envia los avisos de pedido se cargaba con un require en la primera linea de
// orders-handler. web-push publico una version que solo funciona como modulo ESM; el servidor
// de Vercel no sabe cargarla con require, el require fallo, y al fallar un require de la
// primera linea revienta el ARCHIVO ENTERO. /api/orders empezo a devolver 500 a todo, incluida
// la creacion de pedidos: la tienda dejo de poder vender por un aviso que es un extra.
//
// La leccion no es "fijar la version de web-push" —eso arregla este caso y no el siguiente—,
// sino que la venta no puede depender de que cargue el modulo de los avisos. Lo que se prueba
// aqui es eso: con el envio roto a proposito, el pedido se guarda igual.

process.env.KV_REST_API_URL = 'https://kv-de-prueba.local';
process.env.KV_REST_API_TOKEN = 'token-de-prueba';

const require = createRequire(import.meta.url);

const CATALOGO = {
  settings: { currency: 'RD$', storeName: 'Tienda' },
  products: [{ id: 'p1', name: 'Teclado', price: 1200, stockQty: 5 }],
  categories: [],
  version: 1,
};

// Un Redis de mentira en memoria, servido por el fetch global que usa kv.cjs.
function kvEnMemoria(inicial = {}) {
  const datos = { ...inicial };
  const fetchFalso = vi.fn(async (url) => {
    const u = new URL(String(url));
    const [, accion, ...resto] = u.pathname.split('/');
    const clave = decodeURIComponent(resto.join('/'));
    if (accion === 'get') return { ok: true, json: async () => ({ result: clave in datos ? JSON.stringify(datos[clave]) : null }) };
    if (accion === 'set') return { ok: true, json: async () => ({ result: 'OK' }) };
    return { ok: true, json: async () => ({ result: null }) };
  });
  // kvSet manda el valor en el cuerpo; se guarda para que las lecturas siguientes lo vean.
  const original = fetchFalso.getMockImplementation();
  fetchFalso.mockImplementation(async (url, opciones) => {
    const u = new URL(String(url));
    const [, accion, ...resto] = u.pathname.split('/');
    if (accion === 'set') { try { datos[decodeURIComponent(resto.join('/'))] = JSON.parse(opciones.body); } catch { /* da igual */ } }
    return original(url, opciones);
  });
  return { datos, fetchFalso };
}

function peticionDePedido() {
  return {
    method: 'POST',
    headers: { 'x-forwarded-host': 'mi-tienda.com' },
    socket: { remoteAddress: '1.2.3.4' },
    body: { source: 'whatsapp_checkout', customerName: 'Jose', phone: '8095551234', products: [{ productId: 'p1', quantity: 1 }] },
  };
}

function respuesta() {
  const r = { codigo: 0, cuerpo: null, setHeader() {}, status(c) { r.codigo = c; return r; }, json(o) { r.cuerpo = o; return r; }, end() { return r; } };
  return r;
}

// Carga orders-handler de cero, opcionalmente con 'web-push' imposible de cargar, que es
// exactamente lo que pasaba en el servidor.
function cargarHandler({ rompiendoWebPush = false, rompiendoCotizaciones = false } = {}) {
  for (const ruta of Object.keys(require.cache)) {
    if (/(orders-handler|cotizaciones-handler|push-envio|push)\.cjs$/.test(ruta)) delete require.cache[ruta];
  }
  const cargarOriginal = Module._load;
  if (rompiendoWebPush || rompiendoCotizaciones) {
    Module._load = function (peticion, ...resto) {
      if (rompiendoWebPush && peticion === 'web-push') { const e = new Error('require() of ES Module not supported'); e.code = 'ERR_REQUIRE_ESM'; throw e; }
      if (rompiendoCotizaciones && /cotizaciones-handler/.test(peticion)) throw new Error('modulo roto a proposito');
      return cargarOriginal.call(this, peticion, ...resto);
    };
  }
  // El parche se queda puesto mientras dure la peticion, no solo mientras se carga el archivo:
  // los dos modulos entran con un require PEREZOSO, dentro de la funcion que los usa, y eso es
  // justamente lo que se quiere comprobar.
  const handler = (() => { try { return require('./orders-handler.cjs'); } catch (e) { Module._load = cargarOriginal; throw e; } })();
  return async (req, res) => { try { return await handler(req, res); } finally { Module._load = cargarOriginal; } };
}

const fetchOriginal = global.fetch;
let errorOriginal;

beforeEach(() => {
  errorOriginal = console.error;
  console.error = vi.fn();
  process.env.VAPID_PUBLIC_KEY = 'publica-de-prueba';
  process.env.VAPID_PRIVATE_KEY = 'privada-de-prueba';
});

afterEach(() => {
  global.fetch = fetchOriginal;
  console.error = errorOriginal;
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
});

describe('crear un pedido desde la tienda', () => {
  it('se guarda aunque el módulo de avisos no se pueda cargar', async () => {
    // El caso de la caida: hay claves configuradas, asi que el aviso SE INTENTA, y el modulo
    // de envio no carga. El pedido tiene que salir igual.
    const { datos, fetchFalso } = kvEnMemoria({ synaptic_catalog: CATALOGO, synaptic_push_subs: [{ endpoint: 'https://x/y', keys: { p256dh: 'a', auth: 'b' } }] });
    global.fetch = fetchFalso;

    const handler = cargarHandler({ rompiendoWebPush: true });
    const res = respuesta();
    await handler(peticionDePedido(), res);

    expect(res.codigo).toBe(201);
    expect(res.cuerpo.ok).toBe(true);
    expect(datos.synaptic_orders).toHaveLength(1);
    expect(datos.synaptic_orders[0].customerName).toBe('Jose');
  });

  it('se guarda cuando no hay avisos configurados', async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const { datos, fetchFalso } = kvEnMemoria({ synaptic_catalog: CATALOGO });
    global.fetch = fetchFalso;

    const handler = cargarHandler();
    const res = respuesta();
    await handler(peticionDePedido(), res);

    expect(res.codigo).toBe(201);
    expect(datos.synaptic_orders).toHaveLength(1);
  });

  it('el archivo se puede cargar entero sin web-push', () => {
    // Si alguien vuelve a poner el require arriba, esto falla aqui mismo.
    expect(() => cargarHandler({ rompiendoWebPush: true })).not.toThrow();
  });
});

// --- Cotizaciones ---
//
// Cuelgan de esta misma funcion (?recurso=cotizaciones) porque el plan de Vercel permite 12 y
// ya hay 12. Compartir puerta trae un riesgo que no existia: /api/orders es la UNICA ruta con
// una via publica —el cliente crea su pedido al comprar—, y las cotizaciones no tienen ninguna.
// Lo que se prueba aqui, antes que nada, es que esa via publica no llega hasta ellas.

const { signToken } = require('./../_lib/auth.cjs');
const SECRETO = 'secreto-de-prueba';
const ADMIN = { email: 'duena@tienda.com', secret: SECRETO, passwordHash: 'x' };

function peticionDeCotizacion(method, body, { conToken = true } = {}) {
  return {
    method,
    query: { recurso: 'cotizaciones' },
    headers: conToken ? { authorization: `Bearer ${signToken({ email: ADMIN.email, exp: Date.now() + 60000 }, SECRETO)}` } : {},
    socket: { remoteAddress: '1.2.3.4' },
    body,
  };
}

describe('las cotizaciones comparten puerta con las órdenes', () => {
  it('sin token no se llega a ellas', async () => {
    const { fetchFalso } = kvEnMemoria({ synaptic_admin: ADMIN });
    global.fetch = fetchFalso;
    const res = respuesta();
    await cargarHandler()(peticionDeCotizacion('GET', {}, { conToken: false }), res);
    expect(res.codigo).toBe(401);
  });

  it('un POST público no puede colarse por el camino de las cotizaciones', async () => {
    // El reparto mira `recurso` ANTES de la via publica justo para esto: si se mirase despues,
    // un visitante con source=whatsapp_checkout entraria sin token.
    const { datos, fetchFalso } = kvEnMemoria({ synaptic_admin: ADMIN, synaptic_catalog: CATALOGO });
    global.fetch = fetchFalso;
    const res = respuesta();
    const peticion = peticionDeCotizacion('POST', { source: 'whatsapp_checkout', cliente: 'Colado', lineas: [{ descripcion: 'X', cantidad: 1, precio: 1 }] }, { conToken: false });
    await cargarHandler()(peticion, res);
    expect(res.codigo).toBe(401);
    expect(datos.synaptic_cotizaciones).toBeUndefined();
  });

  it('crea, numera, edita y borra', async () => {
    const { datos, fetchFalso } = kvEnMemoria({ synaptic_admin: ADMIN });
    global.fetch = fetchFalso;
    const handler = cargarHandler();

    const crear = respuesta();
    await handler(peticionDeCotizacion('POST', { cliente: 'Mini Sweet World', lineas: [{ descripcion: 'Laptop', cantidad: 2, precio: 1500 }] }), crear);
    expect(crear.codigo).toBe(201);
    expect(crear.cuerpo.cotizacion.numero).toBe(1);
    expect(crear.cuerpo.cotizacion.total).toBe(3000);

    const segunda = respuesta();
    await handler(peticionDeCotizacion('POST', { cliente: 'Otro', lineas: [{ descripcion: 'Mouse', cantidad: 1, precio: 500 }] }), segunda);
    expect(segunda.cuerpo.cotizacion.numero).toBe(2);

    const id = crear.cuerpo.cotizacion.id;
    const editar = respuesta();
    await handler(peticionDeCotizacion('PUT', { id, cliente: 'Mini Sweet World', estado: 'aceptada', lineas: [{ descripcion: 'Laptop', cantidad: 3, precio: 1500 }] }), editar);
    expect(editar.cuerpo.cotizacion.total).toBe(4500);
    expect(editar.cuerpo.cotizacion.estado).toBe('aceptada');
    expect(editar.cuerpo.cotizacion.numero).toBe(1);

    const borrar = respuesta();
    await handler(peticionDeCotizacion('DELETE', { id }), borrar);
    expect(borrar.codigo).toBe(200);
    expect(datos.synaptic_cotizaciones).toHaveLength(1);

    // Borrar la #0001 no libera su numero: la siguiente es la #0003.
    const tercera = respuesta();
    await handler(peticionDeCotizacion('POST', { cliente: 'Tercero', lineas: [{ descripcion: 'Cable', cantidad: 1, precio: 100 }] }), tercera);
    expect(tercera.cuerpo.cotizacion.numero).toBe(3);
  });

  it('no guarda un papel sin cliente ni uno sin renglones', async () => {
    const { datos, fetchFalso } = kvEnMemoria({ synaptic_admin: ADMIN });
    global.fetch = fetchFalso;
    const handler = cargarHandler();

    const sinCliente = respuesta();
    await handler(peticionDeCotizacion('POST', { cliente: '  ', lineas: [{ descripcion: 'X', cantidad: 1, precio: 1 }] }), sinCliente);
    expect(sinCliente.codigo).toBe(400);

    const sinRenglones = respuesta();
    await handler(peticionDeCotizacion('POST', { cliente: 'Alguien', lineas: [{ descripcion: '  ', cantidad: 1, precio: 1 }] }), sinRenglones);
    expect(sinRenglones.codigo).toBe(400);
    expect(datos.synaptic_cotizaciones).toBeUndefined();
  });

  it('ignora el total que venga escrito y suma los renglones', async () => {
    const { fetchFalso } = kvEnMemoria({ synaptic_admin: ADMIN });
    global.fetch = fetchFalso;
    const res = respuesta();
    await cargarHandler()(peticionDeCotizacion('POST', { cliente: 'A', total: 1, lineas: [{ descripcion: 'X', cantidad: 4, precio: 250 }] }), res);
    expect(res.cuerpo.cotizacion.total).toBe(1000);
  });

  it('las órdenes siguen funcionando con el módulo de cotizaciones roto', async () => {
    // La misma leccion que con web-push: lo que cuelga de esta funcion no puede tumbar la venta.
    const { datos, fetchFalso } = kvEnMemoria({ synaptic_catalog: CATALOGO });
    global.fetch = fetchFalso;
    const res = respuesta();
    await cargarHandler({ rompiendoCotizaciones: true })(peticionDePedido(), res);
    expect(res.codigo).toBe(201);
    expect(datos.synaptic_orders).toHaveLength(1);
  });
});
