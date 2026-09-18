# Handoff — Synaptic Tech Catálogo Digital

> Documento de traspaso para continuar este proyecto desde cualquier LLM (Claude, ChatGPT, Gemini, etc.) o desarrollador humano. Léelo completo antes de tocar código.

---

## 1. Qué es esto

Catálogo digital de productos para **Synaptic Tech**, una tienda de tecnología en República Dominicana. Los clientes navegan el catálogo público, arman un carrito o piden un producto individual, completan sus datos en un checkout, y el pedido se registra en el sistema **y** se les abre WhatsApp con el mensaje listo. El dueño gestiona productos, precios, stock, garantía, órdenes y ajustes desde un panel de administrador protegido por login.

**En producción:** https://synaptic-tech-catalogo.vercel.app
**Panel admin:** https://synaptic-tech-catalogo.vercel.app/admin

---

## 2. Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite 8, JS puro (sin TypeScript) |
| Estilos | CSS plano: `src/styles.css` (base) + `src/admin-overrides.css` (refinamientos posteriores, importado después) |
| Backend | Vercel Serverless Functions (Node.js, carpeta `/api`) |
| Base de datos | Upstash Redis, vía su REST API (no vía SDK) |
| Hosting | Vercel (proyecto: `synaptic-tech-catalogo`), conectado por Git — cada push a `main` hace deploy automático |
| Auth admin | PBKDF2 (100k iteraciones, SHA-256) + tokens HMAC-SHA256, expiran a los 7 días |

**Patrón de API (`.mjs` + `_handlers/*.cjs`):** el `package.json` tiene `"type": "module"`, así que Vercel trata todo `.js` como ES Module. Las funciones públicas en `/api/*.mjs` son wrappers ESM mínimos que solo hacen `import handler from './_handlers/xxx-handler.cjs'; export default handler;` — la lógica real vive en `api/_handlers/*.cjs`, que sí puede usar `require()` sin problema porque `.cjs` siempre se trata como CommonJS sin importar el `package.json`. **Si agregas un endpoint nuevo, sigue este mismo patrón** (archivo pública `.mjs` de una línea + handler real en `_handlers/*.cjs`) — no pongas lógica directamente en un `.js` en `/api`, causará un 500 silencioso (ver sección 8).

La lógica de dominio que conviene probar sin levantar HTTP ni tocar Redis vive un nivel más abajo, en `_lib/*.cjs` (`orders-logic.cjs`, `upload-logic.cjs`), y el handler solo la orquesta. Las pruebas de `npm test` apuntan ahí.

---

## 3. Identificadores del proyecto

```
Vercel projectId:  prj_6ERC1k14JOWb0iLZsg7ydHD8MFuR
Vercel teamId:     team_ou0a3aoh6W96BEUBmpRaSNQb
Vercel project:    synaptic-tech-catalogo
GitHub repo:       https://github.com/FelixSantana/tech-marketplace (conectado a Vercel, deploy automático en cada push a main)
Upstash Redis URL: https://fast-eel-175381.upstash.io
```

Las credenciales de admin viven en Redis (key `synaptic_admin`) y se crean/cambian desde la app — no hay un valor fijo documentado aquí porque se han reseteado más de una vez durante el desarrollo. Si nadie recuerda la contraseña actual, ver la sección 7 (endpoint de reset).

---

## 4. Estructura de archivos

