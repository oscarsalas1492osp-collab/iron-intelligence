// Repositorio: todas las escrituras de la app pasan por aquí.
// Valida, marca la fila como pendiente de sincronizar y avisa a los suscriptores.
import { clamp, roundTo, rpeFromRir, uid, ymd } from '../domain/calc';
import { isLibraryId, mergeExercises } from '../domain/exerciseLibrary';
import { cycleInfo, cycleTarget, DELOAD_TAG, deloadWeight } from '../domain/cycle';
import { ADJ_KEY, pruneRatings, volumeDelta } from '../domain/feedback';
import { guessExercise, matchExercise, type ImportedSession } from '../domain/importers';
import type { PlanDay } from '../domain/generator';
import { recommend, workWeight } from '../domain/progression';
import type { SharedRoutine } from '../domain/share';
import { recentReadiness } from '../domain/recovery';
import { cleanGroups, joinGroup, leaveGroup, moveUnit, type Arrangement } from '../domain/superset';
import { TECHNIQUE } from '../domain/techniques';
import { defaultTarget, type Base, type BodyMeasure, type BodyWeight, type ExerciseDef, type ExerciseRow, type Profile, type RecoveryLog, type Routine, type RoutineItem, type Session, type SetLog, type Settings, type Target, type Technique } from '../domain/types';
import { validate, ValidationError, type TableName } from '../domain/validation';
import { sessionsOf, type ASet } from '../domain/volume';
import { db, getUserId } from './db';
import { TEMPLATES, targetFor } from './templates';

const changeListeners = new Set<() => void>();
export const onLocalChange = (cb: () => void) => { changeListeners.add(cb); return () => changeListeners.delete(cb); };
const notify = () => changeListeners.forEach((l) => l());

const newBase = (): Base => ({ id: uid(), userId: getUserId(), updatedAt: Date.now(), deleted: 0, dirty: 1 });

/** Marca de tiempo monótona por fila: un reloj atrasado nunca produce una versión "más vieja" que la ya guardada. */
async function nextStamp(table: TableName, id: string): Promise<number> {
  const cur = (await db.table(table).get(id)) as Base | undefined;
  return Math.max(Date.now(), (cur?.updatedAt ?? 0) + 1);
}

export async function save<T extends Base>(table: TableName, row: T): Promise<T> {
  const stamped = { ...row, updatedAt: await nextStamp(table, row.id), dirty: 1 as const };
  validate(table, stamped);
  await db.table(table).put(stamped);
  notify();
  return stamped;
}

export async function softDelete(table: TableName, id: string): Promise<void> {
  await db.table(table).update(id, { deleted: 1, dirty: 1, updatedAt: await nextStamp(table, id) });
  notify();
}

const mine = <T extends Base>(rows: T[]): T[] => { const u = getUserId(); return rows.filter((r) => r.userId === u && !r.deleted); };

// ---------- Perfil ----------
export function defaultProfile(): Profile {
  return { ...newBase(), id: getUserId(), name: '', age: null, sex: '', heightCm: null, experience: 'intermediate', goal: 'hypertrophy', daysAvailable: 4, equipment: [], priorityMuscles: [], halfRir: false, indirectCoef: 0.5 };
}
export async function getProfile(): Promise<Profile> {
  return (await db.profiles.get(getUserId())) ?? defaultProfile();
}
export const saveProfile = (p: Profile) => save('profiles', { ...p, id: getUserId(), userId: getUserId() });
/** Cambia solo los campos indicados, leyendo el perfil vigente dentro de una transacción. */
/** Cambia ajustes de entrenamiento (ciclo, barra y discos, avisos) sin tocar el resto del perfil. */
export async function updateSettings(patch: Partial<Settings>): Promise<Profile> {
  const p = await getProfile();
  return saveProfile({ ...p, settings: { ...(p.settings ?? {}), ...patch } });
}
/** Guarda cuánto trabajo sintió un músculo en una sesión (1 poco, 2 justo, 3 demasiado; null lo borra). */
export async function rateSession(sessionId: string, at: number, muscle: string, value: number | null): Promise<Profile> {
  const p = await getProfile();
  const ratings = { ...(p.settings?.ratings ?? {}) };
  const m = { ...(ratings[sessionId]?.m ?? {}) };
  if (value == null) delete m[muscle]; else m[muscle] = value;
  if (Object.keys(m).length) ratings[sessionId] = { at, m }; else delete ratings[sessionId];
  return saveProfile({ ...p, settings: { ...(p.settings ?? {}), ratings: pruneRatings(ratings) } });
}
export function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  return db.transaction('rw', db.profiles, async () => saveProfile({ ...(await getProfile()), ...patch }));
}

