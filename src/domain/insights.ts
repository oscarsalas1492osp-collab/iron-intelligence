// Indicadores de constancia, equilibrio y fuerza relativa. Funciones puras.
import { DAY, e1rm, weekStart } from './calc';
import type { ExerciseDef, Muscle } from './types';
import { mainSets, type ASet } from './volume';

/** Semanas seguidas con al menos una sesión. La semana en curso no rompe la racha si aún no se ha entrenado. */
export function weekStreak(dates: number[], now = Date.now()): number {
  const weeks = new Set(dates.map((d) => weekStart(d)));
  let w = weekStart(now);
  if (!weeks.has(w)) w -= 7 * DAY;
  let n = 0;
  while (weeks.has(w)) { n++; w -= 7 * DAY; }
  return n;
}

export interface WeekAdherence { start: number; done: number; planned: number }
/** Sesiones hechas contra las planificadas en las últimas semanas (la más reciente al final). */
export function adherence(dates: number[], perWeek: number, weeks = 8, now = Date.now()): { weeks: WeekAdherence[]; pct: number } {
  const cur = weekStart(now);
  const out: WeekAdherence[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = cur - i * 7 * DAY;
    out.push({ start, done: dates.filter((d) => d >= start && d < start + 7 * DAY).length, planned: perWeek });
  }
  // La semana en curso no cuenta en el porcentaje: aún no termina.
  const closed = out.slice(0, -1);
  const planned = closed.reduce((a, w) => a + w.planned, 0);
  const done = closed.reduce((a, w) => a + Math.min(w.done, w.planned), 0);
  return { weeks: out, pct: planned ? Math.round((done / planned) * 100) : 0 };
}

const PUSH: Muscle[] = ['chest', 'shoulders', 'triceps'];
const PULL: Muscle[] = ['back', 'traps', 'biceps', 'forearms'];
const FRONT: Muscle[] = ['quads'];
const BACK: Muscle[] = ['hamstrings', 'glutes'];
export interface Balance { push: number; pull: number; front: number; back: number }
/** Series directas de empuje y tirón (tren superior) y de cara anterior y posterior de la pierna. */
export function balance(sets: ASet[], ex: Map<string, ExerciseDef>): Balance {
  const b: Balance = { push: 0, pull: 0, front: 0, back: 0 };
  for (const s of mainSets(sets)) {
    const m = ex.get(s.exerciseId)?.primary;
    if (!m) continue;
    if (PUSH.includes(m)) b.push++; else if (PULL.includes(m)) b.pull++; else if (FRONT.includes(m)) b.front++; else if (BACK.includes(m)) b.back++;
  }
  return b;
}

export const LEVELS = ['Inicial', 'Novato', 'Intermedio', 'Avanzado', 'Élite'] as const;
/** Múltiplos del peso corporal (1RM estimado) que separan los niveles. Son referencias prácticas de uso común, no normas oficiales. */
const STANDARDS: { key: string; name: string; match: (id: string) => boolean; marks: number[] }[] = [
  { key: 'squat', name: 'Sentadilla', match: (id) => id === 'squat', marks: [0.75, 1.25, 1.5, 2, 2.75] },
  { key: 'bench', name: 'Press de banca', match: (id) => id === 'bench_press', marks: [0.5, 0.75, 1, 1.5, 2] },
  { key: 'deadlift', name: 'Peso muerto', match: (id) => /deadlift/.test(id) && !/romanian|stiff|single|rdl/.test(id), marks: [1, 1.5, 2, 2.5, 3] },
  { key: 'ohp', name: 'Press militar', match: (id) => id === 'overhead_press', marks: [0.35, 0.55, 0.8, 1.05, 1.35] },
  { key: 'row', name: 'Remo con barra', match: (id) => id === 'barbell_row', marks: [0.5, 0.75, 1, 1.3, 1.6] },
];
export interface StrengthLevel { key: string; name: string; e1rm: number; ratio: number; level: number; next: number | null }
/** Nivel por levantamiento según el mejor 1RM estimado y el peso corporal. `female` aplica marcas más bajas. */
export function strengthLevels(sets: ASet[], bodyKg: number, female = false): StrengthLevel[] {
  if (!(bodyKg > 0)) return [];
  const out: StrengthLevel[] = [];
  for (const st of STANDARDS) {
    let best = 0;
    for (const s of mainSets(sets)) if (st.match(s.exerciseId)) best = Math.max(best, e1rm(s.weight, s.reps, s.rir) ?? 0);
    if (!best) continue;
    const marks = st.marks.map((m) => m * (female ? (st.key === 'squat' || st.key === 'deadlift' ? 0.75 : 0.6) : 1));
    const ratio = best / bodyKg;
    let level = 0;
    for (let i = 0; i < marks.length; i++) if (ratio >= marks[i]) level = i;
    out.push({ key: st.key, name: st.name, e1rm: Math.round(best), ratio: Math.round(ratio * 100) / 100, level, next: level < marks.length - 1 ? Math.ceil(marks[level + 1] * bodyKg) : null });
  }
  return out;
}

/** ¿La serie recién completada supera lo hecho antes en ese ejercicio? */
export function isRecord(history: ASet[], exerciseId: string, weight: number, reps: number, rir: number | null): 'weight' | 'e1rm' | null {
  const past = mainSets(history).filter((s) => s.exerciseId === exerciseId);
  if (!past.length || !(weight > 0)) return null;
  if (weight > Math.max(...past.map((s) => s.weight))) return 'weight';
  const now = e1rm(weight, reps, rir), best = Math.max(0, ...past.map((s) => e1rm(s.weight, s.reps, s.rir) ?? 0));
  return now != null && best > 0 && now > best * 1.001 ? 'e1rm' : null;
}
