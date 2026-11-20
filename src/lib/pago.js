// Como se pago una orden: el metodo, la referencia y los comprobantes.
//
// Sin esto, una transferencia se anotaba en la libreta o no se anotaba. El dueño abria una
// orden de hace dos semanas y no sabia si se cobro, con que, ni donde estaba la captura.
//
// LOS COMPROBANTES SOLO SE GUARDAN COMO URL DEL ALMACEN, nunca incrustados. Las ordenes viven
// TODAS en una sola clave de Redis —hasta mil— y una captura incrustada son cientos de miles de
// caracteres en base64. Veinte transferencias con captura reventarian esa clave y con ella el
// panel de ordenes entero. Si la subida al almacen falla, se dice y no se guarda nada: perder
// un comprobante es malo, perder las mil ordenes es irreparable.

import { datosDeNegocio } from './negocio';

const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

// Cuatro caben de sobra: la captura de la transferencia y, si acaso, el voucher y el recibo.
// El tope existe por el tamaño de la clave de ordenes, no por capricho de diseño.
export const MAX_EVIDENCIAS = 4;

// Lo que se ofrece en el desplegable sale de las formas de pago que el dueño configuro en
// Ajustes, que son las que ya anuncia en el pie de su tienda. Asi un cliente que cobra en
// Yape o en Zelle las ve sin que nadie toque el codigo.
export const OTRO = 'Otro';

export function metodosDisponibles(settings) {
  const suyos = datosDeNegocio(settings).pagos.filter(Boolean);
  // "Otro" siempre al final: cobrar de una forma que no esta en la lista pasa, y obligar a
  // dejarlo vacio seria peor que dejar anotarlo.
  return [...new Set([...suyos, OTRO])];
}

// Solo URLs del almacen. Una imagen incrustada (data:) se rechaza a proposito: ver arriba.
const esDelAlmacen = (src) => typeof src === 'string' && /^https:\/\/[^\s]+$/.test(src) && src.length <= 600;

export function limpiarPago(pago) {
  const p = pago || {};
  const metodo = texto(p.metodo, 40);
  const referencia = texto(p.referencia, 60);
  const evidencias = (Array.isArray(p.evidencias) ? p.evidencias : []).filter(esDelAlmacen).slice(0, MAX_EVIDENCIAS);
  // Sin nada que decir no se guarda el campo: una orden sin pago anotado queda como estaba
  // antes de que esto existiera, en vez de con tres campos vacios dentro.
  return metodo || referencia || evidencias.length ? { metodo, referencia, evidencias } : null;
}

export function pagoDeOrden(order) {
  return limpiarPago(order && order.pago);
}

// Si este metodo normalmente deja rastro. Es una PISTA para recordar el comprobante, nunca una
// condicion: hay quien cobra en efectivo y fotografia el recibo, y hay transferencias que se
// anotan sin captura. El panel sugiere, no obliga.
const SIN_RASTRO = /^(efectivo|cash|contado)$/i;

export function sugiereEvidencia(metodo) {
  const m = texto(metodo, 40);
  return Boolean(m) && !SIN_RASTRO.test(m) && m !== OTRO;
}

// Una linea para la tabla de ordenes: "Transferencia · 2 comprobantes".
export function resumenDePago(order) {
  const p = pagoDeOrden(order);
  if (!p) return '';
  const partes = [];
  if (p.metodo) partes.push(p.metodo);
  if (p.referencia) partes.push(`ref. ${p.referencia}`);
  if (p.evidencias.length) partes.push(p.evidencias.length === 1 ? '1 comprobante' : `${p.evidencias.length} comprobantes`);
  return partes.join(' · ');
}
