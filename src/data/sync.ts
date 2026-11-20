// Sincronización local ⇄ Supabase (opcional).
//
// Estrategia: local-first. La app siempre lee y escribe en IndexedDB; cuando hay cuenta y conexión,
// este módulo baja los cambios remotos y sube las filas marcadas como `dirty`.
// Conflictos: gana la última escritura (campo updatedAt). Los borrados son lógicos para que se propaguen.
// El cursor de descarga usa `synced_at`, que asigna el servidor, así no depende del reloj de cada dispositivo.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Base } from '../domain/types';
import { schemas, TABLES, type TableName } from '../domain/validation';
import { db, getUserId, setUserId } from './db';

export const REMOTE_TABLE: Record<TableName, string> = {
  profiles: 'profiles', exercises: 'exercises', routines: 'routines', routineItems: 'routine_items',
  sessions: 'sessions', sets: 'set_logs', recovery: 'recovery_logs', bodyWeights: 'body_weights', measures: 'body_measures',
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

/**
 * Deja la fila con la forma actual antes de subirla. Las filas guardadas por versiones anteriores no traen los
 * campos añadidos después (biseries, técnicas…): sin completarlos, el servidor rechaza la subida entera.
 */
const LEGACY: Partial<Record<TableName, Record<string, unknown>>> = {
  profiles: { settings: {} },
  sessions: { supersets: [] },
  sets: { technique: '', sub: 0 },
  routineItems: { superset: null },
  exercises: { focus: '', aka: '', measure: 'reps', category: 'strength' },
};
export function normalize(table: TableName, row: Base & Record<string, unknown>): Base & Record<string, unknown> {
  const filled = { ...row };
  for (const [k, v] of Object.entries(LEGACY[table] ?? {})) if (filled[k] == null && v != null) filled[k] = v; else if (!(k in filled)) filled[k] = v;
  const r = schemas[table].safeParse(filled);
  return r.success ? (r.data as Base & Record<string, unknown>) : filled;
}

export async function syncAll(client: RemoteClient, userId: string): Promise<SyncResult> {
  let pulled = 0, pushed = 0;
  const failures: string[] = [];
  for (const t of TABLES) {
    const table = db.table<Base & Record<string, unknown>, string>(t);
    const cursorKey = `cursor:${userId}:${t}`;
    try {
      const since = ((await db.meta.get(cursorKey))?.value as string | undefined) ?? null;

      // 1) Bajar: aplica la fila remota solo si es más nueva que la local.
      const remote = await client.pull(REMOTE_TABLE[t], since);
      let cursor = since;
      for (const r of remote) {
        const row = fromRemote(r) as Base & Record<string, unknown>;
        // Leer y escribir en una sola transacción: un cambio local hecho en ese instante no queda pisado.
        await db.transaction('rw', table, async () => {
          const local = await table.get(row.id);
          if (!local || row.updatedAt > local.updatedAt) { await table.put(row); pulled++; }
        });
        const s = r.synced_at as string | undefined;
        if (s && (!cursor || s > cursor)) cursor = s;
      }
      if (cursor && cursor !== since) await db.meta.put({ key: cursorKey, value: cursor });

      // 2) Subir lo pendiente.
      const dirty = (await table.where('dirty').equals(1).toArray()).filter((r) => r.userId === userId);
      if (!dirty.length) continue;
      let sent = dirty;
      try {
        await client.upsert(REMOTE_TABLE[t], dirty.map((d) => toRemote(normalize(t, d))));
      } catch (e) {
        // Si el lote falla, se sube fila por fila: una sola fila con problemas no bloquea a las demás.
        sent = [];
        let last: unknown = e;
        for (const d of dirty) {
          try { await client.upsert(REMOTE_TABLE[t], [toRemote(normalize(t, d))]); sent.push(d); } catch (e1) { last = e1; }
        }
        if (sent.length < dirty.length) failures.push(last instanceof Error ? last.message : String(last));
      }
      // Solo se limpia la marca si la fila no cambió mientras se subía.
      await db.transaction('rw', table, async () => {
        for (const d of sent) {
          const cur = await table.get(d.id);
          if (cur && cur.updatedAt === d.updatedAt) await table.update(d.id, { dirty: 0 } as never);
        }
      });
      pushed += sent.length;
    } catch (e) {
      // Un fallo en una tabla no impide sincronizar las siguientes.
      failures.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (failures.length) throw new Error(failures[0]);
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

/**
 * Si Google (u otro proveedor) devuelve un error, llega en la dirección de retorno. Se lee antes de crear el
 * cliente y se limpia la dirección, para que la app abra en su pantalla normal y pueda avisar qué pasó.
 */
function readReturnError(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const { hash, search, origin, pathname } = window.location;
    const inHash = new URLSearchParams(hash.startsWith('#') && !hash.startsWith('#/') ? hash.slice(1) : '');
    const params = inHash.get('error') || inHash.get('error_code') ? inHash : new URLSearchParams(search);
    const code = params.get('error_code') ?? params.get('error');
    if (!code) return null;
    const detail = (params.get('error_description') ?? '').replace(/\+/g, ' ');
    window.history.replaceState(null, '', origin + pathname);
    return oauthMessage(code, detail);
  } catch { return null; }
}
export function oauthMessage(code: string, detail: string): string {
  const m = `${code} ${detail}`.toLowerCase();
  if (m.includes('access_denied')) return 'No se completó el inicio de sesión con Google. Puedes intentarlo de nuevo.';
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) return 'El inicio de sesión con Google aún no está activado en el servidor.';
  if (m.includes('signup') && m.includes('disabled')) return 'El registro de cuentas nuevas está desactivado en el servidor.';
  return `No se pudo iniciar sesión con Google${detail ? `: ${detail}` : ''}`;
}
let returnError = readReturnError();
/** Devuelve una sola vez el error con que volvió el proveedor, si lo hubo. */
export function takeReturnError(): string | null { const e = returnError; returnError = null; return e; }

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

export const SESSION_EXPIRED = 'La sesión caducó: vuelve a iniciar sesión para sincronizar. Tus datos siguen guardados en este dispositivo.';
let running = false;
export async function syncNow(): Promise<void> {
  const uid = getUserId();
  if (!supabase || uid === 'local' || running) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) { setState({ status: 'offline' }); return; }
  running = true;
  setState({ status: 'syncing', error: null });
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error(SESSION_EXPIRED);
    await syncAll(supabaseRemote(supabase), uid);
    setState({ status: 'idle', lastSync: Date.now() });
  } catch (e) {
    setState({ status: 'error', error: e instanceof Error && e.message === SESSION_EXPIRED ? SESSION_EXPIRED : authMessage(e) });
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

/** Traduce los errores de autenticación y de red a mensajes claros. */
export function authMessage(e: unknown): string {
  const m = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase();
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos';
  if (m.includes('email not confirmed')) return 'Tu correo aún no está confirmado: abre el enlace que te enviamos y vuelve a entrar';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Ese correo ya tiene una cuenta: usa “Iniciar sesión”';
  if (m.includes('password should be') || m.includes('weak password')) return 'La contraseña es demasiado débil: usa al menos 8 caracteres';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'Demasiados intentos seguidos: espera un minuto y vuelve a probar';
  if (m.includes('invalid') && m.includes('email')) return 'El correo no es válido';
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'El registro de cuentas nuevas está desactivado en el servidor';
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed') || m.includes('fetch')) return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo';
  return e instanceof Error && e.message ? e.message : 'No se pudo completar la operación';
}

let adopting: Promise<void> = Promise.resolve();
/** Asocia los datos locales a la cuenta y cambia de usuario. En serie, para que dos avisos simultáneos no se pisen. */
function adopt(userId: string): Promise<void> {
  adopting = adopting.then(async () => {
    if (getUserId() === userId) return;
    await claimLocalData(userId);
    setUserId(userId);
  });
  return adopting;
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('La sincronización en la nube no está configurada');
  let res;
  try { res = await supabase.auth.signInWithPassword({ email, password }); } catch (e) { throw new Error(authMessage(e)); }
  if (res.error || !res.data.user) throw new Error(authMessage(res.error ?? 'No se pudo iniciar sesión'));
  await adopt(res.data.user.id);
  void syncNow();
}
export async function signUp(email: string, password: string): Promise<'ok' | 'confirm'> {
  if (!supabase) throw new Error('La sincronización en la nube no está configurada');
  let res;
  try {
    res = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined } });
  } catch (e) { throw new Error(authMessage(e)); }
  if (res.error) throw new Error(authMessage(res.error));
  // Supabase responde sin identidades cuando el correo ya existe (para no revelar cuentas).
  if (res.data.user && res.data.user.identities && res.data.user.identities.length === 0) throw new Error(authMessage('already registered'));
  if (!res.data.session || !res.data.user) return 'confirm';
  await adopt(res.data.user.id);
  void syncNow();
  return 'ok';
}
// ---------- Inicio de sesión con Google ----------
const GOOGLE_KEY = 'ii_google';
/** Último valor conocido de si Google está activo en el servidor (para pintar el botón sin esperar a la red). */
export function googleKnown(): boolean {
  try { return localStorage.getItem(GOOGLE_KEY) === '1'; } catch { return false; }
}
/** Pregunta al servidor qué proveedores tiene activos. El botón aparece solo cuando Google lo está. */
export async function googleEnabled(): Promise<boolean> {
  if (!cloudEnabled) return false;
  try {
    const res = await fetch(`${SB_URL}/auth/v1/settings`, { headers: { apikey: ANON! } });
    if (!res.ok) return googleKnown();
    const on = Boolean(((await res.json()) as { external?: Record<string, boolean> }).external?.google);
    try { localStorage.setItem(GOOGLE_KEY, on ? '1' : '0'); } catch { /* sin almacenamiento */ }
    return on;
  } catch { return googleKnown(); }
}
/** Lleva a la pantalla de Google; al volver, la sesión queda iniciada y los datos locales pasan a la cuenta. */
export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new Error('La sincronización en la nube no está configurada');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Necesitas conexión para entrar con Google');
  let res;
  try {
    res = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname, queryParams: { prompt: 'select_account' } },
    });
  } catch (e) { throw new Error(authMessage(e)); }
  if (res.error) throw new Error(oauthMessage('', res.error.message));
}

