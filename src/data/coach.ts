// Modo entrenador. El deportista invita con un código; hasta que lo crea y el entrenador lo acepta, nadie ve nada.
// El entrenador ve entrenamientos, series, rutinas y ejercicios propios del deportista, y puede enviarle rutinas.
// No ve recuperación, peso corporal, medidas ni perfil. Todo se consulta en línea: nada del deportista se guarda
// en el dispositivo del entrenador.
import { DAY, uid } from '../domain/calc';
import type { ExerciseRow, Routine, RoutineItem, Session } from '../domain/types';
import type { ASet } from '../domain/volume';
import { db, getUserId } from './db';
import { fromRemote, supabase, toRemote } from './sync';

export interface CoachLink { id: string; client_id: string; coach_id: string | null; code: string; client_name: string; coach_name: string; created_at: string; accepted_at: string | null }

const KEY = 'ii_coach';
export const coachKnown = (): boolean => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
/** ¿El servidor tiene activado el modo entrenador? La entrada del menú aparece solo cuando lo está. */
export async function coachAvailable(): Promise<boolean> {
  if (!supabase || getUserId() === 'local') return false;
  try {
    const { error } = await supabase.from('coach_links').select('id').limit(1);
    try { localStorage.setItem(KEY, error ? '0' : '1'); } catch { /* sin almacenamiento */ }
    return !error;
  } catch { return coachKnown(); }
}

function sb() {
  if (!supabase || getUserId() === 'local') throw new Error('Inicia sesión con tu cuenta para usar el modo entrenador');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('El modo entrenador necesita conexión');
  return supabase;
}
const fail = (m: string | undefined): never => {
  const t = (m ?? '').toLowerCase();
  throw new Error(t.includes('invalid_code') ? 'El código no existe, ya se usó o venció' : t.includes('own_code') ? 'Ese código es tuyo: compártelo con tu entrenador' : t.includes('fetch') ? 'No se pudo conectar con el servidor' : m || 'No se pudo completar la operación');
};

export async function myLinks(): Promise<{ asClient: CoachLink[]; asCoach: CoachLink[] }> {
  const me = getUserId();
  const { data, error } = await sb().from('coach_links').select('*').order('created_at', { ascending: false });
  if (error) fail(error.message);
  const rows = (data ?? []) as CoachLink[];
  return { asClient: rows.filter((l) => l.client_id === me), asCoach: rows.filter((l) => l.coach_id === me) };
}
const newCode = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = crypto.getRandomValues(new Uint8Array(8)); return [...b].map((x) => a[x % a.length]).join(''); };
/** El deportista crea una invitación de un solo uso, válida 7 días. */
export async function createInvite(name: string): Promise<CoachLink> {
  const { data, error } = await sb().from('coach_links').insert({ code: newCode(), client_name: name.trim().slice(0, 60) }).select().single();
  if (error || !data) fail(error?.message);
  return data as CoachLink;
}
export async function acceptInvite(code: string, name: string): Promise<void> {
  const { error } = await sb().rpc('accept_coach_invite', { p_code: code, p_name: name.trim().slice(0, 60) });
  if (error) fail(error.message);
}
/** Quita el vínculo: lo puede hacer cualquiera de los dos y corta el acceso al instante. */
export async function removeLink(id: string): Promise<void> {
  const { error } = await sb().from('coach_links').delete().eq('id', id);
  if (error) fail(error.message);
}

export interface ClientData { sessions: Session[]; sets: ASet[]; custom: ExerciseRow[]; setCount: Map<string, number> }
/** Entrenamientos terminados del deportista en las últimas semanas, con sus series. */
export async function clientData(clientId: string, weeks = 8): Promise<ClientData> {
  const s = sb();
  const ss = await s.from('sessions').select('*').eq('user_id', clientId).eq('deleted', 0).eq('status', 'done').gte('started_at', Date.now() - weeks * 7 * DAY).order('started_at', { ascending: false }).limit(200);
  if (ss.error) fail(ss.error.message);
  const sessions = (ss.data ?? []).map((r) => fromRemote(r) as unknown as Session);
  const byId = new Map(sessions.map((x) => [x.id, x]));
  const sets: ASet[] = []; const setCount = new Map<string, number>();
  const ids = [...byId.keys()];
  for (let i = 0; i < ids.length; i += 40) {
    const r = await s.from('set_logs').select('*').eq('user_id', clientId).eq('deleted', 0).eq('done', true).in('session_id', ids.slice(i, i + 40)).limit(5000);
    if (r.error) fail(r.error.message);
    for (const raw of r.data ?? []) {
      const x = fromRemote(raw) as unknown as { sessionId: string; exerciseId: string; order: number; weight: number; reps: number; rir: number | null; failure: boolean; endReason: ASet['endReason']; sub?: number };
      sets.push({ sessionId: x.sessionId, exerciseId: x.exerciseId, date: byId.get(x.sessionId)!.startedAt, order: x.order, weight: Number(x.weight), reps: x.reps, rir: x.rir == null ? null : Number(x.rir), failure: x.failure, endReason: x.endReason, ...(x.sub ? { ext: true } : {}) });
      if (!x.sub) setCount.set(x.sessionId, (setCount.get(x.sessionId) ?? 0) + 1);
    }
  }
  const ex = await s.from('exercises').select('*').eq('user_id', clientId).eq('deleted', 0);
  if (ex.error) fail(ex.error.message);
  return { sessions, sets, custom: (ex.data ?? []).map((r) => fromRemote(r) as unknown as ExerciseRow), setCount };
}

/** Envía al deportista una copia de una rutina propia (con los ejercicios propios que use). Le llega al sincronizar. */
export async function sendRoutine(clientId: string, routineId: string): Promise<void> {
  const s = sb();
  const routine = (await db.routines.get(routineId)) as Routine | undefined;
  if (!routine) throw new Error('La rutina ya no existe');
  const items = ((await db.routineItems.where('routineId').equals(routineId).toArray()) as RoutineItem[]).filter((i) => !i.deleted).sort((a, b) => a.order - b.order);
  if (!items.length) throw new Error('La rutina no tiene ejercicios');
  const now = Date.now(); const rid = uid();
  const idMap = new Map<string, string>(); const exRows: Record<string, unknown>[] = [];
  for (const it of items) {
    const row = (await db.exercises.get(it.exerciseId)) as ExerciseRow | undefined;
    if (!row || row.deleted || row.baseId || idMap.has(row.id)) continue;
    const id = uid(); idMap.set(row.id, id);
    exRows.push({ ...toRemote(row), id, user_id: clientId, updated_at: now, deleted: 0, photo: null });
  }
  if (exRows.length) { const r = await s.from('exercises').insert(exRows); if (r.error) fail(r.error.message); }
  const r1 = await s.from('routines').insert({ ...toRemote(routine), id: rid, user_id: clientId, updated_at: now, deleted: 0, order: now });
  if (r1.error) fail(r1.error.message);
  const r2 = await s.from('routine_items').insert(items.map((it) => ({ ...toRemote(it), id: uid(), routine_id: rid, exercise_id: idMap.get(it.exerciseId) ?? it.exerciseId, user_id: clientId, updated_at: now, deleted: 0 })));
  if (r2.error) fail(r2.error.message);
}
