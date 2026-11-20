// Pruebas de integración sobre la base de datos real (IndexedDB simulado en memoria).
import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, exportCsv, importBackup } from '../data/backup';
import { db, setUserId } from '../data/db';
import * as repo from '../data/repo';
import { authMessage, claimLocalData, fromRemote, syncAll, toRemote, type RemoteClient } from '../data/sync';
import { resetDb } from './helpers';

beforeEach(resetDb);

async function routineWith(...ids: string[]) {
  const r = await repo.createRoutine('Push', 'PPL', [1]);
  for (const id of ids) await repo.addItem(r.id, id);
  return r;
}
async function logSession(routineId: string, fill: (i: number) => { weight: number; reps: number; rir: number }) {
  const s = await repo.startSession(routineId);
  const sets = await repo.getSessionSets(s.id);
  for (const [i, x] of sets.entries()) { await repo.updateSet(x.id, fill(i)); await repo.completeSet(x.id); }
  return (await repo.finishSession(s.id))!;
}

describe('registro de series y sesiones', () => {
  it('un ejercicio por tiempo parte con su rango en segundos y uno del catálogo ampliado se registra igual que los demás', async () => {
    const r = await routineWith('plank', 'farmer_walk', 'pendulum_squat');
    const s = await repo.startSession(r.id);
    expect(s.targets['plank']).toMatchObject({ repMin: 30, repMax: 60 });
    expect(s.targets['farmer_walk']).toMatchObject({ repMin: 20, repMax: 40 });
    expect(s.targets['pendulum_squat']).toMatchObject({ repMin: 8, repMax: 12 });
    const sets = await repo.getSessionSets(s.id);
    expect(sets.filter((x) => x.exerciseId === 'plank').every((x) => x.reps === 30)).toBe(true);
    const sq = sets.find((x) => x.exerciseId === 'pendulum_squat')!;
    await repo.updateSet(sq.id, { weight: 80, reps: 10, rir: 2 });
    await repo.completeSet(sq.id);
    await repo.finishSession(s.id);
    const done = await repo.getDoneSets();
    expect(done.find((x) => x.exerciseId === 'pendulum_squat')).toMatchObject({ weight: 80, reps: 10 });
  });

  it('guarda un ejercicio propio con medida y familia, y lo sube con las columnas nuevas', async () => {
    const ex = await repo.saveExercise({ id: '', name: 'Arrastre con cuerda', primary: 'back', secondary: ['biceps'], type: 'compound', equipment: 'sled', machine: '', focus: '', aka: '', measure: 'distance', category: 'functional', cues: [], mistakes: [], rom: '', execution: '', safety: '', increment: 5, photo: null, custom: true });
    const row = (await db.exercises.toArray()).find((x) => x.id === ex.id)!;
    expect(toRemote(row)).toMatchObject({ measure: 'distance', category: 'functional', focus: '', aka: '', equipment: 'sled' });
    expect((await repo.getExercises()).find((x) => x.id === ex.id)).toMatchObject({ measure: 'distance', category: 'functional' });
  });

  it('al iniciar crea las series objetivo y cada serie se guarda individualmente', async () => {
    const r = await routineWith('chest_press_machine', 'triceps_pushdown');
    const s = await repo.startSession(r.id);
    const sets = await repo.getSessionSets(s.id);
    expect(sets).toHaveLength(6);
    expect(s.targets['chest_press_machine']).toMatchObject({ sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, restSec: 120 });
    expect(s.targets['triceps_pushdown']).toMatchObject({ repMin: 10, repMax: 15, rirMin: 0, rirMax: 2, restSec: 90 });

    await repo.updateSet(sets[0].id, { weight: 50, reps: 12, rir: 3 });
    const done = await repo.completeSet(sets[0].id);
    expect(done).toMatchObject({ weight: 50, reps: 12, rir: 3, rpe: 7, done: true, metTarget: true, failure: false });
    expect((await db.sets.get(sets[0].id))!.done).toBe(true);
  });

  it('RIR 0 marca fallo momentáneo por defecto y el motivo se puede corregir', async () => {
    const s = await repo.startSession((await routineWith('chest_press_machine')).id);
    const [a] = await repo.getSessionSets(s.id);
    let x = await repo.updateSet(a.id, { weight: 50, reps: 8, rir: 0 });
    expect(x).toMatchObject({ failure: true, endReason: 'momentary', rpe: 10 });
    x = await repo.updateSet(a.id, { endReason: 'voluntary' });
    expect(x.failure).toBe(false);
    x = await repo.updateSet(a.id, { rir: 2 });
    expect(x.rpe).toBe(8);
  });

  it('rechaza datos inválidos sin modificar lo guardado', async () => {
    const s = await repo.startSession((await routineWith('chest_press_machine')).id);
    const [a] = await repo.getSessionSets(s.id);
    await expect(repo.updateSet(a.id, { weight: -5 })).rejects.toThrow(/negativo/);
    await expect(repo.updateSet(a.id, { reps: 2.5 })).rejects.toThrow(/entero/);
    await expect(repo.updateSet(a.id, { rir: 1.3 })).rejects.toThrow(/0,5/);
    await repo.updateSet(a.id, { reps: 0 });
    await expect(repo.completeSet(a.id)).rejects.toThrow(/al menos 1/);
    expect((await db.sets.get(a.id))!.weight).toBe(a.weight);
    await expect(repo.createRoutine('  ')).rejects.toThrow(/nombre/);
  });

  it('recupera la sesión en curso tras cerrar la app (una sola sesión activa)', async () => {
    const r = await routineWith('chest_press_machine');
    const s = await repo.startSession(r.id);
    const [a] = await repo.getSessionSets(s.id);
    await repo.updateSet(a.id, { weight: 50, reps: 10, rir: 2 });
    await repo.completeSet(a.id);
    // "Reinicio": nada vive en memoria, todo se relee desde la base.
    const again = await repo.getActiveSession();
    expect(again!.id).toBe(s.id);
    expect((await repo.startSession(r.id)).id).toBe(s.id);
    expect((await repo.getSessionSets(s.id)).filter((x) => x.done)).toHaveLength(1);
  });

  it('pausar y reanudar descuenta el tiempo en pausa', async () => {
    const s = await repo.startSession(null);
    await repo.pauseSession(s.id);
    const paused = (await db.sessions.get(s.id))!;
    expect(paused.status).toBe('paused');
    expect(repo.elapsedMs({ ...paused, startedAt: 0, pausedAt: 1000, pausedMs: 0 }, 5000)).toBe(1000);
    await repo.resumeSession(s.id);
    expect((await db.sessions.get(s.id))!.status).toBe('active');
  });

  it('finalizar descarta series no completadas; sin series, descarta la sesión', async () => {
    const r = await routineWith('chest_press_machine');
    const s = await repo.startSession(r.id);
    const [a] = await repo.getSessionSets(s.id);
    await repo.updateSet(a.id, { weight: 50, reps: 10, rir: 2 });
    await repo.completeSet(a.id);
    const fin = await repo.finishSession(s.id);
    expect(fin!.status).toBe('done');
    expect(await repo.getSessionSets(s.id)).toHaveLength(1);
    const empty = await repo.startSession(r.id);
    expect(await repo.finishSession(empty.id)).toBeNull();
    expect(await repo.getActiveSession()).toBeUndefined();
  });
});