```
synaptic-react/
├── index.html                          ← plantilla HTML de Vite (fuentes Google, título)
├── vercel.json                         ← buildCommand, outputDirectory, rewrite /admin
├── vite.config.js
├── package.json                        ← OJO: "type": "module"
├── .gitignore
├── public/
│   ├── icon-180.png                    ← favicon y apple-touch-icon
│   ├── icon-192.png / icon-512.png     ← iconos del manifiesto (instalar en el teléfono)
│   ├── icon-maskable-512.png           ← el mismo icono sin esquinas, para el recorte de Android
│   ├── manifest.webmanifest            ← nombre, colores e iconos de la app instalada
│   ├── sw.js                           ← trabajador de servicio mínimo, sin caché (ver sección 5)
│   └── og-image.jpg                    ← imagen de la vista previa al compartir
├── src/
│   ├── main.jsx                        ← entry point, monta <App/>
│   ├── App.jsx                         ← orquesta todo: estado global, modales, rutas, importa ambos CSS
│   ├── styles.css                      ← CSS base (storefront, cards, modales, admin genérico)
│   ├── admin-overrides.css             ← refinamientos posteriores: checkout, orders, settings, product form
│   ├── hooks/
│   │   ├── useCatalog.js               ← fetch/save del catálogo completo (settings+products+categories)
│   │   ├── useCart.js                  ← carrito en localStorage
│   │   ├── useAuth.js                  ← token de admin en localStorage + fetch a /api/auth
│   │   └── useToast.js                 ← notificaciones tipo toast
│   ├── lib/
│   │   └── utils.js                    ← compressImage, buildWaLink, buildCartWaLink, EMOJI_PICKS
│   ├── components/
│   │   ├── Header.jsx                  ← logo, nombre tienda, buscador, toggle tema
│   │   ├── CategoryChips.jsx           ← filtro de categorías
│   │   ├── ProductGrid.jsx             ← grid + estados vacíos
│   │   ├── ProductCard.jsx             ← tarjeta individual (descripción truncada a 2 líneas + garantía)
│   │   ├── ProductDetail.jsx           ← modal de detalle con carrusel de fotos
│   │   ├── CartModal.jsx               ← modal del carrito, botón lleva a CheckoutModal
│   │   ├── CheckoutModal.jsx           ← datos del cliente (nombre/WhatsApp/notas), registra la orden y abre WhatsApp
│   │   ├── Toast.jsx
│   │   └── admin/
│   │       ├── AuthModals.jsx          ← SetupModal (primera vez) + LoginModal
│   │       ├── AdminPanel.jsx          ← orquesta las 4 pestañas: Productos / Agregar / Órdenes / Ajustes
│   │       ├── ProductList.jsx         ← lista editable de productos
│   │       ├── ProductForm.jsx         ← alta/edición de producto (incluye campo Garantía)
│   │       ├── OrdersPanel.jsx         ← dashboard de órdenes: KPIs, filtros, tabla, alta manual de orden
│   │       ├── SettingsForm.jsx        ← nombre tienda, WhatsApp, logo, cambio de credenciales
│   │       ├── VariantTable.jsx        ← tabla de variantes dentro de ProductForm
│   │       ├── PrintCatalog.jsx        ← vistas imprimibles (clientes / inventario)
│   │       ├── MigrateImages.jsx       ← botón para mover fotos incrustadas al bucket
│   │       ├── ShippingForm.jsx        ← entrega, retiro y zonas de envío en Ajustes
│   │       ├── CouponsForm.jsx         ← cupones de descuento en Ajustes
│   │       ├── MetricsPanel.jsx        ← pestaña Métricas: embudo y productos más mirados
│   │       └── BackupsPanel.jsx        ← historial del catálogo en Ajustes: listar y restaurar
│   └── assets/                         (vacío, sin usar)
└── api/
    ├── auth.mjs                        ← wrapper → _handlers/auth-handler.cjs
    ├── catalog.mjs                     ← wrapper → _handlers/catalog-handler.cjs
    ├── orders.mjs                      ← wrapper → _handlers/orders-handler.cjs
    ├── admin-reset.mjs                 ← wrapper → _handlers/admin-reset-handler.cjs
    ├── upload.mjs                      ← wrapper → _handlers/upload-handler.cjs
    ├── producto.mjs                    ← wrapper → _handlers/producto-handler.cjs
    ├── evento.mjs                      ← wrapper → _handlers/evento-handler.cjs
    ├── _handlers/
    │   ├── auth-handler.cjs            ← POST: setup | login | change | status
    │   ├── catalog-handler.cjs         ← GET público, POST protegido (Bearer token)
    │   ├── orders-handler.cjs          ← GET/POST/PUT/DELETE, ver sección 6
    │   ├── admin-reset-handler.cjs     ← POST protegido por ADMIN_RESET_SECRET, borra la cuenta admin
    │   ├── upload-handler.cjs          ← POST protegido sube a Blob; DELETE borra fotos sin usar
    │   ├── producto-handler.cjs        ← sirve /p/<slug> con las etiquetas del producto
    │   └── evento-handler.cjs          ← POST público cuenta eventos; GET admin da el resumen
    └── _lib/
        ├── kv.cjs                      ← helper genérico para Upstash Redis REST (kvGet/kvSet/kvDel)
        ├── auth.cjs                    ← hashPassword, signToken, verifyToken, extractBearer
        ├── orders-logic.cjs            ← líneas de orden, apartados y descuento de inventario
        ├── catalog-logic.cjs           ← versión del catálogo y rechazo de guardados viejos
        ├── envio.cjs                   ← resuelve entrega y costo de envío
        ├── cupones.cjs                 ← resuelve el descuento de un código
        ├── metricas.cjs                ← contadores del embudo y su resumen
        ├── backup-logic.cjs            ← historial del catálogo: copiar, podar y restaurar
        ├── login-rate.cjs              ← freno escalonado a los intentos de login
        ├── producto-html.cjs           ← inyecta las etiquetas del producto en el HTML
        └── upload-logic.cjs            ← validación de las imágenes que se suben
```

