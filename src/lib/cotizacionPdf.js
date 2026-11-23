// El PDF de la cotizacion, dibujado en el navegador.
//
// Se dibuja aqui y no en el servidor por dos razones. Una: el plan de Vercel de esta tienda
// permite 12 funciones y ya hay 12, asi que una ruta nueva para esto habria obligado a fusionar
// dos de las que ya estan. Dos: dibujarlo en el navegador es gratis —no hay viaje de ida y
// vuelta, no hay nada que pueda caerse en produccion— y el archivo sale del telefono del dueño
// listo para mandarlo por WhatsApp.
//
// jsPDF entra por `import()` dinamico a proposito: asi queda en su propio trozo y NO viaja en lo
// que descarga un visitante de la tienda, que es quien no va a cotizar nunca. Pesa mas que todo
// el resto de la aplicacion junta y solo lo necesita el dueño.
//
// El texto va en Helvetica, la fuente que jsPDF ya trae: cubre los acentos y la eñe
// (COTIZACIÓN, Bendición, año) sin incrustar ninguna fuente, que son cientos de kilobytes mas.

import { limpiarCotizacion, numeroDeCotizacion, vencimientoDe, cuentasDeCotizacion, datosDePapel } from './cotizacion';
import { telefonoVisible } from './texto';
import { normalizarColor, conLuz, tintaSobre, COLOR_POR_DEFECTO } from './color';

// --- Color ---
//
// La barra de la tabla y la raya del total van en el color de la tienda, no en un azul fijo.
// Se usa el MISMO tono oscuro que la barra superior del sitio (`conLuz(color, 0.20)`), asi que
// la cotizacion y la tienda se reconocen como la misma casa, y una copia vendida a otro cliente
// sale con su color sin tocar un archivo.
//
// Oscuro y no el acento puro: un documento de negocio con una barra en fucsia o verde lima deja
// de leerse como un documento. Bajarle la luz convierte cualquier color de marca en algo que
// aguanta llevar texto encima y parecer formal.
const COLOR_DE_BARRA = 0.2;

const aRgb = (hex) => {
  const n = normalizarColor(hex) || COLOR_POR_DEFECTO;
  return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)];
};

const TINTA = [31, 41, 55];
const GRIS = [120, 126, 138];
const LINEA = [226, 228, 233];

const ANCHO = 595.28;
const ALTO = 841.89;
const M = 44;
const DER = ANCHO - M;
const UTIL = DER - M;

// Las seis columnas del modelo. CONCEPTO se lleva casi la mitad porque es la unica cuyo
// contenido no se sabe de antemano: un concepto como "Licencias Enterprise (Operadores)
// MaintainX (1 año)" tiene que caber en un renglon. Las cinco de numeros se quedan con lo justo
// —"4,900.00" ocupa 42 puntos— en vez de repartir el ancho a partes iguales.
const ANCHOS = { concepto: 236, cantidad: 47, precio: 56, total: 56, itbis: 56 };
const X = (() => {
  const c = [M];
  for (const k of ['concepto', 'cantidad', 'precio', 'total', 'itbis']) c.push(c[c.length - 1] + ANCHOS[k]);
  c.push(DER);
  return c;
})();

const ALTO_CABECERA = 24;
// Las cifras se escriben a 8.5 y con 6 puntos de aire a cada lado: con eso "1,234,567.89" entra
// en su columna sin rozar la de al lado. Medido, no estimado.
const TAM_CIFRA = 8.5;
const PAD_CIFRA = 6;
const ALTO_FILA = 30;
const RESERVA_PIE = 150;
const PAD = 8;

const fechaLarga = (iso) => {
  const [a, m, d] = String(iso || '').split('-');
  return a && m && d ? `${d}/${m}/${a}` : '';
};

