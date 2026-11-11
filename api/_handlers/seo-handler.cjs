const { kvGet, kvConfigured } = require('../_lib/kv.cjs');
const { construirSitemap, construirRobots } = require('../_lib/sitemap.cjs');
const { origenDePeticion } = require('../_lib/origen.cjs');
const CATALOG_KEY = 'synaptic_catalog';

// /robots.txt y /sitemap.xml, los dos desde aqui.
//
// Estaban en dos funciones. Se juntaron porque Vercel pone un tope al numero de funciones por
// despliegue —doce en el plan Hobby— y al añadir la de la portada se paso: el despliegue dejo
// de salir, en silencio, mientras produccion seguia sirviendo el anterior.
//
// Estos dos eran los candidatos obvios: son los mas pequeños, nadie los abre a mano, y lo que
// hacen es lo mismo —contestarle a un rastreador con texto plano que depende del dominio desde
// el que se pide—. El tipo llega por la reescritura de vercel.json, no de la URL que escribe
// nadie, asi que no hay nada que validar mas alla de los dos valores que existen.
//
// Son funciones y no archivos porque las dos necesitan el dominio: robots.txt lleva una linea
// Sitemap: con URL absoluta, y el mapa una entrada por producto. El dominio cambia con cada
// tienda que se monte de este mismo repositorio.
module.exports = async function handler(req, res) {
  const tipo = String((req.query && req.query.tipo) || '');
  const base = origenDePeticion(req);
  // Un dia en el borde: el catalogo cambia poco y Google no pide ninguno de los dos a menudo.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');

  if (tipo === 'robots') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end(construirRobots(base));
  }

  if (tipo === 'sitemap') {
    let catalog = {};
    if (kvConfigured()) {
      try {
        catalog = (await kvGet(CATALOG_KEY)) || {};
      } catch (e) {
        // Sin catalogo sale un mapa con solo la portada, en vez de un error: un 500 aqui hace
        // que Google marque el mapa como roto y deje de pedirlo durante dias.
        console.error('sitemap: no se pudo leer el catalogo', e);
      }
    }
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.end(construirSitemap(catalog, base));
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.end('No existe.');
};
