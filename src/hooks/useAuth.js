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
  return { adminToken, setAdminToken, authRequest };
}