// ---------- Ejercicios ----------
export async function getExercises(): Promise<ExerciseDef[]> {
  return mergeExercises(mine(await db.exercises.toArray()));
}
/** Guarda un ejercicio personalizado o un ajuste sobre uno de la biblioteca. */
export async function saveExercise(def: ExerciseDef): Promise<ExerciseDef> {
  const isBase = isLibraryId(def.id);
  const rows = mine(await db.exercises.toArray());
  const existing = rows.find((r) => (isBase ? r.baseId === def.id : r.id === def.id));
  const { id: _id, ...fields } = def;
  const row: ExerciseRow = { ...(existing ?? newBase()), ...fields, baseId: isBase ? def.id : null, custom: !isBase };
  if (!existing && !isBase) row.id = def.id || uid();
  await save('exercises', row);
  return { ...def, id: isBase ? def.id : row.id, custom: !isBase };
}
export async function deleteExercise(id: string): Promise<void> {
  const rows = mine(await db.exercises.toArray());
  const row = rows.find((r) => r.id === id || r.baseId === id);
  if (row) await softDelete('exercises', row.id);
}

// ---------- Rutinas ----------
export async function createRoutine(name: string, split = 'Personalizada', days: number[] = []): Promise<Routine> {
  const order = (await db.routines.count()) + 1;
  return save('routines', { ...newBase(), name, split, days, order } as Routine);
}
export const saveRoutine = (r: Routine) => save('routines', r);
export async function deleteRoutine(id: string): Promise<void> {
  const items = await db.routineItems.where('routineId').equals(id).toArray();
  await db.transaction('rw', db.routines, db.routineItems, async () => {
    for (const it of items) await db.routineItems.update(it.id, { deleted: 1, dirty: 1, updatedAt: Math.max(Date.now(), it.updatedAt + 1) });
    const r = await db.routines.get(id);
    await db.routines.update(id, { deleted: 1, dirty: 1, updatedAt: Math.max(Date.now(), (r?.updatedAt ?? 0) + 1) });
  });
  notify();
}
export async function getItems(routineId: string): Promise<RoutineItem[]> {
  return mine(await db.routineItems.where('routineId').equals(routineId).toArray()).sort((a, b) => a.order - b.order);
}
export async function addItem(routineId: string, exerciseId: string, over: Partial<Target> = {}): Promise<RoutineItem> {
  const ex = (await getExercises()).find((e) => e.id === exerciseId);
  const items = await getItems(routineId);
  const target = { ...defaultTarget(ex), ...over };
  return save('routineItems', { ...newBase(), routineId, exerciseId, order: items.length, superset: null, ...target } as RoutineItem);
}
export const saveItem = (it: RoutineItem) => save('routineItems', it);
export async function deleteItem(id: string): Promise<void> {
  const it = await db.routineItems.get(id);
  await softDelete('routineItems', id);
  if (it) await applyArrangement(it.routineId, (ids, groups) => ({ ids, groups }));
}

