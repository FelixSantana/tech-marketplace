# Handoff — Synaptic Tech Catálogo Digital

> Documento de traspaso para continuar este proyecto desde cualquier LLM (Claude, ChatGPT, Gemini, etc.) o desarrollador humano. Léelo completo antes de tocar código.

---

## 1. Qué es esto

Catálogo digital de productos para **Synaptic Tech**, una tienda de tecnología en República Dominicana. Los clientes navegan el catálogo público y hacen pedidos por WhatsApp con un solo toque. El dueño gestiona productos, precios, stock, garantía y ajustes desde un panel de administrador protegido por login.

**En producción:** https://synaptic-tech-catalogo.vercel.app
**Panel admin:** https://synaptic-tech-catalogo.vercel.app/admin

---

## 2. Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite 8, JS puro (sin TypeScript) |
| Estilos | CSS plano en `src/styles.css` (sin Tailwind ni CSS-in-JS) |
| Backend | Vercel Serverless Functions (Node.js, carpeta `/api`) |
| Base de datos | Upstash Redis, vía su REST API (no vía SDK) |
| Hosting | Vercel (proyecto: `synaptic-tech-catalogo`) |
| Auth admin | PBKDF2 (100k iteraciones, SHA-256) + tokens HMAC-SHA256, expiran a los 30 días |

**IMPORTANTE — extensión `.cjs` en `/api`:** El `package.json` tiene `"type": "module"`, lo que hace que Vercel trate todo `.js` como ES Module. Pero las funciones backend usan `require()` (CommonJS). Por eso todos los archivos de `/api` tienen extensión `.cjs`, no `.js`. **Si algún día agregas un archivo nuevo en `/api`, debe llevar `.cjs` o tendrás un error 500 silencioso** (así se rompió el catálogo una vez — ver sección 7).

---

## 3. Identificadores del proyecto

```
Vercel projectId:  prj_6ERC1k14JOWb0iLZsg7ydHD8MFuR
Vercel teamId:     team_ou0a3aoh6W96BEUBmpRaSNQb
Vercel project:    synaptic-tech-catalogo
GitHub repo:       https://github.com/FelixSantana/tech-marketplace
Upstash Redis URL: https://fast-eel-175381.upstash.io
```

**Credenciales de admin actuales:**
- Email: `synaptic.tech@hotmail.com`
- Password: `sinaptico123`

(Si cambiaron desde el panel de Ajustes, estas ya no aplican — no hay forma de recuperarlas salvo resetear la key `synaptic_admin` en Redis.)

---

## 4. Estructura de archivos

```
synaptic-react/
├── index.html                      ← plantilla HTML de Vite (fuentes Google, título)
├── vercel.json                     ← buildCommand, outputDirectory, rewrite /admin
├── vite.config.js
├── package.json                    ← OJO: "type": "module"
├── .gitignore
├── src/
│   ├── main.jsx                    ← entry point, monta <App/>
│   ├── App.jsx                     ← orquesta todo: estado global, modales, rutas
│   ├── styles.css                  ← todo el CSS de la app (single file)
│   ├── hooks/
│   │   ├── useCatalog.js           ← fetch/save del catálogo completo (settings+products+categories)
│   │   ├── useCart.js              ← carrito en localStorage
│   │   ├── useAuth.js              ← token de admin en localStorage + fetch a /api/auth
│   │   └── useToast.js             ← notificaciones tipo toast
│   ├── lib/
│   │   └── utils.js                ← compressImage, buildWaLink, buildCartWaLink, EMOJI_PICKS
│   ├── components/
│   │   ├── Header.jsx              ← logo, nombre tienda, buscador, toggle tema
│   │   ├── CategoryChips.jsx       ← filtro de categorías
│   │   ├── ProductGrid.jsx         ← grid + estados vacíos
│   │   ├── ProductCard.jsx         ← tarjeta individual (descripción truncada a 2 líneas + garantía)
│   │   ├── ProductDetail.jsx       ← modal de detalle con carrusel de fotos
│   │   ├── CartModal.jsx           ← modal del carrito
│   │   ├── Toast.jsx
│   │   └── admin/
│   │       ├── AuthModals.jsx      ← SetupModal (primera vez) + LoginModal
│   │       ├── AdminPanel.jsx      ← orquesta las 3 pestañas (productos/agregar/ajustes)
│   │       ├── ProductList.jsx     ← lista editable de productos
│   │       ├── ProductForm.jsx     ← alta/edición de producto (incluye campo Garantía)
│   │       └── SettingsForm.jsx    ← nombre tienda, WhatsApp, logo, cambio de credenciales
│   └── assets/                     (vacío, sin usar)
└── api/                            ← Vercel Serverless Functions — TODOS con extensión .cjs
    ├── auth.cjs                    ← POST: setup | login | change
    ├── catalog.cjs                 ← GET público, POST protegido (Bearer token)
    └── _lib/
        ├── kv.cjs                  ← helper genérico para Upstash Redis REST (kvGet/kvSet)
        └── auth.cjs                ← hashPassword, signToken, verifyToken, extractBearer
```

