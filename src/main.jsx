import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// En /admin se enlaza el manifiesto del PANEL, que arranca en /admin en vez de en la tienda.
//
// Sin esto, instalar desde /admin daba un icono que abria la tienda, y una aplicacion instalada
// no tiene barra de direcciones: desde la tienda no hay forma de llegar al panel. En un iPhone
// eso ademas deja sin avisos de pedido, porque iOS solo los entrega a la aplicacion instalada.
//
// Va aqui y no en un script dentro del HTML porque la politica de contenido del sitio no
// permite scripts en linea (script-src 'self'): uno ahi quedaria bloqueado.
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
