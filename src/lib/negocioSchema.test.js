import { describe, it, expect } from 'vitest';
import { negocioSchema, valeLaPenaPublicar } from './negocioSchema';

const COMPLETO = {
  storeName: 'Repuestos La Romana',
  tagline: 'Todo para tu moto',
  whatsapp: '18095551234',
  logo: 'https://blob.example.com/logo.jpg',
  negocio: {
    rnc: '1-31-12345-6',
    direccion: 'Av. Duarte 10, La Romana',
    horario: 'Lun a Sáb · 9:00 AM a 6:00 PM',
    correo: 'ventas@repuestos.com.do',
    cobertura: 'Entrega en todo el país',
    pagos: ['Efectivo', 'Transferencia'],
  },
};

describe('negocioSchema', () => {
  it('traduce lo que el dueño puso en Ajustes', () => {
    const s = negocioSchema(COMPLETO, 'https://tienda.com.do');
    expect(s['@type']).toBe('Store');
    expect(s.name).toBe('Repuestos La Romana');
    expect(s.telephone).toBe('+18095551234');
    expect(s.email).toBe('ventas@repuestos.com.do');
    expect(s.openingHours).toBe('Lun a Sáb · 9:00 AM a 6:00 PM');
    expect(s.taxID).toBe('1-31-12345-6');
    expect(s.address.streetAddress).toBe('Av. Duarte 10, La Romana');
    expect(s.address.addressCountry).toBe('DO');
    expect(s.url).toBe('https://tienda.com.do');
    expect(s.logo).toBe('https://blob.example.com/logo.jpg');
    expect(s.paymentAccepted).toBe('Efectivo, Transferencia');
  });

  // Lo mismo que hace negocio.js en el pie: un dato que no existe no se inventa. Y Google penaliza
  // los datos estructurados que no se corresponden con lo que se ve en la pagina.
  it('no publica los campos que están vacíos', () => {
    const s = negocioSchema({ storeName: 'Tienda', whatsapp: '18090000000' }, 'https://x.do');
    expect(s.name).toBe('Tienda');
    expect('taxID' in s).toBe(false);
    expect('email' in s).toBe(false);
    expect('openingHours' in s).toBe(false);
    expect(s.address.streetAddress).toBeUndefined();
  });

  it('descarta un logo incrustado, que no es una URL que Google pueda pedir', () => {
    const s = negocioSchema({ ...COMPLETO, logo: 'data:image/png;base64,AAA' }, 'https://x.do');
    expect('logo' in s).toBe(false);
    expect('image' in s).toBe(false);
  });

  it('el teléfono sale en formato internacional, sin signos', () => {
    const s = negocioSchema({ storeName: 'T', whatsapp: '+1 (809) 555-1234' }, 'https://x.do');
    expect(s.telephone).toBe('+18095551234');
  });

  it('no revienta con un catálogo recién instalado', () => {
    for (const vacio of [{}, null, undefined]) {
      expect(() => negocioSchema(vacio, 'https://x.do')).not.toThrow();
    }
  });

  // Acaba dentro de un <script> en el head: tiene que poder convertirse a texto.
  it('es serializable', () => {
    expect(() => JSON.stringify(negocioSchema(COMPLETO, 'https://x.do'))).not.toThrow();
  });
});

describe('valeLaPenaPublicar', () => {
  it('con nombre y alguna forma de contacto, sí', () => {
    expect(valeLaPenaPublicar(COMPLETO)).toBe(true);
    expect(valeLaPenaPublicar({ storeName: 'T', whatsapp: '18090000000' })).toBe(true);
    expect(valeLaPenaPublicar({ storeName: 'T', negocio: { direccion: 'Calle 1' } })).toBe(true);
  });

  // Un bloque vacio es peor que ninguno: Google lo lee como datos incompletos.
  it('una tienda recién instalada no publica nada', () => {
    for (const vacio of [{}, null, undefined, { storeName: 'T' }, { storeName: '', whatsapp: '18090000000' }]) {
      expect(valeLaPenaPublicar(vacio)).toBe(false);
    }
  });
});
