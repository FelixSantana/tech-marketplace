import { describe, it, expect } from 'vitest';
import { slugProducto, rutaProducto, buscarPorSlug, sufijoDeId } from './rutas';

const laptop = { id: 'p_1784335177257_era4q', name: 'Dell Latitude 3190' };
const micro = { id: 'p_1784335177999_zz9kk', name: 'Micrófono Fantech Leviosa Wave Wmcx01' };
const raro = { id: 'p_1784335177888_ab12c', name: '¡¡¡!!!' };
const productos = [laptop, micro, raro];

describe('slugProducto', () => {
  it('pasa el nombre a guiones y le pega el sufijo del id', () => {
    expect(slugProducto(laptop)).toBe('dell-latitude-3190-era4q');
  });
  it('quita acentos', () => expect(slugProducto(micro)).toMatch(/^microfono-fantech-leviosa-wave-wmcx01-/));
  it('un nombre sin letras ni numeros deja solo el sufijo', () => expect(slugProducto(raro)).toBe('ab12c'));
  it('no deja guiones al principio ni al final', () => {
    expect(slugProducto({ id: 'p_1_abc123', name: '  --Hola--  ' })).toBe('hola-abc123');
  });
});

describe('rutaProducto', () => {
  it('arma la ruta completa', () => expect(rutaProducto(laptop)).toBe('/p/dell-latitude-3190-era4q'));
});

describe('buscarPorSlug', () => {
  it('encuentra por el slug completo', () => expect(buscarPorSlug(productos, 'dell-latitude-3190-era4q')).toBe(laptop));
  it('tolera la ruta con el prefijo /p/', () => expect(buscarPorSlug(productos, '/p/dell-latitude-3190-era4q')).toBe(laptop));
  it('sigue encontrandolo si el producto se renombro', () => {
    expect(buscarPorSlug(productos, 'otro-nombre-cualquiera-era4q')).toBe(laptop);
  });
  it('ignora lo que venga despues de ? o #', () => {
    expect(buscarPorSlug(productos, 'dell-latitude-3190-era4q?utm=whatsapp')).toBe(laptop);
  });
  it('devuelve null si no existe', () => expect(buscarPorSlug(productos, 'nada-de-nada-xxxxxx')).toBeNull());
  it('devuelve null con slug vacio', () => {
    expect(buscarPorSlug(productos, '')).toBeNull();
    expect(buscarPorSlug(productos, undefined)).toBeNull();
  });
  it('no confunde dos productos distintos', () => {
    expect(buscarPorSlug(productos, slugProducto(micro))).toBe(micro);
  });
});

describe('sufijoDeId', () => {
  it('toma los ultimos seis del ultimo segmento', () => expect(sufijoDeId('p_1784335177257_era4q')).toBe('era4q'));
  it('tolera un id sin guiones bajos', () => expect(sufijoDeId('abcdefghij')).toBe('efghij'));
});
