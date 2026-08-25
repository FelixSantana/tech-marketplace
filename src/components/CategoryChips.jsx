export default function CategoryChips({ products, activeCategory, setActiveCategory }) {
  const cats = new Set(products.map((p) => p.category).filter(Boolean));
  const all = ['Todos', ...Array.from(cats)];
  if (all.length <= 1) return <div className="chips" />;
  return (
    <div className="chips">
      {all.map((c) => (
        <button key={c} className={`chip ${c === activeCategory ? 'active' : ''}`} onClick={() => setActiveCategory(c)}>{c}</button>
      ))}
    </div>
  );
}
