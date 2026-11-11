// Lo que el navegador necesita para suscribirse a los avisos, y lo que el panel necesita para
// explicarle al dueño por que no puede.

// La clave publica VAPID viaja como texto en base64url, pero subscribe() la pide como bytes.
// base64url cambia dos caracteres respecto a base64 normal (+/ por -_) y suele venir sin el
// relleno de '=', asi que hay que deshacer las dos cosas antes de decodificar. Con la clave mal
// convertida, subscribe() falla con un error que no dice nada util.
export function clavePublicaEnBytes(base64) {
  const texto = String(base64 || '');
  const relleno = '='.repeat((4 - (texto.length % 4)) % 4);
  const normal = (texto + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const crudo = atob(normal);
  const bytes = new Uint8Array(crudo.length);
  for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
  return bytes;
}

// Por que no se puede activar, en palabras que sirvan para hacer algo.
//
// Cada motivo tiene una salida distinta y el dueño no puede adivinarla: "no se pudo activar"
// a secas, en un iPhone, le hace pensar que esta roto cuando lo unico que falta es instalar
// la tienda desde Safari.
export const MOTIVOS = {
  LISTO: 'listo',
  SIN_SOPORTE: 'sin-soporte',
  SIN_CLAVES: 'sin-claves',
  BLOQUEADO: 'bloqueado',
};

export const EXPLICACION = {
  [MOTIVOS.SIN_SOPORTE]: 'Este navegador no puede recibir avisos. En iPhone hay que instalar la tienda desde Safari (Compartir → Añadir a pantalla de inicio) y abrirla desde ahí.',
  [MOTIVOS.SIN_CLAVES]: 'Faltan las claves de notificación en el proyecto. Hay que añadir VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en Vercel y volver a desplegar.',
  [MOTIVOS.BLOQUEADO]: 'Bloqueaste los avisos para este sitio. Hay que permitirlos desde el candado de la barra de direcciones y volver a intentarlo.',
};

// `entorno` se inyecta para poder probar esto sin un navegador de verdad.
export function porQueNoSePuede({ listo, entorno = globalThis } = {}) {
  const soporta = Boolean(entorno && 'serviceWorker' in (entorno.navigator || {}) && 'PushManager' in entorno);
  if (!soporta) return MOTIVOS.SIN_SOPORTE;
  if (!listo) return MOTIVOS.SIN_CLAVES;
  if (entorno.Notification && entorno.Notification.permission === 'denied') return MOTIVOS.BLOQUEADO;
  return MOTIVOS.LISTO;
}

// El navegador entrega la suscripcion como un objeto con metodos; al servidor hay que mandarle
// datos planos. toJSON() hace justo eso y es lo que entiende web-push al otro lado.
export function aDatosPlanos(suscripcion) {
  if (!suscripcion) return null;
  const j = typeof suscripcion.toJSON === 'function' ? suscripcion.toJSON() : suscripcion;
  if (!j || !j.endpoint || !j.keys) return null;
  return { endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } };
}
