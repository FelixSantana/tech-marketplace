import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

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