// ---------- Eliminar cuenta y datos ----------
/** Borra de este dispositivo todo lo que pertenece a un usuario (o los datos sin cuenta, con 'local'). */
export async function wipeLocal(userId: string): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const t of TABLES) await db.table(t).where('userId').equals(userId).delete();
    const keys = (await db.meta.toCollection().primaryKeys()).filter((k) => k.startsWith(`cursor:${userId}:`) || k === `lastBackup:${userId}`);
    await db.meta.bulkDelete(keys);
  });
}
/**
 * Elimina la cuenta en el servidor (y con ella todos sus datos, en cascada) y luego los datos de este dispositivo.
 * Sin cuenta, borra solo los datos locales. Si el servidor no confirma, no se borra nada.
 */
export async function deleteAccount(): Promise<void> {
  const uid = getUserId();
  if (uid !== 'local') {
    if (!supabase) throw new Error('La sincronización en la nube no está configurada');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Necesitas conexión para eliminar la cuenta');
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('La sesión caducó: vuelve a iniciar sesión y repite la eliminación');
    const { error } = await supabase.rpc('delete_account');
    if (error) {
      const m = error.message.toLowerCase();
      throw new Error(m.includes('could not find the function') || error.code === 'PGRST202'
        ? 'La eliminación de cuentas aún no está activada en el servidor'
        : `No se pudo eliminar la cuenta: ${authMessage(new Error(error.message))}`);
    }
    clearTimeout(timer);
    try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* la cuenta ya no existe */ }
  }
  await wipeLocal(uid);
  if (uid !== 'local') setUserId('local');
}

export async function signOut(): Promise<void> {
  await syncNow();
  try { await supabase?.auth.signOut(); } catch { /* sin red: se cierra igual en este dispositivo */ }
  setUserId('local');
}

/**
 * Enlaza la sesión de Supabase con el usuario de la app.
 *
 * La identidad vive en el dispositivo (no se consulta a la red al abrir), así la app funciona sin
 * conexión aunque el token haya caducado. Solo se vuelve a "sin cuenta" cuando Supabase confirma
 * que la sesión terminó (SIGNED_OUT), nunca por un fallo de red.
 */
export function initAuth(): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') { if (getUserId() !== 'local') setUserId('local'); return; }
    const id = session?.user?.id;
    // Fuera del callback: la librería no admite llamadas propias mientras notifica el cambio.
    if (id && id !== getUserId()) setTimeout(() => void adopt(id).then(() => syncNow()), 0);
  });
  return () => data.subscription.unsubscribe();
}
