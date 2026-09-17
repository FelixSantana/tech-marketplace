import { useId } from 'react';

const nuevaZonaId = () => `z_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

// Entrega y envio. Mientras el interruptor este apagado, la tienda se comporta como siempre:
// la entrega se coordina por WhatsApp y no se le pide nada mas al cliente.
export default function ShippingForm({ envio, setEnvio, currency }) {
  const uid = useId();
  const zonas = Array.isArray(envio.zonas) ? envio.zonas : [];

  const cambiar = (campo, valor) => setEnvio({ ...envio, [campo]: valor });
  const cambiarZona = (index, campo, valor) => cambiar('zonas', zonas.map((z, i) => (i === index ? { ...z, [campo]: valor } : z)));
  const agregarZona = () => cambiar('zonas', [...zonas, { id: nuevaZonaId(), nombre: '', precio: '' }]);
  const quitarZona = (index) => cambiar('zonas', zonas.filter((_, i) => i !== index));

  return (
    <div className="shipping-form">
      <label className="switch-row" htmlFor={`${uid}-activo`}>
        <input id={`${uid}-activo`} type="checkbox" checked={envio.activo === true} onChange={(e) => cambiar('activo', e.target.checked)} />
        <span>
          <strong>Pedir datos de entrega en el checkout</strong>
          <small>Apagado, la entrega se coordina por WhatsApp como hasta ahora y no se le pide nada más al cliente.</small>
        </span>
      </label>

      {envio.activo === true && (
        <>
          <div className="field">
            <label htmlFor={`${uid}-minimo`}>Pedido mínimo ({currency})</label>
            <input id={`${uid}-minimo`} type="number" min="0" placeholder="0" value={envio.pedidoMinimo ?? ''} onChange={(e) => cambiar('pedidoMinimo', e.target.value)} />
            <div className="hint">Déjalo en 0 si no quieres exigir un mínimo.</div>
          </div>

          <label className="switch-row" htmlFor={`${uid}-retiro`}>
            <input id={`${uid}-retiro`} type="checkbox" checked={envio.retiroEnTienda === true} onChange={(e) => cambiar('retiroEnTienda', e.target.checked)} />
            <span><strong>Permitir retiro en tienda</strong><small>El cliente pasa a buscarlo y no paga envío.</small></span>
          </label>

          {envio.retiroEnTienda === true && (
            <div className="field">
              <label htmlFor={`${uid}-direccion`}>Dirección de la tienda</label>
              <input id={`${uid}-direccion`} type="text" value={envio.direccionTienda || ''} onChange={(e) => cambiar('direccionTienda', e.target.value)} placeholder="Calle, número, sector" />
              <div className="hint">Se le muestra al cliente cuando elige retirar.</div>
            </div>
          )}

          <div className="zonas-editor">
            <div className="form-section-title"><span className="section-icon">◎</span><div><h3>Zonas de envío</h3><p>El precio de la zona que elija el cliente se suma al total del pedido.</p></div></div>
            {zonas.length === 0 ? (
              <div className="empty-state" style={{ padding: 16 }}><p>Sin zonas todavía. Agrega al menos una para poder cobrar envío.</p></div>
            ) : (
              <div className="zona-rows">
                {zonas.map((z, index) => (
                  <div className="zona-row" key={z.id}>
                    <label htmlFor={`${uid}-${index}-nombre`}>Zona<input id={`${uid}-${index}-nombre`} type="text" value={z.nombre} onChange={(e) => cambiarZona(index, 'nombre', e.target.value)} placeholder="Ej. Santo Domingo" /></label>
                    <label htmlFor={`${uid}-${index}-precio`}>Precio ({currency})<input id={`${uid}-${index}-precio`} type="number" min="0" value={z.precio} onChange={(e) => cambiarZona(index, 'precio', e.target.value)} placeholder="0" /></label>
                    <button type="button" className="icon-btn danger-icon" aria-label={`Eliminar la zona ${z.nombre || index + 1}`} title="Eliminar zona" onClick={() => quitarZona(index)}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="btn-secondary" onClick={agregarZona}>+ Agregar zona</button>
          </div>
        </>
      )}
    </div>
  );
}
