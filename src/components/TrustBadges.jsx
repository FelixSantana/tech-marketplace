import { sellosDeAjustes } from '../lib/negocio';
import { IconoVisto, IconoEscudo, IconoCamion, IconoLocal, IconoReloj, IconoCandado, IconoCupon, IconoMapa } from './Iconos';

// Los tres sellos. Ninguna de las tiendas grandes del país comunica el estado de un equipo
// usado, y es exactamente lo que frena al comprador de segunda mano. Van arriba de la rejilla,
// donde se leen antes que los precios.
//
// El texto lo escribe el dueño desde Ajustes: "Equipos probados" vale para una tienda de usados
// y es mentira en una de ropa. El ICONO no: se elige de esta lista, porque dibujarlo pide saber
// hacerlo y un nombre inventado dejaria el hueco vacio.
//
// Cada dibujo va centrado en su viewBox de 24x24: el recuadro los centra a ellos, pero si el
// trazo no esta centrado DENTRO del viewBox, el icono sale torcido igual.
const ICONOS = {
  probado: IconoVisto,
  garantia: IconoEscudo,
  entrega: IconoCamion,
  tienda: IconoLocal,
  reloj: IconoReloj,
  pago: IconoCandado,
  precio: IconoCupon,
  mapa: IconoMapa,
};

export default function TrustBadges({ settings }) {
  const sellos = sellosDeAjustes(settings);
  // Sin sellos no se dibuja el contenedor: una tira vacia deja un hueco con bordes entre la
  // cabecera y los productos, y parece que algo no cargo.
  if (!sellos.length) return null;

  return (
    <div className="sellos">
      {sellos.map((s, i) => {
        const Icono = ICONOS[s.icono] || ICONOS.probado;
        return (
          // La clave lleva el indice porque el dueño puede poner dos sellos con el mismo
          // titulo, y entonces el titulo solo no identifica a ninguno.
          <div className="sello" key={`${s.titulo}-${i}`}>
            <span className="sello-icono" aria-hidden="true"><Icono size={17} /></span>
            <div className="sello-texto">
              <strong>{s.titulo}</strong>
              {s.nota && <span>{s.nota}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
