import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { reservasDeOrdenes, apartadoDe, buildPublicItems } = require('./orders-logic.cjs');

const orden = (estado, lineas, extra = {}) => ({ id: 'o_' + Math.random(), status: estado, products: lineas, ...extra });
const linea = (productId, quantity, variantId = null) => ({ productId, variantId, quantity });

const catalogo = () => ({
  products: [
    { id: 'p1', name: 'Mouse', price: 1200, stockQty: 5 },
    {
      id: 'p2', name: 'Laptop', price: 18000, stockQty: 4, variantAxis: 'Capacidad',
      variants: [{ id: 'v1', label: '256GB', price: 18000, stockQty: 3 }, { id: 'v2', label: '512GB', price: 22000, stockQty: 1 }],
    },
  ],
});

describe('reservasDeOrdenes', () => {
  it('cuenta pendiente, pagado y enviado', () => {
    const r = reservasDeOrdenes([
      orden('pending', [linea('p1', 1)]),
      orden('paid', [linea('p1', 2)]),
      orden('shipped', [linea('p1', 3)]),
    ]);
    expect(apartadoDe(r, 'p1', null)).toBe(6);
  });

  it('no cuenta lo cancelado: cancelar libera el apartado', () => {
    const r = reservasDeOrdenes([orden('pending', [linea('p1', 2)]), orden('cancelled', [linea('p1', 3)])]);
    expect(apartadoDe(r, 'p1', null)).toBe(2);
  });

  it('no cuenta lo completado, porque ya se descontó del stock', () => {
    const r = reservasDeOrdenes([orden('completed', [linea('p1', 2)], { inventoryDeducted: true })]);
    expect(apartadoDe(r, 'p1', null)).toBe(0);
  });

  it('no cuenta una orden cuyo inventario ya se descontó, cualquiera sea su estado', () => {
    const r = reservasDeOrdenes([orden('pending', [linea('p1', 2)], { inventoryDeducted: true })]);
    expect(apartadoDe(r, 'p1', null)).toBe(0);
  });

  it('separa el apartado por variante', () => {
    const r = reservasDeOrdenes([orden('pending', [linea('p2', 2, 'v1'), linea('p2', 1, 'v2')])]);
    expect(apartadoDe(r, 'p2', 'v1')).toBe(2);
    expect(apartadoDe(r, 'p2', 'v2')).toBe(1);
  });

  it('suma varias lineas del mismo articulo en la misma orden', () => {
    const r = reservasDeOrdenes([orden('pending', [linea('p1', 2), linea('p1', 3)])]);
    expect(apartadoDe(r, 'p1', null)).toBe(5);
  });

  it('tolera una lista vacia o ausente', () => {
    expect(apartadoDe(reservasDeOrdenes([]), 'p1', null)).toBe(0);
    expect(apartadoDe(reservasDeOrdenes(undefined), 'p1', null)).toBe(0);
  });
});

describe('buildPublicItems con apartados', () => {
  it('rechaza el pedido cuando lo apartado agota lo disponible', () => {
    const reservas = reservasDeOrdenes([orden('pending', [linea('p2', 1, 'v2')])]); // v2 tiene 1
    expect(() => buildPublicItems([{ productId: 'p2', variantId: 'v2', quantity: 1 }], catalogo(), reservas))
      .toThrow('INSUFFICIENT_STOCK');
  });

  it('acepta hasta lo que queda libre', () => {
    const reservas = reservasDeOrdenes([orden('pending', [linea('p1', 3)])]); // p1 tiene 5, quedan 2
    const [item] = buildPublicItems([{ productId: 'p1', quantity: 2 }], catalogo(), reservas);
    expect(item.quantity).toBe(2);
    expect(() => buildPublicItems([{ productId: 'p1', quantity: 3 }], catalogo(), reservas)).toThrow('INSUFFICIENT_STOCK');
  });

  it('un apartado de otra variante no bloquea la que se pide', () => {
    const reservas = reservasDeOrdenes([orden('pending', [linea('p2', 1, 'v2')])]);
    const [item] = buildPublicItems([{ productId: 'p2', variantId: 'v1', quantity: 3 }], catalogo(), reservas);
    expect(item.quantity).toBe(3);
  });

  it('sigue funcionando sin apartados, como antes', () => {
    const [item] = buildPublicItems([{ productId: 'p1', quantity: 5 }], catalogo());
    expect(item.quantity).toBe(5);
  });

  it('suma las lineas del propio pedido contra lo disponible', () => {
    const reservas = reservasDeOrdenes([orden('pending', [linea('p1', 3)])]); // quedan 2
    expect(() => buildPublicItems([{ productId: 'p1', quantity: 1 }, { productId: 'p1', quantity: 2 }], catalogo(), reservas))
      .toThrow('INSUFFICIENT_STOCK');
  });
});
