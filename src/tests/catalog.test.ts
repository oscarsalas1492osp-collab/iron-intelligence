import { describe, expect, it } from 'vitest';
import { LIBRARY, mergeExercises } from '../domain/exerciseLibrary';
import { MACHINES } from '../domain/catalog/machines';
import { EQUIPMENT, MUSCLES, unitText } from '../domain/muscles';
import { defaultTarget } from '../domain/types';
import { schemas } from '../domain/validation';
import { norm } from '../domain/muscles';

describe('catálogo de ejercicios', () => {
  it('tiene ids únicos y nombres únicos', () => {
    const ids = LIBRARY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = LIBRARY.map((e) => norm(e.name));
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dup).toEqual([]);
  });

  it('cada ejercicio es válido y completo', () => {
    for (const e of LIBRARY) {
      expect(MUSCLES, e.id).toContain(e.primary);
      expect(EQUIPMENT, e.id).toContain(e.equipment);
      for (const m of e.secondary) expect(MUSCLES, e.id).toContain(m);
      expect(e.secondary, e.id).not.toContain(e.primary);
      expect(new Set(e.secondary).size, e.id).toBe(e.secondary.length);
      expect(e.cues.length, e.id).toBeGreaterThan(0);
      expect(e.mistakes.length, e.id).toBeGreaterThan(0);
      expect(e.rom.length, e.id).toBeGreaterThan(10);
      expect(e.safety.length, e.id).toBeGreaterThan(10);
      expect(e.increment, e.id).toBeGreaterThan(0);
      const { id, ...fields } = e;
      const row = { ...fields, id, userId: 'u', updatedAt: 1, deleted: 0, dirty: 0, baseId: null };
      expect(schemas.exercises.safeParse(row).success, e.id).toBe(true);
    }
  });

  it('cubre todos los grupos musculares e implementos', () => {
    for (const m of MUSCLES) expect(LIBRARY.filter((e) => e.primary === m).length, m).toBeGreaterThanOrEqual(3);
    for (const q of EQUIPMENT) expect(LIBRARY.filter((e) => e.equipment === q).length, q).toBeGreaterThanOrEqual(3);
    expect(LIBRARY.length).toBeGreaterThanOrEqual(400);
  });

  it('las máquinas referencian ejercicios e implementos que existen', () => {
    const ids = new Set(LIBRARY.map((e) => e.id));
    const mids = MACHINES.map((m) => m.id);
    expect(new Set(mids).size).toBe(mids.length);
    for (const m of MACHINES) {
      for (const id of m.ex) expect(ids.has(id), `${m.id} → ${id}`).toBe(true);
      for (const mu of m.muscles) expect(MUSCLES, m.id).toContain(mu);
      if (m.eq) expect(EQUIPMENT, m.id).toContain(m.eq);
      expect(m.note.length, m.id).toBeGreaterThan(20);
    }
  });

  it('los ejercicios por tiempo o distancia reciben un objetivo acorde', () => {
    const plank = LIBRARY.find((e) => e.id === 'plank')!;
    expect(plank.measure).toBe('time');
    expect(defaultTarget(plank)).toMatchObject({ repMin: 30, repMax: 60 });
    const carry = LIBRARY.find((e) => e.id === 'farmer_walk')!;
    expect(carry.measure).toBe('distance');
    expect(defaultTarget(carry)).toMatchObject({ repMin: 20, repMax: 40 });
    const clean = LIBRARY.find((e) => e.id === 'power_clean')!;
    expect(clean.category).toBe('power');
    expect(defaultTarget(clean).repMax).toBeLessThanOrEqual(5);
    expect(defaultTarget(LIBRARY.find((e) => e.id === 'bench_press')!)).toMatchObject({ repMin: 8, repMax: 12 });
  });

  it('adapta los textos a segundos y metros', () => {
    expect(unitText('Suma 2 repeticiones (8 reps)', 'time')).toBe('Suma 2 segundos (8 s)');
    expect(unitText('MANTENER PESO Y AUMENTAR REPETICIONES', 'distance')).toBe('MANTENER PESO Y AUMENTAR METROS');
    expect(unitText('+1 repetición', 'reps')).toBe('+1 repetición');
  });

  it('un ajuste del usuario sobre la biblioteca conserva los datos vigentes del catálogo', () => {
    // Fila guardada con la versión anterior de la biblioteca: sin campos nuevos y con músculos antiguos.
    const old = { id: 'r1', userId: 'u', updatedAt: 1, deleted: 0, dirty: 0, baseId: 'back_extension', name: 'Extensión lumbar en banco', primary: 'back', secondary: ['glutes'], type: 'isolation', equipment: 'bodyweight', machine: 'Banco del fondo', cues: [], mistakes: [], rom: '', execution: '', safety: '', increment: 5, photo: null, custom: false } as never;
    const ex = mergeExercises([old]).find((e) => e.id === 'back_extension')!;
    expect(ex.primary).toBe('lowerback');
    expect(ex.machine).toBe('Banco del fondo');
    expect(ex.increment).toBe(5);
    expect(schemas.exercises.safeParse(old).success).toBe(true);
  });

  it('un ejercicio propio antiguo sin los campos nuevos se lee con valores por defecto', () => {
    const old = { id: 'c1', userId: 'u', updatedAt: 1, deleted: 0, dirty: 0, baseId: null, name: 'Mi ejercicio', primary: 'chest', secondary: [], type: 'compound', equipment: 'machine', machine: '', cues: [], mistakes: [], rom: '', execution: '', safety: '', increment: 5, photo: null, custom: true } as never;
    const ex = mergeExercises([old]).find((e) => e.id === 'c1')!;
    expect(ex).toMatchObject({ measure: 'reps', category: 'strength', focus: '', aka: '' });
  });
});
