// La ruta de las cotizaciones. No tiene archivo propio en api/: el plan de Vercel de esta
// tienda permite 12 funciones y ya hay 12, asi que cuelga de /api/orders?recurso=cotizaciones.
// Despliegues enteros han fallado en silencio por pasarse de ese tope.
//
// Todo lo de aqui es del dueño: no hay una sola operacion publica. Las ordenes si tienen una
// —el cliente crea la suya al pedir por WhatsApp—, y por eso el reparto de orders-handler
// comprueba el token ANTES de mirar que se pide.

const { kvGet, kvSet } = require('../_lib/kv.cjs');
const { COTIZACIONES_KEY, MAX_GUARDADAS, crearCotizacion, actualizarCotizacion } = require('../_lib/cotizaciones.cjs');

const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

module.exports = async function cotizaciones(req, res, body) {
  const lista = (await kvGet(COTIZACIONES_KEY)) || [];

  if (req.method === 'GET') return res.status(200).json({ cotizaciones: lista });

  if (req.method === 'POST') {
    const cotizacion = crearCotizacion(body, lista);
    if (!cotizacion.cliente) return res.status(400).json({ error: 'CLIENTE_REQUERIDO', message: 'Escribe a quién va dirigida la cotización.' });
    if (!cotizacion.lineas.length) return res.status(400).json({ error: 'LINEAS_REQUERIDAS', message: 'Agrega al menos un renglón con descripción.' });
    lista.unshift(cotizacion);
    await kvSet(COTIZACIONES_KEY, lista.slice(0, MAX_GUARDADAS));
    return res.status(201).json({ ok: true, cotizacion });
  }

  const id = texto(body.id, 100);
  if (!id) return res.status(400).json({ error: 'ID_REQUERIDO' });
  const indice = lista.findIndex((c) => c.id === id);
  if (indice < 0) return res.status(404).json({ error: 'COTIZACION_NO_ENCONTRADA', message: 'Esa cotización ya no está en la lista.' });

  if (req.method === 'DELETE') {
    lista.splice(indice, 1);
    await kvSet(COTIZACIONES_KEY, lista);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'PUT') {
    const cotizacion = actualizarCotizacion(lista[indice], body, lista);
    if (!cotizacion.cliente) return res.status(400).json({ error: 'CLIENTE_REQUERIDO', message: 'Escribe a quién va dirigida la cotización.' });
    if (!cotizacion.lineas.length) return res.status(400).json({ error: 'LINEAS_REQUERIDAS', message: 'Agrega al menos un renglón con descripción.' });
    lista[indice] = cotizacion;
    await kvSet(COTIZACIONES_KEY, lista);
    return res.status(200).json({ ok: true, cotizacion });
  }

  return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
};
