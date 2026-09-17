import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { inyectarMetaProducto, descripcionDe, imagenDe, precioDesde, stockTotal, escapar } = require('./producto-html.cjs');

const BASE = 'https://synaptic-tech-catalogo.vercel.app';
const settings = { storeName: 'Synaptic Tech', currency: 'RD$' };
const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Synaptic Tech — Catálogo</title>
    <meta name="description" content="portada" />
    <link rel="canonical" href="${BASE}/" />
    <meta property="og:title" content="portada" />
    <meta name="twitter:card" content="summary_large_image" />
  </head>
  <body><div id="root"></div></body>
</html>`;

const laptop = { id: 'p_1_era4q', name: 'Dell Latitude 3190', description: 'Procesador Pentium, 8GB RAM', warranty: '3 meses', category: 'Laptops', price: 7500, stockQty: 5, images: [`${BASE}/blob/foto.jpg`], primaryImage: 0 };
const conFotoIncrustada = { ...laptop, images: ['data:image/jpeg;base64,AAAA'] };
const agotado = { ...laptop, stockQty: 0 };
const conVariantes = { id: 'p_2_abc12', name: 'Laptop Ryzen', price: 18000, images: [], variantAxis: 'Capacidad', variants: [{ id: 'v1', label: '256GB', price: 18000, stockQty: 0 }, { id: 'v2', label: '512GB', price: 22000, stockQty: 2 }] };

const meta = (salida, clave) => {
  const m = salida.match(new RegExp(`(?:property|name)="${clave}" content="([^"]*)"`));
  return m ? m[1] : null;
};

describe('precioDesde y stockTotal', () => {
  it('toma el precio del producto sin variantes', () => expect(precioDesde(laptop)).toBe(7500));
  it('toma el minimo de las variantes', () => expect(precioDesde(conVariantes)).toBe(18000));
  it('suma el stock de las variantes', () => expect(stockTotal(conVariantes)).toBe(2));
  it('cuenta el stock del producto sin variantes', () => expect(stockTotal(laptop)).toBe(5));
});

describe('imagenDe', () => {
  it('usa la foto del producto si es una URL', () => expect(imagenDe(laptop, BASE)).toBe(`${BASE}/blob/foto.jpg`));
  it('cae a la imagen de la tienda si la foto esta incrustada en el catalogo', () => {
    expect(imagenDe(conFotoIncrustada, BASE)).toBe(`${BASE}/og-image.jpg`);
  });
  it('cae a la imagen de la tienda si el producto no tiene fotos', () => {
    expect(imagenDe(conVariantes, BASE)).toBe(`${BASE}/og-image.jpg`);
  });
});

describe('descripcionDe', () => {
  it('lleva precio, garantia y descripcion', () => {
    const d = descripcionDe(laptop, settings);
    expect(d).toContain('RD$ 7,500');
    expect(d).toContain('Garantía: 3 meses');
    expect(d).toContain('Pídelo por WhatsApp');
  });
  it('dice "desde" cuando hay variantes', () => expect(descripcionDe(conVariantes, settings)).toMatch(/^desde RD\$ 18,000/));
  it('no se pasa de 200 caracteres', () => {
    const largo = { ...laptop, description: 'x'.repeat(500) };
    expect(descripcionDe(largo, settings).length).toBeLessThanOrEqual(200);
  });
});

describe('escapar', () => {
  it('escapa comillas y signos de etiqueta', () => {
    expect(escapar('Dell "Pro" <b>&</b>')).toBe('Dell &quot;Pro&quot; &lt;b&gt;&amp;&lt;/b&gt;');
  });
});

describe('inyectarMetaProducto', () => {
  const salida = inyectarMetaProducto(html, { producto: laptop, settings, base: BASE, ruta: '/p/dell-latitude-3190-era4q' });

  it('pone el titulo del producto y quita el de la portada', () => {
    expect(salida).toContain('<title>Dell Latitude 3190 — Synaptic Tech</title>');
    expect(salida).not.toContain('<title>Synaptic Tech — Catálogo</title>');
  });

  it('apunta og:url y canonical a la ruta del producto', () => {
    expect(meta(salida, 'og:url')).toBe(`${BASE}/p/dell-latitude-3190-era4q`);
    expect(salida).toContain(`<link rel="canonical" href="${BASE}/p/dell-latitude-3190-era4q" />`);
  });

  it('no deja las etiquetas de la portada duplicadas', () => {
    expect(salida.match(/property="og:title"/g)).toHaveLength(1);
    expect(salida.match(/name="description"/g)).toHaveLength(1);
    expect(salida.match(/rel="canonical"/g)).toHaveLength(1);
    expect(meta(salida, 'og:title')).not.toBe('portada');
  });

  it('usa la foto del producto como og:image', () => {
    expect(meta(salida, 'og:image')).toBe(`${BASE}/blob/foto.jpg`);
  });

  it('marca disponibilidad y precio para Facebook', () => {
    expect(meta(salida, 'product:price:amount')).toBe('7500');
    expect(meta(salida, 'product:availability')).toBe('in stock');
    expect(meta(inyectarMetaProducto(html, { producto: agotado, settings, base: BASE, ruta: '/p/x' }), 'product:availability')).toBe('out of stock');
  });

  it('incluye datos estructurados para Google', () => {
    const m = salida.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const datos = JSON.parse(m[1].replace(/\\u003c/g, '<'));
    expect(datos).toMatchObject({ '@type': 'Product', name: 'Dell Latitude 3190' });
    expect(datos.offers).toMatchObject({ price: 7500, priceCurrency: 'DOP', availability: 'https://schema.org/InStock' });
  });

  it('deja intacto el resto del HTML, incluido el punto de montaje de la aplicacion', () => {
    expect(salida).toContain('<div id="root"></div>');
    expect(salida).toContain('<meta charset="UTF-8" />');
  });

  it('escapa un nombre con comillas para no romper el atributo', () => {
    const conComillas = { ...laptop, name: 'Dell "Pro" 15"' };
    const s = inyectarMetaProducto(html, { producto: conComillas, settings, base: BASE, ruta: '/p/x' });
    expect(s).toContain('&quot;');
    expect(meta(s, 'og:title')).not.toContain('"');
  });
});