// Siempre con dos decimales y sin simbolo, como el modelo: la moneda se dice una sola vez, en
// la linea del total. Repetir "RD$" en treinta celdas no informa de nada y ensucia la columna.
const cifra = (valor) => Number(valor || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Una cifra pegada al borde derecho de su columna, encogida si hiciera falta.
//
// El tamaño esta medido para que un millon largo quepa, pero nada impide cotizar algo que lo
// pase. Antes que dejar que dos columnas se monten —que es lo que convierte un documento en
// algo que no se puede mandar—, esa cifra sale un punto mas pequeña.
function cifraEnColumna(doc, valor, xDerecha, ancho, y) {
  const texto = typeof valor === 'string' ? valor : cifra(valor);
  for (let tam = TAM_CIFRA; tam >= 6.5; tam -= 0.5) {
    doc.setFontSize(tam);
    if (doc.getTextWidth(texto) <= ancho - PAD_CIFRA * 2) break;
  }
  doc.text(texto, xDerecha - PAD_CIFRA, y, { align: 'right' });
  doc.setFontSize(TAM_CIFRA);
}

function encajar(doc, texto, maxAncho, tamMax, tamMin) {
  for (let tam = tamMax; tam > tamMin; tam -= 0.5) {
    doc.setFontSize(tam);
    if (doc.getTextWidth(texto) <= maxAncho) return tam;
  }
  doc.setFontSize(tamMin);
  return tamMin;
}

// El logo de los ajustes, convertido a algo que jsPDF sepa pegar.
//
// Se pasa por un lienzo en vez de mandarle el archivo tal cual porque asi da igual que la tienda
// haya subido un JPEG, un PNG o un WEBP. El lienzo se alimenta de un blob: propio, no de la URL
// del almacen: una imagen de otro dominio ensucia el lienzo y toDataURL deja de funcionar.
//
// Devuelve null ante cualquier problema. Un logo que no carga no puede impedir que salga la
// cotizacion: se imprime solo el nombre de la tienda.
async function cargarLogo(url) {
  if (!url) return null;
  let objectUrl = '';
  try {
    const respuesta = await fetch(url, { mode: 'cors' });
    if (!respuesta.ok) return null;
    const blob = await respuesta.blob();
    if (!String(blob.type).startsWith('image/')) return null;
    objectUrl = URL.createObjectURL(blob);
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('LOGO'));
      el.src = objectUrl;
    });
    const lado = Math.max(img.naturalWidth, img.naturalHeight) || 1;
    const escala = Math.min(1, 200 / lado);
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round(img.naturalWidth * escala));
    lienzo.height = Math.max(1, Math.round(img.naturalHeight * escala));
    lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
    return { datos: lienzo.toDataURL('image/png'), ancho: lienzo.width, alto: lienzo.height };
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

// --- Cabecera: quien cotiza (izquierda) ---
function membrete(doc, papel, logo) {
  let y = 72;
  let xNombre = M;
  if (logo) {
    // Sin baldosa: aqui el fondo es blanco, asi que un JPEG con fondo blanco se funde solo y un
    // PNG transparente tambien. La baldosa era necesaria cuando el logo iba sobre azul marino.
    const alto = 42;
    const ancho = Math.min(120, (logo.ancho / logo.alto) * alto);
    doc.addImage(logo.datos, 'PNG', M, 38, ancho, alto);
    xNombre = M + ancho + 12;
  }
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TINTA);
  encajar(doc, papel.tienda, 250 - (xNombre - M), 19, 10);
  doc.text(papel.tienda, xNombre, y);

  y = 104;
  const tel = telefonoVisible(papel.telefono);
  // La razon social va en negrita y la primera: es la que firma. Si no se ha puesto no se
  // inventa, y el bloque empieza directamente por la direccion.
  if (papel.razonSocial) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(papel.razonSocial, M, y);
    y += 14;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const lineas = [papel.direccion, papel.rnc ? `RNC: ${papel.rnc}` : '', tel ? `TEL: ${tel}` : '', papel.correo ? `EMAIL: ${papel.correo}` : ''].filter(Boolean);
  for (const dato of lineas) {
    for (const parte of doc.splitTextToSize(dato, 260)) {
      doc.text(parte, M, y);
      y += 13;
    }
  }
  return y;
}