const groupsOfItems = (items: RoutineItem[]): string[][] => {
  const by = new Map<string, string[]>();
  for (const it of items) if (it.superset) (by.get(it.superset) ?? by.set(it.superset, []).get(it.superset)!).push(it.id);
  return [...by.values()];
};
/** Reordena y reagrupa los ejercicios de una rutina y guarda solo las filas que cambian. */
async function applyArrangement(routineId: string, fn: (ids: string[], groups: string[][]) => Arrangement): Promise<void> {
  const items = await getItems(routineId);
  const { ids, groups } = fn(items.map((i) => i.id), cleanGroups(items.map((i) => i.id), groupsOfItems(items)));
  const key = new Map<string, string>();
  for (const g of cleanGroups(ids, groups)) for (const id of g) key.set(id, g[0]);
  for (const [k, id] of ids.entries()) {
    const it = items.find((x) => x.id === id)!;
    const superset = key.get(id) ?? null;
    if (it.order !== k || (it.superset ?? null) !== superset) await save('routineItems', { ...it, order: k, superset });
  }
}
/** Mueve un ejercicio (o su biserie completa) un lugar hacia arriba o hacia abajo. */
export const moveItem = (routineId: string, id: string, dir: -1 | 1) => applyArrangement(routineId, (ids, groups) => moveUnit(ids, groups, id, dir));
/** Une un ejercicio de la rutina con otro para formar una biserie, o con una biserie para formar una triserie. */
export const groupItems = (routineId: string, dragId: string, targetId: string) => applyArrangement(routineId, (ids, groups) => joinGroup(ids, groups, dragId, targetId));
export const ungroupItem = (routineId: string, id: string) => applyArrangement(routineId, (ids, groups) => leaveGroup(ids, groups, id));

export async function createFromTemplate(templateId: string): Promise<Routine[]> {
  const t = TEMPLATES.find((x) => x.id === templateId);
  if (!t) throw new Error('Plantilla no encontrada');
  const out: Routine[] = [];
  for (const d of t.routines) {
    const r = await createRoutine(d.name, t.split, d.days);
    let order = 0;
    for (const e of d.exercises) {
      const [exerciseId, over] = typeof e === 'string' ? [e, {}] : e;
      await save('routineItems', { ...newBase(), routineId: r.id, exerciseId, order: order++, superset: null, ...targetFor(exerciseId, over) } as RoutineItem);
    }
    out.push(r);
  }
  return out;
}

/** Crea las rutinas de un plan generado. */
export async function createFromPlan(split: string, days: PlanDay[]): Promise<Routine[]> {
  const out: Routine[] = [];
  for (const d of days) {
    const r = await createRoutine(d.name, split, d.days);
    let order = 0;
    for (const [exerciseId, over] of d.exercises) await save('routineItems', { ...newBase(), routineId: r.id, exerciseId, order: order++, superset: null, ...targetFor(exerciseId, over) } as RoutineItem);
    out.push(r);
  }
  return out;
}

/** Datos de una rutina propia listos para compartir por enlace. */
export async function shareableRoutine(routineId: string): Promise<SharedRoutine | null> {
  const r = await db.routines.get(routineId);
  if (!r) return null;
  const items = await getItems(routineId);
  const exs = await getExercises();
  const keys = [...new Set(items.map((i) => i.superset).filter(Boolean))];
  return {
    name: r.name, split: r.split, days: r.days,
    items: items.map((i) => ({ exerciseId: i.exerciseId, group: i.superset ? keys.indexOf(i.superset) : null, target: { sets: i.sets, repMin: i.repMin, repMax: i.repMax, rirMin: i.rirMin, rirMax: i.rirMax, restSec: i.restSec } })),
    custom: items.map((i) => exs.find((e) => e.id === i.exerciseId)).filter((e): e is ExerciseDef => !!e && e.custom && !isLibraryId(e.id)).map((e) => ({ id: e.id, name: e.name, primary: e.primary, type: e.type, equipment: e.equipment })),
  };
}

const blankExercise = (name: string, primary: ExerciseDef['primary'], type: ExerciseDef['type'], equipment: ExerciseDef['equipment']): ExerciseDef => ({
  id: uid(), name: name.trim().slice(0, 80) || 'Ejercicio', primary, secondary: [], type, equipment, machine: '', focus: '', aka: '', measure: 'reps', category: 'strength',
  cues: [], mistakes: [], rom: '', execution: '', safety: '', increment: 2.5, photo: null, custom: true,
});

