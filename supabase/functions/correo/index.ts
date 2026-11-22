// Correos de la app que se envían desde el panel interno: invitación a un tester o invitado, aviso de lanzamiento
// a los inscritos y correo de prueba. Solo responde a la cuenta que administra la app, que se comprueba con su sesión.
//   status   si el envío está conectado, cuántos correos van hoy y cuántos inscritos faltan por avisar
//   preview  asunto y texto de un correo, sin enviarlo
//   test     envía una prueba al correo de quien administra
//   invite   envía la invitación a un correo con acceso vigente
//   launch   envía el aviso de lanzamiento a los inscritos pendientes (por tandas) y los deja marcados
// Envía por Resend. Secretos (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY      obligatorio. Sin él la función responde «sin_configurar» y no envía nada.
//   CORREO_REMITENTE    opcional. Por defecto «IRON INTELLIGENCE <hola@ironintelligence.app>».
//   CORREO_RESPUESTAS   opcional. Dirección a la que llegan las respuestas.
//   CORREO_TOPE_DIARIO  opcional. Correos por día (100 en el plan gratis de Resend).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { type Correo, invitacion, lanzamiento, prueba } from "./plantillas.ts";

const RESEND = "https://api.resend.com";
const KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("CORREO_REMITENTE") ?? "IRON INTELLIGENCE <hola@ironintelligence.app>";
const REPLY = Deno.env.get("CORREO_RESPUESTAS") ?? "";
const TOPE = Math.max(1, Number(Deno.env.get("CORREO_TOPE_DIARIO") ?? "100") || 100);
const TANDA = 100;                                    // máximo de Resend por envío en lote
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ORIGINS = ["https://app.ironintelligence.app", "https://ironintelligence.app"];

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
const isEmail = (v: unknown): v is string => typeof v === "string" && v.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

const mensaje = (c: Correo, to: string, asunto = c.subject) => ({ from: FROM, to: [to], subject: asunto, html: c.html, text: c.text, ...(REPLY ? { reply_to: REPLY } : {}) });
async function resend(path: string, body: unknown): Promise<{ ok: boolean; ids: string[]; detail: string }> {
  try {
    const r = await fetch(RESEND + path, { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    // deno-lint-ignore no-explicit-any
    const j: any = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, ids: [], detail: String(j?.message ?? `respuesta ${r.status}`).slice(0, 300) };
    const ids = Array.isArray(j?.data) ? j.data.map((x: { id?: string }) => String(x?.id ?? "")) : [String(j?.id ?? "")];
    return { ok: true, ids, detail: "" };
  } catch (e) {
    return { ok: false, ids: [], detail: e instanceof Error ? e.message.slice(0, 300) : "sin respuesta" };
  }
}
/** Correos enviados hoy (día UTC, que es como cuenta el tope diario del servicio). */
async function enviadosHoy(): Promise<number> {
  const desde = new Date().toISOString().slice(0, 10) + "T00:00:00Z";
  const { count } = await admin.from("email_log").select("id", { count: "exact", head: true }).eq("ok", true).gte("at", desde);
  return count ?? 0;
}
async function pendientes(): Promise<number> {
  const { count } = await admin.from("launch_signups").select("id", { count: "exact", head: true }).is("notified_at", null);
  return count ?? 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "metodo" });
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return json(req, 401, { error: "sin_sesion" });
  const { data: adm } = await admin.from("app_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adm) return json(req, 403, { error: "forbidden" });

  // deno-lint-ignore no-explicit-any
  const body: any = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  const tipo = body?.kind === "guest" ? "guest" : "tester";
  const registrar = (kind: string, to: string, ok: boolean, id: string, error: string) =>
    admin.from("email_log").insert({ kind, to_email: to, ok, provider_id: id || null, error: error || null, admin_id: user.id });

  if (action === "status") {
    return json(req, 200, { configured: KEY !== "", from: FROM, replies: REPLY || null, today: await enviadosHoy(), cap: TOPE, pending: await pendientes() });
  }
  if (action === "preview") {
    const c = body?.mail === "lanzamiento"
      ? lanzamiento({ link: typeof body?.link === "string" && body.link ? body.link : "https://(link de descarga)", respuestas: REPLY !== "" })
      : invitacion({ email: isEmail(body?.email) ? body.email : "nombre@gmail.com", tipo, respuestas: REPLY !== "" });
    return json(req, 200, { subject: c.subject, text: c.text, from: FROM });
  }

  if (KEY === "") return json(req, 409, { error: "sin_configurar" });
  if (await enviadosHoy() >= TOPE) return json(req, 429, { error: "tope_diario" });

  if (action === "test") {
    if (!isEmail(user.email)) return json(req, 400, { error: "correo" });
    const r = await resend("/emails", mensaje(prueba(), user.email));
    await registrar("prueba", user.email, r.ok, r.ids[0] ?? "", r.detail);
    return r.ok ? json(req, 200, { sent: 1, to: user.email }) : json(req, 502, { error: "resend", detail: r.detail });
  }

  if (action === "invite") {
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!isEmail(email)) return json(req, 400, { error: "correo" });
    const { data: g } = await admin.from("access_grants").select("email,kind,status").eq("email", email).maybeSingle();
    if (!g || g.status !== "active") return json(req, 404, { error: "sin_acceso" });
    const r = await resend("/emails", mensaje(invitacion({ email, tipo: g.kind === "guest" ? "guest" : "tester", respuestas: REPLY !== "" }), email));
    await registrar("invitacion", email, r.ok, r.ids[0] ?? "", r.detail);
    if (!r.ok) return json(req, 502, { error: "resend", detail: r.detail });
    await admin.from("access_grants").update({ invited_at: new Date().toISOString() }).eq("email", email);
    return json(req, 200, { sent: 1, to: email });
  }

  if (action === "launch") {
    const link = String(body?.link ?? "").trim();
    if (!/^https:\/\/[^\s"<>]+$/i.test(link) || link.length > 300) return json(req, 400, { error: "link" });
    const cupo = Math.min(TANDA, TOPE - await enviadosHoy());
    const { data: rows } = await admin.from("launch_signups").select("email").is("notified_at", null).order("created_at").limit(cupo);
    const correos = (rows ?? []).map((x) => x.email as string);
    if (!correos.length) return json(req, 200, { sent: 0, remaining: 0 });
    // Se marcan antes de enviar, para que dos toques seguidos no le escriban dos veces a la misma persona.
    const ahora = new Date().toISOString();
    const { data: tomados } = await admin.from("launch_signups").update({ notified_at: ahora }).in("email", correos).is("notified_at", null).select("email");
    const lista = (tomados ?? []).map((x) => x.email as string);
    if (!lista.length) return json(req, 200, { sent: 0, remaining: await pendientes() });
    const c = lanzamiento({ link, respuestas: REPLY !== "" });
    const r = await resend("/emails/batch", lista.map((to) => mensaje(c, to)));
    if (!r.ok) {
      await admin.from("launch_signups").update({ notified_at: null }).in("email", lista).eq("notified_at", ahora);
      await registrar("lanzamiento", `${lista.length} inscritos`, false, "", r.detail);
      return json(req, 502, { error: "resend", detail: r.detail });
    }
    await admin.from("email_log").insert(lista.map((to, i) => ({ kind: "lanzamiento", to_email: to, ok: true, provider_id: r.ids[i] || null, admin_id: user.id })));
    return json(req, 200, { sent: lista.length, remaining: await pendientes() });
  }

  return json(req, 400, { error: "accion" });
});
