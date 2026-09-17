import ProductCard from './ProductCard';
import { coincideBusqueda } from '../lib/texto';

export default function ProductGrid({ products, allProducts, settings, activeCategory, searchTerm, onOpenDetail, onAddCart, onOrderWhatsApp }) {
  let list = products.slice();
  if (activeCategory !== 'Todos') list = list.filter((p) => p.category === activeCategory);
  if (searchTerm.trim()) list = list.filter((p) => coincideBusqueda(p, searchTerm));
  if (allProducts.length === 0) {
    return <div className="empty-state"><div className="glyph">🧩</div><h3>Aún no hay productos en el catálogo</h3><p>Muy pronto vas a encontrar aquí los productos disponibles para pedir por WhatsApp.</p></div>;
  }
  if (list.length === 0) {
    return <div className="empty-state"><div className="glyph">🔍</div><h3>Sin resultados</h3><p>Prueba con otra búsqueda o categoría.</p></div>;
  }
  return <div className="grid">{list.map((p) => <ProductCard key={p.id} product={p} settings={settings} onOpenDetail={onOpenDetail} onAddCart={onAddCart} onOrderWhatsApp={onOrderWhatsApp} />)}</div>;
}
