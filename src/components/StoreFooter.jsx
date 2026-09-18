import { NEGOCIO, falta } from '../proto-negocio';

// PROTOTIPO D — el pie. Es la parte mas aburrida y la que mas separa "tienda
// real" de "catalogo de alguien": RNC, direccion, horario, como se paga y que
// cubre la garantia. El cliente que duda baja hasta aqui antes de escribir.
export default function StoreFooter({ settings }) {
  const dato = (valor, etiqueta) => (valor ? <span>{valor}</span> : <em className="falta">{falta(etiqueta)}</em>);
  return (
    <footer className="pie">
      <div className="pie-inner">
        <div className="pie-col">
          <strong>{settings.storeName || 'Synaptic Tech'}</strong>
          <p>{settings.tagline || ''}</p>
          <p className="pie-linea">RNC {dato(NEGOCIO.rnc, 'RNC')}</p>
        </div>

        <div className="pie-col">
          <strong>Dónde estamos</strong>
          <p className="pie-linea">{dato(NEGOCIO.direccion, 'dirección de la tienda')}</p>
          <p className="pie-linea">{dato(NEGOCIO.horario, 'horario de atención')}</p>
          <p className="pie-linea">{NEGOCIO.cobertura}</p>
        </div>

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
        © {new Date().getFullYear()} {settings.storeName || 'Synaptic Tech'} · Los precios pueden variar sin previo aviso
      </div>
    </footer>
  );
}
