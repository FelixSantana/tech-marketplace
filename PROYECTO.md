# Synaptic Tech — Catálogo Digital con WhatsApp

> Documentación completa para continuar el desarrollo en otro chat.

---

## Resumen del proyecto

App web tipo catálogo de productos para **Synaptic Tech** (tienda de tecnología en República Dominicana). Los clientes navegan el catálogo y hacen pedidos por WhatsApp. El dueño gestiona productos, categorías y ajustes desde un panel admin.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Single-page HTML/CSS/JS (un solo archivo) |
| Backend | Vercel Serverless Functions (Node.js) |
| Base de datos | Upstash Redis (KV) via REST API |
| Hosting | Vercel |
| Auth admin | PBKDF2 (100k iter) + tokens HMAC-SHA256 |

---

## URLs en producción

| Propósito | URL |
|---|---|
| Catálogo para clientes | `https://synaptic-tech-catalogo.vercel.app` |
| Panel admin | `https://synaptic-tech-catalogo.vercel.app/admin` |
| URL del equipo (igual) | `https://synaptic-tech-catalogo-synaptic-tech.vercel.app` |

---

## Estructura de archivos del proyecto

```
/
├── index.html              ← Frontend fuente (no minificado, EDITAR ESTE)
├── index.min.html          ← Frontend minificado (se genera automáticamente)
├── vercel.json             ← Rewrite: /admin → /index.html
└── api/
    ├── catalog.js          ← GET catálogo (público) / POST catálogo (requiere token)
    ├── auth.js             ← Login, setup, cambio de credenciales
    └── _lib/
        ├── kv.js           ← Helper para Vercel KV / Upstash Redis
        └── auth.js         ← Hash PBKDF2, tokens HMAC, helpers de auth
```

---

## Keys en Redis (Upstash)

| Key | Contenido |
|---|---|
| `synaptic_catalog` | Catálogo completo: `{ settings, products, categories }` |
| `synaptic_admin` | Credenciales admin: `{ email, salt, hash, secret }` |

---

## Variables de entorno en Vercel

Configuradas automáticamente al conectar Upstash KV al proyecto:

```
KV_REST_API_URL      ← URL de la base de datos Upstash
KV_REST_API_TOKEN    ← Token de la base de datos Upstash
```

