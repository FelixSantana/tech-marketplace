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

// --- Avisos de pedido nuevo ---
//
// Llega aqui aunque la tienda no este abierta en ninguna pestaña: para eso existe el push. El
// cuerpo lo manda el servidor ya cifrado y el navegador lo descifra antes de entregarlo.
//
// Si el aviso llega sin datos o con datos ilegibles se enseña igual uno generico. Un push que
// llega y no muestra NADA es peor que no recibirlo: Chrome lo cuenta como abuso y, repetido,
// deja de entregar los siguientes.
self.addEventListener('push', (e) => {
  let datos = {};
  try { datos = e.data ? e.data.json() : {}; } catch { datos = {}; }
  const titulo = datos.title || 'Pedido nuevo';
  e.waitUntil(self.registration.showNotification(titulo, {
    body: datos.body || 'Entra al panel para verlo.',
    // Iconos del repositorio y no los de la marca del cliente: el worker no lee los ajustes, y
    // estos existen siempre.
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: datos.tag || 'pedido',
    // Que vibre y se quede en pantalla: un pedido no es un aviso que se pueda pasar de largo.
    vibrate: [120, 60, 120],
    requireInteraction: true,
    data: { url: datos.url || '/admin' },
  }));
});

// Al tocarlo, al panel. Si ya hay una pestaña de la tienda abierta se reutiliza en vez de
// abrir una nueva: el dueño que ya estaba dentro no quiere una segunda copia.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL((e.notification.data && e.notification.data.url) || '/admin', self.location.origin);
  e.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abiertas) {
      if (new URL(c.url).origin !== destino.origin) continue;
      await c.focus();
      if ('navigate' in c) await c.navigate(destino.href);
      return;
    }
    await self.clients.openWindow(destino.href);
  })());
});
