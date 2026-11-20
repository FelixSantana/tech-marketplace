import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import {
  estadoDeProducto, limpiarEstado, NIVELES_DE_ESTADO,
  ofertaDeProducto,
  quedanPocas, textoDePocas, UMBRAL_POCAS,
  esDestacado, contarDestacados, destacadosPrimero, MAX_DESTACADOS,
} from './vitrina';

const producto = (extra = {}) => ({ id: 'p_1', name: 'Laptop', price: 10000, stockQty: 5, ...extra });

describe('el estado del equipo', () => {
  it('no dibuja nada cuando no hay estado', () => {
    // Mejor callar que decir "sin especificar", que suena a que algo se esconde.
    expect(estadoDeProducto(producto())).toBe(null);
    expect(estadoDeProducto(producto({ estado: {} }))).toBe(null);
    expect(estadoDeProducto(producto({ estado: { nivel: '', nota: '  ' } }))).toBe(null);
  });

  it('da el nombre largo para la ficha y el corto para la tarjeta', () => {
    const e = estadoDeProducto(producto({ estado: { nivel: 'con-detalles', nota: 'Marca leve en la tapa' } }));
    expect(e.nombre).toBe('Con detalles estéticos');
    expect(e.corto).toBe('Con detalles');
    expect(e.nota).toBe('Marca leve en la tapa');
  });

  it('vale con solo la nota, que es lo que de verdad convence', () => {
    const e = estadoDeProducto(producto({ estado: { nota: 'Batería 87%' } }));
    expect(e.nota).toBe('Batería 87%');
    expect(e.nivel).toBe('');
  });

  it('descarta un nivel inventado en vez de enseñarlo', () => {
    expect(estadoDeProducto(producto({ estado: { nivel: '<script>', nota: 'ok' } })).nivel).toBe('');
  });

  it('recorta notas largas', () => {
    expect(estadoDeProducto(producto({ estado: { nota: 'A'.repeat(400) } })).nota).toHaveLength(120);
  });

  it('al guardar, sin nada deja el producto como antes de que el campo existiera', () => {
    expect(limpiarEstado({ nivel: '', nota: '' })).toBe(null);
    expect(limpiarEstado(null)).toBe(null);
    expect(limpiarEstado({ nivel: 'nuevo', nota: '' })).toEqual({ nivel: 'nuevo', nota: '' });
  });

  it('los niveles que se ofrecen tienen nombre y nombre corto', () => {
    for (const n of NIVELES_DE_ESTADO) {
      expect(n.valor).toMatch(/^[a-z-]+$/);
      expect(n.nombre.trim()).not.toBe('');
      expect(n.corto.length).toBeLessThanOrEqual(n.nombre.length);
    }
  });
});

