import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import {
  limpiarLinea, lineasValidas, totalDeLinea, totalDeCotizacion, limpiarCotizacion,
  numeroVisible, vencimientoDe, estaVencida, estadoVisible, ESTADOS,
  ajustesDeCotizacion, limpiarAjustesDeCotizacion, cotizacionNueva, datosDePapel,
  MAX_LINEAS, MAX_NOTA, VALIDEZ_POR_DEFECTO,
} from './cotizacion';

const linea = (extra) => ({ descripcion: 'Laptop', cantidad: 1, precio: 1000, ...extra });

describe('los renglones', () => {
  it('multiplica cantidad por precio', () => {
    expect(totalDeLinea(linea({ cantidad: 3, precio: 2500 }))).toBe(7500);
  });

  it('redondea a centavos y no deja negativos', () => {
    // El precio se redondea ANTES de multiplicar: un renglon de 0.335 es un renglon de 0.34,
    // porque es lo que va impreso. Si se redondease solo el total, el papel enseñaria un
    // precio por unidad que no cuadra con su propia multiplicacion.
    expect(totalDeLinea(linea({ cantidad: 3, precio: 0.335 }))).toBe(1.02);
    expect(limpiarLinea(linea({ precio: 0.335 })).precio).toBe(0.34);
    expect(totalDeLinea(linea({ precio: -500 }))).toBe(0);
    expect(limpiarLinea({ descripcion: 'X', cantidad: -4 }).cantidad).toBe(1);
  });

  it('descarta el renglón sin descripción en vez de imprimir una fila en blanco con precio', () => {
    const lista = [linea(), { descripcion: '   ', cantidad: 2, precio: 9999 }, linea({ descripcion: 'Mouse' })];
    expect(lineasValidas(lista).map((l) => l.descripcion)).toEqual(['Laptop', 'Mouse']);
  });

  it('se queda con el producto del que salió, por si algún día se convierte en orden', () => {
    const l = limpiarLinea({ descripcion: 'Laptop', productId: 'p_1', variantId: 'v_2' });
    expect(l.productId).toBe('p_1');
    expect(l.variantId).toBe('v_2');
  });

  it('no inventa un producto cuando el renglón se escribió a mano', () => {
    expect(limpiarLinea({ descripcion: 'Servicio de instalación' })).not.toHaveProperty('productId');
  });

  it('tiene tope de renglones', () => {
    expect(lineasValidas(Array.from({ length: 80 }, () => linea()))).toHaveLength(MAX_LINEAS);
  });

  it('aguanta basura', () => {
    expect(lineasValidas(null)).toEqual([]);
    expect(totalDeCotizacion('no soy una lista')).toBe(0);
    expect(totalDeLinea(null)).toBe(0);
  });
});

