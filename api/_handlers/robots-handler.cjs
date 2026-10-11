const { construirRobots } = require('../_lib/sitemap.cjs');
const { origenDePeticion } = require('../_lib/origen.cjs');

// Sirve /robots.txt. Es una funcion y no un archivo porque la linea Sitemap: exige una URL
// absoluta, y el dominio cambia con cada tienda que se monte de este mismo repositorio.
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
  return res.end(construirRobots(origenDePeticion(req)));
};
