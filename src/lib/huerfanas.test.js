import { describe, it, expect } from 'vitest';
import { fotosQueSobran } from './huerfanas';

const cat = (products, logo) => ({ products, settings: logo === undefined ? {} : { logo } });
const A = 'https://blob.example/a.jpg';
const B = 'https://blob.example/b.jpg';
const C = 'https://blob.example/c.jpg';
const INCRUSTADA = 'data:image/jpeg;base64,AAAA';

describe('fotosQueSobran', () => {
  it('encuentra la foto que se quito de un producto', () => {
    expect(fotosQueSobran(cat([{ id: 'p1', images: [A, B] }]), cat([{ id: 'p1', images: [A] }]))).toEqual([B]);
  });

  it('encuentra las fotos de un producto eliminado', () => {
    expect(fotosQueSobran(cat([{ id: 'p1', images: [A] }, { id: 'p2', images: [B] }]), cat([{ id: 'p1', images: [A] }]))).toEqual([B]);
  });

  it('no propone borrar una foto que otro producto sigue usando', () => {
    expect(fotosQueSobran(cat([{ id: 'p1', images: [A] }, { id: 'p2', images: [A] }]), cat([{ id: 'p2', images: [A] }]))).toEqual([]);
  });

  it('ignora las fotos incrustadas: no hay nada que borrar en el almacen', () => {
    expect(fotosQueSobran(cat([{ id: 'p1', images: [INCRUSTADA] }]), cat([{ id: 'p1', images: [] }]))).toEqual([]);
  });

  it('tiene en cuenta el logo de la tienda', () => {
    expect(fotosQueSobran(cat([], C), cat([], A))).toEqual([C]);
  });

  it('no propone nada cuando no cambio nada', () => {
    expect(fotosQueSobran(cat([{ id: 'p1', images: [A, B] }], C), cat([{ id: 'p1', images: [A, B] }], C))).toEqual([]);
  });

  it('tolera el campo antiguo image de un solo valor', () => {
    expect(fotosQueSobran(cat([{ id: 'p1', image: A }]), cat([{ id: 'p1', images: [] }]))).toEqual([A]);
  });

  it('tolera catalogos vacios', () => {
    expect(fotosQueSobran({ products: [] }, { products: [] })).toEqual([]);
    expect(fotosQueSobran({}, {})).toEqual([]);
  });

  describe('imágenes derivadas del logo', () => {
    const conMarca = (sufijo) => ({
      products: [],
      settings: {
        logo: `https://blob.example/logo${sufijo}.jpg`,
        marca: {
          ogImage: `https://blob.example/og${sufijo}.jpg`,
          icon192: `https://blob.example/i192${sufijo}.png`,
          icon512: `https://blob.example/i512${sufijo}.png`,
          iconMaskable: `https://blob.example/imask${sufijo}.png`,
        },
      },
    });

    // Sin esto las derivadas no se borrarian nunca: cada cambio de logo dejaria cuatro imagenes
    // pagandose para siempre en el almacen.
    it('al cambiar el logo, sobran también sus cuatro derivadas', () => {
      const sobran = fotosQueSobran(conMarca('-viejo'), conMarca('-nuevo'));
      expect(sobran.sort()).toEqual([
        'https://blob.example/i192-viejo.png',
        'https://blob.example/i512-viejo.png',
        'https://blob.example/imask-viejo.png',
        'https://blob.example/logo-viejo.jpg',
        'https://blob.example/og-viejo.jpg',
      ]);
    });

    it('al quitar el logo, sobran sus derivadas', () => {
      const sobran = fotosQueSobran(conMarca('-x'), { products: [], settings: { logo: '', marca: {} } });
      expect(sobran.length).toBe(5);
    });

    it('no propone borrar las derivadas que siguen en uso', () => {
      expect(fotosQueSobran(conMarca('-x'), conMarca('-x'))).toEqual([]);
    });

    it('tolera un catálogo sin el campo marca', () => {
      expect(fotosQueSobran(cat([], C), { products: [], settings: { logo: C } })).toEqual([]);
      expect(fotosQueSobran({ products: [], settings: { marca: null } }, { products: [], settings: {} })).toEqual([]);
    });
  });
});
