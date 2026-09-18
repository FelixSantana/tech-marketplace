import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { MARCA_FOTO, sinFotos, conFotosDe, agregarRespaldo, resumenDeRespaldos, urlsDeRespaldos } = require('./backup-logic.cjs');

const foto = 'data:image/jpeg;base64,AAAA';
const enBlob = 'https://blob.vercel-storage.com/p1-abc.jpg';
const catalogo = (extra = {}) => ({
  version: 7,
  settings: { storeName: 'Synaptic Tech', logo: foto, configured: true },
  products: [
    { id: 'p1', name: 'Mouse', price: 1200, stockQty: 5, images: [foto, enBlob], primaryImage: 0 },
    { id: 'p2', name: 'Laptop', price: 18000, stockQty: 2, images: [], primaryImage: 0 },
  ],
  categories: [{ name: 'Accesorios', emoji: '🎧' }],
  ...extra,
});
const UN_DIA = 24 * 60 * 60 * 1000;

describe('sinFotos', () => {
  it('saca las fotos incrustadas y deja marca', () => {
    const r = sinFotos(catalogo());
    expect(r.products[0].images[0]).toBe(MARCA_FOTO);
    expect(r.settings.logo).toBe(MARCA_FOTO);
  });
  it('conserva las fotos que ya viven en Blob, que son URLs cortas', () => {
    expect(sinFotos(catalogo()).products[0].images[1]).toBe(enBlob);
  });
  it('conserva todo lo demas: precios, stock, categorias y version', () => {
    const r = sinFotos(catalogo());
    expect(r.products[0].price).toBe(1200);
    expect(r.products[1].stockQty).toBe(2);
    expect(r.categories).toEqual([{ name: 'Accesorios', emoji: '🎧' }]);
    expect(r.version).toBe(7);
  });
  it('no toca el catalogo original', () => {
    const c = catalogo();
    sinFotos(c);
    expect(c.products[0].images[0]).toBe(foto);
  });
  it('el respaldo pesa mucho menos que el catalogo', () => {
    const gordo = catalogo();
    gordo.products[0].images = [`data:image/jpeg;base64,${'A'.repeat(50000)}`];
    expect(JSON.stringify(sinFotos(gordo)).length).toBeLessThan(JSON.stringify(gordo).length / 10);
  });
});

describe('conFotosDe', () => {
  it('rellena las marcas con las fotos que el catalogo tiene hoy', () => {
    const r = conFotosDe(sinFotos(catalogo()), catalogo());
    expect(r.products[0].images).toEqual([foto, enBlob]);
    expect(r.settings.logo).toBe(foto);
  });
  it('si el producto ya no tiene esa foto, la linea se cae en vez de quedar rota', () => {
    const hoy = catalogo();
    hoy.products[0].images = [];
    const r = conFotosDe(sinFotos(catalogo()), hoy);
    expect(r.products[0].images).toEqual([enBlob]);
  });
  it('un producto que hoy ya no existe vuelve sin sus fotos incrustadas, no con basura', () => {
    const r = conFotosDe(sinFotos(catalogo()), { products: [], settings: {} });
    expect(r.products[0].images).toEqual([enBlob]);
    expect(r.products[0].name).toBe('Mouse');
  });
  it('recorta la foto principal si quedaron menos fotos', () => {
    const viejo = sinFotos(catalogo());
    viejo.products[0].primaryImage = 1;
    const hoy = catalogo();
    hoy.products[0].images = [];
    const r = conFotosDe(viejo, hoy);
    expect(r.products[0].images).toHaveLength(1);
    expect(r.products[0].primaryImage).toBe(0);
  });
  it('restaura precios y stock del respaldo, no los de hoy', () => {
    const hoy = catalogo();
    hoy.products[0].price = 999;
    hoy.products[0].stockQty = 0;
    const r = conFotosDe(sinFotos(catalogo()), hoy);
    expect(r.products[0].price).toBe(1200);
    expect(r.products[0].stockQty).toBe(5);
  });
});

describe('agregarRespaldo', () => {
  it('el mas nuevo queda primero', () => {
    const lista = agregarRespaldo(agregarRespaldo([], catalogo(), 1000), catalogo({ version: 8 }), 2000);
    expect(lista[0].ts).toBe(2000);
    expect(lista[0].version).toBe(8);
  });
  it('no guarda dos veces lo mismo', () => {
    const uno = agregarRespaldo([], catalogo(), 1000);
    expect(agregarRespaldo(uno, catalogo(), 2000)).toBe(uno);
  });
  it('un cambio de stock si cuenta como guardado nuevo', () => {
    const uno = agregarRespaldo([], catalogo(), 1000);
    const c = catalogo(); c.products[0].stockQty = 4;
    expect(agregarRespaldo(uno, c, 2000)).toHaveLength(2);
  });
  it('guarda entero los ultimos cinco, aunque sean del mismo minuto', () => {
    let lista = [];
    for (let i = 0; i < 8; i++) lista = agregarRespaldo(lista, catalogo({ version: i }), 1e12 + i * 1000);
    expect(lista.slice(0, 5).map((r) => r.version)).toEqual([7, 6, 5, 4, 3]);
  });
  it('de los dias viejos deja uno por dia, no veinte', () => {
    let lista = [];
    for (let i = 0; i < 6; i++) lista = agregarRespaldo(lista, catalogo({ version: i }), 1e12 + i * 1000);
    for (let d = 1; d <= 3; d++) lista = agregarRespaldo(lista, catalogo({ version: 100 + d }), 1e12 + d * UN_DIA);
    const porDia = lista.slice(5).map((r) => new Date(r.ts).toISOString().slice(0, 10));
    expect(new Set(porDia).size).toBe(porDia.length);
  });
  it('nunca pasa de quince', () => {
    let lista = [];
    for (let i = 0; i < 40; i++) lista = agregarRespaldo(lista, catalogo({ version: i }), 1e12 + i * UN_DIA);
    expect(lista.length).toBeLessThanOrEqual(15);
  });
});

describe('resumenDeRespaldos', () => {
  it('lleva fecha, version, cuantos productos y cuantas unidades', () => {
    const [r] = resumenDeRespaldos(agregarRespaldo([], catalogo(), 1000));
    expect(r).toEqual({ ts: 1000, version: 7, productos: 2, unidades: 7 });
  });
  it('no arrastra el catalogo entero al panel', () => {
    const [r] = resumenDeRespaldos(agregarRespaldo([], catalogo(), 1000));
    expect(r.data).toBeUndefined();
  });
  it('aguanta una lista vacia o ausente', () => {
    expect(resumenDeRespaldos(null)).toEqual([]);
  });
});

describe('urlsDeRespaldos', () => {
  it('junta las fotos del almacen que el historial todavia nombra', () => {
    const lista = agregarRespaldo([], catalogo({ settings: { logo: 'https://blob.vercel-storage.com/logo.jpg' } }), 1000);
    expect([...urlsDeRespaldos(lista)].sort()).toEqual(['https://blob.vercel-storage.com/logo.jpg', enBlob]);
  });
  it('ignora las marcas y las fotos incrustadas: esas no se borran del almacen', () => {
    const urls = urlsDeRespaldos(agregarRespaldo([], catalogo(), 1000));
    expect(urls.has(MARCA_FOTO)).toBe(false);
    expect(urls.has(foto)).toBe(false);
  });
  it('aguanta una lista vacia', () => expect(urlsDeRespaldos(null).size).toBe(0));
});
