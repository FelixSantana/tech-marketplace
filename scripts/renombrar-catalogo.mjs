// Renombra los productos del catalogo siguiendo el patron que usan las tiendas
// del pais: TIPO + MARCA + MODELO + las specs que deciden la compra.
//
// Por que: el cliente que compara equipos busca en Google "latitude e7450 i7
// 16gb", no "Dell Latitude E7450". Data Import titula sus laptops seminuevas
// asi —"Laptop Dell Latitude E7450 Core i7 5ta Gen – 16GB RAM"— y por eso
// aparece antes. Ademas, la tarjeta ya no muestra la ficha tecnica: si las specs
// no estan en el nombre, no estan en ninguna parte de la rejilla.
//
// NADA DE LO QUE VA AQUI ESTA INVENTADO. Cada nombre nuevo sale de la propia
// descripcion del producto en el catalogo; donde la descripcion no dice el
// procesador o la RAM, el nombre no los menciona. Inventar una spec en una
// tienda es prometer algo que el equipo no tiene.
//
//   node scripts/renombrar-catalogo.mjs              # simula, no escribe nada
//   ADMIN_TOKEN=xxx node scripts/renombrar-catalogo.mjs --aplicar
//
// El token de sesion se saca del panel ya abierto (consola del navegador:
// localStorage.admin_token) y se pasa por variable de entorno, nunca pegado en
// un chat ni guardado en el repo. Si algo sale mal, el historial del catalogo
// guarda una copia de antes: Ajustes → Historial del catálogo → Restaurar.

const BASE = process.env.TIENDA_URL || 'https://synaptic-tech-catalogo.vercel.app';
const TOKEN = process.env.ADMIN_TOKEN || '';
const APLICAR = process.argv.includes('--aplicar');

// id del producto → nombre nuevo. Los ids no cambian, asi que los enlaces /p/ que
// ya circulan por WhatsApp siguen funcionando aunque cambie el nombre: el slug se
// resuelve por el sufijo del id (ver src/lib/rutas.js).
const NOMBRES = {
  // --- Laptops: procesador, generacion, RAM y almacenamiento, que es lo que se compara
  p_1784335177257_era4q: 'Laptop Dell Latitude 3190 Pentium Silver N3050 – 11.6" 128GB',
  p_1784357041626_ctp5d: 'Laptop Dell Latitude E7450 Core i7 5ta Gen – 16GB RAM 120GB SSD',
  p_1785000872982_4hi5h: 'Laptop Dell Latitude 5400 Core i5 8va Gen – 8GB RAM 250GB SSD',

  // --- Servicios: decir que se hace, no solo la palabra suelta
  p_1784647753461_9akp2: 'Mantenimiento de CPU de escritorio',
  p_1784648018225_y3vco: 'Mantenimiento de laptop',
  p_1784662173492_ut648: 'Desarrollo de software a medida – apps y web',

  // --- Accesorios
  p_1784648264081_q1ias: 'Headset Gamer Fantech HQ53 – Negro',
  p_1784649150150_1om33: 'Micrófono Gamer Fantech Leviosa Wave WMCX01 – Wireless 2.4GHz / USB-C',
  p_1787326427051_aqj11: 'Mouse USB usado – modelo mixto',
  p_1787326540049_b8bo3: 'Mouse Dell MS116 USB – Nuevo',
  p_1787329075122_4e9vg: 'HUB Havit HB41 USB-C – 1x USB 3.0 y 3x USB 2.0',
  p_1787329433643_ol80h: 'Adaptador DisplayPort a VGA Venlogic EP-D616 – Full HD',
  p_1787336409833_8cggb: 'Teclado Gamer Fantech K515S – 104 teclas RGB USB',
  p_1787336546831_c7qrj: 'Mouse Gamer Fantech G13 – 4800 DPI, 6 botones',
  p_1788409630655_hnvqt: 'Mouse Gamer Fantech VX9 Kanata – USB cableado',
  p_1789482457536_qfzat: 'Fan Cooler Havit HV-F2083 – Laptops de 14" a 17", 2 ventiladores',
  p_1789662297188_jhbl7: 'Power Bank Agiler 20,000 mAh – USB-C, Lightning y Micro USB',
  p_1789664281760_p5s1g: 'Power Bank Chargeworx Graffiti 10,000 mAh – USB-C y USB-A',

  // --- Impresoras, monitor y case
  p_1787325554271_mikby: 'Impresora Epson L1250 EcoTank – Tinta continua, WiFi',
  p_1788409061335_pspcm: 'Impresora Láser Pantum P2509W – Monocromática, WiFi, 23 ppm',
  p_1788409391368_q7irt: 'Impresora Térmica AOKIA AK-3358 – POS 58mm, 70mm/s',
  p_1788406568446_47mup: 'Monitor Dahua LM22-A200Y 22" – Full HD 100Hz',
  p_1788410758023_ikdx3: 'Case Gaming XCON S270-6B ATX – 5 ventiladores RGB',
};

