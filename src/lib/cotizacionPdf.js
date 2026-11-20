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

import { limpiarCotizacion, numeroVisible, datosDePapel } from './cotizacion';
import { telefonoVisible } from './texto';

// La paleta del documento. Azul marino y azul, que es lo que se espera de un papel de negocio y
// lo que tenia el modelo. No se usa el color de marca de la tienda: una cotizacion con la banda
// en el color corporativo de turno —un verde lima, un fucsia— deja de leerse como un documento
// formal, y aqui el que mira es un cliente decidiendo si gasta dinero.
const MARINO = [23, 37, 66];
const AZUL = [37, 99, 235];
const TINTA = [31, 41, 55];
const GRIS = [107, 114, 128];
const LINEA = [209, 213, 219];
const BLANCO = [255, 255, 255];

const ANCHO = 595.28;
const ALTO = 841.89;
const M = 40;
const DER = ANCHO - M;
const ANCHO_UTIL = DER - M;
const BANDA = 112;

// Las cuatro columnas de la tabla. La de descripcion se queda con lo que sobra, porque es la
// unica cuyo contenido no se sabe de antemano.
const COL_CANT = 70;
const COL_PRECIO = 85;
const COL_TOTAL = 85;
const X0 = M;
const X1 = DER - COL_TOTAL - COL_PRECIO - COL_CANT;
const X2 = DER - COL_TOTAL - COL_PRECIO;
const X3 = DER - COL_TOTAL;
const X4 = DER;

const ALTO_FILA = 22;
// Hasta donde se estira la tabla con filas vacias. El modelo las tiene: una cotizacion de dos
// renglones y otra de ocho ocupan el mismo sitio en la hoja y las dos parecen el mismo
// documento. Tambien deja claro que no falta nada debajo.
const PISO_TABLA = 612;
// Lo que se reserva abajo para el pie y las firmas. Si una fila no cabe por encima de esta
// marca, se pasa de pagina.
const RESERVA_PIE = 190;

const fechaLarga = (iso) => {
  const [a, m, d] = String(iso || '').split('-');
  return a && m && d ? `${d}/${m}/${a}` : '';
};

// Centavos solo cuando los hay: "RD$37,500" se lee mejor que "RD$37,500.00", y un precio con
// centavos de verdad no se pierde.
function plata(valor, moneda) {
  const n = Number(valor) || 0;
  const centavos = Math.round(n * 100) % 100 !== 0;
  return `${moneda}${n.toLocaleString('es-DO', { minimumFractionDigits: centavos ? 2 : 0, maximumFractionDigits: 2 })}`;
}

// El tamaño mas grande que quepa en el ancho que se le da. El nombre de la tienda comparte
// renglon con el numero de cotizacion, y en una tienda que se llame "Importaciones y Servicios
// del Caribe" el titulo no puede montarse encima del numero.
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
    // Un logo de 2000px no tiene por que viajar entero dentro del PDF: ocupa 44 puntos
    // impresos, y 200px de lado sobran incluso para una imprenta.
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

function banda(doc, papel, numero, logo) {
  doc.setFillColor(...MARINO);
  doc.rect(0, 0, ANCHO, BANDA, 'F');

  let xNombre = M;
  if (logo) {
    // Una baldosa blanca debajo del logo, siempre. La mayoria de los logos que sube una tienda
    // son JPEG, que no tiene transparencia: pegado directo sobre el azul marino saldria un
    // recuadro blanco con cantos duros. Sobre la baldosa redondeada parece lo que es, una
    // marca puesta en su sitio, y un PNG transparente tambien queda bien encima.
    const lado = 52;
    doc.setFillColor(...BLANCO);
    doc.roundedRect(M, 30, lado, lado, 6, 6, 'F');
    const hueco = lado - 10;
    const escala = Math.min(hueco / logo.ancho, hueco / logo.alto);
    const w = logo.ancho * escala;
    const h = logo.alto * escala;
    doc.addImage(logo.datos, 'PNG', M + (lado - w) / 2, 30 + (lado - h) / 2, w, h);
    xNombre = M + lado + 14;
  }

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLANCO);
  doc.setFontSize(17);
  const titulo = `COTIZACIÓN #${numero}`;
  const anchoTitulo = doc.getTextWidth(titulo);
  doc.text(titulo, DER, 62, { align: 'right' });

  encajar(doc, papel.tienda, DER - anchoTitulo - xNombre - 20, 17, 9);
  doc.text(papel.tienda, xNombre, 56);
}