---

## 5. Cómo funciona el modelo de datos

**Catálogo** — key de Redis `synaptic_catalog`:

```json
{
  "settings": {
    "storeName": "Synaptic Tech",
    "tagline": "Tecnología al alcance de tu WhatsApp",
    "whatsapp": "18095551234",
    "currency": "RD$",
    "logo": "data:image/jpeg;base64,...",
    "configured": true
  },
  "products": [
    {
      "id": "p_1234567890_ab3xy",
      "name": "Audífonos Bluetooth X200",
      "price": 2500,
      "category": "Accesorios",
      "warranty": "6 meses",
      "description": "Texto largo...",
      "stockQty": 12,
      "images": ["data:image/jpeg;base64,...", "..."],
      "primaryImage": 0
    }
  ],
  "categories": [
    { "name": "Laptops", "emoji": "💻" },
    { "name": "Celulares", "emoji": "📱" }
  ]
}
```

**Versión del catálogo** — el documento lleva un campo `version` entero. `POST /api/catalog` solo acepta un guardado cuyo `version` sea el que está guardado, y responde `409 CATALOG_CONFLICT` si no; completar una orden también la sube. Un catálogo sin el campo cuenta como versión 0.

Por eso **el panel nunca guarda lo que tiene en memoria**: `saveCatalog(token, cambio)` lee el catálogo fresco del servidor, le aplica `cambio(fresco)` y manda la versión leída; si choca, reintenta una vez. Toda escritura nueva desde el panel tiene que expresarse como función sobre el catálogo fresco. Antes, un panel abierto hacía rato guardaba su copia vieja y revertía el stock descontado al completar una orden.

Al editar un producto, `mergeProductEdit` (`src/lib/catalogMerge.js`) decide el stock: si el admin no cambió el número respecto de cuando abrió el formulario, manda el valor fresco del servidor; si lo cambió, manda el del admin. Lo mismo por variante.

**Entrega, envío y cupones** — viven dentro de `settings` del catálogo:

```jsonc
"envio": { "activo": false, "zonas": [{ "id": "z_x", "nombre": "Santo Domingo", "precio": 250 }],
           "retiroEnTienda": false, "direccionTienda": "", "pedidoMinimo": 0 },
"cupones": [{ "id": "c_x", "codigo": "BIENVENIDO", "tipo": "porcentaje", "valor": 10,
              "vence": "", "minimo": 0, "activo": true }]
```

Con `envio.activo` en falso el checkout se comporta como antes: la entrega se coordina por WhatsApp y no se le pide nada más al cliente. **El costo del envío y el descuento los calcula siempre el servidor** (`api/_lib/envio.cjs` y `api/_lib/cupones.cjs`) a partir de estos ajustes; el navegador solo manda la zona elegida y el código escrito. Los cupones no llevan contador de usos, a propósito: contarlo obligaría a que el pedido público escriba en el catálogo y eso choca con el control de versión.

**Apartados** — key `synaptic_reservas`: `{ "<productId>::<variantId|>": unidades }`. Un pedido en `pending`, `paid` o `shipped` retiene sus unidades; cancelarlo las libera; completarlo las descuenta del stock. Lo recalcula el manejador de órdenes en cada cambio y viaja junto al catálogo en el `GET`, para que la tienda muestre **lo disponible** sin traerse las mil órdenes. El panel sigue viendo el stock real más cuántas hay apartadas.

