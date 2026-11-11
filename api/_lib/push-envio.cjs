// El envio en si. Vive aparte de push.cjs porque toca la red: push.cjs se puede probar entero
// sin salir del proceso, y esto no. Y vive aparte de los handlers porque lo usan DOS —el panel
// para la prueba y el de pedidos para el aviso de verdad— y un handler que llama a otro handler
// es una dependencia que nadie espera encontrar.

const webpush = require('web-push');
const { estaMuerta } = require('./push.cjs');

// El sujeto VAPID identifica ante el servicio de push a quien envia, por si hay que reclamar.
// Sin uno configurado se usa la propia tienda: es cierto, y no es el correo de nadie.
function sujeto(cfg, req) {
  if (cfg.contacto) return cfg.contacto;
  const host = req && (req.headers?.['x-forwarded-host'] || req.headers?.host);
  return host ? `https://${String(host).split(',')[0].trim()}` : 'https://localhost';
}

// Envia a todos los dispositivos del dueño a la vez y dice cuales ya no existen.
//
// allSettled y no all: con all, un telefono que el dueño reseteo hace meses tumbaria el aviso
// a los demas. Cada dispositivo se resuelve por su cuenta.
async function enviarATodos(subs, carga, cfg, suj) {
  webpush.setVapidDetails(suj, cfg.publica, cfg.privada);
  const texto = JSON.stringify(carga);
  const resultados = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, texto)),
  );
  const muertas = [];
  let entregados = 0;
  resultados.forEach((r, i) => {
    if (r.status === 'fulfilled') { entregados++; return; }
    const status = r.reason && r.reason.statusCode;
    // Solo se borra lo que el servicio declara inexistente. Un 500 suyo o un 429 son pasajeros
    // y borrar por eso dejaria al dueño sin avisos por una caida de diez minutos.
    if (estaMuerta(status)) muertas.push(subs[i].endpoint);
    else console.error('push fallo', status || (r.reason && r.reason.message));
  });
  return { entregados, muertas };
}

module.exports = { enviarATodos, sujeto };
