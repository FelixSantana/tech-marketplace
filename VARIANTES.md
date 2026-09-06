# Diseño — Variantes de producto

Pendiente 3 del `HANDOFF.md`. Documento de diseño aprobado, previo a la implementación.
Fecha: 2026-09-05.

---

## 1. Qué se construye

Un producto puede declarar **un eje de variación** (`Capacidad`, `RAM`, `Condición`) con varias
opciones, y **cada opción lleva su propio precio y su propio inventario**. Una laptop se vende
como 256GB a RD$18,000 con 3 unidades y 512GB a RD$22,000 con 1 unidad, bajo una sola ficha.

Decisiones tomadas al diseñar:

| Pregunta | Decisión |
|---|---|
| ¿Qué cambia entre variantes? | Precio y stock propios (SKU real) |
| ¿Cuántos ejes? | Uno solo |
| ¿Fotos por variante? | No, compartidas del producto |
| ¿Qué hace la tarjeta del catálogo? | Muestra "desde RD$X" y obliga a abrir el detalle |
| ¿Cómo se identifica una variante en carrito y órdenes? | Campo `variantId` aparte del `productId` |

## 2. Por qué `variantId` aparte, y no un id compuesto

Hoy la identidad del producto es plana en toda la cadena: el carrito guarda `{productId, qty}`,
la línea de orden guarda `{productId, name, quantity, unitPrice, subtotal}`, y
`applyInventoryDeduction` descuenta buscando por `product.id`.

Se evaluaron tres caminos:

- **Id compuesto** (`p_123::v_256gb`) en el campo de siempre. Menos código hoy, pero los ids
  pasan a tener estructura que hay que parsear en todos lados, y si se borra o renombra una
  variante, las órdenes viejas guardan un id que ya no resuelve a nada.
- **Cada variante como producto suelto** con un `parentId`. El backend no se toca en absoluto,
  pero cada listado necesita lógica de agrupación para no mostrar la misma laptop cuatro veces,
  y duplicar descripción y garantía por variante engorda el JSON contra el techo de 4.5MB.
- **`variantId` como segundo campo.** Elegido.

La razón de fondo: el handler **ya congela una copia del nombre del producto** en la línea de la
orden (`buildPublicItems` hace `name: cleanText(product.name, 180)`). El código ya asume que una
orden debe sobrevivir a que el catálogo cambie debajo. Guardar también `variantAxis` y
`variantLabel` extiende ese patrón existente en vez de inventar uno nuevo, y resuelve de raíz el
problema que hunde al id compuesto.

## 3. Modelo de datos

Si `variants` falta o está vacío, el producto se comporta **exactamente como hoy**. Ese es el
interruptor de compatibilidad.

```jsonc
{
  "id": "p_1234567890_ab3xy",
  "name": "Dell Latitude E7450",
  "category": "Laptops",
  "warranty": "3 meses",
  "description": "...",
  "images": ["data:image/jpeg;base64,..."],   // compartidas por todas las variantes
  "primaryImage": 0,

  "price": 18000,        // con variantes, espejo del mínimo (ver §5)
  "stockQty": 3,         // con variantes, espejo de la suma (ver §5)

  "variantAxis": "Capacidad",                  // ausente = producto sin variantes
  "variants": [
    { "id": "v_a1b2c3", "label": "256GB SSD", "price": 18000, "stockQty": 3 },
    { "id": "v_d4e5f6", "label": "512GB SSD", "price": 22000, "stockQty": 1 }
  ]
}
```

**Línea del carrito:** `{ productId, variantId, qty }`, con `variantId: null` en productos sin
variantes. La clave para agrupar el mismo artículo pasa a ser producto+variante, pero solo en
memoria — nunca se persiste como id compuesto.

**Línea de la orden**, extendiendo el formato actual:

```jsonc
{
  "productId": "p_1234567890_ab3xy",
  "variantId": "v_d4e5f6",
  "variantAxis": "Capacidad",     // copia congelada
  "variantLabel": "512GB SSD",    // copia congelada
  "name": "Dell Latitude E7450",  // ya existía
  "quantity": 1, "unitPrice": 22000, "subtotal": 22000
}
```

