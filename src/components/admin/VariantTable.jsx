import { useId } from 'react';

const newVariantId = () => `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

// Tabla de variantes del producto. Vive aparte de ProductForm para que ese formulario,
// que ya es largo, siga siendo legible.
export default function VariantTable({ axis, setAxis, variants, setVariants, currency }) {
  const uid = useId();

  const update = (index, field, value) => setVariants(variants.map((v, i) => {
    if (i !== index) return v;
    if (field === 'label') return { ...v, label: value };
    if (field === 'price') return { ...v, price: value };
    return { ...v, stockQty: value };
  }));

  const add = () => setVariants([...variants, { id: newVariantId(), label: '', price: '', stockQty: 1 }]);
  const remove = (index) => setVariants(variants.filter((_, i) => i !== index));

  return (
    <div className="variant-editor">
      <div className="field">
        <label htmlFor={`${uid}-axis`}>Nombre de la opción</label>
        <input id={`${uid}-axis`} type="text" value={axis} onChange={(e) => setAxis(e.target.value)} placeholder="Ej. Capacidad, RAM, Condición" />
        <div className="hint">Es el título que verá el cliente sobre los botones de elección.</div>
      </div>

      {variants.length === 0 ? (
        <div className="empty-state" style={{ padding: 16 }}>
          <p>Este producto no tiene opciones. Usa el precio y el stock de arriba.</p>
        </div>
      ) : (
        <div className="variant-rows">
          {variants.map((v, index) => (
            <div className="variant-row" key={v.id}>
              <label htmlFor={`${uid}-${index}-label`}>Opción<input id={`${uid}-${index}-label`} type="text" value={v.label} onChange={(e) => update(index, 'label', e.target.value)} placeholder="Ej. 256GB SSD" /></label>
              <label htmlFor={`${uid}-${index}-price`}>Precio ({currency})<input id={`${uid}-${index}-price`} type="number" min="0" value={v.price} onChange={(e) => update(index, 'price', e.target.value)} placeholder="0" /></label>
              <label htmlFor={`${uid}-${index}-stock`}>Stock<input id={`${uid}-${index}-stock`} type="number" min="0" step="1" value={v.stockQty} onChange={(e) => update(index, 'stockQty', e.target.value)} placeholder="0" /></label>
              <button type="button" className="icon-btn danger-icon" aria-label={`Eliminar la opción ${v.label || index + 1}`} title="Eliminar opción" onClick={() => remove(index)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="btn-secondary" onClick={add}>+ Agregar opción</button>
      {variants.length > 0 && <div className="hint">Con opciones activas, el precio y el stock del producto se calculan solos: el precio más bajo y la suma del inventario.</div>}
    </div>
  );
}
