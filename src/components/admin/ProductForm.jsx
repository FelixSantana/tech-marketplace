import { useState, useEffect } from 'react';
import { getStockQty, getProductImages } from '../../hooks/useCatalog';
import { compressImage, EMOJI_PICKS } from '../../lib/utils';

const MAX_IMAGES = 6;

export default function ProductForm({ editingProduct, categories, setCategories, settings, onSave, onCancel, saveCatalog, adminToken, showToast }) {
  const [images, setImages] = useState(() => (editingProduct ? getProductImages(editingProduct).slice() : []));
  const [primaryIdx, setPrimaryIdx] = useState(() => editingProduct && typeof editingProduct.primaryImage === 'number' ? editingProduct.primaryImage : 0);
  const [name, setName] = useState(editingProduct?.name || '');
  const [price, setPrice] = useState(editingProduct?.price ?? '');
  const [stockQty, setStockQty] = useState(editingProduct ? getStockQty(editingProduct) : 1);
  const [category, setCategory] = useState(editingProduct?.category || '');
  const [warranty, setWarranty] = useState(editingProduct?.warranty || '');
  const [description, setDescription] = useState(editingProduct?.description || '');
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingProduct?.category && !categories.some((c) => c.name === editingProduct.category)) {
      setCategories((prev) => [...prev, { name: editingProduct.category, emoji: '📦' }]);
    }
  }, [editingProduct, categories, setCategories]);

  const handleImgUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) { showToast(`Máximo ${MAX_IMAGES} fotos por producto`); e.target.value = ''; return; }
    const toProcess = files.slice(0, remaining);
    if (files.length > remaining) showToast(`Solo se agregaron ${remaining} foto(s), máximo ${MAX_IMAGES} por producto`);
    const compressed = [];
    for (const file of toProcess) {
      try { compressed.push(await compressImage(file)); } catch { showToast('No se pudo procesar una de las imágenes'); }
    }
    setImages((prev) => [...prev, ...compressed]);
    e.target.value = '';
  };

  const deleteImg = (idx) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setPrimaryIdx((p) => (p >= next.length ? Math.max(0, next.length - 1) : p));
      return next;
    });
  };

  const addNewCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return showToast('Escribe un nombre para la categoría');
    const emoji = newCatEmoji.trim() || '📦';
    const existing = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    const nextCategories = existing ? categories.map((c) => c.name === existing.name ? { ...c, emoji } : c) : [...categories, { name: trimmed, emoji }];
    setCategories(nextCategories);
    const ok = await saveCatalog(adminToken, { categories: nextCategories });
    if (!ok) return showToast('No se pudo guardar la categoría.');
    setCategory(existing ? existing.name : trimmed);
    setShowNewCat(false); setNewCatName(''); setNewCatEmoji('');
  };

  const handleSubmit = async () => {
    if (!name.trim()) return showToast('Ingresa el nombre del producto');
    if (price === '' || isNaN(price) || Number(price) < 0) return showToast('Ingresa un precio válido');
    if (stockQty === '' || isNaN(stockQty) || Number(stockQty) < 0) return showToast('Ingresa una cantidad de stock válida');
    if (category === '__new__') return showToast('Termina de crear la categoría o cancélala');
    const data = { name: name.trim(), price: Number(price), category, warranty: warranty.trim(), description: description.trim(), stockQty: Math.floor(Number(stockQty)), images: images.slice(), primaryImage: images.length ? Math.min(primaryIdx, images.length - 1) : 0 };
    setSaving(true);
    try { await onSave(data); } finally { setSaving(false); }
  };

  return (
    <div className="product-form">
      <div className="form-section-title"><span className="section-icon">▣</span><div><h3>Información del producto</h3><p>Completa los datos que verá el cliente.</p></div></div>
      <div className="field">
        <label>Fotos del producto</label>
        <div className="img-thumbs">
          {images.map((img, idx) => <div className={`img-thumb ${idx === primaryIdx ? 'primary' : ''}`} key={idx}><img src={img} alt="" /><button type="button" className="thumb-star" title="Marcar como principal" onClick={() => setPrimaryIdx(idx)}>★</button><button type="button" className="thumb-del" title="Eliminar" onClick={() => deleteImg(idx)}>✕</button></div>)}
          {images.length < MAX_IMAGES && <label className="img-thumb-add">+<input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImgUpload} /></label>}
        </div>
        <div className="hint">Hasta {MAX_IMAGES} fotos. La estrella define la imagen principal.</div>
      </div>
      <div className="field"><label>Nombre del producto</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Audífonos Bluetooth X200" /></div>
      <div className="field-row"><div className="field"><label>Precio ({settings.currency})</label><input type="number" min="0" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} /></div><div className="field"><label>Cantidad en stock</label><input type="number" min="0" step="1" placeholder="0" value={stockQty} onChange={(e) => setStockQty(e.target.value)} /></div></div>
      <div className="field"><label>Categoría</label><select value={category} onChange={(e) => { const v = e.target.value; setCategory(v); setShowNewCat(v === '__new__'); }}><option value="" disabled={!!category}>Selecciona una categoría</option>{categories.map((c) => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}<option value="__new__">+ Crear categoría</option></select>{showNewCat && <div className="new-category-box"><input type="text" placeholder="Nombre de la nueva categoría" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} /><div className="field-row"><input type="text" placeholder="📦" maxLength={4} value={newCatEmoji} onChange={(e) => setNewCatEmoji(e.target.value)} /><div className="hint">Puedes elegir un emoji o dejarlo vacío.</div></div><div className="emoji-picks">{EMOJI_PICKS.map((e) => <button type="button" className="emoji-pick" key={e} onClick={() => setNewCatEmoji(e)}>{e}</button>)}</div><div className="form-actions"><button type="button" className="btn-secondary" onClick={() => { setShowNewCat(false); setCategory(''); setNewCatName(''); setNewCatEmoji(''); }}>Cancelar</button><button type="button" className="btn-primary" onClick={addNewCategory}>Guardar categoría</button></div></div>}</div>
      <div className="field warranty-field"><label>Garantía</label><div className="input-with-icon"><span>✓</span><input type="text" value={warranty} onChange={(e) => setWarranty(e.target.value)} placeholder="Ej. 6 meses, 1 año, Sin garantía" /></div><div className="hint">Esta información aparecerá en la tarjeta del producto.</div></div>
      <div className="field"><label>Descripción detallada</label><textarea style={{ minHeight: 90 }} placeholder="Detalles, color, capacidad, especificaciones, etc." value={description} onChange={(e) => setDescription(e.target.value)} /><div className="hint">Se muestra al abrir el detalle del producto.</div></div>
      <div className="form-actions product-form-actions"><button className="btn-secondary" onClick={onCancel} disabled={saving}>Cancelar</button><button className="btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando…' : editingProduct ? 'Guardar cambios' : 'Agregar al catálogo'}</button></div>
    </div>
  );
}
