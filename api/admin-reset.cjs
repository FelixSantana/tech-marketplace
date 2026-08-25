const { kvGet, kvDel, kvConfigured } = require('./_lib/kv.cjs');
const { AUTH_KEY } = require('./_lib/auth.cjs');

function getSecret(req) {
  const header = req.headers?.['x-admin-reset-secret'] || req.headers?.['X-Admin-Reset-Secret'];
  if (header) return String(header);
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return '';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Reset-Secret');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (!kvConfigured()) return res.status(503).json({ error: 'DB_NOT_CONNECTED', message: 'La base de datos aún no está conectada.' });

  const configuredSecret = String(process.env.ADMIN_RESET_SECRET || '');
  if (!configuredSecret) return res.status(503).json({ error: 'RESET_NOT_CONFIGURED', message: 'El reset administrativo no está habilitado.' });
  if (getSecret(req) !== configuredSecret) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Clave de reset inválida.' });

  try {
    const existing = await kvGet(AUTH_KEY);
    if (!existing) return res.status(404).json({ error: 'NOT_SETUP', message: 'No existe una cuenta de administrador.' });
    await kvDel(AUTH_KEY);
    return res.status(200).json({ ok: true, message: 'Cuenta de administrador restablecida. Ya puedes crear una nueva desde /admin.' });
  } catch (e) {
    console.error('admin reset error', e);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'No se pudo restablecer la cuenta.' });
  }
};
