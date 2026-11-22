import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { db, getUserId, subscribeUser } from './data/db';
import { defaultProfile, getDoneSets, mine } from './data/repo';
import { getAccessSnapshot, getSettledFor, gateOf, refreshAccess, subscribeAccess, type Gate } from './data/access';
import { cloudEnabled, getSyncState, subscribeSync } from './data/sync';
import { mergeExercises } from './domain/exerciseLibrary';
import type { ExerciseDef, Profile, RoutineItem, Session } from './domain/types';
import type { ASet } from './domain/volume';

export const useUserId = () => useSyncExternalStore(subscribeUser, getUserId, getUserId);
export const useSyncState = () => useSyncExternalStore(subscribeSync, getSyncState, getSyncState);

/** Qué pantalla corresponde según la entrada con invitación. Pregunta al servidor al abrir, al cambiar de cuenta y al volver a la app. */
export function useGate(uid: string): Gate {
  const snap = useSyncExternalStore(subscribeAccess, getAccessSnapshot, getAccessSnapshot);
  const settled = useSyncExternalStore(subscribeAccess, getSettledFor, getSettledFor);
  useEffect(() => {
    void refreshAccess(uid);
    const vis = () => { if (document.visibilityState === 'visible') void refreshAccess(uid); };
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, [uid]);
  return gateOf(snap, uid, cloudEnabled, settled === uid);
}

export function useExercises(): ExerciseDef[] {
  const uid = useUserId();
  const rows = useLiveQuery(() => db.exercises.where('userId').equals(uid).toArray(), [uid]);
  return useMemo(() => mergeExercises(rows ?? []), [rows]);
}
export function useExMap(): Map<string, ExerciseDef> {
  const list = useExercises();
  return useMemo(() => new Map(list.map((e) => [e.id, e])), [list]);
}
/** Series completadas de sesiones terminadas. undefined mientras carga. */
export function useDoneSets(): ASet[] | undefined {
  const uid = useUserId();
  return useLiveQuery(() => getDoneSets(), [uid]);
}
export function useProfile(): Profile {
  const uid = useUserId();
  const p = useLiveQuery(() => db.profiles.get(uid), [uid]);
  return useMemo(() => p ?? defaultProfile(), [p, uid]);
}
export function useRoutines() {
  const uid = useUserId();
  return useLiveQuery(async () => mine(await db.routines.toArray()).sort((a, b) => a.order - b.order), [uid]);
}
export function useAllItems(): RoutineItem[] | undefined {
  const uid = useUserId();
  return useLiveQuery(async () => mine(await db.routineItems.toArray()).sort((a, b) => a.order - b.order), [uid]);
}
export function useSessions(): Session[] | undefined {
  const uid = useUserId();
  return useLiveQuery(async () => mine(await db.sessions.toArray()).sort((a, b) => b.startedAt - a.startedAt), [uid]);
}
/** Sesión en curso: undefined = cargando, null = no hay. */
export function useActiveSession(): Session | null | undefined {
  const all = useSessions();
  return all === undefined ? undefined : all.find((s) => s.status !== 'done') ?? null;
}
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, enabled]);
  return now;
}