**Historial del catálogo** — key `synaptic_catalog_bak`: lista de `{ ts, version, data }`, la más nueva primero. El manejador de catálogo copia cada guardado (y el catálogo de antes de restaurar, así que restaurar también se deshace). Se conservan los últimos cinco guardados más el primero de cada día, con tope de 15. **Las fotos incrustadas (`data:`) no se copian**: pesan casi todo el catálogo y multiplicarlas por quince sería impagable; en su lugar va la marca `__foto_omitida__` y al restaurar se toman las fotos que el producto tenga hoy, emparejadas por posición. Las fotos que ya viven en Blob son URLs cortas y esas sí viajan enteras en la copia — otra razón para mover las fotos al almacén. Consecuencia deliberada: `DELETE /api/upload` **no borra** una foto del almacén que alguna copia del historial todavía nombre, para no dejar copias con imágenes rotas; el almacén crece un poco más a cambio. La lógica pura vive en `api/_lib/backup-logic.cjs` y está probada. El panel lo muestra en Ajustes (`BackupsPanel`), pidiendo el historial con `GET /api/catalog?respaldos=1` (solo admin, devuelve fechas y totales, nunca los catálogos enteros) y restaurando con `POST /api/catalog` `{ accion: 'restaurar', ts }`.

**Métricas** — key `synaptic_metricas`: `{ dias: { "YYYY-MM-DD": { visita, producto, checkout, pedido, whatsapp } }, productos: { "<id>": vistas } }`. Contadores propios, sin terceros y sin datos del visitante. Los días se podan a 60. El evento `pedido` lo cuenta el manejador de órdenes y el endpoint lo rechaza si llega de fuera.

**Admin** — key `synaptic_admin`: `{ email, salt, hash, secret }`.

**Freno del login** — key `synaptic_login_rate:<ip>`: `{ fallos, hasta }`. Cuatro intentos libres; a partir del quinto fallo la IP espera 1, 5, 15 y hasta 60 minutos, y el freno se comprueba **antes** de evaluar la contraseña, así que estando bloqueado da lo mismo si la acierta. Una hora sin fallos nuevos borra la cuenta (la key expira sola), y un inicio de sesión correcto la limpia. Protege `login` y `change`. A propósito **no hay bloqueo global**: con uno, cualquiera desde muchas IPs dejaría al dueño fuera de su propio panel. La lógica pura vive en `api/_lib/login-rate.cjs` y está probada.

**Órdenes** — key `synaptic_orders`, array de objetos (más recientes primero, tope de 1000 guardadas):
```json
{
  "id": "ord_...",
  "customerName": "Juan Perez",
  "phone": "8095551234",
  "notes": "...",
  "status": "pending | paid | shipped | completed | cancelled",
  "source": "whatsapp_checkout | manual",
  "products": [{ "productId": "p1", "name": "...", "quantity": 1, "unitPrice": 7500, "subtotal": 7500 }],
  "total": 7500,
  "createdAt": "ISO date",
  "updatedAt": "ISO date",
  "inventoryDeducted": false
}
```

**Las imágenes se suben a Vercel Blob y en el catálogo solo queda su URL.** El panel las comprime antes de subir (máx. 520px, calidad 0.62 JPEG — ver `compressImage` en `lib/utils.js`) y las manda a `POST /api/upload`.

Las fotos viejas siguen guardadas como base64 inline dentro del JSON y **se muestran igual**: el `<img>` recibe la cadena tal cual venga, sea URL o data URL. No hay migración obligatoria; el botón "Mover fotos" de la pestaña Productos las pasa al bucket cuando se quiera.

Si `BLOB_READ_WRITE_TOKEN` no está configurado, `/api/upload` responde `503` y el panel vuelve a incrustar la foto como antes, avisando al usuario. Por eso desplegar sin bucket no rompe nada.

`useCatalog.js` sigue rechazando guardar si el payload del catálogo supera 4.5MB — un límite que ya casi no se toca una vez migradas las fotos.

---

## 6. Flujo de la app

