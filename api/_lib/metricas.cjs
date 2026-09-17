// Contadores del embudo de venta, sin servicios de terceros ni cookies de rastreo.
//
// Se guarda un solo documento pequeño en Redis: totales por dia y vistas por producto. No se
// guarda nada del visitante, asi que no hay datos personales que proteger aqui.

const TIPOS = ['visita', 'producto', 'checkout', 'pedido', 'whatsapp'];
const DIAS_QUE_SE_GUARDAN = 60;

const entero = (n) => { const v = Math.floor(Number(n) || 0); return v > 0 ? v : 0; };

function hoyEnRD() {
  try { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' }); }
  catch { return new Date().toISOString().slice(0, 10); }
}

const vacio = () => ({ dias: {}, productos: {} });

function normalizar(doc) {
  const d = doc && typeof doc === 'object' ? doc : {};
  return { dias: d.dias && typeof d.dias === 'object' ? d.dias : {}, productos: d.productos && typeof d.productos === 'object' ? d.productos : {} };
}

// Descarta los dias viejos para que el documento no crezca sin limite.
function podar(doc, dias = DIAS_QUE_SE_GUARDAN, hoy) {
  const base = normalizar(doc);
  const limite = new Date(`${hoy || hoyEnRD()}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() - (dias - 1));
  const desde = limite.toISOString().slice(0, 10);
  const salida = {};
  for (const [fecha, valores] of Object.entries(base.dias)) if (fecha >= desde) salida[fecha] = valores;
  return { dias: salida, productos: base.productos };
}

function registrarEvento(doc, tipo, productId, hoy) {
  if (!TIPOS.includes(tipo)) throw new Error('EVENTO_DESCONOCIDO');
  const base = normalizar(doc);
  const fecha = hoy || hoyEnRD();
  const dia = { ...(base.dias[fecha] || {}) };
  dia[tipo] = entero(dia[tipo]) + 1;
  const productos = { ...base.productos };
  if (tipo === 'producto' && productId) {
    const id = String(productId).slice(0, 60);
    productos[id] = entero(productos[id]) + 1;
  }
  return podar({ dias: { ...base.dias, [fecha]: dia }, productos }, DIAS_QUE_SE_GUARDAN, fecha);
}

const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : 0);

// Resumen para el panel: totales del periodo, conversion entre pasos y lo mas mirado.
function resumen(doc, dias = 30, hoy, catalogo) {
  const base = podar(doc, dias, hoy);
  const totales = { visita: 0, producto: 0, checkout: 0, pedido: 0, whatsapp: 0 };
  const serie = Object.keys(base.dias).sort().map((fecha) => {
    const d = base.dias[fecha];
    for (const t of TIPOS) totales[t] += entero(d[t]);
    return { fecha, visita: entero(d.visita), pedido: entero(d.pedido) };
  });

  const nombres = new Map(((catalogo && catalogo.products) || []).map((p) => [String(p.id), p.name]));
  const productos = Object.entries(base.productos)
    .map(([id, vistas]) => ({ id, nombre: nombres.get(id) || '(producto eliminado)', vistas: entero(vistas) }))
    .sort((a, b) => b.vistas - a.vistas);

  return {
    dias,
    totales,
    conversion: {
      visitaAProducto: porcentaje(totales.producto, totales.visita),
      productoACheckout: porcentaje(totales.checkout, totales.producto),
      checkoutAPedido: porcentaje(totales.pedido, totales.checkout),
      pedidoAWhatsapp: porcentaje(totales.whatsapp, totales.pedido),
      visitaAPedido: porcentaje(totales.pedido, totales.visita),
    },
    serie,
    productos,
  };
}

module.exports = { TIPOS, vacio, normalizar, podar, registrarEvento, resumen, hoyEnRD, porcentaje };
