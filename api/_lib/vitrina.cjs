// Lo que el SERVIDOR necesita saber del escaparate. La version del navegador esta en
// src/lib/vitrina.js; aqui solo esta lo que hace falta para el HTML y los datos estructurados,
// y una prueba comprueba que las dos no se separan.

// schema.org tiene un vocabulario para el estado de lo que se vende, y Google lo usa: en los
// resultados de compras distingue nuevo de usado. Decirlo es gratis y es exactamente lo que
// busca quien compra de segunda mano.
//
// "Con detalles esteticos" es UsedCondition, no DamagedCondition: un equipo con una marca en
// la tapa no esta dañado, y declararlo asi espantaria compras que no tenia por que espantar.
const CONDICION = {
  nuevo: 'https://schema.org/NewCondition',
  'como-nuevo': 'https://schema.org/UsedCondition',
  'muy-bueno': 'https://schema.org/UsedCondition',
  'con-detalles': 'https://schema.org/UsedCondition',
};

// Sin estado declarado no se afirma nada. Suponer "nuevo" por defecto en una tienda de usados
// seria mentir en los resultados de Google, que es donde mas caro sale.
const condicionDe = (producto) => CONDICION[producto && producto.estado && producto.estado.nivel] || '';

// Mismas reglas que ofertaDeProducto en el navegador: un "antes" que no supera al precio de
// hoy, o que no llega al 5%, no es una oferta.
const MINIMO_DESCUENTO = 5;

function ofertaDe(producto, precioAhora) {
  if (!producto || (Array.isArray(producto.variants) && producto.variants.length)) return null;
  const antes = Number(producto.precioAntes);
  const ahora = Number(precioAhora != null ? precioAhora : producto.price);
  if (!Number.isFinite(antes) || !Number.isFinite(ahora) || antes <= ahora || ahora < 0) return null;
  const porciento = Math.floor(((antes - ahora) / antes) * 100);
  return porciento < MINIMO_DESCUENTO ? null : { antes, ahora, porciento };
}

const esDestacado = (producto) => Boolean(producto && producto.destacado);

// El mismo orden que ve el visitante en "Recomendados". Si el HTML servido ordenara distinto,
// el rastreador y la persona verian catalogos diferentes.
function destacadosPrimero(productos) {
  const lista = Array.isArray(productos) ? productos : [];
  return [...lista.filter(esDestacado), ...lista.filter((p) => !esDestacado(p))];
}

const UMBRAL_POCAS = 2;

module.exports = { CONDICION, condicionDe, ofertaDe, esDestacado, destacadosPrimero, UMBRAL_POCAS, MINIMO_DESCUENTO };
