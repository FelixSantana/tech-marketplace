const crypto = require('crypto');
const AUTH_KEY = 'synaptic_admin';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
function hashPassword(password, salt) { return crypto.pbkdf2Sync(String(password), salt, 100000, 32, 'sha256').toString('hex'); }
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8'); const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
function b64url(buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function signToken(payload, secret) {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}
function verifyToken(token, secret) {
  if (!token || typeof token !== 'string' || token.indexOf('.') === -1) return null;
  const parts = token.split('.'); const body = parts[0]; const sig = parts[1];
  const expectedSig = b64url(crypto.createHmac('sha256', secret).update(body).digest());
  if (!safeEqual(sig, expectedSig)) return null;
  try {
    const json = Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    const payload = JSON.parse(json);
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (e) { return null; }
}
function extractBearer(req) { const h = (req.headers && req.headers['authorization']) || ''; return h.startsWith('Bearer ') ? h.slice(7) : ''; }
module.exports = { AUTH_KEY, TOKEN_TTL_MS, hashPassword, safeEqual, signToken, verifyToken, extractBearer };
