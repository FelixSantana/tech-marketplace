import { NEGOCIO } from '../lib/negocio';

// Los tres sellos. Ninguna de las tiendas grandes del país comunica el estado de un equipo
// usado, y es exactamente lo que frena al comprador de segunda mano. Van arriba de la rejilla,
// donde se leen antes que los precios.
const ICONOS = {
  probado: <path d="m4.5 12.5 5 5 10-11" />,
  garantia: <path d="M12 3 4.5 6v6c0 4.2 3 7.7 7.5 9 4.5-1.3 7.5-4.8 7.5-9V6L12 3Z" />,
  entrega: <><path d="M3 7h10v9H3zM13 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>,
};

export default function TrustBadges() {
  return (
    <div className="sellos">
      {NEGOCIO.sellos.map((s) => (
        <div className="sello" key={s.titulo}>
          <span className="sello-icono" aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {ICONOS[s.icono] || ICONOS.probado}
            </svg>
          </span>
          <div>
            <strong>{s.titulo}</strong>
            <span>{s.nota}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
