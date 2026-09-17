import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vacio, podar, registrarEvento, resumen, porcentaje } = require('./metricas.cjs');

const HOY = '2026-09-17';

describe('registrarEvento', () => {
  it('cuenta el evento en el dia', () => {
    const d = registrarEvento(vacio(), 'visita', null, HOY);
    expect(d.dias[HOY].visita).toBe(1);
  });

  it('acumula sobre lo que ya habia', () => {
    let d = registrarEvento(vacio(), 'visita', null, HOY);
    d = registrarEvento(d, 'visita', null, HOY);
    d = registrarEvento(d, 'pedido', null, HOY);
    expect(d.dias[HOY]).toMatchObject({ visita: 2, pedido: 1 });
  });

  it('cuenta las vistas por producto solo en el evento de producto', () => {
    let d = registrarEvento(vacio(), 'producto', 'p1', HOY);
    d = registrarEvento(d, 'producto', 'p1', HOY);
    d = registrarEvento(d, 'producto', 'p2', HOY);
    d = registrarEvento(d, 'checkout', 'p1', HOY);
    expect(d.productos).toEqual({ p1: 2, p2: 1 });
  });

  it('no mezcla dias distintos', () => {
    let d = registrarEvento(vacio(), 'visita', null, '2026-09-16');
    d = registrarEvento(d, 'visita', null, HOY);
    expect(d.dias['2026-09-16'].visita).toBe(1);
    expect(d.dias[HOY].visita).toBe(1);
  });

  it('rechaza un tipo desconocido', () => {
    expect(() => registrarEvento(vacio(), 'lo-que-sea', null, HOY)).toThrow('EVENTO_DESCONOCIDO');
  });

  it('tolera un documento corrupto o ausente', () => {
    expect(registrarEvento(null, 'visita', null, HOY).dias[HOY].visita).toBe(1);
    expect(registrarEvento({ dias: 'x', productos: 7 }, 'visita', null, HOY).dias[HOY].visita).toBe(1);
  });

  it('no deja que un contador manipulado quede negativo', () => {
    const d = registrarEvento({ dias: { [HOY]: { visita: -500 } }, productos: {} }, 'visita', null, HOY);
    expect(d.dias[HOY].visita).toBe(1);
  });
});

describe('podar', () => {
  it('descarta los dias mas viejos que el periodo', () => {
    const doc = { dias: { '2026-06-01': { visita: 9 }, '2026-09-16': { visita: 1 }, [HOY]: { visita: 2 } }, productos: {} };
    const r = podar(doc, 30, HOY);
    expect(Object.keys(r.dias).sort()).toEqual(['2026-09-16', HOY]);
  });

  it('conserva el dia justo en el limite', () => {
    const doc = { dias: { '2026-09-16': { visita: 1 }, [HOY]: { visita: 1 } }, productos: {} };
    expect(Object.keys(podar(doc, 2, HOY))).toContain('dias');
    expect(Object.keys(podar(doc, 2, HOY).dias).sort()).toEqual(['2026-09-16', HOY]);
  });

  it('conserva las vistas por producto, que no son por dia', () => {
    const doc = { dias: { '2026-01-01': { visita: 1 } }, productos: { p1: 5 } };
    expect(podar(doc, 30, HOY).productos).toEqual({ p1: 5 });
  });
});

describe('porcentaje', () => {
  it('redondea a un decimal', () => expect(porcentaje(1, 3)).toBe(33.3));
  it('evita dividir por cero', () => expect(porcentaje(5, 0)).toBe(0));
});

describe('resumen', () => {
  const doc = {
    dias: {
      '2026-09-16': { visita: 100, producto: 40, checkout: 10, pedido: 5, whatsapp: 4 },
      [HOY]: { visita: 100, producto: 60, checkout: 10, pedido: 5, whatsapp: 3 },
    },
    productos: { p1: 30, p2: 70, p3: 5 },
  };
  const catalogo = { products: [{ id: 'p1', name: 'Mouse' }, { id: 'p2', name: 'Laptop' }] };

  it('suma los totales del periodo', () => {
    expect(resumen(doc, 30, HOY, catalogo).totales).toEqual({ visita: 200, producto: 100, checkout: 20, pedido: 10, whatsapp: 7 });
  });

  it('calcula la conversion de cada paso', () => {
    const c = resumen(doc, 30, HOY, catalogo).conversion;
    expect(c).toMatchObject({ visitaAProducto: 50, productoACheckout: 20, checkoutAPedido: 50, pedidoAWhatsapp: 70, visitaAPedido: 5 });
  });

  it('ordena los productos por vistas y les pone el nombre', () => {
    const p = resumen(doc, 30, HOY, catalogo).productos;
    expect(p[0]).toEqual({ id: 'p2', nombre: 'Laptop', vistas: 70 });
    expect(p[2]).toMatchObject({ id: 'p3', nombre: '(producto eliminado)' });
  });

  it('devuelve la serie por dia ordenada', () => {
    const s = resumen(doc, 30, HOY, catalogo).serie;
    expect(s.map((d) => d.fecha)).toEqual(['2026-09-16', HOY]);
    expect(s[1]).toMatchObject({ visita: 100, pedido: 5 });
  });

  it('con un periodo corto solo cuenta ese periodo', () => {
    expect(resumen(doc, 1, HOY, catalogo).totales.visita).toBe(100);
  });

  it('no se cae con el documento vacio', () => {
    const r = resumen(vacio(), 30, HOY, catalogo);
    expect(r.totales.visita).toBe(0);
    expect(r.conversion.visitaAPedido).toBe(0);
    expect(r.productos).toEqual([]);
  });
});
