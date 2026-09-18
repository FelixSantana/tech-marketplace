import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header';
import CategoryChips from './components/CategoryChips';
import TopBar from './components/TopBar';                 // PROTOTIPO D
import TrustBadges from './components/TrustBadges';       // PROTOTIPO D
import StoreFooter from './components/StoreFooter';       // PROTOTIPO D
import ProductGrid from './components/ProductGrid';
import ProductDetail from './components/ProductDetail';
import CartModal from './components/CartModal';
import CheckoutModal from './components/CheckoutModal';
import Toast from './components/Toast';
import { SetupModal, LoginModal } from './components/admin/AuthModals';
import AdminPanel from './components/admin/AdminPanel';
import { useCatalog, getUnitPrice } from './hooks/useCatalog';
import { useCart } from './hooks/useCart';
import { useAuth } from './hooks/useAuth';
import { useToast } from './hooks/useToast';
import { netearApartados } from './lib/apartados';
import { buscarPorSlug, rutaProducto } from './lib/rutas';
import { registrarEvento } from './lib/eventos';
import './styles.css';
import './admin-overrides.css';
import './skin.css';   // PROTOTIPO: piel estetica A, se carga al final para ganar por orden

export default function App() {
  const { settings, products, categories, setCategories, reservas, loading, loadError, fetchCatalog, saveCatalog } = useCatalog();
  // La tienda trabaja con lo disponible; el panel, mas abajo, con el stock real.
  const disponibles = useMemo(() => netearApartados(products, reservas), [products, reservas]);
  const { message, visible, showToast } = useToast();
  const { cart, addToCart, updateCartQty, removeFromCart, clearCart, cartCount } = useCart(disponibles, showToast);
  // PROTOTIPO D: el total va en la cabecera, asi que hay que calcularlo aqui.
  // Con variante elegida manda el precio de esa variante; sin ella, el del producto.
  const cartTotal = useMemo(() => cart.reduce((suma, ci) => {
    const p = disponibles.find((x) => x.id === ci.productId);
    if (!p) return suma;
    const precio = getUnitPrice(p, ci.variantId || null);
    return suma + (Number(precio) || 0) * ci.qty;
  }, 0), [cart, disponibles]);
  const { adminToken, setAdminToken, authRequest, authStatus } = useAuth();
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('theme') || 'light'; } catch { return 'light'; } });
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [detailProductId, setDetailProductId] = useState(null);

  // Abrir y cerrar el detalle cambia la direccion, para que el enlace se pueda compartir.
  const abrirDetalle = useCallback((id) => {
    setDetailProductId(id);
    registrarEvento('producto', id);
    const p = products.find((x) => x.id === id);
    if (p) window.history.pushState({ producto: id }, '', rutaProducto(p));
  }, [products]);

  const cerrarDetalle = useCallback(() => {
    setDetailProductId(null);
    if (window.location.pathname.startsWith('/p/')) window.history.pushState({}, '', '/');
  }, []);
  const [modal, setModal] = useState(null);
  const [checkoutItems, setCheckoutItems] = useState([]);
  const [checkoutFromCart, setCheckoutFromCart] = useState(false);
  // Se resuelve al inicializar para que no parpadee la tienda antes de abrirse el panel.
  const [isAdminRoute, setIsAdminRoute] = useState(() => window.location.pathname.replace(/\/$/, '') === '/admin');

  // Una visita por pestaña, y solo en la tienda: el panel no cuenta como visita.
  useEffect(() => {
    if (!window.location.pathname.startsWith('/admin')) registrarEvento('visita');
  }, []);

  // El titulo de la pestana sigue al producto abierto. Al compartir el enlace lo pone el
  // servidor; esto lo mantiene al navegar dentro de la aplicacion.
  useEffect(() => {
    const tienda = settings.storeName || 'Synaptic Tech';
    const abierto = detailProductId ? products.find((p) => p.id === detailProductId) : null;
    document.title = abierto ? `${abierto.name} — ${tienda}` : `${tienda} — Catálogo`;
  }, [detailProductId, products, settings.storeName]);

  // Al entrar por /p/<slug>, se abre ese producto. El boton Atras del navegador tambien
  // cierra y reabre el detalle.
  useEffect(() => {
    if (!products.length) return;
    const desdeRuta = () => {
      const ruta = window.location.pathname;
      if (!ruta.startsWith('/p/')) return setDetailProductId(null);
      const p = buscarPorSlug(products, ruta);
      setDetailProductId(p ? p.id : null);
      if (!p) window.history.replaceState({}, '', '/');
    };
    desdeRuta();
    window.addEventListener('popstate', desdeRuta);
    return () => window.removeEventListener('popstate', desdeRuta);
  }, [products]);
  const [adminConfigured, setAdminConfigured] = useState(null);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark'); try { localStorage.setItem('theme', theme); } catch {} }, [theme]);

  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  // authStatus no depende del token, asi que esto corre una sola vez al abrir la pagina.
  useEffect(() => {
    let vivo = true;
    authStatus().then((r) => { if (vivo) setAdminConfigured(r.ok ? !!r.configured : false); });
    return () => { vivo = false; };
  }, [authStatus]);

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

  const handleAddCart = useCallback((id, qty, variantId = null) => addToCart(id, qty, showToast, variantId), [addToCart, showToast]);
  const startCheckout = useCallback((items, fromCart = false) => { if (!settings.whatsapp) { showToast('Configura primero el WhatsApp de la tienda'); return; } registrarEvento('checkout'); setCheckoutItems(items); setCheckoutFromCart(fromCart); setModal('checkout'); }, [settings.whatsapp, showToast]);
  const handleSingleOrder = useCallback((product, qty = 1, variantId = null) => startCheckout([{ product, qty, variantId }]), [startCheckout]);
  const handleCartCheckout = useCallback(() => { const items = cart.map((ci) => { const product = disponibles.find((p) => p.id === ci.productId); return product ? { product, qty: ci.qty, variantId: ci.variantId || null } : null; }).filter(Boolean); if (!items.length) return showToast('Tu carrito está vacío.'); setModal(null); startCheckout(items, true); }, [cart, disponibles, startCheckout, showToast]);
  const handleLogout = () => { setAdminToken(''); setModal(null); showToast('Sesión cerrada'); };

  return <div id="app"><TopBar settings={settings} /><Header settings={settings} theme={theme} onToggleTheme={() => setTheme((t) => t === 'light' ? 'dark' : 'light')} searchTerm={searchTerm} setSearchTerm={setSearchTerm} cartCount={cartCount} cartTotal={cartTotal} onOpenCart={() => setModal('cart')} /><CategoryChips products={products} activeCategory={activeCategory} setActiveCategory={setActiveCategory} /><main><TrustBadges />{loadError && !loading ? <div className="empty-state" style={{ padding: '70px 20px' }}><div className="glyph">🔌</div><h3>No se pudo conectar con el catálogo</h3><p>{loadError}</p></div> : <ProductGrid products={disponibles} allProducts={disponibles} settings={settings} activeCategory={activeCategory} searchTerm={searchTerm} onOpenDetail={abrirDetalle} onAddCart={handleAddCart} onOrderWhatsApp={handleSingleOrder} />}</main><StoreFooter settings={settings} />
    <button className="cart-fab" onClick={() => setModal('cart')} title="Ver carrito" aria-label="Ver carrito"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>{cartCount > 0 && <span className="cart-badge" style={{ display: 'flex' }}>{cartCount}</span>}</button>
    {isAdminRoute && <button className="admin-fab admin-settings-fab" onClick={openAdmin} title="Panel de administrador" aria-label="Panel de administrador"><svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.37-.31-.6-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98L14.5 2.42C14.47 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.5.42L9.12 5.07c-.61.25-1.18.59-1.69.98l-2.49-1c-.23-.08-.48 0-.6.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.08.65-.08.98s.03.66.08.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.37.31.6.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.38-2.65c.61-.25 1.18-.58 1.69-.98l2.49 1c.23.08.48 0 .6-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z"/></svg></button>}
    <Toast message={message} visible={visible} />{detailProductId && disponibles.some((p) => p.id === detailProductId) && <ProductDetail product={disponibles.find((p) => p.id === detailProductId)} settings={settings} onClose={cerrarDetalle} onAddCart={(id, qty, variantId) => handleAddCart(id, qty, variantId)} onOrderWhatsApp={handleSingleOrder} showToast={showToast} />}{modal === 'cart' && <CartModal cart={cart} products={disponibles} settings={settings} onClose={() => setModal(null)} onUpdateQty={updateCartQty} onRemove={removeFromCart} onClear={clearCart} onCheckout={handleCartCheckout} showToast={showToast} />}{modal === 'checkout' && <CheckoutModal items={checkoutItems} settings={settings} onClose={() => { setModal(null); setCheckoutItems([]); setCheckoutFromCart(false); }} onOrderCreated={() => { if (checkoutFromCart) clearCart(); showToast('Pedido registrado correctamente'); }} showToast={showToast} />}{modal === 'setup' && <SetupModal authRequest={authRequest} setAdminToken={setAdminToken} showToast={showToast} onGoLogin={() => setModal('login')} onSetupComplete={handleSetupComplete} />}{modal === 'login' && <LoginModal authRequest={authRequest} setAdminToken={setAdminToken} onLoginSuccess={() => setModal('admin')} onClose={() => setModal(null)} showToast={showToast} />}{modal === 'admin' && <AdminPanel products={products} reservas={reservas} categories={categories} setCategories={setCategories} settings={settings} saveCatalog={saveCatalog} refreshCatalog={() => fetchCatalog({ silent: true })} adminToken={adminToken} authRequest={authRequest} setAdminToken={setAdminToken} onClose={() => setModal(null)} onLogout={handleLogout} showToast={showToast} />}</div>;
}
