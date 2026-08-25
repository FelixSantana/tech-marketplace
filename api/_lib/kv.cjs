const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function kvGet(key) {
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
  if (!r.ok) throw new Error('KV GET failed: ' + r.status);
  const data = await r.json();
  if (!data || data.result === null || data.result === undefined) return null;
  try { return JSON.parse(data.result); } catch (e) { return null; }
}

async function kvSet(key, value) {
  const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'text/plain' }, body: JSON.stringify(value) });
  if (!r.ok) throw new Error('KV SET failed: ' + r.status);
  return true;
}

async function kvSetEx(key, value, seconds) {
  const ttl = Math.max(1, Math.floor(Number(seconds) || 1));
  const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}?EX=${ttl}`, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'text/plain' }, body: JSON.stringify(value) });
  if (!r.ok) throw new Error('KV SET EX failed: ' + r.status);
  return true;
}

function kvConfigured() { return !!(KV_URL && KV_TOKEN); }
module.exports = { kvGet, kvSet, kvSetEx, kvConfigured };
