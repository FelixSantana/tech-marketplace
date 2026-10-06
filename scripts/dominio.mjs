// De donde sale el dominio absoluto que lleva el HTML de la portada.
//
// WhatsApp, Facebook y Google exigen URLs absolutas en og:url, og:image y canonical: no existe
// forma de escribirlas relativas. Y como este repositorio sirve a varias tiendas —un proyecto de
// Vercel por cliente, todos apuntando aqui—, el dominio no puede quedar escrito en el codigo: la
// vista previa de la tienda de cada cliente anunciaria el dominio del primero, y su portada
// declararia como canonica la de otro negocio, que para Google es pedirle que no la indexe.
//
// Vercel expone el dominio al compilar. Por orden de preferencia:
//
//   1. TIENDA_URL — escape manual. Mismo nombre que ya usa scripts/renombrar-catalogo.mjs. Hace
//      falta cuando el proyecto tiene apagado "Enable access to System Environment Variables",
//      porque eso deja vacias las dos siguientes.
//   2. VERCEL_PROJECT_PRODUCTION_URL — el dominio de produccion del proyecto: el dominio propio
//      del cliente si ya lo conectó (Vercel elige el mas corto) y si no el *.vercel.app. Viene
//      puesto incluso en los despliegues de vista previa, y eso es deseable: la preview declara
//      como canonica la URL de produccion en vez de competir con ella en el indice de Google.
//   3. VERCEL_URL — el dominio de ESTE despliegue, distinto en cada push. Solo ultimo recurso:
//      serviria como canonica una URL que manana ya no es la de la tienda.
//
// Si no hay ninguna, devuelve '' y el llamador quita las etiquetas. Una tienda sin vista previa
// molesta menos que una tienda que anuncia el dominio de otra.

const FUENTES = ['TIENDA_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL'];

function normalizar(valor) {
  const crudo = String(valor == null ? '' : valor).trim();
  if (!crudo) return '';
  // Las variables de Vercel vienen sin esquema ("mi-tienda.vercel.app"); TIENDA_URL la escribe
  // una persona y puede traerlo.
  const conEsquema = /^https?:\/\//i.test(crudo) ? crudo : `https://${crudo}`;
  let url;
  try {
    url = new URL(conEsquema);
  } catch {
    return '';
  }
  // Un host sin punto no es un dominio publico (localhost, un valor a medio escribir). Se
  // descarta aqui para que no acabe dentro de un og:url que un rastreador no podria resolver.
  if (!url.hostname.includes('.')) return '';
  // Solo el origen: una ruta o una barra final sobrante duplicaria la barra al concatenar
  // ("https://tienda.com//og-image.jpg").
  return url.origin;
}

export function resolverOrigen(env = {}) {
  for (const nombre of FUENTES) {
    const origen = normalizar(env[nombre]);
    if (origen) return origen;
  }
  return '';
}

// El marcador que lleva index.html donde iria el dominio.
export const MARCADOR = '__ORIGEN__';

// Una etiqueta <link> o <meta> con el marcador dentro, ella sola en su linea. Cada una de esas
// etiquetas en index.html ocupa una linea completa, asi que al no conocerse el dominio se quita
// la linea entera —salto incluido— y no queda un hueco en blanco en el HTML.
const LINEA_CON_MARCADOR = new RegExp(`^[ \\t]*<(?:link|meta)\\b[^>]*${MARCADOR}[^>]*>[ \\t]*\\r?\\n`, 'gm');

// Parte el HTML en trozos alternos: los pares son HTML de verdad, los impares comentarios. El
// grupo de captura de la expresion es lo que hace que split conserve los comentarios en medio.
//
// Los comentarios se dejan intactos a proposito. El de index.html nombra el marcador para
// explicar de donde sale el dominio, y sustituirlo ahi dejaria una frase absurda en el HTML
// publicado: "https://la-tienda.com lo sustituye el build por el dominio del despliegue".
const trozosDeHtml = (html) => html.split(/(<!--[\s\S]*?-->)/);

// Deja el HTML listo: con dominio, lo sustituye; sin dominio, borra las etiquetas que lo
// necesitaban. Si al terminar queda algun marcador fuera de un comentario es que una etiqueta
// nueva no sigue el formato de una por linea: se corta el build en vez de publicar un
// "__ORIGEN__" literal, que WhatsApp mostraria tal cual en la vista previa.
export function aplicarOrigen(html, origen) {
  const trozos = trozosDeHtml(html).map((trozo, i) => {
    if (i % 2) return trozo;
    return origen ? trozo.replaceAll(MARCADOR, origen) : trozo.replace(LINEA_CON_MARCADOR, '');
  });
  const sinComentarios = trozos.filter((_, i) => i % 2 === 0).join('');
  if (sinComentarios.includes(MARCADOR)) {
    throw new Error(
      `index.html: quedo un ${MARCADOR} sin resolver. Cada etiqueta que lo use tiene que ir sola en su linea.`,
    );
  }
  return trozos.join('');
}

// --- el nombre de la tienda en index.html ---
//
// Mismo problema que el dominio y la misma solucion, pero con una diferencia que importa: el
// nombre SI vive en Ajustes, y aun asi aqui no sirve de nada. El titulo, og:site_name y og:title
// de la portada se resuelven al COMPILAR, y Ajustes esta en la base de datos, que solo se lee al
// EJECUTAR. Un rastreador que no ejecuta JavaScript —WhatsApp, y Google en la primera pasada— ve
// lo que diga el HTML y nada mas.
//
// Al compartir un PRODUCTO no pasa: /p/<slug> lo sirve una funcion que reescribe esas etiquetas
// con el nombre real. Es solo la portada la que necesita saberlo antes de tiempo.
//
// Por eso hay una variable de entorno. Es configuracion del proyecto en Vercel, no codigo: montar
// la tienda de un cliente sigue sin tocar el repositorio.
export const MARCADOR_NOMBRE = '__NOMBRE__';

// El mismo marcador de posicion que usa el resto de la tienda (src/lib/tienda.js). Duplicado por
// lo mismo: esto corre en el build, no en el navegador.
export const NOMBRE_POR_DEFECTO = 'Mi tienda';

export function resolverNombre(env = {}) {
  return String(env.TIENDA_NOMBRE == null ? '' : env.TIENDA_NOMBRE).trim() || NOMBRE_POR_DEFECTO;
}

// El nombre lo escribe una persona en un panel de Vercel y acaba dentro de atributos HTML. Un
// apostrofo en "Casa D'Alba" o un & en "Perez & Hijos" romperian la etiqueta sin escapar.
const escaparHtml = (v) => String(v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function aplicarNombre(html, nombre) {
  return html.replaceAll(MARCADOR_NOMBRE, escaparHtml(nombre || NOMBRE_POR_DEFECTO));
}
