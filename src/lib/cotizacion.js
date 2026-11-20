// Cotizaciones: el papel con precios que se le manda a un cliente ANTES de que haya venta.
//
// Una cotizacion NO es una orden, y por eso vive en su propia lista y no en `synaptic_orders`:
// no aparta unidades, no descuenta inventario, no cuenta como ingreso y no dispara el aviso al
// telefono. Si cotizar moviera el stock, un cliente que pide precio por cinco laptops dejaria
// la tienda sin esas cinco para todo el mundo mientras se lo piensa.
//
// Sus lineas son TEXTO LIBRE a proposito. Cuando viene del catalogo se copian nombre y precio
// —y se guarda de que producto salio, por si algun dia se convierte en orden—, pero tambien
// tiene que poder cotizarse lo que no esta publicado: un servicio, un plan de mantenimiento, un
// equipo que todavia no se ha comprado. Esa es la mitad del trabajo de un revendedor.
//
// Lo que se copia se queda copiado: una cotizacion de hace tres meses tiene que seguir
// diciendo el precio que se prometio, no el que tiene hoy el catalogo.

const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const dinero = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; };
const entero = (v, min, max, porDefecto) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : porDefecto; };

export const MAX_LINEAS = 25;
export const MAX_DESCRIPCION = 160;
export const MAX_CANTIDAD = 9999;
export const MAX_NOTA = 700;
export const VALIDEZ_POR_DEFECTO = 30;
export const MAX_VALIDEZ = 365;

// Donde esta cada cotizacion. "Vencida" no esta en la lista porque no se guarda: se calcula de
// la fecha y los dias de validez, asi que ninguna cotizacion se queda marcada como vigente por
// el simple hecho de que nadie volvio a abrirla.
export const ESTADOS = [
  { valor: 'borrador', nombre: 'Borrador' },
  { valor: 'enviada', nombre: 'Enviada' },
  { valor: 'aceptada', nombre: 'Aceptada' },
  { valor: 'rechazada', nombre: 'Rechazada' },
];

const VALORES = new Set(ESTADOS.map((e) => e.valor));

export const nombreDeEstado = (valor) => (ESTADOS.find((e) => e.valor === valor) || ESTADOS[0]).nombre;

// --- Lineas ---

export function nuevaLinea(extra) {
  return { descripcion: '', cantidad: 1, precio: 0, ...(extra || {}) };
}

export function limpiarLinea(linea) {
  const l = linea || {};
  const limpia = {
    descripcion: texto(l.descripcion, MAX_DESCRIPCION),
    cantidad: entero(l.cantidad, 1, MAX_CANTIDAD, 1),
    precio: dinero(l.precio),
  };
  // De donde salio, cuando salio del catalogo. No se usa para releer el precio —ver arriba—,
  // solo para saber a que producto apuntaba si algun dia esto se convierte en una orden.
  const productId = texto(l.productId, 100);
  const variantId = texto(l.variantId, 100);
  if (productId) limpia.productId = productId;
  if (variantId) limpia.variantId = variantId;
  return limpia;
}

export function totalDeLinea(linea) {
  const l = limpiarLinea(linea);
  return dinero(l.cantidad * l.precio);
}

// Una linea sin descripcion no es una linea: es una fila que quedo a medias. Se descarta al
// guardar en vez de imprimir un renglon en blanco con un precio al lado.
export function lineasValidas(lineas) {
  return (Array.isArray(lineas) ? lineas : []).map(limpiarLinea).filter((l) => l.descripcion).slice(0, MAX_LINEAS);
}

export function totalDeCotizacion(lineas) {
  return dinero(lineasValidas(lineas).reduce((suma, l) => suma + l.cantidad * l.precio, 0));
}

// --- La cotizacion ---

export const numeroVisible = (numero) => String(entero(numero, 1, 9999999, 1)).padStart(4, '0');

