export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 520;
        let w = img.width, h = img.height;
        if (w > h && w > maxDim) { h = h * (maxDim / w); w = maxDim; } else if (h > maxDim) { w = w * (maxDim / h); h = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.62));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
export function normalizePhone(raw) { let digits = (raw || '').replace(/\D/g, ''); if (digits.length === 10) digits = '1' + digits; return digits; }
export function buildWaLink(product, qty, settings) {
  qty = Math.max(1, Number(qty) || 1);
  const phone = normalizePhone(settings.whatsapp);
  const lines = [`Hola ${settings.storeName}! Vi este producto en el catálogo y me interesa:`, ``, `• Producto: ${product.name}`, `• Cantidad: ${qty}`, `• Total: ${settings.currency} ${(Number(product.price) * qty).toLocaleString('es-DO')}`];
  if (product.category) lines.push(`• Categoría: ${product.category}`);
  lines.push(``, `¿Está disponible?`);
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
}
export function buildCartWaLink(items, settings) {
  const phone = normalizePhone(settings.whatsapp);
  const lines = [`Hola ${settings.storeName}! Quiero hacer este pedido:`, ``];
  let total = 0;
  items.forEach((it) => {
    const subtotal = Number(it.product.price) * it.qty;
    total += subtotal;
    lines.push(`• ${it.product.name} x${it.qty} — ${settings.currency} ${subtotal.toLocaleString('es-DO')}`);
  });
  lines.push(``, `Total: ${settings.currency} ${total.toLocaleString('es-DO')}`, ``, `¿Está todo disponible?`);
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
}
export function getCategoryEmoji(category, categories) { if (!category) return '📦'; const found = categories.find((c) => c.name.toLowerCase() === category.trim().toLowerCase()); return found ? found.emoji : '📦'; }
export const EMOJI_PICKS = ['💻', '📱', '🎧', '🛠️', '🖥️', '🖱️', '⌨️', '🔌', '🎮', '⌚', '📶', '🔋', '📷', '🧴', '🛞', '🧰'];
