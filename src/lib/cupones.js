// Espejo en el navegador de api/_lib/cupones.cjs, solo para que el cliente vea el descuento
// antes de enviar. El que vale es el que calcula el servidor al registrar el pedido.
const dinero = (n) => { const v = Number(n); return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : 0; };
export const normalizarCodigo = (v) => String(v || '').trim().slice(0, 40).toUpperCase().replace(/\s+/g, '');

export function cuponesDeAjustes(settings) {
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

const hoyEnRD = () => { try { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' }); } catch { return new Date().toISOString().slice(0, 10); } };

// Devuelve { descuento } o { error } con el motivo listo para mostrar.
export function probarCupon(settings, codigoEscrito, subtotal, hoy) {
  const codigo = normalizarCodigo(codigoEscrito);
  if (!codigo) return { descuento: 0 };
  const cupon = cuponesDeAjustes(settings).find((c) => c.codigo === codigo);
  if (!cupon) return { error: 'Ese código de descuento no existe.' };
  if (!cupon.activo) return { error: 'Ese código ya no está activo.' };
  if (cupon.vence && (hoy || hoyEnRD()) > cupon.vence) return { error: 'Ese código ya venció.' };
  if (cupon.minimo > 0 && dinero(subtotal) < cupon.minimo) return { error: `Ese código pide un pedido mínimo de ${cupon.minimo.toLocaleString('es-DO')}.` };
  const base = dinero(subtotal);
  const descuento = cupon.tipo === 'monto' ? dinero(Math.min(cupon.valor, base)) : dinero(Math.min(base * (Math.min(cupon.valor, 100) / 100), base));
  return { codigo: cupon.codigo, descuento };
}
