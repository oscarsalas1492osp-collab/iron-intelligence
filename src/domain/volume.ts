// Análisis de volumen por grupo muscular.
//
// Series directas: el músculo es el objetivo principal del ejercicio.
// Series indirectas: el músculo participa como secundario. Se ponderan con un coeficiente
// configurable (por defecto 0,5). Ese valor sigue el método "fraccional" de Pelland et al.,
// que fue el que mejor ajustó los datos en su metarregresión; es una convención de conteo,
// NO una equivalencia fisiológica exacta.

import { DAY, e1rm, weekStart, ymd } from './calc';
import { MUSCLES } from './muscles';
import type { PerfSession } from './progression';
import type { EndReason, ExerciseDef, Muscle } from './types';

/** Serie completada, enriquecida con la fecha de su sesión. */
export interface ASet {
  sessionId: string;
  exerciseId: string;
  date: number;
  order: number;
  weight: number;
  reps: number;
  rir: number | null;
  failure: boolean;
  endReason: EndReason;
  /** Tramo de una técnica avanzada (bajada de un dropset, pausa de un descanso-pausa…): suma tonelaje, no cuenta como serie. */
  ext?: boolean;
}

/** Series principales: las que cuentan como «una serie» en el volumen semanal y en la progresión. */
export const mainSets = (sets: ASet[]): ASet[] => (sets.some((s) => s.ext) ? sets.filter((s) => !s.ext) : sets);

export interface MuscleVolume { muscle: Muscle; direct: number; indirect: number; fractional: number; days: number }
export type ExMap = Map<string, ExerciseDef>;

export function muscleVolume(sets: ASet[], ex: ExMap, coef: number): MuscleVolume[] {
  const acc = new Map<Muscle, { direct: number; indirect: number; days: Set<string> }>();
  for (const m of MUSCLES) acc.set(m, { direct: 0, indirect: 0, days: new Set() });
  for (const s of mainSets(sets)) {
    const e = ex.get(s.exerciseId);
    if (!e) continue;
    const p = acc.get(e.primary)!;
    p.direct += 1;
    p.days.add(ymd(s.date));
    for (const m of e.secondary) if (m !== e.primary) acc.get(m)!.indirect += 1;
  }
  return MUSCLES.map((m) => {
    const a = acc.get(m)!;
    return { muscle: m, direct: a.direct, indirect: a.indirect, fractional: Math.round((a.direct + a.indirect * coef) * 10) / 10, days: a.days.size };
  });
}

export const inWeek = (sets: ASet[], start: number): ASet[] => sets.filter((s) => s.date >= start && s.date < start + 7 * DAY);

/** Series fraccionales por semana para un músculo, de la semana más antigua a la actual. */
export function weeklySeries(sets: ASet[], ex: ExMap, coef: number, muscle: Muscle, weeks: number, now: number) {
  const cur = weekStart(now);
  return Array.from({ length: weeks }, (_, i) => {
    const start = cur - (weeks - 1 - i) * 7 * DAY;
    const v = muscleVolume(inWeek(sets, start), ex, coef).find((x) => x.muscle === muscle)!;
    return { start, label: new Date(start).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }), direct: v.direct, indirect: Math.round(v.indirect * coef * 10) / 10, fractional: v.fractional };
  });
}

export const RIR_BUCKETS = ['0 (fallo)', '1', '2', '3', '4+', 'Sin RIR'] as const;
export function rirDistribution(sets: ASet[]): { bucket: string; count: number }[] {
  const c = [0, 0, 0, 0, 0, 0];
  for (const s of mainSets(sets)) {
    if (s.rir == null) c[5]++;
    else if (s.rir < 0.75) c[0]++;
    else if (s.rir < 1.75) c[1]++;
    else if (s.rir < 2.75) c[2]++;
    else if (s.rir < 3.75) c[3]++;
    else c[4]++;
  }
  return RIR_BUCKETS.map((bucket, i) => ({ bucket, count: c[i] }));
}

