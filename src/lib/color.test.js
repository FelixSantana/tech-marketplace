import { describe, it, expect } from 'vitest';
import {
  normalizarColor, colorDeMarca, luminancia, contraste, tintaSobre,
  variablesDeMarca, VARIABLES, COLOR_POR_DEFECTO, TINTA_CLARA, TINTA_OSCURA,
} from './color';

describe('normalizarColor', () => {
  it('acepta las formas en que la gente escribe un color', () => {
    expect(normalizarColor('#6D4BFF')).toBe('#6d4bff');
    expect(normalizarColor('6d4bff')).toBe('#6d4bff');
    expect(normalizarColor('  #6d4bff  ')).toBe('#6d4bff');
  });

  it('expande la forma corta', () => {
    expect(normalizarColor('#abc')).toBe('#aabbcc');
    expect(normalizarColor('f00')).toBe('#ff0000');
  });

  // Lo que no se entiende no se aplica: mejor que la tienda siga con su color de siempre a que se
  // quede sin ninguno.
  it('descarta lo que no es un color usable', () => {
    for (const malo of ['', '   ', 'azul', '#12345', '#1234567', 'rgb(1,2,3)', '#gggggg', null, undefined, 42, {}]) {
      expect(normalizarColor(malo)).toBe('');
    }
  });
});

describe('colorDeMarca', () => {
  it('sale de Ajustes', () => {
    expect(colorDeMarca({ colorMarca: '#ff6600' })).toBe('#ff6600');
  });

  it('una tienda que nunca lo tocó no tiene color propio', () => {
    for (const s of [{}, null, undefined, { colorMarca: '' }, { colorMarca: 'morado' }]) {
      expect(colorDeMarca(s)).toBe('');
    }
  });
});

describe('luminancia', () => {
  it('el blanco y el negro son los extremos', () => {
    expect(luminancia('#ffffff')).toBeCloseTo(1, 5);
    expect(luminancia('#000000')).toBeCloseTo(0, 5);
  });

  // No es el promedio de los canales: el ojo ve el verde mucho mas claro que el azul.
  it('el verde pesa mucho más que el azul', () => {
    expect(luminancia('#00ff00')).toBeGreaterThan(luminancia('#0000ff'));
    expect(luminancia('#00ff00')).toBeGreaterThan(0.7);
    expect(luminancia('#0000ff')).toBeLessThan(0.1);
  });
});

describe('contraste', () => {
  it('blanco contra negro es el máximo de 21', () => {
    expect(contraste('#ffffff', '#000000')).toBeCloseTo(21, 1);
  });

  it('un color contra sí mismo es 1', () => {
    expect(contraste('#6d4bff', '#6d4bff')).toBeCloseTo(1, 5);
  });

  it('da igual el orden', () => {
    expect(contraste('#ffffff', '#6d4bff')).toBeCloseTo(contraste('#6d4bff', '#ffffff'), 10);
  });
});

describe('tintaSobre', () => {
  // El caso que justifica toda esta funcion: con el blanco fijo que habia antes, un color de marca
  // claro dejaba el boton de pedir blanco sobre blanco.
  it('sobre un color claro escribe oscuro', () => {
    for (const claro of ['#ffe600', '#7bed9f', '#ffffff', '#f5d76e', '#00ff00']) {
      expect(tintaSobre(claro)).toBe(TINTA_OSCURA);
    }
  });

  it('sobre un color oscuro escribe blanco', () => {
    for (const oscuro of ['#6d4bff', '#000000', '#1e3a8a', '#7a1f1f', COLOR_POR_DEFECTO]) {
      expect(tintaSobre(oscuro)).toBe(TINTA_CLARA);
    }
  });

  // Que elija la mejor de las dos no basta si la mejor tampoco vale. Esto deja constancia de que
  // el minimo legible de WCAG para texto grande se cumple en toda la rueda de colores.
  it('la tinta elegida siempre llega al mínimo legible', () => {
    for (let h = 0; h < 360; h += 15) {
      for (const [s, l] of [[100, 50], [60, 35], [40, 75], [100, 25], [20, 90]]) {
        const fondo = hsl(h, s, l);
        expect(contraste(fondo, tintaSobre(fondo))).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe('variablesDeMarca', () => {
  it('da las dos propiedades, coherentes entre sí', () => {
    const v = variablesDeMarca({ colorMarca: '#ff6600' });
    expect(v['--accent']).toBe('#ff6600');
    expect(v['--accent-ink']).toBe(tintaSobre('#ff6600'));
  });

  // Devolver null es lo que permite que borrar el color en Ajustes restaure el de la plantilla:
  // el llamador quita las propiedades y vuelve a mandar el CSS.
  it('sin color devuelve null, para poder quitarlas', () => {
    expect(variablesDeMarca({})).toBeNull();
    expect(variablesDeMarca({ colorMarca: 'no es un color' })).toBeNull();
  });
});

// Un color HSL a hexadecimal, solo para generar casos de prueba repartidos por toda la rueda.
function hsl(h, s, l) {
  const S = s / 100;
  const L = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const dos = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${dos(f(0))}${dos(f(8))}${dos(f(4))}`;
}

describe('tonos derivados del color de marca', () => {
  // La prueba que ata el codigo al diseño: con el morado de la plantilla, los tonos derivados
  // tienen que parecerse a los que estaban escritos a mano en skin.css. Si alguien cambia las
  // luces y la barra deja de parecerse a #221a4d, esto lo dice.
  it('con el morado de siempre reproduce los tonos de la plantilla', () => {
    const v = variablesDeMarca({ colorMarca: COLOR_POR_DEFECTO });
    expect(contraste(v['--barra'], '#221a4d')).toBeLessThan(1.35);
    expect(contraste(v['--barra-alta'], '#2e2466')).toBeLessThan(1.35);
    expect(contraste(v['--barra-ink'], '#cfc8ee')).toBeLessThan(1.35);
  });

  it('la barra es oscura y su tinta clara, sea cual sea el color', () => {
    for (const color of ['#ffe600', '#ff6600', '#00a3ff', '#1a7f37', '#000000', '#ffffff', '#888888']) {
      const v = variablesDeMarca({ colorMarca: color });
      expect(luminancia(v['--barra'])).toBeLessThan(0.25);
      expect(luminancia(v['--barra-ink'])).toBeGreaterThan(0.45);
      // Lo unico que de verdad importa: que el texto de la barra se lea encima de la barra.
      expect(contraste(v['--barra'], v['--barra-ink'])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('la variante alta es más clara que la barra, para el hover', () => {
    for (const color of ['#ffe600', '#6d4bff', '#1a7f37']) {
      const v = variablesDeMarca({ colorMarca: color });
      expect(luminancia(v['--barra-alta'])).toBeGreaterThan(luminancia(v['--barra']));
    }
  });

  it('el precio se lee sobre el fondo claro de la tienda', () => {
    for (const color of ['#ffe600', '#ff6600', '#00a3ff']) {
      const v = variablesDeMarca({ colorMarca: color });
      expect(contraste(v['--precio'], '#ffffff')).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('VARIABLES nombra exactamente lo que se devuelve', () => {
    expect([...VARIABLES].sort()).toEqual(Object.keys(variablesDeMarca({ colorMarca: '#123456' })).sort());
  });
});
