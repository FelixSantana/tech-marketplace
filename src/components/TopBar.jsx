import { datosDeNegocio } from '../lib/negocio';
import { telefonoVisible } from '../lib/texto';
import { IconoTelefono, IconoReloj, IconoCamion } from './Iconos';

// Barra superior: telefono, horario y cobertura. Es lo primero que ve quien llega
// desconfiando, y la linea que dice "esto es un negocio". Las tres tiendas de
// tecnologia del pais que se miraron (Cecomsa, Data Import, Omega) ponen lo mismo.
//
// Un dato que no existe no se inventa ni se marca: su trozo no se dibuja.
//
// El formato del telefono vive en lib/texto porque el membrete de las cotizaciones necesita
// escribirlo igual: el mismo numero no puede salir "(829) 555-0123" en la tienda y
// "8295550123" en el papel que se le manda al cliente.
export default function TopBar({ settings }) {
  const negocio = datosDeNegocio(settings);
  const tel = telefonoVisible(settings.whatsapp);
  if (!tel && !negocio.horario && !negocio.cobertura) return null;
  return (
    <div className="topbar">
      <div className="topbar-inner">
        {tel && (
          <span className="topbar-item">
            <IconoTelefono size={13} />
            <a href={`https://wa.me/${String(settings.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">{tel}</a>
          </span>
        )}
        {negocio.horario && <span className="topbar-item"><IconoReloj size={13} />{negocio.horario}</span>}
        {negocio.cobertura && <span className="topbar-item topbar-cobertura"><IconoCamion size={13} />{negocio.cobertura}</span>}
      </div>
    </div>
  );
}