function cabecera(doc, papel, cotizacion) {
  // Columna izquierda: quien cotiza. En mayusculas y pequeño, como en el modelo: es el
  // membrete, no tiene que competir con nada.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS);
  let y = BANDA + 26;
  // La direccion en mayusculas, como el membrete del modelo. El correo NO: una direccion de
  // correo en mayusculas se lee como un grito y ademas invita a teclearla mal.
  const tel = telefonoVisible(papel.telefono);
  const izquierda = [papel.direccion.toUpperCase(), papel.rnc ? `RNC: ${papel.rnc}` : '', tel ? `TEL. ${tel}` : '', papel.correo].filter(Boolean);
  for (const dato of izquierda) {
    for (const linea of doc.splitTextToSize(dato, 250)) {
      doc.text(linea, M, y);
      y += 10;
    }
  }

  // Columna derecha: los tres datos de este papel concreto. Etiqueta pequeña en azul encima del
  // valor, las dos alineadas al borde derecho para que formen una columna limpia.
  const filas = [['FECHA', fechaLarga(cotizacion.fecha)], ['VENDEDOR', cotizacion.vendedor.toUpperCase()], ['CLIENTE', cotizacion.cliente.toUpperCase()]];
  let yd = BANDA + 22;
  for (const [etiqueta, valor] of filas) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...AZUL);
    doc.setCharSpace(0.6);
    doc.text(etiqueta, DER, yd, { align: 'right' });
    doc.setCharSpace(0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...TINTA);
    doc.text(encogido(doc, valor || '—', 230), DER, yd + 12, { align: 'right' });
    yd += 25;
  }
  if (cotizacion.clienteTelefono) {
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(cotizacion.clienteTelefono, DER, yd - 2, { align: 'right' });
  }

  const reglaY = Math.max(y, yd) + 10;
  doc.setDrawColor(...AZUL);
  doc.setLineWidth(1.4);
  doc.line(M, reglaY, DER, reglaY);
  return reglaY + 20;
}

// Un valor demasiado largo se recorta con puntos suspensivos en vez de desbordar la columna: el
// nombre de un cliente puede venir con razon social entera.
function encogido(doc, texto, maxAncho) {
  if (doc.getTextWidth(texto) <= maxAncho) return texto;
  let corte = texto;
  while (corte.length > 4 && doc.getTextWidth(`${corte}…`) > maxAncho) corte = corte.slice(0, -1);
  return `${corte}…`;
}

function cabeceraDeTabla(doc, y) {
  doc.setFillColor(...AZUL);
  doc.rect(X0, y, ANCHO_UTIL, ALTO_FILA, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BLANCO);
  doc.setCharSpace(0.4);
  doc.text('PRODUCTO', X0 + 8, y + 14);
  doc.text('CANTIDAD', (X1 + X2) / 2, y + 14, { align: 'center' });
  doc.text('PRECIO', X3 - 8, y + 14, { align: 'right' });
  doc.text('TOTAL', X4 - 8, y + 14, { align: 'right' });
  doc.setCharSpace(0);
  return y + ALTO_FILA;
}

// El marco de una fila: los dos bordes laterales, las tres divisiones internas y la raya de
// abajo. Se dibuja fila a fila en vez de una rejilla entera al final porque asi el salto de
// pagina no deja ningun borde a medias.
function marco(doc, y, altura) {
  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.5);
  for (const x of [X0, X1, X2, X3, X4]) doc.line(x, y, x, y + altura);
  doc.line(X0, y + altura, X4, y + altura);
}

function filas(doc, cotizacion, moneda, yInicial) {
  let y = yInicial;
  for (const linea of cotizacion.lineas) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const partes = doc.splitTextToSize(linea.descripcion, X1 - X0 - 16);
    const altura = Math.max(ALTO_FILA, partes.length * 11 + 10);
    if (y + altura > ALTO - RESERVA_PIE) {
      doc.addPage();
      y = cabeceraDeTabla(doc, M + 20);
    }
    doc.setTextColor(...TINTA);
    partes.forEach((parte, i) => doc.text(parte, X0 + 8, y + 14 + i * 11));
    doc.text(String(linea.cantidad), (X1 + X2) / 2, y + 14, { align: 'center' });
    doc.text(plata(linea.precio, moneda), X3 - 8, y + 14, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(plata(linea.cantidad * linea.precio, moneda), X4 - 8, y + 14, { align: 'right' });
    marco(doc, y, altura);
    y += altura;
  }
  // Filas vacias hasta el piso, para que todas las cotizaciones ocupen la hoja igual.
  while (y + ALTO_FILA <= PISO_TABLA && y + ALTO_FILA <= ALTO - RESERVA_PIE) {
    marco(doc, y, ALTO_FILA);
    y += ALTO_FILA;
  }
  return y;
}

function total(doc, cotizacion, moneda, y) {
  const altura = 26;
  doc.setFillColor(...AZUL);
  doc.rect(X0, y, ANCHO_UTIL, altura, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLANCO);
  doc.setFontSize(10);
  doc.text('Total', X3 - 8, y + 17, { align: 'right' });
  doc.setFontSize(11.5);
  doc.text(plata(cotizacion.total, moneda), X4 - 8, y + 17, { align: 'right' });
  return y + altura;
}

