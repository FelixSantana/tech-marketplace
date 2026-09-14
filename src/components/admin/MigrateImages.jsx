import { useState } from 'react';
import { uploadImage, esIncrustada } from '../../lib/uploadImage';
import { getProductImages } from '../../hooks/useCatalog';

// Mueve al bucket las fotos que hoy viven incrustadas dentro del JSON del catalogo.
// Corre con la sesion de admin abierta y guarda por el mismo camino que el resto del panel.
export default function MigrateImages({ products, settings, saveCatalog, adminToken, showToast }) {
  const [estado, setEstado] = useState(null); // null | {hechas, total, fallidas}
  const [corriendo, setCorriendo] = useState(false);

  const pendientes = products.reduce((s, p) => s + getProductImages(p).filter(esIncrustada).length, 0)
    + (esIncrustada(settings.logo) ? 1 : 0);

  const migrar = async () => {
    if (!pendientes || corriendo) return;
    setCorriendo(true);
    setEstado({ hechas: 0, total: pendientes, fallidas: 0 });
    let hechas = 0;
    let fallidas = 0;

    // Se anota que foto incrustada paso a que URL, y al final se aplica sobre el catalogo fresco.
    // Asi, mover fotos no pisa el stock que se haya descontado mientras subian.
    const reemplazos = new Map();
    for (const src of products.flatMap(getProductImages)) {
      if (!esIncrustada(src) || reemplazos.has(src)) continue;
      const subida = await uploadImage(src, adminToken);
      // incrustada true = el bucket no respondio; se deja la foto como estaba.
      if (subida.error || subida.incrustada) fallidas += 1;
      else { hechas += 1; reemplazos.set(src, subida.url); }
      setEstado({ hechas, total: pendientes, fallidas });
    }
    if (esIncrustada(settings.logo)) {
      const subida = await uploadImage(settings.logo, adminToken, 'logo');
      if (subida.error || subida.incrustada) fallidas += 1;
      else { hechas += 1; reemplazos.set(settings.logo, subida.url); }
      setEstado({ hechas, total: pendientes, fallidas });
    }

    if (hechas === 0) {
      setCorriendo(false);
      showToast('No se movió ninguna foto. Revisa que el almacén de imágenes esté configurado.');
      return;
    }

    // Un solo guardado al final: si falla, el catalogo queda intacto y se puede reintentar.
    const ok = await saveCatalog(adminToken, (fresco) => ({
      products: fresco.products.map((p) => ({ ...p, images: getProductImages(p).map((src) => reemplazos.get(src) || src) })),
      settings: { ...fresco.settings, logo: reemplazos.get(fresco.settings.logo) || fresco.settings.logo },
    }));
    if (ok) {
      showToast(fallidas ? `Se movieron ${hechas} fotos. ${fallidas} quedaron dentro del catálogo.` : `Listo: ${hechas} fotos movidas al almacén.`);
    } else {
      showToast('Las fotos se subieron pero no se pudo guardar el catálogo. Vuelve a intentarlo.');
    }
    setCorriendo(false);
  };

  if (!pendientes && !estado) {
    return (
      <div className="migrate-box hecho">
        <div><strong>Fotos del catálogo</strong><span>Todas las fotos ya viven fuera del catálogo. Nada que migrar.</span></div>
      </div>
    );
  }

  return (
    <div className="migrate-box">
      <div>
        <strong>Mover fotos al almacén</strong>
        <span>
          {pendientes
            ? `${pendientes} foto${pendientes === 1 ? '' : 's'} viaja${pendientes === 1 ? '' : 'n'} hoy dentro del catálogo, lo que hace más lenta cada visita a la tienda.`
            : 'Todas las fotos ya están fuera del catálogo.'}
        </span>
        {estado && <span className="migrate-progress">Progreso: {estado.hechas} de {estado.total}{estado.fallidas ? ` · ${estado.fallidas} sin mover` : ''}</span>}
      </div>
      <button className="btn-secondary" onClick={migrar} disabled={corriendo || !pendientes}>
        {corriendo ? 'Moviendo…' : 'Mover fotos'}
      </button>
    </div>
  );
}
