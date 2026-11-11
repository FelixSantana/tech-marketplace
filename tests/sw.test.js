import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// El trabajador de servicio no se puede importar como modulo: corre en su propio contexto y
// habla con `self`. Se carga el archivo tal cual dentro de un `self` de mentira y se disparan
// los eventos a mano, que es exactamente lo que hace el navegador.
//
// Esta prueba existe por un fallo real: la primera version reemitia TODA peticion con fetch(),
// y las de Google Fonts chocaban contra connect-src 'self' de la politica de contenido. Las
// tipografias dejaban de cargar a partir de la segunda visita del cliente.
// El archivo vive en public/ y esta prueba en tests/: si se dejara la prueba junto al worker,
// Vite copiaria public/ entera a produccion y publicaria tambien el test.
const FUENTE = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const ORIGEN = 'https://synaptic-tech-catalogo.vercel.app';

function cargarWorker() {
  const oyentes = {};
  const self = {
    addEventListener: (tipo, fn) => { oyentes[tipo] = fn; },
    location: { origin: ORIGEN },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };
  new Function('self', FUENTE)(self);
  return { oyentes, self };
}

const eventoFetch = (url) => ({ request: { url }, respondWith: vi.fn(), waitUntil: vi.fn() });

describe('trabajador de servicio', () => {
  it('registra los tres eventos que el navegador espera', () => {
    const { oyentes } = cargarWorker();
    expect(Object.keys(oyentes).sort()).toEqual(['activate', 'fetch', 'install']);
  });

  it('deja pasar las peticiones a otros dominios sin tocarlas', () => {
    const { oyentes } = cargarWorker();
    const e = eventoFetch('https://fonts.googleapis.com/css2?family=Inter');
    oyentes.fetch(e);
    expect(e.respondWith).not.toHaveBeenCalled();
  });

  it('tampoco toca las tipografias servidas desde gstatic', () => {
    const { oyentes } = cargarWorker();
    const e = eventoFetch('https://fonts.gstatic.com/s/inter/v13/abc.woff2');
    oyentes.fetch(e);
    expect(e.respondWith).not.toHaveBeenCalled();
  });

  it('responde las de la propia tienda, que es lo que Chrome pide para poder instalarla', () => {
    const { oyentes } = cargarWorker();
    global.fetch = vi.fn(() => Promise.resolve('respuesta'));
    const e = eventoFetch(`${ORIGEN}/api/catalog`);
    oyentes.fetch(e);
    expect(e.respondWith).toHaveBeenCalledTimes(1);
  });

  it('no cachea: no declara ningun almacen', () => {
    expect(FUENTE).not.toMatch(/caches\.|cache\.put|cache\.match/);
  });
});
