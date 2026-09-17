// Registra eventos del embudo. Es a fondo perdido: si falla, la tienda no se entera ni molesta
// al cliente. La visita se cuenta una vez por pestaña, no en cada recarga.
const YA_CONTADO = 'synaptic_visita_contada';

export function registrarEvento(tipo, productId) {
  try {
    if (tipo === 'visita') {
      if (sessionStorage.getItem(YA_CONTADO)) return;
      sessionStorage.setItem(YA_CONTADO, '1');
    }
  } catch { /* sin sessionStorage se cuenta igual */ }

  try {
    const cuerpo = JSON.stringify({ tipo, ...(productId ? { productId } : {}) });
    // keepalive: el evento de WhatsApp se manda mientras la pagina se va.
    fetch('/api/evento', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo, keepalive: true }).catch(() => {});
  } catch { /* ignorado a proposito */ }
}
