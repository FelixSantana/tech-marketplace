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
| Auth admin | PBKDF2 (100k iteraciones, SHA-256) + tokens HMAC-SHA256, expiran a los 30 días |

**Patrón de API (`.mjs` + `_handlers/*.cjs`):** el `package.json` tiene `"type": "module"`, así que Vercel trata todo `.js` como ES Module. Las funciones públicas en `/api/*.mjs` son wrappers ESM mínimos que solo hacen `import handler from './_handlers/xxx-handler.cjs'; export default handler;` — la lógica real vive en `api/_handlers/*.cjs`, que sí puede usar `require()` sin problema porque `.cjs` siempre se trata como CommonJS sin importar el `package.json`. **Si agregas un endpoint nuevo, sigue este mismo patrón** (archivo pública `.mjs` de una línea + handler real en `_handlers/*.cjs`) — no pongas lógica directamente en un `.js` en `/api`, causará un 500 silencioso (ver sección 8).

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
│   │       └── SettingsForm.jsx        ← nombre tienda, WhatsApp, logo, cambio de credenciales
│   └── assets/                         (vacío, sin usar)
└── api/
    ├── auth.mjs                        ← wrapper → _handlers/auth-handler.cjs
    ├── catalog.mjs                     ← wrapper → _handlers/catalog-handler.cjs
    ├── orders.mjs                      ← wrapper → _handlers/orders-handler.cjs
    ├── admin-reset.mjs                 ← wrapper → _handlers/admin-reset-handler.cjs
    ├── _handlers/
    │   ├── auth-handler.cjs            ← POST: setup | login | change | status
    │   ├── catalog-handler.cjs         ← GET público, POST protegido (Bearer token)
    │   ├── orders-handler.cjs          ← GET/POST/PUT/DELETE, ver sección 6
    │   └── admin-reset-handler.cjs     ← POST protegido por ADMIN_RESET_SECRET, borra la cuenta admin
    └── _lib/
        ├── kv.cjs                      ← helper genérico para Upstash Redis REST (kvGet/kvSet/kvDel)
        └── auth.cjs                    ← hashPassword, signToken, verifyToken, extractBearer
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

**Admin** — key `synaptic_admin`: `{ email, salt, hash, secret }`.

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

**Las imágenes se guardan como base64 inline dentro del JSON** (comprimidas a máx. 520px, calidad 0.62 JPEG — ver `compressImage` en `lib/utils.js`). No hay bucket de archivos. `useCatalog.js` rechaza guardar si el payload del catálogo supera 4.5MB.

---

## 6. Flujo de la app

1. **Primera visita sin configurar** (`GET /api/auth` acción `status` → `configured: false`) → se abre el `SetupModal` pidiendo nombre de tienda, WhatsApp, correo y contraseña de admin.
2. **Cliente normal** entra a `/` → navega el catálogo, agrega al carrito o pide un producto individual → llega al `CheckoutModal`, llena nombre/WhatsApp/notas → al confirmar, se hace `POST /api/orders` con `source: "whatsapp_checkout"` (público, sin auth, con rate limit) que **registra la orden en Redis** y **luego** abre el link `wa.me` con el mensaje prellenado.
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

---

## 10. Cómo levantar el proyecto en local

```bash
cd synaptic-react
npm install
npm run dev          # servidor de desarrollo Vite, sin backend real
npm run build         # build de producción → dist/
npm run preview       # sirve el build de producción localmente
```

Para probar el backend en local (Vite no ejecuta `/api` por sí solo):
- `vercel dev` (requiere Vercel CLI logueada a la cuenta del proyecto), o
- Levantar un servidor Node mock que responda `/api/catalog`, `/api/orders` y `/api/auth` con datos de prueba, y usar `server.proxy` en `vite.config.js` apuntando a ese mock. Así se verificaron visualmente todos los cambios de este documento, con capturas de Playwright.

---

## 11. Pendientes / ideas para continuar

- [ ] **Dominio personalizado** — aún corre sobre `*.vercel.app`.
- [ ] **Migrar imágenes a un bucket real** (Vercel Blob, Cloudinary, S3) en vez de base64 inline — el catálogo puede volverse pesado y lento con muchas fotos.
- [ ] **Variantes de producto** (talla, color).
- [ ] **Exportar catálogo a PDF**.
- [ ] **Webhook real de WhatsApp Business API** en vez de links `wa.me` — permitiría automatizar respuestas.
- [ ] **Revisar accesibilidad de formularios** — algunos campos usan `<label>` envolviendo el input sin `htmlFor`/`id` explícitos; funciona pero vale la pena revisar con un lector de pantalla.

---

## 12. Notas para el próximo LLM que trabaje aquí

- **No reescribas el HTML monolítico.** Este proyecto fue migrado de un solo `index.html` de 83KB a React con Vite — no regreses a ese patrón.
- **Todo endpoint nuevo sigue el patrón `.mjs` wrapper + `_handlers/*.cjs`** (sección 2). No pongas lógica en un `.js` suelto dentro de `/api`.
- **El CSS vive en dos archivos**: `styles.css` (base) y `admin-overrides.css` (importado después, gana la cascada en empates de especificidad). Antes de agregar una clase nueva, revisa ambos archivos para no duplicar ni pisar reglas existentes — este fue precisamente el origen de varios bugs visuales.
- **Antes de hacer push, siempre corre `npm run build` localmente.** Si compila sin errores es una señal fuerte de que no romperás producción, aunque no una garantía absoluta (revisa también visualmente si el cambio es de UI).
- **Cada cambio va por commit + push a GitHub**, no por deploy directo — así el repo queda como fuente de verdad y el historial es legible.
- **Las imágenes van comprimidas a base64** — cuidado con el límite de 4.5MB del payload total del catálogo.
- **El dueño (Felix) se comunica en español** y prefiere resultado mostrado (capturas, links) antes que explicaciones largas de lo que se hizo.
