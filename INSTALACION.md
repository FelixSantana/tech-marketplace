# Montar una tienda para un cliente nuevo

Cada cliente es una **instalación independiente**: el mismo repositorio, pero su propio proyecto
de Vercel, su propia base de datos, su propio almacén de fotos y su propio dominio. Los datos de
un cliente son físicamente inalcanzables desde la tienda de otro.

Un `git push` a este repositorio actualiza a **todos** los clientes a la vez, porque todos los
proyectos apuntan aquí. Eso es la ventaja y también el cuidado: un cambio mal probado llega a
todos. Probar en la tienda propia antes de empujar.

Tiempo real: unos 20 minutos la primera vez, 10 cuando ya le hayas cogido el ritmo.

---

## 1. Crear el proyecto en Vercel

1. **Add New → Project** → importar **este mismo repositorio**.
2. Nombre del proyecto: `tienda-<cliente>`.
3. No toques la configuración de compilación: `vercel.json` ya la trae.
4. **No despliegues todavía** — sin base de datos la tienda arranca, pero vacía. Da igual si lo
   haces; en el paso 4 se vuelve a desplegar.

## 2. Base de datos (Redis)

1. En el proyecto → **Storage → Create Database → Redis** (Upstash).
2. Región: la más cercana al cliente.
3. Conéctala al proyecto en **Production**. Inyecta sola `KV_REST_API_URL` y `KV_REST_API_TOKEN`.

Sin base de datos, todos los endpoints responden `503 DB_NOT_CONNECTED`. Es la primera señal a
mirar si algo no va.

## 3. Almacén de fotos (Blob)

1. **Storage → Create Database → Blob**.
2. **El acceso tiene que ser `Public`.** No se puede cambiar después: ni el modo de acceso ni la
   región. En un almacén privado cada lectura exige autenticación, habría que servir cada foto
   desde una función —pagando cómputo por miniatura y perdiendo el CDN— y WhatsApp no podría leer
   la imagen al compartir un producto.
3. Conéctalo al proyecto. Inyecta `BLOB_STORE_ID`; la autenticación va por OIDC, con la identidad
   del propio despliegue. **No hace falta ningún token de lectura-escritura.**

Si `/api/upload` responde `BLOB_NOT_CONFIGURED` con el almacén ya conectado, falta redesplegar:
una variable nueva no llega a un despliegue que ya estaba corriendo.

## 4. Variable de recuperación

**Settings → Environment Variables → Add**, en **Production**:

- `ADMIN_RESET_SECRET` — un valor largo y distinto **para cada cliente**. Genéralo así:

  ```bash
  node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
  ```

Guárdalo donde guardes las contraseñas. Es la única forma de recuperar el panel si el cliente
olvida su clave, y no caduca nunca: quien lo tenga puede borrar la cuenta de administrador.

Ahora sí: **Deployments → Redeploy**, para que el despliegue tome las tres variables.

### El dominio de la vista previa, si hace falta

Normalmente **no hay que tocar nada**: el dominio que llevan `og:url`, `og:image` y `canonical`
lo resuelve el build desde `VERCEL_PROJECT_PRODUCTION_URL`, que Vercel pone solo.

La excepción es el ajuste **Settings → Environment Variables → "Enable access to System
Environment Variables"**. Si está apagado, esa variable llega vacía y la portada sale sin vista
previa ni canónica — en el registro del build queda el aviso `[origen-en-html] Sin dominio`. Se
arregla encendiendo el ajuste, o poniendo la variable a mano:

- `TIENDA_URL` — el dominio de la tienda, con o sin `https://` (`repuestos-lr.com.do`).

Comprobación, con la tienda ya desplegada:

```bash
curl -s https://<dominio-del-cliente>/ | grep -E 'og:url|canonical'
```

Tiene que salir el dominio del cliente. Si sale el de otra tienda, el despliegue es viejo:
redesplegar.

## 5. Crear la cuenta del cliente

1. Abre `https://<proyecto>.vercel.app/admin`.
2. Sale la pantalla de creación de cuenta (no hay ninguna todavía).
3. Créala **con el correo del cliente**, y que la contraseña la escriba él. Tú no necesitas su
   contraseña: para mantenimiento te basta su token de sesión, que caduca a los 7 días.

## 6. Dejar la tienda con su cara

Todo esto se hace desde **Ajustes**, sin tocar código:

- Logo, nombre de la tienda, frase corta, número de WhatsApp y moneda.
- **Datos del negocio**: RNC, dirección, horario, cobertura, correo y formas de pago.
- **Entrega y envío**: zonas y precios, o retiro en tienda.
- Cupones, si los quiere.

Luego carga los productos desde la pestaña **Agregar**. Consejo que vale dinero: que los nombres
lleven las especificaciones dentro —"Laptop Dell Latitude E7450 Core i7 5ta Gen – 16GB RAM"—,
porque es como busca la gente en Google.

## 7. Dominio

**Settings → Domains** → añadir el dominio del cliente. **Que el dominio lo compre y lo pague él,
a su nombre.** Te ahorra una discusión incómoda el día que decida irse, y es lo correcto.

---

## Lo que todavía está atado a la tienda de Synaptic

Mientras estos puntos sigan abiertos, una copia saldría con restos de la tienda original. Ver la
sección 13 del `HANDOFF.md`:

- `public/og-image.jpg` tiene "Synaptic Tech" dibujado encima. Es la imagen que sale al compartir
  la portada, y la de respaldo al compartir un producto que todavía no tiene foto.
- El **nombre** de la tienda sigue escrito en `index.html` (`<title>`, `og:site_name`,
  `og:title`). El dominio ya no: ese sale del despliegue. Al compartir un **producto** el nombre
  sí es el correcto, porque `/p/<slug>` lo lee de Ajustes al servir la página.
- `public/manifest.webmanifest` y los iconos llevan el nombre de Synaptic: es lo que el cliente
  vería al instalar la tienda en su teléfono.
- El color de marca está en el CSS.

## Costes

- **Vercel Hobby no permite uso comercial.** Al cobrar hace falta Pro: es un coste fijo tuyo, no
  por cliente, y cubre todos los proyectos.
- **Upstash** y **Blob** se pagan por uso; una tienda pequeña cabe en el nivel gratuito.
- El dominio lo paga el cliente.

El coste marginal de un cliente más es casi cero. Por eso el modelo que se sostiene es cobrar la
instalación una vez más una mensualidad de mantenimiento — y **vender el servicio, no el código**.
