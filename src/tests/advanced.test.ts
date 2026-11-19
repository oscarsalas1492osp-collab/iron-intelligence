// Biseries, triseries y técnicas avanzadas: lógica pura y persistencia.
import { beforeEach, describe, expect, it } from 'vitest';
import { exportCsv } from '../data/backup';
import { db } from '../data/db';
import * as repo from '../data/repo';
import { toRemote } from '../data/sync';
import { LIBRARY } from '../domain/exerciseLibrary';
import { recommend } from '../domain/progression';
import { joinGroup, leaveGroup, moveUnit, unitsOf } from '../domain/superset';
import { TECHNIQUES } from '../domain/techniques';
import { schemas } from '../domain/validation';
import { muscleVolume, sessionsOf, tonnage } from '../domain/volume';
import { resetDb } from './helpers';

beforeEach(resetDb);
const exMap = new Map(LIBRARY.map((e) => [e.id, e]));

describe('biseries y triseries (lógica)', () => {
  const ids = ['a', 'b', 'c', 'd'];
  it('une dos ejercicios y deja el arrastrado junto al destino', () => {
    const r = joinGroup(ids, [], 'd', 'a');
    expect(r.ids).toEqual(['a', 'd', 'b', 'c']);
    expect(r.groups).toEqual([['a', 'd']]);
    expect(unitsOf(r.ids, r.groups)).toEqual([['a', 'd'], ['b'], ['c']]);
  });
  it('suma un tercero y rechaza un cuarto', () => {
    const two = joinGroup(ids, [], 'b', 'a');
    const three = joinGroup(two.ids, two.groups, 'c', 'a');
    expect(three.groups).toEqual([['a', 'b', 'c']]);
    expect(() => joinGroup(three.ids, three.groups, 'd', 'b')).toThrow(/tres/);
  });
  it('al cambiar de grupo, el anterior se disuelve si queda uno solo', () => {
    const g = joinGroup(ids, [['a', 'b']], 'b', 'c');
    expect(g.groups).toEqual([['c', 'b']]);
    expect(unitsOf(g.ids, g.groups)).toEqual([['a'], ['c', 'b'], ['d']]);
  });
  it('separar deja el ejercicio suelto justo después y disuelve la biserie', () => {
    expect(leaveGroup(ids, [['a', 'b']], 'a')).toEqual({ ids: ['b', 'a', 'c', 'd'], groups: [] });
    expect(leaveGroup(['a', 'b', 'c', 'd'], [['a', 'b', 'c']], 'b')).toEqual({ ids: ['a', 'c', 'b', 'd'], groups: [['a', 'c']] });
  });
  it('mover desplaza la biserie completa', () => {
    expect(moveUnit(ids, [['a', 'b']], 'b', 1).ids).toEqual(['c', 'a', 'b', 'd']);
    expect(moveUnit(ids, [['a', 'b']], 'c', -1).ids).toEqual(['c', 'a', 'b', 'd']);
  });
  it('ignora grupos inválidos de datos antiguos', () => {
    expect(unitsOf(ids, undefined)).toEqual([['a'], ['b'], ['c'], ['d']]);
    expect(unitsOf(ids, [['a'], ['b', 'zz'], ['c', 'd', 'c']])).toEqual([['a'], ['b'], ['c', 'd']]);
  });
});

describe('biseries en rutinas y sesiones', () => {
  async function routine(...ex: string[]) {
    const r = await repo.createRoutine('R', 'X', [1]);
    const items = [];
    for (const id of ex) items.push(await repo.addItem(r.id, id));
    return { r, items };
  }
  it('la biserie de la rutina pasa a la sesión y sobrevive a reordenar', async () => {
    const { r, items } = await routine('bench_press', 'triceps_pushdown', 'barbell_row', 'squat');
    await repo.groupItems(r.id, items[2].id, items[0].id); // remo sobre press: pecho + espalda
    let list = await repo.getItems(r.id);
    expect(list.map((i) => i.exerciseId)).toEqual(['bench_press', 'barbell_row', 'triceps_pushdown', 'squat']);
    expect(list[0].superset).toBeTruthy(); expect(list[1].superset).toBe(list[0].superset); expect(list[2].superset).toBeNull();
    await repo.moveItem(r.id, items[3].id, -1); await repo.moveItem(r.id, items[3].id, -1);
    list = await repo.getItems(r.id);
    expect(list.map((i) => i.exerciseId)).toEqual(['squat', 'bench_press', 'barbell_row', 'triceps_pushdown']);
    const s = await repo.startSession(r.id);
    expect(s.exerciseIds).toEqual(['squat', 'bench_press', 'barbell_row', 'triceps_pushdown']);
    expect(s.supersets).toEqual([['bench_press', 'barbell_row']]);
    expect(toRemote(s)).toMatchObject({ supersets: [['bench_press', 'barbell_row']] });
    expect(toRemote(list[1])).toHaveProperty('superset', list[1].superset);
  });
  it('triserie, límite de tres, separar y eliminar un miembro', async () => {
    const { r, items } = await routine('bench_press', 'barbell_row', 'squat', 'plank');
    await repo.groupItems(r.id, items[1].id, items[0].id);
    await repo.groupItems(r.id, items[2].id, items[0].id);
    await expect(repo.groupItems(r.id, items[3].id, items[0].id)).rejects.toThrow(/tres/);
    expect((await repo.getItems(r.id)).filter((i) => i.superset).length).toBe(3);
    await repo.ungroupItem(r.id, items[1].id);
    let list = await repo.getItems(r.id);
    expect(list.map((i) => !!i.superset)).toEqual([true, true, false, false]);
    await repo.deleteItem(items[0].id);
    list = await repo.getItems(r.id);
    expect(list.every((i) => i.superset === null)).toBe(true);
  });
  it('en la sesión se puede unir, separar y quitar sin dejar grupos rotos', async () => {
    const { r } = await routine('bench_press', 'barbell_row', 'squat');
    const s = await repo.startSession(r.id);
    await repo.groupInSession(s.id, 'squat', 'bench_press');
    let cur = (await db.sessions.get(s.id))!;
    expect(cur.exerciseIds).toEqual(['bench_press', 'squat', 'barbell_row']);
    expect(cur.supersets).toEqual([['bench_press', 'squat']]);
    await repo.removeExerciseFromSession(s.id, 'squat');
    cur = (await db.sessions.get(s.id))!;
    expect(cur.supersets).toEqual([]);
    await repo.groupInSession(s.id, 'barbell_row', 'bench_press');
    await repo.ungroupInSession(s.id, 'bench_press');
    cur = (await db.sessions.get(s.id))!;
    expect(cur.supersets).toEqual([]);
    expect(cur.exerciseIds.sort()).toEqual(['barbell_row', 'bench_press']);
  });
});

