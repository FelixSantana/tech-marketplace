// Las imagenes de marca que se derivan del logo del cliente: la de la vista previa al compartir
// (1200x630) y los tres iconos de la aplicacion instalable.
//
// Por que derivarlas y no pedirle cuatro imagenes al cliente: nadie tiene a mano un archivo de
// 1200x630 con su logo centrado, y pedirselo es el tipo de friccion que deja la tienda a medio
// montar para siempre. Tiene un logo; el resto se calcula.
//
// Por que en el navegador y no en el servidor: el dibujo se hace una vez, cuando el dueño sube el
// logo, y el navegador ya trae lo necesario. Hacerlo en una funcion obligaria a meter una libreria
// de imagenes en el despliegue —arranques en frio y peso— para algo que pasa dos veces al año.
//
// Este archivo separa a proposito el calculo del dibujo: las medidas son funciones puras y tienen
// pruebas, porque son donde se esconden los errores. El dibujo necesita canvas y no se puede
// probar sin navegador, asi que se mantiene lo mas tonto posible.

// La de compartir va en JPEG, no en PNG, por dos motivos: index.html declara
// og:image:type="image/jpeg" y un tipo que no coincide confunde a los rastreadores, y una foto de
// 1200x630 en PNG pesa varias veces mas sin verse mejor. Los iconos si son PNG: el manifiesto
// declara el tipo de cada uno y necesitan el fondo exacto, sin el ruido del JPEG.
export const MEDIDAS = {
  ogImage: { ancho: 1200, alto: 630, tipo: 'image/jpeg', calidad: 0.9 },
  icon192: { ancho: 192, alto: 192, tipo: 'image/png' },
  icon512: { ancho: 512, alto: 512, tipo: 'image/png' },
  iconMaskable: { ancho: 512, alto: 512, tipo: 'image/png' },
};

// Cuanto del lienzo ocupa el logo en cada una.
//
// El recortable es el mas pequeño y no por capricho: Android recorta el icono a un circulo y solo
// garantiza que se vea el 80% central. Un logo al 72% como el de los otros perderia las esquinas
// en cualquier telefono con iconos redondos.
export const OCUPACION = { ogImage: 0.52, icon192: 0.72, icon512: 0.72, iconMaskable: 0.56 };

export const FONDO = '#0a0c12';
export const TINTA = '#ffffff';

// Centra un logo dentro de una caja, ocupando como maximo `fraccion` de ella y sin deformarlo.
//
// Se permite agrandar un logo mas pequeño que la caja: un logo de 100px perdido en el centro de un
// icono de 512 se ve peor que el mismo logo algo blando pero ocupando su sitio.
export function encajar(logo, caja, fraccion = 1) {
  const ancho = Number(logo && logo.ancho) || 0;
  const alto = Number(logo && logo.alto) || 0;
  if (ancho <= 0 || alto <= 0) return { w: 0, h: 0, x: caja.ancho / 2, y: caja.alto / 2 };
  const escala = Math.min((caja.ancho * fraccion) / ancho, (caja.alto * fraccion) / alto);
  const w = ancho * escala;
  const h = alto * escala;
  return { w, h, x: (caja.ancho - w) / 2, y: (caja.alto - h) / 2 };
}

// El tamaño de letra mas grande que deja el texto dentro del ancho disponible.
//
// Recibe la funcion de medir en vez de un contexto de canvas para poder probarse sin navegador:
// medir(texto, tamaño) devuelve el ancho en pixeles.
export function fuenteQueCabe(medir, texto, anchoMax, { inicial = 64, minimo = 28, paso = 2 } = {}) {
  let tamano = inicial;
  while (tamano > minimo && medir(texto, tamano) > anchoMax) tamano -= paso;
  return tamano;
}

// Si ni en el tamaño minimo cabe, se corta por caracteres y se cierra con puntos suspensivos. Un
// nombre de tienda saliendose del borde se ve peor que un nombre recortado.
export function recortarAlAncho(medir, texto, anchoMax, tamano) {
  if (medir(texto, tamano) <= anchoMax) return texto;
  let corte = texto.length;
  while (corte > 1 && medir(`${texto.slice(0, corte).trimEnd()}…`, tamano) > anchoMax) corte -= 1;
  return `${texto.slice(0, corte).trimEnd()}…`;
}

