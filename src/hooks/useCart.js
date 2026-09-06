import { useState, useEffect, useCallback } from 'react';
import { getStockQty, hasVariants, getVariant } from './useCatalog';

const CART_KEY = 'cart';
function readCart() { try { const raw = localStorage.getItem(CART_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; } }
function writeCart(cart) { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* ignore */ } }

// Un articulo del carrito es producto+variante. La clave solo vive en memoria: nunca se guarda
// como id compuesto, para que borrar una variante no corrompa nada.
export function cartKey(productId, variantId) { return `${productId}::${variantId || ''}`; }
const sameItem = (i, productId, variantId) => i.productId === productId && (i.variantId || null) === (variantId || null);

// Stock disponible de lo que el cliente realmente eligio.
function availableFor(product, variantId) {
  if (!hasVariants(product)) return getStockQty(product);
  const variant = getVariant(product, variantId);
  return variant ? Math.max(0, Math.floor(Number(variant.stockQty) || 0)) : 0;
}

export function useCart(products, onToast) {
  const [cart, setCart] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated || products.length === 0) return;
    const saved = readCart();
    if (Array.isArray(saved)) {
      let descartados = false;
      const cleaned = saved.map((ci) => {
        const p = products.find((x) => x.id === ci.productId);
        if (!p) { descartados = true; return null; }
        const variantId = ci.variantId || null;
        // Guardado antes de que el producto tuviera variantes, o apuntando a una que ya no
        // existe: no hay precio que resolver, y elegir una por el cliente seria adivinar.
        if (hasVariants(p) && !getVariant(p, variantId)) { descartados = true; return null; }
        if (!hasVariants(p) && variantId) { descartados = true; return null; }
        const qty = Math.min(ci.qty, Math.max(availableFor(p, variantId), 0));
        if (qty <= 0) { descartados = true; return null; }
        return { productId: ci.productId, variantId, qty };
      }).filter(Boolean);
      setCart(cleaned);
      if (descartados && saved.length) onToast?.('Algunos productos cambiaron y salieron de tu carrito');
    }
    setHydrated(true);
  }, [products, hydrated, onToast]);

  useEffect(() => { if (hydrated) writeCart(cart); }, [cart, hydrated]);

  const addToCart = useCallback((productId, qty, onAddToast, variantId = null) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    if (hasVariants(p) && !getVariant(p, variantId)) { onAddToast?.('Elige una opción del producto'); return; }
    const stockQty = availableFor(p, variantId);
    if (stockQty <= 0) { onAddToast?.('Este producto está agotado'); return; }
    setCart((prev) => {
      const item = prev.find((i) => sameItem(i, productId, variantId));
      const currentQty = item ? item.qty : 0;
      const newQty = Math.min(stockQty, currentQty + qty);
      if (newQty === currentQty) { onAddToast?.('No hay más stock disponible'); return prev; }
      onAddToast?.('Agregado al carrito');
      if (item) { return prev.map((i) => (sameItem(i, productId, variantId) ? { ...i, qty: newQty } : i)); }
      return [...prev, { productId, variantId: variantId || null, qty: newQty }];
    });
  }, [products]);

  const updateCartQty = useCallback((productId, qty, variantId = null) => {
    const p = products.find((x) => x.id === productId);
    const stockQty = p ? availableFor(p, variantId) : 999;
    setCart((prev) => prev.map((i) => (sameItem(i, productId, variantId) ? { ...i, qty: Math.max(1, Math.min(qty, stockQty)) } : i)));
  }, [products]);

  const removeFromCart = useCallback((productId, variantId = null) => { setCart((prev) => prev.filter((i) => !sameItem(i, productId, variantId))); }, []);
  const clearCart = useCallback(() => setCart([]), []);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  return { cart, addToCart, updateCartQty, removeFromCart, clearCart, cartCount };
}
