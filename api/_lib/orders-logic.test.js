import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildPublicItems, buildAdminItems, applyInventoryDeduction } = require('./orders-logic.cjs');

const catalogo = () => ({
  products: [
    { id: 'p1', name: 'Mouse', price: 1200, stockQty: 5 },
    {
      id: 'p2', name: 'Laptop', price: 18000, stockQty: 4, variantAxis: 'Capacidad',
      variants: [
        { id: 'v1', label: '256GB SSD', price: 18000, stockQty: 3 },
        { id: 'v2', label: '512GB SSD', price: 22000, stockQty: 1 },
      ],
    },
  ],
});

describe('buildPublicItems', () => {
  it('mantiene el camino sin variantes', () => {
    const [item] = buildPublicItems([{ productId: 'p1', quantity: 2 }], catalogo());
    expect(item).toMatchObject({ productId: 'p1', quantity: 2, unitPrice: 1200, subtotal: 2400 });
    expect(item.variantId).toBeNull();
  });

  it('congela eje y etiqueta de la variante, y toma su precio', () => {
    const [item] = buildPublicItems([{ productId: 'p2', variantId: 'v2', quantity: 1 }], catalogo());
    expect(item).toMatchObject({
      productId: 'p2', variantId: 'v2', variantAxis: 'Capacidad', variantLabel: '512GB SSD',
      unitPrice: 22000, subtotal: 22000,
    });
  });

  it('rechaza pedir un producto con variantes sin elegir una', () => {
    expect(() => buildPublicItems([{ productId: 'p2', quantity: 1 }], catalogo())).toThrow('VARIANT_REQUIRED');
  });

  it('rechaza una variante inexistente', () => {
    expect(() => buildPublicItems([{ productId: 'p2', variantId: 'nope', quantity: 1 }], catalogo())).toThrow('INVALID_VARIANT');
  });

  it('valida el stock contra la variante, no contra la suma del producto', () => {
    // el producto suma 4 en total, pero la variante v2 solo tiene 1
    expect(() => buildPublicItems([{ productId: 'p2', variantId: 'v2', quantity: 2 }], catalogo())).toThrow('INSUFFICIENT_STOCK');
  });

  it('acepta hasta el stock exacto de la variante', () => {
    const [item] = buildPublicItems([{ productId: 'p2', variantId: 'v1', quantity: 3 }], catalogo());
    expect(item.quantity).toBe(3);
  });
});

describe('buildAdminItems', () => {
  it('resuelve la variante y conserva el precio que fije el admin', () => {
    const [item] = buildAdminItems([{ productId: 'p2', variantId: 'v1', quantity: 1, unitPrice: 15000 }], catalogo());
    expect(item).toMatchObject({ variantId: 'v1', variantLabel: '256GB SSD', unitPrice: 15000 });
  });

  it('rechaza una variante inexistente', () => {
    expect(() => buildAdminItems([{ productId: 'p2', variantId: 'nope', quantity: 1 }], catalogo())).toThrow('INVALID_VARIANT');
  });
});

describe('applyInventoryDeduction', () => {
  it('descuenta de la variante correcta y deja las demas intactas', () => {
    const orden = { products: [{ productId: 'p2', variantId: 'v1', quantity: 2 }] };
    const siguiente = applyInventoryDeduction(catalogo(), orden);
    const laptop = siguiente.products.find((p) => p.id === 'p2');
    expect(laptop.variants.find((v) => v.id === 'v1').stockQty).toBe(1);
    expect(laptop.variants.find((v) => v.id === 'v2').stockQty).toBe(1);
  });

  it('actualiza el espejo stockQty del producto tras descontar', () => {
    const orden = { products: [{ productId: 'p2', variantId: 'v1', quantity: 2 }] };
    const siguiente = applyInventoryDeduction(catalogo(), orden);
    expect(siguiente.products.find((p) => p.id === 'p2').stockQty).toBe(2);
  });

  it('mantiene el descuento por producto cuando la linea no trae variante', () => {
    const orden = { products: [{ productId: 'p1', quantity: 2 }] };
    const siguiente = applyInventoryDeduction(catalogo(), orden);
    expect(siguiente.products.find((p) => p.id === 'p1').stockQty).toBe(3);
  });

  it('falla si una linea vieja sin variante apunta a un producto que ahora tiene variantes', () => {
    const orden = { products: [{ productId: 'p2', quantity: 1 }] };
    expect(() => applyInventoryDeduction(catalogo(), orden)).toThrow('INVENTORY_VARIANT_UNKNOWN');
  });

  it('falla si la variante de la orden ya no existe', () => {
    const orden = { products: [{ productId: 'p2', variantId: 'borrada', quantity: 1 }] };
    expect(() => applyInventoryDeduction(catalogo(), orden)).toThrow('INVENTORY_VARIANT_NOT_FOUND');
  });

  it('no descuenta nada si una linea de varias no alcanza', () => {
    const orden = { products: [
      { productId: 'p2', variantId: 'v1', quantity: 1 },
      { productId: 'p2', variantId: 'v2', quantity: 5 },
    ] };
    expect(() => applyInventoryDeduction(catalogo(), orden)).toThrow('INSUFFICIENT_STOCK_ON_COMPLETION');
  });

  it('no muta el catalogo recibido', () => {
    const original = catalogo();
    applyInventoryDeduction(original, { products: [{ productId: 'p2', variantId: 'v1', quantity: 2 }] });
    expect(original.products.find((p) => p.id === 'p2').variants.find((v) => v.id === 'v1').stockQty).toBe(3);
  });
});
