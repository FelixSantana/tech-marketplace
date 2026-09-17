import { describe, it, expect } from 'vitest';
import { normalizarBusqueda, coincideBusqueda } from './texto';

describe('normalizarBusqueda', () => {
  it('quita acentos y pasa a minusculas', () => expect(normalizarBusqueda('Audífonos ÁÉÍÓÚ Ñ')).toBe('audifonos aeiou n'));
  it('tolera valores vacios', () => {
    for (const v of [null, undefined, '', 0]) expect(normalizarBusqueda(v)).toBe('');
  });
});

describe('coincideBusqueda', () => {
  const producto = { name: 'Audífonos Bluetooth X200', description: 'Cancelación de ruido, batería de 30h' };

  it('encuentra escribiendo sin tildes', () => expect(coincideBusqueda(producto, 'audifonos')).toBe(true));
  it('encuentra escribiendo con tildes lo que no las tiene', () => {
    expect(coincideBusqueda({ name: 'Bateria externa' }, 'batería')).toBe(true);
  });
  it('encuentra por descripcion, tambien sin tildes', () => expect(coincideBusqueda(producto, 'cancelacion')).toBe(true));
  it('ignora mayusculas', () => expect(coincideBusqueda(producto, 'BLUETOOTH')).toBe(true));
  it('no encuentra lo que no esta', () => expect(coincideBusqueda(producto, 'laptop')).toBe(false));
  it('tolera un producto sin descripcion', () => expect(coincideBusqueda({ name: 'Mouse' }, 'mouse')).toBe(true));
});
