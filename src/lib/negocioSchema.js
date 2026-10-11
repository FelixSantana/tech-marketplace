// Los datos del negocio en el lenguaje que Google entiende (schema.org/Store).
//
// Es lo que alimenta la ficha lateral de una busqueda local: nombre, telefono, direccion, horario
// y formas de pago. Los datos ya estan en Ajustes; aqui solo se traducen.
//
// LO QUE ESTA VACIO NO SE PUBLICA, por la misma razon que en negocio.js: un RNC o una direccion
// inventados no son relleno, son afirmaciones falsas sobre la identidad de un negocio, y ademas
// Google penaliza los datos estructurados que no se corresponden con lo que se ve en la pagina.
//
// Se inyecta desde el navegador y no desde el servidor. La portada es un archivo estatico y estos
// datos viven en la base de datos, que solo se lee al ejecutar; en Vercel el sistema de archivos
// gana a las reescrituras, asi que `/` no puede pasar por una funcion sin renombrar el HTML del
// build. Google ejecuta JavaScript y lo recoge, aunque en una segunda pasada mas lenta. Al
// compartir un PRODUCTO no aplica: esa pagina si la sirve una funcion y lleva sus datos desde el
// servidor.

import { datosDeNegocio } from './negocio';
import { nombreDeTienda } from './tienda';

// "Lun a Sáb - 09:00 am a 06:00 pm" es texto libre que escribe el dueño: no se puede convertir a
// openingHoursSpecification sin adivinar. Se publica tal cual en openingHours, que admite texto.
export function negocioSchema(settings, origen) {
  const s = settings || {};
  const n = datosDeNegocio(s);
  const telefono = String(s.whatsapp || '').replace(/\D/g, '');

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: nombreDeTienda(s),
    ...(s.tagline ? { description: s.tagline } : {}),
    ...(origen ? { url: origen } : {}),
    ...(s.logo && /^https?:\/\//.test(s.logo) ? { image: s.logo, logo: s.logo } : {}),
    ...(telefono ? { telephone: `+${telefono}` } : {}),
    ...(n.correo ? { email: n.correo } : {}),
    ...(n.horario ? { openingHours: n.horario } : {}),
    ...(n.pagos && n.pagos.length ? { paymentAccepted: n.pagos.join(', ') } : {}),
    ...(n.direccion
      ? { address: { '@type': 'PostalAddress', streetAddress: n.direccion, addressCountry: 'DO' } }
      : { address: { '@type': 'PostalAddress', addressCountry: 'DO' } }),
    ...(n.cobertura ? { areaServed: n.cobertura } : {}),
    // El RNC es el identificador fiscal del negocio. taxID es el campo que le corresponde.
    ...(n.rnc ? { taxID: n.rnc } : {}),
  };

  return schema;
}

// Una tienda sin nombre ni telefono ni direccion no tiene nada que declarar, y publicar un bloque
// vacio es peor que no publicar ninguno: Google lo lee como datos incompletos.
export function valeLaPenaPublicar(settings) {
  const s = settings || {};
  const n = datosDeNegocio(s);
  return !!(String(s.storeName || '').trim() && (s.whatsapp || n.direccion || n.horario || n.correo));
}
