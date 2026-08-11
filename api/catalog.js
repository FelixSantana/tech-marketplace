// Serverless function: GET returns the shared catalog (settings + products + categories).
// POST updates it — requires a valid admin session token (see /api/auth).
// Data is persisted in Vercel KV / Upstash Redis via its REST API.

const { kvGet, kvSet, kvConfigured } = require('./_lib/kv');
const { AUTH_KEY, verifyToken, extractBearer } = require('./_lib/auth');

const CATALOG_KEY = 'synaptic_catalog';

const DEFAULT_DATA = {
  settings: {
    storeName: 'Synaptic Tech',
    tagline: 'Tecnología al alcance de tu WhatsApp',
    whatsapp: '',
    currency: 'RD$',
    logo: '',
    configured: false
  },
  products: [],
  categories: [
    { name: 'Laptops', emoji: '💻' },
    { name: 'Celulares', emoji: '📱' },
    { name: 'Accesorios', emoji: '🎧' },
    { name: 'Servicios', emoji: '🛠️' }
  ]
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!kvConfigured()) {
    return res.status(503).json({
      error: 'DB_NOT_CONNECTED',
      message: 'La base de datos aún no está conectada en este proyecto de Vercel.'
    });
  }

  try {
    if (req.method === 'GET') {
      const data = (await kvGet(CATALOG_KEY)) || DEFAULT_DATA;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const admin = await kvGet(AUTH_KEY);
      if (!admin) {
        return res.status(400).json({ error: 'NOT_SETUP', message: 'Primero crea la cuenta de administrador.' });
      }
      const token = extractBearer(req);
      const payload = verifyToken(token, admin.secret);
      if (!payload) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Sesión inválida o expirada. Inicia sesión de nuevo.' });
      }

      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }
      if (!body || typeof body !== 'object' || !body.settings) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Datos inválidos.' });
      }

      await kvSet(CATALOG_KEY, body);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (e) {
    console.error('catalog api error', e);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Error interno del servidor.' });
  }
};
