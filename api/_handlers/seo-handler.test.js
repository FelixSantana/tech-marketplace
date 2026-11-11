import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

// robots.txt y sitemap.xml se sirven desde la misma funcion porque Vercel pone un tope al
// numero de funciones por despliegue. Al juntarlas, el riesgo nuevo es que una sirva lo de la
// otra: mismo codigo, misma ruta, y el tipo decidiendo. Eso es lo que se vigila aqui.

process.env.KV_REST_API_URL = 'https://kv-de-prueba.local';
process.env.KV_REST_API_TOKEN = 'token-de-prueba';

const require = createRequire(import.meta.url);
const handler = require('./seo-handler.cjs');

const CATALOGO = {
  settings: { storeName: 'Repuestos La Romana' },
  products: [{ id: 'p_1_aaaaaa', name: 'Bujía NGK', price: 450 }],
};

function peticion(tipo) {
  return { method: 'GET', query: tipo === undefined ? {} : { tipo }, headers: { host: 'mi-tienda.com', 'x-forwarded-proto': 'https' } };
}

function respuesta() {
  const r = {
    codigo: 200, cuerpo: '', cabeceras: {},
    setHeader(k, v) { r.cabeceras[k.toLowerCase()] = v; },
    set statusCode(c) { r.codigo = c; },
    get statusCode() { return r.codigo; },
    end(c) { r.cuerpo = String(c == null ? '' : c); return r; },
  };
  return r;
}

const fetchOriginal = global.fetch;
beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ result: JSON.stringify(CATALOGO) }) }));
});
afterEach(() => { global.fetch = fetchOriginal; });

describe('robots.txt', () => {
  it('sale texto plano, no XML', () => {
    const res = respuesta();
    return Promise.resolve(handler(peticion('robots'), res)).then(() => {
      expect(res.cabeceras['content-type']).toMatch(/^text\/plain/);
      expect(res.cuerpo).toMatch(/User-agent/i);
      expect(res.cuerpo).not.toContain('<urlset');
    });
  });

  it('lleva el mapa del sitio con el dominio de quien pregunta', () => {
    // Una tienda que no sepa su propio dominio le daria a Google el de otra.
    const res = respuesta();
    return Promise.resolve(handler(peticion('robots'), res)).then(() => {
      expect(res.cuerpo).toContain('https://mi-tienda.com/sitemap.xml');
    });
  });
});

describe('sitemap.xml', () => {
  it('sale XML, no texto plano', async () => {
    const res = respuesta();
    await handler(peticion('sitemap'), res);
    expect(res.cabeceras['content-type']).toMatch(/^application\/xml/);
    expect(res.cuerpo).toContain('<urlset');
    expect(res.cuerpo).not.toMatch(/User-agent/i);
  });

  it('trae los productos del catálogo', async () => {
    const res = respuesta();
    await handler(peticion('sitemap'), res);
    expect(res.cuerpo).toContain('https://mi-tienda.com/p/bujia-ngk-aaaaaa');
  });

  it('sin base de datos devuelve un mapa, no un error', async () => {
    // Un 500 aqui hace que Google marque el mapa como roto y deje de pedirlo durante dias.
    global.fetch = vi.fn(async () => { throw new Error('kv caido'); });
    const res = respuesta();
    await handler(peticion('sitemap'), res);
    expect(res.codigo).toBe(200);
    expect(res.cuerpo).toContain('<urlset');
  });
});

describe('las dos no se pisan', () => {
  it('cada tipo sirve lo suyo', async () => {
    const r1 = respuesta(); await handler(peticion('robots'), r1);
    const r2 = respuesta(); await handler(peticion('sitemap'), r2);
    expect(r1.cuerpo).not.toBe(r2.cuerpo);
    expect(r1.cabeceras['content-type']).not.toBe(r2.cabeceras['content-type']);
  });

  it('un tipo que no existe no sirve ninguna de las dos por defecto', async () => {
    // Sin esto, una reescritura mal escrita serviria robots.txt donde Google espera el mapa, y
    // nadie lo notaria hasta ver el buscador vacio.
    for (const tipo of [undefined, '', 'otra-cosa']) {
      const res = respuesta();
      await handler(peticion(tipo), res);
      expect(res.codigo).toBe(404);
      expect(res.cuerpo).not.toContain('<urlset');
      expect(res.cuerpo).not.toMatch(/User-agent/i);
    }
  });

  it('las dos rutas de vercel.json apuntan aquí con su tipo', async () => {
    const { readFileSync } = await import('node:fs');
    const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
    const de = (s) => vercel.rewrites.find((r) => r.source === s).destination;
    expect(de('/robots.txt')).toBe('/api/seo?tipo=robots');
    expect(de('/sitemap.xml')).toBe('/api/seo?tipo=sitemap');
  });
});
