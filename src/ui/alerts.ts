import { tr } from '../i18n';
// Avisos del descanso: sonido y notificación. La notificación aparece también en el reloj enlazado al teléfono.

let ctx: AudioContext | null = null;
/** Dos tonos cortos. Los navegadores solo permiten sonido después de un toque del usuario; si no se puede, no suena. */
export function beep(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    for (const [i, f] of [880, 1175].entries()) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, t0 + i * 0.22); g.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.22 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.18);
      o.connect(g).connect(ctx.destination); o.start(t0 + i * 0.22); o.stop(t0 + i * 0.22 + 0.2);
    }
  } catch { /* sin audio */ }
}
/** Deja el audio listo dentro de un toque del usuario (necesario en iPhone). */
export function primeAudio(): void {
  try { const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (AC) { ctx ??= new AC(); if (ctx.state === 'suspended') void ctx.resume(); } } catch { /* sin audio */ }
}

export const canNotify = () => typeof Notification !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
export const notifyGranted = () => canNotify() && Notification.permission === 'granted';
export async function askNotify(): Promise<boolean> {
  if (!canNotify()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try { return (await Notification.requestPermission()) === 'granted'; } catch { return false; }
}
/** Notificación de fin de descanso. Solo si la app no está a la vista: en pantalla ya hay aviso y vibración. */
export async function notifyRestEnd(body: string): Promise<void> {
  if (!notifyGranted() || !document.hidden) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(tr('Descanso terminado'), { body: tr(body), tag: 'descanso', icon: './icon-v2-192.png', badge: './icon-v2-192.png', renotify: true, vibrate: [250, 120, 250] } as NotificationOptions);
  } catch { /* sin permiso o sin service worker */ }
}
export async function clearRestNotice(): Promise<void> {
  if (!notifyGranted()) return;
  try { const reg = await navigator.serviceWorker.ready; (await reg.getNotifications({ tag: 'descanso' })).forEach((n) => n.close()); } catch { /* nada que cerrar */ }
}
