import { describe, it, expect } from 'vitest';
import { nombreDeTienda, NOMBRE_POR_DEFECTO } from './tienda';
import { nombreDeTienda as nombreServidor, NOMBRE_POR_DEFECTO as DEFECTO_SERVIDOR } from '../../api/_lib/tienda.cjs';
import { NOMBRE_POR_DEFECTO as DEFECTO_BUILD } from '../../scripts/dominio.mjs';

describe('nombreDeTienda', () => {
  it('devuelve el que puso el dueño', () => {
    expect(nombreDeTienda({ storeName: 'Repuestos La Romana' })).toBe('Repuestos La Romana');
  });

  it('limpia los espacios de los lados', () => {
    expect(nombreDeTienda({ storeName: '  Tienda Ana  ' })).toBe('Tienda Ana');
  });

  // El fallo que se esta corrigiendo: una tienda recien instalada se llamaba "Synaptic Tech" en
  // la cabecera, el pie, el titulo de la pestaña, el aviso de privacidad y la pagina de producto.
  it('una tienda sin nombre no se llama como otra', () => {
    for (const s of [{}, null, undefined, { storeName: '' }, { storeName: '   ' }, { storeName: null }]) {
      expect(nombreDeTienda(s)).toBe(NOMBRE_POR_DEFECTO);
    }
    expect(NOMBRE_POR_DEFECTO).not.toContain('Synaptic');
  });

  // El titulo de la pestaña es `${nombre} — Catálogo`. Con 'Catálogo' de respaldo salia
  // "Catálogo — Catálogo", que es por lo que el marcador de posicion no es esa palabra.
  it('el marcador no repite la palabra del título', () => {
    expect(`${nombreDeTienda({})} — Catálogo`).not.toBe('Catálogo — Catálogo');
  });
});

// La constante vive tres veces, cada una en un sitio que no puede importar a los otros en
// produccion: src/lib/tienda.js lo compila Vite para el navegador, api/_lib/tienda.cjs lo ejecuta
// Node en una funcion, y scripts/dominio.mjs corre dentro del build. Aqui, en pruebas, si se leen
// las tres: si alguien cambia una y olvida las demas, la tienda se llamaria de una forma en la
// cabecera, de otra en la pagina de producto y de otra en el titulo de la pestaña.
describe('las tres copias de la constante', () => {
  it('dicen lo mismo', () => {
    expect(DEFECTO_SERVIDOR).toBe(NOMBRE_POR_DEFECTO);
    expect(DEFECTO_BUILD).toBe(NOMBRE_POR_DEFECTO);
  });

  it('se comportan igual', () => {
    for (const s of [{}, { storeName: '' }, { storeName: '  Tienda  ' }, { storeName: 'Repuestos' }, null]) {
      expect(nombreServidor(s)).toBe(nombreDeTienda(s));
    }
  });
});
