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

// Los sellos siguen fijos: son el argumento de venta de una tienda de equipos usados. Cuando
// haya un cliente que venda otra cosa, se mueven a settings como todo lo demas.
//
// El icono se NOMBRA, no se escribe: los glifos unicode los dibuja cada sistema a su manera y en
// Windows salian como cajas palidas. El dibujo vive en el componente, en SVG.
export const SELLOS = [
  { icono: 'probado', titulo: 'Equipos probados', nota: 'Cada equipo se revisa antes de publicarse' },
  { icono: 'garantia', titulo: 'Garantía escrita', nota: 'La garantía de cada producto aparece en su ficha' },
  { icono: 'entrega', titulo: 'Entrega coordinada', nota: 'Acordamos entrega o retiro por WhatsApp' },
];

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
