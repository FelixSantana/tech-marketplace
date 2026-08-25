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

  useEffect(() => {
    if (editingProduct?.category && !categories.some((c) => c.name === editingProduct.category)) {
      setCategories((prev) => [...prev, { name: editingProduct.category, emoji: '📦' }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImgUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) { showToast(`Máximo ${MAX_IMAGES} fotos por producto`); e.target.value = ''; return; }
    const toProcess = files.slice(0, remaining);
    if (files.length > remaining) { showToast(`Solo se agregaron ${remaining} foto(s), máximo ${MAX_IMAGES} por producto`); }
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
    let nextCategories;
    if (existing) { nextCategories = categories.map((c) => (c.name === existing.name ? { ...c, emoji } : c)); }
    else { nextCategories = [...categories, { name: trimmed, emoji }]; }
    setCategories(nextCategories);
    await saveCatalog(adminToken, { categories: nextCategories });
    setCategory(existing ? existing.name : trimmed);
    setShowNewCat(false);
    setNewCatName('');
    setNewCatEmoji('');
  };

  const handleSubmit = async () => {
    if (!name.trim()) return showToast('Ingresa el nombre del producto');
    if (price === '' || isNaN(price) || Number(price) < 0) return showToast('Ingresa un precio válido');
    if (stockQty === '' || isNaN(stockQty) || Number(stockQty) < 0) return showToast('Ingresa una cantidad de stock válida');
    if (category === '__new__') return showToast('Termina de crear la categoría o cancélala');
    const data = { name: name.trim(), price: Number(price), category, warranty: warranty.trim(), description: description.trim(), stockQty: Math.floor(Number(stockQty)), images: images.slice(), primaryImage: primaryIdx };
    onSave(data);
  };

  return (
    <>
      <div className="field">
        <label>Fotos del producto</label>
        <div className="img-thumbs">
          {images.map((img, idx) => (
            <div className={`img-thumb ${idx === primaryIdx ? 'primary' : ''}`} key={idx}>
              <img src={img} alt="" />
              <button className="thumb-star" title="Marcar como principal" onClick={() => setPrimaryIdx(idx)}>★</button>
              <button className="thumb-del" title="Eliminar" onClick={() => deleteImg(idx)}>✕</button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <label className="img-thumb-add">+<input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImgUpload} /></label>
          )}
        </div>
        <div className="hint">Sube varias fotos y toca la estrella para elegir cuál se muestra como principal en el catálogo.</div>
      </div>
      <div className="field">
        <label>Nombre del producto</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Audífonos Bluetooth X200" />
      </div>
      <div className="field-row">
        <div className="field"><label>Precio ({settings.currency})</label><input type="number" min="0" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <div className="field"><label>Cantidad en stock</label><input type="number" min="0" step="1" placeholder="0" value={stockQty} onChange={(e) => setStockQty(e.target.value)} /></div>
      </div>
      <div className="field">
        <label>Categoría</label>
        <select value={category} onChange={(e) => { const v = e.target.value; setCategory(v); setShowNewCat(v === '__new__'); }}>
          <option value="" disabled={!!category}>Selecciona una categoría</option>
          {categories.map((c) => (<option key={c.name} value={c.name}>{c.emoji} {c.name}</option>))}
          <option value="__new__">+ Crear categoría</option>
        </select>
        {showNewCat && (
          <div style={{ marginTop: 8 }}>
            <input type="text" placeholder="Nombre de la nueva categoría" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNewCategory())} />
            <div className="field-row" style={{ marginTop: 8, alignItems: 'center' }}>
              <input type="text" placeholder="📦" maxLength={4} style={{ maxWidth: 64, textAlign: 'center', fontSize: 18, flex: 'none' }} value={newCatEmoji} onChange={(e) => setNewCatEmoji(e.target.value)} />
              <div className="hint" style={{ margin: 0, flex: 1 }}>Elige o pega un emoji para esta categoría. Si lo dejas vacío se usará 📦.</div>
            </div>
            <div className="emoji-picks">{EMOJI_PICKS.map((e) => (<button type="button" className="emoji-pick" key={e} onClick={() => setNewCatEmoji(e)}>{e}</button>))}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" className="btn-secondary" style={{ marginTop: 0, width: 'auto', flex: 1 }} onClick={() => { setShowNewCat(false); setCategory(''); setNewCatName(''); setNewCatEmoji(''); }}>Cancelar</button>
              <button type="button" className="btn-primary" style={{ marginTop: 0, width: 'auto', flex: 1 }} onClick={addNewCategory}>Guardar categoría</button>
            </div>
          </div>
        )}
      </div>
      <div className="field">
        <label>Garantía</label>
        <input type="text" value={warranty} onChange={(e) => setWarranty(e.target.value)} placeholder="Ej. 6 meses, 1 año, Sin garantía" />
        <div className="hint">Se muestra en la tarjeta del producto junto a la categoría.</div>
      </div>
      <div className="field">
        <label>Descripción detallada</label>
        <textarea style={{ minHeight: 90 }} placeholder="Detalles, color, capacidad, especificaciones, etc." value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="hint">Esta descripción completa se muestra cuando el cliente toca el producto para ver el detalle.</div>
      </div>
      <button className="btn-primary" onClick={handleSubmit}>{editingProduct ? 'Guardar cambios' : 'Agregar al catálogo'}</button>
      {editingProduct && (<button className="btn-secondary" onClick={onCancel}>Cancelar edición</button>)}
    </>
  );
}
