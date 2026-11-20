// Rutina compartida por enlace: viaja dentro del propio enlace (sin servidor), comprimida a lo esencial.
import type { Equipment, ExType, Muscle, Target } from './types';

export interface SharedItem { exerciseId: string; target: Target; group: number | null }
export interface SharedCustom { id: string; name: string; primary: Muscle; type: ExType; equipment: Equipment }
export interface SharedRoutine { name: string; split: string; days: number[]; items: SharedItem[]; custom: SharedCustom[] }

const b64 = (bytes: Uint8Array) => { let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (t: string) => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export function encodeRoutine(r: SharedRoutine): string {
  const compact = {
    v: 1, n: r.name, s: r.split, d: r.days,
    i: r.items.map((x) => [x.exerciseId, x.target.sets, x.target.repMin, x.target.repMax, x.target.rirMin, x.target.rirMax, x.target.restSec, x.group]),
    x: r.custom.map((c) => [c.id, c.name, c.primary, c.type, c.equipment]),
  };
  return b64(new TextEncoder().encode(JSON.stringify(compact)));
}

const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);
/** Lee una rutina compartida. Devuelve null si el enlace está dañado o no es de esta app. */
export function decodeRoutine(code: string): SharedRoutine | null {
  try {
    const o = JSON.parse(new TextDecoder().decode(unb64(code.trim())));
    if (o?.v !== 1 || !Array.isArray(o.i) || o.i.length > 40) return null;
    const items: SharedItem[] = o.i.map((x: unknown[]) => {
      const repMin = Math.round(num(x[2], 1, 100)), rirMin = num(x[4], 0, 10);
      return { exerciseId: String(x[0]).slice(0, 80), group: typeof x[7] === 'number' ? x[7] : null, target: { sets: Math.round(num(x[1], 1, 12)), repMin, repMax: Math.max(repMin, Math.round(num(x[3], 1, 100))), rirMin, rirMax: Math.max(rirMin, num(x[5], 0, 10)), restSec: Math.round(num(x[6], 0, 900)) } };
    });
    const custom: SharedCustom[] = (Array.isArray(o.x) ? o.x : []).slice(0, 40).map((c: unknown[]) => ({ id: String(c[0]), name: String(c[1]).slice(0, 80), primary: c[2] as Muscle, type: (c[3] === 'isolation' ? 'isolation' : 'compound') as ExType, equipment: c[4] as Equipment }));
    return { name: String(o.n ?? 'Rutina').slice(0, 60) || 'Rutina', split: String(o.s ?? '').slice(0, 40), days: (Array.isArray(o.d) ? o.d : []).filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6), items, custom };
  } catch { return null; }
}
