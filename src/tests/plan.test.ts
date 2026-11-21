import { describe, expect, it } from 'vitest';
import { FEATURES, GRACE, money, needsPro, parseBilling, planState, priceFor, type Entitlement } from '../domain/plan';
import { manifest, paidUntil, PROVISIONAL, RETRY, signatureParts, type PreLike } from '../../supabase/functions/pagos/periodo';

const DAY = 86400000, NOW = 1_800_000_000_000;
const raw = { enabled: true, trial_days: 21, free_routines: 2, free_history_days: 30, free_custom_exercises: 3, prices: { CLP: { monthly: 4990, yearly: 39990 }, USD: { monthly: 4.99, yearly: 39.99 } }, checkout: { monthly: null, yearly: 'https://pago.example/anual' } };
const on = parseBilling(raw)!;
const ent = (e: Partial<Entitlement>): Entitlement => ({ plan: 'pro', status: 'active', source: 'web', periodEnd: NOW + 10 * DAY, trialUsed: true, ...e });

describe('cobro por Mercado Pago', () => {
  const T = Date.parse('2027-01-10T12:00:00Z');
  const pre = (o: PreLike): PreLike => ({ status: 'authorized', date_created: '2027-01-10T12:00:00Z', auto_recurring: { frequency: 1, frequency_type: 'months' }, ...o });
  it('sin un cobro confirmado solo hay acceso provisional, anclado a la creación', () => {
    const p = pre({ next_payment_date: '2027-02-10T12:00:00Z', summarized: { charged_quantity: 0 } });
    expect(paidUntil(p, T)).toBe(T + PROVISIONAL);
    expect(paidUntil(p, T + 5 * DAY)).toBe(T + PROVISIONAL);                              // volver a consultar no lo alarga
    expect(paidUntil(pre({ date_created: undefined, summarized: { charged_quantity: 0 } }), T)).toBe(T + PROVISIONAL);
  });
  it('con cobros, el período llega hasta el próximo cobro', () => {
    const month = pre({ next_payment_date: '2027-02-10T12:00:05Z', summarized: { charged_quantity: 1, last_charged_date: '2027-01-10T12:00:00Z' } });
    expect(new Date(paidUntil(month, T)).toISOString()).toBe('2027-02-10T12:00:05.000Z');
    const year = pre({ auto_recurring: { frequency: 12, frequency_type: 'months' }, summarized: { charged_quantity: 1, last_charged_date: '2027-01-10T12:00:00Z' } });
    expect(new Date(paidUntil(year, T)).toISOString()).toBe('2028-01-10T12:00:00.000Z');
  });
  it('si un cobro falla, vale mientras Mercado Pago reintenta y no más', () => {
    const paid = Date.parse('2027-02-10T12:00:00Z'), s = { charged_quantity: 1, last_charged_date: '2027-01-10T12:00:00Z' };
    expect(paidUntil(pre({ next_payment_date: '2027-02-13T12:00:00Z', summarized: s }), paid + DAY)).toBe(paid + 3 * DAY);   // reintento en tres días
    expect(paidUntil(pre({ next_payment_date: '2027-03-10T12:00:00Z', summarized: s }), paid + DAY)).toBe(paid + RETRY);     // sin cobro, el mes siguiente no se regala
  });
  it('sin resumen de cobros vale la fecha del próximo cobro', () => {
    expect(paidUntil(pre({ next_payment_date: '2027-02-10T12:00:00Z' }), T)).toBe(Date.parse('2027-02-10T12:00:00Z'));
    expect(paidUntil(pre({ next_payment_date: '2027-01-01T00:00:00Z' }), T)).toBe(T + PROVISIONAL);
  });
  it('arma el texto que Mercado Pago firma en sus avisos', () => {
    expect(manifest('2C9380848D', 'req-1', '1700000000')).toBe('id:2c9380848d;request-id:req-1;ts:1700000000;');
    expect(signatureParts('ts=1700000000, v1=abc123')).toEqual({ ts: '1700000000', v1: 'abc123' });
    expect(signatureParts('v1=abc')).toBeNull();
  });
});