describe('la oferta', () => {
  it('tacha el precio anterior y calcula el descuento', () => {
    expect(ofertaDeProducto(producto({ precioAntes: 20000 }))).toEqual({ antes: 20000, ahora: 10000, porciento: 50 });
  });

  it('un "antes" igual o menor no es una oferta', () => {
    // Es un error de tecleo. Tacharlo seria enseñar un descuento que no existe.
    expect(ofertaDeProducto(producto({ precioAntes: 10000 }))).toBe(null);
    expect(ofertaDeProducto(producto({ precioAntes: 8000 }))).toBe(null);
  });

  it('no hay oferta sin precio anterior', () => {
    expect(ofertaDeProducto(producto())).toBe(null);
    expect(ofertaDeProducto(producto({ precioAntes: 0 }))).toBe(null);
    expect(ofertaDeProducto(producto({ precioAntes: 'mucho' }))).toBe(null);
  });

  it('descuentos ridículos no se anuncian', () => {
    // Por debajo del 5% el tachado llama mas que lo que ahorra, y deja sensacion de engaño.
    expect(ofertaDeProducto(producto({ price: 9800, precioAntes: 10000 }))).toBe(null);
    expect(ofertaDeProducto(producto({ price: 9400, precioAntes: 10000 })).porciento).toBe(6);
  });

  it('redondea hacia abajo, nunca a favor propio', () => {
    // 29,6% se anuncia como 29, no como 30.
    expect(ofertaDeProducto(producto({ price: 7040, precioAntes: 10000 })).porciento).toBe(29);
  });

  it('se anuncia también con variantes, contra el precio que se enseña', () => {
    // La primera version excluia todo producto con variantes —"no hay un precio unico que
    // tachar"— y era demasiado: la Dell Latitude 3190 tiene UNA variante, el precio es unico,
    // y su oferta de verdad se quedaba sin mostrar sin que el dueño pudiera entender por que.
    const unaVariante = producto({ price: 5500, precioAntes: 7500, variants: [{ id: 'v1', label: '8GB', price: 5500, stockQty: 2 }] });
    expect(ofertaDeProducto(unaVariante, 5500)).toEqual({ antes: 7500, ahora: 5500, porciento: 26 });
  });

  it('con varias variantes compara contra el mínimo, que es el "desde" de la tarjeta', () => {
    const varias = producto({ price: 5500, precioAntes: 7500, variants: [{ id: 'v1', price: 5500 }, { id: 'v2', price: 8200 }] });
    expect(ofertaDeProducto(varias, 5500).porciento).toBe(26);
  });

  it('si se elige una variante más cara que el "antes", deja de anunciarse', () => {
    // En la ficha se compara contra la variante elegida: ese "antes" no describe esa opcion,
    // y tacharlo ahi seria inventar un descuento.
    const varias = producto({ price: 5500, precioAntes: 7500, variants: [{ id: 'v1', price: 5500 }, { id: 'v2', price: 8200 }] });
    expect(ofertaDeProducto(varias, 8200)).toBe(null);
  });
});

describe('últimas unidades', () => {
  it('avisa con pocas', () => {
    expect(quedanPocas(producto({ stockQty: 1 }))).toBe(true);
    expect(quedanPocas(producto({ stockQty: UMBRAL_POCAS }))).toBe(true);
  });

  it('calla con muchas', () => {
    expect(quedanPocas(producto({ stockQty: UMBRAL_POCAS + 1 }))).toBe(false);
  });

  it('calla cuando está agotado, que ya lo dice el otro cartel', () => {
    expect(quedanPocas(producto({ stockQty: 0 }))).toBe(false);
    expect(textoDePocas(producto({ stockQty: 0 }))).toBe('');
  });

  it('concuerda en singular', () => {
    expect(textoDePocas(producto({ stockQty: 1 }))).toBe('Queda 1');
    expect(textoDePocas(producto({ stockQty: 2 }))).toBe('Quedan 2');
  });

  it('suma el stock de las variantes', () => {
    const conVariantes = producto({ variants: [{ id: 'v1', stockQty: 1 }, { id: 'v2', stockQty: 1 }] });
    expect(textoDePocas(conVariantes)).toBe('Quedan 2');
  });
});

describe('destacados', () => {
  const dest = (n) => producto({ id: `d${n}`, destacado: true });
  const normal = (n) => producto({ id: `n${n}` });

  it('van primero', () => {
    const lista = [normal(1), dest(1), normal(2), dest(2)];
    expect(destacadosPrimero(lista).map((p) => p.id)).toEqual(['d1', 'd2', 'n1', 'n2']);
  });

  it('dentro de cada grupo no se reordena nada', () => {
    // Estable a proposito: el dueño tiene que seguir reconociendo su catalogo.
    const lista = [normal(1), normal(2), normal(3)];
    expect(destacadosPrimero(lista).map((p) => p.id)).toEqual(['n1', 'n2', 'n3']);
  });

  it('sin destacados deja la lista igual', () => {
    const lista = [normal(1), normal(2)];
    expect(destacadosPrimero(lista)).toEqual(lista);
  });

  it('no modifica la lista que recibe', () => {
    const lista = [normal(1), dest(1)];
    destacadosPrimero(lista);
    expect(lista.map((p) => p.id)).toEqual(['n1', 'd1']);
  });

  it('sabe cuántos hay, para poder frenar al llegar al tope', () => {
    // Destacar todo es no destacar nada: pasados cuatro, la primera fila deja de significar.
    expect(contarDestacados([dest(1), normal(1), dest(2)])).toBe(2);
    expect(MAX_DESTACADOS).toBe(4);
  });

  it('aguanta basura', () => {
    expect(esDestacado(null)).toBe(false);
    expect(destacadosPrimero(null)).toEqual([]);
    expect(contarDestacados('no soy una lista')).toBe(0);
  });
});

