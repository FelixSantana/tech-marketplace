import { datosDeNegocio } from '../lib/negocio';
import { nombreDeTienda } from '../lib/tienda';

// El pie. Es la parte mas aburrida de la tienda y la que mas separa "tienda real"
// de "catalogo de alguien": RNC, direccion, horario, como se paga y que cubre la
// garantia. El cliente que duda baja hasta aqui antes de escribir por WhatsApp.
//
// Cada dato vacio se calla: mejor un pie corto y cierto que uno lleno e inventado.
export default function StoreFooter({ settings }) {
  const negocio = datosDeNegocio(settings);
  const nombre = nombreDeTienda(settings);
  const hayUbicacion = negocio.direccion || negocio.horario || negocio.cobertura;
  return (
    <footer className="pie">
      <div className="pie-inner">
        <div className="pie-col">
          <strong>{nombre}</strong>
          {settings.tagline && <p>{settings.tagline}</p>}
          {negocio.rnc && <p className="pie-linea">RNC {negocio.rnc}</p>}
          {negocio.correo && <p className="pie-linea">{negocio.correo}</p>}
        </div>

        {hayUbicacion && (
          <div className="pie-col">
            <strong>Dónde estamos</strong>
            {negocio.direccion && <p className="pie-linea">{negocio.direccion}</p>}
            {negocio.horario && <p className="pie-linea">{negocio.horario}</p>}
            {negocio.cobertura && <p className="pie-linea">{negocio.cobertura}</p>}
          </div>
        )}

        {negocio.pagos.length > 0 && <div className="pie-col">
          <strong>Cómo se paga</strong>
          <ul className="pie-pagos">{negocio.pagos.map((p) => <li key={p}>{p}</li>)}</ul>
          {/* Cuando se afilie el enlace de pago de AZUL, aqui van sus logos. */}
        </div>}

        <div className="pie-col">
          <strong>Garantía y devoluciones</strong>
          <p className="pie-linea">La garantía de cada equipo aparece en su ficha, junto al precio.</p>
          <p className="pie-linea">Para reclamar, escríbenos por WhatsApp con tu número de pedido.</p>
        </div>
      </div>
      <div className="pie-legal">
        © {new Date().getFullYear()} {nombre} · Los precios pueden variar sin previo aviso
      </div>
    </footer>
  );
}
