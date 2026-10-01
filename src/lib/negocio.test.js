import { describe, it, expect } from 'vitest';
import { datosDeNegocio, limpiarNegocio, COBERTURA_POR_DEFECTO, PAGOS_POR_DEFECTO } from './negocio';

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
