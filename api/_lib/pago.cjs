// Lo que el SERVIDOR acepta guardar como pago de una orden.
//
// Esto no es una copia por comodidad: es la validacion de verdad. Lo del navegador (src/lib
// /pago.js) sirve para dibujar el formulario, pero quien decide que entra en Redis es esto.
// Cualquiera con el token del panel puede mandar un PUT a mano.
//
// Lo mas importante que hace es RECHAZAR comprobantes incrustados. Las ordenes viven todas en
// una sola clave —hasta mil— y una captura en base64 son cientos de miles de caracteres: veinte
// transferencias con captura reventarian la clave y con ella el panel de ordenes entero.
// Una prueba cruzada comprueba que esto y el navegador deciden igual.

const MAX_EVIDENCIAS = 4;

const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

const esDelAlmacen = (src) => typeof src === 'string' && /^https:\/\/[^\s]+$/.test(src) && src.length <= 600;

function limpiarPago(pago) {
  const p = pago || {};
  const metodo = texto(p.metodo, 40);
  const referencia = texto(p.referencia, 60);
  const evidencias = (Array.isArray(p.evidencias) ? p.evidencias : []).filter(esDelAlmacen).slice(0, MAX_EVIDENCIAS);
  return metodo || referencia || evidencias.length ? { metodo, referencia, evidencias } : null;
}

module.exports = { limpiarPago, MAX_EVIDENCIAS };
