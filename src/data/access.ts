// Quién puede entrar a la app. El servidor publica el modo (`access.mode` en app_flags): con 'invite' entran solo
// las cuentas con invitación vigente y quien administra; con 'open', cualquiera. Lo último que dijo el servidor
// queda guardado en el dispositivo, para que una cuenta con acceso pueda abrir la app sin conexión.
// Esto decide qué pantalla se muestra. El cierre de verdad está en el servidor, que en modo invitación no deja
// crear cuentas a correos sin acceso.
import { cloudEnabled, supabase } from './sync';

export type Mode = 'invite' | 'open';
export interface AccessSnapshot { mode: Mode | null; uid: string; allowed: boolean | null; at: number }
/** open: sin restricción · checking: preguntando · guest: hay que entrar con una cuenta invitada ·
 *  allowed: cuenta con acceso · denied: cuenta sin invitación · unknown: no se pudo comprobar. */
export type Gate = 'open' | 'checking' | 'guest' | 'allowed' | 'denied' | 'unknown';

const KEY = 'ii_access', EMPTY: AccessSnapshot = { mode: null, uid: 'local', allowed: null, at: 0 };

function load(): AccessSnapshot {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<AccessSnapshot> | null;
    if (s && typeof s === 'object') {
      return {
        mode: s.mode === 'invite' || s.mode === 'open' ? s.mode : null,
        uid: typeof s.uid === 'string' ? s.uid : 'local',
        allowed: typeof s.allowed === 'boolean' ? s.allowed : null,
        at: typeof s.at === 'number' ? s.at : 0,
      };
    }
  } catch { /* guardado ilegible: se parte de cero */ }
  return EMPTY;
}

let snap = load();
let settledFor: string | null = null;          // cuenta para la que ya se terminó de preguntar en esta visita
const subs = new Set<() => void>();
export const subscribeAccess = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
export const getAccessSnapshot = () => snap;
export const getSettledFor = () => settledFor;

/**
 * Qué pantalla corresponde.
 * `settled`: ya se le preguntó al servidor por esta cuenta en esta visita (haya respondido o no).
 * Si el servidor nunca respondió y no hay nada guardado, vale el modo cerrado.
 */
export function gateOf(s: AccessSnapshot, uid: string, cloud: boolean, settled: boolean): Gate {
  if (!cloud) return 'open';
  const mode = s.mode ?? (settled ? 'invite' : null);
  if (mode === null) return 'checking';
  if (mode === 'open') return 'open';
  if (uid === 'local') return 'guest';
  const allowed = s.uid === uid ? s.allowed : null;
  if (allowed === true) return 'allowed';
  if (allowed === false) return 'denied';
  return settled ? 'unknown' : 'checking';
}

let queue: Promise<void> = Promise.resolve();
/** Vuelve a preguntar al servidor el modo y, si hace falta, si esta cuenta tiene acceso. En serie. */
export function refreshAccess(uid: string): Promise<void> {
  queue = queue.then(async () => {
    if (cloudEnabled && supabase) {
      let mode = snap.mode, allowed = snap.uid === uid ? snap.allowed : null;
      try {
        const f = await supabase.from('app_flags').select('value').eq('key', 'access').maybeSingle();
        if (!f.error) mode = (f.data?.value as { mode?: unknown } | null | undefined)?.mode === 'invite' ? 'invite' : 'open';
        if (mode === 'invite' && uid !== 'local') {
          const r = await supabase.rpc('my_access');
          if (!r.error && r.data && typeof r.data === 'object') allowed = (r.data as { allowed?: unknown }).allowed === true;
        }
      } catch { /* sin conexión: vale lo guardado */ }
      snap = { mode, uid, allowed, at: Date.now() };
      try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch { /* sin almacenamiento: vale para esta visita */ }
    }
    settledFor = uid;
    subs.forEach((cb) => cb());
  });
  return queue;
}
