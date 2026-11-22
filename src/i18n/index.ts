// Idiomas de la app. El código y los datos están escritos en español; para los demás idiomas hay un diccionario
// «texto en español → traducción» que se aplica al mostrar (ver dom.ts) y con `tr()` donde no hay pantalla
// de por medio (búsqueda, avisos del sistema, imágenes para compartir).
// Las claves con «{*}» son plantillas: «Semana {*} de {*}» calza con «Semana 3 de 8».
export type Lang = 'es' | 'en' | 'pt';
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'es', label: 'Español' }, { id: 'en', label: 'English' }, { id: 'pt', label: 'Português' },
];
const KEY = 'ii_lang';
const isLang = (v: unknown): v is Lang => v === 'es' || v === 'en' || v === 'pt';

/** Idioma elegido en Perfil; si no hay, el primero del teléfono que la app tenga; si ninguno, inglés. */
export function detectLang(): Lang {
  try { const s = localStorage.getItem(KEY); if (isLang(s)) return s; } catch { /* sin almacenamiento */ }
  const prefs = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const p of prefs) { const two = String(p ?? '').slice(0, 2).toLowerCase(); if (isLang(two)) return two; }
  return prefs.length ? 'en' : 'es';
}

let lang: Lang = 'es';
let exact = new Map<string, string>();
let wild: { re: RegExp; out: string; strict: boolean }[] = [];
const cache = new Map<string, string>();

