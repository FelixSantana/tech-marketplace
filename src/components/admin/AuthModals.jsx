import { useState } from 'react';

export function SetupModal({ authRequest, setAdminToken, onSetupComplete, showToast, onGoLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes('@')) return showToast('Ingresa un correo válido');
    if (password.length < 6) return showToast('La contraseña debe tener al menos 6 caracteres');
    if (password !== confirm) return showToast('Las contraseñas no coinciden');
    setSaving(true);
    try {
      const r = await authRequest('setup', { email: normalizedEmail, password });
      if (!r.ok) { if (r.error === 'ALREADY_SETUP') return showToast('Ya existe un administrador. Usa “Ya tengo una cuenta” para iniciar sesión.'); return showToast(r.message || 'No se pudo crear la cuenta de administrador'); }
      setAdminToken(r.token);
      await onSetupComplete(r.token);
    } finally { setSaving(false); }
  };
  return <div className="overlay"><div className="panel login-panel setup-panel"><div className="login-badge"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z"/><path d="M9 12l2 2 4-4"/></svg></div><h2 className="login-title">Crear administrador</h2><p className="hint" style={{ marginBottom: 18 }}>Crea primero el acceso seguro. La configuración de la tienda se realiza después desde el panel.</p><div className="field"><label>Correo de administrador</label><div className="input-with-icon"><span>✉</span><input type="email" placeholder="tucorreo@ejemplo.com" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></div></div><div className="field"><label>Contraseña</label><input type="password" placeholder="Mínimo 6 caracteres" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div><div className="field"><label>Confirmar contraseña</label><input type="password" placeholder="Repite la contraseña" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSave()} /></div><button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Creando cuenta…' : 'Crear administrador'}</button>{onGoLogin && <button type="button" className="btn-secondary auth-switch" onClick={onGoLogin}>Ya tengo una cuenta · Iniciar sesión</button>}</div></div>;
}

export function LoginModal({ authRequest, setAdminToken, onLoginSuccess, onClose, showToast }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [saving, setSaving] = useState(false);
  const submit = async () => { if (!email.trim() || !password) return showToast('Completa correo y contraseña'); setSaving(true); try { const r = await authRequest('login', { email: email.trim().toLowerCase(), password }); if (!r.ok) return showToast(r.message || 'Correo o contraseña incorrectos'); setAdminToken(r.token); onLoginSuccess(); } finally { setSaving(false); } };
  return <div className="overlay"><div className="panel login-panel"><button className="icon-btn login-close" onClick={onClose}>✕</button><div className="login-badge"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div><h2 className="login-title">Acceso de administrador</h2><p className="login-sub">Inicia sesión para gestionar tu catálogo</p><div className="field"><label>Correo</label><div className="input-with-icon"><span>✉</span><input type="email" placeholder="tucorreo@ejemplo.com" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && document.getElementById('loginPasswordField')?.focus()} /></div></div><div className="field"><label>Contraseña</label><input id="loginPasswordField" type="password" placeholder="••••••••" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} /></div><button className="btn-primary login-submit" onClick={submit} disabled={saving}>{saving ? 'Entrando…' : 'Entrar'}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7"/></svg></button></div></div>;
}
