import { useState } from 'react';

export default function CheckoutModal({ items, settings, onClose, onOrderCreated, showToast }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const total = items.reduce((sum, item) => sum + Number(item.product.price) * item.qty, 0);

  const submit = async (e) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (name.trim().length < 2) return showToast('Escribe tu nombre.');
    if (cleanPhone.length < 8) return showToast('Escribe un WhatsApp válido.');
    if (!settings.whatsapp) return showToast('El WhatsApp de la tienda no está configurado.');

    const popup = window.open('about:blank', '_blank');
    if (!popup) return showToast('El navegador bloqueó la ventana de WhatsApp. Permite las ventanas emergentes para este sitio.');
    popup.document.write('<div style="font-family:system-ui,sans-serif;background:#0a0c12;color:#edeef3;min-height:100vh;display:grid;place-items:center"><div style="text-align:center;padding:30px"><div style="font-size:34px;margin-bottom:10px">⏳</div><strong>Preparando tu pedido…</strong><p style="opacity:.65">Te llevaremos a WhatsApp en unos segundos.</p></div></div>');
    setSaving(true);
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'whatsapp_checkout', customerName: name.trim(), phone: cleanPhone, notes, products: items.map((item) => ({ productId: item.product.id, quantity: item.qty })) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'No se pudo registrar el pedido.');
      const lines = [`Hola ${settings.storeName}! Quiero hacer este pedido:`, ''];
      items.forEach((item) => lines.push(`• ${item.product.name} x${item.qty} — ${settings.currency} ${(Number(item.product.price) * item.qty).toLocaleString('es-DO')}`));
      lines.push('', `Total: ${settings.currency} ${total.toLocaleString('es-DO')}`, '', '¿Está todo disponible?');
      const storePhone = String(settings.whatsapp).replace(/\D/g, '');
      popup.location.href = `https://wa.me/${storePhone}?text=${encodeURIComponent(lines.join('\n'))}`;
      onOrderCreated?.(data.order);
      onClose();
    } catch (error) {
      popup.close();
      console.error('checkout order failed', error);
      showToast(error.message || 'No se pudo registrar el pedido.');
    } finally { setSaving(false); }
  };

  return (
    <div className="overlay checkout-overlay" onClick={(e) => { if (e.target.classList.contains('overlay') && !saving) onClose(); }}>
      <form className="panel checkout-panel" onSubmit={submit}>
        <div className="checkout-head"><div><span className="checkout-kicker">FINALIZAR PEDIDO</span><h2>Completa tu pedido</h2><p>Registraremos tu orden y luego te llevaremos a WhatsApp.</p></div><button type="button" className="icon-btn" onClick={onClose} disabled={saving} aria-label="Cerrar">✕</button></div>
        <div className="checkout-summary"><div className="checkout-summary-title">Resumen <span>{items.length} {items.length === 1 ? 'producto' : 'productos'}</span></div>{items.map((item) => <div className="checkout-item" key={item.product.id}><div className="checkout-item-img">{item.product.images?.[0] ? <img src={item.product.images[0]} alt="" /> : '📦'}</div><div className="checkout-item-info"><strong>{item.product.name}</strong><small>Cantidad: {item.qty}</small></div><b>{settings.currency} {(Number(item.product.price) * item.qty).toLocaleString('es-DO')}</b></div>)}<div className="checkout-total"><span>Total del pedido</span><strong>{settings.currency} {total.toLocaleString('es-DO')}</strong></div></div>
        <div className="checkout-form-title">Tus datos</div>
        <div className="form-grid"><label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoFocus maxLength={120} /></label><label>WhatsApp<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="809 555 1234" inputMode="tel" maxLength={20} /></label><label className="checkout-notes">Notas <span>(opcional)</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Color, horario de entrega, etc." maxLength={1000} rows={3} /></label></div>
        <div className="checkout-security">🔒 <span>Tus datos se usan únicamente para registrar y coordinar este pedido.</span></div>
        <div className="form-actions checkout-actions"><button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="btn-wa checkout-submit" disabled={saving}>{saving ? 'Registrando…' : 'Pedir por WhatsApp'}<span>→</span></button></div>
      </form>
    </div>
  );
}
