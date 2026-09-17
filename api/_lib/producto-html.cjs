// Inyecta en el HTML las etiquetas del producto para que WhatsApp, Facebook y Google muestren
// su foto, su nombre y su precio al compartir el enlace. WhatsApp no ejecuta JavaScript, asi
// que esto tiene que venir resuelto desde el servidor.

const escapar = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const sinEtiquetas = (v) => String(v || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function recortar(texto, max) {
  const limpio = sinEtiquetas(texto);
  return limpio.length <= max ? limpio : `${limpio.slice(0, max - 1).trimEnd()}…`;
}

const tieneVariantes = (p) => Array.isArray(p.variants) && p.variants.length > 0;

function precioDesde(producto) {
  if (!tieneVariantes(producto)) return Number(producto.price) || 0;
  return Math.min(...producto.variants.map((v) => Number(v.price) || 0));
}

function stockTotal(producto) {
  if (tieneVariantes(producto)) return producto.variants.reduce((s, v) => s + Math.max(0, Math.floor(Number(v.stockQty) || 0)), 0);
  const n = Number(producto.stockQty);
  return Number.isFinite(n) ? Math.max(0, n) : 999;
}

// Una foto incrustada (data:) no sirve como og:image: hay que dar una URL que el rastreador
// pueda descargar. Mientras las fotos vivan dentro del catalogo, se usa la imagen de la tienda.
function imagenDe(producto, base) {
  const fotos = Array.isArray(producto.images) ? producto.images : [];
  const idx = typeof producto.primaryImage === 'number' && producto.primaryImage < fotos.length ? producto.primaryImage : 0;
  const elegida = fotos[idx] || fotos[0] || '';
  return /^https?:\/\//.test(elegida) ? elegida : `${base}/og-image.jpg`;
}

function descripcionDe(producto, settings) {
  const moneda = settings.currency || 'RD$';
  const precio = `${moneda} ${precioDesde(producto).toLocaleString('es-DO')}`;
  const desde = tieneVariantes(producto) ? 'desde ' : '';
  const garantia = producto.warranty ? ` Garantía: ${producto.warranty}.` : '';
  const detalle = producto.description ? ` ${recortar(producto.description, 110)}` : '';
  return recortar(`${desde}${precio}.${garantia}${detalle} Pídelo por WhatsApp.`, 200);
}

function inyectarMetaProducto(html, { producto, settings, base, ruta }) {
  const url = `${base}${ruta}`;
  const titulo = `${producto.name} — ${settings.storeName || 'Synaptic Tech'}`;
  const descripcion = descripcionDe(producto, settings);
  const imagen = imagenDe(producto, base);
  const disponible = stockTotal(producto) > 0;

  const jsonLd = {
    '@context': 'https://schema.org/', '@type': 'Product',
    name: producto.name,
    ...(producto.description ? { description: sinEtiquetas(producto.description) } : {}),
    ...(/^https?:\/\//.test(imagen) ? { image: [imagen] } : {}),
    ...(producto.category ? { category: producto.category } : {}),
    offers: {
      '@type': 'Offer', url,
      priceCurrency: 'DOP',
      price: precioDesde(producto),
      availability: disponible ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  const etiquetas = [
    `<title>${escapar(titulo)}</title>`,
    `<meta name="description" content="${escapar(descripcion)}" />`,
    `<link rel="canonical" href="${escapar(url)}" />`,
    `<meta property="og:type" content="product" />`,
    `<meta property="og:site_name" content="${escapar(settings.storeName || 'Synaptic Tech')}" />`,
    `<meta property="og:locale" content="es_DO" />`,
    `<meta property="og:url" content="${escapar(url)}" />`,
    `<meta property="og:title" content="${escapar(titulo)}" />`,
    `<meta property="og:description" content="${escapar(descripcion)}" />`,
    `<meta property="og:image" content="${escapar(imagen)}" />`,
    `<meta property="og:image:secure_url" content="${escapar(imagen)}" />`,
    `<meta property="og:image:alt" content="${escapar(producto.name)}" />`,
    `<meta property="product:price:amount" content="${precioDesde(producto)}" />`,
    `<meta property="product:price:currency" content="DOP" />`,
    `<meta property="product:availability" content="${disponible ? 'in stock' : 'out of stock'}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapar(titulo)}" />`,
    `<meta name="twitter:description" content="${escapar(descripcion)}" />`,
    `<meta name="twitter:image" content="${escapar(imagen)}" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ');

  // Se quitan las etiquetas de la portada para no duplicarlas, y se ponen las del producto.
  const limpio = html
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/[ \t]*<meta (?:property="og:|name="twitter:|name="description")[\s\S]*?\/>\r?\n?/gi, '')
    .replace(/[ \t]*<link rel="canonical"[\s\S]*?\/>\r?\n?/gi, '');

  return limpio.replace('</head>', `  ${etiquetas}\n  </head>`);
}

module.exports = { inyectarMetaProducto, descripcionDe, imagenDe, precioDesde, stockTotal, escapar };
