// Fotos que estaban en el catalogo y dejaron de estar en ninguna parte tras un guardado.
// Solo URLs del almacen: las incrustadas viven dentro del propio JSON y no hay nada que borrar.
const esDelAlmacen = (src) => typeof src === 'string' && /^https?:\/\//.test(src);

const fotosDe = (catalogo) => {
  const salida = new Set();
  for (const p of catalogo.products || []) {
    const imgs = Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []);
    for (const src of imgs) if (esDelAlmacen(src)) salida.add(src);
  }
  if (esDelAlmacen(catalogo.settings && catalogo.settings.logo)) salida.add(catalogo.settings.logo);
  return salida;
};

export function fotosQueSobran(antes, despues) {
  const usadas = fotosDe(despues);
  return [...fotosDe(antes)].filter((src) => !usadas.has(src));
}
