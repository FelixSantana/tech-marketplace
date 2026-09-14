import { describe, it, expect } from 'vitest';
import { mergeProductEdit } from './catalogMerge';

// "original" es el producto tal como estaba cuando el admin abrio el formulario.
// "fresh" es el catalogo leido del servidor justo antes de guardar.

const laptop = (stock) => ({ id: 'p1', name: 'Laptop', description: 'vieja', price: 100, stockQty: stock });
const mouse = (stock) => ({ id: 'p2', name: 'Mouse', price: 20, stockQty: stock });
const conVariantes = (s256, s512) => ({
  id: 'p3', name: 'Dell', price: 18000, stockQty: s256 + s512, variantAxis: 'Capacidad',
  variants: [{ id: 'v256', label: '256GB', price: 18000, stockQty: s256 }, { id: 'v512', label: '512GB', price: 22000, stockQty: s512 }],
});
const buscar = (lista, id) => lista.find((p) => p.id === id);

describe('mergeProductEdit — el fallo reportado', () => {
  it('corregir la descripcion no revierte un descuento hecho mientras tanto', () => {
    // el admin abrio el formulario con stock 5; se completo una venta de 2 y el servidor quedo en 3
    const original = laptop(5);
    const fresh = [laptop(3)];
    const data = { ...original, description: 'corregida' }; // el formulario manda stockQty 5, sin tocarlo
    const r = buscar(mergeProductEdit(fresh, { id: 'p1', original, data }), 'p1');
    expect(r.description).toBe('corregida');
    expect(r.stockQty).toBe(3);
  });

  it('no toca los demas productos: quedan como estan en el servidor', () => {
    const fresh = [laptop(3), mouse(8)];
    const r = mergeProductEdit(fresh, { id: 'p1', original: laptop(5), data: { ...laptop(5), description: 'x' } });
    expect(buscar(r, 'p2')).toEqual(mouse(8));
  });
});

describe('mergeProductEdit — cuando el admin si cambia el stock', () => {
  it('respeta el numero que el admin escribio', () => {
    const r = buscar(mergeProductEdit([laptop(3)], { id: 'p1', original: laptop(5), data: { ...laptop(5), stockQty: 10 } }), 'p1');
    expect(r.stockQty).toBe(10);
  });
});

describe('mergeProductEdit — variantes', () => {
  it('conserva el stock fresco de las variantes que el admin no toco', () => {
    const original = conVariantes(3, 1);
    const fresh = [conVariantes(1, 0)]; // se vendieron 2 de 256GB y 1 de 512GB
    const data = { ...original, name: 'Dell Latitude' };
    const r = buscar(mergeProductEdit(fresh, { id: 'p3', original, data }), 'p3');
    expect(r.name).toBe('Dell Latitude');
    expect(r.variants.map((v) => v.stockQty)).toEqual([1, 0]);
    expect(r.stockQty).toBe(1); // espejo de la suma
  });

  it('respeta solo la variante cuyo stock cambio el admin', () => {
    const original = conVariantes(3, 1);
    const fresh = [conVariantes(1, 0)];
    const data = { ...original, variants: original.variants.map((v) => (v.id === 'v512' ? { ...v, stockQty: 5 } : v)) };
    const r = buscar(mergeProductEdit(fresh, { id: 'p3', original, data }), 'p3');
    expect(r.variants.map((v) => v.stockQty)).toEqual([1, 5]);
    expect(r.stockQty).toBe(6);
  });

  it('una variante nueva lleva el stock que escribio el admin', () => {
    const original = conVariantes(3, 1);
    const data = { ...original, variants: [...original.variants, { id: 'v1tb', label: '1TB', price: 27000, stockQty: 2 }] };
    const r = buscar(mergeProductEdit([conVariantes(1, 0)], { id: 'p3', original, data }), 'p3');
    expect(r.variants.find((v) => v.id === 'v1tb').stockQty).toBe(2);
    expect(r.stockQty).toBe(3);
  });

  it('recalcula el precio espejo con el minimo de las variantes', () => {
    const original = conVariantes(3, 1);
    const data = { ...original, variants: original.variants.map((v) => (v.id === 'v256' ? { ...v, price: 16000 } : v)) };
    const r = buscar(mergeProductEdit([conVariantes(3, 1)], { id: 'p3', original, data }), 'p3');
    expect(r.price).toBe(16000);
  });

  it('quitar todas las variantes las elimina de verdad', () => {
    // antes, el formulario sin variantes no mandaba el campo y las viejas sobrevivian
    const original = conVariantes(3, 1);
    const data = { id: 'p3', name: 'Dell', price: 20000, stockQty: 6 };
    const r = buscar(mergeProductEdit([conVariantes(3, 1)], { id: 'p3', original, data }), 'p3');
    expect(r.variants).toBeUndefined();
    expect(r.variantAxis).toBeUndefined();
    expect(r.price).toBe(20000);
    expect(r.stockQty).toBe(6);
  });
});

describe('mergeProductEdit — productos nuevos y casos raros', () => {
  it('agrega un producto nuevo al final', () => {
    const nuevo = { name: 'Teclado', price: 30, stockQty: 4 };
    const r = mergeProductEdit([laptop(3)], { id: 'p9', original: null, data: nuevo });
    expect(r).toHaveLength(2);
    expect(buscar(r, 'p9')).toMatchObject({ id: 'p9', name: 'Teclado', stockQty: 4 });
  });

  it('si el producto ya no existe en el servidor, lo guarda con lo que escribio el admin', () => {
    const r = mergeProductEdit([mouse(8)], { id: 'p1', original: laptop(5), data: { ...laptop(5), description: 'x' } });
    expect(buscar(r, 'p1')).toMatchObject({ description: 'x', stockQty: 5 });
  });
});