// Donde va el logo y donde el nombre en la imagen de compartir.
//
// Con nombre, el logo se sube para dejarle sitio abajo; sin nombre, el logo va centrado y ocupa
// algo mas, porque no tiene que compartir el lienzo con nada.
export function composicionOg(logo, nombre, caja = MEDIDAS.ogImage) {
  const conNombre = !!String(nombre || '').trim();
  if (!conNombre) {
    return { logo: encajar(logo, caja, OCUPACION.ogImage + 0.1), nombre: null };
  }
  // El logo se encaja en la mitad de arriba y el nombre vive en la de abajo.
  const arriba = { ancho: caja.ancho, alto: caja.alto * 0.62 };
  const puesto = encajar(logo, arriba, OCUPACION.ogImage / 0.62);
  return {
    logo: puesto,
    nombre: { x: caja.ancho / 2, y: caja.alto * 0.78, anchoMax: caja.ancho * 0.84 },
  };
}

// --- de aqui abajo hace falta un navegador ---

const cargarImagen = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('no se pudo leer la imagen'));
  img.src = src;
});

const leerArchivo = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = (e) => resolve(e.target.result);
  r.onerror = () => reject(new Error('no se pudo leer el archivo'));
  r.readAsDataURL(file);
});

function lienzo({ ancho, alto }) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  const ctx = c.getContext('2d');
  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, ancho, alto);
  return { c, ctx };
}

function dibujarIcono(img, medida, fraccion) {
  const { c, ctx } = lienzo(medida);
  const p = encajar({ ancho: img.width, alto: img.height }, medida, fraccion);
  ctx.drawImage(img, p.x, p.y, p.w, p.h);
  return c.toDataURL(medida.tipo);
}

function dibujarOg(img, nombre) {
  const medida = MEDIDAS.ogImage;
  const { c, ctx } = lienzo(medida);
  const comp = composicionOg({ ancho: img.width, alto: img.height }, nombre);
  ctx.drawImage(img, comp.logo.x, comp.logo.y, comp.logo.w, comp.logo.h);
  if (comp.nombre) {
    // La fuente del sistema a proposito: la tienda carga Inter de Google, pero si todavia no
    // termino de cargar cuando se dibuja, el navegador sustituye por otra y el resultado cambia
    // sin avisar. Con la del sistema al menos siempre sale lo mismo.
    const familia = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    const medir = (t, tam) => { ctx.font = `700 ${tam}px ${familia}`; return ctx.measureText(t).width; };
    const tam = fuenteQueCabe(medir, nombre, comp.nombre.anchoMax);
    const texto = recortarAlAncho(medir, nombre, comp.nombre.anchoMax, tam);
    ctx.font = `700 ${tam}px ${familia}`;
    ctx.fillStyle = TINTA;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, comp.nombre.x, comp.nombre.y);
  }
  return c.toDataURL(medida.tipo, medida.calidad);
}

// Deriva las cuatro imagenes del archivo de logo que el dueño acaba de elegir.
//
// Se parte del archivo ORIGINAL, no del logo ya comprimido a 520px que se guarda en el catalogo:
// la imagen de compartir mide 1200 de ancho y agrandar desde 520 se nota.
export async function derivarDeLogo(file, nombre) {
  const img = await cargarImagen(await leerArchivo(file));
  return {
    ogImage: dibujarOg(img, nombre),
    icon192: dibujarIcono(img, MEDIDAS.icon192, OCUPACION.icon192),
    icon512: dibujarIcono(img, MEDIDAS.icon512, OCUPACION.icon512),
    iconMaskable: dibujarIcono(img, MEDIDAS.iconMaskable, OCUPACION.iconMaskable),
  };
}

// Los nombres de los cuatro campos, en el orden en que se suben. Lo usan Ajustes y la limpieza de
// huerfanas, para que agregar una imagen derivada en el futuro no obligue a tocar tres archivos.
export const CAMPOS_DE_MARCA = ['ogImage', 'icon192', 'icon512', 'iconMaskable'];
