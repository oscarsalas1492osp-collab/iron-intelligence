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

let busy: Promise<void> | null = null, lastPaySync = 0;
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
      const billing = parseBilling(f.data?.value, uid);
      // Acceso de tester dado desde el panel antes de que existiera la cuenta: se aplica al abrir la app.
      if (force && uid !== 'local') await sb.rpc('claim_access');
      let ent: Entitlement | null = null;
      if (billing?.enabled && uid !== 'local') {
        const read = async () => {
          const e = await sb.from('entitlements').select('plan,status,source,period_end,trial_used').maybeSingle();
          return e.error ? (snap.uid === uid ? snap.ent : null) : e.data ? toEnt(e.data as Record<string, unknown>) : null;
        };
        ent = await read();
        // Suscripción web con el período vencido: quizá el aviso del cobro no llegó. Se confirma con Mercado Pago, como mucho cada seis horas.
        if (ent && ent.source === 'web' && ent.status === 'active' && ent.periodEnd !== null && ent.periodEnd < Date.now() && Date.now() - lastPaySync > 6 * 3600000) {
          lastPaySync = Date.now();
          try { await pagos({ action: 'sync' }); ent = await read(); } catch { /* se reintenta más tarde */ }
        }
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

/**
 * La app instalada desde Google Play (envoltorio de la web): ahí el cobro va por Google, no por la web.
 * Se reconoce por cualquiera de tres señales: Android la abre con un origen «android-app://», el paquete
 * arranca en «?origen=play», o está disponible el cobro de Google Play. Vale para toda la visita.
 */
export const inPlayApp = (() => {
  try {
    const here = document.referrer.startsWith('android-app://') || new URLSearchParams(location.search).get('origen') === 'play' || 'getDigitalGoodsService' in window;
    if (here) sessionStorage.setItem('ii_twa', '1');
    return sessionStorage.getItem('ii_twa') === '1';
  } catch { return false; }
})();

const PAY_ERRORS: Record<string, string> = {
  sin_sesion: 'Inicia sesión de nuevo para continuar.',
  pagos_no_configurados: 'El pago todavía no está habilitado.',
  cobro_apagado: 'El pago todavía no está habilitado.',
  correo: 'Revisa el correo de tu cuenta de Mercado Pago.',
  demasiados_intentos: 'Hiciste varios intentos seguidos. Espera una hora y vuelve a probar.',
  mp_rechazo: 'Mercado Pago no aceptó la solicitud. Revisa que el correo sea el de tu cuenta de Mercado Pago.',
  mp_rechazo_cancelar: 'Mercado Pago no pudo cancelar la suscripción. Inténtalo de nuevo o cancélala desde tu cuenta de Mercado Pago.',
  mp_no_responde: 'Mercado Pago no respondió. Inténtalo en unos minutos.',
};
async function pagos(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!supabase) throw new Error(PAY_ERRORS.pagos_no_configurados);
  const r = await supabase.functions.invoke('pagos', { body });
  if (r.error) {
    let code = '';
    try { code = ((await (r.error as { context?: Response }).context?.json()) as { error?: string } | undefined)?.error ?? ''; } catch { /* sin detalle */ }
    throw new Error(PAY_ERRORS[code] ?? 'No se pudo conectar con el pago. Revisa tu conexión e inténtalo de nuevo.');
  }
  return (r.data ?? {}) as Record<string, unknown>;
}

/** Correo de la cuenta, para proponerlo como correo de pago. */
export async function accountEmail(): Promise<string> {
  try { return (await supabase?.auth.getSession())?.data.session?.user.email ?? ''; } catch { return ''; }
}

/** Crea la suscripción en Mercado Pago y lleva a su página de pago. `email`: el de la cuenta de Mercado Pago que paga. */
export async function startCheckout(period: 'monthly' | 'yearly', email: string): Promise<void> {
  const d = await pagos({ action: 'checkout', period, email });
  if (typeof d.url !== 'string' || !/^https:\/\/([a-z0-9-]+\.)*mercadopago\.[a-z.]+\//.test(d.url)) throw new Error(PAY_ERRORS.mp_rechazo);
  location.assign(d.url);
}

/** Vuelta desde Mercado Pago (`?pago=mp`): se lee una vez al abrir y se quita de la dirección. */
export const paymentReturn: { id: string | null } | null = (() => {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('pago') !== 'mp') return null;
    const id = q.get('preapproval_id');
    for (const k of ['pago', 'preapproval_id']) q.delete(k);
    const rest = q.toString();
    history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
    return { id: id && /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null };
  } catch { return null; }
})();

/**
 * Pide al servidor que confirme con Mercado Pago y actualiza el plan. Reintenta unos segundos, porque la
 * confirmación del pago puede tardar. Devuelve si la suscripción quedó activa.
 */
export async function confirmPayment(uid: string, id: string | null = null, waits = [0, 3000, 6000, 10000]): Promise<boolean> {
  for (const wait of waits) {
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try { await pagos(id ? { action: 'sync', id } : { action: 'sync' }); await refreshPlan(uid, true); } catch { continue; }
    if (snap.uid === uid && snap.ent?.source === 'web' && planState(snap.billing, snap.ent, Date.now(), true).pro) return true;
  }
  return false;
}

/** ¿Hay una suscripción web que se sigue renovando? */
export const renewing = (s: PlanSnapshot = snap) => !!s.ent && s.ent.source === 'web' && (s.ent.status === 'active' || s.ent.status === 'grace');

/** Cancela la renovación: no hay más cobros y Pro sigue hasta el fin de lo ya pagado. */
export async function cancelPayment(uid: string): Promise<void> {
  await pagos({ action: 'cancel' });
  await refreshPlan(uid, true);
}

/** Antes de eliminar la cuenta: corta la renovación, para que Mercado Pago no siga cobrando a una cuenta que ya no existe. */
export async function stopRenewal(): Promise<void> {
  if (snap.uid === getUserId() && renewing()) await pagos({ action: 'cancel' });
}