export function limpiarCotizacion(cotizacion) {
  const c = cotizacion || {};
  const lineas = lineasValidas(c.lineas);
  return {
    // La fecha que sale en el papel se puede cambiar: a veces se escribe la cotizacion el lunes
    // de algo que se hablo el viernes, y la fecha que importa es la del acuerdo.
    fecha: fechaValida(c.fecha) ? c.fecha : hoyISO(),
    cliente: texto(c.cliente, 120),
    clienteTelefono: texto(c.clienteTelefono, 40).replace(/[^\d+\-() ]/g, ''),
    vendedor: texto(c.vendedor, 80),
    validezDias: entero(c.validezDias, 1, MAX_VALIDEZ, VALIDEZ_POR_DEFECTO),
    nota: texto(c.nota, MAX_NOTA),
    estado: VALORES.has(c.estado) ? c.estado : 'borrador',
    lineas,
    total: totalDeCotizacion(lineas),
  };
}

export const hoyISO = () => new Date().toLocaleDateString('en-CA');

// No basta con que tenga forma de fecha ni con que Date la acepte: `2026-02-30` se traga sin
// quejarse y sale convertida en el 2 de marzo. Se comprueba que vuelva a escribirse igual, que
// es lo unico que descarta un 30 de febrero. Se opera en UTC para que el redondeo de la zona
// horaria no mueva el dia.
const fechaValida = (v) => {
  const s = String(v || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

// Suma dias sin pasar por la zona horaria: se opera a mediodia para que ningun cambio de hora
// mueva la fecha un dia hacia atras.
export function vencimientoDe(cotizacion) {
  const c = limpiarCotizacion(cotizacion);
  const d = new Date(`${c.fecha}T12:00:00`);
  d.setDate(d.getDate() + c.validezDias);
  return d.toLocaleDateString('en-CA');
}

export function estaVencida(cotizacion, hoy) {
  return vencimientoDe(cotizacion) < (hoy || hoyISO());
}

// Lo que se enseña en la lista: el estado guardado, salvo que ya se le haya pasado el tiempo.
//
// SOLO vence lo que se envio. El plazo es una promesa hecha al cliente, y a un borrador no se
// le prometio nada: marcarlo "vencida" seria avisar de que se rompio algo que nunca existio.
// Una aceptada tampoco vence: ese precio ya se honro.
export function estadoVisible(cotizacion, hoy) {
  const estado = limpiarCotizacion(cotizacion).estado;
  if (estado === 'enviada' && estaVencida(cotizacion, hoy)) return { valor: 'vencida', nombre: 'Vencida' };
  return { valor: estado, nombre: nombreDeEstado(estado) };
}

// --- Lo que la tienda pone por defecto en cada cotizacion ---
//
// Vive en los ajustes y no en el codigo porque es justo lo que cambia de una tienda a otra: el
// nombre de quien firma, cuanto aguanta un precio y el parrafo de condiciones que se repite en
// todas. Una copia de esta tienda vendida a otro cliente se cotiza con SUS datos sin tocar un
// archivo.
export function ajustesDeCotizacion(settings) {
  const c = (settings && settings.cotizacion) || {};
  return {
    vendedor: texto(c.vendedor, 80),
    validezDias: entero(c.validezDias, 1, MAX_VALIDEZ, VALIDEZ_POR_DEFECTO),
    nota: texto(c.nota, MAX_NOTA),
  };
}

export const limpiarAjustesDeCotizacion = (c) => ajustesDeCotizacion({ cotizacion: c });

// Una cotizacion nueva nace con los valores de la tienda ya puestos, no en blanco: el dueño
// escribe el cliente y los renglones, que es lo unico que de verdad cambia cada vez.
export function cotizacionNueva(settings) {
  const base = ajustesDeCotizacion(settings);
  return {
    fecha: hoyISO(),
    cliente: '',
    clienteTelefono: '',
    vendedor: base.vendedor,
    validezDias: base.validezDias,
    nota: base.nota,
    estado: 'borrador',
    lineas: [nuevaLinea()],
  };
}

// --- Los datos que van impresos en la cabecera del papel ---
//
// Salen de los ajustes, no del codigo: el logo, el nombre y la direccion son los de la tienda
// que cotiza. Sin logo se imprime solo el nombre, y sin direccion no se imprime esa linea.
export function datosDePapel(settings) {
  const s = settings || {};
  const n = s.negocio || {};
  return {
    tienda: texto(s.storeName, 80) || 'Tienda',
    logo: texto(s.logo, 600),
    direccion: texto(n.direccion, 160),
    rnc: texto(n.rnc, 30),
    telefono: texto(s.whatsapp, 40),
    correo: texto(n.correo, 120),
    moneda: texto(s.currency, 8) || 'RD$',
  };
}
