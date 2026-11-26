// Progreso: cuánto cambió el 1RM estimado de cada ejercicio y, desde ahí, el de cada grupo muscular.
// El 1RM estimado es una fórmula, no una medición: sirve para comparar a la misma persona en el tiempo.
import { e1rm } from './calc';
import type { ExerciseDef, Muscle } from './types';
import { sessionsOf, type ASet } from './volume';

export interface ExProgress { id: string; name: string; muscle: Muscle; from: number; to: number; pct: number; sessions: number }
export interface MuscleProgress { muscle: Muscle; pct: number; exercises: number; sessions: number }

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Compara el comienzo con lo más reciente dentro de las series entregadas. Con 4 sesiones o más se promedian
 * las dos primeras y las dos últimas, para que una sola sesión buena o mala no decida el resultado.
 * Los ejercicios con menos de 2 sesiones medibles no aparecen.
 */
export function exerciseProgress(sets: ASet[], ex: Map<string, ExerciseDef>): ExProgress[] {
  const out: ExProgress[] = [];
  for (const id of new Set(sets.map((s) => s.exerciseId))) {
    const def = ex.get(id);
    if (!def) continue;
    // sessionsOf entrega de la más reciente a la más antigua: se invierte para leer en orden.
    const best = sessionsOf(sets, id).map((s) => Math.max(0, ...s.sets.map((x) => e1rm(x.weight, x.reps, x.rir) ?? 0))).filter((v) => v > 0).reverse();
    if (best.length < 2) continue;
    const k = best.length >= 4 ? 2 : 1;
    const from = mean(best.slice(0, k)), to = mean(best.slice(-k));
    out.push({ id, name: def.name, muscle: def.primary, from: Math.round(from * 10) / 10, to: Math.round(to * 10) / 10, pct: Math.round(((to - from) / from) * 1000) / 10 + 0, sessions: best.length });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

/** Promedio del cambio de los ejercicios cuyo músculo principal es ese grupo, ponderado por sus sesiones. */
export function muscleProgress(list: ExProgress[]): MuscleProgress[] {
  const by = new Map<Muscle, ExProgress[]>();
  for (const p of list) (by.get(p.muscle) ?? by.set(p.muscle, []).get(p.muscle)!).push(p);
  return [...by.entries()].map(([muscle, xs]) => {
    const w = xs.reduce((a, x) => a + x.sessions, 0);
    return { muscle, pct: Math.round((xs.reduce((a, x) => a + x.pct * x.sessions, 0) / w) * 10) / 10, exercises: xs.length, sessions: w };
  }).sort((a, b) => b.pct - a.pct);
}

/** Subió, bajó o se mantuvo: menos de 1 % en cualquier dirección se lee como estable. */
export const progressState = (pct: number): 'up' | 'down' | 'flat' => (pct >= 1 ? 'up' : pct <= -1 ? 'down' : 'flat');
export const PROGRESS_COLOR = { up: '#34e0a1', down: '#ff6a1a', flat: '#949fb8' } as const;
export const fmtPct = (pct: number) => `${pct > 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')} %`;
