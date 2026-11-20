// Base de datos local persistente (IndexedDB vía Dexie).
// Es la fuente de verdad en el dispositivo: cada serie se escribe aquí en el momento,
// por lo que cerrar la app o perder conexión no pierde información.
import Dexie, { type Table } from 'dexie';
import type { BodyMeasure, BodyWeight, ExerciseRow, Profile, RecoveryLog, Routine, RoutineItem, Session, SetLog } from '../domain/types';

export interface Meta { key: string; value: unknown }

export class IronDB extends Dexie {
  profiles!: Table<Profile, string>;
  exercises!: Table<ExerciseRow, string>;
  routines!: Table<Routine, string>;
  routineItems!: Table<RoutineItem, string>;
  sessions!: Table<Session, string>;
  sets!: Table<SetLog, string>;
  recovery!: Table<RecoveryLog, string>;
  bodyWeights!: Table<BodyWeight, string>;
  measures!: Table<BodyMeasure, string>;
  meta!: Table<Meta, string>;

  constructor(name = 'iron-intelligence') {
    super(name);
    this.version(1).stores({
      profiles: 'id, userId, dirty',
      exercises: 'id, userId, dirty, baseId',
      routines: 'id, userId, dirty',
      routineItems: 'id, userId, dirty, routineId',
      sessions: 'id, userId, dirty, status, startedAt',
      sets: 'id, userId, dirty, sessionId, exerciseId',
      recovery: 'id, userId, dirty, date',
      bodyWeights: 'id, userId, dirty, date',
      meta: 'key',
    });
    this.version(2).stores({ measures: 'id, userId, dirty, date' });
  }
}

export const db = new IronDB();

// ---- Usuario actual ----
// 'local' = sin cuenta (los datos viven solo en este dispositivo).
const KEY = 'ii_uid';
const listeners = new Set<() => void>();

export function getUserId(): string {
  try { return localStorage.getItem(KEY) || 'local'; } catch { return 'local'; }
}
export function setUserId(id: string): void {
  try { localStorage.setItem(KEY, id); } catch { /* almacenamiento no disponible */ }
  listeners.forEach((l) => l());
}
export function subscribeUser(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
