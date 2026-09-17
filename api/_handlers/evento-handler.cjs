const { kvGet, kvSet, kvSetEx, kvConfigured } = require('../_lib/kv.cjs');
const { AUTH_KEY, verifyToken, extractBearer } = require('../_lib/auth.cjs');
const { TIPOS, vacio, registrarEvento, resumen } = require('../_lib/metricas.cjs');

const METRICAS_KEY = 'synaptic_metricas';
const CATALOG_KEY = 'synaptic_catalog';
const LIMITE_POR_MINUTO = 60;

function clientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'] || '';
  return String(forwarded).split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

// El endpoint es publico porque lo llama la tienda sin sesion. El limite evita que alguien
// infle los contadores o gaste la cuota de la base a fuerza de peticiones.
async function dentroDelLimite(req) {
  const bucket = Math.floor(Date.now() / 60000);
  const key = `synaptic_evento_rate:${clientIp(req)}:${bucket}`;
  const actual = await kvGet(key);
  const cuenta = Number(actual?.count || 0) + 1;
  if (cuenta > LIMITE_POR_MINUTO) return false;
  await kvSetEx(key, { count: cuenta }, 70);
  return true;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!kvConfigured()) return res.status(503).json({ error: 'DB_NOT_CONNECTED' });

  try {
    if (req.method === 'GET') {
      const admin = await kvGet(AUTH_KEY);
      if (!admin) return res.status(400).json({ error: 'NOT_SETUP' });
      if (!verifyToken(extractBearer(req), admin.secret)) return res.status(401).json({ error: 'UNAUTHORIZED' });
      const dias = Math.min(90, Math.max(1, Math.floor(Number(req.query?.dias) || 30)));
      const doc = (await kvGet(METRICAS_KEY)) || vacio();
      const catalogo = (await kvGet(CATALOG_KEY)) || { products: [] };
      return res.status(200).json(resumen(doc, dias, undefined, catalogo));
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const tipo = String((body && body.tipo) || '');
    if (!TIPOS.includes(tipo)) return res.status(400).json({ error: 'EVENTO_DESCONOCIDO' });
    // El pedido lo cuenta el propio manejador de ordenes: ese numero no depende del navegador.
    if (tipo === 'pedido') return res.status(400).json({ error: 'EVENTO_NO_PERMITIDO' });
    if (!(await dentroDelLimite(req))) return res.status(429).json({ error: 'RATE_LIMIT' });

    const doc = (await kvGet(METRICAS_KEY)) || vacio();
    await kvSet(METRICAS_KEY, registrarEvento(doc, tipo, body && body.productId));
    return res.status(204).end();
  } catch (e) {
    console.error('evento error', e);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
};
