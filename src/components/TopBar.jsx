import { NEGOCIO, falta } from '../proto-negocio';

// PROTOTIPO D — barra superior. Las tres tiendas dominicanas que se miraron
// (Cecomsa, Data Import, Omega) ponen arriba del todo lo mismo: telefono,
// horario y cobertura. Es la linea que dice "esto es un negocio, no el catalogo
// de alguien", y es lo primero que ve el que llega desconfiando.
const telefonoVisible = (whatsapp) => {
  const d = String(whatsapp || '').replace(/\D/g, '');
  if (d.length < 10) return '';
  const n = d.slice(-10);
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
};

export default function TopBar({ settings }) {
  const tel = telefonoVisible(settings.whatsapp);
  return (
    <div className="topbar">
      <div className="topbar-inner">
        <span className="topbar-item">
          <span aria-hidden="true">✆</span>
          {tel ? <a href={`https://wa.me/${String(settings.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">{tel}</a> : <em className="falta">{falta('teléfono')}</em>}
        </span>
        <span className="topbar-item">
          <span aria-hidden="true">◷</span>
          {NEGOCIO.horario || <em className="falta">{falta('horario de atención')}</em>}
        </span>
        <span className="topbar-item topbar-cobertura">
          <span aria-hidden="true">⛟</span>
          {NEGOCIO.cobertura}
        </span>
      </div>
    </div>
  );
}
