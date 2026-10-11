const { kvGet, kvConfigured } = require('../_lib/kv.cjs');
const { construirSitemap } = require('../_lib/sitemap.cjs');
const { origenDePeticion } = require('../_lib/origen.cjs');
const CATALOG_KEY = 'synaptic_catalog';

// Sirve /sitemap.xml con la portada y una entrada por producto.
//
// Sin base de datos devuelve un mapa con solo la portada, en vez de un error: un 500 aqui hace
// que Google marque el mapa como roto y deje de pedirlo durante dias.
module.exports = async function handler(req, res) {
  let catalog = {};
  if (kvConfigured()) {
    try {
      catalog = (await kvGet(CATALOG_KEY)) || {};
    } catch (e) {
      console.error('sitemap: no se pudo leer el catalogo', e);
    }
  }
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // Un dia en el borde: el catalogo cambia poco y Google no pide el mapa a menudo.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
  return res.end(construirSitemap(catalog, origenDePeticion(req)));
};
