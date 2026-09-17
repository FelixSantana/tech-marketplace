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
});
