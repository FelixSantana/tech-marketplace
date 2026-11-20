import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { pdfDeCotizacion, entregarArchivo, puedeCompartirArchivos } from '../../lib/cotizacionPdf';
import { numeroDeCotizacion } from '../../lib/cotizacion';
import { IconoDescargar } from '../Iconos';

// Ver la cotizacion antes de soltarla.
//
// Un presupuesto se le manda a un cliente y no se puede retirar: un precio mal tecleado o un
// renglon que se quedo a medias se descubre cuando ya esta en su WhatsApp. Por eso se enseña
// primero el PDF de VERDAD —el mismo archivo que se va a entregar, no una imitacion dibujada
// con HTML— y el boton de descargar entrega ESE blob, no uno nuevo. Lo que se mira y lo que se
// manda son el mismo byte.
//
// La vista va en un <iframe>, que es el visor que ya trae el navegador. En iOS a veces solo
// enseña la primera pagina o nada en absoluto, asi que debajo hay un enlace para abrirlo en
// otra pestaña: ahi Safari usa su visor de siempre.
export default function CotizacionPreview({ cotizacion, settings, onClose, showToast }) {
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState('');
  const [entregando, setEntregando] = useState(false);
  const compartir = puedeCompartirArchivos();

  // Generar el PDF al abrir. El estado se toca despues del await, que es el caso que la regla
  // exime (sincronizar con algo de fuera), pero la regla no puede verlo.
  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    let vivo = true;
    let url = '';
    (async () => {
      try {
        const { blob, nombre } = await pdfDeCotizacion(cotizacion, settings);
        if (!vivo) return;
        url = URL.createObjectURL(blob);
        setArchivo({ url, blob, nombre });
      } catch (e) {
        console.error('vista previa de cotizacion', e);
        if (vivo) setError('No se pudo generar el PDF.');
      }
    })();
    // Se suelta la URL al cerrar. Sin esto, cada vista previa deja un PDF entero en memoria
    // hasta que se recargue la pagina.
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [cotizacion, settings]);

  useEffect(() => {
    const alPulsar = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [onClose]);

  const entregar = async () => {
    if (!archivo) return;
    setEntregando(true);
    try {
      const resultado = await entregarArchivo(archivo.blob, archivo.nombre);
      if (resultado === 'descargado') showToast('PDF descargado');
      if (resultado === 'compartido') showToast('PDF enviado');
    } catch (e) {
      console.error('entregar cotizacion', e);
      showToast('No se pudo entregar el PDF.');
    } finally {
      setEntregando(false);
    }
  };

  return createPortal(
    <div className="pdf-preview" role="dialog" aria-modal="true" aria-label={`Vista previa de la cotización ${numeroDeCotizacion(cotizacion)}`}>
      <div className="pdf-preview-barra">
        <div>
          <strong>Cotización {numeroDeCotizacion(cotizacion)}</strong>
          <span>{cotizacion.cliente}</span>
        </div>
        <div className="pdf-preview-acciones">
          {archivo && <a className="btn-secondary" href={archivo.url} target="_blank" rel="noopener noreferrer">Abrir aparte</a>}
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="btn-primary" disabled={!archivo || entregando} onClick={entregar}>
            <IconoDescargar size={14} /> {compartir ? 'Compartir PDF' : 'Descargar PDF'}
          </button>
        </div>
      </div>

      <div className="pdf-preview-cuerpo">
        {error ? (
          <div className="pdf-preview-aviso"><p>{error}</p><button className="btn-secondary" onClick={onClose}>Cerrar</button></div>
        ) : !archivo ? (
          <div className="pdf-preview-aviso"><p>Preparando el PDF…</p></div>
        ) : (
          <iframe title={`Cotización ${numeroDeCotizacion(cotizacion)}`} src={archivo.url} />
        )}
      </div>
    </div>,
    document.body,
  );
}
