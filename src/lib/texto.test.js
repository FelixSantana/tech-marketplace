import { describe, it, expect } from 'vitest';
import { normalizarBusqueda, coincideBusqueda , cuantos } from './texto';

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

describe('concordancia de número', () => {
  it('uno va en singular', () => {
    expect(cuantos(1, 'opción', 'opciones')).toBe('1 opción');
  });

  it('el resto en plural', () => {
    expect(cuantos(2, 'opción', 'opciones')).toBe('2 opciones');
    expect(cuantos(0, 'opción', 'opciones')).toBe('0 opciones');
    expect(cuantos(17, 'artículo', 'artículos')).toBe('17 artículos');
  });

  it('devuelve el número junto al texto, que es el motivo de que exista', () => {
    // El fallo que esto evita aparecio dos veces: el numero y el plural se calculaban por
    // separado y acababan sin concordar ("1 articulos", "1 opciones de RAM").
    expect(cuantos(1, 'comprobante', 'comprobantes')).toBe('1 comprobante');
  });

  it('aguanta basura sin escribir NaN en la pantalla', () => {
    expect(cuantos(undefined, 'opción', 'opciones')).toBe('0 opciones');
    expect(cuantos('tres', 'opción', 'opciones')).toBe('0 opciones');
    expect(cuantos(2.7, 'opción', 'opciones')).toBe('2 opciones');
  });
});