export const getLang = (): Lang => lang;
/** Región para fechas y números: la del teléfono si coincide con el idioma; si no, la habitual de ese idioma. */
export function locale(): string {
  const nav = typeof navigator === 'undefined' ? '' : navigator.language ?? '';
  if (nav.slice(0, 2).toLowerCase() === lang && nav.length > 2) return nav;
  return lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-BR' : 'es-CL';
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const letters = (s: string) => (s.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;

/** Carga un diccionario. Se usa al iniciar y en las pruebas. */
export function useDictionary(l: Lang, dict: Record<string, string>): void {
  lang = l; exact = new Map(); wild = []; cache.clear();
  for (const [k, v] of Object.entries(dict)) {
    if (!v) continue;
    if (!k.includes('{*}')) { exact.set(k, v); continue; }
    const parts = k.split('{*}');
    let n = 0;
    const out = v.includes('{*}') ? v.replace(/\{\*\}/g, () => `{${++n}}`) : v;      // «{*}» en orden, o «{2}…{1}» si cambia el orden
    wild.push({ re: new RegExp('^' + parts.map(esc).join('(.*?)') + '$', 's'), out, strict: letters(parts.join('')) < 10 });
  }
  wild.sort((a, b) => b.re.source.length - a.re.source.length);       // primero las plantillas más específicas
}

/** Carga el diccionario de un idioma y lo deja en uso. Con español no hay nada que cargar. */
export async function loadLang(l: Lang): Promise<Lang> {
  if (l === 'es') { useDictionary('es', {}); return 'es'; }
  try {
    const mod = l === 'en' ? await import('./en.json') : await import('./pt.json');
    useDictionary(l, mod.default as Record<string, string>);
  } catch { useDictionary('es', {}); }                                  // sin diccionario (sin red la primera vez): español
  return lang;
}

/** Elige el idioma y carga su diccionario antes de dibujar la app. */
export const initLang = (): Promise<Lang> => loadLang(detectLang());

/** Guarda el idioma y recarga: así fechas, números y textos ya calculados salen en el idioma nuevo. */
export function setLang(l: Lang): void {
  try { localStorage.setItem(KEY, l); } catch { /* sin almacenamiento */ }
  location.reload();
}

// En inglés el decimal va con punto y los miles con coma; en español y portugués, al revés.
const numEn = (s: string) => s.replace(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d+/g, (m) => m.replace(/[.,]/g, (c) => (c === '.' ? ',' : '.')));
const SEPS = [' · ', ' — ', ' – ', ' / ', ' + ', ': ', ', ', ' y ', ' o '];
const GLUE: Record<Lang, Record<string, string>> = { es: {}, en: { ' y ': ' and ', ' o ': ' or ' }, pt: { ' y ': ' e ', ' o ': ' ou ' } };

function core(s: string, depth: number): string | null {
  const hit = exact.get(s);
  if (hit !== undefined) return hit;
  if (!/[A-Za-zÀ-ÿ]/.test(s)) return lang === 'en' ? numEn(s) : s;
  // «máquina guiada» cuando el diccionario tiene «Máquina guiada», y al revés.
  const first = s[0], up = first.toUpperCase(), low = first.toLowerCase();
  if (first !== up) { const h = exact.get(up + s.slice(1)); if (h !== undefined) return h[0].toLowerCase() + h.slice(1); }
  else if (first !== low) { const h = exact.get(low + s.slice(1)); if (h !== undefined) return h[0].toUpperCase() + h.slice(1); }
  // Con un signo al final o entre paréntesis.
  const end = /^(.*[A-Za-zÀ-ÿ0-9)%])([.:;,!?…]+)$/.exec(s);
  if (end && depth < 4) { const h = core(end[1], depth + 1); if (h !== null) return h + end[2]; }
  const par = /^\((.+)\)$/.exec(s);
  if (par && depth < 4) { const h = core(par[1], depth + 1); if (h !== null) return `(${h})`; }
  // Plantillas con valores.
  for (const w of wild) {
    const m = w.re.exec(s);
    if (!m) continue;
    const vals = m.slice(1).map((v) => (v === '' ? '' : core(v.trim(), depth + 1)));
    // Una plantilla corta («{*} de {*}») solo vale si sus valores son números o textos que la app conoce.
    if (w.strict && vals.some((v, i) => v === null && /[A-Za-zÀ-ÿ]{2}/.test(m[i + 1]))) continue;
    return w.out.replace(/\{(\d+)\}/g, (_, i: string) => { const j = Number(i) - 1, raw = m[j + 1] ?? ''; return vals[j] ?? (lang === 'en' ? numEn(raw) : raw); });
  }
  // Listas armadas al mostrar: «Pecho, Hombros», «Pecho · 3 series».
  if (depth < 3) for (const sep of SEPS) {
    if (!s.includes(sep)) continue;
    const parts = s.split(sep), tr2 = parts.map((p) => core(p.trim(), depth + 2));
    if (tr2.some((t, i) => t !== null && t !== parts[i].trim())) return tr2.map((t, i) => t ?? parts[i]).join(GLUE[lang][sep] ?? sep);
  }
  if (lang === 'en') { const n = numEn(s); if (n !== s) return n; }
  return null;
}

/** Traduce un texto escrito en español. Lo que no está en el diccionario vuelve tal cual. */
export function tr(text: string): string {
  if (lang === 'es' || !text) return text;
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  const body = m[2].replace(/\s+/g, ' ');
  const out = body ? core(body, 0) : null;
  const res = out === null ? text : m[1] + out + m[3];
  if (cache.size > 6000) cache.clear();
  cache.set(text, res);
  return res;
}

/** Iniciales de los días, empezando en domingo. En español se mantiene la X de miércoles. */
export function dayInitials(): string[] {
  if (lang === 'es') return ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const f = new Intl.DateTimeFormat(locale(), { weekday: 'narrow' });
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(2023, 0, 1 + i)).toUpperCase());   // el 1 de enero de 2023 fue domingo
}

/** Fechas y números en el idioma y la región actuales. */
export const fmtDate = (d: Date | number, opts: Intl.DateTimeFormatOptions): string => new Date(d).toLocaleDateString(locale(), opts);
export const fmtNum = (n: number, opts?: Intl.NumberFormatOptions): string => n.toLocaleString(locale(), opts);
