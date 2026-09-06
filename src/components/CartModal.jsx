import { getPrimaryImage, hasVariants, getVariant, getUnitPrice } from '../hooks/useCatalog';
import { cartKey } from '../hooks/useCart';

const variantStock = (v) => Math.max(0, Math.floor(Number(v?.stockQty) || 0));

export default function CartModal({ cart, products, settings, onClose, onUpdateQty, onRemove, onClear, onCheckout, showToast }) {
  const items = cart.map((ci) => {
    const p = products.find((x) => x.id === ci.productId);
    if (!p) return null;
    const variantId = ci.variantId || null;
    // El carrito ya descarta al hidratar lo que no resuelve; esto cubre un catalogo
    // que cambio con el modal abierto.
    if (hasVariants(p) && !getVariant(p, variantId)) return null;
    return { ...ci, variantId, product: p, unitPrice: getUnitPrice(p, variantId) || 0 };
  }).filter(Boolean);
  const total = items.reduce((s, it) => s + it.unitPrice * it.qty, 0);

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
                const variant = getVariant(it.product, it.variantId);
                const stockQty = variant ? variantStock(variant) : Math.max(0, Math.floor(Number(it.product.stockQty) || 0));
                return <div className="cart-row" key={cartKey(it.productId, it.variantId)}>
                  <div className="thumb">{img && <img src={img} alt="" />}</div>
                  <div className="info"><div className="n">{it.product.name}</div>{variant && <div className="cart-variant">{it.product.variantAxis}: {variant.label}</div>}<div className="p mono">{settings.currency} {it.unitPrice.toLocaleString('es-DO')} c/u</div></div>
                  <div className="qty-stepper" style={{ flexShrink: 0 }}><button disabled={it.qty <= 1} onClick={() => onUpdateQty(it.productId, it.qty - 1, it.variantId)}>−</button><span className="qty-val">{it.qty}</span><button disabled={it.qty >= stockQty} onClick={() => onUpdateQty(it.productId, it.qty + 1, it.variantId)}>+</button></div>
                  <button className="icon-btn" title="Quitar" onClick={() => onRemove(it.productId, it.variantId)}>✕</button>
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
