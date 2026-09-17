// Aviso de privacidad del checkout. Texto de partida, pensado para la Ley 172-13 de
// Republica Dominicana: conviene que lo revise un abogado antes de darlo por definitivo.
export default function PrivacyNotice({ settings, onClose }) {
  const tienda = settings.storeName || 'Synaptic Tech';
  return (
    <div className="overlay" onClick={(e) => { if (e.target.classList.contains('overlay')) onClose(); }}>
      <div className="panel privacy-panel">
        <div className="panel-head">
          <div><span className="checkout-kicker">TUS DATOS</span><h2>Aviso de privacidad</h2></div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="privacy-body">
          <p><strong>Quién guarda tus datos.</strong> {tienda}, como responsable del catálogo y de los pedidos que se hacen desde él.</p>
          <p><strong>Qué datos pedimos.</strong> Tu nombre, tu número de WhatsApp y, si eliges entrega a domicilio, la dirección y las notas que escribas. Nada más: no pedimos cédula, correo ni datos de tarjetas.</p>
          <p><strong>Para qué los usamos.</strong> Únicamente para registrar tu pedido, contactarte por WhatsApp y coordinar la entrega o el retiro. No los usamos para publicidad ni los vendemos ni los compartimos con terceros con fines comerciales.</p>
          <p><strong>Dónde se guardan.</strong> En los servicios de alojamiento y base de datos que hacen funcionar este catálogo, que son proveedores externos y pueden estar fuera de República Dominicana. Al enviar tu pedido aceptas ese tratamiento.</p>
          <p><strong>Cuánto tiempo.</strong> Conservamos el historial de pedidos para atender garantías y reclamos. Puedes pedir que borremos tus datos cuando quieras.</p>
          <p><strong>Tus derechos.</strong> Puedes pedirnos acceder a tus datos, corregirlos o eliminarlos escribiendo al mismo WhatsApp de la tienda{settings.whatsapp ? ` (${settings.whatsapp})` : ''}. La Ley 172-13 sobre Protección de Datos Personales te reconoce esos derechos.</p>
          <p className="privacy-note">Este texto es un punto de partida preparado para esta tienda y no sustituye la asesoría de un abogado.</p>
        </div>
        <button className="btn-primary" onClick={onClose}>Entendido</button>
      </div>
    </div>
  );
}
