const { kvGet, kvSet, kvSetEx, kvConfigured } = require('./_lib/kv.cjs');
const { AUTH_KEY, verifyToken, extractBearer } = require('./_lib/auth.cjs');

const ORDERS_KEY = 'synaptic_orders';
const CATALOG_KEY = 'synaptic_catalog';
const RATE_LIMIT = 8;
const RATE_WINDOW_SECONDS = 60;

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

async function requireAdmin(req) {
  const admin = await kvGet(AUTH_KEY);
  if (!admin) return { ok: false, status: 503, error: 'ADMIN_NOT_CONFIGURED' };
  const token = extractBearer(req);
  if (!token || !verifyToken(token, admin.secret)) return { ok: false, status: 401, error: 'UNAUTHORIZED' };
  return { ok: true };
}

function clientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'] || req.headers?.['X-Forwarded-For'] || '';
  return String(forwarded).split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
}

async function rateLimitPublic(req) {
  const bucket = Math.floor(Date.now() / (RATE_WINDOW_SECONDS * 1000));
  const key = `synaptic_order_rate:${clientIp(req)}:${bucket}`;
  const current = await kvGet(key);
  const count = Number(current?.count || 0) + 1;
  if (count > RATE_LIMIT) return false;
  await kvSetEx(key, { count }, RATE_WINDOW_SECONDS + 10);
  return true;
}

function cleanPhone(value) { return String(value || '').replace(/\D/g, '').slice(0, 20); }
function cleanText(value, max = 500) { return String(value || '').trim().slice(0, max); }
function money(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; }

async function getCatalog() {
  return (await kvGet(CATALOG_KEY)) || { products: [], settings: {} };
}

function catalogMap(catalog) {
  return new Map((catalog.products || []).map((p) => [String(p.id), p]));
}

function buildPublicItems(inputItems, catalog) {
  const map = catalogMap(catalog);
  if (!Array.isArray(inputItems) || !inputItems.length) throw new Error('ORDER_PRODUCTS_REQUIRED');
  const items = [];
  for (const raw of inputItems) {
    const product = map.get(String(raw.productId || raw.id));
    const quantity = Math.floor(Number(raw.quantity || raw.qty || 0));
    if (!product || quantity < 1 || quantity > 999) throw new Error('INVALID_PRODUCT');
    const available = Number(product.stockQty ?? product.stock ?? 0);
    if (available >= 0 && quantity > available) throw new Error('INSUFFICIENT_STOCK');
    const unitPrice = money(product.price);
    items.push({ productId: product.id, name: cleanText(product.name, 180), quantity, unitPrice, subtotal: money(unitPrice * quantity) });
  }
  return items;
}

function buildAdminItems(inputItems, catalog) {
  const map = catalogMap(catalog);
  if (!Array.isArray(inputItems) || !inputItems.length) throw new Error('ORDER_PRODUCTS_REQUIRED');
  return inputItems.map((raw) => {
    const product = map.get(String(raw.productId || raw.id));
    if (!product) throw new Error('INVALID_PRODUCT');
    const quantity = Math.max(1, Math.floor(Number(raw.quantity || raw.qty || 1)));
    const unitPrice = money(raw.unitPrice ?? raw.price ?? product.price);
    return { productId: product.id, name: cleanText(raw.name || product.name, 180), quantity, unitPrice, subtotal: money(unitPrice * quantity) };
  });
}

