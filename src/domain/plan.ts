// Planes de la app. La regla de fondo: mientras el cobro esté apagado, o no se pueda saber si está encendido,
// todo es gratis para todos. Nunca se bloquea a nadie por falta de conexión.

const DAY = 86400000;
/** Días de gracia tras el vencimiento de un plan pagado, por si el cobro se atrasa. La prueba gratis no tiene. */
export const GRACE = 3 * DAY;

/** Funciones que el servidor puede dejar solo para Pro. Lo que ya existe (una biserie creada durante la prueba) no se quita. */
export const FEATURES = ['supersets', 'techniques', 'suggestions', 'templates', 'warmup', 'recovery', 'assistant'] as const;
export type Feature = (typeof FEATURES)[number];

export interface Prices { monthly: number; yearly: number }
export interface Billing {
  enabled: boolean;
  /** Prueba sin medio de pago. */
  trialDays: number;
  /** Días gratis al suscribirse con medio de pago por primera vez. Se descuentan los ya usados en la prueba sin tarjeta. */
  cardTrialDays: number;
  /** Rutinas propias que permite el plan gratis. */
  freeRoutines: number;
  /** Días de historial que el plan gratis incluye en el análisis. */
  freeHistoryDays: number;
  /** Ejercicios propios que permite el plan gratis. */
  freeCustomExercises: number;
  /** Funciones reservadas a Pro. */
  proOnly: Feature[];
  prices: Record<string, Prices>;
  /** Pago en la web: por Mercado Pago (`mp`) o con enlaces fijos. En la app de Google Play se cobra por Google. */
  checkout: { mp: boolean; monthly: string | null; yearly: string | null };
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
  /** Días gratis que tendría esta persona si se suscribe hoy con medio de pago (0 si ya tuvo una suscripción). */
  cardTrialLeft: number;
  freeRoutines: number;
  freeHistoryDays: number;
  freeCustomExercises: number;
  /** Funciones bloqueadas para esta persona ahora mismo (vacío si tiene Pro o no hay cobro). */
  locked: Feature[];
}

/** ¿Esta función pide Pro a esta persona? */
export const needsPro = (p: PlanState, f: Feature) => !p.pro && p.locked.includes(f);

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const link = (v: unknown) => (typeof v === 'string' && /^https:\/\//.test(v) ? v : null);

/**
 * Lee el ajuste `billing` que entrega el servidor. Cualquier cosa rara se trata como «sin cobro».
 * `uid`: las cuentas listadas en `preview` ven los planes aunque el cobro siga apagado para el resto (pruebas antes del lanzamiento).
 */
export function parseBilling(v: unknown, uid?: string): Billing | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>, prices: Record<string, Prices> = {};
  for (const [cur, p] of Object.entries((o.prices as Record<string, unknown>) ?? {})) {
    const q = p as Record<string, unknown> | null;
    if (q && num(q.monthly, 0) > 0 && num(q.yearly, 0) > 0) prices[cur.toUpperCase()] = { monthly: q.monthly as number, yearly: q.yearly as number };
  }
  const c = (o.checkout as Record<string, unknown>) ?? {};
  return {
    enabled: (o.enabled === true || (!!uid && Array.isArray(o.preview) && o.preview.includes(uid))) && Object.keys(prices).length > 0,
    trialDays: Math.min(60, Math.max(1, Math.round(num(o.trial_days, 7)))),
    cardTrialDays: Math.min(60, Math.max(0, Math.round(num(o.card_trial_days, 21)))),
    freeRoutines: Math.max(1, Math.round(num(o.free_routines, 2))),
    freeHistoryDays: Math.max(7, Math.round(num(o.free_history_days, 30))),
    freeCustomExercises: Math.max(0, Math.round(num(o.free_custom_exercises, 3))),
    proOnly: Array.isArray(o.pro_only) ? FEATURES.filter((f) => (o.pro_only as unknown[]).includes(f)) : [...FEATURES],
    prices,
    checkout: { mp: c.mp === true, monthly: link(c.monthly), yearly: link(c.yearly) },
  };
}

/**
 * Días gratis al suscribirse con medio de pago: los de la prueba larga menos los ya usados en la prueba sin tarjeta.
 * Quien ya tuvo una suscripción no vuelve a tenerlos. La misma regla corre en el servidor (pagos/periodo.ts).
 */
export function cardTrialLeft(cardTrialDays: number, trialDays: number, ent: Pick<Entitlement, 'source' | 'periodEnd'> | null, now: number): number {
  if (!ent || ent.source === 'founder' || ent.source === 'manual') return cardTrialDays;
  if (ent.source !== 'trial' || ent.periodEnd === null) return 0;
  const start = ent.periodEnd - trialDays * DAY, used = Math.ceil((Math.min(now, ent.periodEnd) - start) / DAY);
  return Math.max(0, cardTrialDays - Math.max(0, used));
}

export function planState(billing: Billing | null, ent: Entitlement | null, now: number, signedIn: boolean): PlanState {
  const base = { trialDays: billing?.trialDays ?? 7, cardTrialLeft: billing ? cardTrialLeft(billing.cardTrialDays, billing.trialDays, ent, now) : 0, freeRoutines: billing?.freeRoutines ?? 2, freeHistoryDays: billing?.freeHistoryDays ?? 30, freeCustomExercises: billing?.freeCustomExercises ?? 3, locked: [] as Feature[] };
  if (!billing || !billing.enabled) return { billing: false, pro: true, kind: 'open', daysLeft: null, canTrial: false, ...base };
  if (ent) {
    const live = ent.status === 'trialing' || ent.status === 'active' || ent.status === 'grace' || ent.status === 'canceled';   // cancelado: sigue hasta el fin de lo pagado
    const until = ent.periodEnd === null ? Infinity : ent.periodEnd + (ent.source === 'trial' || ent.source === 'manual' || ent.source === 'founder' || ent.status === 'canceled' ? 0 : GRACE);   // lo regalado termina el día que se fijó
    if (live && now < until && !(ent.status === 'canceled' && ent.periodEnd === null)) {
      const kind = ent.source === 'trial' ? 'trial' : ent.source === 'founder' || ent.source === 'manual' ? 'gift' : 'paid';
      return { billing: true, pro: true, kind, daysLeft: ent.periodEnd === null ? null : Math.max(0, Math.ceil((ent.periodEnd - now) / DAY)), canTrial: false, ...base };
    }
  }
  return { billing: true, pro: false, kind: 'free', daysLeft: null, canTrial: signedIn && !(ent?.trialUsed ?? false), ...base, locked: billing.proOnly };
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
