// La direccion a la que lleva tocar un aviso de pedido.
//
// Antes llevaba a /admin a secas: el panel abria en Productos y habia que ir a Órdenes y buscar
// cual de todas era. Con el telefono en la mano, a las nueve de la noche, eso es justo la
// friccion que hace que un pedido espere.
//
// El identificador viaja en la direccion porque es lo unico que sobrevive al camino: el aviso
// lo entrega el sistema operativo, abre el navegador y arranca la aplicacion de cero. No hay
// memoria compartida entre el aviso y el panel; solo la URL.

const PARAMETRO = 'orden';

// Los identificadores son del tipo ord_1794424738526_o36fme: letras, numeros y guion bajo. Se
// limita la longitud porque esto llega de fuera —cualquiera puede escribir la direccion a
// mano— y luego se compara contra la lista de pedidos.
const ES_IDENTIFICADOR = /^[A-Za-z0-9_-]{1,80}$/;

export function rutaDeOrden(id) {
  const limpio = String(id == null ? '' : id).trim();
  return ES_IDENTIFICADOR.test(limpio) ? `/admin?${PARAMETRO}=${encodeURIComponent(limpio)}` : '/admin';
}

// Lee el identificador de la direccion actual. Devuelve '' si no hay o no tiene forma de uno,
// que es lo mismo que decir "abre el panel y ya".
export function ordenDeLaUrl(busqueda) {
  let valor = '';
  try { valor = new URLSearchParams(String(busqueda || '')).get(PARAMETRO) || ''; } catch { return ''; }
  const limpio = valor.trim();
  return ES_IDENTIFICADOR.test(limpio) ? limpio : '';
}

// Quita el parametro sin recargar ni dejar entrada en el historial.
//
// Si se quedara, recargar la pagina volveria a saltar al mismo pedido, y el boton de atras
// pasaria por una direccion que ya no significa nada. El aviso es para una vez.
export function limpiarUrl(window) {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(PARAMETRO)) return;
    url.searchParams.delete(PARAMETRO);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch { /* si el navegador no deja, no pasa nada grave */ }
}
