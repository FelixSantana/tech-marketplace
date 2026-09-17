// Cupones de descuento, sin HTTP, para poder probarlo.
//
// El descuento lo calcula SIEMPRE el servidor: el navegador solo manda el codigo escrito.
// Se aplica al subtotal de productos, nunca al envio.

const dinero = (n) => { const v = Number(n); return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : 0; };
const texto = (v, max) => String(v || '').trim().slice(0, max);
const normalizarCodigo = (v) => texto(v, 40).toUpperCase().replace(/\s+/g, '');

// Fecha de hoy en Republica Dominicana, para que un cupon no venza a medianoche de otro pais.
function hoyEnRD() {
  try { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' }); }
  catch { return new Date().toISOString().slice(0, 10); }
}

function normalizarCupones(settings) {
  const lista = (settings && settings.cupones) || [];
  if (!Array.isArray(lista)) return [];
  return lista.filter((c) => c && c.id && normalizarCodigo(c.codigo)).map((c) => ({
    id: String(c.id),
    codigo: normalizarCodigo(c.codigo),
    tipo: c.tipo === 'monto' ? 'monto' : 'porcentaje',
    valor: dinero(c.valor),
    vence: /^\d{4}-\d{2}-\d{2}$/.test(String(c.vence || '')) ? String(c.vence) : '',
    minimo: dinero(c.minimo),
    activo: c.activo !== false,
  }));
}

function descuentoDe(cupon, subtotal) {
  const base = dinero(subtotal);
  if (cupon.tipo === 'monto') return dinero(Math.min(cupon.valor, base));
  return dinero(Math.min(base * (Math.min(cupon.valor, 100) / 100), base));
}

// Codigo vacio = pedido sin cupon, que no es un error.
function resolverCupon(settings, codigoEscrito, subtotal, hoy) {
  const codigo = normalizarCodigo(codigoEscrito);
  if (!codigo) return null;
  const cupon = normalizarCupones(settings).find((c) => c.codigo === codigo);
  if (!cupon) throw new Error('COUPON_NOT_FOUND');
  if (!cupon.activo) throw new Error('COUPON_INACTIVE');
  if (cupon.vence && (hoy || hoyEnRD()) > cupon.vence) throw new Error('COUPON_EXPIRED');
  if (cupon.minimo > 0 && dinero(subtotal) < cupon.minimo) throw new Error('COUPON_BELOW_MIN');
  const descuento = descuentoDe(cupon, subtotal);
  return { codigo: cupon.codigo, tipo: cupon.tipo, valor: cupon.valor, descuento };
}

module.exports = { normalizarCupones, normalizarCodigo, resolverCupon, descuentoDe, hoyEnRD };
