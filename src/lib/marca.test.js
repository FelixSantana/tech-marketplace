import { describe, it, expect } from 'vitest';
import { encajar, fuenteQueCabe, recortarAlAncho, composicionOg, MEDIDAS, OCUPACION, CAMPOS_DE_MARCA } from './marca';

// Un medidor falso: cada caracter mide la mitad del tamaño de letra. No imita a ningun navegador,
// solo hace que el ancho crezca con el texto y con el tamaño, que es lo que las funciones usan.
const medir = (texto, tamano) => texto.length * tamano * 0.5;

describe('encajar', () => {
  it('centra un logo cuadrado y lo deja en la fracción pedida', () => {
    const p = encajar({ ancho: 100, alto: 100 }, { ancho: 512, alto: 512 }, 0.5);
    expect(p.w).toBe(256);
    expect(p.h).toBe(256);
    expect(p.x).toBe(128);
    expect(p.y).toBe(128);
  });

  // Lo que de verdad importa: un logo apaisado no puede salir estirado.
  it('no deforma un logo apaisado', () => {
    const p = encajar({ ancho: 400, alto: 100 }, { ancho: 512, alto: 512 }, 1);
    expect(p.w / p.h).toBeCloseTo(4, 5);
    expect(p.w).toBe(512);
    expect(p.h).toBe(128);
    expect(p.x).toBe(0);
    expect(p.y).toBe(192);
  });

  it('no deforma un logo vertical', () => {
    const p = encajar({ ancho: 100, alto: 400 }, { ancho: 512, alto: 512 }, 1);
    expect(p.h / p.w).toBeCloseTo(4, 5);
    expect(p.h).toBe(512);
    expect(p.y).toBe(0);
  });

  it('cabe siempre dentro de la caja', () => {
    const caja = { ancho: 192, alto: 192 };
    for (const logo of [{ ancho: 1, alto: 900 }, { ancho: 900, alto: 1 }, { ancho: 3000, alto: 2000 }, { ancho: 7, alto: 11 }]) {
      const p = encajar(logo, caja, OCUPACION.icon192);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(caja.ancho + 1e-9);
      expect(p.y + p.h).toBeLessThanOrEqual(caja.alto + 1e-9);
    }
  });

  it('agranda un logo más pequeño que la caja', () => {
    const p = encajar({ ancho: 50, alto: 50 }, { ancho: 512, alto: 512 }, 0.72);
    expect(p.w).toBeCloseTo(368.64, 2);
  });

  // Una imagen que el navegador no supo medir no puede reventar el dibujo.
  it('un logo sin medidas no revienta', () => {
    for (const malo of [{ ancho: 0, alto: 0 }, { ancho: -5, alto: 10 }, {}, null, undefined]) {
      const p = encajar(malo, { ancho: 512, alto: 512 }, 0.72);
      expect(p.w).toBe(0);
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });
});

describe('fuenteQueCabe', () => {
  it('deja el tamaño inicial si el texto ya cabe', () => {
    expect(fuenteQueCabe(medir, 'Ana', 1000)).toBe(64);
  });

  it('baja hasta que cabe', () => {
    const tam = fuenteQueCabe(medir, 'Electrodomésticos del Este y alrededores', 1000);
    expect(medir('Electrodomésticos del Este y alrededores', tam)).toBeLessThanOrEqual(1000);
    expect(tam).toBeLessThan(64);
  });

  it('nunca baja del mínimo', () => {
    expect(fuenteQueCabe(medir, 'x'.repeat(500), 100)).toBe(28);
  });
});

describe('recortarAlAncho', () => {
  it('no toca un texto que cabe', () => {
    expect(recortarAlAncho(medir, 'Tienda Ana', 1000, 40)).toBe('Tienda Ana');
  });

  it('recorta y cierra con puntos suspensivos', () => {
    const r = recortarAlAncho(medir, 'Electrodomésticos del Este', 200, 40);
    expect(r.endsWith('…')).toBe(true);
    expect(medir(r, 40)).toBeLessThanOrEqual(200);
  });

  it('deja al menos un carácter', () => {
    const r = recortarAlAncho(medir, 'Tienda', 1, 40);
    expect(r.length).toBeGreaterThanOrEqual(2);
  });
});

describe('composicionOg', () => {
  const caja = MEDIDAS.ogImage;

  it('con nombre, el logo deja sitio abajo y el nombre va centrado', () => {
    const c = composicionOg({ ancho: 400, alto: 400 }, 'Repuestos La Romana');
    expect(c.nombre).not.toBeNull();
    expect(c.nombre.x).toBe(caja.ancho / 2);
    expect(c.nombre.y).toBeGreaterThan(caja.alto / 2);
    // El logo no puede invadir la linea del nombre.
    expect(c.logo.y + c.logo.h).toBeLessThan(c.nombre.y);
  });

  it('sin nombre, el logo va centrado y ocupa más', () => {
    const conNombre = composicionOg({ ancho: 400, alto: 400 }, 'Tienda');
    const sinNombre = composicionOg({ ancho: 400, alto: 400 }, '');
    expect(sinNombre.nombre).toBeNull();
    expect(sinNombre.logo.w).toBeGreaterThan(conNombre.logo.w);
    expect(sinNombre.logo.y + sinNombre.logo.h / 2).toBeCloseTo(caja.alto / 2, 5);
  });

  it('un nombre en blanco cuenta como sin nombre', () => {
    for (const n of ['', '   ', null, undefined]) {
      expect(composicionOg({ ancho: 400, alto: 400 }, n).nombre).toBeNull();
    }
  });

  it('el logo nunca se sale del lienzo', () => {
    for (const logo of [{ ancho: 2000, alto: 300 }, { ancho: 300, alto: 2000 }, { ancho: 40, alto: 40 }]) {
      for (const nombre of ['Tienda', '']) {
        const c = composicionOg(logo, nombre);
        expect(c.logo.x).toBeGreaterThanOrEqual(-1e-9);
        expect(c.logo.y).toBeGreaterThanOrEqual(-1e-9);
        expect(c.logo.x + c.logo.w).toBeLessThanOrEqual(caja.ancho + 1e-9);
        expect(c.logo.y + c.logo.h).toBeLessThanOrEqual(caja.alto + 1e-9);
      }
    }
  });
});

describe('MEDIDAS', () => {
  // index.html declara og:image:width/height y og:image:type. Si estas medidas dejan de coincidir,
  // la vista previa queda descuadrada y ningun error lo delata.
  it('la de compartir mide lo que declara index.html, y es JPEG', () => {
    expect(MEDIDAS.ogImage.ancho).toBe(1200);
    expect(MEDIDAS.ogImage.alto).toBe(630);
    expect(MEDIDAS.ogImage.tipo).toBe('image/jpeg');
  });

  it('los iconos son PNG y cuadrados, con los tamaños que pide el manifiesto', () => {
    expect(MEDIDAS.icon192).toMatchObject({ ancho: 192, alto: 192, tipo: 'image/png' });
    expect(MEDIDAS.icon512).toMatchObject({ ancho: 512, alto: 512, tipo: 'image/png' });
    expect(MEDIDAS.iconMaskable).toMatchObject({ ancho: 512, alto: 512, tipo: 'image/png' });
  });

  // Android recorta el recortable a un circulo: tiene que ocupar menos que los otros.
  it('el recortable ocupa menos que los iconos normales', () => {
    expect(OCUPACION.iconMaskable).toBeLessThan(OCUPACION.icon512);
  });

  it('CAMPOS_DE_MARCA cubre exactamente lo que se deriva', () => {
    expect([...CAMPOS_DE_MARCA].sort()).toEqual(Object.keys(MEDIDAS).sort());
  });
});
