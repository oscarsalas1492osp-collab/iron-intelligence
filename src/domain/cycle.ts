// Ciclo de entrenamiento (mesociclo): las semanas de trabajo se acercan al fallo de forma gradual y la última,
// si se elige, es de descarga. Los ajustes (mitad de series, −10 % de carga, 2 repeticiones más en reserva)
// son convenciones prácticas de programación, no valores derivados de un estudio.
import { DAY, weekStart } from './calc';
import type { Cycle, Target } from './types';

export const DELOAD_TAG = '#descarga';
export interface CycleInfo { week: number; of: number; deload: boolean; round: number; label: string }

export function cycleInfo(c: Cycle | null | undefined, now = Date.now()): CycleInfo | null {
  if (!c || !(c.weeks >= 3)) return null;
  const start = weekStart(new Date(`${c.start}T12:00:00`).getTime());
  if (Number.isNaN(start)) return null;
  const n = Math.round((weekStart(now) - start) / (7 * DAY));
  if (n < 0) return null;
  const week = (n % c.weeks) + 1;
  const deload = c.deload && week === c.weeks;
  return { week, of: c.weeks, deload, round: Math.floor(n / c.weeks) + 1, label: deload ? `Semana ${week} de ${c.weeks}: descarga` : `Semana ${week} de ${c.weeks}` };
}

/** Objetivo del día según la semana del ciclo. Sin ciclo, el objetivo queda igual. */
export function cycleTarget(t: Target, info: CycleInfo | null, hasDeload = true): Target {
  if (!info) return t;
  if (info.deload) return { ...t, sets: Math.max(1, Math.ceil(t.sets / 2)), rirMin: Math.min(10, t.rirMin + 2), rirMax: Math.min(10, t.rirMax + 2) };
  if (t.rirMin === t.rirMax) return t;
  const workWeeks = info.of - (hasDeload ? 1 : 0);
  const p = workWeeks > 1 ? Math.min(1, (info.week - 1) / (workWeeks - 1)) : 1;
  const rir = Math.round(t.rirMax - p * (t.rirMax - t.rirMin));
  return { ...t, rirMin: rir, rirMax: rir };
}

/** Carga de la semana de descarga. */
export const deloadWeight = (w: number) => w * 0.9;
