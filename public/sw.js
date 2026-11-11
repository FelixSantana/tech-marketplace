// Trabajador de servicio a proposito minimo. Existe por un solo motivo: Chrome no ofrece
// "Instalar aplicacion" en Android si el sitio no registra uno con manejador de fetch.
//
// NO cachea nada. Un cache mal hecho es peor que no tener aplicacion instalable: deja al cliente
// mirando precios viejos y al dueño sin entender por que su cambio no se ve. La tienda necesita
// la red igual, porque el catalogo y el stock vienen del servidor en cada visita.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Solo se toca lo que sale de este mismo dominio.
//
// La version anterior reemitia TODA peticion con fetch(), incluidas las de Google Fonts. Un
// fetch hecho desde el worker ya no cuenta como carga de hoja de estilo sino como conexion, y
// nuestra politica de contenido permite conectar solo a 'self': el navegador bloqueaba la
// peticion, las tipografias no cargaban y la tienda se veia con la fuente del sistema. Solo
// pasaba a partir de la segunda visita, cuando el worker ya controla la pagina, que es
// justo por lo que no salto al desplegar.
//
// Salir sin llamar a respondWith deja que el navegador haga la peticion como siempre, sin
// pasar por el worker. El manejador sigue existiendo, que es lo unico que Chrome pide.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request));
});
