import { describe, it, expect } from 'vitest';
import { construirManifiesto, NOMBRE_POR_DEFECTO, ICONOS_POR_DEFECTO } from './manifiesto.cjs';

const MARCA_COMPLETA = {
  icon192: 'https://blob.example.com/marca/i192.png',
  icon512: 'https://blob.example.com/marca/i512.png',
  iconMaskable: 'https://blob.example.com/marca/imask.png',
};

describe('construirManifiesto', () => {
  // Lo que justifica el cambio: el dueño escribe su nombre en Ajustes y la aplicacion instalada
  // se llama asi, sin tocar codigo ni desplegar.
  it('el nombre sale de Ajustes', () => {
    const m = construirManifiesto({ storeName: 'Repuestos La Romana' });
    expect(m.name).toBe('Repuestos La Romana — Catálogo');
    expect(m.description).toContain('Repuestos La Romana');
  });

  // Una tienda recien instalada no tiene nombre todavia. Antes heredaba "Synaptic Tech".
  it('una tienda sin nombre no hereda el de nadie', () => {
    for (const settings of [{}, undefined, null, { storeName: '' }, { storeName: '   ' }]) {
      const m = construirManifiesto(settings);
      expect(m.name).toBe(NOMBRE_POR_DEFECTO);
      expect(JSON.stringify(m)).not.toContain('Synaptic');
    }
  });

  // El sufijo " — Catálogo" sobre el nombre de respaldo daba "Catálogo — Catálogo", y la
  // descripción "Catálogo de Catálogo".
  it('sin nombre no se repite la palabra Catálogo', () => {
    const m = construirManifiesto({});
    expect(m.name).toBe('Catálogo');
    expect(m.description).toBe('Mira los productos y haz tu pedido por WhatsApp.');
    expect(m.description).not.toContain('Catálogo de Catálogo');
  });

  it('con lema pero sin nombre, el lema se sostiene solo', () => {
    expect(construirManifiesto({ tagline: 'Todo para tu moto' }).description).toBe('Todo para tu moto');
  });

  it('el lema de Ajustes se usa como descripción', () => {
    const m = construirManifiesto({ storeName: 'Tienda', tagline: 'Todo para tu moto' });
    expect(m.description).toBe('Tienda: Todo para tu moto');
  });

  it('sin lema, una descripción que se sostiene sola', () => {
    const m = construirManifiesto({ storeName: 'Tienda' });
    expect(m.description).toBe('Catálogo de Tienda: mira los productos y haz tu pedido por WhatsApp.');
  });

  describe('short_name', () => {
    // Android recorta bajo el icono alrededor de los 12 caracteres.
    it('un nombre corto se usa tal cual', () => {
      expect(construirManifiesto({ storeName: 'Tienda Ana' }).short_name).toBe('Tienda Ana');
    });

    it('uno largo se queda con la primera palabra', () => {
      expect(construirManifiesto({ storeName: 'Repuestos La Romana' }).short_name).toBe('Repuestos');
    });

    it('si la primera palabra tampoco cabe, se corta', () => {
      expect(construirManifiesto({ storeName: 'Electrodomésticos del Este' }).short_name).toBe('Electrodomés');
    });

    it('nunca pasa de 12 caracteres', () => {
      for (const n of ['Tienda Ana', 'Repuestos La Romana', 'Electrodomésticos del Este', 'Supercalifragilistico']) {
        expect(construirManifiesto({ storeName: n }).short_name.length).toBeLessThanOrEqual(12);
      }
    });
  });

  describe('iconos', () => {
    it('sin logo propio, los del repositorio', () => {
      expect(construirManifiesto({ storeName: 'Tienda' }).icons).toEqual(ICONOS_POR_DEFECTO);
    });

    it('con el juego completo derivado del logo, esos', () => {
      const m = construirManifiesto({ storeName: 'Tienda', marca: MARCA_COMPLETA });
      expect(m.icons.map((i) => i.src)).toEqual([MARCA_COMPLETA.icon192, MARCA_COMPLETA.icon512, MARCA_COMPLETA.iconMaskable]);
      expect(m.icons.find((i) => i.purpose === 'maskable').src).toBe(MARCA_COMPLETA.iconMaskable);
    });

    // Mezclar el de un cliente con el de Synaptic es peor que usar uno de los dos entero: Android
    // elige por tamaño y el icono cambiaria segun el telefono.
    it('un juego incompleto se descarta entero', () => {
      const m = construirManifiesto({ marca: { icon192: MARCA_COMPLETA.icon192 } });
      expect(m.icons).toEqual(ICONOS_POR_DEFECTO);
    });

    it('descarta lo que no es una URL que el navegador pueda pedir', () => {
      for (const malo of ['data:image/png;base64,AAA', 'javascript:alert(1)', 'icono.png', '//otro.com/i.png', '']) {
        const m = construirManifiesto({ marca: { ...MARCA_COMPLETA, icon512: malo } });
        expect(m.icons).toEqual(ICONOS_POR_DEFECTO);
      }
    });

    it('acepta una ruta del propio sitio', () => {
      const m = construirManifiesto({ marca: { icon192: '/a.png', icon512: '/b.png', iconMaskable: '/c.png' } });
      expect(m.icons.map((i) => i.src)).toEqual(['/a.png', '/b.png', '/c.png']);
    });
  });

  // Campos que Chrome exige para ofrecer "Instalar aplicacion". Si se cae uno, la tienda deja de
  // ser instalable y no hay ningun error visible que lo delate.
  it('mantiene lo que Chrome exige para poder instalar', () => {
    const m = construirManifiesto({ storeName: 'Tienda' });
    expect(m.start_url).toBe('/');
    expect(m.scope).toBe('/');
    expect(m.display).toBe('standalone');
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.icons.length).toBeGreaterThanOrEqual(2);
    expect(m.icons.some((i) => i.sizes === '512x512')).toBe(true);
  });

  it('es serializable y no arrastra campos raros', () => {
    const m = construirManifiesto({ storeName: 'Tienda', marca: MARCA_COMPLETA });
    expect(() => JSON.stringify(m)).not.toThrow();
    expect(Object.keys(m).sort()).toEqual([
      'background_color', 'description', 'dir', 'display', 'icons', 'lang',
      'name', 'orientation', 'scope', 'short_name', 'start_url', 'theme_color',
    ]);
  });

  it('recorta nombres absurdamente largos', () => {
    const m = construirManifiesto({ storeName: 'A'.repeat(500) });
    expect(m.name.length).toBeLessThan(80);
  });
});
