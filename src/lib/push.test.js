import { describe, it, expect } from 'vitest';
import { clavePublicaEnBytes, porQueNoSePuede, aDatosPlanos, MOTIVOS } from './push';

describe('la clave pública que se le pasa al navegador', () => {
  it('deshace base64url: los dos caracteres cambiados y el relleno que falta', () => {
    // base64url usa - y _ donde base64 usa + y /, y suele venir sin los '=' del final. Con la
    // clave mal convertida, subscribe() falla con un error que no explica nada.
    const bytes = clavePublicaEnBytes('-_8');
    expect(Array.from(bytes)).toEqual([251, 255]);
  });

  it('una clave VAPID real da los 65 bytes de un punto sin comprimir', () => {
    // Una clave P-256 sin comprimir son 65 bytes y empieza por 0x04. Si saliera otra cosa, el
    // navegador la rechaza.
    const real = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
    const bytes = clavePublicaEnBytes(real);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });
});

describe('por qué no se puede activar', () => {
  const navegadorCompleto = { navigator: { serviceWorker: {} }, PushManager: function () {}, Notification: { permission: 'default' } };

  it('un navegador que no sabe de push', () => {
    expect(porQueNoSePuede({ listo: true, entorno: { navigator: {} } })).toBe(MOTIVOS.SIN_SOPORTE);
  });

  it('la tienda sin claves configuradas', () => {
    expect(porQueNoSePuede({ listo: false, entorno: navegadorCompleto })).toBe(MOTIVOS.SIN_CLAVES);
  });

  it('el dueño bloqueó los avisos', () => {
    const bloqueado = { ...navegadorCompleto, Notification: { permission: 'denied' } };
    expect(porQueNoSePuede({ listo: true, entorno: bloqueado })).toBe(MOTIVOS.BLOQUEADO);
  });

  it('todo en orden', () => {
    expect(porQueNoSePuede({ listo: true, entorno: navegadorCompleto })).toBe(MOTIVOS.LISTO);
  });

  it('la falta de soporte pesa más que la falta de claves', () => {
    // Decirle "faltan claves" a quien usa un navegador que no puede recibirlos lo manda a
    // tocar Vercel para nada.
    expect(porQueNoSePuede({ listo: false, entorno: { navigator: {} } })).toBe(MOTIVOS.SIN_SOPORTE);
  });
});

describe('la suscripción que se manda al servidor', () => {
  const plana = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'pub', auth: 'secreto' } };

  it('usa toJSON, que es lo que entrega el navegador', () => {
    expect(aDatosPlanos({ toJSON: () => plana })).toEqual(plana);
  });

  it('acepta también un objeto ya plano', () => {
    expect(aDatosPlanos(plana)).toEqual(plana);
  });

  it('devuelve null cuando no hay nada que mandar', () => {
    expect(aDatosPlanos(null)).toBe(null);
    expect(aDatosPlanos({ toJSON: () => ({}) })).toBe(null);
    expect(aDatosPlanos({ endpoint: 'https://x', keys: null })).toBe(null);
  });
});
