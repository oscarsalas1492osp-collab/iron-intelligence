// Reglas del cobro por Mercado Pago que no dependen del servidor, para poder probarlas con el resto de la app.
const DAY = 86400000;
/** Acceso mientras Mercado Pago confirma el primer cobro, contado desde que se creó la suscripción. */
export const PROVISIONAL = 1 * DAY;
/** Margen mientras Mercado Pago reintenta un cobro rechazado (su ventana de reintentos es de diez días). */
export const RETRY = 10 * DAY;

/** Tope de días gratis al suscribirse con medio de pago. */
export const MAX_FREE = 60;

/**
 * Días gratis al suscribirse con medio de pago por primera vez: los de la prueba larga menos los que ya se usaron
 * en la prueba sin tarjeta. Quien ya tuvo una suscripción (web o Google Play) no vuelve a tenerlos.
 * `ent`: el plan actual de la cuenta, con las fechas tal como las guarda la base.
 */
export function freeDays(cardTrialDays: number, ent: { source?: string; created_at?: string | null; period_end?: string | null } | null, now: number): number {
  const total = Math.min(MAX_FREE, Math.max(0, Math.round(cardTrialDays) || 0));
  if (!ent || ent.source === 'founder' || ent.source === 'manual') return total;
  if (ent.source !== 'trial') return 0;
  const start = Date.parse(ent.created_at ?? ''), end = Date.parse(ent.period_end ?? '');
  if (!Number.isFinite(start)) return 0;
  const used = Math.ceil((Math.min(now, Number.isFinite(end) ? end : now) - start) / DAY);
  return Math.max(0, total - Math.max(0, used));
}

export interface PreLike {
  status?: string;
  date_created?: string;
  next_payment_date?: string;
  auto_recurring?: { frequency?: number; frequency_type?: string; free_trial?: { frequency?: number; frequency_type?: string } | null } | null;
  summarized?: { charged_quantity?: number; last_charged_date?: string } | null;
}

const time = (v?: string) => { const n = Date.parse(v ?? ''); return Number.isFinite(n) ? n : null; };

/**
 * Hasta cuándo vale Pro (en milisegundos) según lo que Mercado Pago informa de una suscripción autorizada.
 * Manda lo cobrado, no lo prometido: sin un cobro confirmado solo hay un acceso provisional corto; con cobros,
 * el período llega hasta el próximo cobro, y si ese cobro falla, como mucho hasta el fin de los reintentos.
 */
export function paidUntil(pre: PreLike, now: number): number {
  const months = pre.auto_recurring?.frequency_type === 'months' ? Math.max(1, Math.round(Number(pre.auto_recurring?.frequency) || 1)) : 1;
  const next = time(pre.next_payment_date), provisional = (time(pre.date_created) ?? now) + PROVISIONAL;
  if (!pre.summarized) return next !== null && next > now ? next : provisional;      // sin resumen de cobros: vale la fecha del próximo cobro
  const last = time(pre.summarized.last_charged_date);
  if ((Number(pre.summarized.charged_quantity) || 0) < 1 || last === null) {
    // Con días gratis al suscribirse, Pro vale hasta que terminan (ahí llega el primer cobro); sin ellos, solo el acceso provisional.
    const ft = pre.auto_recurring?.free_trial, free = ft?.frequency_type === 'days' ? Math.min(MAX_FREE, Math.max(0, Math.round(Number(ft.frequency) || 0))) : 0;
    return free > 0 ? Math.max(provisional, (time(pre.date_created) ?? now) + free * DAY) : provisional;
  }
  const d = new Date(last);
  d.setUTCMonth(d.getUTCMonth() + months);
  const paid = d.getTime();
  return next !== null && next > paid ? Math.min(next, paid + RETRY) : paid;
}

/** Firma de los avisos: texto que Mercado Pago firma con la clave secreta de la integración. */
export function manifest(dataId: string, requestId: string, ts: string): string {
  return `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};request-id:${requestId};ts:${ts};`;
}

/** Lee «ts=…,v1=…» de la cabecera x-signature. */
export function signatureParts(header: string): { ts: string; v1: string } | null {
  const o: Record<string, string> = {};
  for (const part of header.split(',')) { const i = part.indexOf('='); if (i > 0) o[part.slice(0, i).trim()] = part.slice(i + 1).trim(); }
  return o.ts && o.v1 ? { ts: o.ts, v1: o.v1 } : null;
}
