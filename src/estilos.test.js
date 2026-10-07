import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

// La regla que da aspecto a los campos de formulario enumeraba los tipos de input: text, number,
// tel y password. Cualquier otro salia con la pinta cruda del navegador —un recuadro blanco y
// pequeño en medio de un formulario oscuro— y nadie se enteraba hasta verlo. Paso con type=email,
// el correo de contacto del negocio en Ajustes. Ahora se estilan por exclusion, asi que un tipo
// nuevo queda cubierto solo.
//
// Los correos del login y del alta de cuenta van dentro de .input-with-icon, que dibuja el borde
// y el fondo en el contenedor a proposito: esos no estaban rotos. El vencimiento de un cupon
// tampoco, porque .cupon-row input ya era generica.
describe('el aspecto de los campos de formulario', () => {
  const regla = css.match(/\.field input[^{]*\{[^}]*\}/);

  it('existe la regla que los estiliza', () => {
    expect(regla).not.toBeNull();
  });

  it('no enumera tipos de input', () => {
    expect(regla[0]).not.toMatch(/\.field input\[type=/);
    expect(regla[0]).toContain(':not(');
  });

  it('solo excluye los que deben conservar su aspecto nativo', () => {
    const excluidos = [...regla[0].matchAll(/\[type=([a-z]+)\]/g)].map((m) => m[1]).sort();
    expect(excluidos).toEqual(['button', 'checkbox', 'color', 'file', 'radio', 'range', 'submit']);
  });

  // Los tipos que el panel usa de verdad tienen que caer dentro de la regla, no fuera.
  it('cubre todos los tipos de texto que usa el panel', () => {
    const usados = new Set();
    const anda = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const ruta = join(dir, e.name);
        if (e.isDirectory()) anda(ruta);
        else if (e.name.endsWith('.jsx')) {
          for (const m of readFileSync(ruta, 'utf8').matchAll(/type="([a-z]+)"/g)) usados.add(m[1]);
        }
      }
    };
    anda(fileURLToPath(new URL('./components', import.meta.url)));
    const nativos = new Set(['button', 'checkbox', 'color', 'file', 'radio', 'range', 'submit']);
    const deTexto = [...usados].filter((t) => !nativos.has(t));
    // email y date son los que estaban fuera; si alguien añade otro, esta prueba lo recoge.
    expect(deTexto.sort()).toContain('email');
    for (const t of deTexto) {
      expect(regla[0]).not.toContain(`[type=${t}]`);
    }
  });
});
