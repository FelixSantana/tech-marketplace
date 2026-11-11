// Datos del negocio: lo que hace que la tienda se lea como un negocio y no como el catalogo de
// alguien. RNC, direccion, horario, cobertura y formas de pago.
//
// Viven dentro de `settings` del catalogo, igual que el envio y los cupones, y se editan desde
// Ajustes. Estuvieron escritos en este archivo, es decir en el codigo, y eso obligaba a editar y
// desplegar para cada tienda: justo lo que impide vender esto a otro cliente.
//
// LO QUE ESTA VACIO NO SE MUESTRA. Un RNC o una direccion inventados no son texto de relleno:
// son afirmaciones falsas sobre la identidad de un negocio. Mientras el dato falte, su linea no
// se dibuja, y la seccion entera desaparece si no queda nada que decir.

const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

// Cobertura y formas de pago traen valor por defecto porque casi toda tienda dice lo mismo; el
// resto arranca vacio a proposito, para que nadie publique el dato de otro.
export const COBERTURA_POR_DEFECTO = 'Entrega en todo el país';
export const PAGOS_POR_DEFECTO = ['Efectivo', 'Transferencia', 'Depósito bancario'];

// --- Los sellos de confianza ---
//
// La tira de tres que va encima de la rejilla. Es lo que responde al comprador que llega
// desconfiando, y por eso iba escrita en este archivo: son el argumento de venta de una tienda
// de equipos usados. Para un cliente que venda ropa o comida, "Equipos probados" es mentira.
//
// Ahora viven en settings, como el envio y los cupones. Los de aqui son solo el punto de
// partida de una tienda recien montada.
//
// El icono se NOMBRA, no se escribe: los glifos unicode los dibuja cada sistema a su manera y en
// Windows salian como cajas palidas. El dibujo vive en el componente, en SVG, y el dueño elige
// de una lista cerrada —no puede inventarse uno, porque habria que saber dibujarlo.
export const SELLOS_POR_DEFECTO = [
  { icono: 'probado', titulo: 'Equipos probados', nota: 'Cada equipo se revisa antes de publicarse' },
  { icono: 'garantia', titulo: 'Garantía escrita', nota: 'La garantía de cada producto aparece en su ficha' },
  { icono: 'entrega', titulo: 'Entrega coordinada', nota: 'Acordamos entrega o retiro por WhatsApp' },
];

// Los iconos disponibles, con el nombre que ve el dueño en el desplegable. El orden es el del
// desplegable: primero los tres de siempre, que cubren el caso mas comun.
export const ICONOS_DE_SELLO = [
  { valor: 'probado', nombre: 'Revisado' },
  { valor: 'garantia', nombre: 'Garantía' },
  { valor: 'entrega', nombre: 'Entrega' },
  { valor: 'tienda', nombre: 'Tienda física' },
  { valor: 'reloj', nombre: 'Rapidez' },
  { valor: 'pago', nombre: 'Pago seguro' },
  { valor: 'precio', nombre: 'Precio' },
  { valor: 'mapa', nombre: 'Cobertura' },
];

const ICONOS_VALIDOS = new Set(ICONOS_DE_SELLO.map((i) => i.valor));

// Tres y no mas: la tira es una linea y en un telefono ya van justos. Un cuarto no cabria sin
// romper la rejilla, y el dueño no tiene forma de saberlo hasta verlo mal.
export const MAX_SELLOS = 3;

// Siempre devuelve la misma forma. La diferencia que importa:
//
//   - `settings.sellos` que no existe = tienda que nunca los toco → los de siempre. Asi una
//     tienda ya montada no se queda de golpe sin su tira al desplegar esto.
//   - `settings.sellos` vacio = el dueño los borro a proposito → no se dibuja nada.
//
// Sin esa distincion no habria forma de quitar la tira: cualquier lista vacia volveria a
// rellenarse con los valores por defecto.
export function sellosDeAjustes(settings) {
  const guardados = settings && settings.sellos;
  if (!Array.isArray(guardados)) return SELLOS_POR_DEFECTO.map((s) => ({ ...s }));
  return limpiarSellos(guardados);
}

// Lo que se guarda. Un sello sin titulo no es un sello a medias: es una fila vacia que el dueño
// dejo en el formulario, y dibujarla deja un hueco con un icono suelto.
export function limpiarSellos(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((s) => ({
      icono: ICONOS_VALIDOS.has(s && s.icono) ? s.icono : 'probado',
      titulo: texto(s && s.titulo, 40),
      nota: texto(s && s.nota, 90),
    }))
    .filter((s) => s.titulo)
    .slice(0, MAX_SELLOS);
}

// Siempre devuelve la misma forma, de modo que un catalogo viejo —sin el campo `negocio`— no
// rompe nada y simplemente no muestra esas lineas.
export function datosDeNegocio(settings) {
  const n = (settings && settings.negocio) || {};
  const pagos = Array.isArray(n.pagos) ? n.pagos.map((p) => texto(p, 40)).filter(Boolean) : null;
  return {
    rnc: texto(n.rnc, 30),
    direccion: texto(n.direccion, 160),
    horario: texto(n.horario, 80),
    // Una cadena vacia guardada a proposito significa "no lo muestres"; que el campo no exista
    // (tienda que nunca lo toco) significa "pon lo de siempre".
    cobertura: n.cobertura === undefined ? COBERTURA_POR_DEFECTO : texto(n.cobertura, 80),
    correo: texto(n.correo, 120),
    pagos: pagos || (n.pagos === undefined ? PAGOS_POR_DEFECTO.slice() : []),
  };
}

// Lo que el panel guarda, ya recortado. Se guarda aunque quede vacio: el dueño que borra su
// direccion esta diciendo "no la publiques", y eso hay que respetarlo.
export function limpiarNegocio(negocio) {
  const n = negocio || {};
  return {
    rnc: texto(n.rnc, 30),
    direccion: texto(n.direccion, 160),
    horario: texto(n.horario, 80),
    cobertura: texto(n.cobertura, 80),
    correo: texto(n.correo, 120),
    pagos: String(n.pagos == null ? '' : n.pagos).split(',').map((p) => texto(p, 40)).filter(Boolean),
  };
}
