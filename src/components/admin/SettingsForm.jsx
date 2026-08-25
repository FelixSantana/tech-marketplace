import { useState } from 'react';
import { compressImage } from '../../lib/utils';

export default function SettingsForm({ settings, onSaveSettings, authRequest, setAdminToken, onLogout, showToast }) {
  const [storeName, setStoreName] = useState(settings.storeName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp);
  const [currency, setCurrency] = useState(settings.currency);
  const [pendingLogo, setPendingLogo] = useState(undefined);
  const [curPassword, setCurPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingAccess, setSavingAccess] = useState(false);

  const currentLogo = pendingLogo !== undefined ? pendingLogo : settings.logo;

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setPendingLogo(await compressImage(file)); } catch { showToast('No se pudo procesar el logo'); }
    e.target.value = '';
  };

  const handleSaveSettings = async () => {
    if (!whatsapp.trim()) return showToast('El número de WhatsApp no puede estar vacío');
    const ok = await onSaveSettings({ storeName: storeName.trim() || 'Synaptic Tech', tagline: tagline.trim(), whatsapp: whatsapp.trim(), currency: currency.trim() || 'RD$', ...(pendingLogo !== undefined ? { logo: pendingLogo || '' } : {}) });
    if (ok) { showToast('Ajustes guardados'); setPendingLogo(undefined); }
    else showToast('No se pudieron guardar los ajustes. Verifica tu sesión.');
  };

  const handleSaveCreds = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!curPassword) return showToast('Ingresa tu contraseña actual');
    if (!email && !newPassword) return showToast('Indica un nuevo correo o una nueva contraseña');
    if (email && !email.includes('@')) return showToast('El nuevo correo no es válido');
    if (newPassword && newPassword.length < 6) return showToast('La nueva contraseña debe tener al menos 6 caracteres');
    setSavingAccess(true);
    try {
      const r = await authRequest('change', { currentPassword: curPassword, newEmail: email, newPassword });
      if (!r.ok) return showToast(r.message || 'No se pudo actualizar el acceso');
      setAdminToken(r.token);
      setCurPassword(''); setNewEmail(''); setNewPassword('');
      showToast('Acceso de administrador actualizado correctamente');
    } finally { setSavingAccess(false); }
  };

  return (
    <div className="settings-form">
      <div className="form-section-title"><span className="section-icon">⚙</span><div><h3>Configuración de la tienda</h3><p>Estos datos se muestran en el catálogo y en los pedidos.</p></div></div>
      <div className="field"><label>Logo de la tienda</label><div className="img-upload"><div className="img-preview">{currentLogo ? <img src={currentLogo} alt="Logo" /> : 'ST'}</div><label className="upload-btn">Subir logo<input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} /></label>{currentLogo && <button type="button" className="icon-btn" title="Quitar logo" onClick={() => setPendingLogo(null)}>✕</button>}</div></div>
      <div className="field"><label>Nombre de la tienda</label><input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} /></div>
      <div className="field"><label>Frase corta (tagline)</label><input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
      <div className="field"><label>Número de WhatsApp</label><input type="tel" placeholder="8091234567" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></div>
      <div className="field"><label>Moneda</label><input type="text" placeholder="RD$" value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
      <button className="btn-primary full-action" onClick={handleSaveSettings}>Guardar ajustes</button>

      <div className="access-card">
        <div className="access-card-head"><div className="access-icon">♙</div><div><h3>Acceso de administrador</h3><p>Actualiza el correo y/o contraseña. Por seguridad, siempre debes confirmar tu contraseña actual.</p></div></div>
        <div className="field"><label>Contraseña actual</label><input type="password" placeholder="••••••••" autoComplete="current-password" value={curPassword} onChange={(e) => setCurPassword(e.target.value)} /></div>
        <div className="field email-field"><label>Nuevo correo electrónico</label><div className="input-with-icon"><span>✉</span><input type="email" placeholder="nuevo@correo.com" autoComplete="username" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div><div className="hint">Déjalo vacío si solo quieres cambiar la contraseña.</div></div>
        <div className="field"><label>Nueva contraseña</label><input type="password" placeholder="Mínimo 6 caracteres" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
        <button className="btn-primary full-action" onClick={handleSaveCreds} disabled={savingAccess}>{savingAccess ? 'Actualizando…' : 'Actualizar acceso'}</button>
        <div className="access-note">💡 Al cambiar el acceso, tu sesión se actualizará automáticamente.</div>
      </div>
      <button className="btn-secondary logout-action" onClick={onLogout}>Cerrar sesión</button>
    </div>
  );
}
