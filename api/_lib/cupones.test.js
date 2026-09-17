import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizarCupones, normalizarCodigo, resolverCupon, descuentoDe } = require('./cupones.cjs');

const cupones = [
  { id: 'c1', codigo: 'BIENVENIDO', tipo: 'porcentaje', valor: 10, vence: '', minimo: 0, activo: true },
  { id: 'c2', codigo: 'MIL', tipo: 'monto', valor: 1000, vence: '', minimo: 5000, activo: true },
  { id: 'c3', codigo: 'VIEJO', tipo: 'porcentaje', valor: 50, vence: '2026-01-31', minimo: 0, activo: true },
  { id: 'c4', codigo: 'APAGADO', tipo: 'porcentaje', valor: 20, vence: '', minimo: 0, activo: false },
];
const tienda = { cupones };
const HOY = '2026-09-17';

describe('normalizarCodigo', () => {
  it('pasa a mayusculas y quita espacios', () => expect(normalizarCodigo('  bien venido ')).toBe('BIENVENIDO'));
  it('tolera vacios', () => expect(normalizarCodigo(null)).toBe(''));
});

describe('normalizarCupones', () => {
  it('descarta los que no tienen id o codigo', () => {
    const r = normalizarCupones({ cupones: [{ codigo: 'SINID' }, { id: 'x', codigo: '' }, cupones[0]] });
    expect(r.map((c) => c.codigo)).toEqual(['BIENVENIDO']);
  });
  it('un tipo desconocido cae en porcentaje', () => {
    expect(normalizarCupones({ cupones: [{ id: 'x', codigo: 'A', tipo: 'raro', valor: 5 }] })[0].tipo).toBe('porcentaje');
  });
  it('descarta una fecha con formato invalido', () => {
    expect(normalizarCupones({ cupones: [{ id: 'x', codigo: 'A', vence: '31/01/2026' }] })[0].vence).toBe('');
  });
  it('devuelve lista vacia si la tienda no tiene cupones', () => {
    expect(normalizarCupones({})).toEqual([]);
    expect(normalizarCupones(undefined)).toEqual([]);
  });
});

describe('descuentoDe', () => {
  it('calcula el porcentaje', () => expect(descuentoDe({ tipo: 'porcentaje', valor: 10 }, 7500)).toBe(750));
  it('un porcentaje mayor a 100 no regala mas que el subtotal', () => {
    expect(descuentoDe({ tipo: 'porcentaje', valor: 500 }, 7500)).toBe(7500);
  });
  it('un monto mayor al subtotal se recorta al subtotal', () => {
    expect(descuentoDe({ tipo: 'monto', valor: 9000 }, 7500)).toBe(7500);
  });
  it('redondea a dos decimales', () => expect(descuentoDe({ tipo: 'porcentaje', valor: 33 }, 999)).toBe(329.67));
});

describe('resolverCupon', () => {
  it('sin codigo no hay cupon, y no es error', () => {
    expect(resolverCupon(tienda, '', 7500, HOY)).toBeNull();
    expect(resolverCupon(tienda, undefined, 7500, HOY)).toBeNull();
  });

  it('acepta el codigo escrito en minusculas y con espacios', () => {
    expect(resolverCupon(tienda, ' bienvenido ', 7500, HOY)).toMatchObject({ codigo: 'BIENVENIDO', descuento: 750 });
  });

  it('rechaza un codigo que no existe', () => {
    expect(() => resolverCupon(tienda, 'REGALO', 7500, HOY)).toThrow('COUPON_NOT_FOUND');
  });

  it('rechaza un cupon apagado', () => {
    expect(() => resolverCupon(tienda, 'APAGADO', 7500, HOY)).toThrow('COUPON_INACTIVE');
  });

  it('rechaza un cupon vencido y acepta uno que vence hoy', () => {
    expect(() => resolverCupon(tienda, 'VIEJO', 7500, HOY)).toThrow('COUPON_EXPIRED');
    expect(resolverCupon(tienda, 'VIEJO', 7500, '2026-01-31')).toMatchObject({ descuento: 3750 });
  });

  it('respeta el minimo del cupon', () => {
    expect(() => resolverCupon(tienda, 'MIL', 4999, HOY)).toThrow('COUPON_BELOW_MIN');
    expect(resolverCupon(tienda, 'MIL', 5000, HOY)).toMatchObject({ descuento: 1000 });
  });

  it('ignora el descuento que mande el navegador: recalcula con su propia tabla', () => {
    const r = resolverCupon(tienda, 'BIENVENIDO', 1000, HOY);
    expect(r.descuento).toBe(100);
  });
});
