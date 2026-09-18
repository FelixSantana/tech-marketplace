import { useCallback, useEffect, useState } from 'react';

// Historial del catalogo. El catalogo vive en una sola clave: antes, un guardado malo —borrar un
// producto, dejar precios en cero— no tenia vuelta atras. El servidor copia cada guardado; aqui
// se eligen y se restauran.
const fecha = (ts) => new Date(ts).toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function BackupsPanel({ adminToken, refreshCatalog, showToast }) {
  const [respaldos, setRespaldos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [restaurando, setRestaurando] = useState(0);

  // No toca el estado antes del await, igual que MetricsPanel, para no encadenar renders.
  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/catalog?respaldos=1', { headers: { Authorization: `Bearer ${adminToken}` } });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || data.error || 'No se pudo cargar el historial.');
      setError(''); setRespaldos(Array.isArray(data.respaldos) ? data.respaldos : []);
    } catch (e) { setError(e.message); }
    finally { setCargando(false); }
  }, [adminToken]);

  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);

  const restaurar = async (r) => {
    if (!confirm(`¿Volver al catálogo del ${fecha(r.ts)}?\n\nSe reemplazan precios, stock, productos y ajustes por los de esa copia. El catálogo de ahora se guarda antes, así que esto también se puede deshacer.`)) return;
    setRestaurando(r.ts);
    try {
      const resp = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ accion: 'restaurar', ts: r.ts }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.message || data.error || 'No se pudo restaurar.');
      await refreshCatalog();
      await cargar();
      showToast('Catálogo restaurado');
    } catch (e) { showToast(e.message); }
    finally { setRestaurando(0); }
  };

  return (
    <div className="backups-panel">
      <div className="form-section-title" style={{ marginTop: 18 }}>
        <span className="section-icon">↺</span>
        <div><h3>Historial del catálogo</h3><p>Una copia por cada guardado. Se conservan los últimos cinco y uno por día.</p></div>
      </div>

      {cargando && <div className="empty-state" style={{ padding: 16 }}><p>Cargando el historial…</p></div>}
      {!cargando && error && (
        <div className="empty-state" style={{ padding: 16 }}><p>{error}</p><button type="button" className="btn-secondary" onClick={() => { setCargando(true); cargar(); }}>Reintentar</button></div>
      )}
      {!cargando && !error && !respaldos.length && (
        <div className="empty-state" style={{ padding: 16 }}><p>Todavía no hay copias. Se crea una con el próximo guardado.</p></div>
      )}
      {!cargando && !error && respaldos.length > 0 && (
        <>
          <div className="backup-rows">
            {respaldos.map((r, i) => (
              <div className="backup-row" key={r.ts}>
                <div>
                  <strong>{fecha(r.ts)}{i === 0 ? ' · versión actual' : ''}</strong>
                  <span>{r.productos} producto{r.productos === 1 ? '' : 's'} · {r.unidades} unidad{r.unidades === 1 ? '' : 'es'} en stock</span>
                </div>
                <button type="button" className="btn-secondary" disabled={restaurando === r.ts} onClick={() => restaurar(r)}>
                  {restaurando === r.ts ? 'Restaurando…' : 'Restaurar'}
                </button>
              </div>
            ))}
          </div>
          {/* Se dice aqui y no solo en el codigo: el dueño tiene que saber que las fotos no van en la copia. */}
          <div className="hint" style={{ marginTop: 8 }}>
            Las copias guardan precios, stock, textos y ajustes. Las fotos no se duplican —pesan casi todo el catálogo—, así que al restaurar se conservan las fotos que los productos tienen ahora.
          </div>
        </>
      )}
    </div>
  );
}
