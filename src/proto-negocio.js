// PROTOTIPO D — datos del negocio que hacen que una tienda parezca real.
//
// Van aqui y no en el catalogo a proposito: en el prototipo interesa ver COMO se
// muestran, no montarles un formulario en el panel. Si la direccion se aprueba,
// esto pasa a `settings` y se edita desde Ajustes como el resto.
//
// Los campos vacios NO se inventan: un RNC o una direccion falsos en una tienda
// son mentiras sobre la identidad del negocio, no texto de relleno. Mientras
// esten vacios, la interfaz muestra un hueco marcado en gris para que se vea
// donde va cada cosa, y ese hueco desaparece solo cuando Felix escriba el dato.
export const NEGOCIO = {
  rnc: '',                    // ej. "1-31-12345-6"
  direccion: '',              // calle, numero, sector, ciudad
  horario: '',                // ej. "Lun a Sáb · 9:00 AM a 6:00 PM"
  cobertura: 'Entrega en todo el país',
  correo: '',
  // Lo que Cecomsa, Data Import y Omega no dicen y aqui si se puede decir,
  // porque vendiendo equipos usados es justo lo que el cliente teme.
  sellos: [
    { icono: '✓', titulo: 'Equipos probados', nota: 'Cada equipo se revisa antes de publicarse' },
    { icono: '⛨', titulo: 'Garantía escrita', nota: 'La garantía de cada producto aparece en su ficha' },
    { icono: '⛟', titulo: 'Entrega coordinada', nota: 'Acordamos entrega o retiro por WhatsApp' },
  ],
  pagos: ['Efectivo', 'Transferencia', 'Depósito bancario'],
};

// Marcador visible para un dato que todavia no existe. Gris, entre corchetes y
// evidente: nadie lo confunde con informacion real.
export const falta = (texto) => `[${texto}]`;
