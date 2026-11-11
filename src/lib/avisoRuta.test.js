import { describe, it, expect, vi } from 'vitest';
import { rutaDeOrden, ordenDeLaUrl, limpiarUrl } from './avisoRuta';

describe('la dirección a la que lleva el aviso', () => {
  it('apunta al pedido concreto', () => {
    expect(rutaDeOrden('ord_1794424738526_o36fme')).toBe('/admin?orden=ord_1794424738526_o36fme');
  });

  it('sin identificador, lleva al panel y ya', () => {
    // Mejor abrir el panel que no abrir nada: el pedido se encuentra igual, solo que a mano.
    expect(rutaDeOrden('')).toBe('/admin');
    expect(rutaDeOrden(null)).toBe('/admin');
    expect(rutaDeOrden(undefined)).toBe('/admin');
  });

  it('no deja meter nada raro en la dirección', () => {
    expect(rutaDeOrden('../../otra-cosa')).toBe('/admin');
    expect(rutaDeOrden('ord_1 ord_2')).toBe('/admin');
    expect(rutaDeOrden('a'.repeat(200))).toBe('/admin');
  });
});

describe('leer el pedido de la dirección', () => {
  it('lo saca del parámetro', () => {
    expect(ordenDeLaUrl('?orden=ord_123_abc')).toBe('ord_123_abc');
    expect(ordenDeLaUrl('orden=ord_123_abc')).toBe('ord_123_abc');
  });

  it('convive con otros parámetros', () => {
    expect(ordenDeLaUrl('?utm_source=x&orden=ord_9&otra=1')).toBe('ord_9');
  });

  it('devuelve vacío cuando no hay nada que abrir', () => {
    expect(ordenDeLaUrl('')).toBe('');
    expect(ordenDeLaUrl('?otra=1')).toBe('');
    expect(ordenDeLaUrl(null)).toBe('');
  });

  it('descarta lo que no tiene forma de identificador', () => {
    // Esto llega de fuera: cualquiera puede escribir la direccion a mano.
    expect(ordenDeLaUrl('?orden=' + encodeURIComponent('<script>'))).toBe('');
    expect(ordenDeLaUrl('?orden=' + 'a'.repeat(200))).toBe('');
  });

  it('va y vuelve', () => {
    const id = 'ord_1794424738526_o36fme';
    expect(ordenDeLaUrl(rutaDeOrden(id).split('?')[1])).toBe(id);
  });
});

describe('limpiar la dirección después de abrir el pedido', () => {
  const ventana = (href) => ({ location: { href }, history: { replaceState: vi.fn() } });

  it('quita el parámetro sin dejar rastro en el historial', () => {
    // Si se quedara, recargar volveria a saltar al mismo pedido y el boton de atras pasaria
    // por una direccion que ya no significa nada.
    const w = ventana('https://tienda.com/admin?orden=ord_9');
    limpiarUrl(w);
    expect(w.history.replaceState).toHaveBeenCalledWith({}, '', '/admin');
  });

  it('conserva los demás parámetros', () => {
    const w = ventana('https://tienda.com/admin?orden=ord_9&tab=ajustes');
    limpiarUrl(w);
    expect(w.history.replaceState).toHaveBeenCalledWith({}, '', '/admin?tab=ajustes');
  });

  it('no toca nada si no hay parámetro', () => {
    const w = ventana('https://tienda.com/admin');
    limpiarUrl(w);
    expect(w.history.replaceState).not.toHaveBeenCalled();
  });
});
