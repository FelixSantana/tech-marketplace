import { useState, useCallback } from 'react';

const AUTH_API = '/api/auth';
const TOKEN_KEY = 'admin_token';
function readToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }

export function useAuth() {
  const [adminToken, setAdminTokenState] = useState(readToken);
  const setAdminToken = useCallback((token) => {
    setAdminTokenState(token || '');
    try { if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  }, []);
  const authRequest = useCallback(async (action, payload) => {
    try {
      const r = await fetch(AUTH_API, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(adminToken ? { Authorization: 'Bearer ' + adminToken } : {}) }, body: JSON.stringify({ action, ...payload }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, error: data.error, message: data.message };
      return { ok: true, ...data };
    } catch (e) {
      console.error('authRequest failed', e);
      return { ok: false, message: 'No se pudo conectar con el servidor.' };
    }
  }, [adminToken]);
  // Sin el token entre sus dependencias: es publica y asi la referencia no cambia nunca, que
  // es lo que permite usarla en el efecto de arranque sin reejecutarlo al iniciar sesion.
  const authStatus = useCallback(async () => {
    try {
      const r = await fetch(AUTH_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status' }) });
      const data = await r.json().catch(() => ({}));
      return r.ok ? { ok: true, configured: !!data.configured } : { ok: false };
    } catch (e) {
      console.error('authStatus failed', e);
      return { ok: false };
    }
  }, []);

  return { adminToken, setAdminToken, authRequest, authStatus };
}