function makeOrder(body, items, source) {
  const total = money(items.reduce((sum, item) => sum + item.subtotal, 0));
  const now = new Date().toISOString();
  return {
    id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    customerName: cleanText(body.customerName || body.name, 120),
    phone: cleanPhone(body.phone || body.customerPhone),
    products: items,
    total,
    status: 'pending',
    paymentStatus: 'pending',
    shippingStatus: 'pending',
    notes: cleanText(body.notes, 1000),
    source,
    createdAt: now,
    updatedAt: now
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!kvConfigured()) return res.status(503).json({ error: 'DB_NOT_CONNECTED' });

  try {
    const body = parseBody(req);
    const isPublicCreate = req.method === 'POST' && body.source === 'whatsapp_checkout';

    if (isPublicCreate) {
      if (!(await rateLimitPublic(req))) return res.status(429).json({ error: 'RATE_LIMIT', message: 'Demasiados pedidos. Intenta nuevamente en un minuto.' });
      const customerName = cleanText(body.customerName || body.name, 120);
      const phone = cleanPhone(body.phone || body.customerPhone);
      if (customerName.length < 2 || phone.length < 8) return res.status(400).json({ error: 'INVALID_CUSTOMER', message: 'Nombre y WhatsApp son obligatorios.' });
      const catalog = await getCatalog();
      const items = buildPublicItems(body.products, catalog);
      const order = makeOrder({ ...body, customerName, phone }, items, 'whatsapp_checkout');
      const orders = (await kvGet(ORDERS_KEY)) || [];
      orders.unshift(order);
      await kvSet(ORDERS_KEY, orders.slice(0, 1000));
      return res.status(201).json({ ok: true, order: { id: order.id, total: order.total, status: order.status } });
    }

    const auth = await requireAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const orders = (await kvGet(ORDERS_KEY)) || [];
    if (req.method === 'GET') return res.status(200).json({ orders });

    if (req.method === 'POST') {
      const catalog = await getCatalog();
      const items = buildAdminItems(body.products, catalog);
      const customerName = cleanText(body.customerName || body.name, 120);
      const phone = cleanPhone(body.phone || body.customerPhone);
      if (customerName.length < 2) return res.status(400).json({ error: 'INVALID_CUSTOMER' });
      const order = makeOrder({ ...body, customerName, phone }, items, 'manual');
      orders.unshift(order);
      await kvSet(ORDERS_KEY, orders.slice(0, 1000));
      return res.status(201).json({ ok: true, order });
    }

    const id = cleanText(body.id, 100);
    if (!id) return res.status(400).json({ error: 'ORDER_ID_REQUIRED' });
    const index = orders.findIndex((o) => o.id === id);
    if (index < 0) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });

    if (req.method === 'DELETE') {
      orders.splice(index, 1);
      await kvSet(ORDERS_KEY, orders);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'PUT') {
      const catalog = await getCatalog();
      const current = orders[index];
      const next = { ...current };
      if (body.customerName !== undefined) next.customerName = cleanText(body.customerName, 120);
      if (body.phone !== undefined) next.phone = cleanPhone(body.phone);
      if (body.notes !== undefined) next.notes = cleanText(body.notes, 1000);
      if (body.status !== undefined && ['pending', 'paid', 'shipped', 'completed', 'cancelled'].includes(body.status)) next.status = body.status;
      if (body.paymentStatus !== undefined && ['pending', 'paid', 'refunded'].includes(body.paymentStatus)) next.paymentStatus = body.paymentStatus;
      if (body.shippingStatus !== undefined && ['pending', 'shipped', 'delivered', 'cancelled'].includes(body.shippingStatus)) next.shippingStatus = body.shippingStatus;
      if (Array.isArray(body.products)) next.products = buildAdminItems(body.products, catalog);
      next.total = money(next.products.reduce((sum, item) => sum + item.subtotal, 0));
      next.updatedAt = new Date().toISOString();
      orders[index] = next;
      await kvSet(ORDERS_KEY, orders);
      return res.status(200).json({ ok: true, order: next });
    }

    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (e) {
    const messages = {
      ORDER_PRODUCTS_REQUIRED: 'Agrega al menos un producto.',
      INVALID_PRODUCT: 'Uno de los productos ya no existe en el catálogo.',
      INSUFFICIENT_STOCK: 'La cantidad solicitada supera el stock disponible.'
    };
    const message = messages[e.message];
    if (message) return res.status(400).json({ error: e.message, message });
    console.error('orders error', e);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'No se pudo procesar la orden.' });
  }
};
