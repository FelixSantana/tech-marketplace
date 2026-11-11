import { describe, it, expect } from 'vitest';
import { datosDeNegocio, limpiarNegocio, COBERTURA_POR_DEFECTO, PAGOS_POR_DEFECTO, sellosDeAjustes, limpiarSellos, SELLOS_POR_DEFECTO, ICONOS_DE_SELLO, MAX_SELLOS } from './negocio';

describe('datosDeNegocio', () => {
  // El caso que de verdad importa para poder vender esto: una tienda recien instalada, cuyo
  // catalogo no tiene ni el campo `negocio`, no puede romperse ni inventar datos.
  it('una tienda nueva no publica datos de nadie', () => {
    const n = datosDeNegocio({});
    expect(n.rnc).toBe('');
    expect(n.direccion).toBe('');
    expect(n.horario).toBe('');
    expect(n.correo).toBe('');
  });

  it('cobertura y formas de pago traen lo de siempre si nunca se tocaron', () => {
    const n = datosDeNegocio({});
    expect(n.cobertura).toBe(COBERTURA_POR_DEFECTO);
    expect(n.pagos).toEqual(PAGOS_POR_DEFECTO);
  });

  it('un catálogo sin settings tampoco revienta', () => {
    expect(datosDeNegocio(undefined).rnc).toBe('');
    expect(datosDeNegocio(null).pagos).toEqual(PAGOS_POR_DEFECTO);
  });

  it('devuelve lo que el dueño guardó', () => {
    const n = datosDeNegocio({ negocio: { rnc: '1-31-12345-6', direccion: 'Av. Duarte 10', horario: 'Lun a Sáb', correo: 'a@b.com', pagos: ['Efectivo'] } });
    expect(n.rnc).toBe('1-31-12345-6');
    expect(n.direccion).toBe('Av. Duarte 10');
    expect(n.pagos).toEqual(['Efectivo']);
  });

  // Vaciar un campo es una decisión, no un olvido: "no publiques mi cobertura".
  it('respeta un campo vaciado a propósito en vez de reponer el valor por defecto', () => {
    expect(datosDeNegocio({ negocio: { cobertura: '' } }).cobertura).toBe('');
    expect(datosDeNegocio({ negocio: { pagos: [] } }).pagos).toEqual([]);
  });

  it('recorta espacios y limita largos disparatados', () => {
    const n = datosDeNegocio({ negocio: { rnc: '  1-31  ', direccion: 'x'.repeat(400) } });
    expect(n.rnc).toBe('1-31');
    expect(n.direccion.length).toBe(160);
  });

  it('aguanta basura en vez de confiar en la forma', () => {
    const n = datosDeNegocio({ negocio: { rnc: 12345, pagos: 'efectivo', direccion: null } });
    expect(n.rnc).toBe('12345');
    expect(n.direccion).toBe('');
    expect(n.pagos).toEqual([]);   // no es lista: no se publica nada
  });
});

describe('limpiarNegocio', () => {
  it('parte las formas de pago por comas y descarta las vacías', () => {
    expect(limpiarNegocio({ pagos: 'Efectivo, Transferencia , , Tarjeta' }).pagos).toEqual(['Efectivo', 'Transferencia', 'Tarjeta']);
  });

  it('guarda los campos vacíos, porque vaciar es una decisión', () => {
    expect(limpiarNegocio({ rnc: '   ' })).toMatchObject({ rnc: '', direccion: '', pagos: [] });
  });

  it('recorta antes de guardar', () => {
    expect(limpiarNegocio({ horario: '  Lun a Sáb · 9 a 6  ' }).horario).toBe('Lun a Sáb · 9 a 6');
  });

  it('lo que sale de limpiar entra igual en datosDeNegocio', () => {
    const guardado = limpiarNegocio({ rnc: '1-31-12345-6', direccion: 'Av. Duarte 10', horario: 'Lun a Sáb', cobertura: 'Santo Domingo', correo: 'a@b.com', pagos: 'Efectivo, Transferencia' });
    const leido = datosDeNegocio({ negocio: guardado });
    expect(leido).toEqual({ ...guardado, pagos: ['Efectivo', 'Transferencia'] });
  });
});

