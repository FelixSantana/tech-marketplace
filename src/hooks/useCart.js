import { useState, useEffect, useCallback } from 'react';
import { getStockQty } from './useCatalog';

const CART_KEY = 'cart';
function readCart() { try { const raw = localStorage.getItem(CART_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; } }
function writeCart(cart) { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* ignore */ } }

export function useCart(products) {
  const [cart, setCart] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || products.length === 0) return;
    const saved = readCart();
    if (Array.isArray(saved)) {
      const cleaned = saved.filter((ci) => products.some((p) => p.id === ci.productId)).map((ci) => {
        const p = products.find((p) => p.id === ci.productId);
        return { productId: ci.productId, qty: Math.min(ci.qty, Math.max(getStockQty(p), 0)) };
      }).filter((ci) => ci.qty > 0);
      setCart(cleaned);
    }
    setHydrated(true);
  }, [products, hydrated]);

  useEffect(() => { if (hydrated) writeCart(cart); }, [cart, hydrated]);

  const addToCart = useCallback((productId, qty, onToast) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const stockQty = getStockQty(p);
    if (stockQty <= 0) { onToast?.('Este producto está agotado'); return; }
    setCart((prev) => {
      const item = prev.find((i) => i.productId === productId);
      const currentQty = item ? item.qty : 0;
      const newQty = Math.min(stockQty, currentQty + qty);
      if (newQty === currentQty) { onToast?.('No hay más stock disponible'); return prev; }
      onToast?.('Agregado al carrito');
      if (item) { return prev.map((i) => (i.productId === productId ? { ...i, qty: newQty } : i)); }
      return [...prev, { productId, qty: newQty }];
    });
  }, [products]);

  const updateCartQty = useCallback((productId, qty) => {
    const p = products.find((x) => x.id === productId);
    const stockQty = p ? getStockQty(p) : 999;
    setCart((prev) => prev.map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, Math.min(qty, stockQty)) } : i)));
  }, [products]);

  const removeFromCart = useCallback((productId) => { setCart((prev) => prev.filter((i) => i.productId !== productId)); }, []);
  const clearCart = useCallback(() => setCart([]), []);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  return { cart, addToCart, updateCartQty, removeFromCart, clearCart, cartCount };
}
