import { useCallback, useEffect, useMemo, useState } from 'react';

const STATUS = { pending: 'Pendiente', paid: 'Pagado', shipped: 'Enviado', completed: 'Completado', cancelled: 'Cancelado' };
const money = (n, currency = 'RD$') => `${currency} ${Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function ProductRows({ products, catalog, onChange, onRemove }) {
  const addProduct = (id) => {
    if (!id) return;
    const p = catalog.find((item) => item.id === id);
    if (!p) return;
    const existing = products.find((item) => item.productId === id);
    if (existing) onChange(products.map((item) => item.productId === id ? { ...item, quantity: item.quantity + 1 } : item));
    else onChange([...products, { productId: p.id, name: p.name, quantity: 1, unitPrice: Number(p.price) || 0, subtotal: Number(p.price) || 0 }]);
  };
  const update = (index, field, value) => onChange(products.map((item, i) => {
    if (i !== index) return item;
    const next = { ...item, [field]: field === 'quantity' ? Math.max(1, Math.floor(Number(value) || 1)) : Math.max(0, Number(value) || 0) };
    next.subtotal = next.quantity * next.unitPrice;
    return next;
  }));
  return <div>
    <div className="form-grid" style={{ marginBottom: 12 }}><label>Agregar producto<select defaultValue="" onChange={(e) => { addProduct(e.target.value); e.target.value = ''; }}><option value="">Seleccionar producto…</option>{catalog.map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.price)}</option>)}</select></label></div>
    {products.length === 0 ? <div className="empty-state" style={{ padding: 20 }}><p>No hay productos en esta orden.</p></div> : <div style={{ display: 'grid', gap: 8 }}>
      {products.map((item, index) => <div key={`${item.productId}-${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1fr) 90px 120px 120px 36px', gap: 8, alignItems: 'end', padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
        <label>Producto<input value={item.name} readOnly /></label><label>Cantidad<input type="number" min="1" value={item.quantity} onChange={(e) => update(index, 'quantity', e.target.value)} /></label><label>Precio<input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => update(index, 'unitPrice', e.target.value)} /></label><label>Subtotal<input value={money(item.subtotal)} readOnly /></label><button type="button" className="icon-btn" title="Eliminar producto" onClick={() => onRemove(index)}>✕</button>
      </div>)}
    </div>}
  </div>;
}

