import { useId, useState, useEffect } from 'react';
import { getStockQty, getProductImages, getVariants } from '../../hooks/useCatalog';
import VariantTable from './VariantTable';
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
  const [variantAxis, setVariantAxis] = useState(editingProduct?.variantAxis || '');
  const [variants, setVariants] = useState(() => getVariants(editingProduct || {}).map((v) => ({ ...v })));
  const [saving, setSaving] = useState(false);
  const uid = useId();
  const conVariantes = variants.length > 0;

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
    if (category === '__new__') return showToast('Termina de crear la categoría o cancélala');
    let limpias = [];
    if (conVariantes) {
      if (!variantAxis.trim()) return showToast('Ponle nombre a la opción (ej. Capacidad)');
      limpias = variants.map((v) => ({ id: v.id, label: String(v.label || '').trim(), price: Number(v.price), stockQty: Math.floor(Number(v.stockQty)) }));
      if (limpias.some((v) => !v.label)) return showToast('Cada opción necesita un nombre');
      if (limpias.some((v) => isNaN(v.price) || v.price < 0)) return showToast('Cada opción necesita un precio válido');
      if (limpias.some((v) => isNaN(v.stockQty) || v.stockQty < 0)) return showToast('Cada opción necesita un stock válido');
      const etiquetas = limpias.map((v) => v.label.toLowerCase());
      if (new Set(etiquetas).size !== etiquetas.length) return showToast('Hay dos opciones con el mismo nombre');
    } else {
      if (price === '' || isNaN(price) || Number(price) < 0) return showToast('Ingresa un precio válido');
      if (stockQty === '' || isNaN(stockQty) || Number(stockQty) < 0) return showToast('Ingresa una cantidad de stock válida');
    }
    // Con opciones, precio y stock del producto quedan como espejo del minimo y de la suma:
    // asi una version vieja del codigo sigue mostrando algo coherente.
    const data = { name: name.trim(), price: conVariantes ? Math.min(...limpias.map((v) => v.price)) : Number(price), category, warranty: warranty.trim(), description: description.trim(), stockQty: conVariantes ? limpias.reduce((s, v) => s + v.stockQty, 0) : Math.floor(Number(stockQty)), images: images.slice(), primaryImage: images.length ? Math.min(primaryIdx, images.length - 1) : 0, ...(conVariantes ? { variantAxis: variantAxis.trim(), variants: limpias } : {}) };
    setSaving(true);
    try { await onSave(data); } finally { setSaving(false); }
  };

  return (
    <div className="product-form">
      <div className="form-section-title"><span className="section-icon">▣</span><div><h3>Información del producto</h3><p>Completa los datos que verá el cliente.</p></div></div>
      <div className="field">
        <label htmlFor={`${uid}-photos`}>Fotos del producto</label>
        <div className="img-thumbs">
          {images.map((img, idx) => <div className={`img-thumb ${idx === primaryIdx ? 'primary' : ''}`} key={idx}><img src={img} alt="" /><button type="button" className="thumb-star" title="Marcar como principal" onClick={() => setPrimaryIdx(idx)}>★</button><button type="button" className="thumb-del" title="Eliminar" onClick={() => deleteImg(idx)}>✕</button></div>)}
          {images.length < MAX_IMAGES && <label className="img-thumb-add">+<input id={`${uid}-photos`} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImgUpload} /></label>}
        </div>
        <div className="hint">Hasta {MAX_IMAGES} fotos. La estrella define la imagen principal.</div>
      </div>
      <div className="field"><label htmlFor={`${uid}-name`}>Nombre del producto</label><input id={`${uid}-name`} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Audífonos Bluetooth X200" /></div>
      <div className="field-row"><div className="field"><label htmlFor={`${uid}-price`}>Precio ({settings.currency})</label><input id={`${uid}-price`} type="number" min="0" placeholder="0" value={conVariantes ? Math.min(...variants.map((v) => Number(v.price) || 0)) : price} onChange={(e) => setPrice(e.target.value)} disabled={conVariantes} /></div><div className="field"><label htmlFor={`${uid}-stock`}>Cantidad en stock</label><input id={`${uid}-stock`} type="number" min="0" step="1" placeholder="0" value={conVariantes ? variants.reduce((s, v) => s + (Math.floor(Number(v.stockQty)) || 0), 0) : stockQty} onChange={(e) => setStockQty(e.target.value)} disabled={conVariantes} /></div></div>
      {conVariantes && <div className="hint">Los calcula la tabla de opciones de abajo.</div>}
      <div className="form-section-title" style={{ marginTop: 18 }}><span className="section-icon">◧</span><div><h3>Opciones del producto</h3><p>Para vender el mismo producto en varias configuraciones, cada una con su precio y su inventario.</p></div></div>
      <VariantTable axis={variantAxis} setAxis={setVariantAxis} variants={variants} setVariants={setVariants} currency={settings.currency} />
      <div className="field"><label htmlFor={`${uid}-category`}>Categoría</label><select id={`${uid}-category`} value={category} onChange={(e) => { const v = e.target.value; setCategory(v); setShowNewCat(v === '__new__'); }}><option value="" disabled={!!category}>Selecciona una categoría</option>{categories.map((c) => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}<option value="__new__">+ Crear categoría</option></select>{showNewCat && <div className="new-category-box"><input type="text" aria-label="Nombre de la nueva categoría" placeholder="Nombre de la nueva categoría" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} /><div className="field-row"><input type="text" aria-label="Emoji de la nueva categoría" placeholder="📦" maxLength={4} value={newCatEmoji} onChange={(e) => setNewCatEmoji(e.target.value)} /><div className="hint">Puedes elegir un emoji o dejarlo vacío.</div></div><div className="emoji-picks">{EMOJI_PICKS.map((e) => <button type="button" className="emoji-pick" key={e} onClick={() => setNewCatEmoji(e)}>{e}</button>)}</div><div className="form-actions"><button type="button" className="btn-secondary" onClick={() => { setShowNewCat(false); setCategory(''); setNewCatName(''); setNewCatEmoji(''); }}>Cancelar</button><button type="button" className="btn-primary" onClick={addNewCategory}>Guardar categoría</button></div></div>}</div>
      <div className="field warranty-field"><label htmlFor={`${uid}-warranty`}>Garantía</label><div className="input-with-icon"><span>✓</span><input id={`${uid}-warranty`} type="text" value={warranty} onChange={(e) => setWarranty(e.target.value)} placeholder="Ej. 6 meses, 1 año, Sin garantía" /></div><div className="hint">Esta información aparecerá en la tarjeta del producto.</div></div>
      <div className="field"><label htmlFor={`${uid}-description`}>Descripción detallada</label><textarea id={`${uid}-description`} style={{ minHeight: 90 }} placeholder="Detalles, color, capacidad, especificaciones, etc." value={description} onChange={(e) => setDescription(e.target.value)} /><div className="hint">Se muestra al abrir el detalle del producto.</div></div>
      <div className="form-actions product-form-actions"><button className="btn-secondary" onClick={onCancel} disabled={saving}>Cancelar</button><button className="btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Guardando…' : editingProduct ? 'Guardar cambios' : 'Agregar al catálogo'}</button></div>
    </div>
  );
}
