import { describe, it, expect } from 'vitest';
import { hasVariants, getVariants, getVariant, getUnitPrice, getMinPrice, getStockQty } from './useCatalog';

const sinVariantes = { id: 'p1', name: 'Mouse', price: 1200, stockQty: 5 };
const conVariantes = {
  id: 'p2', name: 'Laptop', price: 18000, stockQty: 4, variantAxis: 'Capacidad',
  variants: [
    { id: 'v1', label: '256GB SSD', price: 18000, stockQty: 3 },
    { id: 'v2', label: '512GB SSD', price: 22000, stockQty: 1 },
  ],
};
const variantesAgotadas = {
  id: 'p3', name: 'Teclado', price: 900, stockQty: 0, variantAxis: 'Color',
  variants: [{ id: 'v3', label: 'Negro', price: 900, stockQty: 0 }],
};

describe('hasVariants', () => {
  it('es falso sin el campo', () => expect(hasVariants(sinVariantes)).toBe(false));
  it('es falso con lista vacia', () => expect(hasVariants({ ...sinVariantes, variants: [] })).toBe(false));
  it('es verdadero con variantes', () => expect(hasVariants(conVariantes)).toBe(true));
});

describe('getVariants', () => {
  it('devuelve lista vacia sin variantes', () => expect(getVariants(sinVariantes)).toEqual([]));
  it('devuelve lista vacia si el campo no es arreglo', () => expect(getVariants({ ...sinVariantes, variants: 'x' })).toEqual([]));
  it('devuelve las variantes', () => expect(getVariants(conVariantes)).toHaveLength(2));
});

describe('getVariant', () => {
  it('resuelve por id', () => expect(getVariant(conVariantes, 'v2').label).toBe('512GB SSD'));
  it('devuelve null con id inexistente', () => expect(getVariant(conVariantes, 'nope')).toBeNull());
  it('devuelve null sin variantId', () => expect(getVariant(conVariantes, null)).toBeNull());
  it('devuelve null en producto sin variantes', () => expect(getVariant(sinVariantes, 'v1')).toBeNull());
});

describe('getStockQty', () => {
  it('mantiene el comportamiento actual sin variantes', () => expect(getStockQty(sinVariantes)).toBe(5));
  it('mantiene el default de 999 cuando no hay dato', () => expect(getStockQty({ id: 'x' })).toBe(999));
  it('mantiene stock false como agotado', () => expect(getStockQty({ id: 'x', stock: false })).toBe(0));
  it('suma el stock de las variantes', () => expect(getStockQty(conVariantes)).toBe(4));
  it('ignora el stockQty del producto cuando hay variantes', () => {
    expect(getStockQty({ ...conVariantes, stockQty: 999 })).toBe(4);
  });
  it('suma cero cuando todas las variantes estan agotadas', () => expect(getStockQty(variantesAgotadas)).toBe(0));
});

describe('getUnitPrice', () => {
  it('usa el precio del producto sin variantes', () => expect(getUnitPrice(sinVariantes, null)).toBe(1200));
  it('usa el precio de la variante elegida', () => expect(getUnitPrice(conVariantes, 'v2')).toBe(22000));
  it('devuelve null si la variante no existe', () => expect(getUnitPrice(conVariantes, 'nope')).toBeNull());
  it('devuelve null si el producto tiene variantes y no se eligio ninguna', () => {
    expect(getUnitPrice(conVariantes, null)).toBeNull();
  });
});

describe('getMinPrice', () => {
  it('usa el precio del producto sin variantes', () => expect(getMinPrice(sinVariantes)).toBe(1200));
  it('devuelve el minimo de las variantes', () => expect(getMinPrice(conVariantes)).toBe(18000));
  it('ignora el precio del producto cuando hay variantes', () => {
    expect(getMinPrice({ ...conVariantes, price: 1 })).toBe(18000);
  });
});
