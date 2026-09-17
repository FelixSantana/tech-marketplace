// Comparacion de texto tolerante a acentos y mayusculas. Desde el telefono se escribe
// "audifonos" sin tilde, y antes eso no encontraba "Audífonos".
export function normalizarBusqueda(valor) {
  return String(valor || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function coincideBusqueda(producto, consulta) {
  const q = normalizarBusqueda(consulta).trim();
  if (!q) return true;
  return normalizarBusqueda(producto.name).includes(q) || normalizarBusqueda(producto.description).includes(q);
}
