// Entrega y envio, sin HTTP, para poder probarlo.
//
// El costo del envio lo decide SIEMPRE el servidor a partir de los ajustes de la tienda: el
// navegador solo dice a que zona quiere que le lleven. Si no, cualquiera podria pedir envio
// gratis editando la peticion.

const entero = (n) => Math.max(0, Math.floor(Number(n) || 0));
const dinero = (n) => { const v = Number(n); return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : 0; };
const texto = (v, max) => String(v || '').trim().slice(0, max);

function ajustesDeEnvio(settings) {
  const e = (settings && settings.envio) || {};
  return {
    activo: e.activo === true,
    zonas: Array.isArray(e.zonas) ? e.zonas.filter((z) => z && z.id).map((z) => ({ id: String(z.id), nombre: texto(z.nombre, 60), precio: dinero(z.precio) })) : [],
    retiroEnTienda: e.retiroEnTienda === true,
    direccionTienda: texto(e.direccionTienda, 300),
    pedidoMinimo: dinero(e.pedidoMinimo),
  };
}

// Devuelve como se entrega el pedido y cuanto cuesta. `subtotal` es el de los productos.
function resolverEntrega(settings, body, subtotal) {
  const cfg = ajustesDeEnvio(settings);

  // Sin configurar, la tienda se comporta como hasta ahora: la entrega se coordina por chat.
  if (!cfg.activo) return { modo: 'coordinado', zonaId: null, zonaNombre: '', direccion: texto(body && body.direccion, 300), costo: 0 };

  if (cfg.pedidoMinimo > 0 && dinero(subtotal) < cfg.pedidoMinimo) throw new Error('BELOW_MIN_ORDER');

  const modo = body && body.entrega === 'retiro' ? 'retiro' : body && body.entrega === 'domicilio' ? 'domicilio' : null;
  if (!modo) throw new Error('DELIVERY_MODE_REQUIRED');

  if (modo === 'retiro') {
    if (!cfg.retiroEnTienda) throw new Error('PICKUP_NOT_AVAILABLE');
    return { modo: 'retiro', zonaId: null, zonaNombre: '', direccion: '', costo: 0 };
  }

  if (!cfg.zonas.length) throw new Error('NO_ZONES_CONFIGURED');
  const zona = cfg.zonas.find((z) => z.id === String((body && body.zonaId) || ''));
  if (!zona) throw new Error('INVALID_ZONE');
  const direccion = texto(body && body.direccion, 300);
  if (direccion.length < 8) throw new Error('ADDRESS_REQUIRED');

  return { modo: 'domicilio', zonaId: zona.id, zonaNombre: zona.nombre, direccion, costo: zona.precio };
}

module.exports = { ajustesDeEnvio, resolverEntrega, entero, dinero };
