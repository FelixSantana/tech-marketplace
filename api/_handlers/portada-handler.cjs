const { kvGet, kvConfigured } = require('../_lib/kv.cjs');
const { inyectarPortada } = require('../_lib/portada-html.cjs');
const CATALOG_KEY = 'synaptic_catalog';

// Sirve la portada con los productos ya dentro del HTML, para que un rastreador que no ejecuta
// JavaScript vea de que va esta tienda. El por que esta en portada-html.cjs.
//
// ESTA FUNCION ESTA EN EL CAMINO DE TODAS LAS VISITAS. Es la unica de la tienda de la que eso
// se puede decir, asi que cada paso tiene su salida: si no se puede leer el HTML se redirige al
// archivo estatico, y si falla cualquier otra cosa se sirve el HTML sin tocar. Lo que NUNCA
// puede pasar es devolver un error: una tienda sin SEO vende, una tienda caida no.
module.exports = async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || (String(host).startsWith('localhost') ? 'http' : 'https');
  const base = `${proto}://${String(host).split(',')[0].trim()}`;

  let html;
  try {
    // El HTML lo sirve el propio despliegue, con los nombres de archivo ya resueltos por el
    // build. Pedirlo evita tener que empaquetarlo dentro de la funcion. Mismo camino que usa la
    // ficha de producto.
    const r = await fetch(`${base}/index.html`, { headers: { 'x-shell-request': '1' } });
    if (!r.ok) throw new Error(`index.html respondio ${r.status}`);
    html = await r.text();
  } catch (e) {
    console.error('portada: no se pudo leer index.html', e);
    // Al archivo estatico, que es exactamente lo que se servia antes de que esto existiera.
    res.statusCode = 302;
    res.setHeader('Location', '/index.html');
    return res.end();
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Cache corto en el borde: el catalogo cambia y la portada debe seguirlo, pero asi la gran
  // mayoria de las visitas no llega siquiera a ejecutar esta funcion.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');

  if (!kvConfigured()) return res.end(html);

  try {
    const catalog = await kvGet(CATALOG_KEY);
    if (!catalog) return res.end(html);
    return res.end(inyectarPortada(html, { catalog, base }));
  } catch (e) {
    console.error('portada: no se pudo inyectar el catalogo', e);
    return res.end(html);
  }
};
