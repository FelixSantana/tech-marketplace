import { createPortal } from 'react-dom';
import { getPrimaryImage, getStockQty, hasVariants, getVariants, getMinPrice } from '../../hooks/useCatalog';

const variantStock = (v) => Math.max(0, Math.floor(Number(v?.stockQty) || 0));
const precio = (n, currency) => `${currency} ${Number(n || 0).toLocaleString('es-DO')}`;

// Documento imprimible. No genera PDF: prepara la pagina para que el navegador la exporte
// con su propio dialogo de impresion, asi el proyecto no gana ninguna dependencia.
//
// modo 'clientes'   → sin cantidades, sin agotados. Es el papel que se le pasa a un cliente.
// modo 'inventario' → con cantidades por producto y por variante, incluidos los agotados.
export default function PrintCatalog({ products, settings, modo, onClose }) {
  const esInventario = modo === 'inventario';

  const visibles = products
    .map((p) => {
      if (esInventario) return p;
      // Para clientes se ocultan las variantes agotadas, no solo los productos agotados.
      if (!hasVariants(p)) return getStockQty(p) > 0 ? p : null;
      const disponibles = getVariants(p).filter((v) => variantStock(v) > 0);
      return disponibles.length ? { ...p, variants: disponibles } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.category || '').localeCompare(b.category || '', 'es') || a.name.localeCompare(b.name, 'es'));

  const porCategoria = visibles.reduce((acc, p) => {
    const cat = p.category || 'Sin categoría';
    (acc[cat] = acc[cat] || []).push(p);
    return acc;
  }, {});

  const fecha = new Date().toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' });
  const totalUnidades = visibles.reduce((s, p) => s + getStockQty(p), 0);

  return createPortal(
    <div className="print-preview">
      <div className="print-toolbar">
        <div>
          <strong>{esInventario ? 'Hoja de inventario' : 'Catálogo para clientes'}</strong>
          <span>{visibles.length} productos{esInventario ? ` · ${totalUnidades} unidades` : ''}</span>
        </div>
        <div className="print-toolbar-actions">
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="btn-primary" onClick={() => window.print()}>Imprimir o guardar como PDF</button>
        </div>
      </div>

      <div className="print-doc">
        <header className="print-head">
          {settings.logo && <img className="print-logo" src={settings.logo} alt="" />}
          <div>
            <h1>{settings.storeName || 'Synaptic Tech'}</h1>
            {settings.tagline && <p>{settings.tagline}</p>}
          </div>
          <div className="print-meta">
            <div>{esInventario ? 'Hoja de inventario' : 'Catálogo de productos'}</div>
            <div>{fecha}</div>
            {settings.whatsapp && !esInventario && <div>WhatsApp: {settings.whatsapp}</div>}
          </div>
        </header>

        {visibles.length === 0 ? (
          <p className="print-empty">No hay productos que mostrar.</p>
        ) : (
          Object.entries(porCategoria).map(([categoria, lista]) => (
            <section className="print-category" key={categoria}>
              <h2>{categoria}</h2>
              <div className="print-grid">
                {lista.map((p) => {
                  const img = getPrimaryImage(p);
                  const stock = getStockQty(p);
                  const conVariantes = hasVariants(p);
                  return (
                    <article className={`print-item ${esInventario && stock <= 0 ? 'agotado' : ''}`} key={p.id}>
                      <div className="print-item-img">{img ? <img src={img} alt="" /> : <span>Sin foto</span>}</div>
                      <div className="print-item-body">
                        <h3>{p.name}</h3>
                        {p.description && <p className="print-desc">{p.description}</p>}
                        {p.warranty && <p className="print-warranty">Garantía: {p.warranty}</p>}
                        {conVariantes ? (
                          <table className="print-variants">
                            <thead><tr><th>{p.variantAxis || 'Opción'}</th><th>Precio</th>{esInventario && <th>Stock</th>}</tr></thead>
                            <tbody>
                              {getVariants(p).map((v) => (
                                <tr key={v.id} className={esInventario && variantStock(v) <= 0 ? 'agotada' : ''}>
                                  <td>{v.label}</td>
                                  <td className="mono">{precio(v.price, settings.currency)}</td>
                                  {esInventario && <td className="mono">{variantStock(v)}</td>}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="print-price mono">{precio(p.price, settings.currency)}</p>
                        )}
                        {esInventario && (
                          <p className="print-stock">{conVariantes ? `Total: ${stock} unidades` : stock <= 0 ? 'AGOTADO' : `Stock: ${stock}`}</p>
                        )}
                        {conVariantes && !esInventario && <p className="print-from">desde {precio(getMinPrice(p), settings.currency)}</p>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}

        <footer className="print-foot">
          {esInventario
            ? `Documento interno · ${settings.storeName || 'Synaptic Tech'} · ${fecha}`
            : `Pide por WhatsApp${settings.whatsapp ? ` al ${settings.whatsapp}` : ''} · Precios sujetos a cambio sin previo aviso · ${fecha}`}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
