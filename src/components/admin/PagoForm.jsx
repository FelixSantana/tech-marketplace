import { useId, useState } from 'react';
import { compressImage } from '../../lib/utils';
import { uploadImage } from '../../lib/uploadImage';
import { metodosDisponibles, sugiereEvidencia, MAX_EVIDENCIAS } from '../../lib/pago';

// Como se pago esta orden. Metodo, referencia y comprobantes.
//
// Los comprobantes SOLO se guardan como URL del almacen. uploadImage, cuando el almacen falla o
// no esta configurado, devuelve la imagen incrustada para que el panel siga funcionando; aqui
// eso no sirve y se rechaza, porque las ordenes viven todas en una sola clave de Redis y una
// captura en base64 la reventaria. Perder un comprobante es malo; perder las mil ordenes es
// irreparable. Por eso, cuando pasa, se dice en vez de guardar a medias.
export default function PagoForm({ pago, setPago, settings, adminToken, showToast }) {
  const uid = useId();
  const [subiendo, setSubiendo] = useState(false);

  const metodos = metodosDisponibles(settings);
  const evidencias = Array.isArray(pago.evidencias) ? pago.evidencias : [];
  const cambiar = (campo, valor) => setPago({ ...pago, [campo]: valor });
  const faltanComprobantes = sugiereEvidencia(pago.metodo) && evidencias.length === 0;

  const adjuntar = async (e) => {
    const archivos = [...(e.target.files || [])];
    e.target.value = '';
    if (!archivos.length) return;
    const sitio = MAX_EVIDENCIAS - evidencias.length;
    if (sitio <= 0) return showToast(`Ya hay ${MAX_EVIDENCIAS} comprobantes en esta orden.`);

    setSubiendo(true);
    try {
      const nuevas = [];
      for (const archivo of archivos.slice(0, sitio)) {
        const comprimida = await compressImage(archivo);
        const r = await uploadImage(comprimida, adminToken, 'pagos');
        if (r.error) { showToast(r.error); continue; }
        if (r.incrustada) { showToast('No se pudo subir el comprobante al almacén. Vuelve a intentarlo.'); continue; }
        nuevas.push(r.url);
      }
      if (nuevas.length) setPago({ ...pago, evidencias: [...evidencias, ...nuevas] });
      if (archivos.length > sitio) showToast(`Solo caben ${MAX_EVIDENCIAS} comprobantes por orden.`);
    } finally {
      setSubiendo(false);
    }
  };

  // Se quita de la orden, no del almacen: si el dueño se equivoca al quitarlo, el enlace sigue
  // existiendo y se puede volver a pegar. Borrar el archivo seria irreversible desde un boton
  // que se pulsa sin pensar.
  const quitar = (url) => setPago({ ...pago, evidencias: evidencias.filter((u) => u !== url) });

  return (
    <div className="pago-form">
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${uid}-metodo`}>Método de pago</label>
          <select id={`${uid}-metodo`} value={pago.metodo || ''} onChange={(e) => cambiar('metodo', e.target.value)}>
            <option value="">Sin anotar</option>
            {metodos.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${uid}-ref`}>Referencia</label>
          <input
            id={`${uid}-ref`} type="text" maxLength={60} value={pago.referencia || ''}
            onChange={(e) => cambiar('referencia', e.target.value)}
            placeholder="Nº de transferencia, voucher…"
          />
        </div>
      </div>

      <div className="pago-evidencias">
        <div className="pago-evidencias-cab">
          <strong>Comprobantes</strong>
          <span>{evidencias.length} de {MAX_EVIDENCIAS}</span>
        </div>

        {evidencias.length > 0 && (
          <div className="pago-miniaturas">
            {evidencias.map((url) => (
              <div className="pago-miniatura" key={url}>
                {/* Se abre en otra pestaña porque una captura de transferencia hay que poder
                    leerla: el numero de operacion no se distingue en una miniatura. */}
                <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="Comprobante de pago" /></a>
                <button type="button" className="pago-quitar" onClick={() => quitar(url)} aria-label="Quitar este comprobante" title="Quitar">✕</button>
              </div>
            ))}
          </div>
        )}

        {evidencias.length < MAX_EVIDENCIAS && (
          <label className={`upload-btn pago-adjuntar ${subiendo ? 'ocupado' : ''}`}>
            {subiendo ? 'Subiendo…' : 'Adjuntar comprobante'}
            <input type="file" accept="image/*" multiple hidden disabled={subiendo} onChange={adjuntar} />
          </label>
        )}

        <div className="hint">
          {faltanComprobantes
            ? `Un pago por ${pago.metodo.toLowerCase()} deja rastro: adjunta la captura y no tendrás que buscarla después.`
            : 'La captura de la transferencia o el voucher. Se guardan solo en esta orden.'}
        </div>
      </div>
    </div>
  );
}