1. **Primera visita sin configurar** (`GET /api/auth` acción `status` → `configured: false`) → se abre el `SetupModal` pidiendo nombre de tienda, WhatsApp, correo y contraseña de admin.
2. **Enlace propio de un producto**: `/p/<nombre-en-guiones>-<sufijo-del-id>`. Lo sirve `api/producto`, que pide el `index.html` del despliegue y le inyecta título, descripción con precio, `og:image` y datos estructurados, porque WhatsApp no ejecuta JavaScript al armar la vista previa. El sufijo del id es lo que resuelve el producto, así que renombrarlo no rompe enlaces ya compartidos. **Ojo:** una foto incrustada en el catálogo no sirve como `og:image`; mientras no se migren al bucket, la vista previa por producto muestra la imagen de la tienda.
3. **Cliente normal** entra a `/` → navega el catálogo, agrega al carrito o pide un producto individual → llega al `CheckoutModal`, llena nombre/WhatsApp/notas → al confirmar, se hace `POST /api/orders` con `source: "whatsapp_checkout"` (público, sin auth, con rate limit) que **registra la orden en Redis** y **luego** abre el link `wa.me` con el mensaje prellenado.
3. **Admin** entra a `/admin` → `LoginModal` si no hay token válido; si hay sesión, panel con 4 pestañas: Productos / Agregar-Editar / **Órdenes** / Ajustes.
4. En **Órdenes**, el admin puede: ver KPIs (órdenes de hoy, ingresos de hoy, pendientes, total), buscar/filtrar por estado, cambiar el estado de una orden, crear una orden manual (`source: "manual"`), o eliminarla. **Al marcar una orden como `completed`, el backend descuenta automáticamente el stock** de los productos involucrados (una sola vez, controlado por el flag `inventoryDeducted`).
5. El endpoint de órdenes distingue automáticamente entre pedido público (checkout del cliente, sin token) y gestión admin (requiere Bearer token) según el método HTTP y el campo `source` del body.

---

## 7. Endpoint de reset de administrador

`POST /api/admin-reset` borra por completo la key `synaptic_admin` de Redis, dejando la tienda sin ningún admin (el siguiente acceso a `/admin` mostrará el `SetupModal` de nuevo). Requiere:
- Variable de entorno `ADMIN_RESET_SECRET` configurada en Vercel (si no existe, el endpoint responde `503 RESET_NOT_CONFIGURED` y no hace nada).
- El secreto enviado como header `X-Admin-Reset-Secret` o como `Authorization: Bearer <secreto>`.

**Precaución:** este endpoint ya causó confusión una vez — alguien lo invocó (a propósito o sin querer) y el frontend, que cachea el token de sesión en `localStorage`, seguía mostrando el panel admin normal hasta que se intentaba cambiar credenciales, momento en el que el backend respondía `NOT_SETUP` porque la cuenta ya no existía. Si esto vuelve a pasar: cerrar sesión, volver a entrar a `/admin`, y usar el `SetupModal` para crear una cuenta nueva.

---

## 8. Bugs ya resueltos (para no repetirlos)

- **Pantalla negra / catálogo no carga:** causado por poner lógica de negocio directamente en un `.js` dentro de `/api` cuando `package.json` tiene `"type": "module"` — Node intenta parsear `require()` como ESM y falla con 500 silencioso. Resuelto con el patrón `.mjs` wrapper + `_handlers/*.cjs` descrito en la sección 2.
- **Formulario de checkout roto (Nombre/WhatsApp/Notas superpuestos):** el CSS de `.form-grid` solo existía con el selector `.checkout-panel .form-grid`. Corregido generalizando la regla a `.form-grid` a secas en `admin-overrides.css`, para que también cubra el formulario de "Nueva orden" en `OrdersPanel` que usa la misma clase sin ese ancestro.
- **`<select>` de filtro de estado con fondo blanco:** los `<select>` nativos (`.order-filter`, el picker de producto en nueva orden) no tenían `background`/`color` definidos y heredaban el estilo del sistema operativo. Se les agregó fondo oscuro y una flecha SVG personalizada.
- **Tabla de órdenes cortada en pantallas angostas:** sin ancho mínimo, las columnas se comprimían hasta ser ilegibles. Se le dio a `.orders-table` un `min-width` fijo dentro de un contenedor con scroll horizontal.
- **No hay admin creado / no puedo crear uno:** normalmente significa que la key `synaptic_admin` fue borrada (ver sección 7), no que el flujo de setup esté roto. Confirmar mirando los Runtime Logs de Vercel — un `400 NOT_SETUP` en `/api/auth` es la señal.
- **Deploys truncados al pegar archivos manualmente:** ya no aplica — el proyecto está conectado a GitHub y Vercel hace el build desde el repo. Evitar el deploy directo vía API de Vercel salvo emergencia.