/** Añade a las rutinas propias una recibida por enlace. Los ejercicios propios de quien la compartió se crean aquí. */
export async function importSharedRoutine(sr: SharedRoutine): Promise<Routine> {
  const exs = await getExercises();
  const idMap = new Map<string, string>();
  for (const c of sr.custom) {
    const same = exs.find((e) => e.custom && e.name.toLowerCase() === c.name.toLowerCase());
    if (same) { idMap.set(c.id, same.id); continue; }
    const made = await saveExercise(blankExercise(c.name, c.primary, c.type, c.equipment));
    idMap.set(c.id, made.id);
  }
  const known = new Set((await getExercises()).map((e) => e.id));
  const r = await createRoutine(sr.name, sr.split || 'Compartida', sr.days);
  const groupKey = new Map<number, string>();
  let order = 0;
  for (const it of sr.items) {
    const exerciseId = idMap.get(it.exerciseId) ?? it.exerciseId;
    if (!known.has(exerciseId)) continue;
    const superset = it.group == null ? null : groupKey.get(it.group) ?? groupKey.set(it.group, uid()).get(it.group)!;
    await save('routineItems', { ...newBase(), routineId: r.id, exerciseId, order: order++, superset, ...it.target } as RoutineItem);
  }
  return r;
}

/** Guarda sesiones traídas de otra app. Las que ya existen (misma hora de inicio) se omiten. */
export async function importSessions(list: ImportedSession[]): Promise<{ sessions: number; sets: number; created: number; skipped: number }> {
  const existing = new Set(mine(await db.sessions.toArray()).map((s) => s.startedAt));
  let exs = await getExercises();
  const cache = new Map<string, ExerciseDef>();
  let sessions = 0, sets = 0, created = 0, skipped = 0;
  for (const src of list) {
    if (existing.has(src.start)) { skipped++; continue; }
    const rows: SetLog[] = []; const ids: string[] = []; const targets: Record<string, Target> = {};
    const base = newBase();
    for (const e of src.exercises) {
      let ex = cache.get(e.name) ?? matchExercise(e.name, exs) ?? undefined;
      if (!ex) { const g = guessExercise(e.name); ex = await saveExercise(blankExercise(e.name, g.primary, 'compound', g.equipment)); exs = [...exs, ex]; created++; }
      cache.set(e.name, ex);
      const work = e.sets.filter((s) => !s.warmup);
      if (!work.length || ids.includes(ex.id)) continue;
      ids.push(ex.id);
      const reps = work.map((s) => (ex!.measure === 'reps' ? s.reps : s.seconds || s.reps)).filter((n) => n > 0);
      if (!reps.length) { ids.pop(); continue; }
      targets[ex.id] = { ...defaultTarget(ex), sets: Math.min(12, work.length) };
      work.forEach((s, i) => {
        const n = ex!.measure === 'reps' ? s.reps : s.seconds || s.reps;
        if (n > 0) rows.push({ ...newBase(), sessionId: base.id, exerciseId: ex!.id, order: i, weight: s.weight, reps: n, rir: s.rir, rpe: rpeFromRir(s.rir), failure: s.rir === 0, endReason: s.rir === 0 ? 'momentary' : 'none', metTarget: true, done: true, completedAt: src.start, restSec: null, note: '', technique: '', sub: 0 });
      });
    }
    if (!rows.length) { skipped++; continue; }
    await save('sessions', { ...base, routineId: null, name: src.name.slice(0, 80), startedAt: src.start, endedAt: src.start + (src.durationMs || 0), status: 'done', pausedAt: null, pausedMs: 0, notes: 'Importada', exerciseIds: ids, targets, supersets: [] } as Session);
    for (const r of rows) await save('sets', r);
    sessions++; sets += rows.length;
  }
  return { sessions, sets, created, skipped };
}

// ---------- Historial enriquecido ----------
/** Todas las series completadas de sesiones del usuario, con la fecha de su sesión. */
export async function getDoneSets(includeActive = false): Promise<ASet[]> {
  const sessions = mine(await db.sessions.toArray()).filter((s) => includeActive || s.status === 'done');
  const byId = new Map(sessions.map((s) => [s.id, s]));
  return mine(await db.sets.toArray())
    .filter((s) => s.done && byId.has(s.sessionId))
    .map((s) => ({ sessionId: s.sessionId, exerciseId: s.exerciseId, date: byId.get(s.sessionId)!.startedAt, order: s.order, weight: s.weight, reps: s.reps, rir: s.rir, failure: s.failure, endReason: s.endReason, ...(s.sub ? { ext: true } : {}), ...(byId.get(s.sessionId)!.notes?.includes(DELOAD_TAG) ? { deload: true } : {}) }));
}

