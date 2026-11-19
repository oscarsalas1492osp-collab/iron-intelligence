// Modelo de datos de Iron Intelligence.
// Todas las entidades persistentes comparten los campos de sincronización de `Base`.

export type Muscle =
  | 'chest' | 'back' | 'traps' | 'shoulders' | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques' | 'lowerback' | 'glutes' | 'abductors' | 'adductors'
  | 'quads' | 'hamstrings' | 'calves' | 'tibialis' | 'neck';

export type Equipment =
  | 'machine' | 'isolation_machine' | 'convergent' | 'lever' | 'cable' | 'smith'
  | 'barbell' | 'ez_bar' | 'trap_bar' | 'landmine' | 'dumbbell' | 'kettlebell' | 'plate'
  | 'band' | 'bodyweight' | 'suspension' | 'medball' | 'sled' | 'other';

export type ExType = 'compound' | 'isolation';

/** Qué se anota en la columna de repeticiones: repeticiones, segundos o metros. */
export type Measure = 'reps' | 'time' | 'distance';

/** Familia de entrenamiento, para filtrar el catálogo. */
export type Category = 'strength' | 'functional' | 'power' | 'calisthenics';

/** Motivo por el que terminó la serie. El RIR 0 no implica por sí solo fallo muscular momentáneo. */
export type EndReason = 'none' | 'momentary' | 'technical' | 'voluntary' | 'fatigue';

export interface Base {
  id: string;
  userId: string;
  updatedAt: number;
  /** 1 = borrado lógico (necesario para propagar eliminaciones al sincronizar). */
  deleted: 0 | 1;
  /** 1 = pendiente de subir al servidor. Solo local. */
  dirty: 0 | 1;
}

export interface ExerciseDef {
  id: string;
  name: string;
  primary: Muscle;
  secondary: Muscle[];
  type: ExType;
  equipment: Equipment;
  machine: string;
  /** Porción o énfasis dentro del grupo principal (p. ej. «Pectoral superior»). */
  focus: string;
  /** Otros nombres con los que se conoce el ejercicio, para la búsqueda. */
  aka: string;
  measure: Measure;
  category: Category;
  cues: string[];
  mistakes: string[];
  rom: string;
  execution: string;
  safety: string;
  /** Incremento mínimo de carga disponible, en kg. */
  increment: number;
  photo: string | null;
  custom: boolean;
}

/** Ejercicio personalizado (baseId = null) o ajuste del usuario sobre uno de la biblioteca (baseId = id base). */
export interface ExerciseRow extends Base, Omit<ExerciseDef, 'id'> {
  baseId: string | null;
}

export interface Target {
  sets: number;
  repMin: number;
  repMax: number;
  rirMin: number;
  rirMax: number;
  restSec: number;
}

export interface Routine extends Base {
  name: string;
  split: string;
  /** Días de la semana programados: 0 = domingo … 6 = sábado. */
  days: number[];
  order: number;
}

export interface RoutineItem extends Base, Target {
  routineId: string;
  exerciseId: string;
  order: number;
  /** Clave compartida por los 2–3 ejercicios de una biserie o triserie; null si va suelto. */
  superset: string | null;
}

export interface Session extends Base {
  routineId: string | null;
  name: string;
  startedAt: number;
  endedAt: number | null;
  status: 'active' | 'paused' | 'done';
  pausedAt: number | null;
  pausedMs: number;
  notes: string;
  exerciseIds: string[];
  /** Copia de los objetivos al iniciar: cambiar la rutina después no altera el historial. */
  targets: Record<string, Target>;
  /** Biseries y triseries de la sesión: cada grupo lista 2–3 ejercicios que se hacen seguidos, sin descanso. */
  supersets: string[][];
}

/** Técnica que alarga una serie; vacío en una serie normal. */
export type Technique = '' | 'drop' | 'restpause' | 'myo' | 'cluster';

export interface SetLog extends Base {
  sessionId: string;
  exerciseId: string;
  order: number;
  weight: number;
  reps: number;
  rir: number | null;
  rpe: number | null;
  failure: boolean;
  endReason: EndReason;
  /** ¿Alcanzó al menos el mínimo del rango de repeticiones objetivo? */
  metTarget: boolean;
  done: boolean;
  completedAt: number | null;
  /** Descanso real tomado antes de esta serie, en segundos. */
  restSec: number | null;
  note: string;
  /** Tramo añadido con una técnica avanzada: comparte `order` con su serie principal y `sub` lo numera (0 = serie principal). */
  technique: Technique;
  sub: number;
}

export interface RecoveryLog extends Base {
  date: string; // YYYY-MM-DD
  sleepHours: number;
  sleepQuality: number; // 1–5
  fatigue: number; // 1–5 (5 = muy fatigado)
  soreness: number; // 1–5
  motivation: number; // 1–5
  stress: number; // 1–5
}

export interface BodyWeight extends Base {
  date: string;
  kg: number;
}

export type Goal = 'hypertrophy' | 'strength' | 'recomposition' | 'maintenance';
export type Experience = 'beginner' | 'intermediate' | 'advanced';

export interface Profile extends Base {
  name: string;
  age: number | null;
  sex: '' | 'm' | 'f' | 'x';
  heightCm: number | null;
  experience: Experience;
  goal: Goal;
  daysAvailable: number;
  equipment: Equipment[];
  priorityMuscles: Muscle[];
  /** Permite registrar RIR con medios puntos. */
  halfRir: boolean;
  /** Fracción con la que una serie indirecta cuenta para un músculo secundario (0–1). */
  indirectCoef: number;
}

export const DEFAULT_TARGET: Record<ExType, Target> = {
  compound: { sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, restSec: 120 },
  isolation: { sets: 3, repMin: 10, repMax: 15, rirMin: 0, rirMax: 2, restSec: 90 },
};

/** Objetivo inicial según cómo se mide y a qué familia pertenece el ejercicio. */
export function defaultTarget(ex?: Pick<ExerciseDef, 'type' | 'measure' | 'category'> | null): Target {
  if (!ex) return DEFAULT_TARGET.compound;
  if (ex.measure === 'time') return { sets: 3, repMin: 30, repMax: 60, rirMin: 1, rirMax: 2, restSec: 90 };
  if (ex.measure === 'distance') return { sets: 3, repMin: 20, repMax: 40, rirMin: 1, rirMax: 2, restSec: 120 };
  // Potencia: pocas repeticiones rápidas y lejos del fallo; la velocidad es el objetivo.
  if (ex.category === 'power') return { sets: 4, repMin: 3, repMax: 5, rirMin: 2, rirMax: 4, restSec: 150 };
  return DEFAULT_TARGET[ex.type];
}
