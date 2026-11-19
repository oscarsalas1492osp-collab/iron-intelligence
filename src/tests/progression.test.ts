import { describe, expect, it } from 'vitest';
import { e1rm, intensityOf, roundTo, rpeFromRir, weekStart } from '../domain/calc';
import { recommend, trendOf, workWeight, type PerfSession, type ProgInput } from '../domain/progression';
import type { Target } from '../domain/types';

const T: Target = { sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, restSec: 120 };
const ses = (date: number, w: number, reps: number[], rirs: (number | null)[], extra: Partial<PerfSession['sets'][0]> = {}): PerfSession => ({
  date, sets: reps.map((r, i) => ({ weight: w, reps: r, rir: rirs[i] ?? null, failure: rirs[i] === 0, endReason: 'none', ...extra })),
});
const run = (history: PerfSession[], over: Partial<ProgInput> = {}) => recommend({ exType: 'compound', increment: 2.5, target: T, history, readiness: null, ...over });

describe('motor de progresión', () => {
  it('sin historial no inventa un peso y declara baja confianza', () => {
    const r = run([]);
    expect(r.weight).toBeNull();
    expect(r.confidenceLabel).toBe('baja');
  });

  it('ejemplo de la especificación: tope del rango con RIR adecuado → subir peso', () => {
    const r = run([ses(2, 50, [12, 12, 12], [2, 2, 1]), ses(1, 50, [12, 12, 11], [2, 1, 1])]);
    expect(r.action).toBe('increase');
    expect(r.weight).toBe(52.5);
    expect(r.reason).toMatch(/límite superior/);
  });

  it('dentro del rango sin llegar al tope → mantener y sumar repeticiones', () => {
    const r = run([ses(1, 50, [12, 11, 10], [2, 1, 1])]);
    expect(r.action).toBe('hold_add_reps');
    expect(r.weight).toBe(50);
  });

  it('tope alcanzado solo yendo al fallo (bajo el RIR objetivo) → mantener', () => {
    const r = run([ses(1, 50, [12, 12, 12], [0, 0, 0])]);
    expect(r.action).toBe('hold');
  });

  it('tras subir no alcanza el mínimo → el incremento fue excesivo, paso intermedio o volver', () => {
    const r = run([ses(2, 60, [6, 5, 5], [1, 0, 0]), ses(1, 50, [12, 12, 12], [2, 2, 1])], { increment: 2.5 });
    expect(r.action).toBe('decrease');
    expect(r.weight).toBe(57.5);
    expect(r.reason).toMatch(/demasiado grande/);
    const back = run([ses(2, 55, [6, 5, 5], [1, 0, 0]), ses(1, 50, [12, 12, 12], [2, 2, 1])], { increment: 5 });
    expect(back.weight).toBe(50);
  });

  it('no alcanza el mínimo y termina lejos del fallo → revisar, no bajar a ciegas', () => {
    const r = run([ses(1, 50, [6, 6, 6], [4, 4, 4])]);
    expect(r.action).toBe('review_technique');
  });

  it('no alcanza el mínimo cerca del fallo sin haber subido → bajar peso', () => {
    const r = run([ses(1, 50, [6, 5, 5], [1, 0, 0])]);
    expect(r.action).toBe('decrease');
    expect(r.weight).toBeLessThan(50);
  });

  it('salto mínimo grande respecto de la carga → primero superar el tope', () => {
    const iso: Target = { sets: 3, repMin: 10, repMax: 15, rirMin: 0, rirMax: 2, restSec: 90 };
    const r = run([ses(1, 10, [15, 15, 15], [1, 1, 1])], { exType: 'isolation', increment: 2.5, target: iso });
    expect(r.action).toBe('hold_add_reps');
    const ok = run([ses(1, 10, [17, 17, 17], [1, 1, 1])], { exType: 'isolation', increment: 2.5, target: iso });
    expect(ok.action).toBe('increase');
    expect(ok.weight).toBe(12.5);
  });

  it('fallo sistemático con rendimiento en descenso → reducir intensidad temporalmente', () => {
    const r = run([ses(3, 50, [9, 8, 8], [0, 0, 0]), ses(2, 50, [10, 9, 8], [0, 0, 0]), ses(1, 50, [11, 10, 9], [1, 0, 0])]);
    expect(r.action).toBe('deload');
    expect(r.weight).toBe(45);
    expect(r.practical).toBe(true);
    expect(r.reason).toMatch(/no es un diagnóstico/);
  });

  it('descenso sin fallo ni mala recuperación no dispara una descarga', () => {
    const r = run([ses(3, 50, [10, 9, 8], [2, 2, 1]), ses(2, 50, [10, 9, 9], [2, 2, 1]), ses(1, 50, [10, 10, 9], [2, 2, 1])]);
    expect(r.action).not.toBe('deload');
  });

  it('fallo técnico repetido → revisar técnica', () => {
    const r = run([ses(1, 50, [10, 9, 8], [1, 1, 1], { endReason: 'technical' })]);
    expect(r.action).toBe('review_technique');
  });

  it('series incompletas en el tope → completar antes de subir', () => {
    const r = run([ses(1, 50, [12, 12], [2, 2])]);
    expect(r.action).toBe('hold');
  });

  it('la confianza crece con más sesiones y baja sin RIR', () => {
    const one = run([ses(1, 50, [10, 10, 9], [2, 2, 1])]);
    const three = run([ses(3, 50, [11, 10, 10], [2, 2, 1]), ses(2, 50, [10, 10, 10], [2, 2, 1]), ses(1, 50, [10, 10, 9], [2, 2, 1])]);
    const noRir = run([ses(1, 50, [10, 10, 9], [null, null, null])]);
    expect(three.confidence).toBeGreaterThan(one.confidence);
    expect(noRir.confidence).toBeLessThan(one.confidence);
    expect(three.confidence).toBeLessThanOrEqual(0.9);
  });

  it('recuperación baja reduce la confianza de una subida y lo explica', () => {
    const h = [ses(2, 50, [12, 12, 12], [2, 2, 1]), ses(1, 50, [12, 12, 11], [2, 1, 1])];
    const low = run(h, { readiness: 30 });
    expect(low.action).toBe('increase');
    expect(low.confidence).toBeLessThan(run(h).confidence);
    expect(low.reason).toMatch(/recuperación/);
  });

  it('usa el peso más repetido como peso de trabajo (ignora series de aproximación)', () => {
    const s: PerfSession = { date: 1, sets: [{ weight: 30, reps: 12, rir: 5, failure: false, endReason: 'none' }, ...ses(1, 50, [10, 9, 9], [2, 1, 1]).sets] };
    expect(workWeight(s)).toBe(50);
  });
});

