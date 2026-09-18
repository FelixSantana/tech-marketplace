import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { FALLOS_ANTES_DE_BLOQUEAR, OLVIDO_MS, esperaRestante, registrarFallo, limpiar, mensajeDeEspera } = require('./login-rate.cjs');

const T = 1_700_000_000_000;
const fallarVeces = (n, ahora = T) => { let e = limpiar(); for (let i = 0; i < n; i++) e = registrarFallo(e, ahora); return e; };

describe('esperaRestante', () => {
  it('sin estado previo se puede intentar', () => {
    expect(esperaRestante(undefined, T)).toBe(0);
    expect(esperaRestante(limpiar(), T)).toBe(0);
  });

  it('los primeros fallos no bloquean a quien se equivoca de verdad', () => {
    for (let n = 1; n < FALLOS_ANTES_DE_BLOQUEAR; n++) {
      expect(esperaRestante(fallarVeces(n), T)).toBe(0);
    }
  });

  it('al llegar al limite bloquea un minuto', () => {
    expect(esperaRestante(fallarVeces(FALLOS_ANTES_DE_BLOQUEAR), T)).toBe(60_000);
  });

  it('cada fallo adicional sube el escalon', () => {
    expect(esperaRestante(fallarVeces(6), T)).toBe(5 * 60_000);
    expect(esperaRestante(fallarVeces(7), T)).toBe(15 * 60_000);
    expect(esperaRestante(fallarVeces(8), T)).toBe(60 * 60_000);
  });

  it('el escalon no crece sin limite', () => {
    expect(esperaRestante(fallarVeces(50), T)).toBe(60 * 60_000);
  });

  it('la espera se acaba cuando pasa el tiempo', () => {
    const e = fallarVeces(FALLOS_ANTES_DE_BLOQUEAR);
    expect(esperaRestante(e, T + 59_000)).toBeGreaterThan(0);
    expect(esperaRestante(e, T + 61_000)).toBe(0);
  });

  it('tras una hora sin fallos se empieza de cero', () => {
    const e = fallarVeces(8);
    expect(esperaRestante(e, T + OLVIDO_MS + 1000)).toBe(0);
    expect(registrarFallo(e, T + OLVIDO_MS + 1000).fallos).toBe(1);
  });

  it('tolera un estado corrupto', () => {
    expect(esperaRestante({ fallos: 'x', hasta: -5 }, T)).toBe(0);
  });
});

describe('limpiar', () => {
  it('un inicio de sesion correcto borra la cuenta de fallos', () => {
    expect(esperaRestante(limpiar(), T)).toBe(0);
  });
});

describe('mensajeDeEspera', () => {
  it('redondea hacia arriba y usa singular en el primer minuto', () => {
    expect(mensajeDeEspera(30_000)).toMatch(/un minuto/);
    expect(mensajeDeEspera(60_000)).toMatch(/un minuto/);
    expect(mensajeDeEspera(61_000)).toMatch(/2 minutos/);
    expect(mensajeDeEspera(15 * 60_000)).toMatch(/15 minutos/);
  });
});
