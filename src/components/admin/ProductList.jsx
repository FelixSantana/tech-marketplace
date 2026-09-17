import { getStockQty, getPrimaryImage, hasVariants, getMinPrice, getVariants } from '../../hooks/useCatalog';
import { apartadoDe } from '../../lib/apartados';

// Unidades que ya tienen pedido vigente y no estan realmente disponibles para vender.
const apartadas = (p, reservas) => (hasVariants(p)
  ? getVariants(p).reduce((s, v) => s + apartadoDe(reservas, p.id, v.id), 0)
  : apartadoDe(reservas, p.id, null));

export default function ProductList({ products, reservas, settings, onEdit, onDelete }) {
  if (products.length === 0) {
    return <p className="hint">No tienes productos aún. Ve a la pestaña "Agregar" para crear el primero.</p>;
  }
  return (
    <div className="prod-list">
      {products.map((p) => {
        const stockQty = getStockQty(p);
        const img = getPrimaryImage(p);
        return (
          <div className="prod-row" key={p.id}>
            <div className="thumb">{img && <img src={img} alt="" />}</div>
            <div className="info">
              <div className="n">{p.name}{stockQty <= 0 ? ' · Agotado' : ''}</div>
              <div className="p mono">{hasVariants(p) ? 'desde ' : ''}{settings.currency} {getMinPrice(p).toLocaleString('es-DO')}{p.category ? ' · ' + p.category : ''} · Stock: {stockQty}{hasVariants(p) ? ` · ${getVariants(p).length} opciones` : ''}{apartadas(p, reservas) ? ` · ${apartadas(p, reservas)} apartadas` : ''}</div>
            </div>
            <div className="actions">
              <button title="Editar" onClick={() => onEdit(p.id)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg></button>
              <button className="del" title="Eliminar" onClick={() => onDelete(p.id)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
