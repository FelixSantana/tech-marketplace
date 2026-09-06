import { useId, useState } from 'react';
import { getVariant, getUnitPrice } from '../hooks/useCatalog';
import { buildOrderWaLink } from '../lib/utils';

export default function CheckoutModal({ items, settings, onClose, onOrderCreated, showToast }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  // Con el pedido ya guardado, aqui vive el enlace a WhatsApp que el cliente toca.
  const [waLink, setWaLink] = useState(null);
  const uid = useId();
  const total = items.reduce((sum, item) => sum + (getUnitPrice(item.product, item.variantId) || 0) * item.qty, 0);

  const submit = async (e) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (name.trim().length < 2) return showToast('Escribe tu nombre.');
    if (cleanPhone.length < 8) return showToast('Escribe un WhatsApp válido.');
    if (!settings.whatsapp) return showToast('El WhatsApp de la tienda no está configurado.');

    // Primero se registra el pedido y solo despues se ofrece el enlace. Antes se abria una
    // pestana en blanco antes de saber si el pedido entraba, y en movil esa pestana se
    // quedaba en blanco: escribirle encima o navegarla tras la espera no siempre funciona.
    setSaving(true);
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'whatsapp_checkout', customerName: name.trim(), phone: cleanPhone, notes, products: items.map((item) => ({ productId: item.product.id, variantId: item.variantId || null, quantity: item.qty })) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'No se pudo registrar el pedido.');
      setWaLink(buildOrderWaLink(items, settings));
      onOrderCreated?.(data.order);
    } catch (error) {
      console.error('checkout order failed', error);
      showToast(error.message || 'No se pudo registrar el pedido.');
    } finally { setSaving(false); }
  };

  if (waLink) {
    return (
      <div className="overlay checkout-overlay">
        <div className="panel checkout-panel checkout-done">
          <div className="checkout-done-badge">✓</div>
          <h2>Pedido registrado</h2>
          <p>Ya lo tenemos guardado. Toca el botón para enviarlo por WhatsApp y coordinar la entrega.</p>
          {/* Un enlace de verdad: lo abre el toque del cliente, asi que ningun navegador lo bloquea. */}
          <a className="btn-wa checkout-submit" href={waLink} target="_blank" rel="noopener noreferrer" onClick={() => setTimeout(onClose, 400)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.42a9.87 9.87 0 0 0 4.62 1.18h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.06c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.11.11-1.79-.11-.41-.13-.94-.3-1.61-.6-2.84-1.23-4.69-4.1-4.83-4.29-.14-.19-1.15-1.53-1.15-2.92s.72-2.07.98-2.35c.24-.27.53-.34.71-.34.18 0 .35 0 .5.01.17.01.38-.06.6.45.24.57.8 1.96.87 2.1.07.14.11.31.02.5-.09.19-.14.31-.28.47-.14.16-.29.36-.41.48-.14.14-.29.28-.12.56.14.28.75 1.24 1.62 2 1.11.99 2.05 1.3 2.33 1.44.28.14.44.12.6-.07.17-.19.71-.83.9-1.11.19-.28.38-.24.63-.14.26.09 1.64.77 1.92.91.28.14.47.21.53.33.07.12.07.68-.17 1.36Z" /></svg>
            Enviar pedido por WhatsApp
          </a>
          <p className="checkout-done-hint">Si WhatsApp no abre, vuelve a tocar el botón. Tu pedido ya quedó guardado de todos modos.</p>
          <button type="button" className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay checkout-overlay" onClick={(e) => { if (e.target.classList.contains('overlay') && !saving) onClose(); }}>
      <form className="panel checkout-panel" onSubmit={submit}>
        <div className="checkout-head"><div><span className="checkout-kicker">FINALIZAR PEDIDO</span><h2>Completa tu pedido</h2><p>Registraremos tu orden y luego te llevaremos a WhatsApp.</p></div><button type="button" className="icon-btn" onClick={onClose} disabled={saving} aria-label="Cerrar">✕</button></div>
        <div className="checkout-summary"><div className="checkout-summary-title">Resumen <span>{items.length} {items.length === 1 ? 'producto' : 'productos'}</span></div>{items.map((item) => { const v = getVariant(item.product, item.variantId); const precio = getUnitPrice(item.product, item.variantId) || 0; return <div className="checkout-item" key={`${item.product.id}::${item.variantId || ''}`}><div className="checkout-item-img">{item.product.images?.[0] ? <img src={item.product.images[0]} alt="" /> : '📦'}</div><div className="checkout-item-info"><strong>{item.product.name}</strong><small>{v ? `${item.product.variantAxis}: ${v.label} · ` : ''}Cantidad: {item.qty}</small></div><b>{settings.currency} {(precio * item.qty).toLocaleString('es-DO')}</b></div>; })}<div className="checkout-total"><span>Total del pedido</span><strong>{settings.currency} {total.toLocaleString('es-DO')}</strong></div></div>
        <div className="checkout-form-title">Tus datos</div>
        <div className="form-grid"><label htmlFor={`${uid}-name`}>Nombre completo<input id={`${uid}-name`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoFocus maxLength={120} /></label><label htmlFor={`${uid}-phone`}>WhatsApp<input id={`${uid}-phone`} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="809 555 1234" inputMode="tel" maxLength={20} /></label><label className="checkout-notes" htmlFor={`${uid}-notes`}>Notas <span>(opcional)</span><textarea id={`${uid}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Color, horario de entrega, etc." maxLength={1000} rows={3} /></label></div>
        <div className="checkout-security">🔒 <span>Tus datos se usan únicamente para registrar y coordinar este pedido.</span></div>
        <div className="form-actions checkout-actions"><button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="btn-wa checkout-submit" disabled={saving}>{saving ? 'Registrando…' : 'Pedir por WhatsApp'}<span>→</span></button></div>
      </form>
    </div>
  );
}
