import { describe, it, expect } from 'vitest';
import { construirSitemap, construirRobots } from './sitemap.cjs';
import { slugProducto as slugServidor } from './rutas.cjs';
import { slugProducto as slugNavegador, buscarPorSlug } from '../../src/lib/rutas.js';

const BASE = 'https://tienda.com.do';
const productos = [
  { id: 'p_1759_abc123', name: 'Laptop Dell Latitude E7450 Core i7' },
  { id: 'p_1760_def456', name: 'Audífonos Bluetooth · Rojo & Negro' },
  { id: 'p_1761_ghi789', name: 'Monitor 24" Full HD' },
];
const catalogo = { products: productos };

describe('construirSitemap', () => {
  it('es XML válido y declara el espacio de nombres correcto', () => {
    const xml = construirSitemap(catalogo, BASE);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    // Es "sitemaps", en plural. Con el singular Google descarta el documento entero.
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
  });

  it('lleva la portada y una entrada por producto', () => {
    const xml = construirSitemap(catalogo, BASE);
    expect((xml.match(/<url>/g) || []).length).toBe(productos.length + 1);
    expect(xml).toContain(`<loc>${BASE}/</loc>`);
    for (const p of productos) expect(xml).toContain(`<loc>${BASE}/p/${slugServidor(p)}</loc>`);
  });

  // Un nombre con & o con comillas romperia el documento entero, no solo esa linea.
  it('escapa lo que rompería el XML', () => {
    const xml = construirSitemap({ products: [{ id: 'p_1_aaa111', name: 'Mouse & Pad "Pro" <Nuevo>' }] }, BASE);
    expect(xml).not.toMatch(/<loc>[^<]*[&][^a#]/);
    expect(xml).not.toContain('<loc>https://tienda.com.do/p/mouse & pad');
  });

  it('las URLs son absolutas y del mismo dominio', () => {
    const xml = construirSitemap(catalogo, BASE);
    for (const loc of xml.match(/<loc>([^<]+)<\/loc>/g) || []) {
      expect(loc).toContain(`>${BASE}/`);
    }
  });

  it('no duplica la barra si la base trae una al final', () => {
    expect(construirSitemap(catalogo, 'https://tienda.com.do/')).toContain(`<loc>${BASE}/</loc>`);
    expect(construirSitemap(catalogo, 'https://tienda.com.do/')).not.toContain('//p/');
  });

  it('la fecha va en formato de solo día', () => {
    const xml = construirSitemap(catalogo, BASE, Date.parse('2026-10-11T18:30:00Z'));
    expect(xml).toContain('<lastmod>2026-10-11</lastmod>');
    expect(xml).not.toContain('T18:30');
  });

  // Sin base de datos el mapa sale con la portada y nada mas, pero sigue siendo valido: un mapa
  // roto hace que Google lo marque como fallido y deje de pedirlo durante dias.
  it('un catálogo vacío o ausente sigue dando un mapa válido', () => {
    for (const vacio of [{}, null, undefined, { products: null }, { products: [] }]) {
      const xml = construirSitemap(vacio, BASE);
      expect(xml).toContain('<urlset');
      expect((xml.match(/<url>/g) || []).length).toBe(1);
    }
  });

  it('descarta productos a medias en vez de publicar URLs rotas', () => {
    const xml = construirSitemap({ products: [...productos, { id: '' }, { name: 'sin id' }, null] }, BASE);
    expect((xml.match(/<url>/g) || []).length).toBe(productos.length + 1);
  });
});

describe('construirRobots', () => {
  it('deja rastrear la tienda y aparta el panel', () => {
    const txt = construirRobots(BASE);
    expect(txt).toContain('User-agent: *');
    expect(txt).toContain('Allow: /');
    expect(txt).toContain('Disallow: /admin');
    expect(txt).toContain('Disallow: /api/');
  });

  it('apunta al mapa con una URL absoluta', () => {
    expect(construirRobots(BASE)).toContain(`Sitemap: ${BASE}/sitemap.xml`);
    expect(construirRobots('https://tienda.com.do/')).toContain(`Sitemap: ${BASE}/sitemap.xml`);
  });
});

// La prueba que de verdad importa de este archivo.
//
// El slug vive dos veces: src/lib/rutas.js lo compila Vite para el navegador y api/_lib/rutas.cjs
// lo ejecuta Node en las funciones. El mapa anuncia las URLs con la copia del servidor y el
// manejador de /p/ las resuelve. Si las dos se separan, Google recibiria 23 direcciones que al
// abrirse redirigen a la portada, y seria un fallo mudo: el mapa se veria perfecto.
describe('las dos copias del slug', () => {
  const casos = [
    ...productos,
    { id: 'p_9_zzz999', name: 'Teclado  con   espacios  raros' },
    { id: 'p_9_yyy888', name: 'ÁÉÍÓÚ ñÑ üÜ acentos' },
    { id: 'p_9_xxx777', name: '!!!' },
    { id: 'p_9_www666', name: 'Nombre extremadamente largo que pasa de los sesenta caracteres permitidos y se corta' },
    { id: 'p_9_vvv555', name: '' },
  ];

  it('generan el mismo texto', () => {
    for (const p of casos) expect(slugServidor(p)).toBe(slugNavegador(p));
  });

  // De nada sirve que coincidan si luego nadie las resuelve. Se recorren solo los que el mapa
  // publica: uno sin nombre se descarta a proposito, porque no tendria ni texto de enlace.
  it('cada URL del mapa encuentra su producto', () => {
    const xml = construirSitemap({ products: casos }, BASE);
    for (const p of casos.filter((c) => c.name)) {
      const loc = `${BASE}/p/${slugServidor(p)}`;
      expect(xml).toContain(`<loc>${loc}</loc>`);
      expect(buscarPorSlug(casos, new URL(loc).pathname)).toBe(p);
    }
  });
});
