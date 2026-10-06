import { SELLOS } from '../lib/negocio';

// Los tres sellos. Ninguna de las tiendas grandes del país comunica el estado de un equipo
// usado, y es exactamente lo que frena al comprador de segunda mano. Van arriba de la rejilla,
// donde se leen antes que los precios.
// Cada dibujo va centrado en su viewBox de 24x24: el recuadro los centra a ellos, pero si el
// trazo no esta centrado DENTRO del viewBox, el icono sale torcido igual. Una prueba lo comprueba.
const ICONOS = {
  probado: <path d="m4.5 12.5 5 5 10-11" />,
  garantia: <path d="M12 3 4.5 6v6c0 4.2 3 7.7 7.5 9 4.5-1.3 7.5-4.8 7.5-9V6L12 3Z" />,
  entrega: <><path d="M3.5 5.7h10v9h-10zM13.5 8.7h4l3 3v3h-7z" /><circle cx="7.5" cy="16.7" r="1.6" /><circle cx="17.5" cy="16.7" r="1.6" /></>,
};

export default function TrustBadges() {
  return (
    <div className="sellos">
      {SELLOS.map((s) => (
        <div className="sello" key={s.titulo}>
          <span className="sello-icono" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {ICONOS[s.icono] || ICONOS.probado}
            </svg>
          </span>
          <div className="sello-texto">
            <strong>{s.titulo}</strong>
            <span>{s.nota}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
