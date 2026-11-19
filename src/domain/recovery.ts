// Recuperación y fatiga: contexto para las recomendaciones.
// El puntaje de "preparación" es una ESTIMACIÓN PRÁCTICA a partir de lo que el usuario declara
// (sueño, fatiga, dolor muscular, estrés, motivación). No es una medición fisiológica ni un diagnóstico.

import { DAY, clamp, e1rm, mean, weekStart } from './calc';
import { trendOf } from './progression';
import type { RecoveryLog } from './types';
import { sessionsOf, type ASet } from './volume';

export function readinessOf(log: RecoveryLog): number {
  const sleep = clamp((log.sleepHours - 5) / 3, 0, 1); // 5 h → 0, 8 h o más → 1
  const up = (v: number) => (clamp(v, 1, 5) - 1) / 4;
  const down = (v: number) => 1 - up(v);
  const score = sleep * 0.25 + up(log.sleepQuality) * 0.2 + down(log.fatigue) * 0.2 + down(log.soreness) * 0.15 + down(log.stress) * 0.1 + up(log.motivation) * 0.1;
  return Math.round(score * 100);
}

/** Promedio de los registros de los últimos 4 días (máx. 3). null si no hay registros recientes. */
export function recentReadiness(logs: RecoveryLog[], now: number): number | null {
  const recent = logs
    .filter((l) => now - new Date(l.date + 'T12:00:00').getTime() < 4 * DAY)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  return recent.length ? Math.round(mean(recent.map(readinessOf))) : null;
}

export interface FatigueStatus { level: 'sin_datos' | 'ok' | 'atencion' | 'alta'; label: string; reasons: string[]; readiness: number | null }

/** Combina recuperación declarada, tendencia de rendimiento y frecuencia de fallo. */
export function fatigueStatus(sets: ASet[], logs: RecoveryLog[], now: number): FatigueStatus {
  const readiness = recentReadiness(logs, now);
  const recent = sets.filter((s) => now - s.date < 21 * DAY);
  const ids = [...new Set(recent.map((s) => s.exerciseId))];
  let declining = 0, tracked = 0;
  for (const id of ids) {
    const best = sessionsOf(sets, id).map((s) => Math.max(0, ...s.sets.map((x) => e1rm(x.weight, x.reps, x.rir) ?? 0)));
    const t = trendOf(best);
    if (t.trend !== 'insufficient') { tracked++; if (t.trend === 'declining') declining++; }
  }
  const week = sets.filter((s) => s.date >= weekStart(now));
  const withRir = week.filter((s) => s.rir != null);
  const failShare = withRir.length ? withRir.filter((s) => (s.rir as number) < 0.75 || s.failure).length / withRir.length : 0;

  const reasons: string[] = [];
  let pts = 0;
  if (readiness != null && readiness < 45) { pts += 2; reasons.push(`Recuperación percibida baja (${readiness}/100)`); }
  else if (readiness != null && readiness < 60) { pts += 1; reasons.push(`Recuperación percibida moderada (${readiness}/100)`); }
  if (tracked >= 2 && declining / tracked >= 0.5) { pts += 2; reasons.push(`${declining} de ${tracked} ejercicios con rendimiento estimado a la baja`); }
  else if (declining > 0) { pts += 1; reasons.push(`${declining} ejercicio(s) con rendimiento estimado a la baja`); }
  if (withRir.length >= 6 && failShare >= 0.5) { pts += 1; reasons.push(`${Math.round(failShare * 100)} % de las series de esta semana al fallo`); }

  if (readiness == null && tracked === 0) return { level: 'sin_datos', label: 'Sin datos suficientes', reasons: ['Registra tu recuperación y al menos 3 sesiones por ejercicio para ver este indicador.'], readiness };
  if (pts >= 4) return { level: 'alta', label: 'Señales de fatiga acumulada', reasons, readiness };
  if (pts >= 2) return { level: 'atencion', label: 'Atención a la recuperación', reasons, readiness };
  return { level: 'ok', label: 'Sin señales de fatiga excesiva', reasons: reasons.length ? reasons : ['Rendimiento y recuperación declarada dentro de lo esperable.'], readiness };
}

export const LEVEL_COLOR = { sin_datos: '#8b919c', ok: '#2fd17a', atencion: '#f5c542', alta: '#ff6a1a' } as const;
