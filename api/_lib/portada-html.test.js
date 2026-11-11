import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { inyectarPortada, descripcionDePortada, listaEstructurada, MAX_PRODUCTOS } = require('./portada-html.cjs');

const BASE = 'https://mi-tienda.com';
const HTML = [
  '<!doctype html>',
  '<html lang="es">',
  '  <head>',
  '    <title>Mi tienda</title>',
  '    <meta name="description" content="La de siempre" />',
  '  </head>',
  '  <body>',
  '    <div id="root"></div>',
  '    <script type="module" src="/assets/index-abc.js"></script>',
  '  </body>',
  '</html>',
].join('\n');

const CATALOGO = {
  settings: { storeName: 'Repuestos La Romana', tagline: 'Piezas para tu carro', currency: 'RD$' },
  products: [
    { id: 'p_1_aaaaaa', name: 'Bujía NGK', price: 450, category: 'Motor', images: ['https://fotos.test/bujia.jpg'], description: 'Para motores de 4 cilindros' },
    { id: 'p_2_bbbbbb', name: 'Filtro de aceite', price: 300, category: 'Motor', images: [] },
  ],
};

const html = inyectarPortada(HTML, { catalog: CATALOGO, base: BASE });

describe('los productos en el HTML de la portada', () => {
  it('ahora están, que es todo el punto', () => {
    // Antes la portada era un div vacio: un rastreador que no ejecuta JavaScript no veia una
    // sola palabra de lo que la tienda vende.
    expect(html).toContain('Bujía NGK');
    expect(html).toContain('Filtro de aceite');
  });

  it('cada uno con un enlace de verdad a su ficha', () => {
    // Son los enlaces que reparten autoridad hacia las paginas de producto.
    expect(html).toContain('href="/p/bujia-ngk-aaaaaa"');
    expect(html).toContain('href="/p/filtro-de-aceite-bbbbbb"');
  });

  it('el nombre es un encabezado, no un div cualquiera', () => {
    expect(html).toMatch(/<h2 class="card-name"><a href="\/p\/bujia-ngk-aaaaaa">Bujía NGK<\/a><\/h2>/);
  });

  it('van dentro de #root, para que React los sustituya', () => {
    // Fuera de #root se quedarian para siempre y el visitante veria el catalogo dos veces.
    expect(html).toMatch(/<div id="root"><div class="grid">/);
  });

  it('con el precio y la moneda de la tienda', () => {
    expect(html).toContain('<span class="currency">RD$</span>450');
  });

  it('un producto sin foto no deja una imagen rota', () => {
    expect(html).toContain('<span class="placeholder">Sin imagen</span>');
  });

  it('escapa lo que el dueño escribió', () => {
    const malo = inyectarPortada(HTML, { catalog: { settings: {}, products: [{ id: 'p_9_cccccc', name: '<script>alert(1)</script>' }] }, base: BASE });
    expect(malo).not.toContain('<script>alert(1)');
    expect(malo).toContain('&lt;script&gt;');
  });

  it('pone tope al tamaño de la página', () => {
    // Un catalogo de mil dejaria una portada de varios megas que el rastreador puede cortar.
    const muchos = { settings: {}, products: Array.from({ length: 400 }, (_, i) => ({ id: `p_${i}_zzzzzz`, name: `Producto ${i}`, price: 10 })) };
    const grande = inyectarPortada(HTML, { catalog: muchos, base: BASE });
    expect((grande.match(/class="card"/g) || []).length).toBe(MAX_PRODUCTOS);
  });
});

describe('la descripción de la portada', () => {
  it('lleva el nombre, el lema y cuántos productos hay', () => {
    expect(descripcionDePortada(CATALOGO)).toBe('Repuestos La Romana: Piezas para tu carro. 2 productos disponibles para pedir por WhatsApp.');
  });

  it('sustituye la que traía el HTML compilado', () => {
    expect(html).not.toContain('La de siempre');
    expect(html).toContain('Repuestos La Romana: Piezas para tu carro.');
  });

  it('concuerda en singular', () => {
    const uno = { ...CATALOGO, products: [CATALOGO.products[0]] };
    expect(descripcionDePortada(uno)).toContain('1 producto disponible');
  });

  it('no inventa nada cuando la tienda está vacía', () => {
    expect(descripcionDePortada({ settings: {}, products: [] })).toBe('Mi tienda.');
  });

  it('no se pasa de largo, que Google la cortaría', () => {
    const largo = { settings: { storeName: 'A'.repeat(90), tagline: 'B'.repeat(200) }, products: [] };
    expect(descripcionDePortada(largo).length).toBeLessThanOrEqual(160);
  });
});

describe('los datos estructurados', () => {
  const lista = listaEstructurada(CATALOGO, BASE);

  it('son una lista de productos con URL absoluta', () => {
    expect(lista['@type']).toBe('ItemList');
    expect(lista.numberOfItems).toBe(2);
    expect(lista.itemListElement[0].item.url).toBe(`${BASE}/p/bujia-ngk-aaaaaa`);
  });

  it('no declara una moneda que no es un código ISO', () => {
    // "RD$" no lo es, y una moneda invalida invalida la oferta entera a ojos de Google.
    expect(lista.itemListElement[0].item.offers.priceCurrency).toBeUndefined();
    const conIso = listaEstructurada({ ...CATALOGO, settings: { ...CATALOGO.settings, currency: 'DOP' } }, BASE);
    expect(conIso.itemListElement[0].item.offers.priceCurrency).toBe('DOP');
  });

  it('usa el precio más bajo cuando hay variantes', () => {
    const conVariantes = { settings: {}, products: [{ id: 'p_1_aaaaaa', name: 'Camiseta', variants: [{ price: 800 }, { price: 500 }] }] };
    expect(listaEstructurada(conVariantes, BASE).itemListElement[0].item.offers.price).toBe(500);
  });

  it('no se publica una lista vacía', () => {
    expect(listaEstructurada({ settings: {}, products: [] }, BASE)).toBe(null);
  });

  it('van en el HTML, que es donde Google los lee sin renderizar', () => {
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"ItemList"');
  });

  it('no deja cerrar la etiqueta desde dentro', () => {
    const malo = inyectarPortada(HTML, { catalog: { settings: {}, products: [{ id: 'p_9_cccccc', name: '</script><img onerror=x>' }] }, base: BASE });
    expect(malo).not.toContain('</script><img');
  });
});

describe('cuando algo no cuadra', () => {
  it('devuelve el HTML intacto si no encuentra dónde inyectar', () => {
    // La portada tiene que seguir sirviendose pase lo que pase: una tienda sin SEO vende, una
    // tienda caida no.
    const otro = '<html><head></head><body><div id="otra-cosa"></div></body></html>';
    expect(inyectarPortada(otro, { catalog: CATALOGO, base: BASE })).toBe(otro);
  });

  it('aguanta un catálogo roto', () => {
    for (const cat of [null, {}, { products: null }, { products: [null, { id: 'x' }, { name: 'sin id' }] }]) {
      expect(() => inyectarPortada(HTML, { catalog: cat, base: BASE })).not.toThrow();
    }
  });

  it('sin productos deja #root vacío, como estaba', () => {
    const vacia = inyectarPortada(HTML, { catalog: { settings: {}, products: [] }, base: BASE });
    expect(vacia).toContain('<div id="root"></div>');
  });
});
