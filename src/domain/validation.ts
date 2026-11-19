// Validación de datos antes de persistir. Cualquier escritura pasa por estos esquemas.
import { z } from 'zod';

const base = { id: z.string().min(1), userId: z.string().min(1), updatedAt: z.number(), deleted: z.union([z.literal(0), z.literal(1)]), dirty: z.union([z.literal(0), z.literal(1)]) };
const muscle = z.enum(['chest', 'back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'lowerback', 'glutes', 'abductors', 'adductors', 'quads', 'hamstrings', 'calves', 'tibialis', 'neck']);
const equipment = z.enum(['machine', 'isolation_machine', 'convergent', 'lever', 'cable', 'smith', 'barbell', 'ez_bar', 'trap_bar', 'landmine', 'dumbbell', 'kettlebell', 'plate', 'band', 'bodyweight', 'suspension', 'medball', 'sled', 'other']);
const halfStep = (n: number) => Math.abs(n * 2 - Math.round(n * 2)) < 1e-9;

const target = {
  sets: z.number().int().min(1).max(12),
  repMin: z.number().int().min(1).max(100),
  repMax: z.number().int().min(1).max(100),
  rirMin: z.number().min(0).max(10),
  rirMax: z.number().min(0).max(10),
  restSec: z.number().int().min(0).max(900),
};
export const targetSchema = z.object(target)
  .refine((t) => t.repMin <= t.repMax, { message: 'El mínimo de repeticiones no puede superar al máximo' })
  .refine((t) => t.rirMin <= t.rirMax, { message: 'El RIR mínimo no puede superar al máximo' });

export const schemas = {
  profiles: z.object({
    ...base, name: z.string().max(60), age: z.number().int().min(10).max(100).nullable(), sex: z.enum(['', 'm', 'f', 'x']),
    heightCm: z.number().min(100).max(250).nullable(), experience: z.enum(['beginner', 'intermediate', 'advanced']),
    goal: z.enum(['hypertrophy', 'strength', 'recomposition', 'maintenance']), daysAvailable: z.number().int().min(1).max(7),
    equipment: z.array(equipment), priorityMuscles: z.array(muscle), halfRir: z.boolean(), indirectCoef: z.number().min(0).max(1),
  }),
  exercises: z.object({
    ...base, baseId: z.string().nullable(), name: z.string().trim().min(2, 'El nombre es obligatorio').max(80), primary: muscle,
    secondary: z.array(muscle), type: z.enum(['compound', 'isolation']), equipment, machine: z.string().max(80),
    // Campos añadidos con el catálogo ampliado: las filas antiguas no los traen.
    focus: z.string().max(80).default(''), aka: z.string().max(160).default(''),
    measure: z.enum(['reps', 'time', 'distance']).default('reps'), category: z.enum(['strength', 'functional', 'power', 'calisthenics']).default('strength'),
    cues: z.array(z.string()), mistakes: z.array(z.string()), rom: z.string(), execution: z.string(), safety: z.string(),
    increment: z.number().min(0.25, 'El incremento mínimo es 0,25 kg').max(25), photo: z.string().nullable(), custom: z.boolean(),
  }),
  routines: z.object({ ...base, name: z.string().trim().min(1, 'La rutina necesita un nombre').max(60), split: z.string().max(40), days: z.array(z.number().int().min(0).max(6)), order: z.number() }),
  routineItems: z.object({ ...base, ...target, routineId: z.string().min(1), exerciseId: z.string().min(1), order: z.number() })
    .refine((t) => t.repMin <= t.repMax, { message: 'El mínimo de repeticiones no puede superar al máximo' })
    .refine((t) => t.rirMin <= t.rirMax, { message: 'El RIR mínimo no puede superar al máximo' }),
  sessions: z.object({
    ...base, routineId: z.string().nullable(), name: z.string().max(80), startedAt: z.number(), endedAt: z.number().nullable(),
    status: z.enum(['active', 'paused', 'done']), pausedAt: z.number().nullable(), pausedMs: z.number().min(0), notes: z.string().max(2000),
    exerciseIds: z.array(z.string()), targets: z.record(z.object(target)),
  }),
  sets: z.object({
    ...base, sessionId: z.string().min(1), exerciseId: z.string().min(1), order: z.number().int().min(0),
    weight: z.number().min(0, 'El peso no puede ser negativo').max(1000, 'Peso fuera de rango'),
    reps: z.number().int('Las repeticiones deben ser un número entero').min(0).max(200, 'Repeticiones fuera de rango'),
    rir: z.number().min(0).max(10).refine(halfStep, 'El RIR admite pasos de 0,5').nullable(),
    rpe: z.number().min(1).max(10).nullable(), failure: z.boolean(), endReason: z.enum(['none', 'momentary', 'technical', 'voluntary', 'fatigue']),
    metTarget: z.boolean(), done: z.boolean(), completedAt: z.number().nullable(), restSec: z.number().min(0).nullable(), note: z.string().max(500),
  }),
  recovery: z.object({
    ...base, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), sleepHours: z.number().min(0).max(16),
    sleepQuality: z.number().int().min(1).max(5), fatigue: z.number().int().min(1).max(5), soreness: z.number().int().min(1).max(5),
    motivation: z.number().int().min(1).max(5), stress: z.number().int().min(1).max(5),
  }),
  bodyWeights: z.object({ ...base, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), kg: z.number().min(25, 'Peso corporal fuera de rango').max(300, 'Peso corporal fuera de rango') }),
} as const;

export type TableName = keyof typeof schemas;
export const TABLES = Object.keys(schemas) as TableName[];

export class ValidationError extends Error {}
export function validate<T>(table: TableName, row: T): T {
  const r = schemas[table].safeParse(row);
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? 'Datos inválidos');
  return row;
}
