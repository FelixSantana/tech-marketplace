// Control de version del catalogo, sin HTTP ni Redis, para poder probarlo.
//
// Todo el catalogo vive en una sola clave y cada escritura la reemplaza completa. Sin control,
// un panel abierto hace rato podia guardar su copia vieja encima de un descuento de stock hecho
// al completar una orden, y esa venta no se volvia a restar nunca. Con version, el servidor
// rechaza cualquier guardado que no parta de la ultima version conocida.

function catalogVersion(catalog) {
  const v = Number(catalog && catalog.version);
  return Number.isInteger(v) && v >= 0 ? v : 0;
}

// incoming.version es la version que el panel cargo, no la que quiere escribir.
// Un catalogo sin version (el de produccion antes de este cambio) cuenta como version 0.
function prepareCatalogWrite(stored, incoming) {
  const actual = catalogVersion(stored);
  if (stored && catalogVersion(incoming) !== actual) throw new Error('CATALOG_CONFLICT');
  return { ...incoming, version: actual + 1 };
}

// Para escrituras que hace el propio servidor, como el descuento al completar una orden.
function bumpVersion(catalog) {
  return { ...catalog, version: catalogVersion(catalog) + 1 };
}

module.exports = { catalogVersion, prepareCatalogWrite, bumpVersion };
