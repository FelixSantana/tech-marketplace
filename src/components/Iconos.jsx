// Los iconos que la app dibuja para si misma.
//
// Antes eran caracteres sueltos escritos en el JSX: 🛒, 🔒, ⚙, ⛟, 📦. Un caracter no es un
// dibujo, es una peticion al sistema operativo para que dibuje algo, y cada sistema contesta
// distinto: Windows pinta muchos emojis como una caja palida —se veia en la papelera de la
// tabla de ordenes— y ⛟ (U+26DF, "camion negro") falta directamente en casi todas las fuentes,
// asi que donde deberia haber un camion salia el rectangulo del caracter ausente.
//
// Un SVG se dibuja igual en todas partes, hereda currentColor —asi que sigue al tema claro, al
// oscuro y al color de marca del cliente sin una linea mas de CSS— y escala sin pixelarse.
//
// LO QUE NO ESTA AQUI, A PROPOSITO:
//   - Los emojis de CATEGORIA (💻 Laptops, 📱 Celulares...). Esos no son iconos de la app: los
//     elige el cliente desde Ajustes y se guardan en el catalogo. Son contenido suyo.
//   - Los simbolos tipograficos: ✕ para cerrar, × del "×2", · y © del pie. Son letras de
//     verdad, estan en cualquier fuente y se ven igual en todas partes.
//
// Todos comparten el mismo lienzo de 24x24 y el mismo grosor de trazo para que pesen igual
// puestos uno al lado del otro.

function Icono({ size = 16, trazo = 2, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={trazo}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// --- Tienda ---

export const IconoCarrito = (p) => (
  <Icono {...p}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></Icono>
);

export const IconoRejilla = (p) => (
  <Icono {...p}><rect x="3" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" /></Icono>
);

export const IconoLupa = (p) => (
  <Icono {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></Icono>
);

export const IconoEnchufe = (p) => (
  <Icono {...p}><path d="M9 2.5v5.5M15 2.5v5.5M5.5 8h13v2.8a6.5 6.5 0 0 1-13 0V8ZM12 17.3v4.2" /></Icono>
);

export const IconoCandado = (p) => (
  <Icono {...p}><rect x="4" y="10.5" width="16" height="10.5" rx="2.2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></Icono>
);

export const IconoCaja = (p) => (
  <Icono {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12M16.5 9.4 7.5 4.2" /></Icono>
);

// El mismo camion que ya llevan los sellos de confianza, centrado dentro del lienzo: si el
// trazo no esta centrado en el viewBox, el icono sale torcido aunque la caja este centrada.
export const IconoCamion = (p) => (
  <Icono {...p}><path d="M3.5 5.7h10v9h-10zM13.5 8.7h4l3 3v3h-7z" /><circle cx="7.5" cy="16.7" r="1.6" /><circle cx="17.5" cy="16.7" r="1.6" /></Icono>
);

export const IconoSobre = (p) => (
  <Icono {...p}><rect x="2.5" y="5" width="19" height="14" rx="2.2" /><path d="m3.6 7 8.4 6 8.4-6" /></Icono>
);

// --- Panel ---

export const IconoGrafico = (p) => (
  <Icono {...p}><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m7 15 4-5 3.5 3L21 6.5" /></Icono>
);

// Un engranaje de verdad y no una estrella de rayos: con los dientes como lineas rectas el
// dibujo se lee como un sol, que en un panel significa brillo y no configuracion.
export const IconoEngranaje = (p) => (
  <Icono trazo={1.8} {...p}><circle cx="12" cy="12" r="3.1" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.1-1.2L14.2 3H9.8l-.3 2.7a7 7 0 0 0-2.1 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.1 1.2l.3 2.7h4.4l.3-2.7a7 7 0 0 0 2.1-1.2l2.3 1 2-3.4-2-1.5A7 7 0 0 0 19 12Z" /></Icono>
);

export const IconoBombilla = (p) => (
  <Icono {...p}><path d="M9.3 18.5h5.4M10.4 21.5h3.2" /><path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.6.45 1.1 1.15 1.1 1.9v.3h5.4v-.3c0-.75.5-1.45 1.1-1.9A6.5 6.5 0 0 0 12 2.5Z" /></Icono>
);

export const IconoPersona = (p) => (
  <Icono {...p}><circle cx="12" cy="8" r="3.8" /><path d="M4.8 20.5a7.2 7.2 0 0 1 14.4 0" /></Icono>
);

export const IconoEtiqueta = (p) => (
  <Icono {...p}><path d="M20.5 13.3 13.3 20.5a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1-.6-1.5l.3-6a2 2 0 0 1 1.9-1.9l6-.3a2 2 0 0 1 1.5.6l7 7a2 2 0 0 1 0 2.8Z" /><circle cx="8.6" cy="8.6" r="1.3" /></Icono>
);

export const IconoControles = (p) => (
  <Icono {...p}><path d="M4 8h9.5M18.5 8H20M4 16h4.5M13.5 16H20" /><circle cx="16" cy="8" r="2.4" /><circle cx="11" cy="16" r="2.4" /></Icono>
);

export const IconoLocal = (p) => (
  <Icono {...p}><path d="M3.5 9.5 5 4.5h14l1.5 5a3 3 0 0 1-5.75 1.5 3 3 0 0 1-5.5 0A3 3 0 0 1 3.5 9.5Z" /><path d="M5 11.4V20h14v-8.6" /></Icono>
);

export const IconoMapa = (p) => (
  <Icono {...p}><path d="M12 21.5s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10.5" r="2.6" /></Icono>
);

export const IconoRestaurar = (p) => (
  <Icono {...p}><path d="M3.3 12a8.7 8.7 0 1 0 2.5-6.2" /><path d="M3.3 4.6V10h5.4" /></Icono>
);

export const IconoCupon = (p) => (
  <Icono {...p}><path d="M3 9.4V6.6A1.6 1.6 0 0 1 4.6 5h14.8A1.6 1.6 0 0 1 21 6.6v2.8a2.6 2.6 0 0 0 0 5.2v2.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 17.4v-2.8a2.6 2.6 0 0 0 0-5.2Z" /><path d="m14 9-4 6" /></Icono>
);
