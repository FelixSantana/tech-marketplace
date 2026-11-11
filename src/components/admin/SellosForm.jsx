import { useId } from 'react';
import { ICONOS_DE_SELLO, MAX_SELLOS } from '../../lib/negocio';

// Los tres sellos que el cliente ve encima de los productos.
//
// Se editan como tres filas fijas y no con botones de agregar y quitar: son exactamente tres,
// caben tres y no hay nada que decidir sobre cuantos poner. Vaciar el titulo es la forma de
// quitar uno, y se dice en el texto de ayuda para que nadie lo tenga que adivinar.
export default function SellosForm({ sellos, setSellos }) {
  const uid = useId();

  // Siempre MAX_SELLOS filas en pantalla, aunque haya menos guardados: si solo se dibujaran las
  // que existen, el dueño que los borro todos se quedaria sin formulario para volver a ponerlos.
  const filas = Array.from({ length: MAX_SELLOS }, (_, i) => sellos[i] || { icono: 'probado', titulo: '', nota: '' });

  const cambiar = (indice, campo, valor) => {
    setSellos(filas.map((s, i) => (i === indice ? { ...s, [campo]: valor } : s)));
  };

  const vacios = filas.every((s) => !String(s.titulo || '').trim());

  return (
    <div className="sellos-form">
      {filas.map((s, i) => (
        <div className="sello-row" key={i}>
          <label htmlFor={`${uid}-${i}-icono`}>
            Icono
            <select id={`${uid}-${i}-icono`} value={s.icono} onChange={(e) => cambiar(i, 'icono', e.target.value)}>
              {ICONOS_DE_SELLO.map((o) => <option key={o.valor} value={o.valor}>{o.nombre}</option>)}
            </select>
          </label>
          <label htmlFor={`${uid}-${i}-titulo`}>
            Título
            <input id={`${uid}-${i}-titulo`} type="text" maxLength={40} placeholder="Equipos probados" value={s.titulo} onChange={(e) => cambiar(i, 'titulo', e.target.value)} />
          </label>
          <label htmlFor={`${uid}-${i}-nota`}>
            Explicación
            <input id={`${uid}-${i}-nota`} type="text" maxLength={90} placeholder="Cada equipo se revisa antes de publicarse" value={s.nota} onChange={(e) => cambiar(i, 'nota', e.target.value)} />
          </label>
        </div>
      ))}
      <div className="hint">
        {vacios
          ? 'Sin ningún título, la tira no se muestra en la tienda.'
          : 'Un sello sin título no se muestra. Vacía los tres para quitar la tira entera.'}
      </div>
    </div>
  );
}
