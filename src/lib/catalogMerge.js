// Aplica la edicion de un producto sobre el catalogo recien leido del servidor.
//
// El stock es el unico campo que cambian dos actores a la vez: el admin desde el formulario y
// el servidor al completar una orden. El formulario siempre manda su stock, lo haya tocado o no,
// asi que no basta con mezclar objetos: se compara contra el producto tal como estaba al abrir
// el formulario ("original"), y solo si el admin cambio el numero se le da la razon. Si no lo
// toco, manda el valor fresco del servidor.

const entero = (n) => Math.max(0, Math.floor(Number(n) || 0));

export function mergeProductEdit(freshProducts, { id, original, data }) {
  const fresh = freshProducts.find((p) => p.id === id);
  const siguiente = { ...(fresh || {}), ...data, id };

  // Sin variantes en lo que manda el formulario, el producto deja de tenerlas. Antes se
  // conservaban las viejas porque el formulario simplemente omitia el campo.
  if (!Array.isArray(data.variants) || data.variants.length === 0) {
    delete siguiente.variants;
    delete siguiente.variantAxis;
    const tocoElStock = !original || entero(data.stockQty) !== entero(original.stockQty);
    if (fresh && !tocoElStock && !Array.isArray(fresh.variants)) siguiente.stockQty = entero(fresh.stockQty);
  } else {
    const originales = new Map((original?.variants || []).map((v) => [v.id, v]));
    const frescas = new Map((fresh?.variants || []).map((v) => [v.id, v]));
    siguiente.variants = data.variants.map((v) => {
      const antes = originales.get(v.id);
      const ahora = frescas.get(v.id);
      const tocoElStock = !antes || entero(v.stockQty) !== entero(antes.stockQty);
      return ahora && !tocoElStock ? { ...v, stockQty: entero(ahora.stockQty) } : v;
    });
    // espejos, para que una version vieja del codigo siga mostrando algo coherente
    siguiente.stockQty = siguiente.variants.reduce((s, v) => s + entero(v.stockQty), 0);
    siguiente.price = Math.min(...siguiente.variants.map((v) => Number(v.price) || 0));
  }

  return fresh ? freshProducts.map((p) => (p.id === id ? siguiente : p)) : [...freshProducts, siguiente];
}
