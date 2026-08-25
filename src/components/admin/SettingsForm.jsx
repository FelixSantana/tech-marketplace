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

  const currentLogo = pendingLogo !== undefined ? pendingLogo : settings.logo;

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { setPendingLogo(await compressImage(file)); } catch { showToast('No se pudo procesar el logo'); }
  };

  const handleSaveSettings = async () => {
    if (!whatsapp.trim()) return showToast('El número de WhatsApp no puede estar vacío');
    const ok = await onSaveSettings({ storeName: storeName.trim() || 'Synaptic Tech', tagline: tagline.trim(), whatsapp: whatsapp.trim(), currency: currency.trim() || 'RD$', ...(pendingLogo !== undefined ? { logo: pendingLogo || '' } : {}) });
    if (ok) { showToast('Ajustes guardados'); setPendingLogo(undefined); }
  };

  const handleSaveCreds = async () => {
    if (!curPassword) return showToast('Ingresa tu contraseña actual');
    if (!newEmail && !newPassword) return showToast('No hay cambios para guardar');
    const r = await authRequest('change', { currentPassword: curPassword, newEmail, newPassword });
    if (!r.ok) return showToast(r.message || 'No se pudo actualizar el acceso');
    setAdminToken(r.token);
    setCurPassword(''); setNewEmail(''); setNewPassword('');
    showToast('Acceso actualizado');
  };

  return (
    <>
      <div className="field">
        <label>Logo de la tienda</label>
        <div className="img-upload">
          <div className="img-preview">{currentLogo ? <img src={currentLogo} alt="" /> : 'ST'}</div>
          <label className="upload-btn">Subir logo<input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} /></label>
          {currentLogo && (<button type="button" className="icon-btn" title="Quitar logo" onClick={() => setPendingLogo(null)}>✕</button>)}
        </div>
        <div className="hint">Se muestra junto al nombre de tu tienda en el catálogo, en lugar de las iniciales "ST".</div>
      </div>
      <div className="field"><label>Nombre de la tienda</label><input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} /></div>
      <div className="field"><label>Frase corta (tagline)</label><input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
      <div className="field"><label>Número de WhatsApp</label><input type="tel" placeholder="8091234567" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></div>
      <div className="field"><label>Moneda</label><input type="text" placeholder="RD$" value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
      <button className="btn-primary" onClick={handleSaveSettings}>Guardar ajustes</button>
      <div className="panel-head" style={{ marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 18 }}><h2 style={{ fontSize: 15 }}>Acceso de administrador</h2></div>
      <div className="field"><label>Contraseña actual (requerida para cualquier cambio de acceso)</label><input type="password" placeholder="Tu contraseña actual" autoComplete="current-password" value={curPassword} onChange={(e) => setCurPassword(e.target.value)} /></div>
      <div className="field"><label>Nuevo correo (déjalo vacío para no cambiarlo)</label><input type="email" placeholder="nuevo@correo.com" autoComplete="username" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
      <div className="field"><label>Nueva contraseña (déjalo vacío para no cambiarla)</label><input type="password" placeholder="Mínimo 6 caracteres" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
      <button className="btn-primary" onClick={handleSaveCreds}>Guardar cambios de acceso</button>
      <button className="btn-secondary" onClick={onLogout}>Cerrar sesión</button>
    </>
  );
}