describe('historial, progresión y persistencia', () => {
  it('la siguiente sesión propone el peso recomendado y muestra el rendimiento anterior', async () => {
    const r = await routineWith('chest_press_machine');
    await logSession(r.id, () => ({ weight: 50, reps: 12, rir: 2 }));
    const history = await repo.getDoneSets();
    expect(history).toHaveLength(3);
    const ex = (await repo.getExercises()).find((e) => e.id === 'chest_press_machine')!;
    const rec = await repo.recommendationFor(ex, { sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, restSec: 120 });
    expect(rec.action).toBe('increase');
    expect(rec.weight).toBe(55);
    const next = await repo.startSession(r.id);
    const sets = await repo.getSessionSets(next.id);
    expect(sets.map((s) => s.weight)).toEqual([55, 55, 55]);
    expect(sets[0].reps).toBe(8);
  });

  it('editar y eliminar registros del historial se refleja en los cálculos', async () => {
    const r = await routineWith('chest_press_machine');
    const s = await logSession(r.id, () => ({ weight: 50, reps: 10, rir: 2 }));
    const sets = await repo.getSessionSets(s.id);
    await repo.updateSet(sets[0].id, { reps: 12 });
    await repo.deleteSet(sets[2].id);
    const h = await repo.getDoneSets();
    expect(h.map((x) => x.reps).sort()).toEqual([10, 12]);
    await repo.deleteSession(s.id);
    expect(await repo.getDoneSets()).toHaveLength(0);
  });

  it('cambiar la rutina no altera sesiones ya registradas', async () => {
    const r = await routineWith('chest_press_machine');
    const s = await logSession(r.id, () => ({ weight: 50, reps: 10, rir: 2 }));
    const [item] = await repo.getItems(r.id);
    await repo.saveItem({ ...item, sets: 5, repMin: 5, repMax: 8 });
    await repo.addItem(r.id, 'pec_deck');
    await repo.deleteItem(item.id);
    const old = (await db.sessions.get(s.id))!;
    expect(old.targets['chest_press_machine']).toMatchObject({ sets: 3, repMin: 8, repMax: 12 });
    expect(old.exerciseIds).toEqual(['chest_press_machine']);
    const next = await repo.startSession(r.id);
    expect(next.exerciseIds).toEqual(['pec_deck']);
  });

  it('constructor de rutinas: plantillas, orden y borrado en cascada', async () => {
    const [push] = await repo.createFromTemplate('ppl');
    let items = await repo.getItems(push.id);
    expect(items.length).toBeGreaterThan(4);
    await repo.moveItem(push.id, items[1].id, -1);
    const moved = await repo.getItems(push.id);
    expect(moved[0].id).toBe(items[1].id);
    await repo.deleteRoutine(push.id);
    items = await repo.getItems(push.id);
    expect(items).toHaveLength(0);
  });

  it('ejercicios personalizados y ajustes de máquina persisten', async () => {
    const base = (await repo.getExercises())[0];
    await repo.saveExercise({ ...base, increment: 7.5, machine: 'Hammer Strength fila 2' });
    const custom = await repo.saveExercise({ ...base, id: '', name: 'Press en máquina Panatta', custom: true });
    const all = await repo.getExercises();
    expect(all.find((e) => e.id === base.id)).toMatchObject({ increment: 7.5, machine: 'Hammer Strength fila 2', custom: false });
    expect(all.find((e) => e.id === custom.id)).toMatchObject({ name: 'Press en máquina Panatta', custom: true });
    await repo.deleteExercise(custom.id);
    expect((await repo.getExercises()).some((e) => e.id === custom.id)).toBe(false);
  });

  it('cambios rápidos y simultáneos del perfil no se pisan entre sí', async () => {
    await Promise.all([repo.updateProfile({ name: 'Oscar' }), repo.updateProfile({ age: 34 }), repo.updateProfile({ halfRir: true }), repo.updateProfile({ priorityMuscles: ['chest'] })]);
    expect(await repo.getProfile()).toMatchObject({ name: 'Oscar', age: 34, halfRir: true, priorityMuscles: ['chest'] });
    await expect(repo.updateProfile({ age: 500 })).rejects.toThrow();
    expect((await repo.getProfile()).age).toBe(34);
  });

  it('una rutina con un ejercicio propio ya eliminado inicia sin ese ejercicio', async () => {
    const base = (await repo.getExercises())[0];
    const custom = await repo.saveExercise({ ...base, id: '', name: 'Temporal', custom: true });
    const r = await routineWith('chest_press_machine', custom.id);
    await repo.deleteExercise(custom.id);
    const s = await repo.startSession(r.id);
    expect(s.exerciseIds).toEqual(['chest_press_machine']);
    expect(await repo.getSessionSets(s.id)).toHaveLength(3);
  });

  it('recuperación y peso corporal: un registro por día', async () => {
    const v = { sleepHours: 7, sleepQuality: 4, fatigue: 2, soreness: 2, motivation: 4, stress: 2 };
    await repo.saveRecovery(v, '2026-11-19');
    await repo.saveRecovery({ ...v, sleepHours: 6 }, '2026-11-19');
    expect(await db.recovery.count()).toBe(1);
    expect((await db.recovery.toArray())[0].sleepHours).toBe(6);
    await repo.saveBodyWeight(80.4, '2026-11-19');
    await expect(repo.saveBodyWeight(5, '2026-11-19')).rejects.toThrow(/fuera de rango/);
  });

  it('copia de seguridad: exportar, borrar todo y restaurar', async () => {
    const r = await routineWith('chest_press_machine');
    await logSession(r.id, () => ({ weight: 50, reps: 10, rir: 2 }));
    const csv = await exportCsv();
    expect(csv.split('\r\n')).toHaveLength(4);
    expect(csv).toMatch(/Press de pecho en máquina;1;50;10;2;8/);
    const backup = JSON.stringify(await exportBackup());
    await Promise.all(db.tables.map((t) => t.clear()));
    expect(await repo.getDoneSets()).toHaveLength(0);
    const res = await importBackup(backup);
    expect(res.skipped).toBe(0);
    expect(await repo.getDoneSets()).toHaveLength(3);
    await expect(importBackup('{"otra":1}')).rejects.toThrow(/copia/);
    await expect(importBackup('no json')).rejects.toThrow(/JSON/);
  });
});

