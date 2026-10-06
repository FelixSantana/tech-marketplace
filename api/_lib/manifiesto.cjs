// El manifiesto de la aplicacion instalable, armado con lo que el dueño tiene en Ajustes.
//
// Estuvo en public/manifest.webmanifest, es decir en el codigo: el nombre de la tienda escrito a
// mano en un archivo estatico. Eso obligaba a editar y desplegar para cada cliente, y dejaba una
// trampa silenciosa —cambiar el nombre en Ajustes no cambiaba el de la aplicacion instalada, y
// nadie se enteraba hasta ver el icono en el telefono con el nombre de otra tienda.
//
// Ahora lo sirve una funcion que lee el catalogo. El archivo estatico tuvo que desaparecer: en
// Vercel el sistema de archivos tiene precedencia sobre las reescrituras, asi que mientras
// existiera, la ruta nunca habria llegado a la funcion.

// Colores de la cabecera del telefono. Siguen fijos porque el color de marca todavia no esta en
// Ajustes; cuando lo este, salen de ahi y este valor pasa a ser solo el de respaldo.
const FONDO = '#0a0c12';

// El nombre por defecto sale de tienda.cjs, el mismo que usa el resto de la tienda: antes habia
// dos distintos y la aplicacion instalada podia llamarse de una forma y la cabecera de otra.

// Android recorta el nombre bajo el icono alrededor de los 12 caracteres. Si el nombre completo
// no cabe se prueba con la primera palabra, que casi siempre es la que identifica al negocio
// ("Repuestos La Romana" → "Repuestos"), y solo si tampoco cabe se corta.
const MAX_CORTO = 12;

function nombreCorto(nombre) {
  if (nombre.length <= MAX_CORTO) return nombre;
  const primera = nombre.split(/\s+/)[0];
  if (primera.length <= MAX_CORTO) return primera;
  return primera.slice(0, MAX_CORTO).trim();
}

// Los iconos derivados del logo del cliente, si existen, y si no los que vienen en el repositorio.
// Mientras un cliente no suba logo vera el icono de Synaptic: es lo que queda por desatar.
const ICONOS_POR_DEFECTO = [
  { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

const { nombreDeTienda } = require('./tienda.cjs');

const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

// Solo se acepta una URL absoluta http(s) o una ruta del propio sitio. Un icono es una URL que el
// navegador va a pedir: una foto incrustada (data:) no sirve, y cualquier otro esquema no pinta
// nada bueno dentro de un manifiesto.
const urlDeIcono = (v) => {
  const s = texto(v, 600);
  return /^https?:\/\//i.test(s) || /^\/[^/]/.test(s) ? s : '';
};

function iconosDe(settings) {
  const m = (settings && settings.marca) || {};
  const derivados = [
    { src: urlDeIcono(m.icon192), sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: urlDeIcono(m.icon512), sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: urlDeIcono(m.iconMaskable), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ].filter((i) => i.src);
  // Se exige el juego completo. Un manifiesto a medias —el de 192 del cliente y el de 512 de
  // Synaptic— es peor que cualquiera de los dos enteros: Android elige por tamaño y el cliente
  // veria un icono u otro segun el telefono.
  return derivados.length === 3 ? derivados : ICONOS_POR_DEFECTO;
}

// "Repuestos La Romana — Catálogo", o "Mi tienda — Catálogo" mientras el dueño no ponga el suyo.
//
// El caso de "sin nombre" ya no se trata aqui: nombreDeTienda() nunca devuelve vacio, asi que no
// hay forma de llegar al "Catálogo — Catálogo" que habia que esquivar cuando este archivo tenia su
// propio nombre por defecto.
function construirManifiesto(settings) {
  const s = settings || {};
  const nombre = texto(nombreDeTienda(s), 60);
  const lema = texto(s.tagline, 120);
  return {
    name: `${nombre} — Catálogo`,
    short_name: nombreCorto(nombre),
    description: lema ? `${nombre}: ${lema}` : `Catálogo de ${nombre}: mira los productos y haz tu pedido por WhatsApp.`,
    lang: 'es-DO',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: FONDO,
    theme_color: FONDO,
    icons: iconosDe(s),
  };
}

module.exports = { construirManifiesto, ICONOS_POR_DEFECTO, FONDO, MAX_CORTO };
