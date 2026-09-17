const { kvGet, kvConfigured } = require('../_lib/kv.cjs');
const { inyectarMetaProducto } = require('../_lib/producto-html.cjs');
const CATALOG_KEY = 'synaptic_catalog';

const sufijoDeId = (id) => String(id || '').split('_').pop().slice(-6).toLowerCase();

function buscarProducto(products, slug) {
  const limpio = String(slug || '').replace(/^\/?p\//, '').replace(/[?#].*$/, '').toLowerCase();
  if (!limpio) return null;
  const sufijo = limpio.split('-').pop();
  return (products || []).find((p) => sufijoDeId(p.id) === sufijo) || null;
}

// Sirve la pagina de un producto: el mismo HTML de la aplicacion, pero con las etiquetas del
// producto inyectadas para que WhatsApp y Google muestren su foto, nombre y precio.
module.exports = async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || (host.startsWith('localhost') ? 'http' : 'https');
  const base = `${proto}://${host}`;
  const slug = String((req.query && req.query.slug) || '').trim();

  let html;
  try {
    // El HTML de la aplicacion lo sirve el propio despliegue, con los nombres de archivo ya
    // resueltos por el build. Pedirlo evita tener que empaquetarlo dentro de la funcion.
    const r = await fetch(`${base}/index.html`, { headers: { 'x-shell-request': '1' } });
    if (!r.ok) throw new Error(`index.html respondio ${r.status}`);
    html = await r.text();
  } catch (e) {
    console.error('producto: no se pudo leer index.html', e);
    res.statusCode = 302;
    res.setHeader('Location', '/');
    return res.end();
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Poco cache: el precio y el stock cambian, y la vista previa debe seguirlos.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');

  if (!kvConfigured()) return res.end(html);
  try {
    const catalog = (await kvGet(CATALOG_KEY)) || {};
    const producto = buscarProducto(catalog.products, slug);
    // Sin producto, se devuelve la portada tal cual: la aplicacion mostrara el catalogo.
    if (!producto) return res.end(html);
    return res.end(inyectarMetaProducto(html, { producto, settings: catalog.settings || {}, base, ruta: `/p/${slug}` }));
  } catch (e) {
    console.error('producto: fallo al inyectar', e);
    return res.end(html);
  }
};
