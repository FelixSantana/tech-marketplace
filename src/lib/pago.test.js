import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { limpiarPago, pagoDeOrden, metodosDisponibles, sugiereEvidencia, resumenDePago, MAX_EVIDENCIAS, OTRO } from './pago';
import { PAGOS_POR_DEFECTO } from './negocio';

const URL1 = 'https://almacen.test/pagos/abc.jpg';
const URL2 = 'https://almacen.test/pagos/def.jpg';

describe('los métodos que se ofrecen', () => {
  it('salen de los que el dueño configuró en Ajustes', () => {
    // Los mismos que ya anuncia en el pie de su tienda. Asi un cliente que cobra en Yape o en
    // Zelle los ve sin que nadie toque el codigo.
    const m = metodosDisponibles({ negocio: { pagos: ['Yape', 'Zelle'] } });
    expect(m).toEqual(['Yape', 'Zelle', OTRO]);
  });

  it('una tienda recién montada ve los de siempre', () => {
    expect(metodosDisponibles({})).toEqual([...PAGOS_POR_DEFECTO, OTRO]);
  });

  it('"Otro" siempre está, y una sola vez', () => {
    // Cobrar de una forma que no esta en la lista pasa, y obligar a dejarlo vacio seria peor.
    const m = metodosDisponibles({ negocio: { pagos: ['Efectivo', OTRO] } });
    expect(m.filter((x) => x === OTRO)).toHaveLength(1);
    expect(m[m.length - 1]).toBe(OTRO);
  });
});

describe('lo que se guarda de un pago', () => {
  it('guarda método, referencia y comprobantes', () => {
    const p = limpiarPago({ metodo: 'Transferencia', referencia: 'OP-884213', evidencias: [URL1] });
    expect(p).toEqual({ metodo: 'Transferencia', referencia: 'OP-884213', evidencias: [URL1] });
  });

  it('una orden sin pago anotado no guarda el campo', () => {
    // Asi queda exactamente como estaba antes de que esto existiera, en vez de con tres campos
    // vacios dentro.
    expect(limpiarPago({})).toBe(null);
    expect(limpiarPago({ metodo: '  ', referencia: '', evidencias: [] })).toBe(null);
    expect(limpiarPago(null)).toBe(null);
    expect(pagoDeOrden({})).toBe(null);
  });

  it('vale con solo el método', () => {
    expect(limpiarPago({ metodo: 'Efectivo' })).toEqual({ metodo: 'Efectivo', referencia: '', evidencias: [] });
  });

  it('RECHAZA un comprobante incrustado', () => {
    // Las ordenes viven todas en una sola clave de Redis. Una captura en base64 son cientos de
    // miles de caracteres: veinte transferencias reventarian la clave y con ella el panel.
    const incrustada = `data:image/jpeg;base64,${'A'.repeat(5000)}`;
    expect(limpiarPago({ metodo: 'Transferencia', evidencias: [incrustada] })).toEqual({ metodo: 'Transferencia', referencia: '', evidencias: [] });
  });

  it('rechaza lo que no es una URL del almacén', () => {
    const malas = ['http://sin-cifrar.test/x.jpg', 'javascript:alert(1)', '/relativa.jpg', '', null, 123, `https://x.test/${'a'.repeat(700)}`];
    expect(limpiarPago({ metodo: 'X', evidencias: malas }).evidencias).toEqual([]);
  });

  it('pone tope al número de comprobantes', () => {
    const muchas = Array.from({ length: 12 }, (_, i) => `https://almacen.test/pagos/${i}.jpg`);
    expect(limpiarPago({ metodo: 'X', evidencias: muchas }).evidencias).toHaveLength(MAX_EVIDENCIAS);
  });

  it('recorta textos largos en vez de guardarlos enteros', () => {
    const p = limpiarPago({ metodo: 'A'.repeat(200), referencia: 'B'.repeat(200) });
    expect(p.metodo.length).toBeLessThanOrEqual(40);
    expect(p.referencia.length).toBeLessThanOrEqual(60);
  });

  it('aguanta basura sin reventar', () => {
    expect(limpiarPago({ evidencias: 'no soy una lista' })).toBe(null);
    expect(limpiarPago('texto suelto')).toBe(null);
  });
});

