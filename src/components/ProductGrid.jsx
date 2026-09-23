import { useState } from 'react';
import ProductCard from './ProductCard';
import { coincideBusqueda } from '../lib/texto';
import { getMinPrice } from '../hooks/useCatalog';

// Ordenar por precio y decir cuantos resultados hay. Data Import
// tiene las dos cosas; en un catalogo de 23 productos, donde el cliente compara
// equipos parecidos, "de menor a mayor" es el filtro que de verdad se usa.
const ORDENES = {
  recomendados: { etiqueta: 'Recomendados', aplicar: (l) => l },
  barato: { etiqueta: 'Precio: de menor a mayor', aplicar: (l) => l.slice().sort((a, b) => getMinPrice(a) - getMinPrice(b)) },
  caro: { etiqueta: 'Precio: de mayor a menor', aplicar: (l) => l.slice().sort((a, b) => getMinPrice(b) - getMinPrice(a)) },
  nombre: { etiqueta: 'Nombre (A-Z)', aplicar: (l) => l.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')) },
};

export default function ProductGrid({ products, allProducts, settings, activeCategory, searchTerm, onOpenDetail, onAddCart, onOrderWhatsApp }) {
  const [orden, setOrden] = useState('recomendados');

  let list = products.slice();
  if (activeCategory !== 'Todos') list = list.filter((p) => p.category === activeCategory);
  if (searchTerm.trim()) list = list.filter((p) => coincideBusqueda(p, searchTerm));
  list = (ORDENES[orden] || ORDENES.recomendados).aplicar(list);

  if (allProducts.length === 0) {
    return <div className="empty-state"><div className="glyph">🧩</div><h3>Aún no hay productos en el catálogo</h3><p>Muy pronto vas a encontrar aquí los productos disponibles para pedir por WhatsApp.</p></div>;
  }
  if (list.length === 0) {
    return <div className="empty-state"><div className="glyph">🔍</div><h3>Sin resultados</h3><p>Prueba con otra búsqueda o categoría.</p></div>;
  }

  const cuenta = list.length === 1 ? '1 producto' : `${list.length} productos`;
  return (
    <>
      <div className="barra-resultados">
        <span className="cuenta-resultados">
          {cuenta}
          {activeCategory !== 'Todos' && <> en <strong>{activeCategory}</strong></>}
          {searchTerm.trim() && <> para <strong>“{searchTerm.trim()}”</strong></>}
        </span>
        <label className="orden-campo">
          <span>Ordenar por</span>
          <select value={orden} onChange={(e) => setOrden(e.target.value)}>
            {Object.entries(ORDENES).map(([valor, o]) => <option key={valor} value={valor}>{o.etiqueta}</option>)}
          </select>
        </label>
      </div>
      <div className="grid">{list.map((p) => <ProductCard key={p.id} product={p} settings={settings} onOpenDetail={onOpenDetail} onAddCart={onAddCart} onOrderWhatsApp={onOrderWhatsApp} />)}</div>
    </>
  );
}