export async function recommendationFor(ex: ExerciseDef, target: Target, history?: ASet[]) {
  const sets = history ?? (await getDoneSets());
  const logs = mine(await db.recovery.toArray());
  return recommend({ exType: ex.type, increment: ex.increment, target, history: sessionsOf(sets, ex.id), readiness: recentReadiness(logs, Date.now()) });
}

// ---------- Sesiones ----------
export async function getActiveSession(): Promise<Session | undefined> {
  return mine(await db.sessions.toArray()).find((s) => s.status !== 'done');
}

async function presetSets(sessionId: string, ex: ExerciseDef, target: Target, history: ASet[], deload = false): Promise<SetLog[]> {
  const past = sessionsOf(history, ex.id);
  const rec = await recommendationFor(ex, target, history);
  const last = past[0];
  const lastW = last ? workWeight(last) : 0;
  // En la semana de descarga se baja la carga; las repeticiones parten del mínimo del rango.
  const weight = deload ? roundTo(deloadWeight(rec.weight ?? lastW), ex.increment) : rec.weight ?? lastW;
  const lastReps = last ? last.sets.filter((s) => s.weight === lastW).map((s) => s.reps) : [];
  return Array.from({ length: target.sets }, (_, i) => ({
    ...newBase(), sessionId, exerciseId: ex.id, order: i, weight,
    reps: !deload && weight === lastW && lastReps[i] != null ? clamp(lastReps[i], 1, 200) : target.repMin,
    rir: null, rpe: null, failure: false, endReason: 'none' as const, metTarget: false, done: false, completedAt: null, restSec: null, note: '', technique: '' as const, sub: 0,
  }));
}

let starting: Promise<Session> | null = null;
/** Inicia una sesión. Dos toques seguidos comparten la misma: nunca quedan dos sesiones abiertas. */
export function startSession(routineId: string | null): Promise<Session> {
  starting ??= createSession(routineId).finally(() => { starting = null; });
  return starting;
}
async function createSession(routineId: string | null): Promise<Session> {
  const active = await getActiveSession();
  if (active) return active;
  const exercises = await getExercises();
  const history = await getDoneSets();
  const routine = routineId ? await db.routines.get(routineId) : undefined;
  // Se omiten ejercicios que ya no existen (p. ej. uno propio eliminado después de armar la rutina).
  const items = (routineId ? await getItems(routineId) : []).filter((i) => exercises.some((e) => e.id === i.exerciseId));
  // Con un ciclo activo, el objetivo del día depende de la semana: RIR que baja semana a semana y descarga al final.
  const settings = (await getProfile()).settings;
  const cycle = settings?.cycle;
  const info = cycleInfo(cycle);
  const session: Session = {
    ...newBase(), routineId, name: routine?.name ?? 'Entrenamiento libre', startedAt: Date.now(), endedAt: null, status: 'active', pausedAt: null, pausedMs: 0, notes: info?.deload ? DELOAD_TAG : '',
    exerciseIds: items.map((i) => i.exerciseId),
    targets: Object.fromEntries(items.map((i) => [i.exerciseId, cycleTarget({ sets: i.sets, repMin: i.repMin, repMax: i.repMax, rirMin: i.rirMin, rirMax: i.rirMax, restSec: i.restSec }, info, !!cycle?.deload)])),
    supersets: cleanGroups(items.map((i) => i.exerciseId), groupsOfItems(items).map((g) => g.map((id) => items.find((i) => i.id === id)?.exerciseId ?? ''))),
  };
  // Valoración de las últimas sesiones: una serie más o una menos en el primer ejercicio del músculo (no en descarga).
  const adj: Record<string, number> = {};
  if (!info?.deload) {
    const seen = new Set<string>();
    for (const it of items) {
      const ex = exercises.find((e) => e.id === it.exerciseId);
      if (!ex || seen.has(ex.primary)) continue;
      seen.add(ex.primary);
      const d = volumeDelta(ex.primary, settings?.ratings);
      const t = session.targets[ex.id];
      if (d && t && t.sets + d >= 1 && t.sets + d <= 12) { session.targets[ex.id] = { ...t, sets: t.sets + d }; adj[ex.id] = d; }
    }
  }
  try { localStorage.setItem(ADJ_KEY, JSON.stringify({ id: session.id, adj })); } catch { /* sin almacenamiento */ }
  await save('sessions', session);
  for (const it of items) {
    const ex = exercises.find((e) => e.id === it.exerciseId);
    if (!ex) continue;
    for (const s of await presetSets(session.id, ex, session.targets[ex.id], history, !!info?.deload)) await save('sets', s);
  }
  return session;
}

