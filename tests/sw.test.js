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

function cargarWorker(ventanas = []) {
  const oyentes = {};
  const self = {
    addEventListener: (tipo, fn) => { oyentes[tipo] = fn; },
    location: { origin: ORIGEN },
    skipWaiting: vi.fn(),
    registration: { showNotification: vi.fn() },
    clients: { claim: vi.fn(), matchAll: vi.fn(async () => ventanas), openWindow: vi.fn(async () => null) },
  };
  new Function('self', FUENTE)(self);
  return { oyentes, self };
}

const eventoFetch = (url) => ({ request: { url }, respondWith: vi.fn(), waitUntil: vi.fn() });

describe('trabajador de servicio', () => {
  it('registra los cinco eventos que el navegador espera', () => {
    const { oyentes } = cargarWorker();
    expect(Object.keys(oyentes).sort()).toEqual(['activate', 'fetch', 'install', 'notificationclick', 'push']);
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

// --- Avisos de pedido nuevo ---

const eventoPush = (datos) => ({
  data: datos === undefined ? null : { json: () => { if (datos === 'roto') throw new Error('json ilegible'); return datos; } },
  waitUntil: vi.fn(),
});

describe('el worker recibiendo un aviso de pedido', () => {
  it('enseña lo que mandó el servidor', () => {
    const { oyentes, self } = cargarWorker();
    oyentes.push(eventoPush({ title: 'Pedido nuevo · RD$ 500', body: 'Jose — Teclado', url: '/admin', tag: 'pedido-1' }));
    const [titulo, opciones] = self.registration.showNotification.mock.calls[0];
    expect(titulo).toBe('Pedido nuevo · RD$ 500');
    expect(opciones.body).toBe('Jose — Teclado');
    expect(opciones.data.url).toBe('/admin');
  });

  it('enseña uno genérico si el aviso llega vacío', () => {
    // Un push que llega y no muestra NADA cuenta como abuso: repetido, Chrome deja de
    // entregar los siguientes y el dueño se queda sin avisos sin enterarse.
    const { oyentes, self } = cargarWorker();
    oyentes.push(eventoPush(undefined));
    expect(self.registration.showNotification).toHaveBeenCalledTimes(1);
    expect(self.registration.showNotification.mock.calls[0][0]).toBe('Pedido nuevo');
  });

  it('enseña uno genérico si los datos no se pueden leer', () => {
    const { oyentes, self } = cargarWorker();
    oyentes.push(eventoPush('roto'));
    expect(self.registration.showNotification).toHaveBeenCalledTimes(1);
  });

  it('nunca se queda sin mostrar nada', () => {
    for (const datos of [undefined, 'roto', {}, { title: '' }]) {
      const { oyentes, self } = cargarWorker();
      oyentes.push(eventoPush(datos));
      expect(self.registration.showNotification).toHaveBeenCalledTimes(1);
      expect(self.registration.showNotification.mock.calls[0][0]).toBeTruthy();
    }
  });
});

describe('el worker cuando se toca el aviso', () => {
  // El manejador NO devuelve su promesa: se la entrega a waitUntil, que es como el navegador
  // sabe que no puede dormir al worker todavia. Hay que guardarla y esperarla, o las
  // comprobaciones corren antes de que el trabajo termine.
  const evento = (url = '/admin') => {
    const e = { notification: { close: vi.fn(), data: { url } }, waitUntil: (promesa) => { e.terminado = promesa; } };
    return e;
  };
  const tocar = async (oyentes, e) => { oyentes.notificationclick(e); await e.terminado; };

  it('reutiliza la pestaña de la tienda que ya estaba abierta', async () => {
    const pestana = { url: `${ORIGEN}/`, focus: vi.fn(async () => {}), navigate: vi.fn(async () => {}) };
    const { oyentes, self } = cargarWorker([pestana]);
    await tocar(oyentes, evento());
    expect(pestana.focus).toHaveBeenCalled();
    expect(pestana.navigate).toHaveBeenCalledWith(`${ORIGEN}/admin`);
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it('abre una nueva si no hay ninguna', async () => {
    const { oyentes, self } = cargarWorker([]);
    await tocar(oyentes, evento());
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGEN}/admin`);
  });

  it('no se cuela en una pestaña de otro dominio', async () => {
    const ajena = { url: 'https://otra-cosa.com/', focus: vi.fn(), navigate: vi.fn() };
    const { oyentes, self } = cargarWorker([ajena]);
    await tocar(oyentes, evento());
    expect(ajena.focus).not.toHaveBeenCalled();
    expect(self.clients.openWindow).toHaveBeenCalled();
  });
});
