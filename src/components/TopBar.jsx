import { NEGOCIO } from '../lib/negocio';

// Barra superior: telefono, horario y cobertura. Es lo primero que ve quien llega
// desconfiando, y la linea que dice "esto es un negocio". Las tres tiendas de
// tecnologia del pais que se miraron (Cecomsa, Data Import, Omega) ponen lo mismo.
//
// Un dato que no existe no se inventa ni se marca: su trozo no se dibuja.
const telefonoVisible = (whatsapp) => {
  const d = String(whatsapp || '').replace(/\D/g, '');
  if (d.length < 10) return '';
  const n = d.slice(-10);
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
};

export default function TopBar({ settings }) {
  const tel = telefonoVisible(settings.whatsapp);
  if (!tel && !NEGOCIO.horario && !NEGOCIO.cobertura) return null;
  return (
    <div className="topbar">
      <div className="topbar-inner">
        {tel && (
          <span className="topbar-item">
            <span aria-hidden="true">✆</span>
            <a href={`https://wa.me/${String(settings.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">{tel}</a>
          </span>
        )}
        {NEGOCIO.horario && <span className="topbar-item"><span aria-hidden="true">◷</span>{NEGOCIO.horario}</span>}
        {NEGOCIO.cobertura && <span className="topbar-item topbar-cobertura"><span aria-hidden="true">⛟</span>{NEGOCIO.cobertura}</span>}
      </div>
    </div>
  );
}
