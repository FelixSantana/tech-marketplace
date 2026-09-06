import { describe, it, expect } from 'vitest';
import { normalizePhone, buildOrderWaLink } from './utils';

const settings = { storeName: 'Synaptic Tech', currency: 'RD$', whatsapp: '+1 857 364 1479' };
const mouse = { id: 'p1', name: 'Mouse inalámbrico', price: 1200 };
const laptop = {
  id: 'p2', name: 'Laptop Ryzen 5', price: 18000, variantAxis: 'Capacidad',
  variants: [{ id: 'v1', label: '256GB SSD', price: 18000, stockQty: 3 }, { id: 'v2', label: '512GB SSD', price: 22000, stockQty: 1 }],
};

const mensajeDe = (url) => decodeURIComponent(url.split('text=')[1]);

describe('normalizePhone', () => {
  it('deja solo digitos', () => expect(normalizePhone('+1 857 364 1479')).toBe('18573641479'));
  it('antepone 1 a un numero local de 10 digitos', () => expect(normalizePhone('8093641479')).toBe('18093641479'));
});

describe('buildOrderWaLink', () => {
  it('apunta al numero de la tienda ya normalizado', () => {
    expect(buildOrderWaLink([{ product: mouse, qty: 1 }], settings)).toMatch(/^https:\/\/wa\.me\/18573641479\?text=/);
  });

  it('lista producto, cantidad y subtotal', () => {
    const msg = mensajeDe(buildOrderWaLink([{ product: mouse, qty: 2 }], settings));
    expect(msg).toContain('• Mouse inalámbrico x2 — RD$ 2,400');
    expect(msg).toContain('Total: RD$ 2,400');
  });

  it('nombra la variante y usa SU precio, no el del producto', () => {
    const msg = mensajeDe(buildOrderWaLink([{ product: laptop, qty: 1, variantId: 'v2' }], settings));
    expect(msg).toContain('• Laptop Ryzen 5 (Capacidad: 512GB SSD) x1 — RD$ 22,000');
    expect(msg).not.toContain('18,000');
  });

  it('trata dos variantes del mismo producto como lineas distintas', () => {
    const msg = mensajeDe(buildOrderWaLink([
      { product: laptop, qty: 1, variantId: 'v1' },
      { product: laptop, qty: 1, variantId: 'v2' },
    ], settings));
    expect(msg).toContain('256GB SSD');
    expect(msg).toContain('512GB SSD');
    expect(msg).toContain('Total: RD$ 40,000');
  });

  it('suma el total de varias lineas', () => {
    const msg = mensajeDe(buildOrderWaLink([{ product: mouse, qty: 2 }, { product: laptop, qty: 1, variantId: 'v1' }], settings));
    expect(msg).toContain('Total: RD$ 20,400');
  });

  it('sobrevive al ida y vuelta de la codificacion, con saltos de linea y acentos', () => {
    const url = buildOrderWaLink([{ product: mouse, qty: 1 }], settings);
    const msg = mensajeDe(url);
    expect(msg).toContain('\n');
    expect(msg).toContain('¿Está todo disponible?');
    expect(url).not.toContain(' ');
  });
});