**Derivados**, para no tener dos fuentes de verdad del inventario:

- `getStockQty(producto)` devuelve la **suma** del stock de las variantes cuando existen.
- El precio de la tarjeta es el **mínimo**, mostrado como "desde RD$18,000".
- En el panel, Precio y Cantidad en stock del producto quedan deshabilitados **para edición
  manual** cuando hay variantes; la tabla de variantes manda y el formulario los recalcula sola
  al guardar (ver §5).

**Variante agotada.** Una variante con `stockQty` 0 se muestra en el selector pero no se puede
elegir, marcada como agotada. Se sigue viendo para que el cliente sepa que esa configuración
existe y puede preguntar por ella.

## 4. Puntos de cambio

`Number(product.price)` se lee directo en cinco sitios: `ProductCard.jsx:19`,
`ProductDetail.jsx:41` y `:49`, `CartModal.jsx:8` y `:24`, y `ProductList.jsx:17`. Parchear cada
uno con lógica de variantes es cómo se rompen las cosas.

En vez de eso se extiende `useCatalog.js`, que ya es donde viven estos ayudantes (`getStockQty`,
`getProductImages`, `getPrimaryImage`). Los cinco sitios pasan a llamar helpers:

```js
hasVariants(p)              getVariants(p)        getVariant(p, variantId)
getUnitPrice(p, variantId)  getMinPrice(p)        getStockQty(p)  // ahora suma variantes
```

### Frontend

| Archivo | Cambio |
|---|---|
| `hooks/useCatalog.js` | Los helpers de arriba. `getStockQty` suma variantes. La normalización del fetch (`:33`) también normaliza `variants`. |
| `hooks/useCart.js` | El item gana `variantId`; la agrupación pasa a producto+variante; el stock se valida contra la variante. La hidratación (`:13-18`) recorta cantidades y descarta variantes que ya no existan. |
| `components/ProductCard.jsx` | **Solo si el producto tiene variantes**: el precio pasa a "desde RD$X" y los dos botones (`:21`, `:24`) dejan de agregar y pedir, y abren el detalle. Sin variantes, la tarjeta se comporta igual que hoy, con sus dos botones directos. |
| `components/ProductDetail.jsx` | Selector de variante nuevo. Precio, etiqueta de stock (`:16-19`), tope del contador y total (`:49`) siguen a la variante elegida. Sin elegir, los botones quedan deshabilitados. |
| `components/CartModal.jsx` | Búsqueda y `key` por producto+variante (`:22`), etiqueta de la variante bajo el nombre, precio unitario y tope del stepper (`:25`) desde la variante. |
| `components/CheckoutModal.jsx` | El resumen muestra la variante, el POST la manda, y la línea del mensaje de WhatsApp la nombra. |
| `components/admin/ProductForm.jsx` | Tabla de variantes: nombre del eje, filas de etiqueta/precio/stock, agregar y quitar. Precio y stock del producto se deshabilitan con una nota cuando hay variantes. |
| `components/admin/ProductList.jsx` | `:17` muestra "desde X · Stock: suma · N variantes". |
| `components/admin/OrdersPanel.jsx` | El selector de producto de una orden manual ofrece las variantes, y las filas las muestran. |

`ProductForm.jsx` son 93 líneas y `useCart.js` 54. La tabla de variantes sale a su propio
componente para que el formulario siga siendo legible.

### Backend — `api/_handlers/orders-handler.cjs`

- `buildPublicItems` — resuelve la variante, valida stock **contra la variante**, congela
  `variantId`/`variantAxis`/`variantLabel`, y toma `unitPrice` de ella.
- `buildAdminItems` — misma resolución, conservando que el admin pueda sobrescribir el precio.
- `applyInventoryDeduction` — descuenta de `variants[].stockQty` cuando la línea trae variante,
  del producto cuando no. Mantiene su regla actual de validar todo antes de descontar nada.
