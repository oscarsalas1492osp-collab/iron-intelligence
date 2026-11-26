// Lo que trabaja una rutina: músculos, colores de la figura, texto del foco y duración aproximada.
import { describe, expect, it } from 'vitest';
import { LIBRARY } from '../domain/exerciseLibrary';
import { focusText, routineMinutes, routineMuscles, routineTones, SECONDARY_TONE } from '../domain/routineMap';

const ex = new Map(LIBRARY.map((e) => [e.id, e]));
const find = (p: (e: (typeof LIBRARY)[number]) => boolean) => LIBRARY.find(p)!;
const banca = find((e) => e.primary === 'chest' && e.secondary.includes('triceps') && e.measure === 'reps');
const remo = find((e) => e.primary === 'back' && e.measure === 'reps');
const curl = find((e) => e.primary === 'biceps' && e.measure === 'reps');
const item = (exerciseId: string, sets: number, extra: Record<string, unknown> = {}) => ({ exerciseId, sets, superset: null, repMin: 8, repMax: 12, restSec: 120, ...extra });

describe('músculos de una rutina', () => {
  it('suma series directas al principal e indirectas a los secundarios', () => {
    const list = routineMuscles([item(banca.id, 4), item(curl.id, 3)], ex);
    const pecho = list.find((m) => m.muscle === 'chest')!, tri = list.find((m) => m.muscle === 'triceps')!;
    expect(pecho.direct).toBe(4); expect(pecho.indirect).toBe(0);
    expect(tri.direct).toBe(0); expect(tri.indirect).toBe(4); expect(tri.score).toBe(2);
    expect(list[0].muscle).toBe('chest');
  });
  it('ignora ejercicios borrados y ejercicios sin series', () => {
    expect(routineMuscles([item('no-existe', 3), item(banca.id, 0)], ex)).toEqual([]);
  });
  it('el foco nombra hasta tres músculos con series directas', () => {
    const list = routineMuscles([item(banca.id, 4), item(remo.id, 4), item(curl.id, 2)], ex);
    expect(focusText(list)).toBe('Pecho, espalda y bíceps');
    expect(focusText(list, 1)).toBe('Pecho');
    expect(focusText([])).toBe('');
  });
  it('lo directo va en brasa y lo solo secundario en rojo apagado', () => {
    const tones = routineTones(routineMuscles([item(banca.id, 4)], ex));
    expect(tones.chest?.color).not.toBe(SECONDARY_TONE.color);
    expect(tones.triceps).toEqual(SECONDARY_TONE);
    expect(tones.quads).toBeUndefined();
  });
});

describe('duración aproximada', () => {
  it('cuenta trabajo, descanso y preparación, redondeado a 5 minutos', () => {
    // 4 series × (30 s + 120 s) + 60 s = 660 s → 11 min → 10
    expect(routineMinutes([item(banca.id, 4)], ex)).toBe(10);
  });
  it('una biserie descansa una vez por vuelta, así que dura menos que lo mismo por separado', () => {
    const sueltos = [item(banca.id, 4), item(remo.id, 4)];
    const biserie = [item(banca.id, 4, { superset: "a" }), item(remo.id, 4, { superset: "a" })];
    expect(routineMinutes(biserie, ex)).toBeLessThan(routineMinutes(sueltos, ex));
  });
  it('sin ejercicios no hay duración', () => {
    expect(routineMinutes([], ex)).toBe(0);
  });
});
