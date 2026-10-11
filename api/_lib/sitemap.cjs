// El mapa del sitio: la lista de paginas que esta tienda quiere que Google indexe.
//
// Hace falta por lo mismo que hicieron falta los enlaces en las tarjetas: las paginas /p/<slug>
// existian y nadie las enlazaba, asi que no habia forma de llegar a ellas. Los enlaces resuelven
// el camino normal; el mapa es la via directa, y ademas le dice a Google cuando cambio cada una.
//
// Se genera al vuelo desde el catalogo en vez de escribirse a mano: un producto nuevo aparece en
// el mapa sin que nadie se acuerde de añadirlo, que es justo el tipo de tarea que no se hace.

const { slugProducto } = require('./rutas.cjs');

// Los cinco caracteres que XML no admite sueltos. Un nombre con & o con comillas —"Mouse & Pad",
// "Laptop 15\"— romperia el documento entero y Google lo descartaria completo, no solo esa linea.
const escaparXml = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// Solo una fecha, sin hora: es lo que pide el formato y evita que un guardado del catalogo haga
// parecer que cambiaron los 23 productos a la vez.
function soloFecha(valor) {
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function urlDe(loc, lastmod) {
  return `  <url>\n    <loc>${escaparXml(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`;
}

// `base` es el origen del despliegue, sin barra final. Las URLs de un mapa tienen que ser
// absolutas y del mismo dominio que lo sirve, o Google ignora las que no cuadren.
function construirSitemap(catalog, base, ahora = Date.now()) {
  const raiz = String(base || '').replace(/\/+$/, '');
  const productos = (catalog && Array.isArray(catalog.products) ? catalog.products : [])
    .filter((p) => p && p.id && p.name);
  const fecha = soloFecha(ahora);
  const urls = [
    urlDe(`${raiz}/`, fecha),
    ...productos.map((p) => urlDe(`${raiz}/p/${slugProducto(p)}`, soloFecha(p.updatedAt || ahora))),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// El panel no es contenido publico y no tiene nada que hacer en un buscador. Se desaconseja
// explicitamente en vez de solo omitirlo del mapa, porque omitir no impide que lo rastreen.
function construirRobots(base) {
  const raiz = String(base || '').replace(/\/+$/, '');
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    '',
    `Sitemap: ${raiz}/sitemap.xml`,
    '',
  ].join('\n');
}

module.exports = { construirSitemap, construirRobots, escaparXml };