- Claves de error nuevas en el mapa de mensajes, con su texto en español:
  - `VARIANT_REQUIRED` — la línea no trae `variantId` y el producto tiene variantes.
  - `INVALID_VARIANT` — el `variantId` no existe en ese producto.
  - `INVENTORY_VARIANT_UNKNOWN` — al completar una orden, una línea sin variante pertenece a un
    producto que ahora tiene variantes (ver §6).

`catalog-handler.cjs` **no se toca**: no valida la forma del producto, guarda lo que el panel le
mande, así que las variantes viajan solas.

## 5. Compatibilidad con producción

Los ~20 productos actuales no se tocan: sin `variants`, se comportan igual que hoy. **No hay
migración de datos**, que era el objetivo de elegir este camino.

**El despliegue es inocuo por sí solo.** Ningún producto tiene variantes hasta que se cree la
primera desde el panel, así que subir el código no cambia nada visible. Las variantes entran
producto por producto.

**Para que un rollback no rompa nada**, cuando un producto tenga variantes el formulario igual
escribe `price` = el mínimo y `stockQty` = la suma, como copia denormalizada. Si se revierte el
código, la versión vieja lee esos campos y muestra un precio coherente en vez de `NaN`.

Las variantes son JSON sin imágenes: el peso contra el techo de 4.5MB es despreciable.

## 6. Casos borde decididos

**Órdenes viejas pendientes.** Hay órdenes en Redis con líneas sin `variantId`. Si se marca como
completada una orden vieja de un producto que ahora tiene variantes, el `stockQty` del producto
ya es solo un espejo y descontar ahí no baja el inventario real de ninguna variante.

`applyInventoryDeduction` **falla con `INVENTORY_VARIANT_UNKNOWN`** en ese caso, en vez de
descontar de un campo fantasma. El admin edita la orden, elige la variante y la completa. Es el
mismo comportamiento que ya tiene hoy `INVENTORY_NOT_CONFIGURED`.

**Carritos viejos en navegadores de clientes.** `localStorage` guarda `{productId, qty}` sin
variante. Si el cliente vuelve y ese producto ya tiene variantes, ese item no puede resolver un
precio. Se **descarta en la hidratación** con un aviso: "Algunos productos cambiaron y salieron
de tu carrito". Dejarlo y elegir una variante por él sería adivinar con el dinero del cliente.

## 7. Pruebas

El proyecto **no tiene runner de pruebas**: `package.json` no declara script de test y las
dependencias son solo React y Vite. Para inventario en una tienda viva eso no alcanza.

Se agrega `vitest` como dependencia de desarrollo —encaje natural en un proyecto Vite— cubriendo
**solo la lógica pura**, que es donde está el riesgo:

- Helpers de `useCatalog.js`: suma de stock, precio mínimo, resolución de variante, y el camino
  sin variantes.
- `buildPublicItems`: rechaza variante inexistente, rechaza cantidad mayor al stock de esa
  variante, congela etiqueta y precio.
- `applyInventoryDeduction`: descuenta de la variante correcta, respeta `inventoryDeducted`, y
  falla entera sin descontar nada cuando una línea de varias no alcanza.

Los flujos de interfaz se verifican en el navegador contra el servidor mock descrito en
`HANDOFF.md` §10, como hasta ahora. **No se cubren componentes de React**: montar infraestructura
de testing de UI no es lo que está en riesgo aquí.

## 8. Fuera de alcance

- **Segundo eje de variación** (Color × Capacidad). El esquema actual no lo soporta; añadirlo
  después requiere migración.
- **Fotos por variante.** Empujaría el catálogo contra el techo de 4.5MB y obligaría a hacer
  antes el pendiente 2 (imágenes a un bucket real).
- **Pendientes 4 y 5** (PDF y WhatsApp Business API). Son proyectos aparte, con su propio
  diseño. Ambos dependen de este: el PDF debe listar variantes y el mensaje de pedido debe
  nombrarlas.
