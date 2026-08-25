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

    // Abrimos una ventana inmediatamente por la acción del usuario para evitar que el navegador bloquee WhatsApp después del fetch.
    const popup = window.open('about:blank', '_blank');
    if (!popup) return showToast('El navegador bloqueó la ventana de WhatsApp. Permite las ventanas emergentes para este sitio.');
    popup.document.write('<p style="font-family:system-ui;padding:24px">Registrando tu pedido…</p>');
    setSaving(true);
    try {
      const response = await fetch('/api/orders.cjs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'whatsapp_checkout', customerName: name.trim(), phone: cleanPhone, notes, products: items.map((item) => ({ productId: item.product.id, quantity: item.qty })) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'No se pudo registrar el pedido.');

      const lines = [`Hola ${settings.storeName}! Quiero hacer este pedido:`, ''];
      items.forEach((item) => lines.push(`• ${item.product.name} x${item.qty} — ${settings.currency} ${(Number(item.product.price) * item.qty).toLocaleString('es-DO')}`));
      lines.push('', `Total: ${settings.currency} ${total.toLocaleString('es-DO')}`, '', '¿Está todo disponible?');
      const storePhone = String(settings.whatsapp).replace(/\D/g, '');
      const url = `https://wa.me/${storePhone}?text=${encodeURIComponent(lines.join('\n'))}`;

      popup.location.href = url;
      onOrderCreated?.(data.order);
      onClose();
    } catch (error) {
      popup.close();
      console.error('checkout order failed', error);
      showToast(error.message || 'No se pudo registrar el pedido.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overlay" onClick={(e) => { if (e.target.classList.contains('overlay') && !saving) onClose(); }}>
      <form className="panel" style={{ maxWidth: 520 }} onSubmit={submit}>
        <div className="panel-head"><h2>Confirmar pedido</h2><button type="button" className="icon-btn" onClick={onClose} disabled={saving}>✕</button></div>
        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>Completa tus datos. Primero registraremos la orden como pendiente y después abriremos WhatsApp.</p>
        <div className="form-grid">
          <label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoFocus maxLength={120} /></label>
          <label>WhatsApp<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="809 555 1234" inputMode="tel" maxLength={20} /></label>
          <label>Notas <span style={{ color: 'var(--text-muted)' }}>(opcional)</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas para el pedido" maxLength={1000} rows={3} /></label>
        </div>
        <div className="cart-total-row" style={{ marginTop: 16 }}><span>Total</span><strong className="mono">{settings.currency} {total.toLocaleString('es-DO')}</strong></div>
        <div className="form-actions" style={{ marginTop: 16 }}><button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Registrando…' : 'Registrar y abrir WhatsApp'}</button></div>
      </form>
    </div>
  );
}
