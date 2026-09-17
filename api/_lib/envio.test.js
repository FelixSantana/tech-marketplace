import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ajustesDeEnvio, resolverEntrega } = require('./envio.cjs');

const zonas = [{ id: 'z1', nombre: 'Santo Domingo', precio: 250 }, { id: 'z2', nombre: 'Santiago', precio: 400 }];
const conEnvio = (extra = {}) => ({ envio: { activo: true, zonas, retiroEnTienda: true, direccionTienda: 'Av. Siempre Viva 742', pedidoMinimo: 0, ...extra } });

describe('ajustesDeEnvio', () => {
  it('apagado por defecto cuando la tienda no lo configuro', () => {
    expect(ajustesDeEnvio({}).activo).toBe(false);
    expect(ajustesDeEnvio(undefined).activo).toBe(false);
  });
  it('descarta zonas sin id y normaliza el precio', () => {
    const cfg = ajustesDeEnvio({ envio: { activo: true, zonas: [{ nombre: 'sin id', precio: 1 }, { id: 'z1', nombre: 'Zona', precio: '250.567' }] } });
    expect(cfg.zonas).toEqual([{ id: 'z1', nombre: 'Zona', precio: 250.57 }]);
  });
  it('un precio negativo o invalido queda en cero', () => {
    const cfg = ajustesDeEnvio({ envio: { activo: true, zonas: [{ id: 'z1', nombre: 'Z', precio: -50 }] } });
    expect(cfg.zonas[0].precio).toBe(0);
  });
});

describe('resolverEntrega — tienda sin envio configurado', () => {
  it('se comporta como hasta ahora: la entrega se coordina por chat y no cuesta', () => {
    const r = resolverEntrega({}, {}, 5000);
    expect(r).toMatchObject({ modo: 'coordinado', costo: 0 });
  });
  it('no exige nada al cliente', () => {
    expect(() => resolverEntrega({}, {}, 0)).not.toThrow();
  });
});

describe('resolverEntrega — a domicilio', () => {
  it('cobra el precio de la zona elegida', () => {
    const r = resolverEntrega(conEnvio(), { entrega: 'domicilio', zonaId: 'z2', direccion: 'Calle 10 #5, Los Jardines' }, 5000);
    expect(r).toMatchObject({ modo: 'domicilio', zonaId: 'z2', zonaNombre: 'Santiago', costo: 400 });
  });

  it('ignora el costo que mande el navegador: manda la tabla de la tienda', () => {
    const r = resolverEntrega(conEnvio(), { entrega: 'domicilio', zonaId: 'z1', direccion: 'Calle 10 #5, Los Jardines', costo: 0, envio: 0 }, 5000);
    expect(r.costo).toBe(250);
  });

  it('rechaza una zona que no existe', () => {
    expect(() => resolverEntrega(conEnvio(), { entrega: 'domicilio', zonaId: 'inventada', direccion: 'Calle 10 #5, Los Jardines' }, 5000)).toThrow('INVALID_ZONE');
  });

  it('exige una direccion con algo de contenido', () => {
    expect(() => resolverEntrega(conEnvio(), { entrega: 'domicilio', zonaId: 'z1', direccion: 'casa' }, 5000)).toThrow('ADDRESS_REQUIRED');
    expect(() => resolverEntrega(conEnvio(), { entrega: 'domicilio', zonaId: 'z1' }, 5000)).toThrow('ADDRESS_REQUIRED');
  });

  it('avisa si el envio esta activo pero no hay zonas cargadas', () => {
    expect(() => resolverEntrega(conEnvio({ zonas: [] }), { entrega: 'domicilio', zonaId: 'z1', direccion: 'Calle 10 #5, Los Jardines' }, 5000)).toThrow('NO_ZONES_CONFIGURED');
  });
});

describe('resolverEntrega — retiro en tienda', () => {
  it('no cuesta y no pide direccion', () => {
    const r = resolverEntrega(conEnvio(), { entrega: 'retiro' }, 5000);
    expect(r).toMatchObject({ modo: 'retiro', costo: 0, direccion: '' });
  });
  it('se rechaza si la tienda no ofrece retiro', () => {
    expect(() => resolverEntrega(conEnvio({ retiroEnTienda: false }), { entrega: 'retiro' }, 5000)).toThrow('PICKUP_NOT_AVAILABLE');
  });
});

describe('resolverEntrega — exigencias generales', () => {
  it('con envio activo hay que elegir domicilio o retiro', () => {
    expect(() => resolverEntrega(conEnvio(), {}, 5000)).toThrow('DELIVERY_MODE_REQUIRED');
    expect(() => resolverEntrega(conEnvio(), { entrega: 'otra cosa' }, 5000)).toThrow('DELIVERY_MODE_REQUIRED');
  });

  it('respeta el pedido minimo, contra el subtotal de productos', () => {
    const cfg = conEnvio({ pedidoMinimo: 1000 });
    expect(() => resolverEntrega(cfg, { entrega: 'retiro' }, 999)).toThrow('BELOW_MIN_ORDER');
    expect(resolverEntrega(cfg, { entrega: 'retiro' }, 1000).modo).toBe('retiro');
  });
});
