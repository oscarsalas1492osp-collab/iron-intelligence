// Textos de los correos que envía la app. Sin dependencias, para poder probarlos fuera del servidor.
// Voz: habla Oscar, en primera persona y de tú (ver la skill de redacción de IRON INTELLIGENCE).
export interface Correo { subject: string; text: string; html: string }
type Bloque = string | { boton: string; url: string } | { lista: string[] };

const APP = "https://app.ironintelligence.app";
const ICONO = "https://ironintelligence.app/icon-v2-192.png";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Convierte las direcciones web de un párrafo en enlaces. */
const conEnlaces = (s: string) => esc(s).replace(/https:\/\/[^\s<)]+/g, (u) => `<a href="${u}" style="color:#ffb054">${u.replace("https://", "")}</a>`);

function armar(subject: string, bloques: Bloque[], pie: string): Correo {
  const text = [
    ...bloques.map((b) => typeof b === "string" ? b : "boton" in b ? `${b.boton}: ${b.url}` : b.lista.map((x) => `- ${x}`).join("\n")),
    "IRON INTELLIGENCE\nRegistra. Analiza. Progresa.",
    pie,
  ].join("\n\n");
  const p = "margin:0 0 16px;font-size:16px;line-height:1.55;color:#f2f6f6";
  const cuerpo = bloques.map((b) => {
    if (typeof b === "string") return `<p style="${p}">${conEnlaces(b)}</p>`;
    if ("boton" in b) return `<p style="margin:8px 0 24px"><a href="${esc(b.url)}" style="display:inline-block;background:#ff6a1a;color:#070d10;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 24px;border-radius:14px">${esc(b.boton)}</a></p>`;
    return `<ul style="margin:0 0 16px;padding:0 0 0 20px;color:#f2f6f6;font-size:16px;line-height:1.55">${b.lista.map((x) => `<li style="margin:0 0 8px">${conEnlaces(x)}</li>`).join("")}</ul>`;
  }).join("\n");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#070d10">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070d10"><tr><td align="center" style="padding:28px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:Arial,Helvetica,sans-serif">
<tr><td style="padding:0 0 28px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:12px"><img src="${ICONO}" width="40" height="40" alt="" style="display:block;border-radius:10px"></td>
<td style="font-size:15px;font-weight:bold;letter-spacing:.06em;color:#f2f6f6;line-height:1.2">IRON<br><span style="font-size:11px;letter-spacing:.3em;color:#93a4ab">INTELLIGENCE</span></td>
</tr></table></td></tr>
<tr><td>
${cuerpo}
</td></tr>
<tr><td style="padding:20px 0 0;border-top:1px solid #1d2a30;font-size:13px;line-height:1.5;color:#93a4ab">Registra. Analiza. Progresa.<br>${esc(pie)}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

const INSTALAR: Bloque = { lista: [
  "Android: ábrela en Chrome, toca el menú de los tres puntos y elige Instalar app.",
  "iPhone: ábrela en Safari, toca Compartir y elige Añadir a pantalla de inicio.",
] };

/** Invitación a entrar a la app antes del lanzamiento. `tipo`: tester (prueba y reporta) o guest (solo entra antes). */
export function invitacion(o: { email: string; tipo: "tester" | "guest"; respuestas: boolean }): Correo {
  const responder = o.respuestas ? " Puedes responder a este mismo correo." : "";
  return armar("Ya puedes entrar a IRON INTELLIGENCE", [
    "Hola.",
    o.tipo === "tester"
      ? "Te invité a probar IRON INTELLIGENCE antes del lanzamiento. Tu acceso ya está activo."
      : "Tienes acceso a IRON INTELLIGENCE antes del lanzamiento. Ya puedes entrar.",
    { boton: "Abrir la app", url: APP },
    `Crea tu cuenta con este mismo correo (${o.email}). Con otro correo no te va a dejar entrar.`,
    "Para dejarla instalada en el teléfono:",
    INSTALAR,
    (o.tipo === "tester"
      ? "Úsala en tus entrenamientos y cuéntame qué falló, qué te confundió y qué te faltó. Me sirve todo."
      : "Si algo falla o te confunde, cuéntamelo.") + responder,
    "Oscar",
  ], "Te llegó este correo porque te di acceso a la app. Si no lo esperabas, puedes ignorarlo.");
}

/** Aviso a quienes se inscribieron en la página: la app ya salió. `link`: dónde se descarga. */
export function lanzamiento(o: { link: string; respuestas: boolean }): Correo {
  return armar("IRON INTELLIGENCE ya salió", [
    "Hola.",
    "IRON INTELLIGENCE ya salió y la puedes descargar desde hoy.",
    { boton: "Descargar la app", url: o.link },
    "Anotas cada serie en tres toques y, la próxima vez que te toque ese ejercicio, la app te dice si subes, mantienes o bajas el peso, y te muestra por qué.",
    `Si usas iPhone, ábrela en Safari desde ${APP}, toca Compartir y elige Añadir a pantalla de inicio.`,
    "Oscar",
  ], "Te escribí porque te inscribiste en ironintelligence.app para recibir este aviso. Es el único correo de esta lista.");
}

/** Correo para comprobar que el envío funciona. */
export function prueba(): Correo {
  return armar("Prueba del correo de IRON INTELLIGENCE", [
    "Si estás leyendo esto, el correo de la app funciona.",
    "Desde el panel ya puedes enviar invitaciones y, el día del lanzamiento, el aviso a los inscritos.",
  ], "Correo de prueba enviado desde el panel interno.");
}
