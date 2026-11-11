import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ICONOS_DE_SELLO } from '../lib/negocio';

// Los iconos de los sellos salian torcidos por dos motivos a la vez.
//
// 1. CSS: `.sello span` alcanzaba tambien al <span> del icono y, por especificidad, le ganaba a
//    `.sello-icono`. En escritorio le quitaba el centrado (display:block en vez de grid) y el
//    color del acento; en movil, donde esa regla es display:none para soltar la explicacion, lo
//    hacia desaparecer entero. Eso es lo que vigila este archivo.
//
// 2. Geometria: el dibujo del camion no estaba centrado dentro de su propio viewBox. Eso no se
//    comprueba aqui: medir la caja de un trazo con curvas pide un navegador de verdad
//    (getBBox), y un analizador de trazos escrito a mano pasaria por los motivos equivocados.
//    Se verifica con el navegador, midiendo la caja del dibujo contra la del recuadro.

const css = readFileSync(new URL('../skin.css', import.meta.url), 'utf8');
const jsx = readFileSync(new URL('./TrustBadges.jsx', import.meta.url), 'utf8');

describe('el CSS de los sellos', () => {
  it('ninguna regla apunta a todos los span de un sello', () => {
    expect(css).not.toMatch(/\.sello\s+span\s*\{/);
  });

  it('las reglas del texto apuntan solo al texto', () => {
    expect(css).toContain('.sello-texto span{');
    // Tambien la de movil, que es la que llegaba a ocultar el icono.
    expect(css).toMatch(/\.sello-texto span\{display:none\}/);
  });

  it('el recuadro del icono centra lo que lleva dentro', () => {
    const regla = css.match(/\.sello-icono\{[^}]*place-items:center[^}]*\}/g) || [];
    expect(regla.length).toBeGreaterThan(0);
    expect(regla.some((r) => r.includes('display:grid'))).toBe(true);
  });
});

describe('el marcado de los sellos', () => {
  it('el texto va en su propio contenedor con nombre', () => {
    expect(jsx).toContain('className="sello-texto"');
  });

  it('todos los iconos comparten un único viewBox', () => {
    // Antes los dibujos estaban escritos dentro de este componente y se comprobaba aqui. Ahora
    // vienen de Iconos.jsx, donde TODOS pasan por el mismo envoltorio: hay un solo viewBox en
    // el archivo y ninguno puede declarar el suyo. Si alguien añade un icono con otro lienzo,
    // ese icono saldria de distinto tamaño que los demas y esto lo caza.
    const iconos = readFileSync(new URL('./Iconos.jsx', import.meta.url), 'utf8');
    const viewBoxes = iconos.match(/viewBox="[^"]+"/g) || [];
    expect(viewBoxes).toEqual(['viewBox="0 0 24 24"']);
  });

  it('cada icono que ofrecen los Ajustes tiene dibujo', () => {
    // El dueño elige de una lista cerrada. Un nombre en la lista sin dibujo en el componente
    // dejaria el hueco vacio y nadie se enteraria hasta verlo en la tienda.
    for (const { valor } of ICONOS_DE_SELLO) {
      expect(jsx).toMatch(new RegExp(`\\b${valor}:\\s*Icono\\w+`));
    }
  });

  it('un icono desconocido no deja el sello sin dibujo', () => {
    expect(jsx).toContain('ICONOS[s.icono] || ICONOS.probado');
  });
});
