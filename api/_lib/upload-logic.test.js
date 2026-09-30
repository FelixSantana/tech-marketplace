import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseDataUrl, buildPathname, blobConfigured, blobToken, opcionesDeAlmacen, MAX_BYTES } = require('./upload-logic.cjs');

const dataUrl = (mime, bytes) => `data:${mime};base64,${Buffer.alloc(bytes, 7).toString('base64')}`;

describe('parseDataUrl', () => {
  it('acepta jpeg, png y webp', () => {
    for (const [mime, ext] of [['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]) {
      expect(parseDataUrl(dataUrl(mime, 64)).ext).toBe(ext);
    }
  });

  it('devuelve los bytes decodificados, no la cadena', () => {
    const { buffer } = parseDataUrl(dataUrl('image/jpeg', 100));
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBe(100);
  });

  it('rechaza un formato no permitido', () => {
    expect(() => parseDataUrl(dataUrl('image/gif', 64))).toThrow('UNSUPPORTED_IMAGE_TYPE');
    expect(() => parseDataUrl(dataUrl('application/pdf', 64))).toThrow('UNSUPPORTED_IMAGE_TYPE');
  });

  it('rechaza lo que no es un data URL', () => {
    for (const malo of ['https://ejemplo.com/foto.jpg', '', null, undefined, 42, 'data:image/jpeg,sinbase64']) {
      expect(() => parseDataUrl(malo)).toThrow(/INVALID_IMAGE|UNSUPPORTED_IMAGE_TYPE/);
    }
  });

  it('rechaza una imagen vacia', () => {
    expect(() => parseDataUrl('data:image/jpeg;base64,')).toThrow('INVALID_IMAGE');
  });

  it('rechaza una imagen por encima del tope', () => {
    expect(() => parseDataUrl(dataUrl('image/jpeg', MAX_BYTES + 1))).toThrow('IMAGE_TOO_LARGE');
  });

  it('acepta una imagen justo en el tope', () => {
    expect(parseDataUrl(dataUrl('image/jpeg', MAX_BYTES)).buffer.length).toBe(MAX_BYTES);
  });
});

describe('buildPathname', () => {
  it('usa la carpeta y la extension', () => {
    expect(buildPathname('jpg')).toMatch(/^productos\/[a-z0-9_]+\.jpg$/);
    expect(buildPathname('png', 'logo')).toMatch(/^logo\/[a-z0-9_]+\.png$/);
  });

  it('nunca repite nombre, para no pisar una foto en uso', () => {
    const nombres = new Set(Array.from({ length: 500 }, () => buildPathname('jpg')));
    expect(nombres.size).toBe(500);
  });
});

describe('blobConfigured', () => {
  it('es falso sin token, que es lo que deja al panel volver a incrustar la foto', () => {
    expect(blobConfigured({})).toBe(false);
    expect(blobConfigured({ BLOB_READ_WRITE_TOKEN: '' })).toBe(false);
  });
  it('es verdadero con token', () => {
    expect(blobConfigured({ BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_xxx' })).toBe(true);
  });
});

// Vercel deja elegir el prefijo de la variable al conectar el almacen. Buscar solo el nombre por
// defecto dejaba la tienda diciendo "no esta configurado" con el almacen ya creado.
describe('de que variable sale el token del almacen', () => {
  it('usa la estandar de Vercel', () => {
    expect(blobToken({ BLOB_READ_WRITE_TOKEN: 'abc' })).toBe('abc');
    expect(blobConfigured({ BLOB_READ_WRITE_TOKEN: 'abc' })).toBe(true);
  });

  it('acepta un almacen con prefijo propio', () => {
    expect(blobToken({ SYNAPTIC_FOTOS_READ_WRITE_TOKEN: 'xyz' })).toBe('xyz');
    expect(blobConfigured({ SYNAPTIC_FOTOS_READ_WRITE_TOKEN: 'xyz' })).toBe(true);
  });

  it('con las dos, manda la estandar', () => {
    expect(blobToken({ OTRO_READ_WRITE_TOKEN: 'b', BLOB_READ_WRITE_TOKEN: 'a' })).toBe('a');
  });

  it('sin ninguna, la tienda sigue funcionando con las fotos dentro del catalogo', () => {
    expect(blobConfigured({})).toBe(false);
    expect(blobToken({})).toBe('');
  });

  it('una variable vacia no cuenta como configurada', () => {
    expect(blobConfigured({ BLOB_READ_WRITE_TOKEN: '' })).toBe(false);
    expect(blobConfigured({ ALGO_READ_WRITE_TOKEN: '' })).toBe(false);
  });
});

// Vercel ya no inyecta un token de lectura-escritura al conectar un almacen: usa OIDC, con
// BLOB_STORE_ID y la identidad del despliegue. La tienda decia "no hay almacenamiento" con el
// almacen creado y conectado a los tres entornos, porque solo sabia reconocer el token viejo.
describe('autenticacion contra el almacen de fotos', () => {
  it('OIDC: basta con el id del almacen', () => {
    expect(blobConfigured({ BLOB_STORE_ID: 'store_abc' })).toBe(true);
  });

  it('OIDC: no se le pasa token a la libreria, o dejaria de autenticarse sola', () => {
    expect(opcionesDeAlmacen({ BLOB_STORE_ID: 'store_abc' })).toEqual({});
  });

  it('token clasico: se pasa explicito', () => {
    expect(opcionesDeAlmacen({ BLOB_READ_WRITE_TOKEN: 'abc' })).toEqual({ token: 'abc' });
  });

  it('token con prefijo propio: tambien', () => {
    expect(opcionesDeAlmacen({ SYNAPTIC_FOTOS_READ_WRITE_TOKEN: 'xyz' })).toEqual({ token: 'xyz' });
  });

  it('con las dos formas, manda el token explicito', () => {
    expect(opcionesDeAlmacen({ BLOB_STORE_ID: 's', BLOB_READ_WRITE_TOKEN: 'a' })).toEqual({ token: 'a' });
  });

  it('sin nada, la tienda sigue funcionando con las fotos dentro del catalogo', () => {
    expect(blobConfigured({})).toBe(false);
    expect(opcionesDeAlmacen({})).toEqual({});
  });
});
