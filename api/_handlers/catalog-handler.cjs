const { kvGet, kvSet, kvConfigured } = require('../_lib/kv.cjs');
const { AUTH_KEY, verifyToken, extractBearer } = require('../_lib/auth.cjs');
const { catalogVersion, prepareCatalogWrite, bumpVersion } = require('../_lib/catalog-logic.cjs');
const { agregarRespaldo, conFotosDe, resumenDeRespaldos } = require('../_lib/backup-logic.cjs');
const CATALOG_KEY = 'synaptic_catalog';
const RESERVED_KEY = 'synaptic_reservas';
const BACKUP_KEY = 'synaptic_catalog_bak';
const DEFAULT_DATA = {
  settings: { storeName: 'Synaptic Tech', tagline: 'Tecnología al alcance de tu WhatsApp', whatsapp: '', currency: 'RD$', logo: '', configured: false },
  products: [],
  categories: [{ name: 'Laptops', emoji: '💻' }, { name: 'Celulares', emoji: '📱' }, { name: 'Accesorios', emoji: '🎧' }, { name: 'Servicios', emoji: '🛠️' }]
};
// El historial es una red de seguridad, no parte del guardado: si Redis falla al escribirlo, el
// catalogo ya quedo guardado y no se le devuelve un error al admin por eso.
async function respaldar(catalog) {
  try {
    const lista = (await kvGet(BACKUP_KEY)) || [];
    const proxima = agregarRespaldo(lista, catalog);
    if (proxima !== lista) await kvSet(BACKUP_KEY, proxima);
  } catch { /* el historial puede esperar; el catalogo no */ }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!kvConfigured()) return res.status(503).json({ error: 'DB_NOT_CONNECTED' });
  try {
    // reservas viaja junto al catalogo para que la tienda muestre lo disponible, no el stock en
    // bodega. No se guarda dentro del catalogo: lo mantiene el manejador de ordenes.
    if (req.method === 'GET' && req.query && req.query.respaldos) {
      const admin = await kvGet(AUTH_KEY);
      if (!admin || !verifyToken(extractBearer(req), admin.secret)) return res.status(401).json({ error: 'UNAUTHORIZED' });
      return res.status(200).json({ respaldos: resumenDeRespaldos((await kvGet(BACKUP_KEY)) || []) });
    }
    if (req.method === 'GET') { const data = (await kvGet(CATALOG_KEY)) || DEFAULT_DATA; const reservas = (await kvGet(RESERVED_KEY)) || {}; return res.status(200).json({ ...data, reservas }); }
    if (req.method === 'POST') {
      const admin = await kvGet(AUTH_KEY);
      if (!admin) return res.status(400).json({ error: 'NOT_SETUP' });
      const token = extractBearer(req);
      if (!verifyToken(token, admin.secret)) return res.status(401).json({ error: 'UNAUTHORIZED' });
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      // Restaurar: el catalogo de hoy se respalda primero, asi que restaurar tambien se deshace.
      if (body && body.accion === 'restaurar') {
        const lista = (await kvGet(BACKUP_KEY)) || [];
        const elegido = lista.find((r) => String(r.ts) === String(body.ts));
        if (!elegido) return res.status(404).json({ error: 'BACKUP_NOT_FOUND' });
        const actual = (await kvGet(CATALOG_KEY)) || DEFAULT_DATA;
        await respaldar(actual);
        const restaurado = bumpVersion({ ...conFotosDe(elegido.data, actual), version: catalogVersion(actual) });
        await kvSet(CATALOG_KEY, restaurado);
        return res.status(200).json({ ok: true, version: restaurado.version });
      }
      if (!body || !body.settings) return res.status(400).json({ error: 'BAD_REQUEST' });
      // Solo se acepta un guardado que parta de la ultima version: una copia vieja del panel
      // no puede pisar un descuento de stock hecho al completar una orden.
      const stored = await kvGet(CATALOG_KEY);
      let next;
      try { next = prepareCatalogWrite(stored, body); }
      catch { return res.status(409).json({ error: 'CATALOG_CONFLICT', message: 'El catálogo cambió mientras editabas.', version: catalogVersion(stored) }); }
      await kvSet(CATALOG_KEY, next);
      await respaldar(next);
      return res.status(200).json({ ok: true, version: next.version });
    }
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch { return res.status(500).json({ error: 'SERVER_ERROR' }); }
};