/** Carga total movida (kg × reps). Métrica descriptiva, no un indicador de estímulo. */
export const tonnage = (sets: ASet[]): number => Math.round(sets.reduce((a, s) => a + s.weight * s.reps, 0));

/** Ejercicios que más series aportan a un músculo. */
export function topContributors(sets: ASet[], ex: ExMap, coef: number, muscle: Muscle) {
  const m = new Map<string, number>();
  for (const s of mainSets(sets)) {
    const e = ex.get(s.exerciseId);
    if (!e) continue;
    const w = e.primary === muscle ? 1 : e.secondary.includes(muscle) ? coef : 0;
    if (w) m.set(e.id, (m.get(e.id) ?? 0) + w);
  }
  return [...m.entries()].map(([id, v]) => ({ id, name: ex.get(id)!.name, sets: Math.round(v * 10) / 10 })).sort((a, b) => b.sets - a.sets);
}

/** Agrupa las series de un ejercicio por sesión, de la más reciente a la más antigua. */
export function sessionsOf(sets: ASet[], exerciseId: string): (PerfSession & { sessionId: string })[] {
  const by = new Map<string, ASet[]>();
  for (const s of mainSets(sets)) if (s.exerciseId === exerciseId) (by.get(s.sessionId) ?? by.set(s.sessionId, []).get(s.sessionId)!).push(s);
  return [...by.entries()]
    .map(([sessionId, xs]) => ({ sessionId, date: xs[0].date, sets: xs.sort((a, b) => a.order - b.order) }))
    .sort((a, b) => b.date - a.date);
}

export interface ExPoint { date: number; label: string; maxWeight: number; totalReps: number; volume: number; avgRir: number | null; e1rm: number | null }
/** Serie temporal de un ejercicio (antigua → reciente) para los gráficos de progresión. */
export function exerciseSeries(sets: ASet[], exerciseId: string): ExPoint[] {
  return sessionsOf(sets, exerciseId).reverse().map((s) => {
    const rirs = s.sets.filter((x) => x.rir != null).map((x) => x.rir as number);
    const est = s.sets.map((x) => e1rm(x.weight, x.reps, x.rir)).filter((x): x is number => x != null);
    return {
      date: s.date,
      label: new Date(s.date).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }),
      maxWeight: Math.max(...s.sets.map((x) => x.weight)),
      totalReps: s.sets.reduce((a, x) => a + x.reps, 0),
      volume: Math.round(s.sets.reduce((a, x) => a + x.weight * x.reps, 0)),
      avgRir: rirs.length ? Math.round((rirs.reduce((a, b) => a + b, 0) / rirs.length) * 10) / 10 : null,
      e1rm: est.length ? Math.max(...est) : null,
    };
  });
}

export interface PR { exerciseId: string; name: string; weight: number; reps: number; date: number; e1rm: number | null; e1rmDate: number | null }
/** Récords personales por ejercicio: mayor carga levantada y mejor 1RM estimado. */
export function personalRecords(sets: ASet[], ex: ExMap): PR[] {
  const m = new Map<string, PR>();
  for (const s of sets) {
    const e = ex.get(s.exerciseId);
    if (!e || s.reps < 1) continue;
    const pr = m.get(e.id) ?? { exerciseId: e.id, name: e.name, weight: 0, reps: 0, date: 0, e1rm: null, e1rmDate: null };
    if (s.weight > pr.weight || (s.weight === pr.weight && s.reps > pr.reps)) { pr.weight = s.weight; pr.reps = s.reps; pr.date = s.date; }
    const est = e1rm(s.weight, s.reps, s.rir);
    if (est != null && (pr.e1rm == null || est > pr.e1rm)) { pr.e1rm = est; pr.e1rmDate = s.date; }
    m.set(e.id, pr);
  }
  return [...m.values()].sort((a, b) => b.date - a.date);
}
