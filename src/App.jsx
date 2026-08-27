import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import CategoryChips from './components/CategoryChips';
import ProductGrid from './components/ProductGrid';
import ProductDetail from './components/ProductDetail';
import CartModal from './components/CartModal';
import CheckoutModal from './components/CheckoutModal';
import Toast from './components/Toast';
import { SetupModal, LoginModal } from './components/admin/AuthModals';
import AdminPanel from './components/admin/AdminPanel';
import { useCatalog } from './hooks/useCatalog';
import { useCart } from './hooks/useCart';
import { useAuth } from './hooks/useAuth';
import { useToast } from './hooks/useToast';
import './styles.css';
import './admin-overrides.css';

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
  const [checkoutItems, setCheckoutItems] = useState([]);
  const [isAdminRoute, setIsAdminRoute] = useState(false);
  const [adminConfigured, setAdminConfigured] = useState(null);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark'); try { localStorage.setItem('theme', theme); } catch {} }, [theme]);

  useEffect(() => {
    fetchCatalog();
    setIsAdminRoute(location.pathname.replace(/\/$/, '') === '/admin');
    authRequest('status').then((r) => { if (r.ok) setAdminConfigured(!!r.configured); else setAdminConfigured(false); });
  }, []);

  useEffect(() => {
    if (loading || !isAdminRoute || adminConfigured === null) return;
    if (!adminConfigured && !adminToken) { const t = setTimeout(() => setModal('setup'), 100); return () => clearTimeout(t); }
    const t = setTimeout(() => setModal(adminToken ? 'admin' : 'login'), 100);
    return () => clearTimeout(t);
  }, [loading, isAdminRoute, adminConfigured, adminToken]);

  const openAdmin = useCallback(() => {
    if (!isAdminRoute) { window.history.pushState({}, '', '/admin'); setIsAdminRoute(true); }
    if (adminToken) return setModal('admin');
    if (adminConfigured === false) return setModal('setup');
    setModal('login');
  }, [adminConfigured, adminToken, isAdminRoute]);

  const handleSetupComplete = useCallback(async (token) => {
    setAdminConfigured(true);
    setAdminToken(token);
    setModal('admin');
    showToast('Administrador creado correctamente');
  }, [setAdminToken, showToast]);

  const handleAddCart = useCallback((id, qty) => addToCart(id, qty, showToast), [addToCart, showToast]);
  const startCheckout = useCallback((items) => { if (!settings.whatsapp) { showToast('Configura primero el WhatsApp de la tienda'); return; } setCheckoutItems(items); setModal('checkout'); }, [settings.whatsapp, showToast]);
  const handleSingleOrder = useCallback((product, qty = 1) => startCheckout([{ product, qty }]), [startCheckout]);
  const handleCartCheckout = useCallback(() => { const items = cart.map((ci) => { const product = products.find((p) => p.id === ci.productId); return product ? { product, qty: ci.qty } : null; }).filter(Boolean); if (!items.length) return showToast('Tu carrito está vacío.'); setModal(null); startCheckout(items); }, [cart, products, startCheckout, showToast]);
  const handleLogout = () => { setAdminToken(''); setModal(null); showToast('Sesión cerrada'); };

  return <div id="app"><Header settings={settings} theme={theme} onToggleTheme={() => setTheme((t) => t === 'light' ? 'dark' : 'light')} searchTerm={searchTerm} setSearchTerm={setSearchTerm} /><CategoryChips products={products} activeCategory={activeCategory} setActiveCategory={setActiveCategory} /><main>{loadError && !loading ? <div className="empty-state" style={{ padding: '70px 20px' }}><div className="glyph">🔌</div><h3>No se pudo conectar con el catálogo</h3><p>{loadError}</p></div> : <ProductGrid products={products} allProducts={products} settings={settings} activeCategory={activeCategory} searchTerm={searchTerm} onOpenDetail={setDetailProductId} onAddCart={handleAddCart} onOrderWhatsApp={handleSingleOrder} />}</main><footer>Catálogo digital de {settings.storeName || 'Synaptic Tech'}</footer>
    <button className="cart-fab" onClick={() => setModal('cart')} title="Ver carrito" aria-label="Ver carrito"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>{cartCount > 0 && <span className="cart-badge" style={{ display: 'flex' }}>{cartCount}</span>}</button>
    {isAdminRoute && <button className="admin-fab admin-settings-fab" onClick={openAdmin} title="Panel de administrador" aria-label="Panel de administrador"><svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.37-.31-.6-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98L14.5 2.42C14.47 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.5.42L9.12 5.07c-.61.25-1.18.59-1.69.98l-2.49-1c-.23-.08-.48 0-.6.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.08.65-.08.98s.03.66.08.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.37.31.6.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.38-2.65c.61-.25 1.18-.58 1.69-.98l2.49 1c.23.08.48 0 .6-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z"/></svg></button>}
    <Toast message={message} visible={visible} />{detailProductId && <ProductDetail product={products.find((p) => p.id === detailProductId)} settings={settings} onClose={() => setDetailProductId(null)} onAddCart={(id, qty) => handleAddCart(id, qty)} onOrderWhatsApp={handleSingleOrder} />}{modal === 'cart' && <CartModal cart={cart} products={products} settings={settings} onClose={() => setModal(null)} onUpdateQty={updateCartQty} onRemove={removeFromCart} onClear={clearCart} onCheckout={handleCartCheckout} showToast={showToast} />}{modal === 'checkout' && <CheckoutModal items={checkoutItems} settings={settings} onClose={() => { setModal(null); setCheckoutItems([]); }} onOrderCreated={() => showToast('Pedido registrado correctamente')} showToast={showToast} />}{modal === 'setup' && <SetupModal authRequest={authRequest} setAdminToken={setAdminToken} showToast={showToast} onGoLogin={() => setModal('login')} onSetupComplete={handleSetupComplete} />}{modal === 'login' && <LoginModal authRequest={authRequest} setAdminToken={setAdminToken} onLoginSuccess={() => setModal('admin')} onClose={() => setModal(null)} showToast={showToast} />}{modal === 'admin' && <AdminPanel products={products} setProducts={setProducts} categories={categories} setCategories={setCategories} settings={settings} setSettings={setSettings} saveCatalog={saveCatalog} adminToken={adminToken} authRequest={authRequest} setAdminToken={setAdminToken} onClose={() => setModal(null)} onLogout={handleLogout} showToast={showToast} />}</div>;
}
