// El mismo nombre por defecto que usa la tienda, para el lado del servidor.
//
// Esta duplicado a proposito, igual que lo esta la logica de variantes entre useCatalog.js y
// producto-html.cjs: `src/` son modulos ES que compila Vite para el navegador y `api/_lib/` son
// CommonJS que ejecuta Node en una funcion. No comparten resolucion de modulos, y montar un
// paquete comun para dos lineas costaria mas de lo que ahorra.
//
// Si cambia aqui, cambia en src/lib/tienda.js. Una prueba comprueba que los dos digan lo mismo.
const NOMBRE_POR_DEFECTO = 'Mi tienda';

function nombreDeTienda(settings) {
  const n = String((settings && settings.storeName) || '').trim();
  return n || NOMBRE_POR_DEFECTO;
}

module.exports = { NOMBRE_POR_DEFECTO, nombreDeTienda };