// La misma garantia estaba escrita de tres formas ("1 Año", "1 año", "1 ano").
// Ahora que se muestra en cada tarjeta, la inconsistencia se ve de un vistazo.
const normalizarGarantia = (g) => {
  const t = String(g || '').trim();
  if (!t) return '';
  const m = t.match(/^(\d+)\s*(a[ñn]os?|meses?|mes)$/i);
  if (!m) return t;
  const n = Number(m[1]);
  const unidad = /a[ñn]/i.test(m[2]) ? (n === 1 ? 'año' : 'años') : (n === 1 ? 'mes' : 'meses');
  return `${n} ${unidad}`;
};

// Dos productos quedaron sin categoria y por eso no salen al filtrar por ninguna.
const CATEGORIAS = {
  p_1789482457536_qfzat: 'Accesorios',   // fan cooler
  p_1789664281760_p5s1g: 'Accesorios',   // power bank
};

const pedir = async (ruta, opciones) => {
  const r = await fetch(`${BASE}${ruta}`, opciones);
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${cuerpo.error || ''} ${cuerpo.message || ''}`.trim());
  return cuerpo;
};

const catalogo = await pedir('/api/catalog', { cache: 'no-store' });
const cambios = [];

const productos = catalogo.products.map((p) => {
  const nombre = NOMBRES[p.id] || p.name;
  const garantia = normalizarGarantia(p.warranty);
  const categoria = CATEGORIAS[p.id] || p.category;
  if (nombre !== p.name) cambios.push(['nombre', p.name, nombre]);
  if (garantia !== (p.warranty || '')) cambios.push(['garantía', `${p.name}: ${p.warranty}`, garantia]);
  if (categoria !== p.category) cambios.push(['categoría', `${p.name}: ${p.category || '(sin categoría)'}`, categoria]);
  return { ...p, name: nombre, warranty: garantia, category: categoria };
});

const sinTocar = catalogo.products.filter((p) => !NOMBRES[p.id]).map((p) => p.name);
console.log(`Catálogo versión ${catalogo.version} · ${catalogo.products.length} productos · ${cambios.length} cambios`);
for (const [tipo, antes, despues] of cambios) console.log(`  [${tipo}] ${antes}\n      → ${despues}`);
if (sinTocar.length) console.log(`\nSin nombre nuevo (no están en el mapa): ${sinTocar.join(', ')}`);

if (!APLICAR) {
  console.log('\nSimulación. Para escribirlo:  ADMIN_TOKEN=<tu token> node scripts/renombrar-catalogo.mjs --aplicar');
  process.exit(0);
}
if (!TOKEN) {
  console.error('\nFalta ADMIN_TOKEN. Sácalo del panel abierto: consola del navegador → localStorage.admin_token');
  process.exit(1);
}

// Se manda la version leida: si alguien guardo entre medio, el servidor responde
// 409 y este script se detiene en vez de pisar ese cambio.
const respuesta = await pedir('/api/catalog', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify({ settings: catalogo.settings, products: productos, categories: catalogo.categories, version: catalogo.version }),
});
console.log(`\nListo. Catálogo guardado en la versión ${respuesta.version}.`);
console.log('Si algo no cuadra: panel → Ajustes → Historial del catálogo → Restaurar la copia anterior.');
