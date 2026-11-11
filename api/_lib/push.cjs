// Aviso de pedido nuevo al telefono del dueño.
//
// EL PROBLEMA. Cuando un cliente termina el pedido, la tienda lo guarda aqui y ademas le abre
// un enlace de WhatsApp para que lo mande. Lo segundo depende de que el cliente pulse enviar, y
// muchos no lo hacen: cierran la pestaña, se les va el dato, se distraen. El pedido queda
// guardado en el panel y el dueño no se entera hasta que entra a mirar. Un pedido que tarda
// medio dia en contestarse es, en una tienda de WhatsApp, un pedido perdido.
//
// POR QUE PUSH Y NO CORREO. El correo pide cuenta en un servicio de envio, puede caer en spam y
// llega tarde. El push lo entrega el propio navegador al telefono, como una notificacion de
// WhatsApp, sin terceros y sin coste. La tienda ya registra un service worker, que es la pieza
// que hacia falta.
//
// LO QUE VIVE AQUI es solo lo que se puede probar sin red: decidir si esta configurado, armar
// el texto del aviso y mantener la lista de dispositivos. El envio en si lo hace el handler.

const SUBS_KEY = 'synaptic_push_subs';

// El par de claves VAPID identifica a ESTA tienda ante el servicio de push del navegador. La
// publica viaja al navegador —es publica, por eso se llama asi—; la privada solo la ve el
// servidor. Sin las dos, no se envia nada y la tienda sigue funcionando igual: el aviso es una
// comodidad, no una pieza de la que dependa un pedido.
function configuracion(env = {}) {
  const publica = String(env.VAPID_PUBLIC_KEY || '').trim();
  const privada = String(env.VAPID_PRIVATE_KEY || '').trim();
  // El "sujeto" le dice al servicio de push a quien reclamar si esto se porta mal. Tiene que
  // ser un mailto: o una URL; si no hay nada util, no se inventa un correo de nadie.
  const contacto = String(env.VAPID_SUBJECT || '').trim();
  return { publica, privada, contacto, listo: Boolean(publica && privada) };
}

// Una suscripcion es lo que entrega el navegador: a donde mandar y con que claves cifrar.
// Llega desde el panel, asi que se comprueba antes de guardarla.
function esSuscripcionValida(sub) {
  if (!sub || typeof sub !== 'object') return false;
  const endpoint = String(sub.endpoint || '');
  if (!/^https:\/\/[^\s]+$/i.test(endpoint) || endpoint.length > 1000) return false;
  const k = sub.keys;
  return Boolean(k && typeof k === 'object' && typeof k.p256dh === 'string' && typeof k.auth === 'string' && k.p256dh && k.auth);
}

// Guardar solo lo que hace falta para enviar. Lo que venga de mas del navegador no se persiste.
function normalizarSuscripcion(sub) {
  return { endpoint: String(sub.endpoint), keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) }, creadaEn: new Date().toISOString() };
}

const MAX_DISPOSITIVOS = 10;

// Un mismo telefono re-suscrito trae el mismo endpoint: se reemplaza en vez de duplicarse, o
// cada vez que el dueño pulsara el boton recibiria un aviso de mas.
function conSuscripcion(lista, sub) {
  const otras = (Array.isArray(lista) ? lista : []).filter((s) => s && s.endpoint !== sub.endpoint);
  return [normalizarSuscripcion(sub), ...otras].slice(0, MAX_DISPOSITIVOS);
}

function sinSuscripcion(lista, endpoint) {
  return (Array.isArray(lista) ? lista : []).filter((s) => s && s.endpoint !== endpoint);
}

// El servicio de push contesta 404 o 410 cuando el navegador ya desinstalo la suscripcion: el
// dueño borro los datos del sitio, desinstalo la app o revoco el permiso. Esa suscripcion no va
// a revivir, asi que se borra. Si no, la lista se llena de muertos y cada pedido gasta un
// intento por cada uno.
const MUERTA = new Set([404, 410]);
const estaMuerta = (status) => MUERTA.has(Number(status));

const ES_MONEDA = /^[A-Za-z$€£¥.\s]{0,8}$/;

// La misma forma que acepta src/lib/avisoRuta.js. Un identificador es ord_<ms>_<azar>.
const ES_IDENTIFICADOR = /^[A-Za-z0-9_-]{1,80}$/;

// El texto que se ve en la pantalla de bloqueo. Corto a proposito: ahi solo caben dos lineas, y
// lo que importa es cuanto y de quien, para decidir si se atiende ahora o despues.
function avisoDePedido(order, settings = {}) {
  const o = order || {};
  const moneda = ES_MONEDA.test(String(settings.currency || '')) ? String(settings.currency).trim() : 'RD$';
  const total = Number(o.total);
  const importe = Number.isFinite(total) ? `${moneda} ${total.toLocaleString('es-DO')}` : '';
  const cliente = String(o.customerName || '').trim() || 'Alguien';

  const articulos = Array.isArray(o.products) ? o.products : [];
  const unidades = articulos.reduce((s, p) => s + (Number(p && p.quantity) || 0), 0);
  const primero = String((articulos[0] && articulos[0].name) || '').trim();
  // "Teclado y 2 mas" se lee de un vistazo; la lista entera no cabe y se corta a mitad.
  const resto = articulos.length - 1;
  // El numero que se muestra y el que decide el plural tienen que ser EL MISMO. Mirando
  // `unidades` para el plural y `unidades || 1` para el texto salia "1 articulos" en un pedido
  // sin articulos, que es justo el caso raro en que se mira dos veces el aviso.
  const cuantos = unidades || 1;
  const que = primero ? (resto > 0 ? `${primero} y ${resto} más` : primero) : `${cuantos} artículo${cuantos === 1 ? '' : 's'}`;

  return {
    title: importe ? `Pedido nuevo · ${importe}` : 'Pedido nuevo',
    body: `${cliente} — ${que}`,
    // A donde lleva el toque: al pedido concreto, no al panel a secas. Llevaba a /admin y el
    // panel abria en Productos, asi que habia que ir a Órdenes y buscar cual de todas era.
    //
    // El identificador viaja en la direccion porque es lo unico que sobrevive al camino: el
    // aviso lo entrega el sistema operativo, abre el navegador y arranca la aplicacion de cero.
    // La regla de que forma tiene que tener esta duplicada en src/lib/avisoRuta.js —esto corre
    // en el servidor y aquello en el navegador— y una prueba comprueba que las dos coinciden.
    url: ES_IDENTIFICADOR.test(String(o.id || '')) ? `/admin?orden=${encodeURIComponent(o.id)}` : '/admin',
    // Con la misma etiqueta, dos pedidos seguidos no apilan dos avisos identicos... pero aqui
    // SI interesa que se apilen, asi que cada pedido lleva la suya.
    tag: `pedido-${String(o.id || Date.now())}`,
  };
}

module.exports = { SUBS_KEY, MAX_DISPOSITIVOS, configuracion, esSuscripcionValida, normalizarSuscripcion, conSuscripcion, sinSuscripcion, estaMuerta, avisoDePedido };
