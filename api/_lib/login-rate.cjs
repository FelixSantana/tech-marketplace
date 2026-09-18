// Freno a los intentos de adivinar la contraseña del panel.
//
// Bloqueo escalonado por IP: los primeros fallos no molestan a quien se equivoca de verdad,
// y a partir de ahi cada tanda de fallos cuesta cada vez mas esperar. A proposito NO se
// bloquea de forma global: un atacante desde muchas IPs podria dejar fuera al dueño.

const FALLOS_ANTES_DE_BLOQUEAR = 5;
const ESCALADA_MS = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];
// Sin fallos nuevos durante este rato, la cuenta vuelve a cero.
const OLVIDO_MS = 60 * 60 * 1000;

const entero = (n) => { const v = Math.floor(Number(n) || 0); return v > 0 ? v : 0; };

function normalizar(estado, ahora) {
  const e = estado && typeof estado === 'object' ? estado : {};
  const ultimo = entero(e.ultimo);
  // Si hace rato que no falla, se empieza de nuevo.
  if (ultimo && ahora - ultimo > OLVIDO_MS) return { fallos: 0, hasta: 0, ultimo: 0 };
  return { fallos: entero(e.fallos), hasta: entero(e.hasta), ultimo };
}

// Milisegundos que faltan para poder volver a intentar. 0 = puede intentar.
function esperaRestante(estado, ahora) {
  const e = normalizar(estado, ahora);
  return e.hasta > ahora ? e.hasta - ahora : 0;
}

function registrarFallo(estado, ahora) {
  const e = normalizar(estado, ahora);
  const fallos = e.fallos + 1;
  if (fallos < FALLOS_ANTES_DE_BLOQUEAR) return { fallos, hasta: 0, ultimo: ahora };
  // Cada tanda de fallos a partir del limite sube un escalon.
  const escalon = Math.min(fallos - FALLOS_ANTES_DE_BLOQUEAR, ESCALADA_MS.length - 1);
  return { fallos, hasta: ahora + ESCALADA_MS[escalon], ultimo: ahora };
}

const limpiar = () => ({ fallos: 0, hasta: 0, ultimo: 0 });

function mensajeDeEspera(ms) {
  const minutos = Math.ceil(ms / 60000);
  if (minutos <= 1) return 'Demasiados intentos fallidos. Espera un minuto y vuelve a probar.';
  return `Demasiados intentos fallidos. Espera ${minutos} minutos y vuelve a probar.`;
}

module.exports = { FALLOS_ANTES_DE_BLOQUEAR, ESCALADA_MS, OLVIDO_MS, esperaRestante, registrarFallo, limpiar, mensajeDeEspera };
