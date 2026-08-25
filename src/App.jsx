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
  const [activeCategory, setActiveCategory] = useState('Todos'); const [searchTerm, setSearchTerm] = useState(''); const [detailProductId, setDetailProductId] = useState(null); const [modal, setModal] = useState(null); const [checkoutItems, setCheckoutItems] = useState([]); const [isAdminRoute, setIsAdminRoute] = useState(false);
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark'); try { localStorage.setItem('theme', theme); } catch {} }, [theme]);
  useEffect(() => { fetchCatalog(); setIsAdminRoute(location.pathname.replace(/\/$/, '') === '/admin'); }, []);
  useEffect(() => { if (loading || !isAdminRoute) return; if (!settings.configured) { const t = setTimeout(() => setModal('setup'), 100); return () => clearTimeout(t); } const t = setTimeout(() => setModal(adminToken ? 'admin' : 'login'), 100); return () => clearTimeout(t); }, [loading, settings.configured, isAdminRoute, adminToken]);
  const openAdmin = useCallback(() => { if (!isAdminRoute) { window.history.pushState({}, '', '/admin'); setIsAdminRoute(true); } if (!settings.configured) { setModal('setup'); return; } setModal(adminToken ? 'admin' : 'login'); }, [settings.configured, adminToken, isAdminRoute]);
  const handleAddCart = useCallback((id, qty) => addToCart(id, qty, showToast), [addToCart, showToast]);
  const startCheckout = useCallback((items) => { if (!settings.whatsapp) { showToast('Configura primero el WhatsApp de la tienda'); return; } setCheckoutItems(items); setModal('checkout'); }, [settings.whatsapp, showToast]);
  const handleSingleOrder = useCallback((product, qty = 1) => startCheckout([{ product, qty }]), [startCheckout]);
  const handleCartCheckout = useCallback(() => { const items = cart.map((ci) => { const product = products.find((p) => p.id === ci.productId); return product ? { product, qty: ci.qty } : null; }).filter(Boolean); if (!items.length) { showToast('Tu carrito está vacío.'); return; } setModal(null); startCheckout(items); }, [cart, products, startCheckout, showToast]);
  const handleLogout = () => { setAdminToken(''); setModal(null); showToast('Sesión cerrada'); }; const handleOrderCreated = () => showToast('Pedido registrado correctamente');
  return <div id="app"><Header settings={settings} theme={theme} onToggleTheme={() => setTheme((t) => t === 'light' ? 'dark' : 'light')} searchTerm={searchTerm} setSearchTerm={setSearchTerm} /><CategoryChips products={products} activeCategory={activeCategory} setActiveCategory={setActiveCategory} /><main>{loadError && !loading ? <div className="empty-state" style={{ padding: '70px 20px' }}><div className="glyph">🔌</div><h3>No se pudo conectar con el catálogo</h3><p>{loadError}</p></div> : <ProductGrid products={products} allProducts={products} settings={settings} activeCategory={activeCategory} searchTerm={searchTerm} onOpenDetail={setDetailProductId} onAddCart={handleAddCart} onOrderWhatsApp={handleSingleOrder} />}</main><footer>Catálogo digital de {settings.storeName || 'Synaptic Tech'}</footer>
    <button className="cart-fab" onClick={() => setModal('cart')} title="Ver carrito" aria-label="Ver carrito"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>{cartCount > 0 && <span className="cart-badge" style={{ display: 'flex' }}>{cartCount}</span>}</button>
    {settings.configured && isAdminRoute && <button className="admin-fab admin-settings-fab" onClick={openAdmin} title="Panel de administrador" aria-label="Panel de administrador"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5l1.1 1.8a7.3 7.3 0 0 1 1.7.7l2-.6 1.6 1.6-.6 2a7.3 7.3 0 0 1 .7 1.7l1.8 1.1v2.4l-1.8 1.1a7.3 7.3 0 0 1-.7 1.7l.6 2-1.6 1.6-2-.6a7.3 7.3 0 0 1-1.7.7L12 20.5l-2.4-.1-1.1-1.8a7.3 7.3 0 0 1-1.7-.7l-2 .6-1.6-1.6.6-2a7.3 7.3 0 0 1-.7-1.7L1.3 12l1.8-1.1a7.3 7.3 0 0 1 .7-1.7l-.6-2a7.3 7.3 0 0 1 .7-1.7l1.1-1.8z"/><circle cx="12" cy="12" r="2.7"/></svg></button>}
    <Toast message={message} visible={visible} />{detailProductId && <ProductDetail product={products.find((p) => p.id === detailProductId)} settings={settings} onClose={() => setDetailProductId(null)} onAddCart={(id, qty) => handleAddCart(id, qty)} onOrderWhatsApp={handleSingleOrder} />}{modal === 'cart' && <CartModal cart={cart} products={products} settings={settings} onClose={() => setModal(null)} onUpdateQty={updateCartQty} onRemove={removeFromCart} onClear={clearCart} onCheckout={handleCartCheckout} showToast={showToast} />}{modal === 'checkout' && <CheckoutModal items={checkoutItems} settings={settings} onClose={() => { setModal(null); setCheckoutItems([]); }} onOrderCreated={handleOrderCreated} showToast={showToast} />}{modal === 'setup' && <SetupModal settings={settings} authRequest={authRequest} setAdminToken={setAdminToken} showToast={showToast} onSetupComplete={async (updates) => { const nextSettings = { ...settings, ...updates }; setSettings(nextSettings); const ok = await saveCatalog(adminToken, { settings: nextSettings }); if (!ok) showToast('La cuenta se creó, pero no se pudo guardar la configuración.'); else showToast('Configuración guardada'); setModal('admin'); }} />}{modal === 'login' && <LoginModal authRequest={authRequest} setAdminToken={setAdminToken} onLoginSuccess={() => setModal('admin')} onClose={() => setModal(null)} showToast={showToast} />}{modal === 'admin' && <AdminPanel products={products} setProducts={setProducts} categories={categories} setCategories={setCategories} settings={settings} setSettings={setSettings} saveCatalog={saveCatalog} adminToken={adminToken} authRequest={authRequest} setAdminToken={setAdminToken} onClose={() => setModal(null)} onLogout={handleLogout} showToast={showToast} />}</div>;
}
