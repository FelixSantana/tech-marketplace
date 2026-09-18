import { useState } from 'react';
import ProductList from './ProductList';
import ProductForm from './ProductForm';
import SettingsForm from './SettingsForm';
import OrdersPanel from './OrdersPanel';
import PrintCatalog from './PrintCatalog';
import MigrateImages from './MigrateImages';
import MetricsPanel from './MetricsPanel';
import { mergeProductEdit } from '../../lib/catalogMerge';

export default function AdminPanel({ products, reservas, categories, setCategories, settings, saveCatalog, refreshCatalog, adminToken, authRequest, setAdminToken, onClose, onLogout, showToast }) {
  const [tab, setTab] = useState('productos');
  const [editingId, setEditingId] = useState(null);
  // null | 'clientes' | 'inventario'. Solo se llega aqui con sesion de admin abierta.
  const [printMode, setPrintMode] = useState(null);
  const editingProduct = editingId ? products.find((p) => p.id === editingId) : null;

  const switchTab = (t) => { if (t !== 'agregar') setEditingId(null); setTab(t); };

  // original: el producto tal como estaba al abrir el formulario. Con el se distingue el stock que
  // el admin cambio del que solo arrastra el formulario y que el servidor pudo haber descontado.
  const handleSaveProduct = async (data, original) => {
    const id = editingId || 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const ok = await saveCatalog(adminToken, (fresco) => ({ products: mergeProductEdit(fresco.products, { id, original: editingId ? original : null, data }) }));
    if (ok) {
      showToast(editingId ? 'Producto actualizado correctamente' : 'Producto agregado correctamente');
      setEditingId(null);
      setTab('productos');
      return true;
    }
    showToast('No se pudo guardar el producto. Verifica que tu sesión de administrador siga activa.');
    return false;
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return;
    const ok = await saveCatalog(adminToken, (fresco) => ({ products: fresco.products.filter((p) => p.id !== id) }));
    if (ok) showToast('Producto eliminado');
    else showToast('No se pudo eliminar el producto.');
  };

  const handleSaveSettings = async (updates) => saveCatalog(adminToken, (fresco) => ({ settings: { ...fresco.settings, ...updates } }));

  return (
    <div className="overlay">
      <div className="panel admin-panel" style={{ maxWidth: 1100 }}>
        <div className="panel-head">
          <div><h2>Panel de administración</h2><p className="admin-subtitle">Gestiona productos, pedidos y configuración de tu tienda.</p></div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar panel">✕</button>
        </div>
        <div className="tabs">
          <button className={`tab ${tab === 'productos' ? 'active' : ''}`} onClick={() => switchTab('productos')}>Productos</button>
          <button className={`tab ${tab === 'agregar' ? 'active' : ''}`} onClick={() => switchTab('agregar')}>{editingId ? 'Editar' : 'Agregar'}</button>
          <button className={`tab ${tab === 'ordenes' ? 'active' : ''}`} onClick={() => switchTab('ordenes')}>Órdenes</button>
          <button className={`tab ${tab === 'metricas' ? 'active' : ''}`} onClick={() => switchTab('metricas')}>Métricas</button>
          <button className={`tab ${tab === 'ajustes' ? 'active' : ''}`} onClick={() => switchTab('ajustes')}>Ajustes</button>
        </div>
        {tab === 'productos' && (
          <>
            <div className="print-actions">
              <div>
                <strong>Imprimir el catálogo</strong>
                <span>Se abre una vista lista para imprimir o guardar como PDF desde el navegador.</span>
              </div>
              <div className="print-actions-buttons">
                <button className="btn-secondary" onClick={() => setPrintMode('clientes')}>Catálogo para clientes</button>
                <button className="btn-secondary" onClick={() => setPrintMode('inventario')}>Hoja de inventario</button>
              </div>
            </div>
            <MigrateImages products={products} settings={settings} saveCatalog={saveCatalog} adminToken={adminToken} showToast={showToast} />
            <ProductList products={products} reservas={reservas} settings={settings} onEdit={(id) => { setEditingId(id); setTab('agregar'); }} onDelete={handleDeleteProduct} />
          </>
        )}
        {tab === 'agregar' && (
          <ProductForm key={editingId || 'new'} editingProduct={editingProduct} categories={categories} setCategories={setCategories} settings={settings} onSave={handleSaveProduct} onCancel={() => { setEditingId(null); setTab('productos'); }} saveCatalog={saveCatalog} adminToken={adminToken} showToast={showToast} />
        )}
        {tab === 'ordenes' && (
          <OrdersPanel adminToken={adminToken} products={products} showToast={showToast} onInventoryChanged={refreshCatalog} />
        )}
        {tab === 'metricas' && (
          <MetricsPanel adminToken={adminToken} showToast={showToast} />
        )}
        {tab === 'ajustes' && (
          <SettingsForm settings={settings} onSaveSettings={handleSaveSettings} authRequest={authRequest} adminToken={adminToken} setAdminToken={setAdminToken} refreshCatalog={refreshCatalog} onLogout={onLogout} showToast={showToast} />
        )}
      </div>
      {printMode && <PrintCatalog products={products} settings={settings} modo={printMode} onClose={() => setPrintMode(null)} />}
    </div>
  );
}
