import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

// kv.cjs lee la configuracion al cargarse, no al llamarse, asi que las variables tienen que
// estar puestas ANTES del require. Son de mentira: ninguna peticion sale de aqui, el fetch
// global esta sustituido mas abajo.
process.env.KV_REST_API_URL = 'https://kv-de-prueba.local';
process.env.KV_REST_API_TOKEN = 'token-de-prueba';

const require = createRequire(import.meta.url);
const handler = require('./auth-handler.cjs');

const ADMIN = {
  email: 'dueno@tienda.com',
  salt: 'sal',
  hash: 'resumen',
  secret: 'secreto',
};

// Responde como responderia Upstash: { result: "<json como texto>" }.
function kvFalso(registro) {
  return vi.fn(async (url) => ({
    ok: true,
    json: async () => ({ result: registro === null ? null : JSON.stringify(registro) }),
    _url: String(url),
  }));
}

function peticion(body) {
  return { method: 'POST', body, headers: {}, socket: { remoteAddress: '1.2.3.4' } };
}

function respuesta() {
  const r = {
    codigo: 0,
    cuerpo: null,
    cabeceras: {},
    setHeader(k, v) { r.cabeceras[k] = v; },
    status(c) { r.codigo = c; return r; },
    json(o) { r.cuerpo = o; return r; },
    end() { return r; },
  };
  return r;
}

const fetchOriginal = global.fetch;
afterEach(() => { global.fetch = fetchOriginal; });

describe('auth: la accion "status"', () => {
  // Es la unica accion que cualquiera puede llamar sin haber iniciado sesion: la portada la
  // usa al cargar para saber si ofrecer "crear cuenta" o "entrar". Lo que conteste aqui lo
  // puede leer cualquiera con una linea de curl.
  beforeEach(() => { global.fetch = kvFalso(ADMIN); });

  it('NO devuelve el correo del administrador', async () => {
    // Era la mitad de las credenciales regalada: quien quisiera forzar la entrada ya no
    // tendria que adivinar el usuario, solo la contraseña.
    const res = respuesta();
    await handler(peticion({ action: 'status' }), res);

    expect(res.codigo).toBe(200);
    expect(res.cuerpo).not.toHaveProperty('email');
    expect(JSON.stringify(res.cuerpo)).not.toContain(ADMIN.email);
  });

  it('dice que la tienda ya tiene cuenta', async () => {
    const res = respuesta();
    await handler(peticion({ action: 'status' }), res);
    expect(res.cuerpo).toEqual({ ok: true, configured: true });
  });

  it('dice que no la tiene cuando no hay ningun administrador', async () => {
    global.fetch = kvFalso(null);
    const res = respuesta();
    await handler(peticion({ action: 'status' }), res);
    expect(res.cuerpo).toEqual({ ok: true, configured: false });
  });
});
