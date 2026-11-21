// Estado del plan del usuario: lo que dice el servidor, guardado en el dispositivo para que funcione sin conexión.
// Si el servidor no responde o las tablas no existen, se conserva lo último conocido; si nunca se supo nada,
// no hay cobro y todo queda abierto.
import { parseBilling, planState, type Billing, type Entitlement, type PlanState } from '../domain/plan';
import { getUserId } from './db';
import { cloudEnabled, supabase } from './sync';

export interface PlanSnapshot { billing: Billing | null; ent: Entitlement | null; uid: string; at: number }
const KEY = 'ii_plan', EMPTY: PlanSnapshot = { billing: null, ent: null, uid: 'local', at: 0 };

function load(): PlanSnapshot {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as PlanSnapshot | null;
    if (s && typeof s === 'object' && typeof s.at === 'number') return { ...EMPTY, ...s };
  } catch { /* guardado ilegible: se parte de cero */ }
  return EMPTY;
}
let snap = load();
const subs = new Set<() => void>();
export const subscribePlan = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
export const getPlanSnapshot = () => snap;
function set(next: PlanSnapshot) {
  snap = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* sin almacenamiento: vale para esta visita */ }
  subs.forEach((cb) => cb());
}

/** El plan de quien usa la app ahora, para el código que no es de pantalla. */
export function currentPlan(): PlanState {
  const uid = getUserId();
  return planState(snap.billing, snap.uid === uid ? snap.ent : null, Date.now(), uid !== 'local');
}

const ms = (v: unknown) => { const t = typeof v === 'string' ? Date.parse(v) : NaN; return Number.isFinite(t) ? t : null; };
function toEnt(r: Record<string, unknown>): Entitlement {
  return { plan: r.plan === 'coach' ? 'coach' : 'pro', status: r.status as Entitlement['status'], source: r.source as Entitlement['source'], periodEnd: ms(r.period_end), trialUsed: r.trial_used === true };
}

let busy: Promise<void> | null = null;
/** Vuelve a preguntar al servidor. `force` salta la espera mínima entre consultas (media hora). */
export function refreshPlan(uid: string, force = false): Promise<void> {
  if (!cloudEnabled || !supabase) return Promise.resolve();
  if (!force && snap.uid === uid && Date.now() - snap.at < 30 * 60000) return Promise.resolve();
  if (busy) return busy;
  const sb = supabase;
  busy = (async () => {
    try {
      const f = await sb.from('app_flags').select('value').eq('key', 'billing').maybeSingle();
      if (f.error) return;                                    // sin conexión o sin la tabla: se conserva lo último
      const billing = parseBilling(f.data?.value);
      let ent: Entitlement | null = null;
      if (billing?.enabled && uid !== 'local') {
        const e = await sb.from('entitlements').select('plan,status,source,period_end,trial_used').maybeSingle();
        if (e.error) ent = snap.uid === uid ? snap.ent : null; else if (e.data) ent = toEnt(e.data as Record<string, unknown>);
      }
      set({ billing, ent, uid, at: Date.now() });
    } catch { /* sin conexión: se conserva lo último */ } finally { busy = null; }
  })();
  return busy;
}

/** Empieza la prueba gratis de Pro (una vez por cuenta, sin tarjeta). */
export async function startTrial(uid: string): Promise<void> {
  if (!supabase || uid === 'local') throw new Error('Para probar Pro necesitas una cuenta.');
  const r = await supabase.rpc('start_trial');
  if (r.error) throw new Error(/billing_disabled/.test(r.error.message) ? 'La prueba todavía no está disponible.' : 'No se pudo iniciar la prueba. Revisa tu conexión e inténtalo de nuevo.');
  await refreshPlan(uid, true);
}
