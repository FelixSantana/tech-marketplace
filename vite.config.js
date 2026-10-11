import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolverOrigen, aplicarOrigen, resolverNombre, aplicarNombre, resolverVerificacion, aplicarVerificacion } from './scripts/dominio.mjs'

// Resuelve al compilar lo que index.html no puede saber de otra forma: el dominio del despliegue
// y el nombre de la tienda. El por que de cada uno esta en scripts/dominio.mjs.
function origenEnHtml() {
  return {
    name: 'origen-en-html',
    transformIndexHtml(html) {
      const origen = resolverOrigen(process.env)
      // En Vercel, quedarse sin dominio significa publicar la portada sin vista previa ni
      // canonica, y en silencio. Se avisa en el registro del build para que se vea al desplegar:
      // la causa casi siempre es el ajuste "Enable access to System Environment Variables"
      // apagado, y la solucion es ponerle TIENDA_URL al proyecto.
      if (!origen && process.env.VERCEL) {
        console.warn(
          '[origen-en-html] Sin dominio: ni TIENDA_URL ni VERCEL_PROJECT_PRODUCTION_URL ni VERCEL_URL.\n' +
          '                 La portada sale sin og:url, og:image ni canonical.',
        )
      }
      if (!String(process.env.TIENDA_NOMBRE || '').trim() && process.env.VERCEL) {
        console.warn(
          '[origen-en-html] Sin TIENDA_NOMBRE: el titulo y la vista previa de la portada saldran\n' +
          '                 con el marcador de posicion en vez del nombre de la tienda.',
        )
      }
      // Un codigo que no tiene la forma que usa Google se descarta, y descartarlo sin decir nada
      // deja al dueño pulsando "Verificar" en Search Console sin entender por que falla. El error
      // tipico es pegar la etiqueta entera en vez de solo el content.
      const verificacion = resolverVerificacion(process.env)
      const codigoCrudo = String(process.env.GOOGLE_SITE_VERIFICATION || '').trim()
      if (codigoCrudo && !verificacion) {
        console.warn(
          '[origen-en-html] GOOGLE_SITE_VERIFICATION no tiene forma de codigo de Google y se\n' +
          '                 descarta. Se espera solo el valor de content="...", no la etiqueta\n' +
          '                 entera: letras, numeros, guion y guion bajo, entre 10 y 100.',
        )
      }
      const conOrigen = aplicarOrigen(html, origen)
      const conNombre = aplicarNombre(conOrigen, resolverNombre(process.env))
      return aplicarVerificacion(conNombre, verificacion)
    },
  }
}

export default defineConfig({
  plugins: [react(), origenEnHtml()],
})
