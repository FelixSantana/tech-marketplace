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
export const MAX_DETALLE = 120;
export const MAX_CANTIDAD = 9999;
export const MAX_NOTA = 700;
export const VALIDEZ_POR_DEFECTO = 30;
export const MAX_VALIDEZ = 365;
export const MAX_ITBIS = 100;
// En la Republica Dominicana el ITBIS general es 18%. Se ofrece como atajo, no como valor por
// defecto: muchas cotizaciones de reventa van exentas, y cobrar un impuesto por descuido es
// peor que no ponerlo.
export const ITBIS_RD = 18;
export const MONEDAS = ['RD$', 'US$', 'EUR'];

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
  return { descripcion: '', detalle: '', cantidad: 1, precio: 0, itbis: false, ...(extra || {}) };
}

export function limpiarLinea(linea) {
  const l = linea || {};
  const limpia = {
    descripcion: texto(l.descripcion, MAX_DESCRIPCION),
    // La linea pequeña gris debajo del concepto: "Plazo: 1 año (12 meses)", "Incluye
    // instalacion", "Garantia 6 meses". Es donde cabe la condicion que convierte un precio en
    // una oferta entendible.
    detalle: texto(l.detalle, MAX_DETALLE),
    cantidad: entero(l.cantidad, 1, MAX_CANTIDAD, 1),
    precio: dinero(l.precio),
    itbis: Boolean(l.itbis),
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

// --- Los numeros del papel ---
//
// Tres columnas distintas y es importante no confundirlas: TOTAL es lo que suman las unidades
// SIN impuesto, ITBIS es el impuesto de ESA linea, y VALOR es lo que se paga por ella. Una
// linea exenta enseña un guion en la columna del impuesto, no un cero: cero parece un impuesto
// calculado que dio cero; el guion dice "aqui no aplica".
//
// EL ITBIS SE SACA DE DENTRO DEL PRECIO, no se suma encima. Los precios del catalogo son los
// finales: la Dell Latitude 3190 cuesta 5,500 y el cliente paga 5,500. Sumarle un 18% encima
// convertiria el papel en una promesa de 6,490 por algo que esta publicado a 5,500, y eso no se
// puede entregar. Asi que de los 5,500 se saca la base (4,661.02) y el impuesto (838.98), que
// es como se declara una venta con precio al publico.
//
// `itbisIncluido` en false hace lo contrario —sumar por encima—, para una tienda que escriba
// sus precios sin impuesto.
//
// EL ORDEN DE LAS OPERACIONES IMPORTA. Se saca primero el precio base de UNA unidad y despues
// se multiplica, no al reves: asi PRECIO × CANTIDAD da exactamente TOTAL en el papel. El
// impuesto se calcula como la diferencia contra el valor final, no multiplicando por la tasa,
// para que VALOR sea al centimo lo que se prometio. Con 3 unidades eso deja el ITBIS a un
// centimo de la tasa exacta; preferible a que el total no cuadre con el precio publicado.
export function cuentasDeLinea(linea, tasa, incluido) {
  const l = limpiarLinea(linea);
  // Un impuesto del 0% no es un impuesto: la linea se trata como exenta aunque este marcada,
  // para que no salga "0.00" donde deberia haber un guion.
  const gravada = l.itbis && tasa > 0;
  if (!gravada) {
    const total = dinero(l.cantidad * l.precio);
    return { ...l, gravada: false, precioBase: l.precio, total, impuesto: 0, valor: total };
  }
  if (incluido) {
    const precioBase = dinero(l.precio / (1 + tasa / 100));
    const total = dinero(precioBase * l.cantidad);
    const valor = dinero(l.cantidad * l.precio);
    return { ...l, gravada: true, precioBase, total, impuesto: dinero(valor - total), valor };
  }
  const total = dinero(l.cantidad * l.precio);
  const impuesto = dinero(total * (tasa / 100));
  return { ...l, gravada: true, precioBase: l.precio, total, impuesto, valor: dinero(total + impuesto) };
}

export function cuentasDeCotizacion(cotizacion) {
  const c = cotizacion || {};
  const tasa = entero(c.itbisPorciento, 0, MAX_ITBIS, 0);
  const incluido = c.itbisIncluido !== false;
  const lineas = lineasValidas(c.lineas).map((l) => cuentasDeLinea(l, tasa, incluido));
  const subtotal = dinero(lineas.reduce((s, l) => s + l.total, 0));
  const itbis = dinero(lineas.reduce((s, l) => s + l.impuesto, 0));
  return { tasa, incluido, lineas, subtotal, itbis, total: dinero(subtotal + itbis) };
}

export const totalDeCotizacion = (lineas, itbisPorciento, itbisIncluido) => cuentasDeCotizacion({ lineas, itbisPorciento, itbisIncluido }).total;

// --- El numero de la cotizacion ---
//
// Forma: 20261120-A. La fecha del papel y una letra correlativa dentro de ese dia.
//
// La letra SE GUARDA al crear, no se deduce de la lista al imprimir. Si se dedujera, borrar una
// cotizacion le cambiaria el numero a otra que ya esta en manos de un cliente, y dos papeles
// distintos con el mismo numero —o el mismo papel con dos numeros— es un lio que no se arregla
// despues.
export function letraDeOrden(indice) {
  let n = Math.max(0, Math.floor(Number(indice) || 0));
  let letras = '';
  // Pasadas las 26 del mismo dia sigue por AA, AB... en vez de quedarse sin letras.
  do {
    letras = String.fromCharCode(65 + (n % 26)) + letras;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letras;
}

export function numeroDeCotizacion(cotizacion) {
  const c = cotizacion || {};
  const fecha = fechaValida(c.fecha) ? c.fecha : hoyISO();
  // Las cotizaciones hechas antes de este formato no tienen letra guardada: se les saca una de
  // su numero correlativo, que es lo unico que las distingue.
  const sufijo = texto(c.sufijo, 4).toUpperCase() || letraDeOrden((entero(c.numero, 1, 9999999, 1)) - 1);
  return `${fecha.replace(/-/g, '')}-${sufijo}`;
}

// --- La cotizacion ---

export function limpiarCotizacion(cotizacion) {
  const c = cotizacion || {};
  const lineas = lineasValidas(c.lineas);
  const itbisPorciento = entero(c.itbisPorciento, 0, MAX_ITBIS, 0);
  return {
    // La fecha que sale en el papel se puede cambiar: a veces se escribe la cotizacion el lunes
    // de algo que se hablo el viernes, y la fecha que importa es la del acuerdo.
    fecha: fechaValida(c.fecha) ? c.fecha : hoyISO(),
    cliente: texto(c.cliente, 120),
    // La linea de debajo del nombre del cliente: pais, ciudad o direccion. En el modelo es
    // "Republica Dominicana".
    clienteDireccion: texto(c.clienteDireccion, 160),
    clienteTelefono: texto(c.clienteTelefono, 40).replace(/[^\d+\-() ]/g, ''),
    vendedor: texto(c.vendedor, 80),
    validezDias: entero(c.validezDias, 1, MAX_VALIDEZ, VALIDEZ_POR_DEFECTO),
    condicionPago: texto(c.condicionPago, 120),
    itbisPorciento,
    // Por defecto, incluido: los precios del catalogo son los finales. Una tienda que escriba
    // sus precios sin impuesto lo apaga en Ajustes.
    itbisIncluido: c.itbisIncluido !== false,
    moneda: MONEDAS.includes(c.moneda) ? c.moneda : '',
    nota: texto(c.nota, MAX_NOTA),
    estado: VALORES.has(c.estado) ? c.estado : 'borrador',
    lineas,
    total: totalDeCotizacion(lineas, itbisPorciento, c.itbisIncluido !== false),
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
// Vive en los ajustes y no en el codigo porque es justo lo que cambia de una tienda a otra: la
// razon social, el nombre de quien firma, cuanto aguanta un precio, como se cobra y si se
// factura ITBIS. Una copia de esta tienda vendida a otro cliente se cotiza con SUS datos sin
// tocar un archivo.
export function ajustesDeCotizacion(settings) {
  const c = (settings && settings.cotizacion) || {};
  return {
    razonSocial: texto(c.razonSocial, 120),
    vendedor: texto(c.vendedor, 80),
    validezDias: entero(c.validezDias, 1, MAX_VALIDEZ, VALIDEZ_POR_DEFECTO),
    condicionPago: texto(c.condicionPago, 120),
    itbisPorciento: entero(c.itbisPorciento, 0, MAX_ITBIS, 0),
    itbisIncluido: c.itbisIncluido !== false,
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
    clienteDireccion: '',
    clienteTelefono: '',
    vendedor: base.vendedor,
    validezDias: base.validezDias,
    condicionPago: base.condicionPago,
    itbisPorciento: base.itbisPorciento,
    itbisIncluido: base.itbisIncluido,
    moneda: '',
    nota: base.nota,
    estado: 'borrador',
    // Si la tienda factura ITBIS, el renglon nace marcado: lo normal es que todo lleve impuesto
    // y la excepcion sea quitarlo, no al reves.
    lineas: [nuevaLinea({ itbis: base.itbisPorciento > 0 })],
  };
}

// --- Los datos que van impresos en la cabecera del papel ---
//
// Salen de los ajustes, no del codigo: el logo, el nombre y la direccion son los de la tienda
// que cotiza. Sin logo se imprime solo el nombre, y sin direccion no se imprime esa linea.
export function datosDePapel(settings, cotizacion) {
  const s = settings || {};
  const n = s.negocio || {};
  const base = ajustesDeCotizacion(s);
  const elegida = cotizacion && MONEDAS.includes(cotizacion.moneda) ? cotizacion.moneda : '';
  return {
    tienda: texto(s.storeName, 80) || 'Tienda',
    // La razon social es la que firma contratos y no siempre es el nombre comercial: "Synaptic
    // Tech" en el rotulo, "Synaptic Tech SRL" en el papel. Si no se ha puesto, no se inventa.
    razonSocial: base.razonSocial,
    logo: texto(s.logo, 600),
    direccion: texto(n.direccion, 160),
    rnc: texto(n.rnc, 30),
    telefono: texto(s.whatsapp, 40),
    correo: texto(n.correo, 120),
    // La moneda de la cotizacion manda sobre la de la tienda: se cotizan equipos importados en
    // dolares aunque la tienda venda en pesos.
    moneda: elegida || texto(s.currency, 8) || 'RD$',
    color: texto(s.colorMarca, 20),
  };
}