> También acepta los nombres alternativos `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

---

## API endpoints

### `GET /api/catalog`
- Público, sin autenticación
- Devuelve `{ settings, products, categories }`

### `POST /api/catalog`
- Requiere `Authorization: Bearer <token>` en los headers
- Body: `{ settings, products, categories }`
- Devuelve `{ ok: true }` o error

### `POST /api/auth`
- Body siempre incluye `action`

| action | Descripción | Campos |
|---|---|---|
| `setup` | Crea la cuenta admin (solo si no existe) | `email`, `password` |
| `login` | Inicia sesión | `email`, `password` |
| `change` | Cambia correo y/o contraseña | `currentPassword`, `newEmail?`, `newPassword?` + Bearer token |

---

## Flujo de autenticación

1. Admin va a `/admin`
2. Frontend detecta la ruta y llama `openAdmin()`
3. Si hay token en `localStorage` (`admin_token`) → entra directo al panel
4. Si no hay token → muestra modal de login (correo + contraseña)
5. Al hacer login exitoso → guarda token en `localStorage`, válido 30 días
6. Cada `POST /api/catalog` envía `Authorization: Bearer <token>` 
7. Si el servidor devuelve 401 → borra el token local y pide re-login

---

## Sistema de seguridad

- Contraseñas hasheadas con **PBKDF2** (salt aleatorio 16 bytes, 100,000 iteraciones, SHA-256)
- Tokens de sesión firmados con **HMAC-SHA256** usando un `secret` único por tienda (32 bytes aleatorios)
- Comparación de credenciales con `timingSafeEqual` (anti timing attacks)
- El token expira a los **30 días**
- Al cerrar sesión desde Ajustes → token eliminado de `localStorage`

---

## Funcionalidades completadas

### Catálogo público (clientes)

- Grid de productos con foto, nombre, categoría, precio, descripción
- Buscador en tiempo real
- Filtros por categoría (chips)
- Click en producto → modal de detalle con carrusel de fotos, stock, selector de cantidad
- Botón "Pedir por WhatsApp" en cada tarjeta (pedido directo con mensaje pre-armado)
- Botón de carrito en cada tarjeta → agrega al carrito flotante
- Carrito flotante (FAB violeta, badge rojo) → modal con ajuste de cantidades, total, "Finalizar pedido por WhatsApp"
- Switch tema oscuro/claro (luna/sol en header, persiste en `localStorage`)
- Responsive móvil (breakpoint 520px)
- Animación de fondo tipo red neuronal (canvas)

### Panel Admin (`/admin`)

- **Login**: correo + contraseña, modal con insignia de candado, barra degradada de acento
- **Tuerca fija** arriba a la derecha al estar en `/admin` → reabre el panel sin salir de la URL
- Sesión guardada 30 días en `localStorage`
- **3 pestañas**:
  - **Productos**: lista con thumb, precio, stock, categoría; editar/eliminar
  - **Agregar/Editar**: fotos múltiples (hasta 6, con selección de principal ★), nombre, precio, stock, categoría (con creación de nuevas), descripción
  - **Ajustes**: logo tienda, nombre, tagline, WhatsApp, moneda; sección separada para cambiar correo/contraseña (requiere contraseña actual); botón "Cerrar sesión"
- Responsive en móvil (campos de precio/stock apilados, tabs compactos, modal con scroll)

---

## Cómo hacer cambios y redesplegar

### Requisito previo
El proyecto se despliega usando la **API de Vercel directamente** desde Claude (sin Git, sin CLI). El frontend se minifica automáticamente antes de cada deploy.

### Flujo estándar para editar algo

1. Editar `/home/claude/deploy/index.html` (fuente sin minificar)
2. Minificar:
   ```js
   // Ejecutar en bash con Node.js disponible en el entorno de Claude
   const { minify } = require('html-minifier-terser');
   // (ya está instalado en /home/claude/deploy/node_modules)
   ```
3. Validar JS: `node --check extracted_min.js`
4. Desplegar via `Vercel:deploy_to_vercel` con los 6 archivos:
   - `vercel.json`
   - `api/_lib/kv.js`
   - `api/_lib/auth.js`
   - `api/auth.js`
   - `api/catalog.js`
   - `index.html` (el minificado, como `"file": "index.html"`)

### Variables del proyecto Vercel (para usar en herramientas)
```
teamId:    synaptic-tech
projectId: prj_6ERC1k14JOWb0iLZsg7ydHD8MFuR
teamOrgId: team_ou0a3aoh6W96BEUBmpRaSNQb
```

---

## Configuración actual de la tienda

- **Nombre**: Synaptic Tech
- **WhatsApp**: 8295858871
- **Moneda**: RD$
- **Admin email**: (configurado por el usuario, no se almacena aquí)
- **Categorías predeterminadas**: Laptops 💻, Celulares 📱, Accesorios 🎧, Servicios 🛠️

---

## Cosas pendientes / ideas para el futuro

- [ ] Dominio personalizado (actualmente en `.vercel.app`) — se puede agregar desde Vercel Dashboard → Project → Settings → Domains
- [ ] Agregar productos reales al catálogo desde el panel admin
- [ ] Notificaciones cuando llega un pedido (webhook de WhatsApp Business API)
- [ ] Modo "Agotado global" que oculta el catálogo con mensaje personalizado
- [ ] Estadísticas básicas de clicks / pedidos
- [ ] Soporte para variantes de producto (talla, color, etc.)
- [ ] Exportar catálogo a PDF

---

## Notas técnicas importantes

### ¿Por qué un solo archivo HTML?
Para simplificar el deploy sin necesidad de bundler, build step ni repositorio Git. El minificador comprime el HTML/CSS/JS juntos.

### Límite de tamaño del catálogo
El catálogo completo (incluyendo imágenes en base64) tiene un límite de 4.5MB por petición al API. Las imágenes se comprimen automáticamente a 520px máximo y calidad 0.62 JPEG antes de guardarse.

### Imágenes
Las imágenes se guardan como base64 dentro del JSON del catálogo en Redis. No hay un servicio de almacenamiento de archivos externo.

### Carrito
El carrito es **personal** de cada cliente, guardado en `localStorage` de su navegador. No se sincroniza con el servidor.

### Tema oscuro/claro
El tema se guarda en `localStorage` como `'theme': 'light'` o `'dark'`. Hay un script en el `<head>` que lo aplica antes del primer render para evitar flash.

---

## Último deployment exitoso

- **Deployment ID**: `dpl_yv3di2kyGLA2y8mtMBAcB4sEKyZV`
- **Fecha**: ~23 Jul 2026
- **Archivos**: 6 (index.html + 5 backend)
- **Build**: completado sin errores

---

## Historial de transcripts

Los transcripts completos de desarrollo están en `/mnt/transcripts/` en el entorno de Claude. El journal está en `/mnt/transcripts/journal.txt`.
