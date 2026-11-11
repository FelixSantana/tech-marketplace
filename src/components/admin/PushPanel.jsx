import { useCallback, useEffect, useState } from 'react';
import { IconoCampana } from '../Iconos';
import { clavePublicaEnBytes, porQueNoSePuede, aDatosPlanos, MOTIVOS, EXPLICACION } from '../../lib/push';

// Avisos de pedido nuevo.
//
// Hoy el dueño se entera de un pedido solo si el cliente llega a pulsar enviar en WhatsApp, o si
// entra al panel a mirar. El pedido queda guardado igual, asi que hay pedidos que esperan medio
// dia sin que nadie lo sepa, y en una tienda de WhatsApp eso es un pedido perdido.
//
// La activacion es POR DISPOSITIVO, no por cuenta: el permiso lo da el navegador de cada
// telefono. Por eso lo que se enseña no es "activado/desactivado" sino "activado EN ESTE
// dispositivo", y aparte cuantos hay en total. Sin esa distincion, el dueño que lo activo en el
// movil abre el panel en la computadora, lee "activado" y cree que ahi tambien le va a sonar.
const peticion = async (token, cuerpo) => {
  const r = await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || data.error || 'No se pudo completar la operación.');
  return data;
};

export default function PushPanel({ adminToken, showToast }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [servidor, setServidor] = useState({ listo: false, clavePublica: '', dispositivos: 0 });
  const [aqui, setAqui] = useState(false);
  const [trabajando, setTrabajando] = useState('');

  // La suscripcion de ESTE navegador, si la hay. Se lee del service worker, no del servidor:
  // el servidor sabe cuantos dispositivos hay, pero no cual de ellos es este.
  const suscripcionLocal = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }, []);

  const cargar = useCallback(async () => {
    try {
      const data = await peticion(adminToken, { action: 'estado' });
      const sub = await suscripcionLocal().catch(() => null);
      setError('');
      setServidor({ listo: !!data.listo, clavePublica: data.clavePublica || '', dispositivos: Number(data.dispositivos) || 0 });
      setAqui(!!sub);
    } catch (e) { setError(e.message); }
    finally { setCargando(false); }
  }, [adminToken, suscripcionLocal]);

  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => { cargar(); }, [cargar]);

  const motivo = porQueNoSePuede({ listo: servidor.listo });

  const activar = async () => {
    setTrabajando('activar');
    try {
      // El permiso se pide aqui y no al abrir Ajustes a proposito: un navegador que ve pedir
      // permiso sin que nadie haya pulsado nada lo puede denegar de golpe y para siempre.
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') throw new Error('No diste permiso para los avisos.');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        // Sin esto el navegador acepta mandar avisos que el usuario nunca ve, y Chrome lo
        // rechaza directamente.
        userVisibleOnly: true,
        applicationServerKey: clavePublicaEnBytes(servidor.clavePublica),
      });
      const datos = aDatosPlanos(sub);
      if (!datos) throw new Error('El navegador no entregó una suscripción válida.');
      const r = await peticion(adminToken, { action: 'suscribir', subscription: datos });
      setAqui(true);
      setServidor((s) => ({ ...s, dispositivos: Number(r.dispositivos) || s.dispositivos }));
      showToast('Avisos activados en este dispositivo');
    } catch (e) { showToast(e.message); }
    finally { setTrabajando(''); }
  };

  const desactivar = async () => {
    setTrabajando('desactivar');
    try {
      const sub = await suscripcionLocal();
      // Se da de baja en los dos sitios. Solo en el navegador, el servidor seguiria gastando un
      // intento por este dispositivo en cada pedido; solo en el servidor, el navegador seguiria
      // recibiendo hasta que algo lo caducara.
      if (sub) { await peticion(adminToken, { action: 'desuscribir', endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
      setAqui(false);
      await cargar();
      showToast('Avisos desactivados en este dispositivo');
    } catch (e) { showToast(e.message); }
    finally { setTrabajando(''); }
  };

  const probar = async () => {
    setTrabajando('probar');
    try {
      await peticion(adminToken, { action: 'probar' });
      showToast('Aviso de prueba enviado');
    } catch (e) { showToast(e.message); }
    finally { setTrabajando(''); }
  };

  return (
    <div className="push-panel">
      <div className="form-section-title" style={{ marginTop: 18 }}>
        <span className="section-icon"><IconoCampana /></span>
        <div><h3>Avisos de pedido nuevo</h3><p>Una notificación en el teléfono apenas alguien termina un pedido, aunque no llegue a escribirte por WhatsApp.</p></div>
      </div>

      {cargando && <div className="empty-state" style={{ padding: 16 }}><p>Comprobando…</p></div>}

      {!cargando && error && (
        <div className="empty-state" style={{ padding: 16 }}><p>{error}</p><button type="button" className="btn-secondary" onClick={() => { setCargando(true); cargar(); }}>Reintentar</button></div>
      )}

      {!cargando && !error && motivo !== MOTIVOS.LISTO && (
        <div className="push-aviso">{EXPLICACION[motivo]}</div>
      )}

      {!cargando && !error && motivo === MOTIVOS.LISTO && (
        <div className="push-estado">
          <div className={`push-punto ${aqui ? 'activo' : ''}`} aria-hidden="true" />
          <div className="push-texto">
            <strong>{aqui ? 'Activados en este dispositivo' : 'Apagados en este dispositivo'}</strong>
            <small>
              {servidor.dispositivos === 0 && 'Ningún dispositivo recibe avisos todavía.'}
              {servidor.dispositivos === 1 && (aqui ? 'Este es el único dispositivo con avisos.' : 'Hay otro dispositivo con avisos.')}
              {servidor.dispositivos > 1 && `${servidor.dispositivos} dispositivos reciben avisos.`}
            </small>
          </div>
          <div className="push-acciones">
            {aqui ? (
              <>
                <button type="button" className="btn-secondary" onClick={probar} disabled={!!trabajando}>{trabajando === 'probar' ? 'Enviando…' : 'Probar'}</button>
                <button type="button" className="btn-secondary" onClick={desactivar} disabled={!!trabajando}>{trabajando === 'desactivar' ? 'Apagando…' : 'Apagar aquí'}</button>
              </>
            ) : (
              <button type="button" className="btn-primary" onClick={activar} disabled={!!trabajando}>{trabajando === 'activar' ? 'Activando…' : 'Avisarme aquí'}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
