import { NEGOCIO } from '../proto-negocio';

// PROTOTIPO D — los tres sellos. Ninguna de las tiendas grandes comunica bien
// el estado de un equipo usado, y es exactamente lo que frena al comprador de
// segunda mano. Aqui va arriba de la rejilla, donde se lee antes de mirar precios.
export default function TrustBadges() {
  return (
    <div className="sellos">
      {NEGOCIO.sellos.map((s) => (
        <div className="sello" key={s.titulo}>
          <span className="sello-icono" aria-hidden="true">{s.icono}</span>
          <div>
            <strong>{s.titulo}</strong>
            <span>{s.nota}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