export async function addExerciseToSession(sessionId: string, exerciseId: string): Promise<void> {
  const session = await db.sessions.get(sessionId);
  const ex = (await getExercises()).find((e) => e.id === exerciseId);
  if (!session || !ex || session.exerciseIds.includes(exerciseId)) return;
  const target = defaultTarget(ex);
  await save('sessions', { ...session, exerciseIds: [...session.exerciseIds, exerciseId], targets: { ...session.targets, [exerciseId]: target } });
  for (const s of await presetSets(sessionId, ex, target, await getDoneSets())) await save('sets', s);
}

export async function removeExerciseFromSession(sessionId: string, exerciseId: string): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) return;
  const sets = (await db.sets.where('sessionId').equals(sessionId).toArray()).filter((s) => s.exerciseId === exerciseId);
  for (const s of sets) await softDelete('sets', s.id);
  const { [exerciseId]: _drop, ...targets } = session.targets;
  const exerciseIds = session.exerciseIds.filter((x) => x !== exerciseId);
  await save('sessions', { ...session, exerciseIds, targets, supersets: cleanGroups(exerciseIds, session.supersets) });
}

/** Une dos ejercicios de la sesión en una biserie (o suma un tercero a una biserie). */
export function groupInSession(sessionId: string, dragId: string, targetId: string): Promise<void> {
  return db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(sessionId);
    if (!s) return;
    const { ids, groups } = joinGroup(s.exerciseIds, s.supersets, dragId, targetId);
    await save('sessions', { ...s, exerciseIds: ids, supersets: groups });
  });
}
export function ungroupInSession(sessionId: string, exerciseId: string): Promise<void> {
  return db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(sessionId);
    if (!s) return;
    const { ids, groups } = leaveGroup(s.exerciseIds, s.supersets, exerciseId);
    await save('sessions', { ...s, exerciseIds: ids, supersets: groups });
  });
}

export function updateSessionTarget(sessionId: string, exerciseId: string, patch: Partial<Target>): Promise<void> {
  return db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(sessionId);
    if (s) await save('sessions', { ...s, targets: { ...s.targets, [exerciseId]: { ...s.targets[exerciseId], ...patch } } });
  });
}

export async function pauseSession(id: string): Promise<void> {
  const s = await db.sessions.get(id);
  if (s && s.status === 'active') await save('sessions', { ...s, status: 'paused', pausedAt: Date.now() });
}
export async function resumeSession(id: string): Promise<void> {
  const s = await db.sessions.get(id);
  if (s && s.status === 'paused') await save('sessions', { ...s, status: 'active', pausedMs: s.pausedMs + (Date.now() - (s.pausedAt ?? Date.now())), pausedAt: null });
}
export function elapsedMs(s: Session, now = Date.now()): number {
  const end = s.endedAt ?? now;
  const paused = s.pausedMs + (s.status === 'paused' && s.pausedAt ? now - s.pausedAt : 0);
  return Math.max(0, end - s.startedAt - paused);
}

/** Finaliza la sesión. Las series no completadas se descartan. Si no hubo ninguna, se descarta la sesión. */
export async function finishSession(id: string): Promise<Session | null> {
  const s = await db.sessions.get(id);
  if (!s) return null;
  const sets = mine(await db.sets.where('sessionId').equals(id).toArray());
  for (const x of sets.filter((x) => !x.done)) await softDelete('sets', x.id);
  if (!sets.some((x) => x.done)) { await softDelete('sessions', id); return null; }
  const now = Date.now();
  const pausedMs = s.pausedMs + (s.status === 'paused' && s.pausedAt ? now - s.pausedAt : 0);
  return save<Session>('sessions', { ...s, status: 'done', endedAt: now, pausedAt: null, pausedMs });
}

