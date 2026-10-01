import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolverOrigen, aplicarOrigen, MARCADOR } from './dominio.mjs';

describe('resolverOrigen', () => {
  // El caso que justifica todo esto: dos tiendas distintas compilando del mismo repositorio
  // tienen que salir cada una con su dominio, sin que nadie edite el HTML.
  it('cada despliegue saca su propio dominio', () => {
    expect(resolverOrigen({ VERCEL_PROJECT_PRODUCTION_URL: 'synaptic-tech-catalogo.vercel.app' }))
      .toBe('https://synaptic-tech-catalogo.vercel.app');
    expect(resolverOrigen({ VERCEL_PROJECT_PRODUCTION_URL: 'tienda-del-cliente.vercel.app' }))
      .toBe('https://tienda-del-cliente.vercel.app');
  });

  it('TIENDA_URL manda sobre lo que ponga Vercel', () => {
    const env = {
      TIENDA_URL: 'https://tienda.com.do',
      VERCEL_PROJECT_PRODUCTION_URL: 'tienda.vercel.app',
      VERCEL_URL: 'tienda-abc123.vercel.app',
    };
    expect(resolverOrigen(env)).toBe('https://tienda.com.do');
  });

  // El dominio de produccion viene puesto incluso en una preview, y se prefiere al de la preview
  // para que Google no indexe el despliegue de una rama como si fuera la tienda.
  it('el dominio de producción manda sobre el del despliegue', () => {
    const env = {
      VERCEL_PROJECT_PRODUCTION_URL: 'tienda.com.do',
      VERCEL_URL: 'tienda-git-rama-equipo.vercel.app',
    };
    expect(resolverOrigen(env)).toBe('https://tienda.com.do');
  });

  it('VERCEL_URL sirve de último recurso', () => {
    expect(resolverOrigen({ VERCEL_URL: 'tienda-abc123.vercel.app' }))
      .toBe('https://tienda-abc123.vercel.app');
  });

  it('le pone https:// a lo que viene sin esquema', () => {
    expect(resolverOrigen({ TIENDA_URL: 'tienda.com.do' })).toBe('https://tienda.com.do');
  });

  it('respeta el esquema que ya traiga TIENDA_URL', () => {
    expect(resolverOrigen({ TIENDA_URL: 'http://tienda.com.do' })).toBe('http://tienda.com.do');
  });

  // Concatenar sobre una barra final sobrante daria "https://tienda.com//og-image.jpg".
  it('quita la barra final y cualquier ruta de más', () => {
    expect(resolverOrigen({ TIENDA_URL: 'https://tienda.com.do/' })).toBe('https://tienda.com.do');
    expect(resolverOrigen({ TIENDA_URL: 'https://tienda.com.do/catalogo?x=1' })).toBe('https://tienda.com.do');
  });

  it('aguanta espacios alrededor', () => {
    expect(resolverOrigen({ VERCEL_URL: '  tienda.vercel.app  ' })).toBe('https://tienda.vercel.app');
  });

  it('sin variables no inventa ningún dominio', () => {
    expect(resolverOrigen({})).toBe('');
    expect(resolverOrigen()).toBe('');
  });

  it('descarta lo que no es un dominio público', () => {
    expect(resolverOrigen({ TIENDA_URL: '' })).toBe('');
    expect(resolverOrigen({ TIENDA_URL: '   ' })).toBe('');
    expect(resolverOrigen({ TIENDA_URL: 'localhost:5173' })).toBe('');
    expect(resolverOrigen({ TIENDA_URL: 'no es un dominio' })).toBe('');
    expect(resolverOrigen({ TIENDA_URL: 'javascript:alert(1)' })).toBe('');
  });

  it('si la primera variable no vale, pasa a la siguiente', () => {
    const env = { TIENDA_URL: 'localhost', VERCEL_PROJECT_PRODUCTION_URL: 'tienda.vercel.app' };
    expect(resolverOrigen(env)).toBe('https://tienda.vercel.app');
  });
});