// --- Cabecera: de que papel se trata (derecha) ---
function datosDelPapel(doc, cotizacion) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...TINTA);
  doc.text('COTIZACIÓN', DER, 62, { align: 'right' });

  const filas = [
    ['Cotización No:', numeroDeCotizacion(cotizacion)],
    ['Fecha de emisión:', fechaLarga(cotizacion.fecha)],
    ['Fecha de expiración:', fechaLarga(vencimientoDe(cotizacion))],
  ];
  // La condicion de pago solo sale si se escribio. Una fila con un guion no dice nada y le
  // quita sitio a las que si.
  if (cotizacion.condicionPago) filas.push(['Condición de pago:', cotizacion.condicionPago]);

  let y = 92;
  const xEtiqueta = DER - 118;
  for (const [etiqueta, valor] of filas) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRIS);
    doc.text(etiqueta, xEtiqueta, y, { align: 'right' });
    doc.setFontSize(9.5);
    doc.setTextColor(...TINTA);
    // El valor se parte si no cabe —"100% contra entrega" ocupa dos renglones en el modelo— en
    // vez de montarse encima de su propia etiqueta.
    const partes = doc.splitTextToSize(valor || '—', 112);
    partes.forEach((parte, i) => doc.text(parte, DER, y + i * 12, { align: 'right' }));
    y += 14 + (partes.length - 1) * 12;
  }
  return y;
}

function bloqueDeCliente(doc, cotizacion, y) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS);
  doc.setCharSpace(0.7);
  doc.text('CLIENTE', M, y);
  doc.setCharSpace(0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...TINTA);
  doc.text(cotizacion.cliente || '—', M, y + 16);

  let siguiente = y + 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...GRIS);
  for (const dato of [cotizacion.clienteDireccion, telefonoVisible(cotizacion.clienteTelefono) || cotizacion.clienteTelefono].filter(Boolean)) {
    siguiente += 13;
    doc.text(dato, M, siguiente);
  }
  return siguiente;
}

// --- La tabla ---
function cabeceraDeTabla(doc, y, barra, tintaBarra) {
  doc.setFillColor(...barra);
  doc.rect(M, y, UTIL, ALTO_CABECERA, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...tintaBarra);
  doc.setCharSpace(0.5);
  const titulos = ['CONCEPTO', 'CANTIDAD', 'PRECIO', 'TOTAL', 'ITBIS', 'VALOR'];
  // Centrados sobre su columna, como en el modelo.
  titulos.forEach((t, i) => doc.text(t, (X[i] + X[i + 1]) / 2, y + 15.5, { align: 'center' }));
  doc.setCharSpace(0);
  return y + ALTO_CABECERA;
}

function filas(doc, cuentas, y, barra, tintaBarra) {
  let actual = y;
  for (const linea of cuentas.lineas) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const partes = doc.splitTextToSize(linea.descripcion, ANCHOS.concepto - PAD * 2);
    const altura = Math.max(ALTO_FILA, partes.length * 11.5 + (linea.detalle ? 11 : 0) + 14);
    if (actual + altura > ALTO - RESERVA_PIE) {
      doc.addPage();
      actual = cabeceraDeTabla(doc, M + 16, barra, tintaBarra);
      // Volver a fijar la fuente del concepto: cabeceraDeTabla la deja en negrita y a 7.5, y
      // sin esto el PRIMER renglon de cada pagina nueva salia en negrita y mas pequeño que los
      // demas. Se nota solo cuando una cotizacion pasa de una hoja, que es justo cuando nadie
      // lo mira.
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
    }
    const base = actual + 17;
    doc.setTextColor(...TINTA);
    partes.forEach((parte, i) => doc.text(parte, X[0] + PAD, base + i * 11.5));
    if (linea.detalle) {
      // La linea pequeña gris: "Plazo: 1 año (12 meses)". Es la condicion que convierte un
      // precio suelto en algo que el cliente entiende.
      doc.setFontSize(7.5);
      doc.setTextColor(...GRIS);
      doc.text(doc.splitTextToSize(linea.detalle, ANCHOS.concepto - PAD * 2)[0], X[0] + PAD, base + partes.length * 11.5 - 0.5);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(TAM_CIFRA);
    doc.setTextColor(...TINTA);
    doc.text(String(linea.cantidad), (X[1] + X[2]) / 2, base, { align: 'center' });
    // La base, no el precio que se tecleo: con ITBIS incluido el precio de catalogo es el
    // final, y lo que tiene que cuadrar en el papel es PRECIO × CANTIDAD = TOTAL.
    cifraEnColumna(doc, linea.precioBase, X[3], ANCHOS.precio, base);
    cifraEnColumna(doc, linea.total, X[4], ANCHOS.total, base);
    // Guion y no "0.00" cuando la linea va exenta: un cero parece un impuesto que se calculo y
    // dio cero; el guion dice que ahi no aplica.
    cifraEnColumna(doc, linea.gravada ? cifra(linea.impuesto) : '–', X[5], ANCHOS.itbis, base);
    cifraEnColumna(doc, linea.valor, X[6], DER - X[5], base);

    // Solo una raya fina por debajo. El modelo no lleva rejilla: las columnas se leen por la
    // alineacion, y las lineas verticales solo meterian ruido.
    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.5);
    doc.line(M, actual + altura, DER, actual + altura);
    actual += altura;
  }
  return actual;
}