export async function deleteSession(id: string): Promise<void> {
  const sets = await db.sets.where('sessionId').equals(id).toArray();
  for (const x of sets) await db.sets.update(x.id, { deleted: 1, dirty: 1, updatedAt: Math.max(Date.now(), x.updatedAt + 1) });
  await softDelete('sessions', id);
}

// ---------- Series ----------
export async function getSessionSets(sessionId: string): Promise<SetLog[]> {
  // Las series guardadas antes de las técnicas avanzadas no traen `technique` ni `sub`.
  return mine(await db.sets.where('sessionId').equals(sessionId).toArray())
    .map((s) => (s.sub == null || s.technique == null ? { ...s, sub: s.sub ?? 0, technique: s.technique ?? '' } : s))
    .sort((a, b) => a.order - b.order || a.sub - b.sub);
}

export async function addSet(sessionId: string, exerciseId: string): Promise<SetLog> {
  const all = (await getSessionSets(sessionId)).filter((s) => s.exerciseId === exerciseId && !s.sub);
  const prev = all[all.length - 1];
  const session = await db.sessions.get(sessionId);
  const t = session?.targets[exerciseId];
  return save('sets', {
    ...newBase(), sessionId, exerciseId, order: prev ? prev.order + 1 : 0, weight: prev?.weight ?? 0, reps: prev?.reps ?? t?.repMin ?? 10,
    rir: null, rpe: null, failure: false, endReason: 'none', metTarget: false, done: false, completedAt: null, restSec: null, note: '', technique: '', sub: 0,
  } as SetLog);
}

/** Añade un tramo de técnica avanzada (bajada de dropset, pausa de descanso-pausa…) a continuación de una serie. */
export async function addExtension(setId: string, technique: Exclude<Technique, ''>, increment: number): Promise<SetLog> {
  const parent = await db.sets.get(setId);
  if (!parent) throw new ValidationError('La serie ya no existe');
  const family = (await getSessionSets(parent.sessionId)).filter((s) => s.exerciseId === parent.exerciseId && s.order === parent.order);
  if (family.length > 6) throw new ValidationError('Una serie admite hasta seis tramos');
  const last = family[family.length - 1];
  const info = TECHNIQUE[technique];
  const inc = increment > 0 ? increment : 2.5;
  // La bajada parte de la carga del último tramo, redondeada hacia abajo al paso de la máquina.
  const weight = info.weight === 1 ? last.weight : Math.max(0, Math.floor((last.weight * info.weight) / inc + 1e-9) * inc);
  return save('sets', {
    ...newBase(), sessionId: parent.sessionId, exerciseId: parent.exerciseId, order: parent.order, sub: last.sub + 1, technique,
    weight: Math.round(weight * 100) / 100, reps: info.reps(last.reps), rir: null, rpe: null, failure: false, endReason: 'none',
    metTarget: true, done: false, completedAt: null, restSec: null, note: '',
  } as SetLog);
}

export function updateSet(id: string, patch: Partial<SetLog>): Promise<SetLog> {
  // Transacción: lee y escribe de forma atómica, así dos toques rápidos (p. ej. peso y RIR) no se pisan entre sí.
  return db.transaction('rw', db.sets, db.sessions, async () => {
    const s = await db.sets.get(id);
    if (!s) throw new ValidationError('La serie ya no existe');
    const next = { ...s, ...patch };
    // Coherencia entre RIR, RPE y fallo.
    if ('rir' in patch) {
      next.rpe = rpeFromRir(next.rir);
      if (next.rir === 0 && next.endReason === 'none') { next.failure = true; next.endReason = 'momentary'; }
      if (next.rir != null && next.rir > 0 && next.endReason === 'momentary') { next.failure = false; next.endReason = 'none'; }
    }
    if ('endReason' in patch) next.failure = next.endReason === 'momentary' || next.endReason === 'technical';
    if (next.done) {
      const session = await db.sessions.get(s.sessionId);
      const t = session?.targets[s.exerciseId];
      // Los tramos de una técnica no se comparan con el rango objetivo.
      next.metTarget = t && !next.sub ? next.reps >= t.repMin : true;
    }
    const saved = await save('sets', next);
    // Las series siguientes que aún no se hacen y traían el mismo valor siguen el cambio:
    // al anotar 60 kg en la primera, las demás quedan preparadas con 60 kg en vez de volver a pedirlo.
    const dw = next.weight !== s.weight, dr = next.reps !== s.reps;
    if (!s.sub && (dw || dr)) {
      const later = (await db.sets.where('sessionId').equals(s.sessionId).toArray())
        .filter((x) => x.exerciseId === s.exerciseId && !x.deleted && !x.done && !x.sub && x.order > s.order);
      for (const x of later) {
        const follow: Partial<SetLog> = {};
        if (dw && x.weight === s.weight) follow.weight = next.weight;
        if (dr && x.reps === s.reps) follow.reps = next.reps;
        if (Object.keys(follow).length) await save('sets', { ...x, ...follow });
      }
    }
    return saved;
  });
}

