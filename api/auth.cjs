const crypto = require('crypto');
const { kvGet, kvSet, kvConfigured } = require('./_lib/kv.cjs');
const { AUTH_KEY, TOKEN_TTL_MS, hashPassword, safeEqual, signToken, verifyToken, extractBearer } = require('./_lib/auth.cjs');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (!kvConfigured()) { return res.status(503).json({ error: 'DB_NOT_CONNECTED', message: 'La base de datos aún no está conectada.' }); }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const { action } = body;
  try {
    if (action === 'setup') {
      const existing = await kvGet(AUTH_KEY);
      if (existing) return res.status(409).json({ error: 'ALREADY_SETUP', message: 'Ya existe una cuenta de administrador.' });
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!email || email.indexOf('@') === -1) return res.status(400).json({ error: 'BAD_EMAIL', message: 'Ingresa un correo válido.' });
      if (password.length < 6) return res.status(400).json({ error: 'BAD_PASSWORD', message: 'La contraseña debe tener al menos 6 caracteres.' });
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashPassword(password, salt);
      const secret = crypto.randomBytes(32).toString('hex');
      await kvSet(AUTH_KEY, { email, salt, hash, secret });
      const token = signToken({ email, exp: Date.now() + TOKEN_TTL_MS }, secret);
      return res.status(200).json({ ok: true, token, email });
    }
    if (action === 'login') {
      const admin = await kvGet(AUTH_KEY);
      if (!admin) return res.status(400).json({ error: 'NOT_SETUP', message: 'Aún no se ha creado una cuenta de administrador.' });
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const hash = hashPassword(password, admin.salt);
      if (!safeEqual(email, admin.email) || !safeEqual(hash, admin.hash)) return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' });
      const token = signToken({ email: admin.email, exp: Date.now() + TOKEN_TTL_MS }, admin.secret);
      return res.status(200).json({ ok: true, token, email: admin.email });
    }
    if (action === 'change') {
      const admin = await kvGet(AUTH_KEY);
      if (!admin) return res.status(400).json({ error: 'NOT_SETUP' });
      const token = extractBearer(req);
      const payload = verifyToken(token, admin.secret);
      if (!payload) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Sesión inválida o expirada.' });
      const currentHash = hashPassword(String(body.currentPassword || ''), admin.salt);
      if (!safeEqual(currentHash, admin.hash)) return res.status(401).json({ error: 'WRONG_PASSWORD', message: 'La contraseña actual no es correcta.' });
      let changed = false;
      if (body.newEmail && String(body.newEmail).trim()) { admin.email = String(body.newEmail).trim().toLowerCase(); changed = true; }
      if (body.newPassword && String(body.newPassword).length >= 6) {
        const newSalt = crypto.randomBytes(16).toString('hex');
        admin.salt = newSalt; admin.hash = hashPassword(body.newPassword, newSalt); changed = true;
      }
      if (!changed) return res.status(400).json({ error: 'NOTHING_TO_CHANGE' });
      await kvSet(AUTH_KEY, admin);
      const newToken = signToken({ email: admin.email, exp: Date.now() + TOKEN_TTL_MS }, admin.secret);
      return res.status(200).json({ ok: true, token: newToken, email: admin.email });
    }
    return res.status(400).json({ error: 'BAD_ACTION' });
  } catch (e) { console.error('auth error', e); return res.status(500).json({ error: 'SERVER_ERROR' }); }
};
