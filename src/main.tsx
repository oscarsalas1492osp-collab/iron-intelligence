import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

// ---- Funcionamiento sin conexión (solo en producción) ----
const CACHE = 'iron-shell-v1'; // mismo nombre que usa public/sw.js

/** Descarga en segundo plano todas las pantallas (también las que aún no se han abierto) y limpia versiones viejas. */
async function warmCache(): Promise<void> {
  try {
    const res = await fetch('./precache.json', { cache: 'no-store' });
    if (!res.ok) return;
    const files = ((await res.json()) as string[]).filter((f) => f !== 'precache.json').map((f) => new URL('./' + f, location.href).href);
    const cache = await caches.open(CACHE);
    const have = new Set((await cache.keys()).map((r) => r.url));
    await Promise.all(files.filter((f) => !have.has(f)).map((f) => cache.add(f).catch(() => undefined)));
    const keep = new Set(files);
    for (const url of have) if (url.includes('/assets/') && !keep.has(url)) await cache.delete(url);
  } catch { /* sin red o sin Cache API: se reintenta en la próxima apertura */ }
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(() => warmCache()).catch(() => { /* sin soporte: la app funciona igual con conexión */ });
  });
}
// Pide al navegador que no borre la base local bajo presión de espacio.
if (navigator.storage?.persist) void navigator.storage.persist().catch(() => false);
