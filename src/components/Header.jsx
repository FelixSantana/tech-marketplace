export default function Header({ settings, theme, onToggleTheme, searchTerm, setSearchTerm }) {
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
          <button className="theme-toggle" onClick={onToggleTheme} title="Cambiar tema">
            {theme === 'light' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></svg>
            )}
          </button>
        </div>
        <p className="hero-sub">Explora el catálogo y toca <strong>Pedir por WhatsApp</strong> en el producto que te interese — te llevamos directo al chat con todos los detalles listos para enviar.</p>
      </header>
      <div className="controls">
        <div className="search-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input type="text" placeholder="Buscar producto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>
    </>
  );
}
