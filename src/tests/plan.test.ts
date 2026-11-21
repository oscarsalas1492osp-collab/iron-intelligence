import { describe, expect, it } from 'vitest';
import { FEATURES, GRACE, money, needsPro, parseBilling, planState, priceFor, type Entitlement } from '../domain/plan';

const DAY = 86400000, NOW = 1_800_000_000_000;
const raw = { enabled: true, trial_days: 21, free_routines: 2, free_history_days: 30, free_custom_exercises: 3, prices: { CLP: { monthly: 4990, yearly: 39990 }, USD: { monthly: 4.99, yearly: 39.99 } }, checkout: { monthly: null, yearly: 'https://pago.example/anual' } };
const on = parseBilling(raw)!;
const ent = (e: Partial<Entitlement>): Entitlement => ({ plan: 'pro', status: 'active', source: 'web', periodEnd: NOW + 10 * DAY, trialUsed: true, ...e });

describe('planes', () => {
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
    expect(on.checkout).toEqual({ monthly: null, yearly: 'https://pago.example/anual' });
    expect(parseBilling({ ...raw, checkout: { monthly: 'javascript:alert(1)' } })!.checkout.monthly).toBeNull();
  });
});
