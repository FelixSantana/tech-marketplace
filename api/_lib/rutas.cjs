// Los enlaces propios por producto, para el lado del servidor: /p/<nombre-en-guiones>-<sufijo>
//
// Copia de src/lib/rutas.js, por lo mismo que tienda.cjs: `src/` son modulos ES que Vite compila
// para el navegador y `api/_lib/` es CommonJS que ejecuta Node en una funcion.
//
// Aqui la copia importa mas que en ningun otro sitio. El mapa del sitio anuncia estas URLs y el
// manejador de /p/ las resuelve; si las dos mitades dejan de generar el mismo texto, el mapa le
// daria a Google 23 direcciones que al abrirse redirigen a la portada. Una prueba compara las dos
// copias sobre los mismos productos.
const sinAcentos = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '');

const sufijoDeId = (id) => String(id || '').split('_').pop().slice(-6).toLowerCase();

function slugProducto(producto) {
  const nombre = sinAcentos(producto && producto.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  const sufijo = sufijoDeId(producto && producto.id);
  return nombre ? `${nombre}-${sufijo}` : sufijo;
}

module.exports = { slugProducto, sufijoDeId };
