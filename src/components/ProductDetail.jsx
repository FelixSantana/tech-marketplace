import { useState, useEffect } from 'react';
import { getStockQty, getProductImages, hasVariants, getVariants, getVariant, getMinPrice } from '../hooks/useCatalog';

const variantStock = (v) => Math.max(0, Math.floor(Number(v?.stockQty) || 0));

export default function ProductDetail({ product, settings, onClose, onAddCart, onOrderWhatsApp }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const conVariantes = hasVariants(product);
  const variantes = getVariants(product);
  // Con una sola opcion no hay nada que elegir, se preselecciona.
  const [variantId, setVariantId] = useState(() => (conVariantes && variantes.length === 1 ? variantes[0].id : null));
  const imgs = getProductImages(product);
  const variant = getVariant(product, variantId);
  const totalStock = getStockQty(product);
  const isOut = totalStock <= 0;
  // Stock de lo que el cliente eligio realmente. Sin variante elegida no hay cantidad pedible.
  const stockQty = conVariantes ? variantStock(variant) : totalStock;
  const faltaElegir = conVariantes && !variant;
  const unitPrice = conVariantes ? (variant ? Number(variant.price) : getMinPrice(product)) : Number(product.price);

  useEffect(() => {
    if (qty > stockQty && stockQty > 0) setQty(stockQty);
    if (qty < 1) setQty(1);
  }, [stockQty, qty]);

  let stockLabel, stockClass;
  if (isOut) { stockLabel = 'Agotado'; stockClass = 'out'; }
  else if (faltaElegir) { stockLabel = `Elige ${product.variantAxis ? `una opción de ${product.variantAxis}` : 'una opción'}`; stockClass = 'low'; }
  else if (stockQty <= 0) { stockLabel = 'Esta opción está agotada'; stockClass = 'out'; }
  else if (stockQty <= 3) { stockLabel = stockQty === 1 ? 'Queda 1 disponible' : `Quedan ${stockQty} disponibles`; stockClass = 'low'; }
  else { stockLabel = `${stockQty} disponibles`; stockClass = ''; }

  const puedePedir = !isOut && !faltaElegir && stockQty > 0;

  return (
    <div className="overlay" onClick={(e) => { if (e.target.classList.contains('overlay')) onClose(); }}>
      <div className="panel detail-panel">
        <div className="detail-carousel">
          <button className="detail-close" onClick={onClose}>✕</button>
          {imgs.length ? <img src={imgs[imgIndex]} alt={product.name} /> : <div className="placeholder">Sin imagen</div>}
          {isOut && <span className="detail-badge-out">Agotado</span>}
          {imgs.length > 1 && (
            <>
              <button className="carousel-arrow prev" onClick={() => setImgIndex((i) => (i - 1 + imgs.length) % imgs.length)}>‹</button>
              <button className="carousel-arrow next" onClick={() => setImgIndex((i) => (i + 1) % imgs.length)}>›</button>
              <div className="carousel-dots">{imgs.map((_, i) => (<span key={i} className={i === imgIndex ? 'active' : ''} />))}</div>
            </>
          )}
        </div>
        <div className="detail-body">
          {product.category && <div className="detail-cat">{product.category}</div>}
          <div className="detail-name">{product.name}</div>
          {product.description ? <div className="detail-desc">{product.description}</div> : <div className="detail-desc">Sin descripción.</div>}
          {product.warranty && <div className="card-warranty detail-warranty">Garantía: {product.warranty}</div>}
          {conVariantes && (
            <div className="variant-picker">
              <div className="variant-axis" id="variant-axis-label">{product.variantAxis || 'Opción'}</div>
              <div className="variant-options" role="group" aria-labelledby="variant-axis-label">
                {variantes.map((v) => {
                  const agotada = variantStock(v) <= 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className={`variant-option ${v.id === variantId ? 'active' : ''} ${agotada ? 'agotada' : ''}`}
                      disabled={agotada}
                      aria-pressed={v.id === variantId}
                      onClick={() => { setVariantId(v.id); setQty(1); }}
                    >
                      <span className="variant-option-label">{v.label}</span>
                      <span className="variant-option-price mono">{settings.currency} {Number(v.price).toLocaleString('es-DO')}</span>
                      {agotada && <span className="variant-option-out">Agotado</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="detail-price mono">{faltaElegir && <span className="price-from">desde </span>}{settings.currency} {unitPrice.toLocaleString('es-DO')}</div>
          <div className={`detail-stock ${stockClass}`}>{stockLabel}</div>
          {puedePedir && <div className="qty-row"><span className="qlabel">Cantidad a pedir</span><div className="qty-stepper"><button disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button><span className="qty-val">{qty}</span><button disabled={qty >= stockQty} onClick={() => setQty((q) => Math.min(stockQty, q + 1))}>+</button></div></div>}
          {puedePedir && <button className="btn-primary" onClick={() => onAddCart(product.id, qty, variantId)}>Agregar {qty} al carrito</button>}
          <button className={`btn-wa ${!puedePedir || !settings.whatsapp ? 'disabled' : ''}`} disabled={!puedePedir || !settings.whatsapp} onClick={() => onOrderWhatsApp(product, qty, variantId)} style={{ marginTop: 8 }} title="Pedir solo este producto por WhatsApp">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.42a9.87 9.87 0 0 0 4.62 1.18h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.06c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.11.11-1.79-.11-.41-.13-.94-.3-1.61-.6-2.84-1.23-4.69-4.1-4.83-4.29-.14-.19-1.15-1.53-1.15-2.92s.72-2.07.98-2.35c.24-.27.53-.34.71-.34.18 0 .35 0 .5.01.17.01.38-.06.6.45.24.57.8 1.96.87 2.1.07.14.11.31.02.5-.09.19-.14.31-.28.47-.14.16-.29.36-.41.48-.14.14-.29.28-.12.56.14.28.75 1.24 1.62 2 1.11.99 2.05 1.3 2.33 1.44.28.14.44.12.6-.07.17-.19.71-.83.9-1.11.19-.28.38-.24.63-.14.26.09 1.64.77 1.92.91.28.14.47.21.53.33.07.12.07.68-.17 1.36Z" /></svg>
            {isOut ? 'Agotado' : faltaElegir ? 'Elige una opción' : !settings.whatsapp ? 'Configura tu WhatsApp' : 'Registrar y pedir por WhatsApp'}
          </button>
          {puedePedir && settings.whatsapp && <div className="detail-total">Total: {settings.currency} {(unitPrice * qty).toLocaleString('es-DO')}</div>}
        </div>
      </div>
    </div>
  );
}
