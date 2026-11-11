// El HTML del panel, derivado del de la tienda al compilar.
//
// POR QUE EXISTE. En un iPhone los avisos de pedido solo llegan a la tienda INSTALADA en la
// pantalla de inicio; en Safari normal no hay push. Y una aplicacion instalada no tiene barra de
// direcciones: va a donde diga el start_url de su manifiesto y punto. Con un unico manifiesto de
// start_url '/', instalar desde /admin daba un icono que abria la tienda, y desde la tienda no
// hay forma de llegar al panel. El dueño quedaba encerrado.
//
// El primer intento fue cambiar el href del manifiesto desde JavaScript al cargar /admin.
// Funciona en Chrome y NO en Safari: al pulsar "Añadir a pantalla de inicio" sigue usando el
// manifiesto que leyo con el HTML, no el que hay en el DOM en ese momento. Probado en un iPhone
// de verdad, que propuso "Synaptic" en vez de "Panel".
//
// Asi que el HTML del panel sale ya correcto del servidor. Se genera al compilar a partir del de
// la tienda, no a mano: duplicar index.html significaria que cualquier cambio futuro —una
// tipografia, una etiqueta nueva— habria que acordarse de hacerlo dos veces, y nadie se acuerda.

export const ARCHIVO = 'admin.html';

// La etiqueta del manifiesto y la del titulo de iOS, con los atributos en cualquier orden.
const EL_MANIFIESTO = /<link\b[^>]*\brel=["']manifest["'][^>]*>/i;
const EL_TITULO_IOS = /<meta\b[^>]*\bname=["']apple-mobile-web-app-title["'][^>]*>/i;
const EL_HEAD = /<head\b[^>]*>/i;

export function htmlDelPanel(html) {
  if (!EL_MANIFIESTO.test(html)) {
    // Si esto falla, el panel se publicaria con el manifiesto de la tienda y el dueño volveria a
    // quedarse sin poder instalarlo, en silencio. Mejor romper el build.
    throw new Error('admin.html: no encuentro la etiqueta <link rel="manifest"> en index.html.');
  }
  if (!EL_HEAD.test(html)) throw new Error('admin.html: no encuentro <head> en index.html.');

  return html
    .replace(EL_MANIFIESTO, '<link rel="manifest" href="/manifest.webmanifest?panel=1" />')
    .replace(EL_TITULO_IOS, '<meta name="apple-mobile-web-app-title" content="Panel" />')
    // El panel no tiene nada que hacer en Google: no es contenido, y las paginas que salen en el
    // buscador invitan a que desconocidos prueben contraseñas.
    .replace(EL_HEAD, (head) => `${head}\n    <meta name="robots" content="noindex, nofollow" />`);
}
