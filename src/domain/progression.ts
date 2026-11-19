// MOTOR DE PROGRESIÓN (doble progresión con RIR).
//
// Función pura: recibe el historial de un ejercicio y devuelve una recomendación explicada.
// Principios (ver docs/EVIDENCIA.md):
//  - Entrenar más cerca del fallo se asocia con más hipertrofia, pero llegar al fallo no ha
//    demostrado ser superior a quedarse cerca, y cuesta más fatiga (Refalo 2023; Robinson 2024).
//  - El RIR es una estimación del usuario, con error típico de ~1 repetición y peor precisión
//    lejos del fallo y con muchas repeticiones (Halperin 2022). Por eso la confianza nunca es total.
//  - Los umbrales concretos (p. ej. −10 % en descarga) son ESTIMACIONES PRÁCTICAS, no valores
//    derivados de un estudio; se identifican como tales en el texto de la recomendación.

import { clamp, mean, roundTo, sum } from './calc';
import type { EndReason, ExType, Target } from './types';

export type Action = 'increase' | 'hold' | 'decrease' | 'hold_add_reps' | 'deload' | 'review_technique';

export const ACTION_LABEL: Record<Action, string> = {
  increase: 'SUBIR PESO',
  hold: 'MANTENER PESO',
  decrease: 'BAJAR PESO',
  hold_add_reps: 'MANTENER PESO Y AUMENTAR REPETICIONES',
  deload: 'REDUCIR INTENSIDAD TEMPORALMENTE',
  review_technique: 'REVISAR TÉCNICA O EJECUCIÓN',
};

export interface PerfSet { weight: number; reps: number; rir: number | null; failure: boolean; endReason: EndReason }
export interface PerfSession { date: number; sets: PerfSet[] }

export interface ProgInput {
  exType: ExType;
  increment: number;
  target: Target;
  /** Sesiones anteriores del ejercicio, la más reciente primero. Solo series completadas. */
  history: PerfSession[];
  /** Preparación percibida 0–100 (o null si no hay registros de recuperación). */
  readiness: number | null;
}

export interface Recommendation {
  action: Action;
  title: string;
  /** Peso sugerido para la próxima sesión (null si no hay base para sugerirlo). */
  weight: number | null;
  repGoal: string;
  reason: string;
  /** 0–1. Refleja cantidad y calidad de datos, no certeza sobre el estímulo muscular. */
  confidence: number;
  confidenceLabel: 'baja' | 'media' | 'alta';
  factors: string[];
  /** true si el umbral que decidió la recomendación es una estimación práctica. */
  practical: boolean;
}

/** Peso de trabajo de una sesión: el más repetido (ante empate, el mayor). */
export function workWeight(s: PerfSession): number {
  const count = new Map<number, number>();
  for (const x of s.sets) count.set(x.weight, (count.get(x.weight) ?? 0) + 1);
  let best = 0, n = 0;
  for (const [w, c] of count) if (c > n || (c === n && w > best)) { best = w; n = c; }
  return best;
}

