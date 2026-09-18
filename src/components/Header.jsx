export default function Header({ settings, theme, onToggleTheme, searchTerm, setSearchTerm, cartCount = 0, cartTotal = 0, onOpenCart }) {
  return (
    <>
      <header className="hero">
        <div className="brand-row">
          <div className="brand">
            <div className="mark">{settings.logo ? <img src={settings.logo} alt="Logo" /> : 'ST'}</div>
            <div>
              <div className="brand-name">{settings.storeName || 'Synaptic Tech'}</div>
              <div className="tagline">{settings.tagline || ''}</div>
            </div>
          </div>

          {/* PROTOTIPO D: el buscador sube a la cabecera, como en las tres tiendas
              dominicanas que se miraron. Es lo que mas se usa y estaba una fila
              mas abajo, compitiendo con las categorias. */}
          <div className="search-box header-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input type="text" placeholder="Buscar producto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Buscar producto" />
          </div>

          <div className="header-actions">
            {/* El carrito con su total a la vista: Cecomsa y Data Import lo hacen
                asi, y evita que el cliente tenga que abrirlo para saber cuanto lleva. */}
            <button className="header-cart" onClick={onOpenCart} aria-label={`Ver carrito, ${cartCount} artículo${cartCount === 1 ? '' : 's'}`}>
              <span className="header-cart-icono" aria-hidden="true">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
                {cartCount > 0 && <span className="header-cart-badge">{cartCount}</span>}
              </span>
              <span className="header-cart-total">{settings.currency || 'RD$'} {Number(cartTotal || 0).toLocaleString('es-DO')}</span>
            </button>

            <button className="theme-toggle" onClick={onToggleTheme} title="Cambiar tema" aria-label="Cambiar tema">
              {theme === 'light' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></svg>
              )}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
