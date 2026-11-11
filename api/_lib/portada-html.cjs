// La portada con los productos dentro del HTML.
//
// EL PROBLEMA. La portada es un archivo estatico con un <div id="root"></div> vacio: los
// productos los pinta React despues de pedir el catalogo. Un rastreador que no ejecuta
// JavaScript —y Google en su primera pasada no lo hace— ve una pagina sin una sola palabra de
// lo que la tienda vende. Las fichas /p/<slug> si se sirven resueltas desde el servidor, pero
// la portada, que es la que concentra los enlaces, estaba en blanco.
//
// QUE SE INYECTA, por orden de lo que mas pesa en el buscador:
//
//   1. Datos estructurados. Google los lee del HTML en bruto, sin renderizar: es lo unico de
//      aqui que cuenta seguro en la primera pasada.
//   2. Enlaces de verdad a cada ficha. Son los que reparten autoridad hacia las paginas de
//      producto y los que hacen que existan para el buscador antes de que se rastree el mapa
//      del sitio.
//   3. Una descripcion con el nombre y el lema de la tienda, que es lo que sale bajo el titulo
//      en los resultados.
//
// LO QUE EL VISITANTE VE no cambia: React vacia #root al montar y pinta la tienda de verdad.
// Por eso las tarjetas de aqui usan las mismas clases que las de verdad —durante los dos o
// tres parpadeos que tardan en sustituirse, se parecen a lo que va a quedar en vez de a una
// lista rota.

const { slugProducto } = require('./rutas.cjs');
const { nombreDeTienda } = require('./tienda.cjs');
const { condicionDe, ofertaDe, destacadosPrimero } = require('./vitrina.cjs');

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
  const precios = producto.variants.map((v) => Number(v.price) || 0);
  return precios.length ? Math.min(...precios) : 0;
}

function fotoDe(producto) {
  const fotos = Array.isArray(producto.images) ? producto.images.filter(Boolean) : [];
  const idx = typeof producto.primaryImage === 'number' && producto.primaryImage < fotos.length ? producto.primaryImage : 0;
  const elegida = fotos[idx] || fotos[0] || '';
  return /^https?:\/\//.test(elegida) ? elegida : '';
}

// Cuantos productos entran en el HTML. Un catalogo de mil dejaria una portada de varios megas
// que tarda en llegar y que el rastreador puede cortar por la mitad. Con cien hay de sobra para
// que descubra el catalogo; del resto ya se encarga el mapa del sitio.
const MAX_PRODUCTOS = 100;

// En el mismo orden que ve el visitante en "Recomendados": con los destacados delante. Si el
// HTML servido ordenara distinto, el rastreador y la persona verian catalogos diferentes.
const publicables = (catalog) => destacadosPrimero(catalog && catalog.products)
  .filter((p) => p && p.id && String(p.name || '').trim())
  .slice(0, MAX_PRODUCTOS);

// La descripcion que sale bajo el titulo en los resultados. Se arma con lo que la tienda tiene
// escrito, nunca con texto inventado: una descripcion generica es peor que ninguna, porque
// Google la sustituye igual y mientras tanto no dice nada de este negocio.
function descripcionDePortada(catalog) {
  const s = (catalog && catalog.settings) || {};
  const nombre = nombreDeTienda(s);
  const lema = sinEtiquetas(s.tagline);
  const cuantos = publicables(catalog).length;
  const partes = [lema ? `${nombre}: ${lema}.` : `${nombre}.`];
  if (cuantos) partes.push(`${cuantos} producto${cuantos === 1 ? '' : 's'} disponible${cuantos === 1 ? '' : 's'} para pedir por WhatsApp.`);
  return recortar(partes.join(' '), 160);
}

