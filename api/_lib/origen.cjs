// El origen desde el que se esta sirviendo la peticion: https://loquesea.com
//
// Estaba repetido en producto-handler y og-handler; ahora lo usan tambien el mapa del sitio y
// robots.txt, que son los dos sitios donde equivocarse mas duele: una URL de otro dominio en un
// sitemap hace que Google descarte esas entradas enteras.
function origenDePeticion(req) {
  const cab = (req && req.headers) || {};
  const host = cab['x-forwarded-host'] || cab.host || '';
  const proto = cab['x-forwarded-proto'] || (String(host).startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

module.exports = { origenDePeticion };