describe('la version del servidor dice lo mismo', () => {
  // Las reglas viven en dos sitios porque una corre en el navegador y la otra en la funcion.
  // Si se separan, el HTML que ve Google y el que ve la persona dejan de coincidir.
  const require = createRequire(import.meta.url);
  const servidor = require('../../api/_lib/vitrina.cjs');

  it('coinciden en qué es una oferta', () => {
    const casos = [
      { price: 10000, precioAntes: 20000 },
      { price: 10000, precioAntes: 10000 },
      { price: 9800, precioAntes: 10000 },
      { price: 7040, precioAntes: 10000 },
      { price: 10000 },
      { price: 10000, precioAntes: 'mucho' },
    ];
    for (const c of casos) {
      const aqui = ofertaDeProducto(c);
      const alla = servidor.ofertaDe(c);
      expect(alla ? alla.porciento : null).toBe(aqui ? aqui.porciento : null);
    }
  });

  it('coinciden en el orden de los destacados', () => {
    const lista = [{ id: 'a' }, { id: 'b', destacado: true }, { id: 'c' }];
    expect(servidor.destacadosPrimero(lista).map((p) => p.id)).toEqual(destacadosPrimero(lista).map((p) => p.id));
  });

  it('el servidor sabe traducir todos los niveles que ofrece el panel', () => {
    // Un nivel sin traduccion se publicaria sin itemCondition y nadie lo notaria.
    for (const n of NIVELES_DE_ESTADO) {
      expect(servidor.CONDICION[n.valor]).toMatch(/^https:\/\/schema\.org\/\w+Condition$/);
    }
  });

  it('solo "nuevo" se declara como nuevo', () => {
    // Lo demas es usado: un equipo con una marca en la tapa no esta dañado, pero nuevo no es.
    for (const n of NIVELES_DE_ESTADO) {
      const esperado = n.valor === 'nuevo' ? 'NewCondition' : 'UsedCondition';
      expect(servidor.CONDICION[n.valor]).toContain(esperado);
    }
  });

  it('coinciden en el umbral de últimas unidades', () => {
    expect(servidor.UMBRAL_POCAS).toBe(UMBRAL_POCAS);
  });
});

describe('las etiquetas de estado, en los dos lados', () => {
  const require2 = createRequire(import.meta.url);
  const servidor = require2('../../api/_lib/vitrina.cjs');

  it('el texto corto es el mismo', () => {
    // Si se separan, el HTML servido y el que pinta React dirian cosas distintas durante el
    // parpadeo, y Google indexaria una palabra que el visitante no ve.
    for (const n of NIVELES_DE_ESTADO) {
      expect(servidor.CORTO[n.valor]).toBe(n.corto);
    }
  });

  it('no sobra ningún nivel en el servidor', () => {
    expect(Object.keys(servidor.CORTO).sort()).toEqual(NIVELES_DE_ESTADO.map((n) => n.valor).sort());
  });

  it('los dos deciden igual cuándo hay estado que mostrar', () => {
    const casos = [
      {},
      { estado: {} },
      { estado: { nivel: 'muy-bueno' } },
      { estado: { nota: 'Solo nota' } },
      { estado: { nivel: 'inventado', nota: '' } },
      { estado: { nivel: 'con-detalles', nota: 'Rayón pequeño' } },
    ];
    for (const c of casos) {
      const aqui = estadoDeProducto(c);
      const alla = servidor.estadoDe(c);
      expect(Boolean(alla)).toBe(Boolean(aqui));
      if (aqui) {
        expect(alla.nivel).toBe(aqui.nivel);
        expect(alla.corto).toBe(aqui.corto);
        expect(alla.nota).toBe(aqui.nota);
      }
    }
  });

  it('los dos recortan la nota igual', () => {
    const largo = { estado: { nivel: 'nuevo', nota: 'A'.repeat(300) } };
    expect(servidor.estadoDe(largo).nota).toBe(estadoDeProducto(largo).nota);
  });
});