// Las tarjetas, con las mismas clases que las de verdad.
function tarjetasDePortada(catalog) {
  const moneda = escapar(((catalog && catalog.settings) || {}).currency || 'RD$');
  return publicables(catalog).map((p) => {
    const ruta = `/p/${slugProducto(p)}`;
    const foto = fotoDe(p);
    const precio = precioDesde(p).toLocaleString('es-DO');
    const desde = tieneVariantes(p) ? '<span class="price-from">desde </span>' : '';
    const oferta = ofertaDe(p, precioDesde(p));
    return [
      '<article class="card">',
      `<div class="img-wrap">${foto ? `<img src="${escapar(foto)}" alt="${escapar(p.name)}" loading="lazy" />` : '<span class="placeholder">Sin imagen</span>'}</div>`,
      '<div class="card-body">',
      p.category ? `<div class="card-cat">${escapar(p.category)}</div>` : '',
      `<h2 class="card-name"><a href="${escapar(ruta)}">${escapar(p.name)}</a></h2>`,
      p.description ? `<div class="card-desc">${escapar(recortar(p.description, 120))}</div>` : '',
      // El tachado tambien aqui: el HTML servido y el que pinta React tienen que enseñar lo
      // mismo, o durante el parpadeo el precio parece cambiar solo.
      `<div class="card-price mono">${desde}<span class="currency">${moneda}</span>${escapar(precio)}${oferta ? `<span class="precio-antes">${moneda} ${escapar(oferta.antes.toLocaleString('es-DO'))}</span>` : ''}</div>`,
      '</div></article>',
    ].join('');
  }).join('');
}

// Una lista ordenada de productos con su enlace. Es el formato que Google entiende para una
// pagina de catalogo, y lo lee del HTML en bruto sin tener que renderizar nada.
function listaEstructurada(catalog, base) {
  const productos = publicables(catalog);
  if (!productos.length) return null;
  const moneda = ((catalog && catalog.settings) || {}).currency || 'RD$';
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: productos.length,
    itemListElement: productos.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: sinEtiquetas(p.name),
        url: `${base}/p/${slugProducto(p)}`,
        ...(fotoDe(p) ? { image: fotoDe(p) } : {}),
        ...(condicionDe(p) ? { itemCondition: condicionDe(p) } : {}),
        offers: {
          '@type': 'Offer',
          price: precioDesde(p),
          // Solo se declara la moneda cuando tiene la forma de un codigo ISO. "RD$" no lo es, y
          // una moneda invalida invalida la oferta entera a ojos de Google.
          ...(/^[A-Z]{3}$/.test(String(moneda).trim()) ? { priceCurrency: String(moneda).trim() } : {}),
          availability: 'https://schema.org/InStock',
        },
      },
    })),
  };
}

const ETIQUETA_DESCRIPCION = /[ \t]*<meta name="description"[^>]*>\r?\n?/i;
const ROOT_VACIO = /<div id="root"><\/div>/;

// Devuelve el HTML tal cual si no encuentra donde inyectar. La portada tiene que seguir
// sirviendose pase lo que pase: una tienda sin SEO vende, una tienda caida no.
function inyectarPortada(html, { catalog, base }) {
  if (!ROOT_VACIO.test(html)) return html;

  const descripcion = descripcionDePortada(catalog);
  const lista = listaEstructurada(catalog, base);
  const cabeza = [
    `<meta name="description" content="${escapar(descripcion)}" />`,
    lista ? `<script type="application/ld+json">${JSON.stringify(lista).replace(/</g, '\\u003c')}</script>` : '',
  ].filter(Boolean).join('\n    ');

  const cuerpo = tarjetasDePortada(catalog);
  // El contenido va DENTRO de #root a proposito: React lo vacia al montar, asi que el visitante
  // nunca ve las dos versiones a la vez.
  const conCuerpo = cuerpo
    ? html.replace(ROOT_VACIO, `<div id="root"><div class="grid">${cuerpo}</div></div>`)
    : html;

  // La descripcion que ya trae el HTML es la de la tienda compilada; esta la sustituye porque
  // lleva el catalogo de verdad. Si no hubiera ninguna, se añade.
  return ETIQUETA_DESCRIPCION.test(conCuerpo)
    ? conCuerpo.replace(ETIQUETA_DESCRIPCION, `    ${cabeza}\n`)
    : conCuerpo.replace('</head>', `    ${cabeza}\n  </head>`);
}

module.exports = { inyectarPortada, descripcionDePortada, tarjetasDePortada, listaEstructurada, MAX_PRODUCTOS, escapar };