export async function completeSet(id: string): Promise<SetLog> {
  const s = await db.sets.get(id);
  if (!s) throw new ValidationError('La serie ya no existe');
  if (s.reps < 1) throw new ValidationError('Registra al menos 1 repetición');
  const now = Date.now();
  const others = (await getSessionSets(s.sessionId)).filter((x) => x.done && x.completedAt);
  const lastDone = Math.max(0, ...others.map((x) => x.completedAt as number));
  const rest = lastDone && now - lastDone < 30 * 60000 ? Math.round((now - lastDone) / 1000) : null;
  return updateSet(id, { done: true, completedAt: now, restSec: rest, rpe: s.rpe ?? rpeFromRir(s.rir) });
}
export const uncompleteSet = (id: string) => updateSet(id, { done: false, completedAt: null, restSec: null });
/** Elimina una serie. Si es la principal, se van también sus tramos de técnica. */
export async function deleteSet(id: string): Promise<void> {
  const s = await db.sets.get(id);
  if (s && !s.sub) {
    const kids = (await getSessionSets(s.sessionId)).filter((x) => x.exerciseId === s.exerciseId && x.order === s.order && x.sub > 0);
    for (const k of kids) await softDelete('sets', k.id);
  }
  await softDelete('sets', id);
}

/** Reemplaza las series pendientes de un ejercicio por una copia de la sesión anterior. */
export async function copyLastSession(sessionId: string, exerciseId: string): Promise<boolean> {
  const last = sessionsOf(await getDoneSets(), exerciseId)[0];
  if (!last) return false;
  const cur = (await getSessionSets(sessionId)).filter((s) => s.exerciseId === exerciseId);
  for (const s of cur.filter((s) => !s.done)) await softDelete('sets', s.id);
  const doneCount = cur.filter((s) => s.done && !s.sub).length;
  let order = Math.max(-1, ...cur.map((s) => s.order)) + 1;
  for (const p of last.sets.slice(doneCount)) {
    await save('sets', { ...newBase(), sessionId, exerciseId, order: order++, weight: p.weight, reps: p.reps, rir: null, rpe: null, failure: false, endReason: 'none', metTarget: false, done: false, completedAt: null, restSec: null, note: '', technique: '', sub: 0 } as SetLog);
  }
  return true;
}

// ---------- Recuperación y peso corporal ----------
export async function saveRecovery(vals: Omit<RecoveryLog, keyof Base | 'date'>, date = ymd(Date.now())): Promise<RecoveryLog> {
  const existing = mine(await db.recovery.where('date').equals(date).toArray())[0];
  return save('recovery', { ...(existing ?? newBase()), ...vals, date } as RecoveryLog);
}
/** Medidas corporales del día: se combinan con las ya anotadas ese día; un valor 0 borra esa medida. */
export async function saveMeasures(values: Record<string, number>, date = ymd(Date.now())): Promise<BodyMeasure> {
  const existing = mine(await db.measures.where('date').equals(date).toArray())[0];
  const merged = Object.fromEntries(Object.entries({ ...(existing?.values ?? {}), ...values }).filter(([, v]) => v > 0));
  return save('measures', { ...(existing ?? newBase()), date, values: merged } as BodyMeasure);
}
export async function saveBodyWeight(kg: number, date = ymd(Date.now())): Promise<BodyWeight> {
  const existing = mine(await db.bodyWeights.where('date').equals(date).toArray())[0];
  return save('bodyWeights', { ...(existing ?? newBase()), kg, date } as BodyWeight);
}

export { mine };