describe('sincronización', () => {
  /** Servidor simulado en memoria con la misma interfaz que Supabase. */
  function fakeServer() {
    const tables = new Map<string, Map<string, Record<string, unknown>>>();
    let clock = 0;
    const client: RemoteClient = {
      async upsert(table, rows) {
        const t = tables.get(table) ?? tables.set(table, new Map()).get(table)!;
        for (const r of rows) t.set(r.id as string, { ...r, synced_at: String(++clock).padStart(8, '0') });
      },
      async pull(table, since) {
        return [...(tables.get(table)?.values() ?? [])].filter((r) => !since || (r.synced_at as string) > since).sort((a, b) => (a.synced_at as string).localeCompare(b.synced_at as string));
      },
    };
    return { tables, client };
  }

  it('los errores de autenticación y de red se muestran en español', () => {
    expect(authMessage(new Error('Invalid login credentials'))).toMatch(/incorrectos/);
    expect(authMessage(new Error('Email not confirmed'))).toMatch(/confirmado/);
    expect(authMessage(new Error('User already registered'))).toMatch(/ya tiene una cuenta/);
    expect(authMessage(new TypeError('Failed to fetch'))).toMatch(/conectar/);
    expect(authMessage(new Error('email rate limit exceeded'))).toMatch(/espera/);
  });

  it('convierte nombres de campo en ambos sentidos sin perder datos', () => {
    const row = { id: '1', userId: 'u', updatedAt: 5, dirty: 1, repMin: 8, exerciseIds: ['a'], targets: { a: { repMin: 8 } } };
    const remote = toRemote(row);
    expect(remote).toMatchObject({ user_id: 'u', updated_at: 5, rep_min: 8, exercise_ids: ['a'], targets: { a: { repMin: 8 } } });
    expect(remote).not.toHaveProperty('dirty');
    expect(fromRemote({ ...remote, synced_at: 'x' })).toEqual({ ...row, dirty: 0 });
  });

  it('sube lo pendiente, lo marca como sincronizado y otro dispositivo lo recibe', async () => {
    const { tables, client } = fakeServer();
    setUserId('user-1');
    const r = await routineWith('chest_press_machine');
    await logSession(r.id, () => ({ weight: 50, reps: 10, rir: 2 }));
    const first = await syncAll(client, 'user-1');
    expect(first.pushed).toBeGreaterThanOrEqual(6);
    expect(tables.get('set_logs')!.size).toBe(3);
    expect(await db.sets.where('dirty').equals(1).count()).toBe(0);
    expect((await syncAll(client, 'user-1')).pushed).toBe(0);

    // Segundo dispositivo: base vacía, misma cuenta.
    await Promise.all(db.tables.map((t) => t.clear()));
    const second = await syncAll(client, 'user-1');
    expect(second.pulled).toBeGreaterThanOrEqual(6);
    expect(await repo.getDoneSets()).toHaveLength(3);
  });

  it('en conflicto gana la última escritura y los borrados se propagan', async () => {
    const { tables, client } = fakeServer();
    setUserId('user-1');
    const r = await repo.createRoutine('A');
    await syncAll(client, 'user-1');
    // Otro dispositivo renombra más tarde.
    await client.upsert('routines', [{ ...toRemote(r), name: 'B', updated_at: Date.now() + 10_000 }]);
    await syncAll(client, 'user-1');
    expect((await db.routines.get(r.id))!.name).toBe('B');
    // Un cambio remoto más antiguo no pisa uno local más nuevo.
    // Aunque el otro dispositivo tenga el reloj adelantado, una edición local posterior queda como más nueva.
    await repo.saveRoutine({ ...(await db.routines.get(r.id))!, name: 'C' });
    await client.upsert('routines', [{ ...toRemote(r), name: 'viejo', updated_at: 1 }]);
    await syncAll(client, 'user-1');
    expect((await db.routines.get(r.id))!.name).toBe('C');
    await repo.deleteRoutine(r.id);
    await syncAll(client, 'user-1');
    expect(tables.get('routines')!.get(r.id)!.deleted).toBe(1);
  });

  it('al iniciar sesión, los datos locales pasan a la cuenta y cada usuario ve solo lo suyo', async () => {
    await repo.saveProfile({ ...repo.defaultProfile(), name: 'Oscar' });
    await repo.createRoutine('Local');
    await claimLocalData('user-9');
    setUserId('user-9');
    expect((await repo.getProfile()).name).toBe('Oscar');
    expect((await db.routines.toArray()).every((x) => x.userId === 'user-9' && x.dirty === 1)).toBe(true);
    setUserId('local');
    expect(repo.mine(await db.routines.toArray())).toHaveLength(0);
  });
});