function totales(doc, cuentas, papel, y, barra) {
  const xEtiqueta = DER - 110;
  let actual = y + 26;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIS);
  doc.setCharSpace(0.4);
  doc.text('SUBTOTAL', xEtiqueta, actual, { align: 'right' });
  doc.setCharSpace(0);
  doc.setFontSize(10);
  doc.setTextColor(...TINTA);
  doc.text(cifra(cuentas.subtotal), DER, actual, { align: 'right' });

  actual += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIS);
  doc.setCharSpace(0.4);
  // Con tasa se dice cual: "ITBIS 18%" informa; "ITBIS" a secas obliga a dividir para saberlo.
  doc.text(cuentas.tasa > 0 ? `ITBIS ${cuentas.tasa}%` : 'ITBIS', xEtiqueta, actual, { align: 'right' });
  doc.setCharSpace(0);
  doc.setFontSize(10);
  doc.setTextColor(...TINTA);
  doc.text(cifra(cuentas.itbis), DER, actual, { align: 'right' });

  actual += 12;
  doc.setDrawColor(...barra);
  doc.setLineWidth(1.2);
  doc.line(DER - 230, actual, DER, actual);

  actual += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...TINTA);
  doc.setCharSpace(0.3);
  doc.text(`TOTAL ${papel.moneda}`, xEtiqueta, actual, { align: 'right' });
  doc.setCharSpace(0);
  doc.setFontSize(13);
  doc.text(cifra(cuentas.total), DER, actual, { align: 'right' });

  // Decirlo cuando el impuesto va por dentro. Sin esta linea el cliente ve 4,661.02 en la
  // columna del precio donde la tienda publica 5,500, y lo normal es pensar que hay un error.
  if (cuentas.tasa > 0 && cuentas.incluido) {
    actual += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text('Precios con ITBIS incluido.', DER, actual, { align: 'right' });
  }
  return actual;
}

function nota(doc, cotizacion, y) {
  if (!cotizacion.nota) return y;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRIS);
  let actual = y + 30;
  for (const linea of doc.splitTextToSize(cotizacion.nota, UTIL - 180)) {
    if (actual > ALTO - 50) break;
    doc.text(linea, M, actual);
    actual += 10.5;
  }
  return actual;
}

// Numero de pagina, solo cuando hay mas de una. En una cotizacion de una hoja seria ruido; en
// una de tres, saber que no falta ninguna es parte del documento.
function paginas(doc) {
  const cuantas = doc.getNumberOfPages();
  if (cuantas < 2) return;
  for (let i = 1; i <= cuantas; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text(`Página ${i} de ${cuantas}`, DER, ALTO - 28, { align: 'right' });
  }
}

export function nombreDeArchivo(cotizacion, papel) {
  const limpio = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const cliente = limpio(cotizacion.cliente);
  const tienda = limpio(papel.tienda);
  return `Cotizacion-${numeroDeCotizacion(cotizacion)}${cliente ? `-${cliente}` : ''}${tienda ? `-${tienda}` : ''}.pdf`;
}

