import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

// Permite abrir la app sin conexión (solo en producción).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => { /* sin soporte: la app funciona igual */ }); });
}
// Pide al navegador que no borre la base local bajo presión de espacio.
if (navigator.storage?.persist) void navigator.storage.persist();
