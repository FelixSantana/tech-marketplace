// Espejo en el navegador de api/_lib/envio.cjs, solo para mostrar. El costo que vale es el que
// calcula el servidor al registrar el pedido; esto es para que el cliente vea el total antes.
const dinero = (n) => { const v = Number(n); return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : 0; };

export function ajustesDeEnvio(settings) {
  const e = (settings && settings.envio) || {};
  return {
    activo: e.activo === true,
    zonas: Array.isArray(e.zonas) ? e.zonas.filter((z) => z && z.id).map((z) => ({ id: String(z.id), nombre: String(z.nombre || '').trim(), precio: dinero(z.precio) })) : [],
    retiroEnTienda: e.retiroEnTienda === true,
    direccionTienda: String(e.direccionTienda || '').trim(),
    pedidoMinimo: dinero(e.pedidoMinimo),
  };
}

export function costoDeEnvio(settings, modo, zonaId) {
  const cfg = ajustesDeEnvio(settings);
  if (!cfg.activo || modo !== 'domicilio') return 0;
  const zona = cfg.zonas.find((z) => z.id === zonaId);
  return zona ? zona.precio : 0;
}

// Que le falta al cliente para poder pedir. Vacio = puede continuar.
export function faltaParaPedir(settings, { modo, zonaId, direccion }, subtotal) {
  const cfg = ajustesDeEnvio(settings);
  if (!cfg.activo) return '';
  if (cfg.pedidoMinimo > 0 && dinero(subtotal) < cfg.pedidoMinimo) return `El pedido mínimo es ${cfg.pedidoMinimo.toLocaleString('es-DO')}.`;
  if (modo !== 'domicilio' && modo !== 'retiro') return 'Elige entrega a domicilio o retiro en tienda.';
  if (modo === 'retiro') return cfg.retiroEnTienda ? '' : 'La tienda no ofrece retiro en tienda.';
  if (!cfg.zonas.length) return 'La tienda todavía no configuró las zonas de envío.';
  if (!cfg.zonas.some((z) => z.id === zonaId)) return 'Elige tu zona de envío.';
  if (String(direccion || '').trim().length < 8) return 'Escribe la dirección con calle y número.';
  return '';
}
