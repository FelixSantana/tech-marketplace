import { describe, it, expect } from 'vitest';
import { netearApartados } from './apartados';

const productos = () => [
  { id: 'p1', name: 'Mouse', price: 1200, stockQty: 5 },
  { id: 'p2', name: 'Laptop', price: 18000, stockQty: 4, variantAxis: 'Capacidad',
    variants: [{ id: 'v1', label: '256GB', price: 18000, stockQty: 3 }, { id: 'v2', label: '512GB', price: 22000, stockQty: 1 }] },
];
const buscar = (l, id) => l.find((p) => p.id === id);

describe('netearApartados', () => {
  it('resta lo apartado del stock que ve el cliente', () => {
    const r = netearApartados(productos(), { 'p1::': 2 });
    expect(buscar(r, 'p1').stockQty).toBe(3);
  });

  it('nunca baja de cero, aunque lo apartado supere el stock', () => {
    const r = netearApartados(productos(), { 'p1::': 99 });
    expect(buscar(r, 'p1').stockQty).toBe(0);
  });

  it('resta por variante y recalcula el total del producto', () => {
    const r = netearApartados(productos(), { 'p2::v1': 2, 'p2::v2': 1 });
    const laptop = buscar(r, 'p2');
    expect(laptop.variants.map((v) => v.stockQty)).toEqual([1, 0]);
    expect(laptop.stockQty).toBe(1);
  });

  it('sin apartados devuelve los mismos valores', () => {
    expect(netearApartados(productos(), {})).toEqual(productos());
    expect(netearApartados(productos(), undefined)).toEqual(productos());
  });

  it('no muta los productos recibidos', () => {
    const originales = productos();
    netearApartados(originales, { 'p1::': 2, 'p2::v1': 1 });
    expect(buscar(originales, 'p1').stockQty).toBe(5);
    expect(buscar(originales, 'p2').variants[0].stockQty).toBe(3);
  });
});
