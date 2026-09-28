import { useState, useCallback } from 'react';
import { tokenVencido } from '../lib/token';

const AUTH_API = '/api/auth';
const TOKEN_KEY = 'admin_token';
// Una sesion vencida se tira al arrancar en vez de arrastrarla. Antes el panel abria
// igual y se portaba con normalidad hasta que una accion fallaba con 401, asi que el
// dueño creia tener sesion cuando no la tenia.
function readToken() {
  try {
    const guardado = localStorage.getItem(TOKEN_KEY) || '';
    if (guardado && tokenVencido(guardado)) { localStorage.removeItem(TOKEN_KEY); return ''; }
    return guardado;
  } catch { return ''; }
}

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