describe('cálculos', () => {
  it('1RM estimado usa reps + RIR y se anula fuera de rango', () => {
    expect(e1rm(100, 1, 0)).toBe(100);
    expect(e1rm(100, 5, 0)).toBeCloseTo(116.7, 1);
    expect(e1rm(100, 5, 2)).toBeGreaterThan(e1rm(100, 5, 0)!);
    expect(e1rm(40, 20, 0)).toBeNull();
    expect(e1rm(0, 10, 0)).toBeNull();
  });
  it('redondeo al incremento, RPE e intensidad', () => {
    expect(roundTo(47.6, 2.5)).toBe(47.5);
    expect(rpeFromRir(2)).toBe(8);
    expect(rpeFromRir(null)).toBeNull();
    expect(intensityOf(0).label).toBe('Fallo muscular reportado');
    expect(intensityOf(2).label).toBe('Proximidad elevada al fallo');
  });
  it('la semana empieza el lunes', () => {
    const wed = new Date(2026, 10, 18, 15).getTime();
    expect(new Date(weekStart(wed)).getDay()).toBe(1);
    expect(new Date(weekStart(wed)).getDate()).toBe(16);
  });
  it('tendencia: mejora, estancamiento y datos insuficientes', () => {
    expect(trendOf([110, 108, 100, 100]).trend).toBe('improving');
    expect(trendOf([100, 100, 100, 100]).trend).toBe('stalled');
    expect(trendOf([90, 92, 100, 100]).trend).toBe('declining');
    expect(trendOf([100, 90]).trend).toBe('insufficient');
  });
});
