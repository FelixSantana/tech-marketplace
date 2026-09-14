import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { catalogVersion, prepareCatalogWrite, bumpVersion } = require('./catalog-logic.cjs');

const cat = (version, stock = 5) => ({
  ...(version === undefined ? {} : { version }),
  settings: { storeName: 'X' }, categories: [],
  products: [{ id: 'p1', name: 'Laptop', price: 100, stockQty: stock }],
});

describe('catalogVersion', () => {
  it('trata un catalogo sin version como version 0', () => expect(catalogVersion(cat(undefined))).toBe(0));
  it('lee la version guardada', () => expect(catalogVersion(cat(7))).toBe(7));
  it('ignora valores invalidos', () => {
    for (const v of [-1, 1.5, 'x', null]) expect(catalogVersion({ version: v })).toBe(0);
  });
});

describe('prepareCatalogWrite', () => {
  it('acepta el primer guardado, cuando todavia no hay catalogo', () => {
    expect(prepareCatalogWrite(null, cat(undefined)).version).toBe(1);
  });

  it('acepta guardar sobre la version que el panel cargo, y la sube', () => {
    expect(prepareCatalogWrite(cat(3), cat(3)).version).toBe(4);
  });

  it('acepta el catalogo de produccion de hoy, que no tiene version', () => {
    expect(prepareCatalogWrite(cat(undefined), cat(undefined)).version).toBe(1);
  });

  it('rechaza guardar sobre una copia vieja: es el fallo que revertia el stock', () => {
    // el panel cargo la version 3; mientras tanto completar una orden la subio a 4
    expect(() => prepareCatalogWrite(cat(4, 3), cat(3, 5))).toThrow('CATALOG_CONFLICT');
  });

  it('rechaza a un cliente con codigo viejo que no manda version', () => {
    expect(() => prepareCatalogWrite(cat(2), cat(undefined))).toThrow('CATALOG_CONFLICT');
  });
});

describe('bumpVersion', () => {
  it('sube la version sin tocar el contenido', () => {
    const siguiente = bumpVersion(cat(4, 3));
    expect(siguiente.version).toBe(5);
    expect(siguiente.products[0].stockQty).toBe(3);
  });
  it('arranca en 1 un catalogo sin version', () => expect(bumpVersion(cat(undefined)).version).toBe(1));
});
