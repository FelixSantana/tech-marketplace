import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { htmlDelPanel, ARCHIVO, ARCHIVO_TIENDA } from '../scripts/panel.mjs';

const INDEX = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('el HTML del panel', () => {
  const panel = htmlDelPanel(INDEX);

  it('enlaza el manifiesto del panel y no el de la tienda', () => {
    // Esto es TODO el motivo de que este archivo exista: Safari lee el manifiesto del HTML al
    // pulsar "Añadir a pantalla de inicio", no el que haya puesto JavaScript en el DOM.
    expect(panel).toContain('href="/manifest.webmanifest?panel=1"');
    expect(panel).not.toMatch(/href="\/manifest\.webmanifest"/);
  });

  it('deja una sola etiqueta de manifiesto', () => {
    // Con dos, el navegador se queda con la primera y volveriamos al problema sin enterarnos.
    expect(panel.match(/rel=["']manifest["']/gi)).toHaveLength(1);
  });

  it('se llama Panel en la pantalla de inicio de iOS', () => {
    expect(panel).toContain('content="Panel"');
  });

  it('pide a Google que no lo indexe', () => {
    // Una pagina de acceso en el buscador es una invitacion a que desconocidos prueben claves.
    expect(panel).toMatch(/<meta name="robots" content="noindex, nofollow"/);
  });

  it('conserva lo demás del HTML de la tienda', () => {
    // Se deriva en vez de duplicarse justo para esto: lo que se añada a index.html aparece aqui
    // sin que nadie tenga que acordarse.
    expect(panel).toContain('<div id="root">');
    expect(panel).toContain('/src/main.jsx');
    expect(panel.length).toBeGreaterThan(INDEX.length - 200);
  });

  it('se rompe el build antes que publicar un panel sin su manifiesto', () => {
    expect(() => htmlDelPanel('<html><head></head><body></body></html>')).toThrow(/manifest/);
    expect(() => htmlDelPanel('<link rel="manifest" href="/x">')).toThrow(/head/);
  });

  it('se llama admin.html, que es lo que espera la reescritura de /admin', () => {
    expect(ARCHIVO).toBe('admin.html');
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    const regla = vercel.rewrites.find((r) => r.source === '/admin');
    expect(regla.destination).toBe(`/${ARCHIVO}`);
  });
});

describe('lo que de verdad se publicó', () => {
  const dist = new URL('../dist/admin.html', import.meta.url);

  it.skipIf(!existsSync(dist))('dist/admin.html sale del build con el manifiesto del panel', () => {
    // Comprueba el archivo compilado, no la transformacion: entre los dos esta el complemento de
    // Vite, que es donde se rompe si alguien lo quita.
    const construido = readFileSync(dist, 'utf8');
    expect(construido).toContain('href="/manifest.webmanifest?panel=1"');
    expect(construido).toContain('content="Panel"');
    expect(construido).toContain('noindex');
    // Y que el JavaScript sea el mismo que el de la tienda, no uno a medias.
    expect(construido).toMatch(/<script type="module" crossorigin src="\/assets\/index-[\w-]+\.js"/);
  });
});

describe('el nombre del HTML de la tienda', () => {
  it('no es index.html, o la reescritura de / nunca se aplicaría', () => {
    // Vercel resuelve el sistema de archivos antes que las reescrituras. Con un dist/index.html
    // la portada la sirve el archivo y la funcion no llega a ejecutarse nunca.
    expect(ARCHIVO_TIENDA).not.toBe('index.html');
  });

  it('el build lo deja con ese nombre y sin index.html', () => {
    const dir = new URL('../dist/', import.meta.url);
    if (!existsSync(new URL('admin.html', dir))) return; // sin build, nada que comprobar
    expect(existsSync(new URL(ARCHIVO_TIENDA, dir))).toBe(true);
    expect(existsSync(new URL('index.html', dir))).toBe(false);
  });

  it('las funciones que piden el HTML usan el mismo nombre', () => {
    // El nombre vive en dos sitios: el build (ESM) y los handlers (CJS). Si se separan, la
    // portada y las fichas se quedan sin HTML que servir.
    for (const f of ['portada-handler', 'producto-handler']) {
      const fuente = readFileSync(new URL(`../api/_handlers/${f}.cjs`, import.meta.url), 'utf8');
      expect(fuente).toContain(`const ARCHIVO_TIENDA = '${ARCHIVO_TIENDA}'`);
    }
  });
});
