// Logica de dominio de las ordenes, sin HTTP: construccion de lineas y descuento de inventario.
// Vive aparte del handler para poder probarse sin levantar un servidor ni tocar Redis.

function cleanText(value, max = 500) { return String(value || '').trim().slice(0, max); }
function money(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; }
function catalogMap(catalog) { return new Map((catalog.products || []).map((p) => [String(p.id), p])); }

function hasVariants(p) { return Array.isArray(p.variants) && p.variants.length > 0; }
function getVariants(p) { return Array.isArray(p.variants) ? p.variants : []; }
function findVariant(p, variantId) { if (!variantId) return null; return getVariants(p).find((v) => String(v.id) === String(variantId)) || null; }
function variantStock(v) { const n = Number(v.stockQty); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0; }
function sumVariantStock(p) { return getVariants(p).reduce((s, v) => s + variantStock(v), 0); }

// Con variantes el stock del producto es la suma; sin ellas, el comportamiento de siempre.
function getStock(product) {
  if (hasVariants(product)) return sumVariantStock(product);
  const raw = product.stockQty ?? product.stock;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

// Un producto con variantes obliga a elegir una: no hay precio ni stock a nivel de producto.
function resolveVariant(product, raw) {
  if (!hasVariants(product)) return { variant: null, variantId: null };
  const variantId = raw.variantId ?? null;
  if (!variantId) throw new Error('VARIANT_REQUIRED');
  const variant = findVariant(product, variantId);
  if (!variant) throw new Error('INVALID_VARIANT');
  return { variant, variantId: String(variantId) };
}

// El eje y la etiqueta se copian congelados, igual que ya se copiaba el nombre del producto:
// una orden debe seguir diciendo que se vendio aunque el catalogo cambie despues.
function makeLine(product, variant, variantId, quantity, unitPrice, nameOverride) {
  const line = {
    productId: product.id,
    variantId: variantId || null,
    name: cleanText(nameOverride || product.name, 180),
    quantity,
    unitPrice,
    subtotal: money(unitPrice * quantity),
  };
  if (variant) {
    line.variantAxis = cleanText(product.variantAxis || 'Variante', 60);
    line.variantLabel = cleanText(variant.label, 120);
  }
  return line;
}

function buildPublicItems(inputItems, catalog) {
  const map = catalogMap(catalog);
  if (!Array.isArray(inputItems) || !inputItems.length) throw new Error('ORDER_PRODUCTS_REQUIRED');
  const items = [];
  for (const raw of inputItems) {
    const product = map.get(String(raw.productId || raw.id));
    const quantity = Math.floor(Number(raw.quantity || raw.qty || 0));
    if (!product || quantity < 1 || quantity > 999) throw new Error('INVALID_PRODUCT');
    const { variant, variantId } = resolveVariant(product, raw);
    const available = variant ? variantStock(variant) : Number(product.stockQty ?? product.stock ?? 0);
    if (available >= 0 && quantity > available) throw new Error('INSUFFICIENT_STOCK');
    const unitPrice = money(variant ? variant.price : product.price);
    items.push(makeLine(product, variant, variantId, quantity, unitPrice));
  }
  return items;
}

function buildAdminItems(inputItems, catalog) {
  const map = catalogMap(catalog);
  if (!Array.isArray(inputItems) || !inputItems.length) throw new Error('ORDER_PRODUCTS_REQUIRED');
  return inputItems.map((raw) => {
    const product = map.get(String(raw.productId || raw.id));
    if (!product) throw new Error('INVALID_PRODUCT');
    const { variant, variantId } = resolveVariant(product, raw);
    const quantity = Math.max(1, Math.floor(Number(raw.quantity || raw.qty || 1)));
    const unitPrice = money(raw.unitPrice ?? raw.price ?? (variant ? variant.price : product.price));
    return makeLine(product, variant, variantId, quantity, unitPrice, raw.name);
  });
}

// Valida TODAS las lineas antes de descontar ninguna: nunca deja el inventario a medias.
function applyInventoryDeduction(catalog, order) {
  const products = Array.isArray(catalog.products)
    ? catalog.products.map((p) => (hasVariants(p) ? { ...p, variants: getVariants(p).map((v) => ({ ...v })) } : { ...p }))
    : [];
  const map = new Map(products.map((p) => [String(p.id), p]));
  const lines = order.products || [];

  for (const item of lines) {
    const product = map.get(String(item.productId));
    if (!product) throw new Error('INVENTORY_PRODUCT_NOT_FOUND');
    const quantity = Math.max(0, Math.floor(Number(item.quantity || 0)));
    if (hasVariants(product)) {
      // Orden vieja de un producto que gano variantes despues: el stockQty del producto ya es
      // solo un espejo, descontar ahi no bajaria el inventario real de ninguna variante.
      if (!item.variantId) throw new Error('INVENTORY_VARIANT_UNKNOWN');
      const variant = findVariant(product, item.variantId);
      if (!variant) throw new Error('INVENTORY_VARIANT_NOT_FOUND');
      if (quantity > variantStock(variant)) throw new Error('INSUFFICIENT_STOCK_ON_COMPLETION');
    } else {
      const stock = getStock(product);
      if (stock === null) throw new Error('INVENTORY_NOT_CONFIGURED');
      if (quantity > stock) throw new Error('INSUFFICIENT_STOCK_ON_COMPLETION');
    }
  }

  for (const item of lines) {
    const product = map.get(String(item.productId));
    const quantity = Math.max(0, Math.floor(Number(item.quantity || 0)));
    if (hasVariants(product)) {
      const variant = findVariant(product, item.variantId);
      variant.stockQty = variantStock(variant) - quantity;
      product.stockQty = sumVariantStock(product); // espejo
    } else {
      const nextStock = getStock(product) - quantity;
      product.stockQty = nextStock;
      if (Object.prototype.hasOwnProperty.call(product, 'stock')) product.stock = nextStock;
    }
  }

  return { ...catalog, products };
}

module.exports = { cleanText, money, getStock, hasVariants, buildPublicItems, buildAdminItems, applyInventoryDeduction };
