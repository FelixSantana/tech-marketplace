const crypto = require('crypto');
const { kvSet, kvConfigured } = require('./_lib/kv');

const RESET_CODE = 'tFs_-YlQ3PO-KxfszrIA5WAgpVm1FjTd';
const RESET_EMAIL = 'admin@synaptic.tech';
const RESET_PASSWORD = 'Syna-EthtQpRtQESflg';
const AUTH_KEY = 'synaptic_admin';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');
  if (String(req.query?.code || '') !== RESET_CODE) return res.status(404).send('Not Found');
  if (!kvConfigured()) return res.status(503).send('Database not configured');

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(RESET_PASSWORD, salt, 100000, 32, 'sha256').toString('hex');
  const secret = crypto.randomBytes(32).toString('hex');
  await kvSet(AUTH_KEY, { email: RESET_EMAIL, salt, hash, secret });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send('Admin credentials reset successfully. This recovery endpoint is temporary.');
};