describe('aplicarOrigen', () => {
  const HTML = [
    '<head>',
    `    <link rel="canonical" href="${MARCADOR}/" />`,
    '    <meta property="og:type" content="website" />',
    `    <meta property="og:url" content="${MARCADOR}/" />`,
    `    <meta property="og:image" content="${MARCADOR}/og-image.jpg" />`,
    '</head>',
  ].join('\n');

  it('pone el dominio en todas las etiquetas', () => {
    const salida = aplicarOrigen(HTML, 'https://tienda.com.do');
    expect(salida).toContain('<link rel="canonical" href="https://tienda.com.do/" />');
    expect(salida).toContain('<meta property="og:url" content="https://tienda.com.do/" />');
    expect(salida).toContain('<meta property="og:image" content="https://tienda.com.do/og-image.jpg" />');
    expect(salida).not.toContain(MARCADOR);
  });

  // Mejor una tienda sin vista previa que una tienda que publica un marcador o el dominio de otra.
  it('sin dominio, borra las etiquetas y deja el resto intacto', () => {
    const salida = aplicarOrigen(HTML, '');
    expect(salida).not.toContain(MARCADOR);
    expect(salida).not.toContain('canonical');
    expect(salida).not.toContain('og:url');
    expect(salida).not.toContain('og:image');
    expect(salida).toContain('<meta property="og:type" content="website" />');
    expect(salida).toBe('<head>\n    <meta property="og:type" content="website" />\n</head>');
  });

  it('no toca un HTML que no lleve el marcador', () => {
    const limpio = '<head>\n    <title>Tienda</title>\n</head>';
    expect(aplicarOrigen(limpio, '')).toBe(limpio);
    expect(aplicarOrigen(limpio, 'https://tienda.com.do')).toBe(limpio);
  });

  // Una etiqueta nueva mal puesta —dos en la misma linea, o partida en varias— no se puede borrar
  // por lineas. El build tiene que caerse ahi, no publicar "__ORIGEN__" para que lo lea WhatsApp.
  it('se cae si queda un marcador que no pudo resolver', () => {
    const mal = `<head>\n    <meta property="og:url" content="${MARCADOR}/" /><span>${MARCADOR}</span>\n</head>`;
    expect(() => aplicarOrigen(mal, '')).toThrow(/sin resolver/);
  });

  // El comentario de index.html nombra el marcador para explicar de donde sale el dominio.
  // Sustituirlo ahi dejaba una frase absurda en el HTML publicado, y borrar su linea se comia el
  // comentario a trozos.
  it('no toca el marcador dentro de un comentario', () => {
    const conComentario = `<head>\n    <!-- ${MARCADOR} lo pone el build -->\n    <meta property="og:url" content="${MARCADOR}/" />\n</head>`;
    const conDominio = aplicarOrigen(conComentario, 'https://tienda.com.do');
    expect(conDominio).toContain(`<!-- ${MARCADOR} lo pone el build -->`);
    expect(conDominio).toContain('content="https://tienda.com.do/"');

    const sinDominio = aplicarOrigen(conComentario, '');
    expect(sinDominio).toBe(`<head>\n    <!-- ${MARCADOR} lo pone el build -->\n</head>`);
  });
});

describe('index.html', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  // La regresion que se quiere evitar: que alguien vuelva a escribir un dominio a mano.
  it('no lleva ningún dominio escrito a mano', () => {
    expect(html).not.toContain('synaptic-tech-catalogo.vercel.app');
    expect(html).not.toMatch(/(?:href|content)="https?:\/\/(?!fonts\.(?:googleapis|gstatic)\.com)/);
  });

  it('todas las URLs absolutas de la vista previa salen del marcador', () => {
    for (const etiqueta of ['canonical', 'og:url', 'og:image', 'og:image:secure_url', 'twitter:image']) {
      expect(html).toMatch(new RegExp(`${etiqueta}"[^>]*${MARCADOR}`));
    }
  });

  const sinComentarios = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

  it('compila con dominio y sin dominio', () => {
    expect(aplicarOrigen(html, 'https://tienda.com.do')).toContain('content="https://tienda.com.do/og-image.jpg"');
    // Sin dominio no queda ninguna etiqueta a medio resolver (el comentario sí lo nombra).
    expect(sinComentarios(aplicarOrigen(html, ''))).not.toContain(MARCADOR);
    expect(aplicarOrigen(html, '')).not.toContain('canonical');
    expect(aplicarOrigen(html, '')).not.toContain('og:url');
  });
});
