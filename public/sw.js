// Trabajador de servicio a proposito minimo. Existe por un solo motivo: Chrome no ofrece
// "Instalar aplicacion" en Android si el sitio no registra uno con manejador de fetch.
//
// NO cachea nada. Un cache mal hecho es peor que no tener aplicacion instalable: deja al cliente
// mirando precios viejos y al dueño sin entender por que su cambio no se ve. La tienda necesita
// la red igual, porque el catalogo y el stock vienen del servidor en cada visita.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => { e.respondWith(fetch(e.request)); });
