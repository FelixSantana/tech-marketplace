const { kvGet, kvConfigured } = require('../_lib/kv.cjs');
const CATALOG_KEY = 'synaptic_catalog';

// Sirve /og.jpg: la imagen que WhatsApp, Facebook y Google muestran al compartir la portada.
//
// Hace falta una funcion por un desencuentro de tiempos. La etiqueta og:image de index.html se
// resuelve al COMPILAR y tiene que ser una URL fija; la imagen derivada del logo del cliente vive
// en el almacen y su direccion solo se conoce al EJECUTAR, porque el dueño puede cambiar el logo
// cuando quiera. Esta ruta es el punto fijo: la etiqueta apunta aqui para siempre y aqui se decide
// que imagen devolver.
//
// Se devuelven los bytes en vez de redirigir a la URL del almacen. Una redireccion seria mas
// barata, pero depende de que cada rastreador la siga al buscar una og:image, y si alguno no la
// sigue la tienda se comparte sin imagen y nadie se entera. Las peticiones son raras —solo cuando
// alguien comparte un enlace por primera vez— y la respuesta se queda cacheada en el borde.
const POR_DEFECTO = '/og-image.jpg';

function origenDe(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function imagenDeAjustes() {
  if (!kvConfigured()) return '';
  try {
    const catalog = await kvGet(CATALOG_KEY);
    const marca = (catalog && catalog.settings && catalog.settings.marca) || {};
    const url = String(marca.ogImage || '').trim();
    // Solo una URL absoluta del almacen. Una imagen incrustada (data:) no se puede reenviar como
    // cuerpo de una respuesta, y cualquier otro esquema aqui no pinta nada bueno.
    return /^https:\/\//i.test(url) ? url : '';
  } catch (e) {
    console.error('og: no se pudo leer el catalogo', e);
    return '';
  }
}

module.exports = async function handler(req, res) {
  const origen = origenDe(req);
  const propia = await imagenDeAjustes();
  const destino = propia || `${origen}${POR_DEFECTO}`;

  try {
    const r = await fetch(destino);
    if (!r.ok) throw new Error(`${destino} respondio ${r.status}`);
    const bytes = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Content-Length', String(bytes.length));
    // La imagen cambia solo cuando el dueño cambia su logo. Una hora en el borde, y mientras se
    // revalida se sigue sirviendo la vieja: un rastreador nunca se queda esperando.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
    return res.end(bytes);
  } catch (e) {
    console.error('og: no se pudo servir la imagen', e);
    // Ultimo recurso: que el rastreador vaya al archivo del repositorio por su cuenta. Es la
    // unica salida que queda, y es mejor que devolver un error y quedarse sin vista previa.
    res.statusCode = 302;
    res.setHeader('Location', POR_DEFECTO);
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
    return res.end();
  }
};
