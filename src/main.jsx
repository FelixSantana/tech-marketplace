import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// En /admin se enlaza el manifiesto del PANEL, que arranca en /admin en vez de en la tienda.
//
// ESTO NO ES LO QUE HACE QUE FUNCIONE EN PRODUCCION. Ahi /admin lo sirve su propio archivo,
// dist/admin.html, que ya viene con el manifiesto correcto escrito (scripts/panel.mjs explica
// por que tuvo que ser asi: Safari ignora el href que cambia JavaScript). Alli estas lineas son
// un no-op, porque ponen el valor que ya hay.
//
// Se quedan por el servidor de desarrollo, que sirve index.html para cualquier ruta y no genera
// admin.html: sin ellas, /admin en local enlazaria el manifiesto de la tienda y lo que se
// prueba no se pareceria a lo que se publica.
if (window.location.pathname.replace(/\/$/, '') === '/admin') {
  const manifiesto = document.querySelector('link[rel="manifest"]');
  if (manifiesto) manifiesto.href = '/manifest.webmanifest?panel=1';
  // iOS saca el nombre del icono de aqui cuando no lee el manifiesto; que los dos digan lo
  // mismo evita acabar con dos iconos llamados igual y sin saber cual abre que.
  const titulo = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (titulo) titulo.setAttribute('content', 'Panel');
}

// Registrar el trabajador de servicio es lo unico que falta para que el telefono ofrezca
// instalar la tienda. Va despues de pintar, nunca antes: si falla, la tienda sigue igual.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => console.error('sw no registrado', e));
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
