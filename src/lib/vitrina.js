// Lo que convierte una lista de productos en un escaparate: destacados, ofertas, urgencia y
// estado del equipo. Cuatro cosas distintas que comparten una regla: NADA se muestra si no es
// cierto. Una oferta inventada o un "últimas unidades" permanente se notan, y lo que se gasta
// es la credibilidad del vendedor, que es lo unico que tiene una tienda de usados.

import { getStockQty, hasVariants } from '../hooks/useCatalog';

// --- Estado del equipo ---
//
// El campo que faltaba. Esta tienda vende equipos de segunda mano y promete en sus sellos que
// "cada equipo se revisa antes de publicarse", pero la ficha no decia el RESULTADO de esa
// revision. Es la primera pregunta de quien compra usado: ¿esta rayado? ¿la bateria aguanta?
//
// Un nivel para poder compararlo de un vistazo, y una nota libre para lo que un nivel no
// cuenta: "Bateria 87%. Marca leve en la tapa." El nivel sin la nota es marketing; la nota es
// lo que convence.
export const NIVELES_DE_ESTADO = [
  { valor: 'nuevo', nombre: 'Nuevo', corto: 'Nuevo' },
  { valor: 'como-nuevo', nombre: 'Como nuevo', corto: 'Como nuevo' },
  { valor: 'muy-bueno', nombre: 'Muy bueno', corto: 'Muy bueno' },
  { valor: 'con-detalles', nombre: 'Con detalles estéticos', corto: 'Con detalles' },
];

const NIVELES = new Set(NIVELES_DE_ESTADO.map((n) => n.valor));
const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

// Devuelve null cuando no hay estado que mostrar. Un producto sin estado no dibuja nada: es
// mejor no decir que decir "sin especificar", que suena a que algo se esconde.
export function estadoDeProducto(producto) {
  const e = (producto && producto.estado) || {};
  const nivel = NIVELES.has(e.nivel) ? e.nivel : '';
  const nota = texto(e.nota, 120);
  if (!nivel && !nota) return null;
  const def = NIVELES_DE_ESTADO.find((n) => n.valor === nivel);
  return { nivel, nota, nombre: def ? def.nombre : '', corto: def ? def.corto : '' };
}

export function limpiarEstado(estado) {
  const nivel = NIVELES.has(estado && estado.nivel) ? estado.nivel : '';
  const nota = texto(estado && estado.nota, 120);
  // Sin nada que decir se guarda vacio, no un objeto con campos en blanco: asi el producto
  // queda como estaba antes de que este campo existiera.
  return nivel || nota ? { nivel, nota } : null;
}

// --- Oferta: precio antes y ahora ---
//
// `precioAntes` es el precio tachado. Solo cuenta si es MAYOR que el actual: un "antes" igual o
// menor no es una oferta, es un error de tecleo, y tacharlo igualmente seria enseñarle al
// cliente un descuento que no existe.
//
// Con variantes no hay un precio unico, asi que no hay oferta que mostrar en la tarjeta.
export function ofertaDeProducto(producto, precioActual) {
  if (!producto || hasVariants(producto)) return null;
  const antes = Number(producto.precioAntes);
  const ahora = Number(precioActual != null ? precioActual : producto.price);
  if (!Number.isFinite(antes) || !Number.isFinite(ahora) || antes <= ahora || ahora < 0) return null;
  // Se redondea hacia abajo: anunciar 30% cuando es 29,6% es redondear a favor propio.
  const porciento = Math.floor(((antes - ahora) / antes) * 100);
  // Por debajo del 5% el tachado llama mas la atencion que lo que ahorra, y deja sensacion de
  // descuento de mentira.
  if (porciento < 5) return null;
  return { antes, ahora, porciento };
}

// --- Urgencia: últimas unidades ---
//
// Automatico, a partir del stock que ya se lleva. Es la unica de las cuatro que no da trabajo
// al dueño, y la unica que no puede mentir por descuido: si dice que quedan dos, quedan dos.
export const UMBRAL_POCAS = 2;

export function quedanPocas(producto) {
  const stock = getStockQty(producto);
  return stock > 0 && stock <= UMBRAL_POCAS;
}

export function textoDePocas(producto) {
  const stock = getStockQty(producto);
  if (!quedanPocas(producto)) return '';
  return stock === 1 ? 'Queda 1' : `Quedan ${stock}`;
}

// --- Destacados ---
//
// El dueño elige que va primero. Antes el orden lo decidia el codigo y "Recomendados" no
// recomendaba nada: era el orden en que estaban guardados.
//
// El tope existe porque destacar todo es no destacar nada: pasados cuatro, la primera fila deja
// de significar algo y el cliente vuelve a ver una lista cualquiera.
export const MAX_DESTACADOS = 4;

export const esDestacado = (producto) => Boolean(producto && producto.destacado);

export function contarDestacados(productos) {
  return (Array.isArray(productos) ? productos : []).filter(esDestacado).length;
}

// Los destacados primero, el resto en el orden que traian. Estable a proposito: dentro de cada
// grupo no se reordena nada, asi que el dueño sigue reconociendo su catalogo.
//
// Solo se aplica al orden "Recomendados". Si alguien pide "de menor a mayor precio", quiere eso
// y no los destacados colados arriba: un orden que no obedece se siente roto.
export function destacadosPrimero(productos) {
  const lista = Array.isArray(productos) ? productos : [];
  return [...lista.filter(esDestacado), ...lista.filter((p) => !esDestacado(p))];
}
