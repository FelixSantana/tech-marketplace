import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Esta prueba existe por un fallo real en producción.
//
// La vista previa de una cotización enseña el PDF en un <iframe src="blob:…">. Pasó todas mis
// pruebas y se rompió en cuanto llegó a la tienda: el servidor de desarrollo de Vite no manda
// cabeceras de seguridad, y la CSV real no tenía `frame-src`, así que caía en `default-src
// 'self'` —que no admite blob:— y el navegador enseñaba "Este contenido está bloqueado".
//
// La lección no es "acordarse de frame-src", sino que una política de seguridad que solo vive
// en producción es una política que nadie prueba. Aquí queda clavada la parte de la que depende
// una pantalla del panel.

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
  it('deja enseñar el PDF que la propia página acaba de generar', () => {
    // Sin esto la vista previa sale en blanco con "Este contenido está bloqueado".
    expect(csp()['frame-src']).toContain('blob:');
  });

  it('no deja incrustar páginas de fuera', () => {
    // blob: es lo que la página se fabrica a sí misma. Un https: suelto aquí permitiría meter
    // cualquier sitio dentro del panel.
    const permitido = csp()['frame-src'];
    expect(permitido.sort()).toEqual(["'self'", 'blob:']);
  });

  it('sigue sin permitir scripts de fuera ni que nos incrusten a nosotros', () => {
    // Lo que se tocó fue frame-src y nada más; estas tres son las que de verdad protegen.
    const c = csp();
    expect(c['script-src']).toEqual(["'self'"]);
    expect(c['frame-ancestors']).toEqual(["'none'"]);
    expect(c['object-src']).toEqual(["'none'"]);
  });
});
