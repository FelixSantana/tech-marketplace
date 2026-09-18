import { getStockQty, getPrimaryImage, hasVariants, getMinPrice, getVariants } from '../hooks/useCatalog';

export default function ProductCard({ product, settings, onOpenDetail, onAddCart, onOrderWhatsApp }) {
  const stockQty = getStockQty(product);
  const isOut = stockQty <= 0;
  const img = getPrimaryImage(product);
  // Con variantes no hay un precio ni un stock unico que la tarjeta pueda usar: el cliente
  // tiene que abrir el detalle y elegir. Sin variantes, la tarjeta se comporta como siempre.
  const conVariantes = hasVariants(product);
  const openDetail = () => onOpenDetail(product.id);

  return (
    <div className="card" onClick={() => onOpenDetail(product.id)}>
      <div className="img-wrap">
        {img ? <img src={img} alt={product.name} /> : <span className="placeholder">Sin imagen</span>}
        {isOut && <span className="badge-out">Agotado</span>}
      </div>
      <div className="card-body">
        {product.category && <div className="card-cat">{product.category}</div>}
        <div className="card-name">{product.name}</div>
        {product.description && <div className="card-desc">{product.description}</div>}
        <div className="card-price mono">{conVariantes && <span className="price-from">desde </span>}<span className="currency">{settings.currency}</span>{getMinPrice(product).toLocaleString('es-DO')}</div>
        {/* PROTOTIPO D: la garantia va debajo del precio, en gris y sin gritar. Es
            la linea que en Data Import ocupa "Impuestos incluidos": una condicion
            de compra, no un adorno. Vendiendo equipos usados, es LA condicion. */}
        {product.warranty && <div className="card-warranty">Garantía: {product.warranty}</div>}
        {conVariantes && <div className="card-variants-hint">{getVariants(product).length} opciones de {product.variantAxis}</div>}

        <div className="card-actions">
          {/* Accion principal en el color de la tienda, con texto y a todo lo ancho:
              es el patron de las tres tiendas dominicanas. Pedir por WhatsApp pasa a
              segunda linea, para el que prefiere hablar antes de comprar. */}
          <button className="btn-cart-add" disabled={isOut} onClick={(e) => { e.stopPropagation(); if (conVariantes) return openDetail(); onAddCart(product.id, 1); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
            <span>{isOut ? 'Agotado' : conVariantes ? 'Ver opciones' : 'Añadir al carrito'}</span>
          </button>
          <button className={`btn-wa card-wa ${isOut || (!conVariantes && !settings.whatsapp) ? 'disabled' : ''}`} disabled={isOut || (!conVariantes && !settings.whatsapp)} onClick={(e) => { e.stopPropagation(); if (conVariantes) return openDetail(); onOrderWhatsApp(product, 1); }} title="Pedir por WhatsApp">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.42a9.87 9.87 0 0 0 4.62 1.18h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.06c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.11.11-1.79-.11-.41-.13-.94-.3-1.61-.6-2.84-1.23-4.69-4.1-4.83-4.29-.14-.19-1.15-1.53-1.15-2.92s.72-2.07.98-2.35c.24-.27.53-.34.71-.34.18 0 .35 0 .5.01.17.01.38-.06.6.45.24.57.8 1.96.87 2.1.07.14.11.31.02.5-.09.19-.14.31-.28.47-.14.16-.29.36-.41.48-.14.14-.29.28-.12.56.17.28.75 1.24 1.62 2 1.11.99 2.05 1.3 2.33 1.44.28.14.44.12.6-.07.17-.19.71-.83.9-1.11.19-.28.38-.24.63-.14.26.09 1.64.77 1.92.91.28.14.47.21.53.33.07.12.07.68-.17 1.36Z" /></svg>
            <span>Pedir por WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
}