---

## 9. Cómo hacer deploy

**El repo ya está conectado a Vercel.** El flujo normal es: editar código → `npm run build` local para confirmar que compila → `git commit` → `git push origin main` → Vercel construye y publica automáticamente. Verificar el resultado con `get_deployment_build_logs` / `get_runtime_logs` (o el dashboard de Vercel) después de cada push.

No usar la herramienta de deploy directo de Vercel (pegar archivos vía API) salvo que git no esté disponible — es más frágil y no deja rastro en el historial del repo.

Variables de entorno necesarias en Vercel → Settings → Environment Variables:
- `KV_REST_API_URL` / `UPSTASH_REDIS_REST_URL`
- `KV_REST_API_TOKEN` / `UPSTASH_REDIS_REST_TOKEN`
- `ADMIN_RESET_SECRET` (opcional, solo si se quiere habilitar `/api/admin-reset`)
- `BLOB_READ_WRITE_TOKEN` — lo inyecta solo Vercel al crear un store de Blob en el proyecto. Sin él, las fotos se siguen incrustando en el catálogo.

---

## 10. Cómo levantar el proyecto en local

```bash
cd synaptic-react
npm install
npm run dev          # servidor de desarrollo Vite, sin backend real
npm run build         # build de producción → dist/
npm run preview       # sirve el build de producción localmente
npm test              # vitest, solo lógica pura (catálogo, órdenes, subida de imágenes)
npm run lint          # oxlint
```

Para probar el backend en local (Vite no ejecuta `/api` por sí solo):
- `vercel dev` (requiere Vercel CLI logueada a la cuenta del proyecto), o
- Levantar un servidor Node mock que responda `/api/catalog`, `/api/orders` y `/api/auth` con datos de prueba, y usar `server.proxy` en `vite.config.js` apuntando a ese mock. Así se verificaron visualmente todos los cambios de este documento, con capturas de Playwright.

---

## 11. Pendientes / ideas para continuar

- [ ] **Crear el store de Blob en Vercel y tocar "Mover fotos"** en el panel. El código está desplegado y esperando el token; hasta entonces las fotos siguen viajando dentro del catálogo y las vistas previas por producto muestran la imagen de la tienda. Lo hace el dueño.
- [ ] **Dominio personalizado** — aún corre sobre `*.vercel.app`. Al ponerlo hay que actualizar las URLs absolutas de `index.html` y regenerar `public/og-image.jpg` si cambia el nombre o el lema.
- [ ] **WhatsApp Business API** en vez de links `wa.me` — bloqueado por la verificación de negocio en Meta, que hace el dueño. **El aviso de pedido nuevo va aquí**: se decidió esperar a la API en vez de usar correo o Telegram, así que hoy un pedido que el cliente no llega a enviar solo se ve abriendo el panel.
- [ ] **Cobro con enlace de pago** (AZUL ofrece Link de Pagos, 4–6% de comisión). La afiliación la hace el dueño.
- [ ] **Contador de usos de los cupones.** Ver la sección 5: hoy no se cuentan a propósito.
- [ ] **Comprobante fiscal electrónico (e-CF).** Consultar primero con el contador si aplica.

Hechos el 2026-09-18:

