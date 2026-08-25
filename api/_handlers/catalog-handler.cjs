const { kvGet, kvSet, kvConfigured } = require('../_lib/kv.cjs');
const { AUTH_KEY, verifyToken, extractBearer } = require('../_lib/auth.cjs');
const CATALOG_KEY = 'synaptic_catalog';
const DEFAULT_DATA = {
  settings: { storeName: 'Synaptic Tech', tagline: 'Tecnología al alcance de tu WhatsApp', whatsapp: '', currency: 'RD$', logo: '', configured: false },
  products: [],
  categories: [{ name: 'Laptops', emoji: '💻' }, { name: 'Celulares', emoji: '📱' }, { name: 'Accesorios', emoji: '🎧' }, { name: 'Servicios', emoji: '🛠️' }]
};
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!kvConfigured()) return res.status(503).json({ error: 'DB_NOT_CONNECTED' });
  try {
    if (req.method === 'GET') { const data = (await kvGet(CATALOG_KEY)) || DEFAULT_DATA; return res.status(200).json(data); }
    if (req.method === 'POST') {
      const admin = await kvGet(AUTH_KEY);
      if (!admin) return res.status(400).json({ error: 'NOT_SETUP' });
      const token = extractBearer(req);
      if (!verifyToken(token, admin.secret)) return res.status(401).json({ error: 'UNAUTHORIZED' });
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      if (!body || !body.settings) return res.status(400).json({ error: 'BAD_REQUEST' });
      await kvSet(CATALOG_KEY, body);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (e) { return res.status(500).json({ error: 'SERVER_ERROR' }); }
};
