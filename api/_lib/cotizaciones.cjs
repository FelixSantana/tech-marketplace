// Lo que el SERVIDOR hace con las cotizaciones. La version del navegador esta en
// src/lib/cotizacion.js, y una prueba cruzada comprueba que las dos no se separan.
//
// Esto es lo que vale: cualquiera con el token del panel puede mandar un PUT a mano, asi que el
// recorte de textos, el tope de lineas y el total se recalculan AQUI. El total que llega en el
// cuerpo se ignora por completo —se suma de las lineas— para que no pueda guardarse un papel
// cuyos renglones no cuadren con su propio total.

const COTIZACIONES_KEY = 'synaptic_cotizaciones';
// Las cotizaciones viven todas en una sola clave, como las ordenes. El tope existe para que esa
// clave no crezca sin freno: pasadas 500 se cae la mas vieja.
const MAX_GUARDADAS = 500;
const MAX_LINEAS = 25;
const MAX_DESCRIPCION = 160;
const MAX_CANTIDAD = 9999;
const MAX_NOTA = 700;
const VALIDEZ_POR_DEFECTO = 30;
const MAX_VALIDEZ = 365;
const ESTADOS = ['borrador', 'enviada', 'aceptada', 'rechazada'];

const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const dinero = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; };
const entero = (v, min, max, porDefecto) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : porDefecto; };
const hoyISO = () => new Date().toISOString().slice(0, 10);
// Que tenga forma de fecha no basta: `2026-02-30` se traga sin quejarse y sale convertida en el
// 2 de marzo. Se comprueba que vuelva a escribirse igual. Ver src/lib/cotizacion.js.
const fechaValida = (v) => {
  const s = String(v || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

function limpiarLinea(linea) {
  const l = linea || {};
  const limpia = {
    descripcion: texto(l.descripcion, MAX_DESCRIPCION),
    cantidad: entero(l.cantidad, 1, MAX_CANTIDAD, 1),
    precio: dinero(l.precio),
  };
  const productId = texto(l.productId, 100);
  const variantId = texto(l.variantId, 100);
  if (productId) limpia.productId = productId;
  if (variantId) limpia.variantId = variantId;
  return limpia;
}

const lineasValidas = (lineas) => (Array.isArray(lineas) ? lineas : []).map(limpiarLinea).filter((l) => l.descripcion).slice(0, MAX_LINEAS);

const totalDe = (lineas) => dinero(lineasValidas(lineas).reduce((suma, l) => suma + l.cantidad * l.precio, 0));

// Los campos que el panel puede escribir. Ni `id`, ni `numero`, ni las fechas de creacion: esos
// los pone el servidor y no se aceptan del cuerpo, porque un numero repetido convierte dos
// papeles distintos en el mismo documento a ojos del cliente.
function camposDelCuerpo(body) {
  const b = body || {};
  const lineas = lineasValidas(b.lineas);
  return {
    fecha: fechaValida(b.fecha) ? b.fecha : hoyISO(),
    cliente: texto(b.cliente, 120),
    clienteTelefono: texto(b.clienteTelefono, 40).replace(/[^\d+\-() ]/g, ''),
    vendedor: texto(b.vendedor, 80),
    validezDias: entero(b.validezDias, 1, MAX_VALIDEZ, VALIDEZ_POR_DEFECTO),
    nota: texto(b.nota, MAX_NOTA),
    estado: ESTADOS.includes(b.estado) ? b.estado : 'borrador',
    lineas,
    total: totalDe(lineas),
  };
}

// El numero corre del MAYOR que exista, no de cuantas hay: borrar la #0007 no puede hacer que la
// siguiente vuelva a llamarse #0007. Dos papeles con el mismo numero en manos de dos clientes es
// un problema que no se arregla despues.
function siguienteNumero(existentes) {
  const mayor = (Array.isArray(existentes) ? existentes : []).reduce((max, c) => Math.max(max, Number(c && c.numero) || 0), 0);
  return mayor + 1;
}

function crearCotizacion(body, existentes) {
  const ahora = new Date().toISOString();
  return {
    id: `cot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    numero: siguienteNumero(existentes),
    ...camposDelCuerpo(body),
    createdAt: ahora,
    updatedAt: ahora,
  };
}

// Al editar se conservan id, numero y createdAt de la que ya estaba: lo demas se vuelve a
// validar desde cero, igual que al crearla.
function actualizarCotizacion(actual, body) {
  return {
    ...camposDelCuerpo(body),
    id: actual.id,
    numero: actual.numero,
    createdAt: actual.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  COTIZACIONES_KEY, MAX_GUARDADAS, MAX_LINEAS, MAX_NOTA, VALIDEZ_POR_DEFECTO, ESTADOS,
  limpiarLinea, lineasValidas, totalDe, camposDelCuerpo, siguienteNumero, crearCotizacion, actualizarCotizacion,
};
