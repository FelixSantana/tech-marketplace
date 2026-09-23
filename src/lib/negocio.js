// Datos del negocio que hacen que la tienda se lea como un negocio y no como el
// catalogo de alguien: telefono, horario, direccion, RNC, formas de pago.
//
// Viven aqui y no en `settings` porque cambian una vez al año; cuando haga falta
// editarlos desde el panel, se mueven a settings y este archivo pasa a ser el
// valor por defecto.
//
// LO QUE ESTA VACIO NO SE MUESTRA. Un RNC o una direccion inventados no son
// texto de relleno: son afirmaciones falsas sobre la identidad del negocio, y
// una tienda que miente en el pie no merece que le crean el precio. Mientras el
// dato falte, su linea simplemente no aparece.
export const NEGOCIO = {
  rnc: '',                    // ej. '1-31-12345-6'
  direccion: '',              // calle, numero, sector, ciudad
  horario: '',                // ej. 'Lun a Sáb · 9:00 AM a 6:00 PM'
  cobertura: 'Entrega en todo el país',
  correo: '',
  // Lo que las tiendas grandes del pais no comunican y aqui si se puede decir,
  // porque vendiendo equipos usados es justo lo que el cliente teme.
  sellos: [
    { icono: '✓', titulo: 'Equipos probados', nota: 'Cada equipo se revisa antes de publicarse' },
    { icono: '⛨', titulo: 'Garantía escrita', nota: 'La garantía de cada producto aparece en su ficha' },
    { icono: '⛟', titulo: 'Entrega coordinada', nota: 'Acordamos entrega o retiro por WhatsApp' },
  ],
  pagos: ['Efectivo', 'Transferencia', 'Depósito bancario'],
};
