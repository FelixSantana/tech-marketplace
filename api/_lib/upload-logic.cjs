// Validacion de las imagenes que se suben al bucket, sin red ni HTTP, para poder probarla.

const TIPOS_PERMITIDOS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
// Las fotos llegan ya comprimidas por el navegador (520px, calidad 0.62): unos 30KB.
// El tope generoso es una red de seguridad, no el tamano esperado.
const MAX_BYTES = 3 * 1024 * 1024;

// Convierte el data URL que manda el panel en algo subible, o explica por que no se puede.
function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) throw new Error('INVALID_IMAGE');
  const coma = dataUrl.indexOf(',');
  if (coma < 0) throw new Error('INVALID_IMAGE');
  const cabecera = dataUrl.slice(5, coma);
  if (!cabecera.endsWith(';base64')) throw new Error('INVALID_IMAGE');
  const mime = cabecera.slice(0, -';base64'.length);
  const ext = TIPOS_PERMITIDOS[mime];
  if (!ext) throw new Error('UNSUPPORTED_IMAGE_TYPE');
  let buffer;
  try { buffer = Buffer.from(dataUrl.slice(coma + 1), 'base64'); } catch { throw new Error('INVALID_IMAGE'); }
  if (!buffer.length) throw new Error('INVALID_IMAGE');
  if (buffer.length > MAX_BYTES) throw new Error('IMAGE_TOO_LARGE');
  return { buffer, mime, ext };
}

// Las carpetas del almacen. Es una lista cerrada porque el prefijo llega del cliente y acaba
// dentro de la ruta del archivo: sin filtro, un `../` o una carpeta inventada en cada subida.
//
// `marca` son las imagenes derivadas del logo —la de compartir y los tres iconos—. Faltaba, y el
// efecto era mudo: Ajustes las subia con prefijo 'marca', el servidor lo cambiaba por 'productos'
// sin decir nada, y acababan mezcladas con las fotos de los productos.
const PREFIJOS = ['productos', 'logo', 'marca'];
const PREFIJO_POR_DEFECTO = 'productos';

const prefijoValido = (p) => (PREFIJOS.includes(p) ? p : PREFIJO_POR_DEFECTO);

// Nombre unico por subida: el bucket nunca sobrescribe una foto que otro producto siga usando.
function buildPathname(ext, prefix) {
  const unico = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  return `${prefijoValido(prefix)}/${unico}.${ext}`;
}

// Como se autentica la tienda contra el almacen de fotos. Hay dos maneras y conviven:
//
// 1. OIDC (lo que Vercel hace hoy al conectar un almacen a un proyecto): no inyecta ningun
//    token de lectura-escritura, sino BLOB_STORE_ID, y la funcion se identifica con la
//    identidad del propio despliegue (VERCEL_OIDC_TOKEN). La libreria resuelve esto sola
//    SIEMPRE QUE NO se le pase un `token`.
// 2. Token de lectura-escritura clasico, en BLOB_READ_WRITE_TOKEN. Sigue valiendo, y hace
//    falta para usar el almacen desde fuera de Vercel.
//
// El nombre de esa variable ademas no es fijo: Vercel deja elegir el prefijo al conectar el
// almacen, asi que un almacen "synaptic-fotos" puede quedar como
// SYNAPTIC_FOTOS_READ_WRITE_TOKEN. Mirar solo el nombre por defecto dejaba la tienda diciendo
// "el almacenamiento no esta configurado" con el almacen creado y conectado.
function blobToken(env = process.env) {
  if (env.BLOB_READ_WRITE_TOKEN) return env.BLOB_READ_WRITE_TOKEN;
  const clave = Object.keys(env).find((k) => k.endsWith('_READ_WRITE_TOKEN') && env[k]);
  return clave ? env[clave] : '';
}

function blobConfigured(env = process.env) { return Boolean(blobToken(env) || env.BLOB_STORE_ID); }

// Lo que se le pasa a put() y del(). Con token, explicito, porque la libreria solo mira el
// nombre por defecto por su cuenta. Sin token, un objeto vacio: pasarle `token: ''` la haria
// fallar en vez de dejarla autenticarse por OIDC.
function opcionesDeAlmacen(env = process.env) {
  const token = blobToken(env);
  return token ? { token } : {};
}

module.exports = { parseDataUrl, buildPathname, prefijoValido, blobConfigured, blobToken, opcionesDeAlmacen, TIPOS_PERMITIDOS, MAX_BYTES, PREFIJOS };
