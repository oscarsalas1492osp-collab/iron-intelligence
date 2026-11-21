// Cobro de Pro por Mercado Pago (web). Una sola función con dos tipos de pedido:
//   · de la app, con la sesión del usuario:
//       checkout  crea la suscripción y devuelve la página de pago de Mercado Pago
//       sync      consulta en Mercado Pago las suscripciones de ese usuario y actualiza su plan
//       cancel    cancela la suscripción vigente de ese usuario (Pro sigue hasta el fin de lo pagado)
//   · de Mercado Pago: avisos de alta, cobro y cancelación.
// Nunca se confía en lo que llega: el estado se vuelve a pedir a Mercado Pago con la credencial del vendedor, que
// solo devuelve suscripciones de esta cuenta. El monto se fija aquí, desde el ajuste `billing`, no desde la app.
// Secretos (Supabase → Edge Functions → Secrets): MP_ACCESS_TOKEN (obligatorio), MP_WEBHOOK_SECRET (recomendado).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { manifest, paidUntil, signatureParts } from "./periodo.ts";

const MP = "https://api.mercadopago.com";
const TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const SECRET = Deno.env.get("MP_WEBHOOK_SECRET") ?? "";
const STRICT = Deno.env.get("MP_FIRMA_ESTRICTA") === "1";
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ORIGINS = ["https://app.ironintelligence.app", "https://ironintelligence.app"];
const BACK = "https://app.ironintelligence.app/?pago=mp";

const cors = (req: Request) => {
  const o = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.includes(o) ? o : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};
const json = (req: Request, status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const isEmail = (v: unknown): v is string => typeof v === "string" && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isMpId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v);

async function mp(path: string, init?: RequestInit) {
  const r = await fetch(MP + path, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } });
  const body = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, body };
}

// deno-lint-ignore no-explicit-any
type Pre = any;

/** Lleva al plan del usuario lo que Mercado Pago dice de una suscripción suya. */
async function apply(pre: Pre): Promise<string> {
  const uid = pre?.external_reference, ref = `mp:${pre?.id}`;
  if (!isUuid(uid) || !isMpId(pre?.id)) return "sin_usuario";
  const { data: cur } = await admin.from("entitlements").select("source,status,period_end,provider_ref").eq("user_id", uid).maybeSingle();
  if (pre.status === "authorized") {
    const endMs = paidUntil(pre, Date.now()), end = new Date(endMs).toISOString();
    const longer = (v: string | null) => v !== null && Date.parse(v) > endMs;
    // Un regalo sin vencimiento, o que dura más que lo pagado, no se pisa.
    if (cur && (cur.source === "founder" || cur.source === "manual") && cur.status === "active" && (cur.period_end === null || longer(cur.period_end))) return "regalo_vigente";
    // Sin un cobro confirmado todavía, no se acorta lo que la cuenta ya tenía (la prueba gratis o un período pagado de antes).
    if (cur && cur.provider_ref !== ref && (cur.source === "trial" || cur.source === "web") && cur.status !== "expired" && longer(cur.period_end) && !(Number(pre.summarized?.charged_quantity) > 0)) return "se_conserva";
    const { error } = await admin.from("entitlements").upsert({ user_id: uid, plan: "pro", status: "active", source: "web", period_end: end, trial_used: true, provider_ref: ref, updated_at: new Date().toISOString() });
    return error ? `error:${error.message}` : "activo";
  }
  if (pre.status === "cancelled" || pre.status === "paused") {
    // Solo si es la suscripción vigente: un aviso viejo no cancela una suscripción nueva. Sigue hasta lo ya pagado.
    if (cur && cur.provider_ref === ref && cur.source === "web" && cur.status !== "canceled") {
      const { error } = await admin.from("entitlements").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("user_id", uid);
      return error ? `error:${error.message}` : "cancelado";
    }
    return "sin_cambios";
  }
  return "pendiente";
}

