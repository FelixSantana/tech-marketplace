// Historial del catalogo. El catalogo vive en una sola key de Redis: un guardado malo —borrar
// una categoria, dejar todos los precios en cero— no tenia vuelta atras. Esto guarda una copia
// de cada guardado para poder volver.
//
// Las fotos incrustadas (data:) NO se copian: pesan casi todo el catalogo y multiplicarlas por
// diez haria el historial impagable en Redis. En su lugar va una marca, y al restaurar se toman
// las fotos que el catalogo tiene ahora, emparejadas por producto y posicion. Las fotos que ya
// viven en Blob son URLs cortas y esas si se copian tal cual.
const MARCA_FOTO = '__foto_omitida__';
const NUEVOS_QUE_SE_GUARDAN = 5;   // los ultimos N guardados, pase lo que pase
const TOPE_RESPALDOS = 15;         // ... mas el primero de cada dia, hasta este tope

const incrustada = (s) => typeof s === 'string' && s.startsWith('data:');
const diaDe = (ts) => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' });

function sinFotos(catalog) {
  const settings = { ...((catalog && catalog.settings) || {}) };
  if (incrustada(settings.logo)) settings.logo = MARCA_FOTO;
  const products = ((catalog && catalog.products) || []).map((p) => ({
    ...p,
    images: Array.isArray(p.images) ? p.images.map((img) => (incrustada(img) ? MARCA_FOTO : img)) : p.images,
  }));
  return { ...catalog, settings, products };
}

// Al restaurar, las marcas se rellenan con lo que el catalogo tenga hoy para ese mismo producto
// en esa misma posicion. Si el producto ya no tiene esa foto, la linea se cae en vez de dejar
// una imagen rota.
function conFotosDe(respaldo, actual) {
  const porId = new Map(((actual && actual.products) || []).map((p) => [p.id, p]));
  const logoActual = (actual && actual.settings && actual.settings.logo) || '';
  const settings = { ...((respaldo && respaldo.settings) || {}) };
  if (settings.logo === MARCA_FOTO) settings.logo = logoActual;
  const products = ((respaldo && respaldo.products) || []).map((p) => {
    if (!Array.isArray(p.images)) return p;
    const hoy = (porId.get(p.id) || {}).images || [];
    const images = p.images.map((img, i) => (img === MARCA_FOTO ? hoy[i] : img)).filter(Boolean);
    const primaryImage = Math.min(Number(p.primaryImage) || 0, Math.max(0, images.length - 1));
    return { ...p, images, primaryImage };
  });
  return { ...respaldo, settings, products };
}

// Se conservan los ultimos cinco guardados y, ademas, el primero de cada dia. Asi un error que
// se descubre una semana despues todavia tiene a que volver, aunque hayan pasado veinte ediciones.
function podar(lista) {
  const primeroDelDia = new Set();
  return lista.filter((r, i) => {
    if (i < NUEVOS_QUE_SE_GUARDAN) { primeroDelDia.add(diaDe(r.ts)); return true; }
    const dia = diaDe(r.ts);
    if (primeroDelDia.has(dia)) return false;
    primeroDelDia.add(dia);
    return true;
  }).slice(0, TOPE_RESPALDOS);
}

function agregarRespaldo(lista, catalog, ahora = Date.now()) {
  const previos = Array.isArray(lista) ? lista : [];
  const data = sinFotos(catalog);
  // Guardar dos veces lo mismo solo gasta espacio: pasa al completar una orden, que sube la
  // version sin tocar nada mas que el stock... y eso si cambia, asi que se compara el contenido.
  const ultimo = previos[0];
  if (ultimo && JSON.stringify(ultimo.data) === JSON.stringify(data)) return previos;
  return podar([{ ts: ahora, version: Number(catalog && catalog.version) || 0, data }, ...previos]);
}

// Lo que ve el panel: fechas y tamaños, nunca el catalogo entero de diez copias.
function resumenDeRespaldos(lista) {
  return (Array.isArray(lista) ? lista : []).map((r) => ({
    ts: r.ts,
    version: r.version,
    productos: ((r.data && r.data.products) || []).length,
    unidades: ((r.data && r.data.products) || []).reduce((n, p) => n + (Number(p.stockQty) || 0), 0),
  }));
}

// Que fotos del almacen siguen haciendo falta aunque el catalogo de hoy ya no las use: las que
// alguna copia del historial todavia nombra. Sin esto, guardar y luego restaurar dejaria imagenes
// rotas, porque el panel manda a borrar del almacen las fotos que un guardado deja sin usar.
function urlsDeRespaldos(lista) {
  const urls = new Set();
  for (const r of Array.isArray(lista) ? lista : []) {
    const data = r && r.data;
    if (!data) continue;
    const logo = data.settings && data.settings.logo;
    if (typeof logo === 'string' && /^https?:\/\//.test(logo)) urls.add(logo);
    for (const p of data.products || []) {
      for (const img of p.images || []) if (typeof img === 'string' && /^https?:\/\//.test(img)) urls.add(img);
    }
  }
  return urls;
}

module.exports = { MARCA_FOTO, urlsDeRespaldos, sinFotos, conFotosDe, agregarRespaldo, resumenDeRespaldos, podar };