---

## 5. Cómo funciona el modelo de datos

Todo el catálogo vive en **una sola key de Redis**: `synaptic_catalog`, con esta forma:

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

Las credenciales de admin viven **separadas**, en la key `synaptic_admin`:
```json
{ "email": "...", "salt": "...", "hash": "...", "secret": "..." }
```

**Las imágenes se guardan como base64 inline dentro del JSON** (comprimidas a máx. 520px, calidad 0.62 JPEG antes de subir — ver `compressImage` en `lib/utils.js`). No hay bucket de almacenamiento de archivos. Esto significa que el catálogo puede crecer mucho en tamaño; `useCatalog.js` rechaza guardar si el payload supera 4.5MB (límite práctico de Vercel KV/Upstash).

---

## 6. Flujo de la app

1. **Primera visita sin configurar** (`settings.configured === false`) → se abre automáticamente el `SetupModal` pidiendo nombre de tienda, WhatsApp, correo y contraseña de admin.
2. **Cliente normal** entra a `/` → ve el catálogo, puede buscar, filtrar por categoría, agregar al carrito, o pedir un producto individual por WhatsApp (genera un link `wa.me` con mensaje prellenado).
3. **Admin** entra a `/admin` → si no tiene token válido en localStorage, ve el `LoginModal`; si ya tiene sesión, entra directo al `AdminPanel` con 3 pestañas: Productos / Agregar-Editar / Ajustes.
4. El pedido del carrito o de un producto individual **nunca pasa por el backend** — solo abre un link de WhatsApp (`https://wa.me/<numero>?text=<mensaje>`). No hay persistencia de órdenes en este momento (ver sección "Pendientes").

---

## 7. Bugs ya resueltos (para no repetirlos)

- **Pantalla negra / catálogo no carga:** causado por tener `.js` en `/api` cuando `package.json` tiene `"type": "module"`. Node intenta parsear `require()` como ESM y falla con 500 silencioso. Solución: usar `.cjs` para toda función serverless en `/api`, y actualizar los `require('./_lib/...')` internos para que apunten a `.cjs` también.
- **Deploys truncados / HTML incompleto:** en la versión anterior (HTML monolítico de 83KB en un solo archivo), pegar el archivo completo en una sola operación de deploy causaba truncamientos silenciosos. La migración a React con archivos pequeños (ninguno pasa de ~10KB) resuelve esto — cada componente se sube íntegro sin riesgo.
- **Bug de sintaxis en el campo de garantía** (versión HTML antigua): un ternario mal cerrado rompía todo el script. Ya no aplica en React porque cada input usa `useState` normal, sin template strings gigantes.

---

## 8. Cómo hacer deploy

**Opción recomendada (y la única probada end-to-end): conectar el repo de GitHub a Vercel** y dejar que Vercel compile automáticamente en cada push a `main`. Así evitas cualquier límite de tamaño de payload al pegar archivos manualmente.

Pasos:
1. Sube este código a `https://github.com/FelixSantana/tech-marketplace` (repo ya existe, actualmente vacío o desactualizado).
2. En Vercel, conecta ese repo al proyecto `synaptic-tech-catalogo` (o crea uno nuevo y actualiza el dominio).
3. Verifica que las variables de entorno estén configuradas en Vercel → Settings → Environment Variables:
   - `KV_REST_API_URL` o `UPSTASH_REDIS_REST_URL`
   - `KV_REST_API_TOKEN` o `UPSTASH_REDIS_REST_TOKEN`
4. Cada push a `main` dispara un build automático (`npm run build` → carpeta `dist/`).

