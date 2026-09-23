import { NEGOCIO } from '../lib/negocio';

// El pie. Es la parte mas aburrida de la tienda y la que mas separa "tienda real"
// de "catalogo de alguien": RNC, direccion, horario, como se paga y que cubre la
// garantia. El cliente que duda baja hasta aqui antes de escribir por WhatsApp.
//
// Cada dato vacio se calla: mejor un pie corto y cierto que uno lleno e inventado.
export default function StoreFooter({ settings }) {
  const nombre = settings.storeName || 'Synaptic Tech';
  const hayUbicacion = NEGOCIO.direccion || NEGOCIO.horario || NEGOCIO.cobertura;
  return (
    <footer className="pie">
      <div className="pie-inner">
        <div className="pie-col">
          <strong>{nombre}</strong>
          {settings.tagline && <p>{settings.tagline}</p>}
          {NEGOCIO.rnc && <p className="pie-linea">RNC {NEGOCIO.rnc}</p>}
          {NEGOCIO.correo && <p className="pie-linea">{NEGOCIO.correo}</p>}
        </div>

        {hayUbicacion && (
          <div className="pie-col">
            <strong>Dónde estamos</strong>
            {NEGOCIO.direccion && <p className="pie-linea">{NEGOCIO.direccion}</p>}
            {NEGOCIO.horario && <p className="pie-linea">{NEGOCIO.horario}</p>}
            {NEGOCIO.cobertura && <p className="pie-linea">{NEGOCIO.cobertura}</p>}
          </div>
        )}

        <div className="pie-col">
          <strong>Cómo se paga</strong>
          <ul className="pie-pagos">{NEGOCIO.pagos.map((p) => <li key={p}>{p}</li>)}</ul>
          {/* Cuando se afilie el enlace de pago de AZUL, aqui van sus logos. */}
        </div>

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
