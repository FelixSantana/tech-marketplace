import { useId, useState } from 'react';
import { compressImage } from '../../lib/utils';
import { uploadImage } from '../../lib/uploadImage';
import { derivarDeLogo, CAMPOS_DE_MARCA } from '../../lib/marca';
import { normalizarColor, colorDeMarca, tintaSobre, COLOR_POR_DEFECTO } from '../../lib/color';
import ShippingForm from './ShippingForm';
import CouponsForm from './CouponsForm';
import BackupsPanel from './BackupsPanel';
import { cuponesDeAjustes } from '../../lib/cupones';
import { ajustesDeEnvio } from '../../lib/envio';
import { diasQueLeQuedan } from '../../lib/token';
import { datosDeNegocio, limpiarNegocio } from '../../lib/negocio';

export default function SettingsForm({ settings, onSaveSettings, authRequest, adminToken, setAdminToken, refreshCatalog, onLogout, showToast }) {
  const [storeName, setStoreName] = useState(settings.storeName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp);
  const [currency, setCurrency] = useState(settings.currency);
  const [colorMarca, setColorMarca] = useState(() => colorDeMarca(settings));
  const [envio, setEnvio] = useState(() => ajustesDeEnvio(settings));
  const [cupones, setCupones] = useState(() => cuponesDeAjustes(settings));
  // Las formas de pago se editan como una linea separada por comas: son tres palabras que se
  // tocan una vez al año, y no justifican una tabla con botones de agregar y quitar.
  const [negocio, setNegocio] = useState(() => { const n = datosDeNegocio(settings); return { ...n, pagos: n.pagos.join(', ') }; });
  const [pendingLogo, setPendingLogo] = useState(undefined);
  // Las imagenes derivadas del logo viajan aparte del logo, con la misma convencion: `undefined`
  // es "no se toco en esta sesion", `null` es "quitalas".
  const [pendingMarca, setPendingMarca] = useState(undefined);
  const [derivando, setDerivando] = useState(false);
  const [curPassword, setCurPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingAccess, setSavingAccess] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const diasRestantes = diasQueLeQuedan(adminToken);
  const uid = useId();

  const currentLogo = pendingLogo !== undefined ? pendingLogo : settings.logo;
  const marcaActual = pendingMarca !== undefined ? pendingMarca : settings.marca;

  // Del logo se derivan la imagen que sale al compartir la tienda (1200x630) y los tres iconos de
  // la aplicacion instalable. Asi el cliente sube UNA imagen y no cuatro: nadie tiene a mano un
  // archivo de 1200x630 con su logo centrado, y pedirselo deja la tienda a medio montar.
  //
  // Si alguna no llega al almacen se descartan las cuatro. uploadImage, cuando no puede subir,
  // devuelve la imagen incrustada para que el panel siga funcionando; eso vale para un logo de
  // 520px, pero meter en el catalogo una imagen de 1200x630 y tres iconos lo engordaria para todos
  // los visitantes, y el catalogo bajo de 867 KB a 17 KB justamente sacando las fotos de ahi.
  const subirMarca = async (file) => {
    const derivadas = await derivarDeLogo(file, storeName.trim());
    const subidas = await Promise.all(CAMPOS_DE_MARCA.map(async (campo) => {
      const r = await uploadImage(derivadas[campo], adminToken, 'marca');
      return [campo, r.error || r.incrustada ? '' : r.url];
    }));
    if (subidas.some(([, url]) => !url)) {
      showToast('El logo se guardó, pero las imágenes de marca necesitan el almacén de fotos.');
      return null;
    }
    return Object.fromEntries(subidas);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDerivando(true);
    try {
      const subida = await uploadImage(await compressImage(file), adminToken, 'logo');
      if (subida.error) { showToast(subida.error); return; }
      setPendingLogo(subida.url);
      if (subida.incrustada) showToast('El logo quedó dentro del catálogo: el almacén de imágenes no está disponible.');
      // Se parte del archivo original, no del logo ya comprimido a 520px: la imagen de compartir
      // mide 1200 de ancho y agrandar desde 520 se nota.
      setPendingMarca(await subirMarca(file));
    } catch { showToast('No se pudo procesar el logo'); }
    finally { setDerivando(false); }
  };

  const quitarLogo = () => { setPendingLogo(null); setPendingMarca(null); };

  const handleSaveSettings = async () => {
    if (!whatsapp.trim()) return showToast('El número de WhatsApp no puede estar vacío');
    if (envio.activo && !envio.retiroEnTienda && !(envio.zonas || []).length) return showToast('Agrega al menos una zona de envío, o permite el retiro en tienda');
    if (envio.activo && (envio.zonas || []).some((z) => !String(z.nombre || '').trim())) return showToast('Cada zona de envío necesita un nombre');
    if (envio.activo && envio.retiroEnTienda && !String(envio.direccionTienda || '').trim()) return showToast('Escribe la dirección de la tienda para el retiro');
    const envioLimpio = {
      activo: envio.activo === true,
      zonas: (envio.zonas || []).map((z) => ({ id: z.id, nombre: String(z.nombre || '').trim(), precio: Math.max(0, Number(z.precio) || 0) })),
      retiroEnTienda: envio.retiroEnTienda === true,
      direccionTienda: String(envio.direccionTienda || '').trim(),
      pedidoMinimo: Math.max(0, Number(envio.pedidoMinimo) || 0),
    };
    if (cupones.some((c) => !String(c.codigo || '').trim())) return showToast('Cada cupón necesita un código');
    const codigos = cupones.map((c) => String(c.codigo).toUpperCase());
    if (new Set(codigos).size !== codigos.length) return showToast('Hay dos cupones con el mismo código');
    if (cupones.some((c) => !(Number(c.valor) > 0))) return showToast('Cada cupón necesita un valor mayor que cero');
    const cuponesLimpios = cupones.map((c) => ({ id: c.id, codigo: String(c.codigo).toUpperCase().trim(), tipo: c.tipo === 'monto' ? 'monto' : 'porcentaje', valor: Math.max(0, Number(c.valor) || 0), vence: c.vence || '', minimo: Math.max(0, Number(c.minimo) || 0), activo: c.activo !== false }));
    const ok = await onSaveSettings({ negocio: limpiarNegocio(negocio), cupones: cuponesLimpios, storeName: storeName.trim(), tagline: tagline.trim(), whatsapp: whatsapp.trim(), currency: currency.trim() || 'RD$', envio: envioLimpio, colorMarca: normalizarColor(colorMarca), ...(pendingLogo !== undefined ? { logo: pendingLogo || '' } : {}), ...(pendingMarca !== undefined ? { marca: pendingMarca || {} } : {}) });
    if (ok) { showToast('Ajustes guardados'); setPendingLogo(undefined); setPendingMarca(undefined); }
    else showToast('No se pudieron guardar los ajustes. Verifica tu sesión.');
  };

  // El token de sesion hace falta para los scripts de mantenimiento del catalogo. Sacarlo a
  // mano obligaba a abrir la consola del navegador, y ahi Chrome avisa —con razon— de que pegar
  // codigo que uno no entiende es como darle las llaves a un desconocido. Un boton evita el viaje.
  const copiarToken = async () => {
    try {
      await navigator.clipboard.writeText(adminToken || '');
      setCopiado(true);
      setTimeout(() => setCopiado(false), 4000);
      showToast('Token copiado. Pégalo solo en tu terminal.');
    } catch { showToast('No se pudo copiar. Revisa los permisos del navegador.'); }
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
      <div className="field"><label htmlFor={`${uid}-logo`}>Logo de la tienda</label><div className="img-upload"><div className="img-preview">{currentLogo ? <img src={currentLogo} alt="Logo" /> : 'ST'}</div><label className="upload-btn">{derivando ? 'Procesando…' : 'Subir logo'}<input id={`${uid}-logo`} type="file" accept="image/*" disabled={derivando} style={{ display: 'none' }} onChange={handleLogoUpload} /></label>{currentLogo && <button type="button" className="icon-btn" title="Quitar logo" onClick={quitarLogo}>✕</button>}</div></div>
      {/* La vista previa existe porque lo que se comparte por WhatsApp no se puede comprobar de
          otra forma: la imagen se dibuja en el navegador a partir del logo, y hasta que alguien la
          mira nadie sabe si el logo quedo centrado o el nombre cabe. Aqui se ve antes de guardar. */}
      {marcaActual && marcaActual.ogImage && (
        <div className="field marca-preview">
          {/* Un <span> y no un <label>: aqui no hay ningun control que etiquetar, y la revision de
              accesibilidad dejo todas las etiquetas asociadas a su campo a proposito. */}
          <span className="marca-preview-title">Así se verá al compartir la tienda</span>
          <img src={marcaActual.ogImage} alt="Vista previa de la tienda al compartirla" />
          <p className="hint">Se genera del logo. Vuelve a subirlo si cambias el nombre de la tienda.</p>
        </div>
      )}
      <div className="field"><label htmlFor={`${uid}-store`}>Nombre de la tienda</label><input id={`${uid}-store`} type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} /></div>
      <div className="field"><label htmlFor={`${uid}-tagline`}>Frase corta (tagline)</label><input id={`${uid}-tagline`} type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} /></div>
      <div className="field"><label htmlFor={`${uid}-wa`}>Número de WhatsApp</label><input id={`${uid}-wa`} type="tel" placeholder="8091234567" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></div>
      <div className="field"><label htmlFor={`${uid}-currency`}>Moneda</label><input id={`${uid}-currency`} type="text" placeholder="RD$" value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
      {/* El color de marca. El selector nativo del navegador solo entiende #aabbcc, asi que se le
          pasa el normalizado y, si todavia no hay color, el de la plantilla. El campo de texto va
          al lado porque un cliente suele traer su color escrito de su disenador, no a ojo. */}
      <div className="field">
        <label htmlFor={`${uid}-color`}>Color de marca</label>
        <div className="color-pick">
          <input id={`${uid}-color`} type="color" value={colorDeMarca({ colorMarca }) || COLOR_POR_DEFECTO} onChange={(e) => setColorMarca(e.target.value)} />
          <input type="text" aria-label="Color de marca en hexadecimal" placeholder={COLOR_POR_DEFECTO} value={colorMarca} onChange={(e) => setColorMarca(e.target.value)} />
          {colorMarca && <button type="button" className="icon-btn" title="Volver al color de siempre" onClick={() => setColorMarca('')}>✕</button>}
        </div>
        <p className="hint">
          Es el color de los botones y lo que resalta. Vacío deja el de siempre.
          {normalizarColor(colorMarca) && <> El texto encima saldrá {tintaSobre(normalizarColor(colorMarca)) === '#ffffff' ? 'blanco' : 'oscuro'}, lo que se lea mejor.</>}
        </p>
      </div>
      <div className="form-section-title" style={{ marginTop: 18 }}><span className="section-icon">◉</span><div><h3>Datos del negocio</h3><p>Se muestran en la barra superior y en el pie. Lo que dejes vacío no se publica.</p></div></div>
      <div className="field"><label htmlFor={`${uid}-rnc`}>RNC</label><input id={`${uid}-rnc`} type="text" placeholder="1-31-12345-6" value={negocio.rnc} onChange={(e) => setNegocio({ ...negocio, rnc: e.target.value })} /><div className="hint">Aparece en el pie. Déjalo vacío si aún no tienes o si prefieres no publicarlo.</div></div>
      <div className="field"><label htmlFor={`${uid}-direccion`}>Dirección</label><input id={`${uid}-direccion`} type="text" placeholder="Calle, número, sector, ciudad" value={negocio.direccion} onChange={(e) => setNegocio({ ...negocio, direccion: e.target.value })} /></div>
      <div className="field"><label htmlFor={`${uid}-horario`}>Horario de atención</label><input id={`${uid}-horario`} type="text" placeholder="Lun a Sáb · 9:00 AM a 6:00 PM" value={negocio.horario} onChange={(e) => setNegocio({ ...negocio, horario: e.target.value })} /><div className="hint">Se muestra arriba del todo, junto al teléfono.</div></div>
      <div className="field"><label htmlFor={`${uid}-cobertura`}>Cobertura de entrega</label><input id={`${uid}-cobertura`} type="text" placeholder="Entrega en todo el país" value={negocio.cobertura} onChange={(e) => setNegocio({ ...negocio, cobertura: e.target.value })} /></div>
      <div className="field"><label htmlFor={`${uid}-correo`}>Correo de contacto</label><input id={`${uid}-correo`} type="email" placeholder="ventas@tutienda.com" value={negocio.correo} onChange={(e) => setNegocio({ ...negocio, correo: e.target.value })} /></div>
      <div className="field"><label htmlFor={`${uid}-pagos`}>Formas de pago</label><input id={`${uid}-pagos`} type="text" placeholder="Efectivo, Transferencia, Depósito bancario" value={negocio.pagos} onChange={(e) => setNegocio({ ...negocio, pagos: e.target.value })} /><div className="hint">Sepáralas con comas. Se listan en el pie.</div></div>

      <div className="form-section-title" style={{ marginTop: 18 }}><span className="section-icon">⛟</span><div><h3>Entrega y envío</h3><p>Qué le pides al cliente al finalizar el pedido y cuánto cobras por llevarlo.</p></div></div>
      <ShippingForm envio={envio} setEnvio={setEnvio} currency={currency} />
      <div className="form-section-title" style={{ marginTop: 18 }}><span className="section-icon">%</span><div><h3>Cupones de descuento</h3><p>Se aplican al precio de los productos, no al envío.</p></div></div>
      <CouponsForm cupones={cupones} setCupones={setCupones} currency={currency} adminToken={adminToken} />
      <button className="btn-primary full-action" onClick={handleSaveSettings}>Guardar ajustes</button>

      <BackupsPanel adminToken={adminToken} refreshCatalog={refreshCatalog} showToast={showToast} />

      <div className="access-card">
        <div className="access-card-head"><div className="access-icon">♙</div><div><h3>Acceso de administrador</h3><p>Actualiza el correo y/o contraseña. Por seguridad, siempre debes confirmar tu contraseña actual.</p></div></div>
        <div className="field"><label htmlFor={`${uid}-curpass`}>Contraseña actual</label><input id={`${uid}-curpass`} type="password" placeholder="••••••••" autoComplete="current-password" value={curPassword} onChange={(e) => setCurPassword(e.target.value)} /></div>
        <div className="field email-field"><label htmlFor={`${uid}-newemail`}>Nuevo correo electrónico</label><div className="input-with-icon"><span>✉</span><input id={`${uid}-newemail`} type="email" placeholder="nuevo@correo.com" autoComplete="username" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div><div className="hint">Déjalo vacío si solo quieres cambiar la contraseña.</div></div>
        <div className="field"><label htmlFor={`${uid}-newpass`}>Nueva contraseña</label><input id={`${uid}-newpass`} type="password" placeholder="Mínimo 6 caracteres" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
        <button className="btn-primary full-action" onClick={handleSaveCreds} disabled={savingAccess}>{savingAccess ? 'Actualizando…' : 'Actualizar acceso'}</button>
        <div className="access-note">💡 Al cambiar la contraseña se cierran todas las sesiones abiertas; la de este navegador se renueva sola.</div>

        <div className="token-box">
          <div>
            <strong>Token de sesión</strong>
            <span>Solo para los scripts de mantenimiento, en la terminal de tu computadora. Quien lo tenga puede cambiar precios y leer los datos de tus clientes sin saber tu contraseña: no lo pegues en chats ni en capturas.{diasRestantes !== null && ` Esta sesión vence ${diasRestantes <= 1 ? 'hoy' : `en ${diasRestantes} días`}.`}</span>
          </div>
          <button type="button" className="btn-secondary" onClick={copiarToken}>{copiado ? 'Copiado ✓' : 'Copiar token'}</button>
        </div>
      </div>
      <button className="btn-secondary logout-action" onClick={onLogout}>Cerrar sesión</button>
    </div>
  );
}
