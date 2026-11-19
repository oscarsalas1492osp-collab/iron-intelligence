// Sincronización local ⇄ Supabase (opcional).
//
// Estrategia: local-first. La app siempre lee y escribe en IndexedDB; cuando hay cuenta y conexión,
// este módulo baja los cambios remotos y sube las filas marcadas como `dirty`.
// Conflictos: gana la última escritura (campo updatedAt). Los borrados son lógicos para que se propaguen.
// El cursor de descarga usa `synced_at`, que asigna el servidor, así no depende del reloj de cada dispositivo.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Base } from '../domain/types';
import { TABLES, type TableName } from '../domain/validation';
import { db, getUserId, setUserId } from './db';

export const REMOTE_TABLE: Record<TableName, string> = {
  profiles: 'profiles', exercises: 'exercises', routines: 'routines', routineItems: 'routine_items',
  sessions: 'sessions', sets: 'set_logs', recovery: 'recovery_logs', bodyWeights: 'body_weights',
};

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function toRemote(row: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (k !== 'dirty') out[snake(k)] = v;
  return out;
}
export function fromRemote(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { dirty: 0 };
  for (const [k, v] of Object.entries(row)) if (k !== 'synced_at') out[camel(k)] = v;
  return out;
}

/** Interfaz mínima del servidor: permite probar la sincronización sin red. */
export interface RemoteClient {
  upsert(table: string, rows: Record<string, unknown>[]): Promise<void>;
  /** Filas con synced_at posterior al cursor, ordenadas por synced_at. */
  pull(table: string, since: string | null): Promise<Record<string, unknown>[]>;
}

export interface SyncResult { pulled: number; pushed: number }

export async function syncAll(client: RemoteClient, userId: string): Promise<SyncResult> {
  let pulled = 0, pushed = 0;
  for (const t of TABLES) {
    const table = db.table<Base & Record<string, unknown>, string>(t);
    const cursorKey = `cursor:${userId}:${t}`;
    const since = ((await db.meta.get(cursorKey))?.value as string | undefined) ?? null;

    // 1) Bajar: aplica la fila remota solo si es más nueva que la local.
    const remote = await client.pull(REMOTE_TABLE[t], since);
    let cursor = since;
    for (const r of remote) {
      const row = fromRemote(r) as Base & Record<string, unknown>;
      const local = await table.get(row.id);
      if (!local || row.updatedAt > local.updatedAt) { await table.put(row); pulled++; }
      const s = r.synced_at as string | undefined;
      if (s && (!cursor || s > cursor)) cursor = s;
    }
    if (cursor && cursor !== since) await db.meta.put({ key: cursorKey, value: cursor });

    // 2) Subir lo pendiente.
    const dirty = (await table.where('dirty').equals(1).toArray()).filter((r) => r.userId === userId);
    if (dirty.length) {
      await client.upsert(REMOTE_TABLE[t], dirty.map(toRemote));
      // Solo se limpia la marca si la fila no cambió mientras se subía.
      await db.transaction('rw', table, async () => {
        for (const d of dirty) {
          const cur = await table.get(d.id);
          if (cur && cur.updatedAt === d.updatedAt) await table.update(d.id, { dirty: 0 } as never);
        }
      });
      pushed += dirty.length;
    }
  }
  return { pulled, pushed };
}

/** Al crear o iniciar sesión, los datos registrados sin cuenta pasan a pertenecer al usuario. */
export async function claimLocalData(userId: string): Promise<void> {
  for (const t of TABLES) {
    const table = db.table<Base & Record<string, unknown>, string>(t);
    const rows = await table.where('userId').equals('local').toArray();
    for (const r of rows) {
      if (t === 'profiles') {
        await table.delete(r.id);
        if (!(await table.get(userId))) await table.put({ ...r, id: userId, userId, dirty: 1, updatedAt: Date.now() });
      } else {
        await table.update(r.id, { userId, dirty: 1, updatedAt: Date.now() } as never);
      }
    }
  }
}

// ---------- Supabase ----------
const SB_URL = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;
export const cloudEnabled = Boolean(SB_URL && ANON);
export const supabase: SupabaseClient | null = cloudEnabled ? createClient(SB_URL!, ANON!) : null;

export function supabaseRemote(sb: SupabaseClient): RemoteClient {
  return {
    async upsert(table, rows) {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await sb.from(table).upsert(rows.slice(i, i + 500), { onConflict: 'id' });
        if (error) throw new Error(`No se pudo subir ${table}: ${error.message}`);
      }
    },
    async pull(table, since) {
      const out: Record<string, unknown>[] = [];
      let cursor = since;
      for (;;) {
        let q = sb.from(table).select('*').order('synced_at', { ascending: true }).limit(1000);
        if (cursor) q = q.gt('synced_at', cursor);
        const { data, error } = await q;
        if (error) throw new Error(`No se pudo descargar ${table}: ${error.message}`);
        if (!data?.length) break;
        out.push(...data);
        cursor = data[data.length - 1].synced_at as string;
        if (data.length < 1000) break;
      }
      return out;
    },
  };
}

export interface SyncState { status: 'local' | 'idle' | 'syncing' | 'error' | 'offline'; lastSync: number | null; error: string | null }
let state: SyncState = { status: cloudEnabled ? 'idle' : 'local', lastSync: null, error: null };
const subs = new Set<() => void>();
export const getSyncState = () => state;
export const subscribeSync = (cb: () => void) => { subs.add(cb); return () => subs.delete(cb); };
const setState = (p: Partial<SyncState>) => { state = { ...state, ...p }; subs.forEach((s) => s()); };

let running = false;
export async function syncNow(): Promise<void> {
  const uid = getUserId();
  if (!supabase || uid === 'local' || running) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { setState({ status: 'offline' }); return; }
  running = true;
  setState({ status: 'syncing', error: null });
  try {
    await syncAll(supabaseRemote(supabase), uid);
    setState({ status: 'idle', lastSync: Date.now() });
  } catch (e) {
    setState({ status: 'error', error: e instanceof Error ? e.message : 'Error de sincronización' });
  } finally {
    running = false;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
export function scheduleSync(delay = 2500): void {
  if (!supabase || getUserId() === 'local') return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('La sincronización en la nube no está configurada');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(error?.message ?? 'No se pudo iniciar sesión');
  await claimLocalData(data.user.id);
  setUserId(data.user.id);
  await syncNow();
}
export async function signUp(email: string, password: string): Promise<'ok' | 'confirm'> {
  if (!supabase) throw new Error('La sincronización en la nube no está configurada');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (!data.session || !data.user) return 'confirm';
  await claimLocalData(data.user.id);
  setUserId(data.user.id);
  await syncNow();
  return 'ok';
}
export async function signOut(): Promise<void> {
  await syncNow();
  await supabase?.auth.signOut();
  setUserId('local');
}
/** Restaura la sesión guardada al abrir la app. */
export async function restoreAuth(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id ?? null;
  if (uid && getUserId() !== uid) setUserId(uid);
  if (!uid && getUserId() !== 'local') setUserId('local');
  return data.session?.user.email ?? null;
}
