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
function cargarHandler({ rompiendoWebPush = false } = {}) {
  for (const ruta of Object.keys(require.cache)) {
    if (/(orders-handler|push-envio|push)\.cjs$/.test(ruta)) delete require.cache[ruta];
  }
  const cargarOriginal = Module._load;
  if (rompiendoWebPush) {
    Module._load = function (peticion, ...resto) {
      if (peticion === 'web-push') { const e = new Error('require() of ES Module not supported'); e.code = 'ERR_REQUIRE_ESM'; throw e; }
      return cargarOriginal.call(this, peticion, ...resto);
    };
  }
  try { return require('./orders-handler.cjs'); }
  finally { Module._load = cargarOriginal; }
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
