import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { signToken, verifyToken, hashPassword, extractBearer } = require('./auth.cjs');

const SECRETO = 'secreto-de-prueba';
const enUnMinuto = () => Date.now() + 60000;

describe('tokens de sesión', () => {
  it('un token recién firmado verifica y trae el correo', () => {
    const t = signToken({ email: 'a@a.com', exp: enUnMinuto() }, SECRETO);
    expect(verifyToken(t, SECRETO).email).toBe('a@a.com');
  });

  it('un token vencido no vale', () => {
    const t = signToken({ email: 'a@a.com', exp: Date.now() - 1 }, SECRETO);
    expect(verifyToken(t, SECRETO)).toBe(null);
  });

  it('un token manipulado no vale', () => {
    const t = signToken({ email: 'a@a.com', exp: enUnMinuto() }, SECRETO);
    const [cuerpo, firma] = t.split('.');
    const otroCuerpo = Buffer.from(JSON.stringify({ email: 'otro@a.com', exp: enUnMinuto() })).toString('base64url');
    expect(verifyToken(`${otroCuerpo}.${firma}`, SECRETO)).toBe(null);
    expect(verifyToken(`${cuerpo}.firmafalsa`, SECRETO)).toBe(null);
  });

  it('basura no tumba la verificación', () => {
    for (const basura of ['', 'sin-punto', 'a.b.c', null, undefined]) {
      expect(verifyToken(basura, SECRETO)).toBe(null);
    }
  });
});

// El secreto con el que se firman los tokens vive junto a las credenciales, y cambiar la
// contraseña lo rota (ver auth-handler). Esto comprueba lo que esa rotacion garantiza: un
// token filtrado deja de entrar en cuanto el dueño cambia la contraseña. Sin rotar, cambiarla
// da una sensacion de seguridad que no es cierta, porque el token viejo sigue valiendo hasta
// que caduca solo.
describe('rotar el secreto echa a las sesiones abiertas', () => {
  it('un token firmado con el secreto viejo ya no verifica', () => {
    const token = signToken({ email: 'a@a.com', exp: enUnMinuto() }, 'secreto-de-antes');
    expect(verifyToken(token, 'secreto-de-antes')).toBeTruthy();
    expect(verifyToken(token, 'secreto-de-despues')).toBe(null);
  });

  it('el token nuevo, firmado con el secreto nuevo, entra sin problema', () => {
    const token = signToken({ email: 'a@a.com', exp: enUnMinuto() }, 'secreto-de-despues');
    expect(verifyToken(token, 'secreto-de-despues')).toBeTruthy();
  });
});

describe('contraseñas', () => {
  it('la misma contraseña con distinta sal da distinto hash', () => {
    expect(hashPassword('secreta123', 'sal-a')).not.toBe(hashPassword('secreta123', 'sal-b'));
  });

  it('el hash es estable para la misma sal', () => {
    expect(hashPassword('secreta123', 'sal-a')).toBe(hashPassword('secreta123', 'sal-a'));
  });
});

describe('extractBearer', () => {
  it('saca el token de la cabecera', () => {
    expect(extractBearer({ headers: { authorization: 'Bearer abc.def' } })).toBe('abc.def');
  });

  it('sin cabecera devuelve vacío en vez de reventar', () => {
    expect(extractBearer({ headers: {} })).toBeFalsy();
    expect(extractBearer({})).toBeFalsy();
  });
});