describe('la cotización', () => {
  it('suma el total de sus renglones', () => {
    expect(totalDeCotizacion([linea({ cantidad: 2, precio: 1500 }), linea({ precio: 500 })])).toBe(3500);
  });

  it('recalcula el total y no se cree el que venga escrito', () => {
    // Importa de verdad: el total es lo unico que lee el cliente, y un papel cuyos renglones no
    // cuadran con su propio total es un problema que se descubre delante del cliente.
    const c = limpiarCotizacion({ cliente: 'A', lineas: [linea({ cantidad: 2, precio: 1000 })], total: 1 });
    expect(c.total).toBe(2000);
  });

  it('recorta los textos largos', () => {
    expect(limpiarCotizacion({ nota: 'A'.repeat(2000) }).nota).toHaveLength(MAX_NOTA);
    expect(limpiarCotizacion({ cliente: 'B'.repeat(400) }).cliente).toHaveLength(120);
  });

  it('cae en la fecha de hoy si la que llega no es una fecha', () => {
    expect(limpiarCotizacion({ fecha: 'mañana' }).fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(limpiarCotizacion({ fecha: '29/07/2026' }).fecha).not.toBe('29/07/2026');
    expect(limpiarCotizacion({ fecha: '2026-07-29' }).fecha).toBe('2026-07-29');
  });

  it('no imprime un 30 de febrero', () => {
    // Date lo acepta y lo convierte en el 2 de marzo sin avisar. Aqui se descarta: una fecha
    // imposible en un papel que se le entrega a un cliente es un papel que no vale.
    expect(limpiarCotizacion({ fecha: '2026-02-30' }).fecha).not.toBe('2026-02-30');
    expect(limpiarCotizacion({ fecha: '2026-13-01' }).fecha).not.toBe('2026-13-01');
    // El 29 de febrero de un bisiesto SI existe y tiene que pasar.
    expect(limpiarCotizacion({ fecha: '2028-02-29' }).fecha).toBe('2028-02-29');
  });

  it('descarta un estado inventado', () => {
    expect(limpiarCotizacion({ estado: '<script>' }).estado).toBe('borrador');
    expect(limpiarCotizacion({ estado: 'aceptada' }).estado).toBe('aceptada');
  });

  it('numera a cuatro cifras', () => {
    expect(numeroVisible(1)).toBe('0001');
    expect(numeroVisible(42)).toBe('0042');
    expect(numeroVisible(12345)).toBe('12345');
    expect(numeroVisible(undefined)).toBe('0001');
  });
});

describe('la validez', () => {
  it('vence a los días que se le pusieron', () => {
    expect(vencimientoDe({ fecha: '2026-07-29', validezDias: 30 })).toBe('2026-08-28');
  });

  it('cruza el fin de año sin despeinarse', () => {
    expect(vencimientoDe({ fecha: '2026-12-20', validezDias: 30 })).toBe('2027-01-19');
  });

  it('el día del vencimiento todavía vale', () => {
    // Decirle a un cliente "válida por 30 días" y rechazarla el dia 30 es hacer trampa.
    expect(estaVencida({ fecha: '2026-07-29', validezDias: 30 }, '2026-08-28')).toBe(false);
    expect(estaVencida({ fecha: '2026-07-29', validezDias: 30 }, '2026-08-29')).toBe(true);
  });

  it('una enviada que se pasó de fecha se enseña como vencida', () => {
    expect(estadoVisible({ fecha: '2026-01-01', validezDias: 30, estado: 'enviada' }, '2026-06-01').valor).toBe('vencida');
  });

  it('un borrador viejo no se marca vencido: nunca se le prometió nada a nadie', () => {
    expect(estadoVisible({ fecha: '2026-01-01', validezDias: 30, estado: 'borrador' }, '2026-06-01').valor).toBe('borrador');
  });

  it('una aceptada no vence: el precio ya se honró', () => {
    expect(estadoVisible({ fecha: '2026-01-01', validezDias: 30, estado: 'aceptada' }, '2026-06-01').valor).toBe('aceptada');
    expect(estadoVisible({ fecha: '2026-01-01', validezDias: 30, estado: 'rechazada' }, '2026-06-01').valor).toBe('rechazada');
  });

  it('todos los estados que se ofrecen tienen nombre', () => {
    for (const e of ESTADOS) {
      expect(e.valor).toMatch(/^[a-z]+$/);
      expect(e.nombre.trim()).not.toBe('');
    }
  });
});

describe('lo que pone la tienda por defecto', () => {
  it('una tienda que nunca tocó esto cotiza igual', () => {
    expect(ajustesDeCotizacion({})).toEqual({ vendedor: '', validezDias: VALIDEZ_POR_DEFECTO, nota: '' });
    expect(ajustesDeCotizacion(null).validezDias).toBe(VALIDEZ_POR_DEFECTO);
  });

  it('una cotización nueva nace con los datos de la tienda puestos', () => {
    const nueva = cotizacionNueva({ cotizacion: { vendedor: 'Felix Santana', validezDias: 15, nota: 'Precios sujetos a existencia.' } });
    expect(nueva.vendedor).toBe('Felix Santana');
    expect(nueva.validezDias).toBe(15);
    expect(nueva.nota).toBe('Precios sujetos a existencia.');
    expect(nueva.estado).toBe('borrador');
  });

  it('una validez absurda vuelve al valor de siempre', () => {
    expect(limpiarAjustesDeCotizacion({ validezDias: 0 }).validezDias).toBe(VALIDEZ_POR_DEFECTO);
    expect(limpiarAjustesDeCotizacion({ validezDias: 99999 }).validezDias).toBe(VALIDEZ_POR_DEFECTO);
    expect(limpiarAjustesDeCotizacion({ validezDias: 45 }).validezDias).toBe(45);
  });
});

describe('la cabecera del papel', () => {
  it('sale de los ajustes de la tienda, no del código', () => {
    // Es lo que permite vender una copia de esta tienda: el papel lleva el logo, el nombre y la
    // direccion de quien cotiza, sin tocar un archivo.
    const papel = datosDePapel({ storeName: 'Otra Tienda', currency: 'US$', logo: 'https://x/l.png', whatsapp: '8095551234', negocio: { direccion: 'Calle 1', rnc: '123' } });
    expect(papel).toMatchObject({ tienda: 'Otra Tienda', moneda: 'US$', direccion: 'Calle 1', rnc: '123', telefono: '8095551234' });
  });

  it('una tienda sin nada configurado no imprime un papel roto', () => {
    const papel = datosDePapel({});
    expect(papel.tienda).toBe('Tienda');
    expect(papel.moneda).toBe('RD$');
    expect(papel.logo).toBe('');
  });
});

describe('la versión del servidor dice lo mismo', () => {
  // Las reglas viven en dos sitios porque una corre en el navegador y la otra en la funcion. Si
  // se separan, el panel enseñaria un total y el servidor guardaria otro.
  const require = createRequire(import.meta.url);
  const servidor = require('../../api/_lib/cotizaciones.cjs');

  it('coinciden en el total', () => {
    const casos = [
      [linea({ cantidad: 2, precio: 1500 })],
      [linea({ cantidad: 3, precio: 0.335 })],
      [linea(), { descripcion: '', cantidad: 9, precio: 9999 }],
      [],
    ];
    for (const caso of casos) expect(servidor.totalDe(caso)).toBe(totalDeCotizacion(caso));
  });

  it('coinciden en qué renglón se descarta', () => {
    const lista = [linea(), { descripcion: '  ', precio: 5 }, linea({ descripcion: 'Otro' })];
    expect(servidor.lineasValidas(lista).map((l) => l.descripcion)).toEqual(lineasValidas(lista).map((l) => l.descripcion));
  });

  it('coinciden en los topes y en los estados', () => {
    expect(servidor.MAX_LINEAS).toBe(MAX_LINEAS);
    expect(servidor.MAX_NOTA).toBe(MAX_NOTA);
    expect(servidor.VALIDEZ_POR_DEFECTO).toBe(VALIDEZ_POR_DEFECTO);
    expect(servidor.ESTADOS.slice().sort()).toEqual(ESTADOS.map((e) => e.valor).sort());
  });

  it('los dos rechazan la misma fecha imposible', () => {
    for (const fecha of ['2026-02-30', '2026-13-01', 'mañana', '2028-02-29', '2026-07-29']) {
      expect(servidor.camposDelCuerpo({ fecha }).fecha === fecha).toBe(limpiarCotizacion({ fecha }).fecha === fecha);
    }
  });

  it('coinciden en qué campos quedan guardados', () => {
    const cuerpo = { fecha: '2026-07-29', cliente: 'Mini Sweet World', clienteTelefono: '809-555-0144', vendedor: 'Felix', validezDias: 30, nota: 'Nota', estado: 'enviada', lineas: [linea()] };
    expect(servidor.camposDelCuerpo(cuerpo)).toEqual(limpiarCotizacion(cuerpo));
  });
});

describe('el número de cotización', () => {
  const require = createRequire(import.meta.url);
  const servidor = require('../../api/_lib/cotizaciones.cjs');

  it('empieza en 1', () => {
    expect(servidor.siguienteNumero([])).toBe(1);
    expect(servidor.siguienteNumero(null)).toBe(1);
  });

  it('corre del mayor que exista, no de cuántas hay', () => {
    // Borrar la #0007 no puede hacer que la siguiente vuelva a llamarse #0007: dos papeles
    // distintos con el mismo numero en manos de dos clientes no se arregla despues.
    expect(servidor.siguienteNumero([{ numero: 7 }, { numero: 3 }])).toBe(8);
    expect(servidor.siguienteNumero([{ numero: 12 }])).toBe(13);
  });

  it('aguanta una lista con basura dentro', () => {
    expect(servidor.siguienteNumero([{ numero: 'cinco' }, null, { numero: 4 }])).toBe(5);
  });

  it('el panel no puede escribir ni el número ni el id', () => {
    // Llegan en el cuerpo de un PUT hecho a mano: si se aceptaran, se podria renumerar un papel
    // ya entregado o pisar otro.
    const actual = { id: 'cot_1', numero: 9, createdAt: '2026-01-01T00:00:00.000Z' };
    const guardada = servidor.actualizarCotizacion(actual, { id: 'otro', numero: 1, createdAt: '1999-01-01T00:00:00.000Z', cliente: 'A', lineas: [linea()] });
    expect(guardada.id).toBe('cot_1');
    expect(guardada.numero).toBe(9);
    expect(guardada.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(guardada.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
  });

  it('una cotización nueva nace numerada y con fechas', () => {
    const creada = servidor.crearCotizacion({ cliente: 'A', lineas: [linea()] }, [{ numero: 4 }]);
    expect(creada.numero).toBe(5);
    expect(creada.id).toMatch(/^cot_/);
    expect(creada.createdAt).toBe(creada.updatedAt);
  });
});
