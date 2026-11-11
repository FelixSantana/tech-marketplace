const { kvGet, kvSet, kvConfigured } = require('../_lib/kv.cjs');
const { AUTH_KEY, verifyToken, extractBearer } = require('../_lib/auth.cjs');
const { SUBS_KEY, configuracion, esSuscripcionValida, conSuscripcion, sinSuscripcion } = require('../_lib/push.cjs');
const { enviarATodos, sujeto } = require('../_lib/push-envio.cjs');

// Todo lo de aqui pide sesion de administrador, incluida la clave publica. La clave publica no
// es un secreto —el navegador la enseña igual—, pero nadie que no sea el dueño tiene nada que
// hacer en este endpoint, y una puerta menos abierta es una puerta menos que vigilar.
async function requireAdmin(req) {
  const admin = await kvGet(AUTH_KEY);
  if (!admin) return { ok: false, status: 503, error: 'ADMIN_NOT_CONFIGURED' };
  const token = extractBearer(req);
  if (!token || !verifyToken(token, admin.secret)) return { ok: false, status: 401, error: 'UNAUTHORIZED' };
  return { ok: true };
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (!kvConfigured()) return res.status(503).json({ error: 'DB_NOT_CONNECTED' });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = parseBody(req);
  const cfg = configuracion(process.env);

  try {
    // Que ofrecer en Ajustes: si la tienda no tiene claves, el panel lo dice en vez de enseñar
    // un boton que no puede funcionar.
    if (body.action === 'estado') {
      const subs = (await kvGet(SUBS_KEY)) || [];
      return res.status(200).json({ ok: true, listo: cfg.listo, clavePublica: cfg.listo ? cfg.publica : '', dispositivos: subs.length });
    }

    if (!cfg.listo) return res.status(503).json({ error: 'PUSH_NOT_CONFIGURED', message: 'Faltan las claves de notificación en el proyecto.' });

    if (body.action === 'suscribir') {
      if (!esSuscripcionValida(body.subscription)) return res.status(400).json({ error: 'BAD_SUBSCRIPTION', message: 'El navegador no entregó una suscripción válida.' });
      const subs = (await kvGet(SUBS_KEY)) || [];
      const siguiente = conSuscripcion(subs, body.subscription);
      await kvSet(SUBS_KEY, siguiente);
      return res.status(200).json({ ok: true, dispositivos: siguiente.length });
    }

    if (body.action === 'desuscribir') {
      const endpoint = String(body.endpoint || '');
      const subs = (await kvGet(SUBS_KEY)) || [];
      const siguiente = sinSuscripcion(subs, endpoint);
      await kvSet(SUBS_KEY, siguiente);
      return res.status(200).json({ ok: true, dispositivos: siguiente.length });
    }

    // Una prueba de verdad, que recorre el mismo camino que un pedido. Sin esto el dueño no
    // sabe si quedo activado hasta que alguien compre, y entonces ya es tarde para arreglarlo.
    if (body.action === 'probar') {
      const subs = (await kvGet(SUBS_KEY)) || [];
      if (!subs.length) return res.status(400).json({ error: 'NO_DEVICES', message: 'Todavía no hay ningún dispositivo activado.' });
      const { entregados, muertas } = await enviarATodos(
        subs,
        { title: 'Prueba de aviso', body: 'Así te va a llegar un pedido nuevo.', url: '/admin', tag: `prueba-${Date.now()}` },
        cfg,
        sujeto(cfg, req),
      );
      if (muertas.length) await kvSet(SUBS_KEY, subs.filter((s) => !muertas.includes(s.endpoint)));
      if (!entregados) return res.status(502).json({ error: 'PUSH_FAILED', message: 'No se pudo entregar el aviso. Vuelve a activarlo en este dispositivo.' });
      return res.status(200).json({ ok: true, entregados });
    }

    return res.status(400).json({ error: 'BAD_ACTION' });
  } catch (e) {
    console.error('push error', e);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'No se pudo procesar la solicitud de notificaciones.' });
  }
};
