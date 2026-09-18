import { useCallback, useEffect, useId, useState } from 'react';
import { normalizarCodigo } from '../../lib/cupones';

const nuevoId = () => `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const miles = (n) => Number(n || 0).toLocaleString('es-DO');

// Cupones de descuento. El descuento se aplica a los productos, nunca al envio.
export default function CouponsForm({ cupones, setCupones, currency, adminToken }) {
  const uid = useId();
  const lista = Array.isArray(cupones) ? cupones : [];
  // Cuanto se uso cada codigo. Lo cuenta el servidor sobre las ordenes guardadas: no hay contador
  // que mantener y un pedido cancelado no infla la cifra.
  const [usos, setUsos] = useState({});

  const cargarUsos = useCallback(async () => {
    try {
      const r = await fetch('/api/orders?cupones=1', { headers: { Authorization: `Bearer ${adminToken}` } });
      if (!r.ok) return;
      const data = await r.json();
      setUsos(data && data.cupones ? data.cupones : {});
    } catch { /* sin conteo se sigue pudiendo editar cupones */ }
  }, [adminToken]);

  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => { cargarUsos(); }, [cargarUsos]);

  const cambiar = (index, campo, valor) => setCupones(lista.map((c, i) => (i === index ? { ...c, [campo]: valor } : c)));
  const agregar = () => setCupones([...lista, { id: nuevoId(), codigo: '', tipo: 'porcentaje', valor: '', vence: '', minimo: '', activo: true }]);
  const quitar = (index) => setCupones(lista.filter((_, i) => i !== index));

  return (
    <div className="cupones-form">
      {lista.length === 0 ? (
        <div className="empty-state" style={{ padding: 16 }}><p>Sin cupones. Crea uno y compártelo por WhatsApp o en tus redes.</p></div>
      ) : (
        <div className="cupon-rows">
          {lista.map((c, index) => (
            <div className={`cupon-row ${c.activo === false ? 'apagado' : ''}`} key={c.id}>
              <label htmlFor={`${uid}-${index}-codigo`}>Código<input id={`${uid}-${index}-codigo`} type="text" value={c.codigo} onChange={(e) => cambiar(index, 'codigo', normalizarCodigo(e.target.value))} placeholder="BIENVENIDO" /></label>
              <label htmlFor={`${uid}-${index}-tipo`}>Descuento
                <select id={`${uid}-${index}-tipo`} value={c.tipo} onChange={(e) => cambiar(index, 'tipo', e.target.value)}>
                  <option value="porcentaje">Porcentaje</option>
                  <option value="monto">Monto fijo</option>
                </select>
              </label>
              <label htmlFor={`${uid}-${index}-valor`}>{c.tipo === 'monto' ? `Valor (${currency})` : 'Valor (%)'}<input id={`${uid}-${index}-valor`} type="number" min="0" value={c.valor} onChange={(e) => cambiar(index, 'valor', e.target.value)} placeholder="0" /></label>
              <label htmlFor={`${uid}-${index}-minimo`}>Pedido mínimo<input id={`${uid}-${index}-minimo`} type="number" min="0" value={c.minimo} onChange={(e) => cambiar(index, 'minimo', e.target.value)} placeholder="0" /></label>
              <label htmlFor={`${uid}-${index}-vence`}>Vence<input id={`${uid}-${index}-vence`} type="date" value={c.vence || ''} onChange={(e) => cambiar(index, 'vence', e.target.value)} /></label>
              <div className="cupon-acciones">
                <label className="cupon-activo" htmlFor={`${uid}-${index}-activo`}>
                  <input id={`${uid}-${index}-activo`} type="checkbox" checked={c.activo !== false} onChange={(e) => cambiar(index, 'activo', e.target.checked)} />
                  <span>Activo</span>
                </label>
                <button type="button" className="icon-btn danger-icon" aria-label={`Eliminar el cupón ${c.codigo || index + 1}`} title="Eliminar cupón" onClick={() => quitar(index)}>✕</button>
              </div>
              <div className="cupon-uso">{(() => {
                const u = usos[normalizarCodigo(c.codigo)];
                if (!u || !u.usos) return c.codigo ? 'Sin usar todavía' : '';
                const cancel = u.cancelados ? ` · ${u.cancelados} en pedidos cancelados` : '';
                return `Usado ${u.usos} ${u.usos === 1 ? 'vez' : 'veces'} · ${currency} ${miles(u.descontado)} descontados${cancel}`;
              })()}</div>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="btn-secondary" onClick={agregar}>+ Crear cupón</button>
      <div className="hint">Deja el vencimiento vacío para que no caduque, y el mínimo en 0 para que aplique a cualquier pedido.</div>
    </div>
  );
}
