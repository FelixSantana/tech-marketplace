import { describe, it, expect } from 'vitest';
import { ajustesDeEnvio, costoDeEnvio, faltaParaPedir } from './envio';

const zonas = [{ id: 'z1', nombre: 'Santo Domingo', precio: 250 }, { id: 'z2', nombre: 'Santiago', precio: 400 }];
const conEnvio = (extra = {}) => ({ envio: { activo: true, zonas, retiroEnTienda: true, direccionTienda: 'Av. Churchill 45', pedidoMinimo: 0, ...extra } });
const direccionValida = 'Calle Primera #12, Los Prados';

describe('costoDeEnvio', () => {
  it('cobra el precio de la zona a domicilio', () => expect(costoDeEnvio(conEnvio(), 'domicilio', 'z2')).toBe(400));
  it('no cobra en retiro', () => expect(costoDeEnvio(conEnvio(), 'retiro', 'z2')).toBe(0));
  it('no cobra con el envio apagado', () => expect(costoDeEnvio({}, 'domicilio', 'z2')).toBe(0));
  it('no cobra si la zona no existe', () => expect(costoDeEnvio(conEnvio(), 'domicilio', 'nada')).toBe(0));
});

describe('faltaParaPedir', () => {
  it('con el envio apagado no exige nada', () => expect(faltaParaPedir({}, {}, 0)).toBe(''));
  it('exige elegir domicilio o retiro', () => expect(faltaParaPedir(conEnvio(), {}, 5000)).toMatch(/domicilio o retiro/));
  it('exige elegir la zona', () => expect(faltaParaPedir(conEnvio(), { modo: 'domicilio' }, 5000)).toMatch(/zona/));
  it('exige la direccion, y avisa que lleve calle y numero', () => {
    expect(faltaParaPedir(conEnvio(), { modo: 'domicilio', zonaId: 'z1', direccion: 'casa' }, 5000)).toMatch(/calle y número/);
  });
  it('deja pasar un pedido a domicilio completo', () => {
    expect(faltaParaPedir(conEnvio(), { modo: 'domicilio', zonaId: 'z1', direccion: direccionValida }, 5000)).toBe('');
  });
  it('deja pasar el retiro sin pedir direccion', () => expect(faltaParaPedir(conEnvio(), { modo: 'retiro' }, 5000)).toBe(''));
  it('rechaza el retiro si la tienda no lo ofrece', () => {
    expect(faltaParaPedir(conEnvio({ retiroEnTienda: false }), { modo: 'retiro' }, 5000)).toMatch(/no ofrece retiro/);
  });
  it('avisa del pedido minimo antes que nada', () => {
    expect(faltaParaPedir(conEnvio({ pedidoMinimo: 1000 }), { modo: 'retiro' }, 999)).toMatch(/mínimo/);
  });
  it('avisa si el envio esta activo y no hay zonas', () => {
    expect(faltaParaPedir(conEnvio({ zonas: [] }), { modo: 'domicilio' }, 5000)).toMatch(/zonas de env/);
  });
});

describe('ajustesDeEnvio en el navegador', () => {
  it('coincide con el servidor: apagado por defecto', () => expect(ajustesDeEnvio({}).activo).toBe(false));
  it('normaliza precios invalidos a cero', () => {
    expect(ajustesDeEnvio({ envio: { activo: true, zonas: [{ id: 'z', nombre: 'Z', precio: 'abc' }] } }).zonas[0].precio).toBe(0);
  });
});
