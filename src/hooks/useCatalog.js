import { useState, useCallback } from 'react';

export const defaultSettings = { storeName: 'Synaptic Tech', tagline: 'Tecnología al alcance de tu WhatsApp', whatsapp: '', currency: 'RD$', logo: '', configured: false };
export const defaultCategories = [
  { name: 'Laptops', emoji: '💻' }, { name: 'Celulares', emoji: '📱' }, { name: 'Accesorios', emoji: '🎧' }, { name: 'Servicios', emoji: '🛠️' },
];
const CATALOG_API = '/api/catalog';
export function getStockQty(p) { if (typeof p.stockQty === 'number') return p.stockQty; return p.stock === false ? 0 : 999; }
export function getProductImages(p) { if (Array.isArray(p.images) && p.images.length) return p.images; if (p.image) return [p.image]; return []; }
export function getPrimaryImage(p) { const imgs = getProductImages(p); const idx = typeof p.primaryImage === 'number' && p.primaryImage < imgs.length ? p.primaryImage : 0; return imgs[idx] || ''; }

export function useCatalog() {
  const [settings, setSettings] = useState({ ...defaultSettings });
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(defaultCategories.slice());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
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
        setProducts(data.products.map((p) => ({ ...p, images: getProductImages(p), primaryImage: typeof p.primaryImage === 'number' ? p.primaryImage : 0, stockQty: getStockQty(p) })));
      }
      if (Array.isArray(data.categories) && data.categories.length) {
        setCategories(data.categories.map((c) => {
          if (typeof c === 'string') {
            const known = defaultCategories.find((d) => d.name.toLowerCase() === c.toLowerCase());
            return known ? { ...known } : { name: c, emoji: '📦' };
          }
          return c;
        }));
      } else { setCategories(defaultCategories.slice()); }
      setLoading(false);
      return data;
    } catch (e) {
      console.error('fetchCatalog failed', e);
      setLoadError('No se pudo conectar con el servidor.');
      setLoading(false);
      return null;
    }
  }, []);

  const saveCatalog = useCallback(async (adminToken, overrides = {}) => {
    try {
      const payload = { settings: overrides.settings || settings, products: overrides.products || products, categories: overrides.categories || categories };
      const str = JSON.stringify(payload);
      if (str.length > 4500000) {
        setSaveError('El inventario ya casi llega al límite de almacenamiento. Elimina o reduce fotos de algunos productos e intenta de nuevo.');
        return false;
      }
      const r = await fetch(CATALOG_API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken }, body: str });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        if (r.status === 401) { setSaveError('Tu sesión expiró. Vuelve a iniciar sesión.'); }
        else { setSaveError(err.message || 'Error al guardar en el servidor.'); }
        return false;
      }
      return true;
    } catch (e) {
      console.error('saveCatalog failed', e);
      setSaveError('No se pudo conectar con el servidor.');
      return false;
    }
  }, [settings, products, categories]);

  return { settings, setSettings, products, setProducts, categories, setCategories, loading, loadError, saveError, fetchCatalog, saveCatalog };
}
