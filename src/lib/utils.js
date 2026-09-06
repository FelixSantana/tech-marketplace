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
// Arma el enlace de WhatsApp con el pedido. Funcion pura y probada: es el texto que el
// cliente termina enviando, asi que no debe depender de nada del navegador.
export function buildOrderWaLink(items, settings) {
  const phone = normalizePhone(settings.whatsapp);
  const lines = [`Hola ${settings.storeName}! Quiero hacer este pedido:`, ``];
  let total = 0;
  items.forEach((it) => {
    const variante = (it.product.variants || []).find((v) => v.id === (it.variantId || null));
    const precio = Number(variante ? variante.price : it.product.price) || 0;
    const subtotal = precio * it.qty;
    total += subtotal;
    const etiqueta = variante ? ` (${it.product.variantAxis || 'Opción'}: ${variante.label})` : '';
    lines.push(`• ${it.product.name}${etiqueta} x${it.qty} — ${settings.currency} ${subtotal.toLocaleString('es-DO')}`);
  });
  lines.push(``, `Total: ${settings.currency} ${total.toLocaleString('es-DO')}`, ``, `¿Está todo disponible?`);
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
}
export function getCategoryEmoji(category, categories) { if (!category) return '📦'; const found = categories.find((c) => c.name.toLowerCase() === category.trim().toLowerCase()); return found ? found.emoji : '📦'; }
export const EMOJI_PICKS = ['💻', '📱', '🎧', '🛠️', '🖥️', '🖱️', '⌨️', '🔌', '🎮', '⌚', '📶', '🔋', '📷', '🧴', '🛞', '🧰'];