describe('registro durante el entrenamiento: valores que siguen y subida a la nube', () => {
  function fakeServer() {
    const tables = new Map<string, Map<string, Record<string, unknown>>>();
    let clock = 0;
    const client: RemoteClient = {
      async upsert(table, rows) {
        const t = tables.get(table) ?? tables.set(table, new Map()).get(table)!;
        for (const r of rows) t.set(r.id as string, { ...r, synced_at: String(++clock).padStart(8, '0') });
      },
      async pull(table, since) {
        return [...(tables.get(table)?.values() ?? [])].filter((r) => !since || (r.synced_at as string) > since).sort((x, y) => (x.synced_at as string).localeCompare(y.synced_at as string));
      },
    };
    return { tables, client };
  }

  it('el peso y las repeticiones anotados en una serie pasan a las siguientes que aún no se hacen', async () => {
    const r = await routineWith('chest_press_machine');
    const s = await repo.startSession(r.id);
    const [a, b, c] = await repo.getSessionSets(s.id);
    expect([a.weight, b.weight, c.weight]).toEqual([0, 0, 0]);
    await repo.updateSet(a.id, { weight: 60 });
    await repo.updateSet(a.id, { reps: 12 });
    let now = await repo.getSessionSets(s.id);
    expect(now.map((x) => [x.weight, x.reps])).toEqual([[60, 12], [60, 12], [60, 12]]);
    // Una serie que el usuario ya ajustó a otro valor no se toca, ni una ya completada.
    await repo.updateSet(c.id, { weight: 50 });
    await repo.completeSet(a.id);
    await repo.updateSet(a.id, { weight: 62.5 });
    now = await repo.getSessionSets(s.id);
    expect(now.map((x) => x.weight)).toEqual([62.5, 62.5, 50]);
    await repo.completeSet(b.id);
    await repo.updateSet(a.id, { weight: 65 });
    expect((await repo.getSessionSets(s.id)).map((x) => x.weight)).toEqual([65, 62.5, 50]);
    // Un cambio en una serie posterior no altera las anteriores.
    await repo.updateSet(c.id, { weight: 40 });
    expect((await repo.getSessionSets(s.id)).map((x) => x.weight)).toEqual([65, 62.5, 40]);
  });

  it('dos toques seguidos en Iniciar crean una sola sesión', async () => {
    const r = await routineWith('chest_press_machine');
    const [x, y] = await Promise.all([repo.startSession(r.id), repo.startSession(r.id)]);
    expect(x.id).toBe(y.id);
    expect(await db.sessions.count()).toBe(1);
    expect(await db.sets.count()).toBe(3);
  });

  it('sube sesiones y series guardadas por una versión anterior, completando los campos que no traían', async () => {
    const { tables, client } = fakeServer();
    setUserId('user-1');
    const r = await routineWith('chest_press_machine');
    const done = await logSession(r.id, () => ({ weight: 50, reps: 10, rir: 2 }));
    // Forma antigua: sin biseries ni técnicas.
    await db.sessions.where('id').equals(done.id).modify((x) => { delete (x as Partial<typeof x>).supersets; });
    await db.sets.toCollection().modify((x) => { delete (x as Partial<typeof x>).technique; delete (x as Partial<typeof x>).sub; });
    await syncAll(client, 'user-1');
    expect(tables.get('sessions')!.get(done.id)).toMatchObject({ supersets: [] });
    for (const row of tables.get('set_logs')!.values()) expect(row).toMatchObject({ technique: '', sub: 0 });
    expect(await db.sessions.where('dirty').equals(1).count()).toBe(0);
  });

  it('una fila que el servidor rechaza no impide subir las demás ni las otras tablas', async () => {
    const { tables, client } = fakeServer();
    setUserId('user-1');
    const a = await repo.createRoutine('Buena');
    const b = await repo.createRoutine('Mala');
    await repo.saveBodyWeight(80);
    const picky: RemoteClient = {
      pull: client.pull,
      upsert: async (table, rows) => { if (rows.some((x) => x.name === 'Mala')) throw new Error('fila rechazada'); await client.upsert(table, rows); },
    };
    await expect(syncAll(picky, 'user-1')).rejects.toThrow('fila rechazada');
    expect(tables.get('routines')!.has(a.id)).toBe(true);
    expect(tables.get('routines')!.has(b.id)).toBe(false);
    expect(tables.get('body_weights')!.size).toBe(1);
    expect((await db.routines.get(a.id))!.dirty).toBe(0);
    expect((await db.routines.get(b.id))!.dirty).toBe(1);
  });
});
