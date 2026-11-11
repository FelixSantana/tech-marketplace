import { useId } from 'react';
import { NIVELES_DE_ESTADO, MAX_DESTACADOS, ofertaDeProducto } from '../../lib/vitrina';

// Los campos de escaparate de un producto: estado, oferta y destacado.
//
// Van juntos y separados del resto del formulario porque responden a la misma pregunta —"¿como
// se ve esto en la tienda?"— y porque los tres pueden quedarse vacios sin que pase nada. Lo
// demas del formulario describe el producto; esto decide como se presenta.
export default function VitrinaFields({
  estadoNivel, setEstadoNivel, estadoNota, setEstadoNota,
  precioAntes, setPrecioAntes, precio,
  destacado, setDestacado, destacadosUsados, moneda,
}) {
  const uid = useId();

  // La vista previa de la oferta usa la MISMA funcion que la tienda, no una copia: si aqui
  // dijera "−50%" y la tienda no lo enseñara, el dueño no tendria forma de entender por que.
  const oferta = ofertaDeProducto({ price: Number(precio), precioAntes: Number(precioAntes) });
  const hayAntes = String(precioAntes || '').trim() !== '' && Number(precioAntes) > 0;

  // Al llegar al tope hay que decirlo ANTES de que lo intente, no despues de guardar.
  const topeAlcanzado = !destacado && destacadosUsados >= MAX_DESTACADOS;

  return (
    <div className="vitrina-fields">
      <div className="field">
        <label htmlFor={`${uid}-nivel`}>Estado del equipo</label>
        <select id={`${uid}-nivel`} value={estadoNivel} onChange={(e) => setEstadoNivel(e.target.value)}>
          <option value="">No decirlo</option>
          {NIVELES_DE_ESTADO.map((n) => <option key={n.valor} value={n.valor}>{n.nombre}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor={`${uid}-nota`}>Detalles del estado</label>
        <input
          id={`${uid}-nota`} type="text" maxLength={120} value={estadoNota}
          onChange={(e) => setEstadoNota(e.target.value)}
          placeholder="Ej. Batería 87%. Marca leve en la tapa."
        />
        <div className="hint">
          Lo concreto es lo que convence: el porcentaje de la batería, dónde está el rayón, cuánto se usó.
          Un nivel sin detalles suena a propaganda.
        </div>
      </div>

      <div className="field">
        <label htmlFor={`${uid}-antes`}>Precio anterior</label>
        <input
          id={`${uid}-antes`} type="number" min="0" step="1" inputMode="numeric" value={precioAntes}
          onChange={(e) => setPrecioAntes(e.target.value)}
          placeholder="Vacío si no está en oferta"
        />
        <div className="hint">
          {oferta
            ? `Se verá tachado, con la etiqueta −${oferta.porciento}% sobre la foto.`
            : hayAntes
              ? 'No se mostrará: tiene que ser mayor que el precio actual y al menos un 5% más alto. Un descuento que no lo es se nota.'
              : 'Se tacha junto al precio de hoy. Déjalo vacío si no hay oferta.'}
        </div>
      </div>

      <label className="switch-row" htmlFor={`${uid}-destacado`}>
        <input
          id={`${uid}-destacado`} type="checkbox" checked={destacado === true}
          disabled={topeAlcanzado}
          onChange={(e) => setDestacado(e.target.checked)}
        />
        <span>
          <strong>Destacar en la portada</strong>
          <small>
            {topeAlcanzado
              ? `Ya tienes ${MAX_DESTACADOS} destacados, que es el máximo. Quita uno para destacar este.`
              : `Va primero en "Recomendados". Máximo ${MAX_DESTACADOS}: destacar todo es no destacar nada.`}
          </small>
        </span>
      </label>

      {oferta && (
        <div className="vitrina-previa">
          <span className="vitrina-previa-etiqueta">−{oferta.porciento}%</span>
          <span className="mono">{moneda} {oferta.ahora.toLocaleString('es-DO')}</span>
          <span className="precio-antes">{moneda} {oferta.antes.toLocaleString('es-DO')}</span>
        </div>
      )}
    </div>
  );
}
