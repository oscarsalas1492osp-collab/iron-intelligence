// Planes de la app. La regla de fondo: mientras el cobro esté apagado, o no se pueda saber si está encendido,
// todo es gratis para todos. Nunca se bloquea a nadie por falta de conexión.

const DAY = 86400000;
/** Días de gracia tras el vencimiento de un plan pagado, por si el cobro se atrasa. La prueba gratis no tiene. */
export const GRACE = 3 * DAY;

export interface Prices { monthly: number; yearly: number }
export interface Billing {
  enabled: boolean;
  trialDays: number;
  /** Rutinas propias que permite el plan gratis. */
  freeRoutines: number;
  /** Días de historial que el plan gratis incluye en el análisis. */
  freeHistoryDays: number;
  prices: Record<string, Prices>;
  /** Enlaces de pago en la web (el medio de pago los entrega). En la app de Google Play se cobra por Google. */
  checkout: { monthly: string | null; yearly: string | null };
}
export interface Entitlement {
  plan: 'pro' | 'coach';
  status: 'trialing' | 'active' | 'grace' | 'canceled' | 'expired';
  source: 'trial' | 'founder' | 'manual' | 'play' | 'web';
  /** Fin del período en milisegundos; null si no vence. */
  periodEnd: number | null;
  trialUsed: boolean;
}
export interface PlanState {
  /** El cobro está encendido. Si no, nada de planes se muestra. */
  billing: boolean;
  pro: boolean;
  /** open: sin cobro, todo abierto. trial: prueba gratis. paid: suscripción. gift: regalo. free: plan gratis. */
  kind: 'open' | 'trial' | 'paid' | 'gift' | 'free';
  daysLeft: number | null;
  canTrial: boolean;
  trialDays: number;
  freeRoutines: number;
  freeHistoryDays: number;
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const link = (v: unknown) => (typeof v === 'string' && /^https:\/\//.test(v) ? v : null);

/** Lee el ajuste `billing` que entrega el servidor. Cualquier cosa rara se trata como «sin cobro». */
export function parseBilling(v: unknown): Billing | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>, prices: Record<string, Prices> = {};
  for (const [cur, p] of Object.entries((o.prices as Record<string, unknown>) ?? {})) {
    const q = p as Record<string, unknown> | null;
    if (q && num(q.monthly, 0) > 0 && num(q.yearly, 0) > 0) prices[cur.toUpperCase()] = { monthly: q.monthly as number, yearly: q.yearly as number };
  }
  const c = (o.checkout as Record<string, unknown>) ?? {};
  return {
    enabled: o.enabled === true && Object.keys(prices).length > 0,
    trialDays: Math.min(60, Math.max(1, Math.round(num(o.trial_days, 21)))),
    freeRoutines: Math.max(1, Math.round(num(o.free_routines, 4))),
    freeHistoryDays: Math.max(7, Math.round(num(o.free_history_days, 90))),
    prices,
    checkout: { monthly: link(c.monthly), yearly: link(c.yearly) },
  };
}

export function planState(billing: Billing | null, ent: Entitlement | null, now: number, signedIn: boolean): PlanState {
  const base = { trialDays: billing?.trialDays ?? 21, freeRoutines: billing?.freeRoutines ?? 4, freeHistoryDays: billing?.freeHistoryDays ?? 90 };
  if (!billing || !billing.enabled) return { billing: false, pro: true, kind: 'open', daysLeft: null, canTrial: false, ...base };
  if (ent) {
    const live = ent.status === 'trialing' || ent.status === 'active' || ent.status === 'grace' || ent.status === 'canceled';   // cancelado: sigue hasta el fin de lo pagado
    const until = ent.periodEnd === null ? Infinity : ent.periodEnd + (ent.source === 'trial' || ent.status === 'canceled' ? 0 : GRACE);
    if (live && now < until && !(ent.status === 'canceled' && ent.periodEnd === null)) {
      const kind = ent.source === 'trial' ? 'trial' : ent.source === 'founder' || ent.source === 'manual' ? 'gift' : 'paid';
      return { billing: true, pro: true, kind, daysLeft: ent.periodEnd === null ? null : Math.max(0, Math.ceil((ent.periodEnd - now) / DAY)), canTrial: false, ...base };
    }
  }
  return { billing: true, pro: false, kind: 'free', daysLeft: null, canTrial: signedIn && !(ent?.trialUsed ?? false), ...base };
}

/** Precio que se muestra: pesos chilenos para quien tiene el dispositivo en español de Chile, dólares para el resto. */
export function priceFor(billing: Billing, locale: string): { currency: string; monthly: number; yearly: number; saving: number } | null {
  const want = /-CL$/i.test(locale) ? 'CLP' : 'USD';
  const currency = billing.prices[want] ? want : billing.prices.USD ? 'USD' : Object.keys(billing.prices)[0];
  if (!currency) return null;
  const p = billing.prices[currency];
  return { currency, ...p, saving: Math.max(0, Math.round((1 - p.yearly / (p.monthly * 12)) * 100)) };
}

/** $2.990 · US$2,99 */
export function money(amount: number, currency: string): string {
  if (currency === 'CLP') return `$${Math.round(amount).toLocaleString('es-CL')}`;
  const s = amount.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === 'USD' ? `US$${s}` : `${s} ${currency}`;
}