export default function OrdersPanel({ adminToken, products: catalog, showToast }) {
  const [orders, setOrders] = useState([]); const [loading, setLoading] = useState(true); const [filter, setFilter] = useState('all'); const [search, setSearch] = useState(''); const [editing, setEditing] = useState(null); const [form, setForm] = useState(null);
  const headers = useMemo(() => ({ Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }), [adminToken]);
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/orders', { headers }); const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.message || data.error || 'No se pudieron cargar las órdenes.'); setOrders(data.orders || []); }
    catch (e) { showToast(e.message); } finally { setLoading(false); }
  }, [headers, showToast]);
  useEffect(() => { load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => String(o.createdAt || '').slice(0, 10) === today);
  const revenueToday = todayOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const pending = orders.filter((o) => o.status === 'pending').length;
  const visible = orders.filter((o) => { const matchesStatus = filter === 'all' || o.status === filter; const q = search.trim().toLowerCase(); const matchesSearch = !q || `${o.id} ${o.customerName} ${o.phone}`.toLowerCase().includes(q); return matchesStatus && matchesSearch; });

  const startNew = () => { setEditing('new'); setForm({ customerName: '', phone: '', notes: '', status: 'pending', products: [] }); };
  const startEdit = (order) => { setEditing(order.id); setForm({ customerName: order.customerName || '', phone: order.phone || '', notes: order.notes || '', status: order.status || 'pending', products: (order.products || []).map((p) => ({ ...p })) }); };
  const save = async () => {
    if (!form.customerName.trim()) return showToast('El nombre del cliente es obligatorio.');
    if (!form.products.length) return showToast('Agrega al menos un producto.');
    const method = editing === 'new' ? 'POST' : 'PUT'; const body = editing === 'new' ? form : { ...form, id: editing };
    try { const r = await fetch('/api/orders', { method, headers, body: JSON.stringify(body) }); const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.message || data.error || 'No se pudo guardar la orden.'); showToast(editing === 'new' ? 'Orden creada' : 'Orden actualizada'); setEditing(null); setForm(null); await load(); }
    catch (e) { showToast(e.message); }
  };
  const remove = async (id) => { if (!confirm('¿Eliminar esta orden?')) return; try { const r = await fetch('/api/orders', { method: 'DELETE', headers, body: JSON.stringify({ id }) }); if (!r.ok) throw new Error('No se pudo eliminar la orden.'); showToast('Orden eliminada'); await load(); } catch (e) { showToast(e.message); } };
  const quickStatus = async (order, status) => { try { const r = await fetch('/api/orders', { method: 'PUT', headers, body: JSON.stringify({ id: order.id, status }) }); if (!r.ok) throw new Error('No se pudo actualizar el estado.'); await load(); } catch (e) { showToast(e.message); } };

  if (editing && form) {
    const total = form.products.reduce((s, p) => s + Number(p.quantity || 0) * Number(p.unitPrice || 0), 0);
    return <div>
      <div className="panel-head"><h2>{editing === 'new' ? 'Nueva orden' : 'Editar orden'}</h2><button className="icon-btn" onClick={() => { setEditing(null); setForm(null); }}>✕</button></div>
      <div className="form-grid"><label>Cliente<input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></label><label>WhatsApp<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" /></label><label>Estado<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label><label>Notas<textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label></div>
      <h3 style={{ marginTop: 20 }}>Productos</h3>
      <ProductRows products={form.products} catalog={catalog} onChange={(products) => setForm({ ...form, products })} onRemove={(index) => setForm({ ...form, products: form.products.filter((_, i) => i !== index) })} />
      <div className="cart-total-row" style={{ marginTop: 18 }}><span>Total</span><strong className="mono">{money(total)}</strong></div>
      <div className="form-actions" style={{ marginTop: 16 }}><button className="btn-secondary" onClick={() => { setEditing(null); setForm(null); }}>Cancelar</button><button className="btn-primary" onClick={save}>Guardar orden</button></div>
    </div>;
  }

  return <div>
    <div className="panel-head"><div><h2>Órdenes</h2><p style={{ margin: 0, color: 'var(--text-muted)' }}>Gestiona pedidos manuales y pedidos recibidos por WhatsApp.</p></div><button className="btn-primary" onClick={startNew}>+ Nueva orden</button></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 18 }}>
      <div className="stat-card"><span>Órdenes hoy</span><strong>{todayOrders.length}</strong></div><div className="stat-card"><span>Ingresos hoy</span><strong>{money(revenueToday)}</strong></div><div className="stat-card"><span>Pendientes</span><strong>{pending}</strong></div><div className="stat-card"><span>Total órdenes</span><strong>{orders.length}</strong></div>
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente, teléfono o número…" style={{ flex: '1 1 260px' }} /><select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 180 }}><option value="all">Todos</option>{Object.entries(STATUS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select><button className="btn-secondary" onClick={load}>Actualizar</button></div>
    {loading ? <div className="empty-state" style={{ padding: 30 }}><p>Cargando órdenes…</p></div> : visible.length === 0 ? <div className="empty-state" style={{ padding: 30 }}><div className="glyph">📦</div><h3>No hay órdenes</h3><p>Las nuevas órdenes aparecerán aquí.</p></div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr>{['Orden','Cliente','Productos','Total','Estado','Fecha',''].map((h) => <th key={h} style={{ textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>{h}</th>)}</tr></thead><tbody>{visible.map((order) => <tr key={order.id}><td className="mono" style={{ padding: '10px 8px' }}>#{order.id.slice(-8)}</td><td style={{ padding: '10px 8px' }}><strong>{order.customerName}</strong><br /><small>{order.phone}</small></td><td style={{ padding: '10px 8px' }}>{(order.products || []).map((p) => `${p.name} ×${p.quantity}`).join(', ')}</td><td className="mono" style={{ padding: '10px 8px' }}>{money(order.total)}</td><td style={{ padding: '10px 8px' }}><select value={order.status} onChange={(e) => quickStatus(order, e.target.value)}>{Object.entries(STATUS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></td><td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>{new Date(order.createdAt).toLocaleString('es-DO')}</td><td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}><button className="btn-secondary" onClick={() => startEdit(order)}>Editar</button> <button className="icon-btn" onClick={() => remove(order.id)} title="Eliminar">🗑️</button></td></tr>)}</tbody></table></div>}
  </div>;
}
