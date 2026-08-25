import { useState } from 'react';

export function SetupModal({ settings, authRequest, setAdminToken, onSetupComplete, showToast }) {
  const [storeName, setStoreName] = useState(settings.storeName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSave = async () => {
    if (!whatsapp.trim()) return showToast('Ingresa un número de WhatsApp');
    if (!email.includes('@')) return showToast('Ingresa un correo válido');
    if (password.length < 6) return showToast('La contraseña debe tener al menos 6 caracteres');
    const r = await authRequest('setup', { email, password });
    if (!r.ok) return showToast(r.message || 'No se pudo crear la cuenta de administrador');
    setAdminToken(r.token);
    onSetupComplete({ storeName: storeName.trim() || 'Synaptic Tech', tagline: tagline.trim(), whatsapp: whatsapp.trim(), configured: true });
  };

  return (
    <div className="overlay">
      <div className="panel login-panel" style={{ maxWidth: 440, textAlign: 'left' }}>
        <div className="login-badge" style={{ margin: '4px 0 16px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-6 9 6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>
        </div>
        <h2 className="login-title">Configura tu tienda</h2>
        <p className="hint" style={{ marginBottom: 16 }}>Esto solo toma un minuto. Estos datos se usan para armar el catálogo y el enlace de WhatsApp de tus clientes.</p>
        <div className="field"><label>Nombre de la tienda</label><input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} /></div>
        <div className="field"><label>Frase corta (tagline)</label><input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
        <div className="field"><label>Número de WhatsApp de la tienda</label><input type="tel" placeholder="8091234567" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /><div className="hint">Ingresa el número con código de área, sin guiones (ej. 8091234567). Los pedidos llegarán a este número.</div></div>
        <div className="field"><label>Correo de administrador</label><input type="email" placeholder="tucorreo@ejemplo.com" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>Contraseña de administrador</label><input type="password" placeholder="Mínimo 6 caracteres" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /><div className="hint">Con esto entrarás al panel de administrador. Guárdala en un lugar seguro.</div></div>
        <button className="btn-primary" onClick={handleSave}>Guardar y continuar</button>
      </div>
    </div>
  );
}

export function LoginModal({ authRequest, setAdminToken, onLoginSuccess, onClose, showToast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async () => {
    if (!email || !password) return showToast('Completa correo y contraseña');
    let r = await authRequest('login', { email, password });
    if (!r.ok && r.error === 'NOT_SETUP') { r = await authRequest('setup', { email, password }); }
    if (!r.ok) return showToast(r.message || 'Correo o contraseña incorrectos');
    setAdminToken(r.token);
    onLoginSuccess();
  };

  return (
    <div className="overlay">
      <div className="panel login-panel">
        <button className="icon-btn login-close" onClick={onClose}>✕</button>
        <div className="login-badge"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></div>
        <h2 className="login-title">Acceso de administrador</h2>
        <p className="login-sub">Inicia sesión para gestionar tu catálogo</p>
        <div className="field"><label>Correo</label><input type="email" placeholder="tucorreo@ejemplo.com" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && document.getElementById('loginPasswordField')?.focus()} /></div>
        <div className="field"><label>Contraseña</label><input id="loginPasswordField" type="password" placeholder="••••••••" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} /></div>
        <button className="btn-primary login-submit" onClick={submit}>Entrar<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7" /></svg></button>
      </div>
    </div>
  );
}
