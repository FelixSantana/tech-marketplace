const crypto = require('crypto');
const { kvGet, kvSet, kvConfigured } = require('./_lib/kv');
const { AUTH_KEY, verifyToken, extractBearer } = require('./_lib/auth');

const ORDERS_KEY = 'synaptic_orders';
const VALID_STATUSES = new Set(['pending', 'paid', 'shipped', 'completed', 'cancelled']);

function makeId() {
  return `ord_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function normalizeOrder(input, existing) {
  const now = new Date().toISOString();
  const products = Array.isArray(input.products)
    ? input.products.map((p) => ({
        id: String(p.id || ''),
        name: String(p.name || 'Producto').trim(),
        quantity: Math.max(1, Number(p.quantity) || 1),
        unitPrice: Math.max(0, Number(p.unitPrice) || 0),
      }))
    : [];

  const calculatedTotal = products.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
  const total = Number.isFinite(Number(input.total)) ? Math.max(0, Number(input.total)) : calculatedTotal;

  return {
    id: existing?.id || makeId(),
    customerName: String(input.customerName || '').trim(),
    phone: String(input.phone || '').trim(),
    products,
    total,
    status: VALID_STATUSES.has(input.status) ? input.status : (existing?.status || 'pending'),
    notes: String(input.notes || '').trim(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

async function requireAdmin(req) {
  const admin = await kvGet(AUTH_KEY);
  if (!admin) return { ok: false, status: 400, error: 'NOT_SETUP', message: 'Primero crea la cuenta de administrador.' };
  const token = extractBearer(req);
  const payload = verifyToken(token, admin.secret);
  if (!payload) return { ok: false, status: 401, error: 'UNAUTHORIZED', message: 'Sesión inválida o expirada. Inicia sesión de nuevo.' };
  return { ok: true, admin, payload };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!kvConfigured()) {
    return res.status(503).json({ error: 'DB_NOT_CONNECTED', message: 'La base de datos aún no está conectada en este proyecto de Vercel.' });
  }

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error, message: auth.message });

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const orders = (await kvGet(ORDERS_KEY)) || [];

    if (req.method === 'GET') {
      const sorted = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json({ orders: sorted });
    }

    if (req.method === 'POST') {
      const customerName = String(body.customerName || '').trim();
      const phone = String(body.phone || '').trim();
      if (!customerName || !phone) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'El cliente y el teléfono son obligatorios.' });
      }
      const order = normalizeOrder({ ...body, status: 'pending' });
      orders.push(order);
      await kvSet(ORDERS_KEY, orders);
      return res.status(201).json({ ok: true, order });
    }

    if (req.method === 'PUT') {
      const id = String(body.id || '');
      const index = orders.findIndex((o) => o.id === id);
      if (index === -1) return res.status(404).json({ error: 'NOT_FOUND', message: 'Orden no encontrada.' });

      const current = orders[index];
      if (body.status !== undefined && !VALID_STATUSES.has(body.status)) {
        return res.status(400).json({ error: 'INVALID_STATUS', message: 'Estado de orden inválido.' });
      }
      const updated = normalizeOrder({ ...current, ...body }, current);
      orders[index] = updated;
      await kvSet(ORDERS_KEY, orders);
      return res.status(200).json({ ok: true, order: updated });
    }

    if (req.method === 'DELETE') {
      const id = String(body.id || '');
      const filtered = orders.filter((o) => o.id !== id);
      if (filtered.length === orders.length) return res.status(404).json({ error: 'NOT_FOUND', message: 'Orden no encontrada.' });
      await kvSet(ORDERS_KEY, filtered);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (e) {
    console.error('orders api error', e);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Error interno del servidor.' });
  }
};
