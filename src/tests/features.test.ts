// Ayudas de gimnasio, ciclo, generador, compartir, importar e indicadores.
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../data/db';
import * as repo from '../data/repo';
import { TEMPLATES } from '../data/templates';
import { DAY, weekStart, ymd } from '../domain/calc';
import { cycleInfo, cycleTarget, DELOAD_TAG } from '../domain/cycle';
import { LIBRARY } from '../domain/exerciseLibrary';
import { generatePlan } from '../domain/generator';
import { matchExercise, parseWorkouts } from '../domain/importers';
import { adherence, balance, isRecord, strengthLevels, weekStreak } from '../domain/insights';
import { decodeRoutine, encodeRoutine } from '../domain/share';
import { platesPerSide, warmupSets } from '../domain/tools';
import { schemas } from '../domain/validation';
import { resetDb } from './helpers';

beforeEach(resetDb);
const T = { sets: 4, repMin: 8, repMax: 12, rirMin: 0, rirMax: 3, restSec: 120 };

describe('ayudas de gimnasio', () => {
  it('el calentamiento sube por pasos, no repite cargas y nunca alcanza la de trabajo', () => {
    const w = warmupSets(100, 2.5, 20);
    expect(w.map((x) => x.weight)).toEqual([40, 55, 70, 85]);
    expect(w.map((x) => x.reps)).toEqual([8, 5, 3, 2]);
    expect(warmupSets(25, 5, 20).every((x) => x.weight >= 20 && x.weight < 25)).toBe(true);
    expect(warmupSets(0, 2.5)).toEqual([]);
  });
  it('los discos por lado suman el peso pedido y avisa de lo que no se puede cargar', () => {
    expect(platesPerSide(100, 20)).toEqual({ side: [25, 15], rest: 0 });
    expect(platesPerSide(62.5, 20)).toEqual({ side: [20, 1.25], rest: 0 });
    expect(platesPerSide(61, 20).rest).toBe(1);
    expect(platesPerSide(15, 20).side).toEqual([]);
  });
});

describe('ciclo de entrenamiento', () => {
  const start = ymd(weekStart(Date.now()));
  it('ubica la semana, baja el RIR de forma gradual y descarga en la última', () => {
    const c = { start, weeks: 5, deload: true };
    const at = (w: number) => cycleInfo(c, Date.now() + w * 7 * DAY)!;
    expect(at(0)).toMatchObject({ week: 1, of: 5, deload: false });
    expect(cycleTarget(T, at(0), true)).toMatchObject({ rirMin: 3, rirMax: 3, sets: 4 });
    expect(cycleTarget(T, at(3), true)).toMatchObject({ rirMin: 0, rirMax: 0 });
    expect(at(4).deload).toBe(true);
    expect(cycleTarget(T, at(4), true)).toMatchObject({ sets: 2, rirMin: 2, rirMax: 5 });
    expect(at(5)).toMatchObject({ week: 1, round: 2 });
    expect(cycleInfo(null)).toBeNull();
  });
  it('la sesión de descarga parte con menos series y carga, y no sirve de referencia para la progresión', async () => {
    const r = await repo.createRoutine('A'); await repo.addItem(r.id, 'chest_press_machine');
    let s = await repo.startSession(r.id);
    for (const x of await repo.getSessionSets(s.id)) { await repo.updateSet(x.id, { weight: 50, reps: 12, rir: 2 }); await repo.completeSet(x.id); }
    await repo.finishSession(s.id);
    await repo.updateSettings({ cycle: { start: ymd(weekStart(Date.now()) - 2 * 7 * DAY), weeks: 3, deload: true } });
    s = await repo.startSession(r.id);
    expect(s.notes).toContain(DELOAD_TAG);
    const sets = await repo.getSessionSets(s.id);
    expect(sets.length).toBeLessThan(3);
    expect(sets[0].weight).toBeLessThan(50);
    await repo.completeSet(sets[0].id); await repo.finishSession(s.id);
    const { sessionsOf } = await import('../domain/volume');
    expect(sessionsOf(await repo.getDoneSets(), 'chest_press_machine')).toHaveLength(1);
    expect(schemas.profiles.safeParse(await repo.getProfile()).success).toBe(true);
  });
});

describe('programas y generador', () => {
  it('todas las plantillas usan ejercicios que existen', () => {
    const ids = new Set(LIBRARY.map((e) => e.id));
    for (const t of TEMPLATES) for (const d of t.routines) for (const e of d.exercises) expect(ids.has(typeof e === 'string' ? e : e[0]), `${t.id}: ${e}`).toBe(true);
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(9);
  });
  it('arma un plan para cada número de días, respeta el equipo y refuerza las prioridades', async () => {
    for (const days of [2, 3, 4, 5, 6]) {
      const p = generatePlan({ days, equipment: [], priority: [], experience: 'intermediate' }, LIBRARY);
      expect(p.routines.reduce((a, r) => a + r.days.length, 0)).toBe(days);
      for (const r of p.routines) { expect(r.exercises.length).toBeGreaterThanOrEqual(5); expect(new Set(r.exercises.map((e) => e[0])).size).toBe(r.exercises.length); }
    }
    const home = generatePlan({ days: 3, equipment: ['dumbbell'], priority: ['biceps'], experience: 'beginner' }, LIBRARY);
    const used = home.routines.flatMap((r) => r.exercises.map((e) => LIBRARY.find((x) => x.id === e[0])!));
    expect(used.filter((e) => e.equipment === 'dumbbell' || e.equipment === 'bodyweight').length / used.length).toBeGreaterThan(0.8);
    const made = await repo.createFromPlan(home.split, home.routines);
    expect(made).toHaveLength(2);
    expect((await repo.getItems(made[0].id)).length).toBe(home.routines[0].exercises.length);
  });
});