**Si no tienes acceso a git desde tu entorno** (como en esta sesión de Claude — sin token de GitHub disponible), la alternativa es usar la herramienta de deploy directo de Vercel pegando el contenido de cada archivo. Es más frágil pero funciona si cada archivo se pega completo y sin errores de transcripción. Verifica siempre con `npm run build` localmente ANTES de deployar, para detectar errores de sintaxis antes de que lleguen a producción.

---

## 9. Cómo levantar el proyecto en local

```bash
cd synaptic-react
npm install
npm run dev          # servidor de desarrollo Vite en :5173, sin backend real
npm run build         # build de producción → dist/
npm run preview       # sirve el build de producción localmente
```

**Para probar el backend en local** necesitas exponer las funciones de `/api` (Vite por sí solo no las ejecuta). Opciones:
- Usar `vercel dev` (requiere Vercel CLI y estar logueado a la cuenta del proyecto).
- Levantar un servidor Node mock que responda `/api/catalog` y `/api/auth` con datos de prueba y usar el proxy de Vite (`server.proxy` en `vite.config.js`) apuntando a ese mock — así se verificó visualmente esta migración con Playwright.

---

## 10. Pendientes / ideas para continuar

Ordenados por lo que probablemente el dueño quiera después:

- [ ] **Sistema de órdenes**: actualmente los pedidos solo abren WhatsApp; no hay registro ni dashboard de órdenes en el admin. Ya se había diseñado un backend para esto en la versión HTML anterior (`api/orders.js` con `GET/POST/PUT`, dashboard con KPIs y gráfico de barras) pero **nunca se migró a React**. Si el dueño lo pide, hay que:
  1. Recrear `api/orders.cjs` (mismo patrón que `catalog.cjs`, key de Redis `synaptic_orders`).
  2. Llamar a `POST /api/orders` justo antes de abrir el link de WhatsApp en `buildWaLink`/`buildCartWaLink` (o en los handlers `onClick` donde se usan).
  3. Crear un componente `OrdersPanel.jsx` como 4ta pestaña del `AdminPanel`.
- [ ] **Dominio personalizado** — aún corre sobre `*.vercel.app`.
- [ ] **Migrar imágenes a un bucket real** (Vercel Blob, Cloudinary, S3) en vez de base64 inline — el catálogo puede volverse pesado y lento a medida que se agregan productos con fotos.
- [ ] **Variantes de producto** (talla, color) — no existe ese concepto todavía.
- [ ] **Exportar catálogo a PDF** para compartir sin depender del link.
- [ ] **Webhook real de WhatsApp Business API** en vez de links `wa.me` — permitiría automatizar respuestas y de verdad registrar conversiones.
- [ ] **Push a GitHub real**: en esta sesión no fue posible por falta de token/credenciales en el sandbox de Claude. El ZIP del código fuente completo se entregó como archivo descargable — alguien con acceso a la cuenta de GitHub del dueño debe hacer el primer push manual, y a partir de ahí Vercel puede quedar conectado al repo para builds automáticos.

---

## 11. Notas para el próximo LLM que trabaje aquí

- **No reescribas el HTML monolítico.** Este proyecto YA fue migrado de un solo `index.html` de 83KB a React con Vite. No regreses a ese patrón — es lo que causaba bugs difíciles de rastrear.
- **Todo archivo nuevo en `/api` debe ser `.cjs`**, o Vercel lo tratará como ESM y romperá el backend (ver sección 7).
- **Antes de deployar, siempre corre `npm run build` localmente.** Si compila sin errores, es una señal fuerte (no garantía absoluta) de que no romperás producción.
- **El CSS es un solo archivo plano** (`src/styles.css`), sin sistema de diseño ni Tailwind. Si agregas estilos nuevos, sigue la convención de nombres BEM-ish ya usada (`.card-warranty`, `.detail-cat`, etc.) para que no se pisen selectores.
- **Las imágenes van comprimidas a base64** — si vas a subir muchas fotos de producto de golpe, ten en cuenta el límite de 4.5MB del payload total del catálogo.
- **El dueño (Felix) se comunica en español** y prefiere explicaciones directas, sin rodeos innecesarios. Prioriza mostrarle resultado funcionando (capturas, links) antes de explicaciones largas de lo que hiciste.
