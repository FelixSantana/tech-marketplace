import { useCallback, useEffect, useState } from 'react';

const PERIODOS = [7, 30, 90];

// Embudo de venta con contadores propios. Sin servicios de terceros: los numeros salen de la
// misma base de la tienda.
export default function MetricsPanel({ adminToken, showToast }) {
  const [dias, setDias] = useState(30);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const r = await fetch(`/api/evento?dias=${dias}`, { headers: { Authorization: `Bearer ${adminToken}` } });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || data.error || 'No se pudieron cargar las métricas.');
      setDatos(data);
    } catch (e) { setError(e.message); showToast(e.message); }
    finally { setCargando(false); }
  }, [dias, adminToken, showToast]);

  useEffect(() => { cargar(); }, [cargar]);

  // Cada paso se compara contra las visitas, no contra el paso anterior: un visitante abre
  // varios productos, y desde la tarjeta se puede llegar al checkout sin abrir el detalle.
  const relativo = (valor, base) => (base > 0 ? Math.round((valor / base) * 1000) / 10 : 0);
  const t = datos ? datos.totales : null;
  const pasos = datos ? [
    { nombre: 'Visitas a la tienda', valor: t.visita, nota: null },
    { nombre: 'Abrieron un producto', valor: t.producto, nota: t.visita ? `×${(t.producto / t.visita).toFixed(1)} por visita` : null },
    { nombre: 'Llegaron al checkout', valor: t.checkout, nota: `${relativo(t.checkout, t.visita)}% de las visitas` },
    { nombre: 'Pedidos registrados', valor: t.pedido, nota: `${relativo(t.pedido, t.visita)}% de las visitas` },
    { nombre: 'Enviados por WhatsApp', valor: t.whatsapp, nota: `${relativo(t.whatsapp, t.pedido)}% de los pedidos` },
  ] : [];
  const tope = Math.max(1, ...pasos.map((p) => p.valor));
  const maxSerie = datos ? Math.max(1, ...datos.serie.map((d) => d.visita)) : 1;

  return (
    <div className="metrics-panel">
      <div className="panel-head">
        <div><span className="section-kicker">MÉTRICAS</span><h2>Embudo de venta</h2><p className="admin-subtitle">De dónde salen tus pedidos y dónde se pierden las visitas.</p></div>
        <div className="metrics-periodos" role="group" aria-label="Periodo">
          {PERIODOS.map((d) => (
            <button key={d} type="button" className={`metrics-periodo ${dias === d ? 'active' : ''}`} aria-pressed={dias === d} onClick={() => setDias(d)}>{d} días</button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="orders-error"><div className="error-icon">!</div><h3>Métricas no disponibles</h3><p>{error}</p><button className="btn-secondary" onClick={cargar}>Reintentar</button></div>
      ) : cargando ? (
        <div className="empty-state" style={{ padding: 30 }}><p>Cargando métricas…</p></div>
      ) : datos.totales.visita === 0 && datos.totales.pedido === 0 ? (
        <div className="empty-state" style={{ padding: 30 }}><div className="glyph">📈</div><h3>Todavía no hay datos</h3><p>Los contadores empiezan desde que se publicó esta versión. Vuelve en unos días.</p></div>
      ) : (
        <>
          <div className="funnel">
            {pasos.map((p) => (
              <div className="funnel-paso" key={p.nombre}>
                <div className="funnel-texto">
                  <span>{p.nombre}</span>
                  <strong className="mono">{p.valor.toLocaleString('es-DO')}{p.nota && <small> · {p.nota}</small>}</strong>
                </div>
                <div className="funnel-barra"><div style={{ width: `${Math.max(2, (p.valor / tope) * 100)}%` }} /></div>
              </div>
            ))}
          </div>

          <div className="metrics-resumen">
            <div className="stat-card"><span>De visita a pedido</span><strong>{datos.conversion.visitaAPedido}%</strong></div>
            <div className="stat-card"><span>Pedidos en {dias} días</span><strong>{datos.totales.pedido}</strong></div>
            <div className="stat-card"><span>Se quedaron sin enviar</span><strong>{Math.max(0, datos.totales.pedido - datos.totales.whatsapp)}</strong></div>
          </div>

          {datos.serie.length > 1 && (
            <>
              <h3 className="subsection-title">Visitas por día</h3>
              <div className="metrics-serie">
                {datos.serie.map((d) => (
                  <div className="serie-col" key={d.fecha} title={`${d.fecha}: ${d.visita} visitas, ${d.pedido} pedidos`}>
                    <div className="serie-barra" style={{ height: `${Math.max(3, (d.visita / maxSerie) * 100)}%` }} />
                    {d.pedido > 0 && <span className="serie-pedido">{d.pedido}</span>}
                  </div>
                ))}
              </div>
              <p className="hint">El número sobre la barra son los pedidos de ese día.</p>
            </>
          )}

          <h3 className="subsection-title">Productos más mirados</h3>
          {datos.productos.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}><p>Nadie ha abierto un producto todavía.</p></div>
          ) : (
            <div className="vistas-lista">
              {datos.productos.slice(0, 10).map((p) => (
                <div className="vistas-row" key={p.id}>
                  <span>{p.nombre}</span>
                  <div className="vistas-barra"><div style={{ width: `${Math.max(3, (p.vistas / datos.productos[0].vistas) * 100)}%` }} /></div>
                  <strong className="mono">{p.vistas}</strong>
                </div>
              ))}
            </div>
          )}
          <p className="hint">Las vistas por producto son acumuladas, no del periodo elegido.</p>
        </>
      )}
    </div>
  );
}
