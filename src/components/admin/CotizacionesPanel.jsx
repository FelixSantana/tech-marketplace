import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { IconoDocumento, IconoDescargar, IconoRefrescar } from '../Iconos';
import {
  ESTADOS, estadoVisible, nuevaLinea, totalDeLinea, totalDeCotizacion,
  numeroVisible, cotizacionNueva, hoyISO, MAX_LINEAS, MAX_NOTA,
} from '../../lib/cotizacion';
import CotizacionPreview from './CotizacionPreview';

const RUTA = '/api/orders?recurso=cotizaciones';
const money = (n, moneda = 'RD$') => `${moneda} ${Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaCorta = (iso) => { const [a, m, d] = String(iso || '').split('-'); return a ? `${d}/${m}/${a}` : ''; };

// Los renglones del papel. A diferencia de los de una orden, la descripcion SE ESCRIBE: media
// cotizacion de un revendedor son cosas que no estan publicadas —un servicio, un plan mensual,
// un equipo que todavia hay que ir a comprar—. El desplegable del catalogo es un atajo para
// rellenar un renglon, no la unica forma de tener uno.
function Renglones({ lineas, catalogo, moneda, onChange, showToast }) {
  const uid = useId();
  const agregar = (linea) => {
    if (lineas.length >= MAX_LINEAS) return showToast(`Una cotización admite hasta ${MAX_LINEAS} renglones.`);
    onChange([...lineas, linea]);
  };
  const delCatalogo = (valor) => {
    if (!valor) return;
    const [id, varianteId] = String(valor).split('::');
    const p = catalogo.find((item) => item.id === id);
    if (!p) return;
    const variante = varianteId ? (p.variants || []).find((v) => v.id === varianteId) : null;
    if (varianteId && !variante) return;
    agregar({
      descripcion: variante ? `${p.name} · ${variante.label}` : p.name,
      cantidad: 1,
      // El precio se COPIA. Si mañana sube, esta cotizacion sigue diciendo lo que se prometio.
      precio: Number(variante ? variante.price : p.price) || 0,
      productId: p.id,
      ...(variante ? { variantId: variante.id } : {}),
    });
  };
  const cambiar = (indice, campo, valor) => onChange(lineas.map((l, i) => {
    if (i !== indice) return l;
    if (campo === 'descripcion') return { ...l, descripcion: valor };
    if (campo === 'cantidad') return { ...l, cantidad: Math.max(1, Math.floor(Number(valor) || 1)) };
    return { ...l, precio: Math.max(0, Number(valor) || 0) };
  }));

  return (
    <div>
      <div className="order-product-picker cotizacion-picker">
        <label htmlFor={`${uid}-cat`}>Traer del catálogo
          <select id={`${uid}-cat`} defaultValue="" onChange={(e) => { delCatalogo(e.target.value); e.target.value = ''; }}>
            <option value="">Seleccionar producto…</option>
            {catalogo.flatMap((p) => (Array.isArray(p.variants) && p.variants.length
              ? p.variants.map((v) => <option key={`${p.id}::${v.id}`} value={`${p.id}::${v.id}`}>{p.name} · {v.label} — {money(v.price, moneda)}</option>)
              : [<option key={p.id} value={`${p.id}::`}>{p.name} — {money(p.price, moneda)}</option>]))}
          </select>
        </label>
        <button type="button" className="btn-secondary" onClick={() => agregar(nuevaLinea())}>+ Renglón en blanco</button>
      </div>
      {lineas.length === 0
        ? <div className="empty-state" style={{ padding: 20 }}><p>Esta cotización no tiene renglones todavía.</p></div>
        : <div className="order-product-lines">{lineas.map((linea, i) => (
          <div className="order-product-line" key={`linea-${i}`}>
            <label htmlFor={`${uid}-${i}-desc`}>Descripción
              <input id={`${uid}-${i}-desc`} value={linea.descripcion} placeholder="Laptop, servicio, plan mensual…" onChange={(e) => cambiar(i, 'descripcion', e.target.value)} />
            </label>
            <label htmlFor={`${uid}-${i}-cant`}>Cantidad
              <input id={`${uid}-${i}-cant`} type="number" min="1" value={linea.cantidad} onChange={(e) => cambiar(i, 'cantidad', e.target.value)} />
            </label>
            <label htmlFor={`${uid}-${i}-precio`}>Precio
              <input id={`${uid}-${i}-precio`} type="number" min="0" step="0.01" value={linea.precio} onChange={(e) => cambiar(i, 'precio', e.target.value)} />
            </label>
            <label htmlFor={`${uid}-${i}-total`}>Total
              <input id={`${uid}-${i}-total`} value={money(totalDeLinea(linea), moneda)} readOnly />
            </label>
            <button type="button" className="icon-btn danger-icon" title="Quitar renglón" aria-label={`Quitar el renglón ${i + 1}`} onClick={() => onChange(lineas.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}</div>}
    </div>
  );
}

export default function CotizacionesPanel({ adminToken, products: catalogo, settings, showToast }) {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState(null);
  const uid = useId();
  const moneda = (settings && settings.currency) || 'RD$';
  const headers = useMemo(() => ({ Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }), [adminToken]);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(RUTA, { headers });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || data.error || 'No se pudieron cargar las cotizaciones.');
      setErrorCarga('');
      setLista(data.cotizaciones || []);
    } catch (e) { setErrorCarga(e.message); showToast(e.message); } finally { setCargando(false); }
  }, [headers, showToast]);

  // Cargar al montar es el caso que la propia regla exime (sincronizar con algo externo).
  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);

  const hoy = hoyISO();
  const visibles = lista.filter((c) => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return `${numeroVisible(c.numero)} ${c.cliente || ''} ${(c.lineas || []).map((l) => l.descripcion).join(' ')}`.toLowerCase().includes(q);
  });
  const aceptadas = lista.filter((c) => c.estado === 'aceptada');
  const esperando = lista.filter((c) => estadoVisible(c, hoy).valor === 'enviada').length;

  const nueva = () => { setEditando('nueva'); setForm(cotizacionNueva(settings)); };
  const editar = (c) => {
    setEditando(c.id);
    setForm({
      fecha: c.fecha || hoy, cliente: c.cliente || '', clienteTelefono: c.clienteTelefono || '',
      vendedor: c.vendedor || '', validezDias: c.validezDias || 30, nota: c.nota || '',
      estado: c.estado || 'borrador', lineas: (c.lineas || []).map((l) => ({ ...l })),
    });
  };
  const cerrar = () => { setEditando(null); setForm(null); };

  // Guardar devuelve la cotizacion ya numerada por el servidor, que es la que se imprime: el
  // numero no se adivina aqui para que dos papeles no puedan salir con el mismo.
  const guardar = async () => {
    if (!form.cliente.trim()) { showToast('Escribe a quién va dirigida la cotización.'); return null; }
    if (!form.lineas.some((l) => String(l.descripcion || '').trim())) { showToast('Agrega al menos un renglón con descripción.'); return null; }
    setOcupado(true);
    try {
      const metodo = editando === 'nueva' ? 'POST' : 'PUT';
      const cuerpo = editando === 'nueva' ? form : { ...form, id: editando };
      const r = await fetch(RUTA, { method: metodo, headers, body: JSON.stringify(cuerpo) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || data.error || 'No se pudo guardar la cotización.');
      showToast(editando === 'nueva' ? `Cotización #${numeroVisible(data.cotizacion.numero)} creada` : 'Cotización actualizada');
      await cargar();
      return data.cotizacion;
    } catch (e) { showToast(e.message); return null; } finally { setOcupado(false); }
  };

  // Nunca se descarga a ciegas: se abre la vista previa y desde ahi se entrega. Un presupuesto
  // llega al cliente y no se puede retirar, asi que el ultimo paso es mirarlo.
  const guardarYVer = async () => { const c = await guardar(); if (c) { cerrar(); setVistaPrevia(c); } };
  const guardarYCerrar = async () => { const c = await guardar(); if (c) cerrar(); };

  const cambiarEstado = async (c, estado) => {
    try {
      const r = await fetch(RUTA, { method: 'PUT', headers, body: JSON.stringify({ ...c, estado }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || 'No se pudo actualizar el estado.');
      await cargar();
    } catch (e) { showToast(e.message); }
  };

  const eliminar = async (c) => {
    if (!confirm(`¿Eliminar la cotización #${numeroVisible(c.numero)}?`)) return;
    try {
      const r = await fetch(RUTA, { method: 'DELETE', headers, body: JSON.stringify({ id: c.id }) });
      if (!r.ok) throw new Error('No se pudo eliminar la cotización.');
      showToast('Cotización eliminada');
      await cargar();
    } catch (e) { showToast(e.message); }
  };

  if (editando && form) {
    const total = totalDeCotizacion(form.lineas);
    return (
      <div>
        <div className="panel-head">
          <div>
            <span className="section-kicker">COTIZACIONES</span>
            <h2>{editando === 'nueva' ? 'Nueva cotización' : `Cotización #${numeroVisible((lista.find((c) => c.id === editando) || {}).numero)}`}</h2>
          </div>
          <button className="icon-btn" aria-label="Cerrar" onClick={cerrar}>✕</button>
        </div>
        <div className="form-grid">
          <label htmlFor={`${uid}-cliente`}>Cliente<input id={`${uid}-cliente`} value={form.cliente} placeholder="Nombre o razón social" onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></label>
          <label htmlFor={`${uid}-tel`}>Teléfono del cliente<input id={`${uid}-tel`} value={form.clienteTelefono} inputMode="tel" placeholder="Opcional" onChange={(e) => setForm({ ...form, clienteTelefono: e.target.value })} /></label>
          <label htmlFor={`${uid}-vendedor`}>Vendedor<input id={`${uid}-vendedor`} value={form.vendedor} placeholder="Quién firma" onChange={(e) => setForm({ ...form, vendedor: e.target.value })} /></label>
          <label htmlFor={`${uid}-fecha`}>Fecha<input id={`${uid}-fecha`} type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></label>
          <label htmlFor={`${uid}-validez`}>Válida por (días)<input id={`${uid}-validez`} type="number" min="1" max="365" value={form.validezDias} onChange={(e) => setForm({ ...form, validezDias: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} /></label>
          <label htmlFor={`${uid}-estado`}>Estado<select id={`${uid}-estado`} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>{ESTADOS.map((e2) => <option key={e2.valor} value={e2.valor}>{e2.nombre}</option>)}</select></label>
          <label htmlFor={`${uid}-nota`}>Condiciones<textarea id={`${uid}-nota`} rows={3} maxLength={MAX_NOTA} value={form.nota} placeholder="Lo que va impreso debajo del total: formas de pago, plazos, qué incluye." onChange={(e) => setForm({ ...form, nota: e.target.value })} /></label>
        </div>
        <h3 className="subsection-title">Renglones</h3>
        <Renglones lineas={form.lineas} catalogo={catalogo} moneda={moneda} showToast={showToast} onChange={(lineas) => setForm({ ...form, lineas })} />
        <div className="cart-total-row order-total"><span>Total</span><strong className="mono">{money(total, moneda)}</strong></div>
        <div className="form-actions">
          <button className="btn-secondary" onClick={cerrar}>Cancelar</button>
          <button className="btn-secondary" disabled={ocupado} onClick={guardarYCerrar}>Guardar</button>
          <button className="btn-primary" disabled={ocupado} onClick={guardarYVer}><IconoDescargar size={14} /> Guardar y ver PDF</button>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-panel">
      <div className="panel-head">
        <div>
          <span className="section-kicker">VENTAS</span>
          <h2>Cotizaciones</h2>
          <p className="admin-subtitle">Arma el presupuesto aquí y descárgalo en PDF para mandárselo al cliente.</p>
        </div>
        <button className="btn-primary" onClick={nueva}>+ Nueva cotización</button>
      </div>

      <div className="orders-stats">
        <div className="stat-card"><span>Cotizaciones</span><strong>{lista.length}</strong></div>
        <div className="stat-card"><span>Esperando respuesta</span><strong>{esperando}</strong></div>
        <div className="stat-card"><span>Aceptadas</span><strong>{aceptadas.length}</strong></div>
        <div className="stat-card"><span>Monto aceptado</span><strong>{money(aceptadas.reduce((s, c) => s + Number(c.total || 0), 0), moneda)}</strong></div>
      </div>

      <div className="orders-toolbar">
        <div className="orders-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar cotizaciones" placeholder="Buscar por número, cliente o renglón…" />
          <button type="button" className="search-clear" aria-label="Limpiar búsqueda" onClick={() => setBusqueda('')} style={{ visibility: busqueda ? 'visible' : 'hidden' }}>✕</button>
        </div>
        <button className="btn-secondary refresh-btn" onClick={() => { setCargando(true); cargar(); }}><IconoRefrescar size={14} /> Actualizar</button>
      </div>

      {errorCarga ? (
        <div className="orders-error"><div className="error-icon">!</div><h3>Cotizaciones no disponibles</h3><p>{errorCarga}</p><button className="btn-secondary" onClick={() => { setCargando(true); cargar(); }}>Reintentar</button></div>
      ) : cargando ? (
        <div className="empty-state" style={{ padding: 30 }}><p>Cargando cotizaciones…</p></div>
      ) : visibles.length === 0 ? (
        <div className="empty-state orders-empty">
          <div className="glyph"><IconoDocumento size={34} /></div>
          <h3>{busqueda ? 'No encontramos resultados' : 'Todavía no has cotizado nada'}</h3>
          <p>{busqueda ? 'Prueba con otro término de búsqueda.' : 'Crea una cotización y descárgala en PDF para mandársela al cliente.'}</p>
        </div>
      ) : (
        <div className="orders-table-wrap">
          <table className="orders-table">
            <thead><tr>{['Número', 'Cliente', 'Renglones', 'Total', 'Estado', 'Fecha', ''].map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{visibles.map((c) => {
              const estado = estadoVisible(c, hoy);
              return (
                <tr key={c.id}>
                  <td className="mono order-id">#{numeroVisible(c.numero)}</td>
                  <td><strong>{c.cliente}</strong>{c.clienteTelefono && <small>{c.clienteTelefono}</small>}</td>
                  <td className="order-products-cell">{(c.lineas || []).map((l) => `${l.descripcion} ×${l.cantidad}`).join(', ')}</td>
                  <td className="mono"><strong>{money(c.total, moneda)}</strong></td>
                  <td>
                    {/* "Vencida" no se puede elegir: no es una decision, es que pasaron los dias.
                        Se enseña al lado del estado guardado para que se vea sin tener que
                        restar fechas de cabeza. */}
                    <select className={`status-select status-cot-${c.estado}`} aria-label={`Estado de la cotización ${numeroVisible(c.numero)}`} value={c.estado} onChange={(e) => cambiarEstado(c, e.target.value)}>
                      {ESTADOS.map((e2) => <option key={e2.valor} value={e2.valor}>{e2.nombre}</option>)}
                    </select>
                    {estado.valor === 'vencida' && <small className="cot-vencida">Vencida</small>}
                  </td>
                  <td className="order-date">{fechaCorta(c.fecha)}</td>
                  <td className="order-actions">
                    <button className="btn-secondary" title="Ver el PDF antes de mandarlo" onClick={() => setVistaPrevia(c)}><IconoDescargar size={14} /> PDF</button>
                    <button className="btn-secondary" onClick={() => editar(c)}>Editar</button>
                    <button className="icon-btn danger-icon" title="Eliminar" aria-label={`Eliminar la cotización ${numeroVisible(c.numero)}`} onClick={() => eliminar(c)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
                    </button>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
      {vistaPrevia && <CotizacionPreview cotizacion={vistaPrevia} settings={settings} showToast={showToast} onClose={() => setVistaPrevia(null)} />}
    </div>
  );
}
