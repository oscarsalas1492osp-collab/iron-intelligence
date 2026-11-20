// Importación del historial exportado por otras apps (Strong, Hevy y formatos parecidos en CSV).
// Las columnas se reconocen por su nombre, así que tolera variantes entre versiones de cada app.
import { norm } from './muscles';
import type { Equipment, ExerciseDef, Muscle } from './types';

export interface ImportedSet { weight: number; reps: number; rir: number | null; seconds: number; warmup: boolean }
export interface ImportedSession { name: string; start: number; durationMs: number; exercises: { name: string; sets: ImportedSet[] }[] }

/** CSV con comillas, comas o punto y coma, y saltos de línea dentro de un campo. */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const head = t.slice(0, t.indexOf('\n') > 0 ? t.indexOf('\n') : t.length);
  const sep = (head.match(/;/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const toNum = (v: string | undefined) => { const n = parseFloat((v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
function toDate(v: string): number {
  const iso = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3], +iso[4], +iso[5]).getTime();
  const d = Date.parse(v.replace(',', ''));
  return Number.isNaN(d) ? NaN : d;
}
/** «1h 5m», «45m», «3600» (segundos) → milisegundos. */
function toDuration(v: string): number {
  if (/^\d+$/.test(v.trim())) return +v * 1000;
  const h = +(v.match(/(\d+)\s*h/)?.[1] ?? 0), m = +(v.match(/(\d+)\s*m/)?.[1] ?? 0), s = +(v.match(/(\d+)\s*s/)?.[1] ?? 0);
  return (h * 3600 + m * 60 + s) * 1000;
}

/** Convierte el CSV en sesiones. `lb`: los pesos vienen en libras (si la columna no lo dice). */
export function parseWorkouts(text: string, lb = false): ImportedSession[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('El archivo está vacío o no es un CSV');
  const head = rows[0].map((h) => norm(h).replace(/[^a-z0-9]+/g, ' ').trim());
  const col = (...keys: string[]) => head.findIndex((h) => keys.some((k) => h === k || h.startsWith(k)));
  const cEx = col('exercise name', 'exercise title', 'exercise'), cW = col('weight'), cR = col('reps');
  const cDate = col('date', 'start time'), cEnd = col('end time'), cName = col('workout name', 'title', 'workout'), cDur = col('duration'), cRpe = col('rpe'), cType = col('set type', 'set order'), cSec = col('seconds', 'duration seconds');
  if (cEx < 0 || cW < 0 || cR < 0 || cDate < 0) throw new Error('No reconozco el formato: faltan columnas de fecha, ejercicio, peso o repeticiones');
  const inLb = lb || /lb/.test(head[cW]);
  const by = new Map<string, ImportedSession>();
  for (const r of rows.slice(1)) {
    const start = toDate(r[cDate] ?? '');
    const name = (r[cEx] ?? '').trim();
    if (Number.isNaN(start) || !name) continue;
    const key = `${start}|${cName >= 0 ? r[cName] : ''}`;
    let s = by.get(key);
    if (!s) {
      const end = cEnd >= 0 ? toDate(r[cEnd] ?? '') : NaN;
      const dur = !Number.isNaN(end) && end > start ? end - start : cDur >= 0 && cDur !== cSec ? toDuration(r[cDur] ?? '') : 0;
      s = { name: (cName >= 0 ? r[cName] : '').trim() || 'Entrenamiento importado', start, durationMs: Math.min(dur, 6 * 3600000), exercises: [] };
      by.set(key, s);
    }
    let e = s.exercises[s.exercises.length - 1];
    if (!e || e.name !== name) { e = s.exercises.find((x) => x.name === name) ?? (s.exercises.push({ name, sets: [] }), s.exercises[s.exercises.length - 1]); }
    const rpe = cRpe >= 0 ? toNum(r[cRpe]) : 0;
    const type = norm(cType >= 0 ? r[cType] ?? '' : '');
    const weight = Math.round((toNum(r[cW]) * (inLb ? 0.45359237 : 1)) * 100) / 100;
    const reps = Math.round(toNum(r[cR])), seconds = cSec >= 0 ? Math.round(toNum(r[cSec])) : 0;
    if (reps <= 0 && seconds <= 0) continue;
    e.sets.push({ weight: Math.min(1000, Math.max(0, weight)), reps: Math.min(200, reps), seconds: Math.min(200, seconds), rir: rpe >= 5 && rpe <= 10 ? Math.round((10 - rpe) * 2) / 2 : null, warmup: type.startsWith('w') });
  }
  return [...by.values()].filter((s) => s.exercises.some((e) => e.sets.length)).sort((a, b) => a.start - b.start);
}

const EQUIP: [RegExp, Equipment][] = [[/barbell|barra/, 'barbell'], [/dumbbell|mancuerna/, 'dumbbell'], [/cable|polea/, 'cable'], [/smith/, 'smith'], [/machine|maquina/, 'machine'], [/kettlebell/, 'kettlebell'], [/band|banda/, 'band'], [/bodyweight|assisted|peso corporal/, 'bodyweight']];
const MUSC: [RegExp, Muscle][] = [
  [/bench|chest|fly|pec|push up|dip|pecho/, 'chest'], [/row|pulldown|pull up|chin up|lat |remo|jalon|dominad/, 'back'], [/shrug|trap/, 'traps'],
  [/shoulder|overhead|lateral raise|military|face pull|delt|hombro/, 'shoulders'], [/curl|bicep/, 'biceps'], [/tricep|skull|pushdown|extension overhead/, 'triceps'],
  [/squat|leg press|leg extension|lunge|quad|sentadilla|prensa/, 'quads'], [/deadlift|leg curl|hamstring|good morning|peso muerto/, 'hamstrings'], [/hip thrust|glute|kickback/, 'glutes'],
  [/calf|gemelo/, 'calves'], [/crunch|plank|ab |abs|sit up|leg raise/, 'abs'], [/wrist|forearm/, 'forearms'],
];
const words = (t: string) => norm(t).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !['the', 'de', 'con', 'en', 'a'].includes(w));

/** Busca en la biblioteca el ejercicio que corresponde a un nombre de otra app; null si ninguno se parece lo suficiente. */
export function matchExercise(name: string, library: ExerciseDef[]): ExerciseDef | null {
  const eq = guessExercise(name).equipment;
  // El implemento suele venir entre paréntesis («Bench Press (Barbell)»): se usa para desempatar, no para comparar.
  const w = words(name.replace(/\([^)]*\)/g, ' '));
  if (!w.length) return null;
  let best: ExerciseDef | null = null, score = 0;
  for (const e of library) {
    for (const cand of [e.name, e.aka]) {
      const cw = words(cand);
      const hit = w.filter((x) => cw.includes(x)).length;
      if (!hit) continue;
      let sc = hit === w.length ? (cw.length === w.length ? 1 : 0.9 - 0.01 * Math.min(10, cw.length - w.length)) : hit / Math.max(w.length, cw.length);
      if (e.equipment === eq) sc += 0.05;
      if (sc > score) { score = sc; best = e; }
    }
  }
  return score >= 0.8 ? best : null;
}
/** Datos mínimos para crear como ejercicio propio uno que no está en la biblioteca. */
export function guessExercise(name: string): { primary: Muscle; equipment: Equipment } {
  const n = norm(name);
  return { primary: MUSC.find(([re]) => re.test(n))?.[1] ?? 'chest', equipment: EQUIP.find(([re]) => re.test(n))?.[1] ?? 'other' };
}