function pie(doc, cotizacion, y) {
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(8.5);
  doc.setTextColor(...TINTA);
  doc.text(`Cotización válida por ${cotizacion.validezDias} ${cotizacion.validezDias === 1 ? 'día' : 'días'}*`, M, y + 26);

  if (cotizacion.nota) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GRIS);
    let yn = y + 44;
    for (const linea of doc.splitTextToSize(cotizacion.nota, ANCHO_UTIL)) {
      // Si la nota fuese tan larga que llegase a las firmas, se corta: el papel con dos firmas
      // y sin sitio para escribirlas no sirve de nada.
      if (yn > ALTO - 118) break;
      doc.text(linea, M, yn);
      yn += 11;
    }
  }

  // Las firmas, a una altura fija desde abajo. En el modelo estan al pie de la hoja, y ahi es
  // donde las busca quien va a firmar.
  const yFirma = ALTO - 92;
  doc.setDrawColor(...TINTA);
  doc.setLineWidth(0.7);
  doc.line(62, yFirma, 250, yFirma);
  doc.line(345, yFirma, 533, yFirma);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...TINTA);
  doc.text('Firma de Cliente', 156, yFirma + 14, { align: 'center' });
  doc.text('Firma de Vendedor', 439, yFirma + 14, { align: 'center' });
}

// Numero de pagina, solo cuando hay mas de una. En una cotizacion de una hoja seria ruido; en
// una de tres, saber que no falta ninguna es parte del documento.
function paginas(doc) {
  const total_ = doc.getNumberOfPages();
  if (total_ < 2) return;
  for (let i = 1; i <= total_; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRIS);
    doc.text(`Página ${i} de ${total_}`, DER, ALTO - 28, { align: 'right' });
  }
}

export function nombreDeArchivo(cotizacion, papel) {
  const limpio = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const cliente = limpio(cotizacion.cliente);
  const tienda = limpio(papel.tienda);
  return `Cotizacion-${numeroVisible(cotizacion.numero)}${cliente ? `-${cliente}` : ''}${tienda ? `-${tienda}` : ''}.pdf`;
}

// El PDF como blob, listo para descargar o compartir.
export async function pdfDeCotizacion(cotizacionCruda, settings) {
  const cotizacion = { ...limpiarCotizacion(cotizacionCruda), numero: cotizacionCruda.numero };
  const papel = datosDePapel(settings);
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), cargarLogo(papel.logo)]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  banda(doc, papel, numeroVisible(cotizacion.numero), logo);
  const yTabla = cabecera(doc, papel, cotizacion);
  const yFilas = cabeceraDeTabla(doc, yTabla);
  const yFin = filas(doc, cotizacion, papel.moneda, yFilas);
  pie(doc, cotizacion, total(doc, cotizacion, papel.moneda, yFin));
  paginas(doc);

  doc.setProperties({ title: `Cotización #${numeroVisible(cotizacion.numero)}`, subject: `Cotización para ${cotizacion.cliente}`, creator: papel.tienda });
  return { blob: doc.output('blob'), nombre: nombreDeArchivo(cotizacion, papel) };
}

// Si este navegador sabe pasarle un archivo a otra aplicacion. Se pregunta para poder ETIQUETAR
// el boton con la verdad —"Compartir" o "Descargar"—, en vez de prometer una cosa y hacer otra.
export function puedeCompartirArchivos() {
  try {
    if (typeof File !== 'function' || typeof navigator === 'undefined' || !navigator.canShare) return false;
    return navigator.canShare({ files: [new File([new Blob()], 'x.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}

// Entregar el archivo al dueño.
//
// Primero se intenta la hoja de compartir del sistema, y no por gusto: desde un iPhone esto se
// usa para mandarle la cotizacion al cliente por WhatsApp, y compartir el archivo es UN toque.
// La descarga en Safari de iOS, en cambio, acaba en una carpeta que hay que ir a buscar.
//
// Si el navegador no sabe compartir archivos —o la persona cierra la hoja—, se descarga. Las dos
// vias terminan con un PDF de verdad en la mano.
//
// Recibe el blob ya hecho en vez de la cotizacion: la vista previa YA lo genero para enseñarlo,
// y volver a dibujarlo al pulsar "Descargar" seria rehacer un trabajo que ya esta hecho —y, peor,
// dejar que lo descargado pudiera no ser exactamente lo que se acaba de mirar.
export async function entregarArchivo(blob, nombre) {
  const archivo = typeof File === 'function' ? new File([blob], nombre, { type: 'application/pdf' }) : null;
  if (archivo && navigator.canShare && navigator.canShare({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre });
      return 'compartido';
    } catch (e) {
      // Cancelar la hoja de compartir no es un error que haya que contarle a nadie, pero
      // tampoco hay que descargar el archivo a su espalda: ya dijo que no.
      if (e && e.name === 'AbortError') return 'cancelado';
    }
  }
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
  return 'descargado';
}
