// Prueba de la función de pagos sin servidor: se empaqueta con esbuild, y Supabase, Deno y Mercado Pago se
// reemplazan por dobles en memoria. Uso: node tools/pagos/prueba.mjs
import { build } from 'esbuild';
import { createHmac } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'pagos-'));
writeFileSync(join(dir, 'supabase.mjs'), 'export const createClient = () => globalThis.__db;');
writeFileSync(join(dir, 'vacio.mjs'), '');
const out = join(dir, 'pagos.mjs');
await build({
  entryPoints: ['supabase/functions/pagos/index.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
  plugins: [{ name: 'dobles', setup(b) {
    b.onResolve({ filter: /^jsr:@supabase\/supabase-js/ }, () => ({ path: join(dir, 'supabase.mjs') }));
    b.onResolve({ filter: /^jsr:@supabase\/functions-js/ }, () => ({ path: join(dir, 'vacio.mjs') }));
  } }],
});

// ---------- dobles ----------
const U1 = '11111111-1111-4111-8111-111111111111', U2 = '22222222-2222-4222-8222-222222222222';
const tables = { entitlements: [], payment_intents: [], app_flags: [] };
const users = { 'jwt-1': { id: U1, email: 'uno@example.com' }, 'jwt-2': { id: U2, email: 'dos@example.com' } };
function query(name) {
  const rows = tables[name]; const filters = []; let op = 'select', payload = null, opts = {}, lim = Infinity, ord = null;
  const match = (r) => filters.every((f) => f(r));
  const run = () => {
    if (op === 'insert') { rows.push({ created_at: new Date().toISOString(), ...payload }); return { data: null, error: null }; }
    if (op === 'upsert') { const i = rows.findIndex((r) => r.user_id === payload.user_id); if (i >= 0) rows[i] = { ...rows[i], ...payload }; else rows.push({ ...payload }); return { data: null, error: null }; }
    if (op === 'update') { rows.filter(match).forEach((r) => Object.assign(r, payload)); return { data: null, error: null }; }
    let res = rows.filter(match);
    if (ord) res = [...res].sort((a, b) => (a[ord.col] < b[ord.col] ? 1 : -1) * (ord.asc ? -1 : 1));
    if (opts.head) return { data: null, count: res.length, error: null };
    return { data: res.slice(0, lim), error: null };
  };
  const q = {
    select(_c, o = {}) { opts = o; return q; }, insert(p) { op = 'insert'; payload = p; return q; }, upsert(p) { op = 'upsert'; payload = p; return q; }, update(p) { op = 'update'; payload = p; return q; },
    eq(c, v) { filters.push((r) => r[c] === v); return q; }, gte(c, v) { filters.push((r) => r[c] >= v); return q; },
    order(col, o = {}) { ord = { col, asc: o.ascending !== false }; return q; }, limit(n) { lim = n; return q; },
    maybeSingle() { const r = run(); return Promise.resolve({ data: r.data?.[0] ?? null, error: null }); },
    then(ok, ko) { return Promise.resolve(run()).then(ok, ko); },
  };
  return q;
}
globalThis.__db = { from: query, auth: { getUser: async (jwt) => ({ data: { user: users[jwt] ?? null } }) } };

const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' };
let handler;
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };

const mpState = { pre: {}, pay: {}, calls: [], seq: 0 };
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url), method = init.method ?? 'GET';
  mpState.calls.push(`${method} ${u.pathname}`);
  const res = (status, body) => ({ ok: status < 300, status, json: async () => body });
  if (init.headers?.Authorization !== `Bearer ${env.MP_ACCESS_TOKEN}`) return res(401, { message: 'unauthorized' });
  let m;
  if (method === 'POST' && u.pathname === '/preapproval') {
    const b = JSON.parse(init.body), id = `pre${++mpState.seq}`;
    mpState.pre[id] = { id, ...b, date_created: new Date().toISOString(), init_point: `https://www.mercadopago.cl/subscriptions/checkout?preapproval_id=${id}`, summarized: { charged_quantity: 0 } };
    return res(201, mpState.pre[id]);
  }
  if ((m = u.pathname.match(/^\/preapproval\/([\w-]+)$/))) {
    const p = mpState.pre[m[1]]; if (!p) return res(404, { message: 'not found' });
    if (method === 'PUT') Object.assign(p, JSON.parse(init.body));
    return res(200, p);
  }
  if ((m = u.pathname.match(/^\/authorized_payments\/([\w-]+)$/))) return mpState.pay[m[1]] ? res(200, mpState.pay[m[1]]) : res(404, {});
  return res(404, {});
};