describe('compartir e importar', () => {
  it('una rutina viaja por enlace con sus objetivos, biseries y ejercicios propios', async () => {
    const mine = await repo.saveExercise({ ...LIBRARY[0], id: 'x1', name: 'Press en mi máquina', custom: true });
    const r = await repo.createRoutine('Torso', 'Torso/Pierna', [1, 4]);
    const a = await repo.addItem(r.id, 'bench_press'); const b = await repo.addItem(r.id, 'barbell_row'); await repo.addItem(r.id, mine.id);
    await repo.groupItems(r.id, b.id, a.id);
    const code = encodeRoutine((await repo.shareableRoutine(r.id))!);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    await resetDb();
    const sr = decodeRoutine(code)!;
    expect(sr).toMatchObject({ name: 'Torso', days: [1, 4] });
    const made = await repo.importSharedRoutine(sr);
    const items = await repo.getItems(made.id);
    expect(items).toHaveLength(3);
    expect(items.filter((i) => i.superset).length).toBe(2);
    expect((await repo.getExercises()).some((e) => e.name === 'Press en mi máquina')).toBe(true);
    expect(decodeRoutine('no-es-un-enlace')).toBeNull();
  });
  it('importa el historial de Strong y de Hevy, reconoce ejercicios y no duplica', async () => {
    const strong = 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE\n2026-03-02 18:30:00,"Push Day",1h 5m,"Bench Press (Barbell)",1,80,8,0,0,,,8\n2026-03-02 18:30:00,"Push Day",1h 5m,"Bench Press (Barbell)",2,80,7,0,0,,,\n2026-03-02 18:30:00,"Push Day",1h 5m,"Mi Ejercicio Raro",1,10,12,0,0,,,';
    const list = parseWorkouts(strong);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'Push Day', durationMs: 3900000 });
    expect(list[0].exercises[0].sets[0]).toMatchObject({ weight: 80, reps: 8, rir: 2 });
    expect(matchExercise('Bench Press (Barbell)', LIBRARY)?.id).toBe('bench_press');
    expect(matchExercise('Squat (Barbell)', LIBRARY)?.id).toBe('squat');
    const res = await repo.importSessions(list);
    expect(res).toMatchObject({ sessions: 1, sets: 3, created: 1 });
    expect((await repo.importSessions(list)).skipped).toBe(1);
    expect((await repo.getDoneSets()).filter((s) => s.exerciseId === 'bench_press')).toHaveLength(2);
    const hevy = 'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_lbs,reps,distance_km,duration_seconds,rpe\n"Legs","5 Mar 2026, 07:00","5 Mar 2026, 08:00",,"Leg Press",,,0,warmup,100,10,,,\n"Legs","5 Mar 2026, 07:00","5 Mar 2026, 08:00",,"Leg Press",,,1,normal,220,10,,,9';
    const h = parseWorkouts(hevy);
    expect(h[0].durationMs).toBe(3600000);
    expect(h[0].exercises[0].sets.map((s) => s.warmup)).toEqual([true, false]);
    expect(h[0].exercises[0].sets[1].weight).toBeCloseTo(99.79, 1);
    expect((await repo.importSessions(h)).sets).toBe(1);
    expect(() => parseWorkouts('a,b\n1,2')).toThrow(/formato/);
  });
});

describe('indicadores', () => {
  it('racha, adherencia, balance, niveles y récords', async () => {
    const now = Date.now(), wk = 7 * DAY;
    expect(weekStreak([now - wk, now - 2 * wk, now - 4 * wk], now)).toBe(2);
    expect(weekStreak([now, now - wk], now)).toBe(2);
    expect(weekStreak([], now)).toBe(0);
    const ad = adherence([now - wk, now - wk + 3600000, now - 2 * wk], 2, 4, now);
    expect(ad.weeks).toHaveLength(4);
    expect(ad.pct).toBe(50);
    const ex = new Map(LIBRARY.map((e) => [e.id, e]));
    const set = (exerciseId: string, weight: number, reps: number) => ({ sessionId: 's', exerciseId, date: now, order: 0, weight, reps, rir: 1, failure: false, endReason: 'none' as const });
    const sets = [set('bench_press', 100, 5), set('barbell_row', 80, 8), set('squat', 140, 5), set('seated_leg_curl', 40, 10)];
    expect(balance(sets, ex)).toEqual({ push: 1, pull: 1, front: 1, back: 1 });
    const lv = strengthLevels(sets, 80);
    expect(lv.find((l) => l.key === 'bench')).toMatchObject({ level: 3, e1rm: 120 });
    expect(strengthLevels(sets, 0)).toEqual([]);
    expect(isRecord(sets, 'bench_press', 102.5, 3, 1)).toBe('weight');
    expect(isRecord(sets, 'bench_press', 100, 8, 1)).toBe('e1rm');
    expect(isRecord(sets, 'bench_press', 90, 5, 1)).toBeNull();
    expect(isRecord([], 'bench_press', 90, 5, 1)).toBeNull();
    const m = await repo.saveMeasures({ waist: 84, arm: 38 }); await repo.saveMeasures({ waist: 83, arm: 0 });
    expect((await db.measures.get(m.id))!.values).toEqual({ waist: 83 });
  });
});
