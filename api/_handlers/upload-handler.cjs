const { put } = require('@vercel/blob');
const { kvGet } = require('../_lib/kv.cjs');
const { AUTH_KEY, verifyToken, extractBearer } = require('../_lib/auth.cjs');
const { parseDataUrl, buildPathname, blobConfigured } = require('../_lib/upload-logic.cjs');

const MENSAJES = {
  INVALID_IMAGE: 'La imagen no se pudo leer.',
  UNSUPPORTED_IMAGE_TYPE: 'Formato no admitido. Usa JPG, PNG o WebP.',
  IMAGE_TOO_LARGE: 'La imagen es demasiado grande.',
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

  // Sin bucket configurado el panel sigue funcionando: guarda la foto incrustada como antes.
  if (!blobConfigured()) return res.status(503).json({ error: 'BLOB_NOT_CONFIGURED', message: 'El almacenamiento de imágenes todavía no está configurado.' });

  try {
    const admin = await kvGet(AUTH_KEY);
    if (!admin) return res.status(400).json({ error: 'NOT_SETUP' });
    const token = extractBearer(req);
    if (!verifyToken(token, admin.secret)) return res.status(401).json({ error: 'UNAUTHORIZED' });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

    const { buffer, mime, ext } = parseDataUrl(body && body.dataUrl);
    const blob = await put(buildPathname(ext, body.prefix === 'logo' ? 'logo' : 'productos'), buffer, {
      access: 'public',
      contentType: mime,
      addRandomSuffix: false,
    });
    return res.status(201).json({ ok: true, url: blob.url });
  } catch (e) {
    const message = MENSAJES[e.message];
    if (message) return res.status(400).json({ error: e.message, message });
    console.error('upload error', e);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'No se pudo subir la imagen.' });
  }
};