const load = async () => { await import(pathToFileURL(out).href + `?v=${Math.random()}`); return handler; };   // las credenciales se leen al cargar
const call = async (h, { jwt, body, query: qs = '', headers = {} } = {}) => {
  const r = await h(new Request(`https://x.supabase.co/functions/v1/pagos${qs}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://app.ironintelligence.app', ...(jwt ? { authorization: `Bearer ${jwt}` } : {}), ...headers }, body: JSON.stringify(body ?? {}) }));
  return { status: r.status, body: await r.json(), cors: r.headers.get('access-control-allow-origin') };
};
let fails = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK   ' : 'FALLA'} ${name}${ok ? '' : ` ${extra}`}`); if (!ok) fails++; };
const ent = (uid) => tables.entitlements.find((r) => r.user_id === uid);
const DAY = 86400000, days = (iso) => (Date.parse(iso) - Date.now()) / DAY;
const billing = (v) => { tables.app_flags.length = 0; tables.app_flags.push({ key: 'billing', value: { enabled: false, prices: { CLP: { monthly: 4990, yearly: 39990 } }, checkout: { mp: false }, ...v } }); };

// ---------- sin credencial: nada se cobra ----------
billing({});
let h = await load();
let r = await call(h, { jwt: 'jwt-1', body: { action: 'checkout', period: 'monthly' } });
check('sin credencial, la app recibe «pagos no configurados»', r.status === 503 && r.body.error === 'pagos_no_configurados', JSON.stringify(r));
r = await call(h, { body: { type: 'subscription_preapproval', data: { id: 'pre1' } } });
check('sin credencial, los avisos se rechazan para que Mercado Pago reintente', r.status === 503);
check('sin credencial no se llama a Mercado Pago', mpState.calls.length === 0);

// ---------- con credencial ----------
env.MP_ACCESS_TOKEN = 'token-de-prueba';
h = await load();
r = await call(h, { body: { action: 'checkout' } });
check('sin sesión no hay pago', r.status === 401 && r.body.error === 'sin_sesion');
r = await call(h, { jwt: 'jwt-1', body: { action: 'checkout', period: 'monthly' } });
check('con el cobro apagado no se crea nada', r.status === 409 && mpState.seq === 0, JSON.stringify(r));
billing({ checkout: { mp: true }, preview: [U1] });
r = await call(h, { jwt: 'jwt-2', body: { action: 'checkout', period: 'monthly' } });
check('la cuenta que no está en la lista de prueba sigue sin poder pagar', r.status === 409);
r = await call(h, { jwt: 'jwt-1', body: { action: 'checkout', period: 'monthly', email: 'pago@example.com', price: 1 } });
const p1 = mpState.pre.pre1;
check('la cuenta de prueba crea la suscripción mensual', r.status === 200 && /^https:\/\/www\.mercadopago\.cl\//.test(r.body.url) && r.cors === 'https://app.ironintelligence.app', JSON.stringify(r));
check('el monto, la moneda y la frecuencia los pone el servidor', p1.auto_recurring.transaction_amount === 4990 && p1.auto_recurring.currency_id === 'CLP' && p1.auto_recurring.frequency === 1 && p1.status === 'pending');
check('la suscripción queda ligada a la cuenta y al correo de pago', p1.external_reference === U1 && p1.payer_email === 'pago@example.com' && p1.back_url === 'https://app.ironintelligence.app/?pago=mp');
check('queda registrada para poder consultarla después', tables.payment_intents.length === 1 && tables.payment_intents[0].provider_ref === 'mp:pre1' && tables.payment_intents[0].user_id === U1);

r = await call(h, { jwt: 'jwt-1', body: { action: 'sync' } });
check('pendiente de pago: el plan no cambia', r.body.results?.[0] === 'pendiente' && !ent(U1), JSON.stringify(r.body));

p1.status = 'authorized';
r = await call(h, { jwt: 'jwt-1', body: { action: 'sync', id: 'pre1' } });
check('autorizada sin cobro confirmado: acceso provisional de un día', ent(U1)?.status === 'active' && ent(U1).source === 'web' && days(ent(U1).period_end) > 0.9 && days(ent(U1).period_end) < 1.01, JSON.stringify(ent(U1)));

// cobro confirmado: llega el aviso del pago
p1.summarized = { charged_quantity: 1, last_charged_date: new Date().toISOString() };
p1.next_payment_date = new Date(Date.now() + 31 * DAY).toISOString();
mpState.pay.inv1 = { id: 'inv1', preapproval_id: 'pre1' };
r = await call(h, { query: '?data.id=inv1&type=subscription_authorized_payment', body: { type: 'subscription_authorized_payment', data: { id: 'inv1' } } });
check('aviso de cobro: Pro por el mes pagado', r.status === 200 && r.body.result === 'activo' && days(ent(U1).period_end) > 27 && days(ent(U1).period_end) < 32, JSON.stringify([r.body, ent(U1)]));
check('el plan guarda la referencia de la suscripción', ent(U1).provider_ref === 'mp:pre1' && ent(U1).trial_used === true);

// nadie toca el plan de otro
r = await call(h, { jwt: 'jwt-2', body: { action: 'sync', id: 'pre1' } });
check('otra cuenta no puede apropiarse de una suscripción ajena', !ent(U2) && r.body.results.length === 0, JSON.stringify(r.body));
r = await call(h, { jwt: 'jwt-2', body: { action: 'cancel' } });
check('otra cuenta no puede cancelar una suscripción ajena', r.body.result === 'sin_suscripcion' && p1.status === 'authorized');
r = await call(h, { body: { type: 'subscription_preapproval', data: { id: 'no-existe' } } });
check('un aviso inventado no cambia nada', r.status === 200 && r.body.result === 'no_encontrada');
r = await call(h, { body: { type: 'payment', data: { id: '123' } } });
check('los avisos de otro tipo se ignoran', r.status === 200 && r.body.ignored === 'tipo');
r = await call(h, { body: { type: 'subscription_preapproval', data: { id: '../../v1/payments/1' } } });
check('un identificador raro no llega a Mercado Pago', r.body.ignored === 'sin_id');

// cancelación desde la app
const before = ent(U1).period_end;
r = await call(h, { jwt: 'jwt-1', body: { action: 'cancel' } });
check('cancelar: se cancela en Mercado Pago y Pro sigue hasta lo pagado', r.body.result === 'cancelado' && p1.status === 'cancelled' && ent(U1).status === 'canceled' && ent(U1).period_end === before, JSON.stringify([r.body, ent(U1)]));
r = await call(h, { jwt: 'jwt-1', body: { action: 'cancel' } });
check('cancelar dos veces no rompe nada', r.status === 200 && ent(U1).status === 'canceled');

// vuelve a suscribirse, ahora anual, antes de que venza lo pagado
r = await call(h, { jwt: 'jwt-1', body: { action: 'checkout', period: 'yearly' } });
const p2 = mpState.pre.pre2;
check('plan anual: 39.990 cada doce meses, con el correo de la cuenta si no se indica otro', p2.auto_recurring.transaction_amount === 39990 && p2.auto_recurring.frequency === 12 && p2.payer_email === 'uno@example.com');
p2.status = 'authorized';
r = await call(h, { jwt: 'jwt-1', body: { action: 'sync' } });
check('sin cobro confirmado no se acorta el período que ya estaba pagado', r.body.results[0] === 'se_conserva' && ent(U1).period_end === before && ent(U1).provider_ref === 'mp:pre1', JSON.stringify([r.body, ent(U1)]));
p2.summarized = { charged_quantity: 1, last_charged_date: new Date().toISOString() };
r = await call(h, { body: { type: 'subscription_preapproval', data: { id: 'pre2' } } });
check('con el cobro anual confirmado: Pro por un año y renovación activa', ent(U1).status === 'active' && ent(U1).provider_ref === 'mp:pre2' && days(ent(U1).period_end) > 364 && days(ent(U1).period_end) < 367, JSON.stringify(ent(U1)));
r = await call(h, { body: { type: 'subscription_preapproval', data: { id: 'pre1' } } });
check('un aviso atrasado de la suscripción vieja no cancela la nueva', r.body.result === 'sin_cambios' && ent(U1).status === 'active');

// regalo y prueba gratis
tables.entitlements.push({ user_id: U2, plan: 'pro', status: 'active', source: 'founder', period_end: null, provider_ref: null });
billing({ enabled: true, checkout: { mp: true } });
r = await call(h, { jwt: 'jwt-2', body: { action: 'checkout', period: 'monthly' } });
const p3 = mpState.pre.pre3; p3.status = 'authorized'; p3.summarized = { charged_quantity: 1, last_charged_date: new Date().toISOString() };
r = await call(h, { jwt: 'jwt-2', body: { action: 'sync' } });
check('un regalo sin vencimiento no se reemplaza por un pago', r.body.results[0] === 'regalo_vigente' && ent(U2).source === 'founder');
Object.assign(ent(U2), { source: 'trial', status: 'trialing', period_end: new Date(Date.now() + 10 * DAY).toISOString() });
p3.summarized = { charged_quantity: 0 };
r = await call(h, { jwt: 'jwt-2', body: { action: 'sync' } });
check('pagar durante la prueba no la acorta mientras el cobro no se confirma', r.body.results[0] === 'se_conserva' && ent(U2).source === 'trial');
p3.summarized = { charged_quantity: 1, last_charged_date: new Date().toISOString() };
r = await call(h, { jwt: 'jwt-2', body: { action: 'sync' } });
check('con el cobro confirmado, la prueba pasa a suscripción', ent(U2).source === 'web' && ent(U2).status === 'active' && days(ent(U2).period_end) > 27);

// límite de intentos
for (let i = 0; i < 4; i++) await call(h, { jwt: 'jwt-2', body: { action: 'checkout', period: 'monthly' } });
r = await call(h, { jwt: 'jwt-2', body: { action: 'checkout', period: 'monthly' } });
check('más de cinco intentos en una hora se frenan', r.status === 429 && r.body.error === 'demasiados_intentos', JSON.stringify(r));

// firma de los avisos
env.MP_WEBHOOK_SECRET = 'secreto'; env.MP_FIRMA_ESTRICTA = '1';
h = await load();
const sign = (id, req, ts) => `ts=${ts},v1=${createHmac('sha256', 'secreto').update(`id:${id};request-id:${req};ts:${ts};`).digest('hex')}`;
r = await call(h, { query: '?data.id=pre2&type=subscription_preapproval', body: { type: 'subscription_preapproval', data: { id: 'pre2' } }, headers: { 'x-request-id': 'r-1', 'x-signature': sign('pre2', 'r-1', '1700000000') } });
check('aviso con firma válida: se procesa', r.status === 200 && r.body.result === 'activo', JSON.stringify(r));
r = await call(h, { query: '?data.id=pre2&type=subscription_preapproval', body: { type: 'subscription_preapproval', data: { id: 'pre2' } }, headers: { 'x-request-id': 'r-1', 'x-signature': 'ts=1700000000,v1=00ff' } });
check('aviso con firma falsa, en modo estricto: se rechaza', r.status === 401);
r = await call(h, { body: { type: 'subscription_preapproval', data: { id: 'pre2' } } });
check('aviso sin firma, en modo estricto: se rechaza', r.status === 401);

console.log(fails ? `\n${fails} pruebas fallaron` : '\nTodo bien');
process.exit(fails ? 1 : 0);
