import { CAMPOS_DE_MARCA } from './marca';

// Fotos que estaban en el catalogo y dejaron de estar en ninguna parte tras un guardado.
// Solo URLs del almacen: las incrustadas viven dentro del propio JSON y no hay nada que borrar.
const esDelAlmacen = (src) => typeof src === 'string' && /^https?:\/\//.test(src);

const fotosDe = (catalogo) => {
  const salida = new Set();
  for (const p of catalogo.products || []) {
    const imgs = Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []);
    for (const src of imgs) if (esDelAlmacen(src)) salida.add(src);
  }
  const settings = catalogo.settings || {};
  if (esDelAlmacen(settings.logo)) salida.add(settings.logo);
  // Las imagenes derivadas del logo —la de compartir y los tres iconos— tambien viven en el
  // almacen y tambien dejan de usarse cuando el dueño cambia el logo. Sin contarlas aqui no se
  // borrarian nunca: quedarian pagandose para siempre, una tanda por cada cambio de logo.
  for (const campo of CAMPOS_DE_MARCA) {
    const src = settings.marca && settings.marca[campo];
    if (esDelAlmacen(src)) salida.add(src);
  }
  return salida;
};

export function fotosQueSobran(antes, despues) {
  const usadas = fotosDe(despues);
  return [...fotosDe(antes)].filter((src) => !usadas.has(src));
}