- [x] **Límite de intentos en el login** — ver sección 5, key `synaptic_login_rate:<ip>`.
- [x] **Cabeceras de seguridad** — `vercel.json` manda política de contenido, nosniff, referrer-policy, permissions-policy y X-Frame-Options, además del HSTS que ya estaba. La política se probó sirviendo el build local con las mismas cabeceras antes de desplegar: tienda, fuentes de Google y página de producto sin una sola violación en consola. Si algún día hay que meter un script o un dominio nuevo, se toca ahí y **se vuelve a mirar la consola**, porque una política mal puesta rompe la tienda en silencio.
- [x] **Instalable en el teléfono** — manifiesto, iconos 192/512 y uno recortable, más `public/sw.js`. El trabajador de servicio **no cachea nada** a propósito: existe solo porque Chrome no ofrece "Instalar aplicación" sin uno, y un caché mal hecho dejaría al cliente viendo precios viejos. Si algún día se quiere que la tienda abra sin señal, ahí es donde hay que trabajar, con cuidado. El nombre de la tienda en el manifiesto es fijo: si cambia en Ajustes, hay que cambiarlo también en `public/manifest.webmanifest`. **Sin verificar en un teléfono real**: el navegador de pruebas no deja registrar trabajadores de servicio, así que hay que abrir la tienda en Chrome Android después del despliegue y confirmar que aparece "Instalar aplicación".
- [x] **Historial del catálogo** — ver sección 5. Una copia por guardado, restaurable desde Ajustes.
- [x] **Sesión de admin de 30 a 7 días** — el token vive en `localStorage`. Efecto visible: hay que volver a entrar al panel una vez por semana.

Hechos el 2026-09-17:

- [x] **Búsqueda sin acentos** — "audifonos" encuentra "Audífonos".
- [x] **Stock validado por suma de líneas** — dos líneas del mismo artículo ya no se pasan del stock.
- [x] **Apartar stock al entrar el pedido** — ver sección 5. La tienda muestra lo disponible.
- [x] **Datos de entrega y envío por zona** — configurables en Ajustes, apagado por defecto.
- [x] **Aviso de privacidad en el checkout** — texto para la Ley 172-13, pendiente de que lo valide un abogado.
- [x] **Cupones de descuento.**
- [x] **Enlace propio por producto, con vista previa** — ver sección 6.
- [x] **Analítica del embudo** — pestaña Métricas, contadores propios.
- [x] **Limpieza técnica** — lint en cero y el almacén ya borra las fotos que dejan de usarse.

Hechos el 2026-09-14:

- [x] **Editar un producto revertía el stock vendido.** Completar una orden descontaba en el servidor, pero el panel guardaba su copia vieja del catálogo entero y deshacía el descuento; la orden quedaba marcada como descontada y esa venta no se restaba nunca. Resuelto con versión del catálogo y guardado sobre la copia fresca (ver sección 5). El panel además recarga el catálogo al cambiar el estado de una orden.
- [x] **Quitar todas las variantes no las quitaba.** El formulario sin variantes omitía el campo y las viejas sobrevivían al mezclar.

Hechos en la sesión del 2026-09-05:

- [x] **Variantes de producto** — un eje por producto, con precio y stock propios. Ver `VARIANTES.md`.
- [x] **Exportar catálogo** — dos vistas imprimibles desde el panel: catálogo para clientes y hoja de inventario.
- [x] **Migrar imágenes a un bucket real** — Vercel Blob.
- [x] **Accesibilidad de formularios** — los 20 controles con `htmlFor`/`id` explícitos.

---

## 12. Notas para el próximo LLM que trabaje aquí

- **No reescribas el HTML monolítico.** Este proyecto fue migrado de un solo `index.html` de 83KB a React con Vite — no regreses a ese patrón.
- **Todo endpoint nuevo sigue el patrón `.mjs` wrapper + `_handlers/*.cjs`** (sección 2). No pongas lógica en un `.js` suelto dentro de `/api`.
- **El CSS vive en dos archivos**: `styles.css` (base) y `admin-overrides.css` (importado después, gana la cascada en empates de especificidad). Antes de agregar una clase nueva, revisa ambos archivos para no duplicar ni pisar reglas existentes — este fue precisamente el origen de varios bugs visuales.
- **Antes de hacer push, siempre corre `npm run build` localmente.** Si compila sin errores es una señal fuerte de que no romperás producción, aunque no una garantía absoluta (revisa también visualmente si el cambio es de UI).
- **Cada cambio va por commit + push a GitHub**, no por deploy directo — así el repo queda como fuente de verdad y el historial es legible.
- **Las imágenes van comprimidas a base64** — cuidado con el límite de 4.5MB del payload total del catálogo.
- **El dueño (Felix) se comunica en español** y prefiere resultado mostrado (capturas, links) antes que explicaciones largas de lo que se hizo.
