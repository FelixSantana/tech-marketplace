import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { IconoDocumento, IconoDescargar, IconoVisto, IconoRefrescar } from '../Iconos';
import {
  ESTADOS, estadoVisible, nuevaLinea, cuentasDeCotizacion, cuentasDeLinea,
  numeroDeCotizacion, cotizacionNueva, hoyISO,
  MAX_LINEAS, MAX_NOTA, MAX_ITBIS, MONEDAS,
} from '../../lib/cotizacion';
import { pdfDeCotizacion, descargarArchivo, abrirEnPestana } from '../../lib/cotizacionPdf';

const RUTA = '/api/orders?recurso=cotizaciones';
const money = (n, moneda = 'RD$') => `${moneda} ${Number(n || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fechaCorta = (iso) => { const [a, m, d] = String(iso || '').split('-'); return a ? `${d}/${m}/${a}` : ''; };

// Los renglones del papel. A diferencia de los de una orden, la descripcion SE ESCRIBE: media
// cotizacion de un revendedor son cosas que no estan publicadas —un servicio, un plan mensual,
// un equipo que todavia hay que ir a comprar—. El desplegable del catalogo es un atajo para
// rellenar un renglon, no la unica forma de tener uno.
function Renglones({ lineas, catalogo, moneda, tasaItbis, itbisIncluido, onChange, showToast }) {
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
      detalle: p.warranty ? `Garantía: ${p.warranty}` : '',
      cantidad: 1,
      itbis: tasaItbis > 0,
      // El precio se COPIA. Si mañana sube, esta cotizacion sigue diciendo lo que se prometio.
      precio: Number(variante ? variante.price : p.price) || 0,
      productId: p.id,
      ...(variante ? { variantId: variante.id } : {}),
    });
  };
  const cambiar = (indice, campo, valor) => onChange(lineas.map((l, i) => {
    if (i !== indice) return l;
    if (campo === 'descripcion') return { ...l, descripcion: valor };
    if (campo === 'detalle') return { ...l, detalle: valor };
    if (campo === 'itbis') return { ...l, itbis: valor };
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
        <button type="button" className="btn-secondary" onClick={() => agregar(nuevaLinea({ itbis: tasaItbis > 0 }))}>+ Renglón en blanco</button>
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
              <input id={`${uid}-${i}-total`} value={money(cuentasDeLinea(linea, tasaItbis, itbisIncluido).valor, moneda)} readOnly />
            </label>
            <button type="button" className="icon-btn danger-icon" title="Quitar renglón" aria-label={`Quitar el renglón ${i + 1}`} onClick={() => onChange(lineas.filter((_, j) => j !== i))}>✕</button>
            {/* La linea pequeña que va debajo del concepto en el papel: "Plazo: 1 año",
                "Garantía 6 meses". Es la condicion que convierte un precio suelto en algo que
                el cliente entiende, y por eso tiene sitio propio y no se mete en el nombre. */}
            <label className="linea-detalle" htmlFor={`${uid}-${i}-detalle`}>Detalle (sale en letra pequeña debajo)
              <input id={`${uid}-${i}-detalle`} value={linea.detalle || ''} placeholder="Plazo: 1 año (12 meses), garantía, qué incluye…" onChange={(e) => cambiar(i, 'detalle', e.target.value)} />
            </label>
            {tasaItbis > 0 && (
              <label className="linea-itbis" htmlFor={`${uid}-${i}-itbis`}>
                <input id={`${uid}-${i}-itbis`} type="checkbox" checked={Boolean(linea.itbis)} onChange={(e) => cambiar(i, 'itbis', e.target.checked)} />
                <span>Cobra ITBIS</span>
              </label>
            )}
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
  const uid = useId();
  const monedaTienda = (settings && settings.currency) || 'RD$';
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
    return `${numeroDeCotizacion(c)} ${c.cliente || ''} ${(c.lineas || []).map((l) => l.descripcion).join(' ')}`.toLowerCase().includes(q);
  });
  const aceptadas = lista.filter((c) => c.estado === 'aceptada');
  const esperando = lista.filter((c) => estadoVisible(c, hoy).valor === 'enviada').length;

  const nueva = () => { setEditando('nueva'); setForm(cotizacionNueva(settings)); };
  const editar = (c) => {
    setEditando(c.id);
    setForm({
      fecha: c.fecha || hoy, cliente: c.cliente || '', clienteDireccion: c.clienteDireccion || '',
      clienteTelefono: c.clienteTelefono || '', vendedor: c.vendedor || '',
      validezDias: c.validezDias || 30, condicionPago: c.condicionPago || '',
      itbisPorciento: Number(c.itbisPorciento) || 0, itbisIncluido: c.itbisIncluido !== false, moneda: c.moneda || '',
      nota: c.nota || '', estado: c.estado || 'borrador',
      lineas: (c.lineas || []).map((l) => ({ ...l })),
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
      showToast(editando === 'nueva' ? `Cotización ${numeroDeCotizacion(data.cotizacion)} creada` : 'Cotización actualizada');
      await cargar();
      return data.cotizacion;
    } catch (e) { showToast(e.message); return null; } finally { setOcupado(false); }
  };

  // Ver el papel antes de mandarlo. Se abre en una pestaña aparte, con el visor de PDF del
  // propio navegador: desde ahi se lee a tamaño real, se imprime y se descarga con los botones
  // que esa persona ya conoce.
  //
  // La pestaña se abre EN EL CLIC y vacia, y se rellena cuando el PDF esta listo. Abrirla
  // despues de generarlo la convierte en una ventana emergente y el navegador la bloquea.
  const ver = async (cotizacion) => {
    const pestana = window.open('', '_blank');
    setOcupado(true);
    try {
      const { abierta } = await abrirEnPestana(pestana, cotizacion, settings);
      if (!abierta) showToast('Tu navegador bloqueó la pestaña, así que la descargué.');
    } catch (e) {
      console.error('pdf de cotizacion', e);
      if (pestana && !pestana.closed) pestana.close();
      showToast('No se pudo generar el PDF.');
    } finally { setOcupado(false); }
  };

  const descargar = async (cotizacion) => {
    setOcupado(true);
    try {
      const { blob, nombre } = await pdfDeCotizacion(cotizacion, settings);
      descargarArchivo(blob, nombre);
      showToast('PDF descargado');
    } catch (e) {
      console.error('pdf de cotizacion', e);
      showToast('No se pudo generar el PDF.');
    } finally { setOcupado(false); }
  };

  // Guardar primero: lo que se abre es la cotizacion ya numerada por el servidor, no el
  // borrador que hay en pantalla.
  const guardarYVer = async () => { const c = await guardar(); if (c) { cerrar(); await ver(c); } };
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
    if (!confirm(`¿Eliminar la cotización ${numeroDeCotizacion(c)}?`)) return;
    try {
      const r = await fetch(RUTA, { method: 'DELETE', headers, body: JSON.stringify({ id: c.id }) });
      if (!r.ok) throw new Error('No se pudo eliminar la cotización.');
      showToast('Cotización eliminada');
      await cargar();
    } catch (e) { showToast(e.message); }
  };

  if (editando && form) {
    const cuentas = cuentasDeCotizacion(form);
    const monedaForm = form.moneda || monedaTienda;
    return (
      <div>
        <div className="panel-head">
          <div>
            <span className="section-kicker">COTIZACIONES</span>
            <h2>{editando === 'nueva' ? 'Nueva cotización' : `Cotización ${numeroDeCotizacion(lista.find((c) => c.id === editando) || form)}`}</h2>
          </div>
          <button className="icon-btn" aria-label="Cerrar" onClick={cerrar}>✕</button>
        </div>
        <div className="form-grid">
          <label htmlFor={`${uid}-cliente`}>Cliente<input id={`${uid}-cliente`} value={form.cliente} placeholder="Nombre o razón social" onChange={(e) => setForm({ ...form, cliente: e.target.value })} /></label>
          <label htmlFor={`${uid}-cdir`}>Dirección o país del cliente<input id={`${uid}-cdir`} value={form.clienteDireccion} placeholder="República Dominicana" onChange={(e) => setForm({ ...form, clienteDireccion: e.target.value })} /></label>
          <label htmlFor={`${uid}-tel`}>Teléfono del cliente<input id={`${uid}-tel`} value={form.clienteTelefono} inputMode="tel" placeholder="Opcional" onChange={(e) => setForm({ ...form, clienteTelefono: e.target.value })} /></label>
          <label htmlFor={`${uid}-vendedor`}>Vendedor<input id={`${uid}-vendedor`} value={form.vendedor} placeholder="Quién firma" onChange={(e) => setForm({ ...form, vendedor: e.target.value })} /></label>
          <label htmlFor={`${uid}-fecha`}>Fecha<input id={`${uid}-fecha`} type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></label>
          <label htmlFor={`${uid}-validez`}>Válida por (días)<input id={`${uid}-validez`} type="number" min="1" max="365" value={form.validezDias} onChange={(e) => setForm({ ...form, validezDias: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} /></label>
          <label htmlFor={`${uid}-estado`}>Estado<select id={`${uid}-estado`} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>{ESTADOS.map((e2) => <option key={e2.valor} value={e2.valor}>{e2.nombre}</option>)}</select></label>
          <label htmlFor={`${uid}-pago`}>Condición de pago<input id={`${uid}-pago`} value={form.condicionPago} placeholder="100% contra entrega" onChange={(e) => setForm({ ...form, condicionPago: e.target.value })} /></label>
          {/* La moneda de esta cotizacion manda sobre la de la tienda: se cotizan equipos
              importados en dolares aunque la tienda venda en pesos. */}
          <label htmlFor={`${uid}-moneda`}>Moneda<select id={`${uid}-moneda`} value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}><option value="">La de la tienda ({monedaTienda})</option>{MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
          <label htmlFor={`${uid}-itbis`}>ITBIS (%)<input id={`${uid}-itbis`} type="number" min="0" max={MAX_ITBIS} value={form.itbisPorciento} onChange={(e) => setForm({ ...form, itbisPorciento: Math.min(MAX_ITBIS, Math.max(0, Math.floor(Number(e.target.value) || 0))) })} /></label>
          {/* Con los precios del catalogo, que ya son los finales, el impuesto se saca de
              dentro. Apagarlo lo suma por encima y sube el total. */}
          {form.itbisPorciento > 0 && (
            <label className="campo-casilla" htmlFor={`${uid}-itbisinc`}>
              <input id={`${uid}-itbisinc`} type="checkbox" checked={form.itbisIncluido !== false} onChange={(e) => setForm({ ...form, itbisIncluido: e.target.checked })} />
              <span>Los precios ya incluyen el ITBIS</span>
            </label>
          )}
          <label htmlFor={`${uid}-nota`}>Condiciones<textarea id={`${uid}-nota`} rows={3} maxLength={MAX_NOTA} value={form.nota} placeholder="Lo que va impreso debajo del total: formas de pago, plazos, qué incluye." onChange={(e) => setForm({ ...form, nota: e.target.value })} /></label>
        </div>
        <h3 className="subsection-title">Renglones</h3>
        <Renglones lineas={form.lineas} catalogo={catalogo} moneda={monedaForm} tasaItbis={cuentas.tasa} itbisIncluido={cuentas.incluido} showToast={showToast} onChange={(lineas) => setForm({ ...form, lineas })} />
        <div className="cotizacion-cuentas">
          <div><span>Subtotal</span><strong className="mono">{money(cuentas.subtotal, monedaForm)}</strong></div>
          {cuentas.tasa > 0 && <div><span>ITBIS {cuentas.tasa}%{cuentas.incluido ? ' (incluido en los precios)' : ''}</span><strong className="mono">{money(cuentas.itbis, monedaForm)}</strong></div>}
          <div className="cotizacion-cuentas-total"><span>Total</span><strong className="mono">{money(cuentas.total, monedaForm)}</strong></div>
        </div>
        <div className="form-actions">
          <button className="btn-secondary" onClick={cerrar}>Cancelar</button>
          <button className="btn-secondary" disabled={ocupado} onClick={guardarYCerrar}>Guardar</button>
          <button className="btn-primary" disabled={ocupado} onClick={guardarYVer}><IconoVisto size={14} /> Guardar y ver PDF</button>
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
        <div className="stat-card"><span>Monto aceptado</span><strong>{money(aceptadas.reduce((s, c) => s + Number(c.total || 0), 0), monedaTienda)}</strong></div>
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
                  <td className="mono order-id">{numeroDeCotizacion(c)}</td>
                  <td><strong>{c.cliente}</strong>{c.clienteTelefono && <small>{c.clienteTelefono}</small>}</td>
                  <td className="order-products-cell">{(c.lineas || []).map((l) => `${l.descripcion} ×${l.cantidad}`).join(', ')}</td>
                  <td className="mono"><strong>{money(c.total, c.moneda || monedaTienda)}</strong></td>
                  <td>
                    {/* "Vencida" no se puede elegir: no es una decision, es que pasaron los dias.
                        Se enseña al lado del estado guardado para que se vea sin tener que
                        restar fechas de cabeza. */}
                    <select className={`status-select status-cot-${c.estado}`} aria-label={`Estado de la cotización ${numeroDeCotizacion(c)}`} value={c.estado} onChange={(e) => cambiarEstado(c, e.target.value)}>
                      {ESTADOS.map((e2) => <option key={e2.valor} value={e2.valor}>{e2.nombre}</option>)}
                    </select>
                    {estado.valor === 'vencida' && <small className="cot-vencida">Vencida</small>}
                  </td>
                  <td className="order-date">{fechaCorta(c.fecha)}</td>
                  <td className="order-actions">
                    <button className="btn-secondary" disabled={ocupado} title="Abrir el PDF en otra pestaña" onClick={() => ver(c)}><IconoVisto size={14} /> Ver</button>
                    <button className="btn-secondary" disabled={ocupado} title="Descargar el PDF" onClick={() => descargar(c)}><IconoDescargar size={14} /> Descargar</button>
                    <button className="btn-secondary" onClick={() => editar(c)}>Editar</button>
                    <button className="icon-btn danger-icon" title="Eliminar" aria-label={`Eliminar la cotización ${numeroDeCotizacion(c)}`} onClick={() => eliminar(c)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" /></svg>
                    </button>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