async function hmacHex(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function signed(req: Request, dataId: string): Promise<boolean> {
  const parts = signatureParts(req.headers.get("x-signature") ?? "");
  return !!parts && (await hmacHex(SECRET, manifest(dataId, req.headers.get("x-request-id") ?? "", parts.ts))) === parts.v1;
}

/** Suscripciones que este usuario ha iniciado desde la app, de la más nueva a la más vieja. */
async function intents(uid: string): Promise<string[]> {
  const { data } = await admin.from("payment_intents").select("provider_ref").eq("user_id", uid).order("created_at", { ascending: false }).limit(6);
  return (data ?? []).map((r: { provider_ref: string }) => r.provider_ref.replace(/^mp:/, "")).filter(isMpId);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "metodo" });
  const url = new URL(req.url);
  // deno-lint-ignore no-explicit-any
  const body: any = await req.json().catch(() => ({}));

  // ---------- pedidos de la app (con la sesión del usuario) ----------
  if (body?.action === "checkout" || body?.action === "sync" || body?.action === "cancel") {
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: auth } = await admin.auth.getUser(jwt);
    const user = auth?.user;
    if (!user) return json(req, 401, { error: "sin_sesion" });
    if (!TOKEN) return json(req, 503, { error: "pagos_no_configurados" });

    if (body.action === "sync") {
      const ids = await intents(user.id);
      if (isMpId(body.id) && !ids.includes(body.id)) ids.unshift(body.id);
      const list: Pre[] = [];
      for (const id of ids) {
        const r = await mp(`/preapproval/${id}`);
        if (r.ok && r.body?.external_reference === user.id) list.push(r.body);     // solo las de este usuario
      }
      const live = list.filter((p) => p.status === "authorized").sort((a, b) => Date.parse(b.date_created) - Date.parse(a.date_created))[0];
      const results: string[] = [];
      if (live) results.push(await apply(live)); else for (const p of list) results.push(await apply(p));
      return json(req, 200, { ok: true, results });
    }

    if (body.action === "cancel") {
      const { data: cur } = await admin.from("entitlements").select("source,status,provider_ref").eq("user_id", user.id).maybeSingle();
      const id = cur?.source === "web" ? String(cur.provider_ref ?? "").replace(/^mp:/, "") : "";
      if (!isMpId(id)) return json(req, 200, { ok: true, result: "sin_suscripcion" });
      const now = await mp(`/preapproval/${id}`);
      if (!now.ok || now.body?.external_reference !== user.id) return json(req, 502, { error: "mp_no_responde" });
      if (now.body.status !== "cancelled") {
        const r = await mp(`/preapproval/${id}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
        if (!r.ok) { console.error("mp cancelar", r.status, JSON.stringify(r.body)?.slice(0, 300)); return json(req, 502, { error: "mp_rechazo_cancelar" }); }
      }
      const after = await mp(`/preapproval/${id}`);
      return json(req, 200, { ok: true, result: await apply(after.ok ? after.body : { ...now.body, status: "cancelled" }) });
    }

    const period = body.period === "monthly" ? "monthly" : "yearly";
    const email = isEmail(body.email) ? body.email.trim() : user.email;
    if (!isEmail(email)) return json(req, 400, { error: "correo" });
    const { data: flag } = await admin.from("app_flags").select("value").eq("key", "billing").maybeSingle();
    // deno-lint-ignore no-explicit-any
    const cfg: any = flag?.value ?? {};
    const price = Number(cfg?.prices?.CLP?.[period]);
    const on = cfg.enabled === true || (Array.isArray(cfg.preview) && cfg.preview.includes(user.id));   // `preview`: cuentas que prueban el cobro antes del lanzamiento
    if (!on || cfg?.checkout?.mp !== true || !(price > 0)) return json(req, 409, { error: "cobro_apagado" });
    const { count } = await admin.from("payment_intents").select("provider_ref", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", new Date(Date.now() - 3600000).toISOString());
    if ((count ?? 0) >= 5) return json(req, 429, { error: "demasiados_intentos" });
    const r = await mp("/preapproval", {
      method: "POST",
      body: JSON.stringify({
        reason: period === "yearly" ? "Iron Intelligence Pro, plan anual" : "Iron Intelligence Pro, plan mensual",
        external_reference: user.id,
        payer_email: email,
        back_url: BACK,
        status: "pending",
        auto_recurring: { frequency: period === "yearly" ? 12 : 1, frequency_type: "months", transaction_amount: Math.round(price), currency_id: "CLP" },
      }),
    });
    if (!r.ok || typeof r.body?.init_point !== "string" || !isMpId(r.body?.id)) {
      console.error("mp preapproval", r.status, JSON.stringify(r.body)?.slice(0, 500));
      return json(req, 502, { error: "mp_rechazo" });
    }
    const { error } = await admin.from("payment_intents").insert({ provider_ref: `mp:${r.body.id}`, user_id: user.id, period });
    if (error) console.error("payment_intents", error.message);
    return json(req, 200, { url: r.body.init_point });
  }

  // ---------- avisos de Mercado Pago ----------
  const type = String(body?.type ?? body?.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "");
  const id = String(body?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (!isMpId(id)) return json(req, 200, { ok: true, ignored: "sin_id" });
  if (SECRET && !(await signed(req, url.searchParams.get("data.id") ?? id))) {
    console.warn("aviso con firma que no coincide", type);
    if (STRICT) return json(req, 401, { error: "firma" });
  }
  if (!TOKEN) return json(req, 503, { error: "pagos_no_configurados" });
  let pre: Pre = null;
  if (type === "subscription_preapproval") {
    pre = (await mp(`/preapproval/${id}`)).body;
  } else if (type === "subscription_authorized_payment") {
    const pay = (await mp(`/authorized_payments/${id}`)).body;
    if (isMpId(pay?.preapproval_id)) pre = (await mp(`/preapproval/${pay.preapproval_id}`)).body;
  } else {
    return json(req, 200, { ok: true, ignored: "tipo" });
  }
  const result = isMpId(pre?.id) ? await apply(pre) : "no_encontrada";
  console.log("aviso", type, result, pre?.status ?? "", `cobros:${pre?.summarized?.charged_quantity ?? "?"}`);
  return json(req, 200, { ok: true, result });
});
