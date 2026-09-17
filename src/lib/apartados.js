// La tienda debe mostrar lo DISPONIBLE, no el stock en bodega: un pedido ya registrado
// retiene sus unidades. El panel, en cambio, sigue viendo el stock real.
const entero = (n) => Math.max(0, Math.floor(Number(n) || 0));
const clave = (productId, variantId) => `${productId}::${variantId || ''}`;

export const apartadoDe = (reservas, productId, variantId) => entero((reservas || {})[clave(productId, variantId)]);

export function netearApartados(products, reservas) {
  if (!reservas || !Object.keys(reservas).length) return products;
  return products.map((p) => {
    if (Array.isArray(p.variants) && p.variants.length) {
      const variants = p.variants.map((v) => ({ ...v, stockQty: Math.max(0, entero(v.stockQty) - apartadoDe(reservas, p.id, v.id)) }));
      return { ...p, variants, stockQty: variants.reduce((s, v) => s + entero(v.stockQty), 0) };
    }
    return { ...p, stockQty: Math.max(0, entero(p.stockQty) - apartadoDe(reservas, p.id, null)) };
  });
}