describe('técnicas avanzadas', () => {
  async function session() {
    const r = await repo.createRoutine('R', 'X', [1]);
    await repo.addItem(r.id, 'chest_press_machine');
    const s = await repo.startSession(r.id);
    return { s, sets: await repo.getSessionSets(s.id) };
  }
  it('cada técnica trae explicación, evidencia y fuente', () => {
    expect(TECHNIQUES.map((t) => t.id)).toEqual(['drop', 'restpause', 'myo', 'cluster']);
    for (const t of TECHNIQUES) { expect(t.how.length).toBeGreaterThan(40); expect(t.evidence.length).toBeGreaterThan(40); expect(t.source).toMatch(/^https:\/\//); }
  });
  it('el dropset baja la carga un 20 % redondeada al paso de la máquina y encadena bajadas', async () => {
    const { sets } = await session();
    await repo.updateSet(sets[0].id, { weight: 122.5, reps: 10, rir: 0 });
    await repo.completeSet(sets[0].id);
    const d1 = await repo.addExtension(sets[0].id, 'drop', 5);
    expect(d1).toMatchObject({ technique: 'drop', sub: 1, order: sets[0].order, weight: 95, reps: 7, done: false });
    const d2 = await repo.addExtension(sets[0].id, 'drop', 5);
    expect(d2).toMatchObject({ sub: 2, weight: 75 });
    const rp = await repo.addExtension(sets[1].id, 'restpause', 5);
    expect(rp).toMatchObject({ technique: 'restpause', sub: 1, weight: sets[1].weight });
    const all = await repo.getSessionSets(sets[0].sessionId);
    expect(all.map((x) => `${x.order}.${x.sub}`)).toEqual(['0.0', '0.1', '0.2', '1.0', '1.1', '2.0']);
    expect(schemas.sets.safeParse(d1).success).toBe(true);
    expect(toRemote(d1)).toMatchObject({ technique: 'drop', sub: 1 });
  });
  it('los tramos suman tonelaje pero no cuentan como series ni alteran la progresión', async () => {
    const { s, sets } = await session();
    for (const x of sets) { await repo.updateSet(x.id, { weight: 100, reps: 12, rir: 1 }); await repo.completeSet(x.id); }
    const d = await repo.addExtension(sets[2].id, 'drop', 5);
    await repo.updateSet(d.id, { reps: 8, rir: 0 }); await repo.completeSet(d.id);
    expect((await db.sets.get(d.id))!.metTarget).toBe(true);
    await repo.finishSession(s.id);
    const done = await repo.getDoneSets();
    expect(done).toHaveLength(4);
    expect(done.filter((x) => x.ext)).toHaveLength(1);
    expect(muscleVolume(done, exMap, 0.5).find((v) => v.muscle === 'chest')!.direct).toBe(3);
    expect(tonnage(done)).toBe(3 * 100 * 12 + 80 * 8);
    const past = sessionsOf(done, 'chest_press_machine');
    expect(past[0].sets).toHaveLength(3);
    const target = { sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, restSec: 120 };
    const rec = recommend({ exType: 'compound', increment: 5, target, history: past, readiness: null });
    expect(rec.action).toBe('increase');
    expect(await exportCsv()).toMatch(/;drop;1\r?\n?/);
  });
  it('eliminar la serie principal elimina sus tramos; al copiar la sesión anterior no se copian', async () => {
    const { s, sets } = await session();
    const d = await repo.addExtension(sets[0].id, 'myo', 5);
    expect(d.reps).toBe(4);
    await repo.deleteSet(sets[0].id);
    expect((await repo.getSessionSets(s.id)).map((x) => x.sub)).toEqual([0, 0]);
    const added = await repo.addSet(s.id, 'chest_press_machine');
    expect(added).toMatchObject({ sub: 0, technique: '' });
  });
  it('acepta series, sesiones y rutinas guardadas antes de estas funciones', () => {
    const base = { id: 'x', userId: 'u', updatedAt: 1, deleted: 0, dirty: 0 };
    expect(schemas.sets.safeParse({ ...base, sessionId: 's', exerciseId: 'e', order: 0, weight: 50, reps: 10, rir: 2, rpe: 8, failure: false, endReason: 'none', metTarget: true, done: true, completedAt: 1, restSec: null, note: '' }).success).toBe(true);
    expect(schemas.sessions.safeParse({ ...base, routineId: null, name: 'S', startedAt: 1, endedAt: 2, status: 'done', pausedAt: null, pausedMs: 0, notes: '', exerciseIds: ['e'], targets: {} }).success).toBe(true);
    expect(schemas.routineItems.safeParse({ ...base, routineId: 'r', exerciseId: 'e', order: 0, sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, restSec: 90 }).success).toBe(true);
  });
});
