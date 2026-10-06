// Como se llama la tienda cuando todavia no se llama de ninguna manera.
//
// Durante mucho tiempo la respuesta fue 'Synaptic Tech', escrita a mano en nueve sitios distintos
// —cabecera, pie, titulo de la pestaña, aviso de privacidad, catalogo impreso, pagina de
// producto— y ademas SEMBRADA en la base de datos de cada tienda nueva por el manejador del
// catalogo. El efecto era que la tienda de un cliente recien instalada se llamaba, literalmente,
// Synaptic Tech, en todas partes, hasta que alguien lo cambiara.
//
// Ahora el valor por defecto es un marcador de posicion honesto. 'Mi tienda' se eligio por encima
// de 'Catálogo' porque el titulo de la pestaña es `${nombre} — Catálogo`, y con 'Catálogo' salia
// "Catálogo — Catálogo".
//
// Una tienda nueva ya no nace con ningun nombre guardado: el campo arranca vacio y esto es solo lo
// que se enseña mientras tanto. Asi, el dia que el dueño escriba el suyo, no esta corrigiendo el
// nombre de otro negocio sino rellenando un hueco.
export const NOMBRE_POR_DEFECTO = 'Mi tienda';

export function nombreDeTienda(settings) {
  const n = String((settings && settings.storeName) || '').trim();
  return n || NOMBRE_POR_DEFECTO;
}
