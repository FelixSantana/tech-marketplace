import { useState, useCallback } from 'react';

export const defaultSettings = { storeName: 'Synaptic Tech', tagline: 'Tecnología al alcance de tu WhatsApp', whatsapp: '', currency: 'RD$', logo: '', configured: false };
export const defaultCategories = [
  { name: 'Laptops', emoji: '💻' }, { name: 'Celulares', emoji: '📱' }, { name: 'Accesorios', emoji: '🎧' }, { name: 'Servicios', emoji: '🛠️' },
];
const CATALOG_API = '/api/catalog';
export function hasVariants(p) { return Array.isArray(p.variants) && p.variants.length > 0; }
export function getVariants(p) { return Array.isArray(p.variants) ? p.variants : []; }
export function getVariant(p, variantId) { if (!variantId) return null; return getVariants(p).find((v) => v.id === variantId) || null; }
export function getStockQty(p) { if (hasVariants(p)) return getVariants(p).reduce((s, v) => s + Math.max(0, Math.floor(Number(v.stockQty) || 0)), 0); if (typeof p.stockQty === 'number') return p.stockQty; return p.stock === false ? 0 : 999; }
// null = el producto tiene variantes y no se eligio ninguna valida: no hay precio que mostrar
export function getUnitPrice(p, variantId) { if (!hasVariants(p)) return Number(p.price); const v = getVariant(p, variantId); return v ? Number(v.price) : null; }
export function getMinPrice(p) { if (!hasVariants(p)) return Number(p.price); return Math.min(...getVariants(p).map((v) => Number(v.price) || 0)); }
export function getProductImages(p) { if (Array.isArray(p.images) && p.images.length) return p.images; if (p.image) return [p.image]; return []; }
export function getPrimaryImage(p) { const imgs = getProductImages(p); const idx = typeof p.primaryImage === 'number' && p.primaryImage < imgs.length ? p.primaryImage : 0; return imgs[idx] || ''; }

// Deja el producto en forma canonica. Con variantes, price y stockQty pasan a ser espejo del
// minimo y de la suma, para que una version vieja del codigo siga mostrando algo coherente.
export function normalizeProduct(p) {
  const base = { ...p, images: getProductImages(p), primaryImage: typeof p.primaryImage === 'number' ? p.primaryImage : 0 };
  if (!hasVariants(p)) {
    delete base.variants; delete base.variantAxis;
    base.stockQty = getStockQty(p);
    return base;
  }
  base.variants = getVariants(p).map((v) => ({ id: v.id, label: String(v.label || '').trim(), price: Number(v.price) || 0, stockQty: Math.max(0, Math.floor(Number(v.stockQty) || 0)) }));
  base.variantAxis = String(p.variantAxis || '').trim() || 'Variante';
  base.stockQty = getStockQty(base);
  base.price = getMinPrice(base);
  return base;
}

function normalizeCategories(raw) {
  if (!Array.isArray(raw) || !raw.length) return defaultCategories.slice();
  return raw.map((c) => {
    if (typeof c === 'string') {
      const known = defaultCategories.find((d) => d.name.toLowerCase() === c.toLowerCase());
      return known ? { ...known } : { name: c, emoji: '📦' };
    }
    return c;
  });
}
const catalogVersion = (data) => { const v = Number(data && data.version); return Number.isInteger(v) && v >= 0 ? v : 0; };

export function useCatalog() {
  const [settings, setSettings] = useState({ ...defaultSettings });
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(defaultCategories.slice());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');

  // silent: recarga sin mostrar el estado de carga, para refrescar desde el panel.
  const fetchCatalog = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(CATALOG_API);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setLoadError(err.message || 'No se pudo cargar el catálogo desde el servidor.');
        setLoading(false);
        return null;
      }
      const data = await r.json();
      if (data.settings) setSettings({ ...defaultSettings, ...data.settings });
      if (Array.isArray(data.products)) {
        setProducts(data.products.map(normalizeProduct));
      }
      setCategories(normalizeCategories(data.categories));
      setLoading(false);
      return data;
    } catch (e) {
      console.error('fetchCatalog failed', e);
      setLoadError('No se pudo conectar con el servidor.');
      setLoading(false);
      return null;
    }
  }, []);

  // Guarda un cambio expresado como funcion sobre el catalogo mas reciente del servidor, nunca
  // una copia de lo que el panel tenga en memoria. El panel puede llevar horas abierto y entre
  // tanto completar una orden descuenta stock en el servidor: guardar la copia vieja revertia
  // ese descuento. `cambio(fresco)` devuelve solo lo que cambia: { products }, { settings }...
  const saveCatalog = useCallback(async (adminToken, cambio) => {
    if (typeof cambio !== 'function') throw new Error('saveCatalog espera una funcion sobre el catalogo fresco');
    setSaveError('');
    try {
      for (let intento = 0; intento < 2; intento += 1) {
        const lectura = await fetch(CATALOG_API, { cache: 'no-store' });
        if (!lectura.ok) { setSaveError('No se pudo leer el catálogo del servidor.'); return false; }
        const data = await lectura.json();
        const fresco = { settings: { ...defaultSettings, ...(data.settings || {}) }, products: Array.isArray(data.products) ? data.products.map(normalizeProduct) : [], categories: normalizeCategories(data.categories) };
        const parcial = cambio(fresco) || {};
        const payload = { settings: parcial.settings || fresco.settings, products: parcial.products || fresco.products, categories: parcial.categories || fresco.categories, version: catalogVersion(data) };
        const str = JSON.stringify(payload);
        if (str.length > 4500000) {
          setSaveError('El inventario ya casi llega al límite de almacenamiento. Elimina o reduce fotos de algunos productos e intenta de nuevo.');
          return false;
        }
        const r = await fetch(CATALOG_API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken }, body: str });
        // Alguien escribio entre la lectura y el guardado: se vuelve a aplicar el cambio sobre lo nuevo.
        if (r.status === 409) continue;
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          if (r.status === 401) { setSaveError('Tu sesión expiró. Vuelve a iniciar sesión.'); }
          else { setSaveError(err.message || 'Error al guardar en el servidor.'); }
          return false;
        }
        setSettings(payload.settings);
        setProducts(payload.products.map(normalizeProduct));
        setCategories(payload.categories);
        return true;
      }
      setSaveError('El catálogo cambió varias veces mientras guardabas. Vuelve a intentarlo.');
      return false;
    } catch (e) {
      console.error('saveCatalog failed', e);
      setSaveError('No se pudo conectar con el servidor.');
      return false;
    }
  }, []);

  return { settings, setSettings, products, setProducts, categories, setCategories, loading, loadError, saveError, fetchCatalog, saveCatalog };
}