describe('planes', () => {
  it('una cuenta en la lista de prueba ve los planes aunque el cobro siga apagado para el resto', () => {
    const off = { ...raw, enabled: false, preview: ['u-1'] };
    expect(parseBilling(off)!.enabled).toBe(false);
    expect(parseBilling(off, 'u-2')!.enabled).toBe(false);
    expect(parseBilling(off, 'u-1')!.enabled).toBe(true);
    expect(planState(parseBilling(off, 'u-1'), null, NOW, true)).toMatchObject({ billing: true, pro: false, canTrial: true });
    expect(parseBilling({ ...off, preview: 'u-1' }, 'u-1')!.enabled).toBe(false);
  });
  it('sin cobro, o sin poder saberlo, todo queda abierto', () => {
    expect(planState(null, null, NOW, false)).toMatchObject({ billing: false, pro: true, kind: 'open' });
    expect(planState(parseBilling({ ...raw, enabled: false }), null, NOW, true)).toMatchObject({ billing: false, pro: true });
    expect(planState(parseBilling('basura'), ent({ status: 'expired' }), NOW, true).pro).toBe(true);
    expect(parseBilling({ enabled: true, prices: {} })!.enabled).toBe(false);          // encendido pero sin precios: no se cobra
  });
  it('con cobro y sin plan: gratis, y la prueba solo con cuenta y una vez', () => {
    expect(planState(on, null, NOW, true)).toMatchObject({ billing: true, pro: false, kind: 'free', canTrial: true, freeRoutines: 2, freeHistoryDays: 30, freeCustomExercises: 3 });
    expect(planState(on, null, NOW, false).canTrial).toBe(false);
    expect(planState(on, ent({ status: 'expired', source: 'trial', periodEnd: NOW - DAY }), NOW, true)).toMatchObject({ pro: false, canTrial: false });
  });
  it('la prueba gratis vale hasta su último día, sin gracia', () => {
    const t = ent({ status: 'trialing', source: 'trial', periodEnd: NOW + 2.2 * DAY });
    expect(planState(on, t, NOW, true)).toMatchObject({ pro: true, kind: 'trial', daysLeft: 3 });
    expect(planState(on, t, NOW + 2.3 * DAY, true).pro).toBe(false);
  });
  it('la suscripción tiene días de gracia; cancelada sigue hasta lo pagado', () => {
    const p = ent({ periodEnd: NOW });
    expect(planState(on, p, NOW + GRACE - 1, true)).toMatchObject({ pro: true, kind: 'paid', daysLeft: 0 });
    expect(planState(on, p, NOW + GRACE + 1, true).pro).toBe(false);
    const c = ent({ status: 'canceled', periodEnd: NOW + DAY });
    expect(planState(on, c, NOW, true).pro).toBe(true);
    expect(planState(on, c, NOW + DAY + 1, true).pro).toBe(false);
  });
  it('un regalo sin vencimiento no vence', () => {
    expect(planState(on, ent({ source: 'founder', periodEnd: null }), NOW + 9999 * DAY, true)).toMatchObject({ pro: true, kind: 'gift', daysLeft: null });
  });
  it('los candados solo pesan en el plan gratis y los decide el servidor', () => {
    const free = planState(on, null, NOW, true), pro = planState(on, ent({}), NOW, true), open = planState(null, null, NOW, true);
    for (const f of FEATURES) { expect(needsPro(free, f)).toBe(true); expect(needsPro(pro, f)).toBe(false); expect(needsPro(open, f)).toBe(false); }
    const some = planState(parseBilling({ ...raw, pro_only: ['supersets', 'inventada'] }), null, NOW, true);
    expect(some.locked).toEqual(['supersets']);
    expect(needsPro(some, 'techniques')).toBe(false);
  });
  it('precios por región y enlaces de pago válidos', () => {
    expect(priceFor(on, 'es-CL')).toMatchObject({ currency: 'CLP', monthly: 4990, yearly: 39990, saving: 33 });
    expect(priceFor(on, 'en-US')).toMatchObject({ currency: 'USD', monthly: 4.99 });
    expect(money(4990, 'CLP')).toBe('$4.990');
    expect(money(4.99, 'USD')).toBe('US$4,99');
    expect(on.checkout).toEqual({ mp: false, monthly: null, yearly: 'https://pago.example/anual' });
    expect(parseBilling({ ...raw, checkout: { mp: true } })!.checkout.mp).toBe(true);
    expect(parseBilling({ ...raw, checkout: { mp: 'sí' } })!.checkout.mp).toBe(false);
    expect(parseBilling({ ...raw, checkout: { monthly: 'javascript:alert(1)' } })!.checkout.monthly).toBeNull();
  });
});
