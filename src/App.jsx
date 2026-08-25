import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import CategoryChips from './components/CategoryChips';
import ProductGrid from './components/ProductGrid';
import ProductDetail from './components/ProductDetail';
import CartModal from './components/CartModal';
import Toast from './components/Toast';
import { SetupModal, LoginModal } from './components/admin/AuthModals';
import AdminPanel from './components/admin/AdminPanel';
import { useCatalog } from './hooks/useCatalog';
import { useCart } from './hooks/useCart';
import { useAuth } from './hooks/useAuth';
import { useToast } from './hooks/useToast';
import './styles.css';

export default function App() {
  const { settings, setSettings, products, setProducts, categories, setCategories, loading, loadError, fetchCatalog, saveCatalog } = useCatalog();
  const { cart, addToCart, updateCartQty, removeFromCart, clearCart, cartCount } = useCart(products);
  const { adminToken, setAdminToken, authRequest } = useAuth();
  const { message, visible, showToast } = useToast();

  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('theme') || 'dark'; } catch { return 'dark'; } });
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [detailProductId, setDetailProductId] = useState(null);
  const [modal, setModal] = useState(null);
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    fetchCatalog();
    setIsAdminRoute(location.pathname.replace(/\/$/, '') === '/admin');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!settings.configured) {
      const t = setTimeout(() => setModal('setup'), 400);
      return () => clearTimeout(t);
    }
    if (isAdminRoute) {
      const t = setTimeout(() => setModal(adminToken ? 'admin' : 'login'), 100);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, settings.configured, isAdminRoute]);

  const openAdmin = useCallback(() => {
    if (!settings.configured) { setModal('setup'); return; }
    setModal(adminToken ? 'admin' : 'login');
  }, [settings.configured, adminToken]);

  const handleAddCart = useCallback((id, qty) => addToCart(id, qty, showToast), [addToCart, showToast]);

  const handleLogout = () => {
    setAdminToken('');
    setModal(null);
    showToast('Sesión cerrada');
  };

  return (
    <div id="app">
      <Header settings={settings} theme={theme} onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
      <CategoryChips products={products} activeCategory={activeCategory} setActiveCategory={setActiveCategory} />
      <main>
        {loadError && !loading ? (
          <div className="empty-state" style={{ padding: '70px 20px' }}>
            <div className="glyph">🔌</div>
            <h3>No se pudo conectar con el catálogo</h3>
            <p>{loadError}</p>
          </div>
        ) : (
          <ProductGrid products={products} allProducts={products} settings={settings} activeCategory={activeCategory} searchTerm={searchTerm} onOpenDetail={setDetailProductId} onAddCart={handleAddCart} />
        )}
      </main>
      <footer>Catálogo digital de {settings.storeName || 'Synaptic Tech'}</footer>
      <button className="cart-fab" onClick={() => setModal('cart')} title="Ver carrito">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
        {cartCount > 0 && <span className="cart-badge" style={{ display: 'flex' }}>{cartCount}</span>}
      </button>
      {settings.configured && isAdminRoute && (
        <button className="admin-fab" style={{ display: 'flex' }} onClick={openAdmin} title="Panel de administrador">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
        </button>
      )}
      <Toast message={message} visible={visible} />
      {detailProductId && (
        <ProductDetail product={products.find((p) => p.id === detailProductId)} settings={settings} onClose={() => setDetailProductId(null)} onAddCart={(id, qty) => handleAddCart(id, qty)} />
      )}
      {modal === 'cart' && (
        <CartModal cart={cart} products={products} settings={settings} onClose={() => setModal(null)} onUpdateQty={updateCartQty} onRemove={removeFromCart} onClear={clearCart} showToast={showToast} />
      )}
      {modal === 'setup' && (
        <SetupModal settings={settings} authRequest={authRequest} setAdminToken={setAdminToken} showToast={showToast} onSetupComplete={async (updates) => {
          const nextSettings = { ...settings, ...updates };
          setSettings(nextSettings);
          await saveCatalog(adminToken, { settings: nextSettings });
          showToast('Configuración guardada');
          setModal('admin');
        }} />
      )}
      {modal === 'login' && (
        <LoginModal authRequest={authRequest} setAdminToken={setAdminToken} onLoginSuccess={() => setModal('admin')} onClose={() => setModal(null)} showToast={showToast} />
      )}
      {modal === 'admin' && (
        <AdminPanel products={products} setProducts={setProducts} categories={categories} setCategories={setCategories} settings={settings} setSettings={setSettings} saveCatalog={saveCatalog} adminToken={adminToken} authRequest={authRequest} setAdminToken={setAdminToken} onClose={() => setModal(null)} onLogout={handleLogout} showToast={showToast} />
      )}
    </div>
  );
}
