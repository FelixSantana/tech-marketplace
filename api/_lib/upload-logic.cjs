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

// Nombre unico por subida: el bucket nunca sobrescribe una foto que otro producto siga usando.
function buildPathname(ext, prefix = 'productos') {
  const unico = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}/${unico}.${ext}`;
}

function blobConfigured(env = process.env) { return Boolean(env.BLOB_READ_WRITE_TOKEN); }

module.exports = { parseDataUrl, buildPathname, blobConfigured, TIPOS_PERMITIDOS, MAX_BYTES };