const workSets = (s: PerfSession) => { const w = workWeight(s); return s.sets.filter((x) => x.weight === w); };
const isFail = (x: PerfSet) => x.failure || x.rir === 0;
const kg = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, '')} kg`;

export function recommend(input: ProgInput): Recommendation {
  const { exType, target, history, readiness } = input;
  const inc = input.increment > 0 ? input.increment : 2.5;
  const range = `${target.repMin}–${target.repMax}`;
  const rirGoal = target.rirMin === target.rirMax ? `${target.rirMin}` : `${target.rirMin}–${target.rirMax}`;
  const usable = history.filter((s) => s.sets.length > 0);

  if (usable.length === 0) {
    return finish({
      action: 'hold', weight: null, practical: true,
      repGoal: `${target.sets} × ${range} · RIR ${rirGoal}`,
      reason: `Aún no hay historial de este ejercicio. Elige una carga con la que puedas completar ${range} repeticiones terminando con RIR ${rirGoal}; desde la segunda sesión la recomendación se basará en tus datos.`,
      factors: ['Sin sesiones previas'],
    }, 0.2);
  }

  const last = usable[0];
  const prev = usable[1];
  const W = workWeight(last);
  const ws = workSets(last);
  const reps = ws.map((x) => x.reps);
  const rirs = ws.filter((x) => x.rir != null).map((x) => x.rir as number);
  const avgRir = rirs.length ? mean(rirs) : null;
  const complete = ws.length >= target.sets;
  const allTop = ws.every((x) => x.reps >= target.repMax);
  const belowMin = ws.filter((x) => x.reps < target.repMin).length;
  const firstBelow = ws[0].reps < target.repMin;
  const dropoff = reps.length > 1 && reps[0] > 0 ? (reps[0] - reps[reps.length - 1]) / reps[0] : 0;
  const justIncreased = !!prev && workWeight(prev) < W;
  const lowReadiness = readiness != null && readiness < 45;

  // Sesiones consecutivas con el mismo peso de trabajo (de la más reciente hacia atrás).
  const sameW: PerfSession[] = [];
  for (const s of usable) { if (workWeight(s) === W) sameW.push(s); else break; }
  const totals = sameW.map((s) => sum(workSets(s).slice(0, target.sets).map((x) => x.reps)));
  const declining = totals.length >= 3 && totals[0] < totals[1] && totals[1] <= totals[2];
  const stalled = totals.length >= 3 && totals[0] <= totals[1] && totals[0] <= totals[2];

  const recent2 = usable.slice(0, 2).flatMap(workSets);
  const failRate = recent2.length ? recent2.filter(isFail).length / recent2.length : 0;
  // Al fallo "sistemático". En multiarticulares se tolera menos por su mayor coste de fatiga (estimación práctica).
  const highFailure = failRate >= (exType === 'compound' ? 0.5 : 0.75);
  const techIssues = recent2.filter((x) => x.endReason === 'technical').length;

  const factors: string[] = [
    `Última sesión: ${kg(W)} × ${reps.join(', ')}`,
    avgRir != null ? `RIR medio declarado: ${avgRir.toFixed(1)} (objetivo ${rirGoal})` : 'RIR no registrado en la última sesión',
    `Rango objetivo: ${range} repeticiones`,
    W > 0 ? `Incremento mínimo disponible: ${kg(inc)} (${((inc / W) * 100).toFixed(0)} % de la carga)` : `Sin carga externa; incremento mínimo disponible: ${kg(inc)}`,
  ];
  if (dropoff >= 0.25) factors.push(`Caída de repeticiones entre series: ${(dropoff * 100).toFixed(0)} %`);
  if (failRate > 0) factors.push(`Series al fallo en las últimas 2 sesiones: ${(failRate * 100).toFixed(0)} %`);
  if (readiness != null) factors.push(`Recuperación percibida: ${Math.round(readiness)}/100`);
  if (sameW.length >= 2) factors.push(`${sameW.length} sesiones seguidas con ${kg(W)}`);

  // Confianza base: cuántos datos hay y qué tan fiables son.
  let conf = [0.4, 0.55, 0.7][Math.min(usable.length, 3) - 1];
  if (rirs.length < ws.length) conf -= 0.15;
  if (!complete) conf -= 0.1;
  if (mean(reps) > 12) conf -= 0.05; // el RIR se estima peor con muchas repeticiones
  if (avgRir != null && avgRir >= 4) conf -= 0.05; // …y lejos del fallo

  const base = { factors, repGoal: `${target.sets} × ${range} · RIR ${rirGoal}` };
  const lower = (pct: number) => {
    const w = roundTo(W * (1 - pct), inc);
    return w < W ? w : Math.max(0, roundTo(W - inc, inc));
  };

  // 1) Problemas técnicos repetidos: antes de tocar la carga, revisar ejecución.
  if (techIssues >= 2) {
    return finish({ ...base, action: 'review_technique', weight: W, practical: true,
      reason: `Marcaste fallo técnico en ${techIssues} series recientes. Mantén ${kg(W)} y prioriza una ejecución consistente (rango de movimiento y control) antes de progresar: sin técnica estable, las repeticiones no son comparables entre sesiones.` }, conf);
  }

  // 2) Rendimiento en descenso + señales de fatiga: descarga temporal.
  if (declining && (highFailure || lowReadiness)) {
    const why = [highFailure ? 'llegas al fallo con frecuencia' : '', lowReadiness ? 'tus registros de recuperación son bajos' : ''].filter(Boolean).join(' y ');
    return finish({ ...base, action: 'deload', weight: lower(0.1), practical: true,
      reason: `Tu rendimiento con ${kg(W)} ha bajado en las últimas sesiones y además ${why}. Esto es compatible con fatiga acumulada (no es un diagnóstico). Sugerencia: una o dos sesiones con ~10 % menos de carga y terminando a 3–4 RIR, y luego retomar. El porcentaje es una estimación práctica.` }, conf);
  }

  // 3) La primera serie no alcanza el mínimo del rango.
  if (firstBelow) {
    if (avgRir != null && avgRir > target.rirMax + 1) {
      return finish({ ...base, action: 'review_technique', weight: W, practical: false,
        reason: `No alcanzaste el mínimo de ${target.repMin} repeticiones, pero declaraste terminar lejos del fallo (RIR ${avgRir.toFixed(1)}). Los datos no cuadran: revisa si la serie se cortó por técnica, molestia o por una estimación de RIR optimista antes de cambiar la carga.` }, conf - 0.1);
    }
    if (justIncreased && prev) {
      const pw = workWeight(prev);
      const mid = roundTo(W - inc, inc);
      const w = mid > pw ? mid : pw;
      return finish({ ...base, action: 'decrease', weight: w, practical: false,
        reason: `Tras subir de ${kg(pw)} a ${kg(W)} no llegaste al mínimo del rango (${ws[0].reps} reps en la primera serie). El incremento fue demasiado grande para este ejercicio: ${w > pw ? `prueba un paso intermedio de ${kg(w)}` : `vuelve a ${kg(pw)} y gana 1–2 repeticiones más por serie antes de volver a subir`}.` }, conf + 0.1);
    }
    return finish({ ...base, action: 'decrease', weight: lower(0.05), practical: true,
      reason: `Con ${kg(W)} quedaste bajo el rango objetivo desde la primera serie (${ws[0].reps} reps) y cerca del fallo. La carga es alta para trabajar en ${range}: bájala un paso y reconstruye repeticiones.` }, conf + 0.05);
  }

  // 4) Todas las series en el tope del rango.
  if (allTop && complete) {
    if (avgRir != null && avgRir < target.rirMin - 0.5) {
      return finish({ ...base, action: 'hold', weight: W, practical: false,
        reason: `Llegaste al tope del rango, pero más cerca del fallo que tu objetivo (RIR ${avgRir.toFixed(1)} frente a ${rirGoal}). Repite ${kg(W)} hasta lograr las mismas repeticiones con el RIR objetivo; subir ahora probablemente te saque del rango.` }, conf);
    }
    if (W === 0) {
      // Sin carga externa (peso corporal): primero repeticiones, después lastre.
      if (Math.min(...reps) < target.repMax + 2) {
        return finish({ ...base, action: 'hold_add_reps', weight: 0, practical: true,
          repGoal: `${target.sets} × ${target.repMax + 2} antes de añadir carga`,
          reason: `Completaste el rango sin carga externa. Antes de añadir lastre, supera el tope en 2 repeticiones por serie; después añade ${kg(inc)} y vuelve a la parte baja del rango.` }, conf);
      }
      return finish({ ...base, action: 'increase', weight: inc, practical: true,
        reason: `Superas con holgura el tope del rango sin carga externa. Añade ${kg(inc)} de lastre (o pasa a una variante más difícil) y vuelve a la parte baja del rango.` }, conf);
    }
    const rel = inc / W;
    if (rel > 0.1 && Math.min(...reps) < target.repMax + 2 && (avgRir == null || avgRir < target.rirMax + 1)) {
      return finish({ ...base, action: 'hold_add_reps', weight: W, practical: true,
        repGoal: `${target.sets} × ${target.repMax + 2} antes de subir`,
        reason: `Completaste el rango, pero el salto mínimo disponible (+${kg(inc)}) equivale a un ${(rel * 100).toFixed(0)} % de la carga, bastante para este ejercicio. Supera el tope en 2 repeticiones por serie con ${kg(W)} y luego sube; así es más probable que sigas dentro del rango.` }, conf);
    }
    const w = roundTo(W + inc, inc);
    const note = lowReadiness ? ' Tus registros de recuperación recientes son bajos: si hoy te sientes igual, mantener la carga una sesión más también es razonable.' : '';
    return finish({ ...base, action: 'increase', weight: w, practical: false,
      reason: `Excelente progresión. Alcanzaste el límite superior del rango (${target.repMax} reps) en todas las series${avgRir != null ? ` manteniendo una proximidad adecuada al fallo (RIR ${avgRir.toFixed(1)})` : ''}. Sube a ${kg(w)} y espera volver a la parte baja del rango.${note}` },
      conf + (avgRir != null ? 0.1 : 0) - (lowReadiness ? 0.15 : 0));
  }
  if (allTop && !complete) {
    return finish({ ...base, action: 'hold', weight: W, practical: false,
      reason: `Llegaste al tope del rango, pero registraste ${ws.length} de ${target.sets} series. Completa todas las series con ${kg(W)} antes de subir.` }, conf);
  }

  // 5) En rango pero lejos del fallo: hay margen.
  if (avgRir != null && avgRir > target.rirMax + 1.5 && belowMin === 0) {
    if (ws.every((x) => x.reps >= target.repMax - 1)) {
      const w = roundTo(W + inc, inc);
      return finish({ ...base, action: 'increase', weight: w, practical: false,
        reason: `Estás prácticamente en el tope del rango y declaras quedar lejos del fallo (RIR ${avgRir.toFixed(1)}). La carga quedó liviana: sube a ${kg(w)}.` }, conf);
    }
    return finish({ ...base, action: 'hold_add_reps', weight: W, practical: false,
      reason: `Terminaste lejos del fallo (RIR ${avgRir.toFixed(1)}, objetivo ${rirGoal}). Mantén ${kg(W)} y continúa cada serie hasta acercarte al RIR objetivo: probablemente tengas varias repeticiones disponibles.` }, conf);
  }

  // 6) Series posteriores bajo el mínimo.
  if (belowMin > 0) {
    if (justIncreased) {
      return finish({ ...base, action: 'hold_add_reps', weight: W, practical: false,
        reason: `Acabas de subir la carga y las últimas series quedaron bajo ${target.repMin} repeticiones; es esperable. Mantén ${kg(W)} y busca sumar repeticiones hasta que todas las series entren en el rango.` }, conf);
    }
    if (dropoff > 0.35) {
      return finish({ ...base, action: 'hold', weight: W, practical: true,
        reason: `Las repeticiones caen un ${(dropoff * 100).toFixed(0)} % entre la primera y la última serie. Mantén ${kg(W)} y prueba descansar más entre series o dejar 1 repetición extra en reserva en las primeras; ambas cosas suelen sostener mejor el rendimiento.` }, conf);
    }
    return finish({ ...base, action: 'hold_add_reps', weight: W, practical: false,
      reason: `${belowMin} serie(s) quedaron bajo el mínimo del rango. Mantén ${kg(W)} y trabaja para que todas alcancen al menos ${target.repMin} repeticiones.` }, conf);
  }

  // 7) Estancamiento con la misma carga.
  if (stalled) {
    if (highFailure || lowReadiness) {
      return finish({ ...base, action: 'deload', weight: lower(0.1), practical: true,
        reason: `Llevas ${sameW.length} sesiones con ${kg(W)} sin sumar repeticiones y ${highFailure ? 'con muchas series al fallo' : 'con recuperación baja'}. Una reducción temporal (~10 % menos, 3–4 RIR) puede ayudarte a retomar. Es una estimación práctica, no un diagnóstico.` }, conf);
    }
    return finish({ ...base, action: 'hold_add_reps', weight: W, practical: true,
      reason: `Llevas ${sameW.length} sesiones con ${kg(W)} sin sumar repeticiones. Mantén la carga y busca solo +1 repetición en una serie. Si sigue igual, revisa descanso entre series, orden del ejercicio en la rutina y recuperación.` }, conf - 0.1);
  }

  // 8) Caso general de doble progresión: dentro del rango, aún sin tope.
  const pending = ws.filter((x) => x.reps < target.repMax).length;
  return finish({ ...base, action: 'hold_add_reps', weight: W, practical: false,
    reason: `Estás dentro del rango (${reps.join(', ')}) pero aún no alcanzas ${target.repMax} repeticiones en ${pending} serie(s). Mantén ${kg(W)} e intenta sumar 1 repetición en esas series con RIR ${rirGoal}. Cuando todas lleguen a ${target.repMax}, sube la carga.` }, conf);
}

function finish(r: Omit<Recommendation, 'title' | 'confidence' | 'confidenceLabel'>, conf: number): Recommendation {
  const confidence = clamp(Math.round(conf * 100) / 100, 0.15, 0.9);
  return { ...r, title: ACTION_LABEL[r.action], confidence, confidenceLabel: confidence < 0.45 ? 'baja' : confidence < 0.7 ? 'media' : 'alta' };
}

/** Tendencia de un ejercicio comparando el e1RM estimado de las sesiones recientes con las anteriores. */
export type Trend = 'improving' | 'stalled' | 'declining' | 'insufficient';
export function trendOf(bestPerSession: number[]): { trend: Trend; pct: number } {
  // bestPerSession: de la más reciente a la más antigua.
  const xs = bestPerSession.filter((x) => x > 0);
  if (xs.length < 3) return { trend: 'insufficient', pct: 0 };
  const recent = mean(xs.slice(0, 2));
  const older = mean(xs.slice(2, 5));
  const pct = older > 0 ? ((recent - older) / older) * 100 : 0;
  return { trend: pct > 2 ? 'improving' : pct < -2 ? 'declining' : 'stalled', pct };
}
