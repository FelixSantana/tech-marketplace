import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Esta prueba existe por un fallo real en producción, y se queda aunque el fallo ya no pueda
// repetirse.
//
// La vista previa de una cotización enseñaba el PDF en un <iframe src="blob:…">. Pasó todas mis
// pruebas y se rompió en cuanto llegó a la tienda: el servidor de desarrollo de Vite no manda
// cabeceras de seguridad, y la CSP real no tenía `frame-src`, así que caía en `default-src
// 'self'` —que no admite blob:— y el navegador enseñaba "Este contenido está bloqueado".
//
// Se añadió `frame-src 'self' blob:` para arreglarlo. Después el dueño pidió que el PDF se
// abriera en una pestaña aparte en vez de dentro de la página, así que el iframe desapareció y
// con él la razón de aquel permiso: una navegación de primer nivel a blob: no pasa por
// frame-src. El permiso se quitó, porque dejar la política abierta para algo que ya no existe
// es dejarla abierta por nada.
//
// La lección que sí se queda: una política de seguridad que solo vive en producción es una
// política que nadie prueba. Aquí queda clavado lo que la tienda promete.

const csp = () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const regla = vercel.headers.find((h) => h.source === '/(.*)');
  const cabecera = regla.headers.find((h) => h.key === 'Content-Security-Policy');
  return Object.fromEntries(cabecera.value.split(';').map((d) => {
    const [nombre, ...valores] = d.trim().split(/\s+/);
    return [nombre, valores];
  }));
};

describe('la política de seguridad de la tienda', () => {
  it('no ejecuta scripts de fuera ni deja que nos incrusten', () => {
    const c = csp();
    expect(c['default-src']).toEqual(["'self'"]);
    expect(c['script-src']).toEqual(["'self'"]);
    expect(c['frame-ancestors']).toEqual(["'none'"]);
    expect(c['object-src']).toEqual(["'none'"]);
  });

  it('no incrusta nada de fuera', () => {
    // Sin `frame-src`, lo que manda es `default-src 'self'`. Si algún día vuelve a hacer falta
    // enseñar un PDF dentro de la página, hay que añadir `frame-src 'self' blob:` —y esta
    // prueba lo recordará fallando.
    const permitido = csp()['frame-src'];
    expect(permitido === undefined || permitido.every((v) => v === "'self'")).toBe(true);
  });

  it('solo abre la mano en lo que la tienda necesita de verdad', () => {
    const c = csp();
    // Las fuentes de Google y las fotos del almacén de imágenes. Nada más.
    expect(c['font-src']).toContain('https://fonts.gstatic.com');
    expect(c['img-src']).toContain('https:');
    expect(c['connect-src']).toEqual(["'self'"]);
  });
});