// El PDF como blob, listo para descargar o compartir.
export async function pdfDeCotizacion(cotizacionCruda, settings) {
  const cotizacion = { ...limpiarCotizacion(cotizacionCruda), numero: cotizacionCruda.numero, sufijo: cotizacionCruda.sufijo };
  const papel = datosDePapel(settings, cotizacion);
  const cuentas = cuentasDeCotizacion(cotizacion);
  // El tono oscuro del color de la tienda, y encima la tinta que mas contraste da sobre el.
  // Se mide, no se da por hecho que sea blanca: un dueño puede poner un amarillo cuya version
  // oscura siga siendo bastante clara, y ahi el texto tiene que ser negro.
  const hexBarra = conLuz(normalizarColor(papel.color) || COLOR_POR_DEFECTO, COLOR_DE_BARRA) || COLOR_POR_DEFECTO;
  const barra = aRgb(hexBarra);
  const tintaBarra = aRgb(tintaSobre(hexBarra));

  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), cargarLogo(papel.logo)]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  const finIzquierda = membrete(doc, papel, logo);
  const finDerecha = datosDelPapel(doc, cotizacion);
  const finCliente = bloqueDeCliente(doc, cotizacion, Math.max(finIzquierda, finDerecha) + 20);
  const yTabla = cabeceraDeTabla(doc, finCliente + 24, barra, tintaBarra);
  const finTabla = filas(doc, cuentas, yTabla, barra, tintaBarra);
  nota(doc, cotizacion, totales(doc, cuentas, papel, finTabla, barra));
  paginas(doc);

  doc.setProperties({ title: `Cotización ${numeroDeCotizacion(cotizacion)}`, subject: `Cotización para ${cotizacion.cliente}`, creator: papel.tienda });
  return { blob: doc.output('blob'), nombre: nombreDeArchivo(cotizacion, papel) };
}

// Descargar el archivo, sin preguntar nada.
//
// Antes se intentaba primero la hoja de compartir del sistema, pensando en mandarlo por
// WhatsApp de un toque desde el telefono. En Windows esa hoja es una ventana enorme con Teams,
// Outlook, OneDrive y una lista de contactos: cuatro clics y un susto para algo que se pedia en
// uno. Se quito. Quien quiera compartirlo lo comparte desde el archivo ya descargado, que es lo
// que hace todo el mundo.
export function descargarArchivo(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Se revoca con holgura: revocar en el mismo tiro deja a algunos navegadores sin nada que
  // descargar.
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// Pintar el PDF en una pestaña que YA esta abierta.
//
// La pestaña tiene que abrirla el que llama, dentro del propio clic. Si se abriera aqui —despues
// del await que genera el PDF— el navegador ya no la ve como consecuencia de un clic y la
// bloquea como ventana emergente. Por eso esta funcion recibe la pestaña vacia y solo la llena.
//
// Devuelve el nombre del archivo por si hay que caer en la descarga.
export async function abrirEnPestana(pestana, cotizacion, settings) {
  const { blob, nombre } = await pdfDeCotizacion(cotizacion, settings);
  const url = URL.createObjectURL(blob);
  if (!pestana || pestana.closed) {
    // La pestaña no se pudo abrir (bloqueador de emergentes). Antes que dejar al dueño sin su
    // cotizacion, se descarga.
    descargarArchivo(blob, nombre);
    return { nombre, abierta: false };
  }
  pestana.location = url;
  // Se corta el enlace de vuelta: la pestaña nueva no tiene por que poder tocar el panel.
  try { pestana.opener = null; } catch { /* algunos navegadores no dejan; no importa */ }
  // Se suelta a los cinco minutos. Mientras tanto la pestaña funciona —recargar despues de eso
  // la deja en blanco, y entonces se vuelve a pulsar Ver—, y asi no se acumula un PDF en
  // memoria por cada vez que se mira uno.
  setTimeout(() => URL.revokeObjectURL(url), 300000);
  return { nombre, abierta: true };
}
