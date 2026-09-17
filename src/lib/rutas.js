// Enlaces propios por producto: /p/<nombre-en-guiones>-<sufijo-del-id>
//
// El sufijo del id es lo que resuelve el producto, asi que renombrarlo no rompe los enlaces
// ya compartidos; el nombre en la URL es solo para que se lea y para Google.
const sinAcentos = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

export const sufijoDeId = (id) => String(id || '').split('_').pop().slice(-6).toLowerCase();

export function slugProducto(producto) {
  const nombre = sinAcentos(producto.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  const sufijo = sufijoDeId(producto.id);
  return nombre ? `${nombre}-${sufijo}` : sufijo;
}

export const rutaProducto = (producto) => `/p/${slugProducto(producto)}`;

// Busca por el sufijo final del slug. Tolera que el nombre haya cambiado.
export function buscarPorSlug(products, slug) {
  const limpio = String(slug || '').replace(/^\/?p\//, '').replace(/[?#].*$/, '').toLowerCase();
  if (!limpio) return null;
  const sufijo = limpio.split('-').pop();
  return products.find((p) => sufijoDeId(p.id) === sufijo) || products.find((p) => slugProducto(p) === limpio) || null;
}