describe('los sellos de confianza', () => {
  it('una tienda que nunca los tocó ve los de siempre', () => {
    // Sin esto, desplegar el cambio dejaria sin tira a las tiendas ya montadas.
    expect(sellosDeAjustes({})).toEqual(SELLOS_POR_DEFECTO);
    expect(sellosDeAjustes({ sellos: undefined })).toEqual(SELLOS_POR_DEFECTO);
    expect(sellosDeAjustes(null)).toEqual(SELLOS_POR_DEFECTO);
  });

  it('devuelve una copia, no los objetos de verdad', () => {
    // Si devolviera los mismos objetos, escribir en el formulario de Ajustes modificaria el
    // valor por defecto para toda la sesion, y cancelar no desharia nada.
    const primera = sellosDeAjustes({});
    primera[0].titulo = 'tocado a mano';
    expect(SELLOS_POR_DEFECTO[0].titulo).toBe('Equipos probados');
    expect(sellosDeAjustes({})[0].titulo).toBe('Equipos probados');
  });

  it('una lista vacía significa que el dueño los quitó', () => {
    // Es la unica forma de apagar la tira. Si se rellenara con los de siempre, no habria manera.
    expect(sellosDeAjustes({ sellos: [] })).toEqual([]);
  });

  it('usa los que el dueño escribió', () => {
    const mios = [{ icono: 'tienda', titulo: 'Local en la Zona Colonial', nota: 'Pasa a verlo' }];
    expect(sellosDeAjustes({ sellos: mios })).toEqual(mios);
  });

  it('tira las filas sin título, que son las que quedaron vacías', () => {
    const r = sellosDeAjustes({ sellos: [{ icono: 'probado', titulo: '', nota: 'algo' }, { icono: 'reloj', titulo: 'Entrega en 24h', nota: '' }] });
    expect(r).toEqual([{ icono: 'reloj', titulo: 'Entrega en 24h', nota: '' }]);
  });

  it('no deja pasar un icono inventado', () => {
    // El dibujo vive en el componente: un nombre que no existe dejaria el hueco sin icono.
    expect(sellosDeAjustes({ sellos: [{ icono: '<script>', titulo: 'X' }] })[0].icono).toBe('probado');
    expect(sellosDeAjustes({ sellos: [{ icono: 'mapa', titulo: 'X' }] })[0].icono).toBe('mapa');
  });

  it('no deja poner más de tres', () => {
    const muchos = Array.from({ length: 9 }, (_, i) => ({ icono: 'probado', titulo: `Sello ${i}` }));
    expect(sellosDeAjustes({ sellos: muchos })).toHaveLength(MAX_SELLOS);
  });

  it('recorta textos absurdos en vez de romper la tira', () => {
    const r = sellosDeAjustes({ sellos: [{ icono: 'probado', titulo: 'A'.repeat(300), nota: 'B'.repeat(300) }] });
    expect(r[0].titulo.length).toBeLessThanOrEqual(40);
    expect(r[0].nota.length).toBeLessThanOrEqual(90);
  });

  it('aguanta basura sin reventar', () => {
    expect(sellosDeAjustes({ sellos: 'no soy una lista' })).toEqual(SELLOS_POR_DEFECTO);
    expect(limpiarSellos([null, 7, 'x'])).toEqual([]);
  });

  it('cada icono de la lista tiene nombre para enseñar', () => {
    for (const i of ICONOS_DE_SELLO) {
      expect(i.valor).toMatch(/^[a-z]+$/);
      expect(i.nombre.trim()).not.toBe('');
    }
  });
});
