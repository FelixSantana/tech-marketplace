// El color de marca: el unico color que distingue a una tienda de otra.
//
// Estuvo fijo en el CSS (`--accent:#6d4bff`), que es el morado de Synaptic. Un cliente que venda
// repuestos o ropa no quiere el morado de una tienda de computadoras, y cambiarlo obligaba a
// editar el CSS y desplegar: justo lo que impide vender esto a otro cliente.
//
// Ahora vive en `settings.colorMarca` y se aplica en caliente sobre la raiz del documento. Una
// propiedad puesta en el elemento gana a cualquier regla de hoja de estilo, asi que basta con eso
// para que mande en los dos temas, el claro y el oscuro.

export const COLOR_POR_DEFECTO = '#6d4bff';

// Tinta: el color del texto que va ENCIMA del acento.
//
// No es un adorno. Siete reglas del CSS ponian texto blanco fijo sobre el acento, y eso solo
// funciona mientras el acento sea oscuro. Con un amarillo o un verde claro —colores de marca
// perfectamente normales— el boton de "Pedir por WhatsApp" quedaba blanco sobre blanco: la tienda
// se vuelve inusable y el dueño no entiende por que. Se elige entre blanco y casi negro por
// contraste medido, no a ojo.
export const TINTA_CLARA = '#ffffff';
export const TINTA_OSCURA = '#0a0c12';

// Acepta #abc y #aabbcc, con o sin almohadilla, en cualquier caja. Devuelve siempre #aabbcc en
// minusculas, o '' si no es un color que se pueda usar. Lo que no se entiende no se aplica: es
// preferible que la tienda siga con su color de siempre a que se quede sin ninguno.
export function normalizarColor(valor) {
  const crudo = String(valor == null ? '' : valor).trim().replace(/^#/, '');
  if (!/^[0-9a-f]{3}$/i.test(crudo) && !/^[0-9a-f]{6}$/i.test(crudo)) return '';
  const seis = crudo.length === 3 ? crudo.split('').map((c) => c + c).join('') : crudo;
  return `#${seis.toLowerCase()}`;
}

export function colorDeMarca(settings) {
  return normalizarColor(settings && settings.colorMarca);
}

const canal = (v) => {
  const x = v / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};

// Luminancia relativa segun WCAG: no es el promedio de los tres canales, porque el ojo ve el
// verde mucho mas claro que el azul. Un azul puro y un verde puro tienen el mismo promedio y no
// se parecen en nada a la vista.
export function luminancia(hex) {
  const c = normalizarColor(hex);
  if (!c) return 0;
  const n = parseInt(c.slice(1), 16);
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

export function contraste(unColor, otro) {
  const a = luminancia(unColor);
  const b = luminancia(otro);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// De las dos tintas, la que mas contraste da sobre ese fondo.
export function tintaSobre(fondo) {
  return contraste(fondo, TINTA_CLARA) >= contraste(fondo, TINTA_OSCURA) ? TINTA_CLARA : TINTA_OSCURA;
}

// --- derivar tonos del mismo color ---
//
// La barra superior, la de categorias y el pie van en un morado oscuro (`--barra:#221a4d`) que el
// propio CSS llama "el color de la casa": es la superficie de marca mas visible de la tienda, mas
// que los botones. Estaba fija, asi que una tienda con el amarillo de su marca seguia con la barra
// morada de Synaptic. Se deriva del mismo color que elige el dueño, bajandole la luz.

export function aHsl(hex) {
  const c = normalizarColor(hex);
  if (!c) return null;
  const n = parseInt(c.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

export function deHsl({ h, s, l }) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const dos = (x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0');
  return `#${dos(f(0))}${dos(f(8))}${dos(f(4))}`;
}

// Mismo tono, la luz que se pida. La saturacion se topa porque un color muy saturado a poca luz se
// ve sucio, no profundo: #221a4d, el de la casa, ronda el 50%.
export function conLuz(hex, luz, topeSaturacion = 0.55) {
  const hsl = aHsl(hex);
  if (!hsl) return '';
  return deHsl({ h: hsl.h, s: Math.min(hsl.s, topeSaturacion), l: luz });
}

// Las luces salen de medir las de la plantilla: #221a4d esta al 20%, #2e2466 al 27%, y el texto
// de encima (#cfc8ee) al 86% con poca saturacion.
const LUZ = { barra: 0.20, barraAlta: 0.27, tinta: 0.86, tintaSuave: 0.73, activo: 0.64 };

// Las propiedades que hay que poner en la raiz del documento para que mande el color del dueño.
// Devuelve null cuando no hay color valido, y entonces el llamador las quita y vuelve a mandar el
// CSS: asi borrar el color en Ajustes restaura el de la plantilla sin recargar.
export function variablesDeMarca(settings) {
  const color = colorDeMarca(settings);
  if (!color) return null;
  return {
    '--accent': color,
    '--accent-ink': tintaSobre(color),
    '--barra': conLuz(color, LUZ.barra),
    '--barra-alta': conLuz(color, LUZ.barraAlta),
    '--precio': conLuz(color, LUZ.barra),
    '--barra-ink': conLuz(color, LUZ.tinta, 0.30),
    '--barra-ink-suave': conLuz(color, LUZ.tintaSuave, 0.25),
    // El subrayado de la categoria activa sobre la barra: tiene que verse encima de ella.
    '--accent-activo': conLuz(color, LUZ.activo, 0.70),
  };
}

export const VARIABLES = [
  '--accent', '--accent-ink', '--barra', '--barra-alta', '--precio', '--barra-ink', '--barra-ink-suave',
  '--accent-activo',
];
