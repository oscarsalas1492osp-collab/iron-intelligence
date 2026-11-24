// Progreso por ejercicio y por músculo, y plan de bienvenida.
import { describe, expect, it } from 'vitest';
import { LIBRARY } from '../domain/exerciseLibrary';
import { exerciseProgress, muscleProgress, progressState } from '../domain/progress';
import type { ASet } from '../domain/volume';
import { planDeBienvenida } from '../ui/welcome';

const ex = new Map(LIBRARY.map((e) => [e.id, e]));
const pecho = LIBRARY.find((e) => e.primary === 'chest' && e.type === 'compound')!;
const pecho2 = LIBRARY.find((e) => e.primary === 'chest' && e.id !== pecho.id)!;
const set = (exerciseId: string, n: number, weight: number, reps = 8): ASet => ({ sessionId: `s${n}-${exerciseId}`, exerciseId, date: n * 86400000, order: 0, weight, reps, rir: 2, failure: false, endReason: 'none' });

describe('progreso', () => {
  it('con una sola sesión no hay progreso que mostrar', () => {
    expect(exerciseProgress([set(pecho.id, 1, 80)], ex)).toEqual([]);
  });
  it('compara la primera sesión con la última', () => {
    const [p] = exerciseProgress([set(pecho.id, 1, 80), set(pecho.id, 2, 88)], ex);
    expect(p.pct).toBeCloseTo(10, 0); expect(p.sessions).toBe(2); expect(p.muscle).toBe('chest');
    expect(p.to).toBeGreaterThan(p.from);
  });
  it('con 4 sesiones o más promedia las dos primeras y las dos últimas', () => {
    const [p] = exerciseProgress([set(pecho.id, 1, 80), set(pecho.id, 2, 80), set(pecho.id, 3, 100), set(pecho.id, 4, 60)], ex);
    expect(p.pct).toBe(0);
    expect(progressState(p.pct)).toBe('flat');
  });
  it('el músculo promedia sus ejercicios según cuántas sesiones tiene cada uno', () => {
    const list = exerciseProgress([set(pecho.id, 1, 100), set(pecho.id, 2, 110), set(pecho2.id, 1, 50), set(pecho2.id, 2, 50), set(pecho2.id, 3, 50)], ex);
    const [m] = muscleProgress(list);
    expect(m.muscle).toBe('chest'); expect(m.exercises).toBe(2);
    expect(m.pct).toBeCloseTo(4, 0); // (10 × 2 + 0 × 3) / 5
  });
  it('una caída se lee como caída', () => {
    const [p] = exerciseProgress([set(pecho.id, 1, 100), set(pecho.id, 2, 90)], ex);
    expect(progressState(p.pct)).toBe('down');
  });
});

describe('plan de bienvenida', () => {
  it('arma una rutina por cada bloque del reparto y respeta el equipo', () => {
    const plan = planDeBienvenida({ goal: 'hypertrophy', days: 4, experience: 'beginner', equipment: ['dumbbell', 'band', 'bodyweight'] }, LIBRARY);
    expect(plan.routines.length).toBe(4);
    for (const r of plan.routines) expect(r.exercises.length).toBeGreaterThan(3);
  });
  it('con objetivo de fuerza, los ejercicios compuestos bajan a 4–6 repeticiones', () => {
    const plan = planDeBienvenida({ goal: 'strength', days: 3, experience: 'intermediate', equipment: [] }, LIBRARY);
    const comp = plan.routines.flatMap((r) => r.exercises).filter(([id]) => ex.get(id)?.type === 'compound');
    expect(comp.length).toBeGreaterThan(0);
    for (const [, t] of comp) { expect(t.repMin).toBe(4); expect(t.repMax).toBe(6); }
    const ais = plan.routines.flatMap((r) => r.exercises).filter(([id]) => ex.get(id)?.type === 'isolation');
    for (const [, t] of ais) expect(t.repMax).not.toBe(6);
  });
});
