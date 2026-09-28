import { describe, it, expect } from 'vitest';
import { datosDelToken, tokenVencido, diasQueLeQuedan } from './token';

// Un token real del panel: <cuerpo base64url>.<firma>. Aqui la firma da igual, porque
// el navegador no la comprueba — solo lee la fecha para no arrastrar una sesion muerta.
const armar = (payload) => `${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.firmaquesea`;
const AHORA = Date.UTC(2026, 8, 28, 12, 0, 0);
const DIA = 86400000;

describe('datosDelToken', () => {
  it('lee el correo y la caducidad', () => {
    const d = datosDelToken(armar({ email: 'a@a.com', exp: AHORA + DIA }));
    expect(d.email).toBe('a@a.com');
    expect(d.exp).toBe(AHORA + DIA);
  });

  it('devuelve null con basura en vez de reventar', () => {
    for (const basura of ['', null, undefined, 'sinpunto', '.solofirma', 'no-base64.firma']) {
      expect(datosDelToken(basura)).toBe(null);
    }
  });
});

describe('tokenVencido', () => {
  it('el de ayer está vencido', () => {
    expect(tokenVencido(armar({ exp: AHORA - DIA }), AHORA)).toBe(true);
  });

  it('el de mañana no', () => {
    expect(tokenVencido(armar({ exp: AHORA + DIA }), AHORA)).toBe(false);
  });

  // El caso que hizo falta: el token que el dueño tenía guardado llevaba cuatro días muerto
  // y el panel seguía abriéndose como si nada.
  it('reconoce el token real que ya había caducado', () => {
    const exp = 1790273586377; // 2026-09-24T18:13:06Z
    expect(tokenVencido(armar({ email: 'x@y.com', exp }), Date.UTC(2026, 8, 28))).toBe(true);
  });

  it('un token ilegible se deja pasar: que decida el servidor, no el navegador', () => {
    expect(tokenVencido('no-se-puede-leer', AHORA)).toBe(false);
    expect(tokenVencido(armar({ email: 'sin-exp@a.com' }), AHORA)).toBe(false);
  });
});

describe('diasQueLeQuedan', () => {
  it('cuenta los días hacia arriba', () => {
    expect(diasQueLeQuedan(armar({ exp: AHORA + DIA * 6.2 }), AHORA)).toBe(7);
    expect(diasQueLeQuedan(armar({ exp: AHORA + DIA * 0.5 }), AHORA)).toBe(1);
  });

  it('nunca baja de cero', () => {
    expect(diasQueLeQuedan(armar({ exp: AHORA - DIA * 30 }), AHORA)).toBe(0);
  });

  it('sin fecha legible no inventa un número', () => {
    expect(diasQueLeQuedan('cualquier-cosa', AHORA)).toBe(null);
  });
});
