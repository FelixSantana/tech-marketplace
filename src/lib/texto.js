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

// Concordancia de numero. Existe porque el mismo fallo ya aparecio dos veces en sitios
// distintos: "1 articulos" en un aviso de pedido y "1 opciones de RAM" en una tarjeta. Las dos
// veces el numero y el plural se calcularon por separado y acabaron sin concordar.
//
// Devuelve el texto entero —numero incluido— justamente para que no se puedan separar.
export function cuantos(n, singular, plural) {
  const cantidad = Math.trunc(Number(n)) || 0;
  return `${cantidad} ${Math.abs(cantidad) === 1 ? singular : plural}`;
}

// El telefono de la tienda, escrito como lo escribe la gente aqui. Se guarda en digitos
// pelados porque wa.me los quiere asi, pero "8295550123" no se lee: ni en la barra de arriba
// ni en el membrete de una cotizacion.
//
// Menos de diez digitos no se formatea: seria inventarle una forma a un numero incompleto.
export function telefonoVisible(valor) {
  const d = String(valor || '').replace(/\D/g, '');
  if (d.length < 10) return '';
  const n = d.slice(-10);
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
}
