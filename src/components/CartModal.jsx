import { getStockQty, getPrimaryImage } from '../hooks/useCatalog';

export default function CartModal({ cart, products, settings, onClose, onUpdateQty, onRemove, onClear, onCheckout, showToast }) {
  const items = cart.map((ci) => {
    const p = products.find((x) => x.id === ci.productId);
    return p ? { ...ci, product: p } : null;
  }).filter(Boolean);
  const total = items.reduce((s, it) => s + Number(it.product.price) * it.qty, 0);

  return (
    <div className="overlay" onClick={(e) => { if (e.target.classList.contains('overlay')) onClose(); }}>
      <div className="panel" style={{ maxWidth: 520 }}>
        <div className="panel-head"><h2>Tu carrito</h2><button className="icon-btn" onClick={onClose}>✕</button></div>
        {items.length === 0 ? (
          <div className="empty-state" style={{ padding: '36px 10px' }}><div className="glyph">🛒</div><h3>Tu carrito está vacío</h3><p>Agrega productos desde el catálogo para armar tu pedido.</p></div>
        ) : (
          <>
            <div className="cart-list">
              {items.map((it) => {
                const img = getPrimaryImage(it.product);
                const stockQty = getStockQty(it.product);
                return <div className="cart-row" key={it.productId}>
                  <div className="thumb">{img && <img src={img} alt="" />}</div>
                  <div className="info"><div className="n">{it.product.name}</div><div className="p mono">{settings.currency} {Number(it.product.price).toLocaleString('es-DO')} c/u</div></div>
                  <div className="qty-stepper" style={{ flexShrink: 0 }}><button disabled={it.qty <= 1} onClick={() => onUpdateQty(it.productId, it.qty - 1)}>−</button><span className="qty-val">{it.qty}</span><button disabled={it.qty >= stockQty} onClick={() => onUpdateQty(it.productId, it.qty + 1)}>+</button></div>
                  <button className="icon-btn" title="Quitar" onClick={() => onRemove(it.productId)}>✕</button>
                </div>;
              })}
            </div>
            <div className="cart-total-row"><span>Total</span><span className="mono">{settings.currency} {total.toLocaleString('es-DO')}</span></div>
            <button className="btn-primary" onClick={() => { if (!settings.whatsapp) { showToast('Configura primero el WhatsApp de la tienda'); return; } onCheckout(); }}>Registrar pedido y continuar por WhatsApp</button>
            <button className="btn-secondary" onClick={onClear}>Vaciar carrito</button>
          </>
        )}
      </div>
    </div>
  );
}
