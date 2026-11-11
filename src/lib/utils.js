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
export function buildOrderWaLink(items, settings, entrega, cupon) {
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

  const costoEnvio = Number(entrega && entrega.costo) || 0;
  if (entrega && entrega.modo === 'retiro') {
    lines.push(``, `Retiro en tienda`);
  } else if (entrega && entrega.modo === 'domicilio') {
    lines.push(``, `Entrega a domicilio${entrega.zonaNombre ? ` — ${entrega.zonaNombre}` : ''}`);
    if (entrega.direccion) lines.push(`Dirección: ${entrega.direccion}`);
    lines.push(`Envío: ${costoEnvio ? `${settings.currency} ${costoEnvio.toLocaleString('es-DO')}` : 'gratis'}`);
  }

  const descuento = Number(cupon && cupon.descuento) || 0;
  if (descuento > 0) lines.push(``, `Descuento ${cupon.codigo || ''}: −${settings.currency} ${descuento.toLocaleString('es-DO')}`.replace('  ', ' '));

  lines.push(``, `Total: ${settings.currency} ${(Math.max(0, total - descuento) + costoEnvio).toLocaleString('es-DO')}`, ``, `¿Está todo disponible?`);
  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
}
export function getCategoryEmoji(category, categories) { if (!category) return '📦'; const found = categories.find((c) => c.name.toLowerCase() === category.trim().toLowerCase()); return found ? found.emoji : '📦'; }
// Los emojis que se ofrecen al crear una categoria.
//
// Eran dieciseis y todos de tecnologia, porque la tienda se escribio para una tienda de
// tecnologia. Para un cliente que venda ropa, comida o repuestos no habia NADA que elegir, y
// acababa pegando el emoji a mano o dejandolo en la caja por defecto. Es el mismo problema que
// los sellos escritos en el codigo: funciona para una tienda y estorba en la siguiente.
//
// Van por grupos porque con casi cien sueltos no se encuentra nada. El titulo del grupo es lo
// unico que se lee para orientarse; los emojis no se buscan por nombre, se buscan por zona.
//
// No se usan los emojis mas nuevos de Unicode (destornillador, cepillo de dientes, silla). En
// un sistema que no los trae salen como un rectangulo vacio, y aunque aqui se ve antes de
// elegir —asi que nadie escoge un hueco—, el que ya los tuviera guardados los veria rotos.
export const EMOJI_GRUPOS = [
  { titulo: 'Tecnología', emojis: ['💻', '🖥️', '📱', '⌨️', '🖱️', '🖨️', '🎧', '🎮', '📷', '📹', '⌚', '📺', '💾', '🔌', '🔋', '📶'] },
  { titulo: 'Herramientas', emojis: ['🛠️', '🧰', '🔧', '🔩', '🔨', '🔦', '⚙️', '🧲', '⛏️'] },
  { titulo: 'Hogar y oficina', emojis: ['🛋️', '🛏️', '💡', '🧹', '🍳', '🧊', '🚿', '📚', '✏️', '📎', '🕯️'] },
  { titulo: 'Ropa y accesorios', emojis: ['👕', '👖', '👗', '👟', '👜', '🧢', '🕶️', '💍', '🧦', '🧥', '👔', '🎒'] },
  { titulo: 'Belleza y salud', emojis: ['🧴', '💄', '🧼', '💊', '🩹', '✂️', '🌸', '🧽'] },
  { titulo: 'Comida y bebida', emojis: ['🍔', '🍕', '🥗', '🍰', '☕', '🥤', '🍺', '🍫', '🥖', '🍎', '🧁'] },
  { titulo: 'Vehículos', emojis: ['🚗', '🏍️', '🚲', '🛵', '🚚', '🛞', '⛽', '🔑'] },
  { titulo: 'Niños y mascotas', emojis: ['🧸', '🎯', '🐶', '🐱', '🦴', '🍼', '🎈'] },
  { titulo: 'Deporte y ocio', emojis: ['⚽', '🏀', '🏋️', '🚴', '🎸', '🎨', '📖', '🎲'] },
  { titulo: 'General', emojis: ['📦', '🎁', '🏷️', '⭐', '🔥', '💎', '🌿', '🛒'] },
];

// La lista plana. Cada emoji es la clave de React de su boton, asi que uno repetido no solo
// sobra: haria que React tratara dos botones como el mismo. Una prueba lo comprueba.
export const EMOJI_PICKS = EMOJI_GRUPOS.flatMap((g) => g.emojis);
