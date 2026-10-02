const { kvGet, kvConfigured } = require('../_lib/kv.cjs');
const { construirManifiesto } = require('../_lib/manifiesto.cjs');
const CATALOG_KEY = 'synaptic_catalog';

// Sirve /manifest.webmanifest con el nombre y los iconos que el dueño tiene en Ajustes.
//
// A diferencia del resto de los endpoints, este NO responde 503 cuando falta la base de datos, ni
// propaga un fallo de Redis. El manifiesto es lo que decide si el telefono ofrece "Instalar
// aplicacion": si falla, Chrome deja de ofrecerlo y nadie entiende por que. Un manifiesto
// generico siempre es mejor que ninguno, asi que cualquier problema acaba en los valores por
// defecto y la tienda sigue siendo instalable.
module.exports = async function handler(req, res) {
  let settings = {};
  if (kvConfigured()) {
    try {
      const catalog = await kvGet(CATALOG_KEY);
      if (catalog && catalog.settings) settings = catalog.settings;
    } catch (e) {
      console.error('manifiesto: no se pudo leer el catalogo', e);
    }
  }

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  // El nombre cambia cuando el dueño lo cambia en Ajustes, asi que el cache es corto. Aun asi hay
  // que contar con que el telefono se queda con el manifiesto del momento de instalar: cambiar el
  // nombre despues no renombra un icono ya instalado, hay que reinstalar.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  return res.end(JSON.stringify(construirManifiesto(settings)));
};
