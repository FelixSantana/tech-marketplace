import { useState } from 'react';
import ProductList from './ProductList';
import ProductForm from './ProductForm';
import SettingsForm from './SettingsForm';
import OrdersPanel from './OrdersPanel';

export default function AdminPanel({ products, setProducts, categories, setCategories, settings, setSettings, saveCatalog, adminToken, authRequest, setAdminToken, onClose, onLogout, showToast }) {
  const [tab, setTab] = useState('productos');
  const [editingId, setEditingId] = useState(null);
  const editingProduct = editingId ? products.find((p) => p.id === editingId) : null;

  const switchTab = (t) => { if (t !== 'agregar') setEditingId(null); setTab(t); };

  const handleSaveProduct = async (data) => {
    let nextProducts;
    if (editingId) {
      nextProducts = products.map((p) => (p.id === editingId ? { ...p, ...data, image: undefined, stock: undefined } : p));
    } else {
      nextProducts = [...products, { id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), ...data }];
    }
    setProducts(nextProducts);
    const ok = await saveCatalog(adminToken, { products: nextProducts });
    if (ok) {
      showToast(editingId ? 'Producto actualizado' : 'Producto agregado');
      setEditingId(null);
      setTab('productos');
    } else { showToast('Error al guardar. Intenta de nuevo.'); }
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return;
    const nextProducts = products.filter((p) => p.id !== id);
    setProducts(nextProducts);
    await saveCatalog(adminToken, { products: nextProducts });
    showToast('Producto eliminado');
  };

  const handleSaveSettings = async (updates) => {
    const nextSettings = { ...settings, ...updates };
    setSettings(nextSettings);
    return saveCatalog(adminToken, { settings: nextSettings });
  };

  return (
    <div className="overlay">
      <div className="panel" style={{ maxWidth: 1100 }}>
        <div className="panel-head">
          <h2>Panel de administración</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="tabs">
          <button className={`tab ${tab === 'productos' ? 'active' : ''}`} onClick={() => switchTab('productos')}>Productos</button>
          <button className={`tab ${tab === 'agregar' ? 'active' : ''}`} onClick={() => switchTab('agregar')}>{editingId ? 'Editar' : 'Agregar'}</button>
          <button className={`tab ${tab === 'ordenes' ? 'active' : ''}`} onClick={() => switchTab('ordenes')}>Órdenes</button>
          <button className={`tab ${tab === 'ajustes' ? 'active' : ''}`} onClick={() => switchTab('ajustes')}>Ajustes</button>
        </div>
        {tab === 'productos' && (
          <ProductList products={products} settings={settings} onEdit={(id) => { setEditingId(id); setTab('agregar'); }} onDelete={handleDeleteProduct} />
        )}
        {tab === 'agregar' && (
          <ProductForm key={editingId || 'new'} editingProduct={editingProduct} categories={categories} setCategories={setCategories} settings={settings} onSave={handleSaveProduct} onCancel={() => { setEditingId(null); setTab('productos'); }} saveCatalog={saveCatalog} adminToken={adminToken} showToast={showToast} />
        )}
        {tab === 'ordenes' && (
          <OrdersPanel adminToken={adminToken} products={products} showToast={showToast} />
        )}
        {tab === 'ajustes' && (
          <SettingsForm settings={settings} onSaveSettings={handleSaveSettings} authRequest={authRequest} setAdminToken={setAdminToken} onLogout={onLogout} showToast={showToast} />
        )}
      </div>
    </div>
  );
}
