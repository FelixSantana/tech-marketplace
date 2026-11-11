import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { rutaDeOrden } from '../../src/lib/avisoRuta.js';

const require = createRequire(import.meta.url);
const { configuracion, esSuscripcionValida, conSuscripcion, sinSuscripcion, estaMuerta, avisoDePedido, MAX_DISPOSITIVOS } = require('./push.cjs');

const SUB = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'clave-publica', auth: 'secreto' } };

describe('configuración VAPID', () => {
  it('sin las dos claves no está listo, y la tienda sigue funcionando igual', () => {
    expect(configuracion({}).listo).toBe(false);
    expect(configuracion({ VAPID_PUBLIC_KEY: 'pub' }).listo).toBe(false);
    expect(configuracion({ VAPID_PRIVATE_KEY: 'priv' }).listo).toBe(false);
  });

  it('con las dos está listo', () => {
    expect(configuracion({ VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' }).listo).toBe(true);
  });

  it('no inventa un contacto cuando no lo hay', () => {
    // El "sujeto" VAPID dice a quien reclamar. Poner el correo de otro seria peor que nada.
    expect(configuracion({}).contacto).toBe('');
  });
});

describe('suscripciones que llegan del navegador', () => {
  it('acepta una completa', () => {
    expect(esSuscripcionValida(SUB)).toBe(true);
  });

  it('rechaza lo que no sirve para enviar', () => {
    expect(esSuscripcionValida(null)).toBe(false);
    expect(esSuscripcionValida({})).toBe(false);
    expect(esSuscripcionValida({ ...SUB, endpoint: 'http://no-cifrado.com/x' })).toBe(false);
    expect(esSuscripcionValida({ ...SUB, endpoint: 'javascript:alert(1)' })).toBe(false);
    expect(esSuscripcionValida({ ...SUB, keys: { p256dh: 'a' } })).toBe(false);
    expect(esSuscripcionValida({ ...SUB, endpoint: `https://x.com/${'a'.repeat(1100)}` })).toBe(false);
  });

  it('guarda solo lo que hace falta para enviar', () => {
    const lista = conSuscripcion([], { ...SUB, loQueSea: 'esto no se guarda' });
    expect(Object.keys(lista[0]).sort()).toEqual(['creadaEn', 'endpoint', 'keys']);
  });

  it('el mismo teléfono re-suscrito se reemplaza, no se duplica', () => {
    // Si se duplicara, cada pedido llegaria dos veces al mismo telefono.
    const lista = conSuscripcion(conSuscripcion([], SUB), SUB);
    expect(lista).toHaveLength(1);
  });

  it('otro teléfono se añade', () => {
    const otro = { ...SUB, endpoint: 'https://fcm.googleapis.com/fcm/send/xyz' };
    expect(conSuscripcion(conSuscripcion([], SUB), otro)).toHaveLength(2);
  });

  it('pone un tope de dispositivos', () => {
    let lista = [];
    for (let i = 0; i < MAX_DISPOSITIVOS + 5; i++) lista = conSuscripcion(lista, { ...SUB, endpoint: `https://fcm.googleapis.com/fcm/send/${i}` });
    expect(lista).toHaveLength(MAX_DISPOSITIVOS);
  });

  it('darse de baja quita solo ese dispositivo', () => {
    const otro = { ...SUB, endpoint: 'https://fcm.googleapis.com/fcm/send/xyz' };
    const lista = conSuscripcion(conSuscripcion([], SUB), otro);
    const quedan = sinSuscripcion(lista, otro.endpoint);
    expect(quedan).toHaveLength(1);
    expect(quedan[0].endpoint).toBe(SUB.endpoint);
  });

  it('aguanta una lista corrupta sin reventar', () => {
    expect(sinSuscripcion(null, 'x')).toEqual([]);
    expect(conSuscripcion('no soy una lista', SUB)).toHaveLength(1);
  });
});

describe('suscripciones muertas', () => {
  it('404 y 410 significan que ya no existe', () => {
    expect(estaMuerta(404)).toBe(true);
    expect(estaMuerta(410)).toBe(true);
  });

  it('un error pasajero no la mata', () => {
    // Borrarla con un 500 o un 429 dejaria al dueño sin avisos por una caida de diez minutos.
    expect(estaMuerta(500)).toBe(false);
    expect(estaMuerta(429)).toBe(false);
    expect(estaMuerta(undefined)).toBe(false);
  });
});

describe('el texto del aviso', () => {
  const pedido = {
    id: 'ord_1',
    customerName: 'Jose',
    total: 500,
    products: [{ name: 'Mantenimiento de CPU de escritorio', quantity: 1 }],
  };

  it('dice cuánto y de quién', () => {
    const a = avisoDePedido(pedido, { currency: 'RD$' });
    expect(a.title).toBe('Pedido nuevo · RD$ 500');
    expect(a.body).toBe('Jose — Mantenimiento de CPU de escritorio');
  });

  it('resume cuando hay varios productos', () => {
    const a = avisoDePedido({ ...pedido, products: [{ name: 'Teclado', quantity: 1 }, { name: 'Mouse', quantity: 1 }, { name: 'Monitor', quantity: 1 }] }, {});
    expect(a.body).toBe('Jose — Teclado y 2 más');
  });

  it('lleva al pedido concreto, no al panel a secas', () => {
    expect(avisoDePedido(pedido, {}).url).toBe('/admin?orden=ord_1');
  });

  it('construye la dirección igual que el navegador', () => {
    // La regla vive en dos sitios porque esto corre en el servidor y avisoRuta.js en el
    // navegador. Si se separan, el aviso llevaria a una direccion que el panel no entiende.
    for (const id of ['ord_1794424738526_o36fme', 'ord_1', '', 'con espacio', '../otra']) {
      expect(avisoDePedido({ ...pedido, id }, {}).url).toBe(rutaDeOrden(id));
    }
  });

  it('cada pedido trae su etiqueta, para que dos seguidos no se tapen', () => {
    const a = avisoDePedido(pedido, {});
    const b = avisoDePedido({ ...pedido, id: 'ord_2' }, {});
    expect(a.tag).not.toBe(b.tag);
  });

  it('no se rompe con un pedido a medias', () => {
    const a = avisoDePedido({}, {});
    expect(a.title).toBe('Pedido nuevo');
    expect(a.body).toBe('Alguien — 1 artículo');
  });

  it('no deja colar texto raro como moneda', () => {
    // settings lo edita el dueño y acaba en la pantalla de bloqueo del telefono.
    const a = avisoDePedido(pedido, { currency: '<script>alert(1)</script>' });
    expect(a.title).toBe('Pedido nuevo · RD$ 500');
  });

  it('usa la moneda de la tienda cuando es una moneda', () => {
    expect(avisoDePedido(pedido, { currency: 'US$' }).title).toBe('Pedido nuevo · US$ 500');
  });
});