describe('la sugerencia de adjuntar comprobante', () => {
  it('se sugiere para lo que deja rastro', () => {
    expect(sugiereEvidencia('Transferencia')).toBe(true);
    expect(sugiereEvidencia('Tarjeta')).toBe(true);
    expect(sugiereEvidencia('Depósito bancario')).toBe(true);
  });

  it('no se sugiere en efectivo', () => {
    expect(sugiereEvidencia('Efectivo')).toBe(false);
    expect(sugiereEvidencia('efectivo')).toBe(false);
    expect(sugiereEvidencia('Contado')).toBe(false);
  });

  it('no se sugiere sin método ni con "Otro"', () => {
    // Es una pista, no una condicion: con "Otro" no hay forma de saberlo.
    expect(sugiereEvidencia('')).toBe(false);
    expect(sugiereEvidencia(OTRO)).toBe(false);
  });
});

describe('el resumen para la tabla', () => {
  it('junta lo que hay', () => {
    expect(resumenDePago({ pago: { metodo: 'Transferencia', referencia: 'OP-88', evidencias: [URL1, URL2] } }))
      .toBe('Transferencia · ref. OP-88 · 2 comprobantes');
  });

  it('concuerda en singular', () => {
    expect(resumenDePago({ pago: { metodo: 'Tarjeta', evidencias: [URL1] } })).toBe('Tarjeta · 1 comprobante');
  });

  it('sin pago anotado no dice nada', () => {
    expect(resumenDePago({})).toBe('');
    expect(resumenDePago({ pago: {} })).toBe('');
  });
});

describe('la versión del servidor decide lo mismo', () => {
  // Esto no es una copia por comodidad: el navegador dibuja el formulario, pero quien decide
  // que entra en Redis es el servidor. Si se separan, se cuela ahi lo que aqui se rechaza.
  const require2 = createRequire(import.meta.url);
  const servidor = require2('../../api/_lib/pago.cjs');

  const casos = [
    {},
    { metodo: 'Transferencia' },
    { metodo: 'Transferencia', referencia: 'OP-884213', evidencias: [URL1, URL2] },
    { metodo: '', referencia: '', evidencias: [] },
    { metodo: 'X', evidencias: [`data:image/jpeg;base64,${'A'.repeat(500)}`] },
    { metodo: 'X', evidencias: ['http://sin-cifrar.test/x.jpg', 'javascript:alert(1)'] },
    { metodo: 'A'.repeat(200), referencia: 'B'.repeat(200) },
    { metodo: 'X', evidencias: Array.from({ length: 12 }, (_, i) => `https://a.test/${i}.jpg`) },
    { evidencias: 'no soy una lista' },
  ];

  it('deciden igual en todos los casos', () => {
    for (const c of casos) {
      expect(servidor.limpiarPago(c)).toEqual(limpiarPago(c));
    }
  });

  it('los dos rechazan una captura incrustada', () => {
    const incrustada = { metodo: 'Transferencia', evidencias: [`data:image/jpeg;base64,${'A'.repeat(5000)}`] };
    expect(servidor.limpiarPago(incrustada).evidencias).toEqual([]);
  });

  it('el tope de comprobantes es el mismo', () => {
    expect(servidor.MAX_EVIDENCIAS).toBe(MAX_EVIDENCIAS);
  });

  it('el almacén acepta el prefijo de los comprobantes', () => {
    // Sin el, la subida acabaria en la carpeta de productos y se mezclarian con el catalogo.
    const { prefijoValido } = require2('../../api/_lib/upload-logic.cjs');
    expect(prefijoValido('pagos')).toBe('pagos');
  });
});
