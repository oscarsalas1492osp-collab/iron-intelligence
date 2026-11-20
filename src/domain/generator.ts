// Generador de plan: arma rutinas según los días disponibles, el equipo del gimnasio, los músculos
// prioritarios y la experiencia. Es un punto de partida editable; los criterios (reparto por días, número
// de series) son convenciones prácticas de programación.
import { defaultTarget, type Equipment, type ExerciseDef, type Experience, type Muscle, type Target } from './types';

export interface PlanDay { name: string; days: number[]; exercises: [string, Partial<Target>][] }
export interface PlanInput { days: number; equipment: Equipment[]; priority: Muscle[]; experience: Experience }

type Slot = [Muscle, 'compound' | 'isolation' | 'any'];
const FULL_A: Slot[] = [['quads', 'compound'], ['chest', 'compound'], ['back', 'compound'], ['hamstrings', 'any'], ['shoulders', 'isolation'], ['triceps', 'any'], ['abs', 'any']];
const FULL_B: Slot[] = [['hamstrings', 'compound'], ['back', 'compound'], ['chest', 'compound'], ['quads', 'any'], ['shoulders', 'compound'], ['biceps', 'any'], ['calves', 'any']];
const TORSO: Slot[] = [['chest', 'compound'], ['back', 'compound'], ['shoulders', 'compound'], ['back', 'compound'], ['shoulders', 'isolation'], ['triceps', 'any'], ['biceps', 'any']];
const LEGS: Slot[] = [['quads', 'compound'], ['hamstrings', 'compound'], ['quads', 'isolation'], ['hamstrings', 'isolation'], ['glutes', 'any'], ['calves', 'any'], ['abs', 'any']];
const PUSH: Slot[] = [['chest', 'compound'], ['shoulders', 'compound'], ['chest', 'any'], ['shoulders', 'isolation'], ['triceps', 'any'], ['triceps', 'any']];
const PULL: Slot[] = [['back', 'compound'], ['back', 'compound'], ['back', 'any'], ['shoulders', 'isolation'], ['biceps', 'any'], ['biceps', 'any']];

const SPLITS: Record<number, { split: string; days: [string, Slot[], number[]][] }> = {
  2: { split: 'Full Body', days: [['Cuerpo completo A', FULL_A, [1]], ['Cuerpo completo B', FULL_B, [4]]] },
  3: { split: 'Full Body', days: [['Cuerpo completo A', FULL_A, [1, 5]], ['Cuerpo completo B', FULL_B, [3]]] },
  4: { split: 'Torso/Pierna', days: [['Torso A', TORSO, [1]], ['Pierna A', LEGS, [2]], ['Torso B', TORSO, [4]], ['Pierna B', LEGS, [5]]] },
  5: { split: 'Empuje/Tirón/Pierna', days: [['Empuje', PUSH, [1]], ['Tirón', PULL, [2]], ['Pierna A', LEGS, [3]], ['Torso', TORSO, [5]], ['Pierna B', LEGS, [6]]] },
  6: { split: 'Empuje/Tirón/Pierna', days: [['Empuje A', PUSH, [1]], ['Tirón A', PULL, [2]], ['Pierna A', LEGS, [3]], ['Empuje B', PUSH, [4]], ['Tirón B', PULL, [5]], ['Pierna B', LEGS, [6]]] },
};

export function generatePlan(input: PlanInput, library: ExerciseDef[]): { split: string; routines: PlanDay[] } {
  const n = Math.min(6, Math.max(2, Math.round(input.days)));
  const plan = SPLITS[n];
  const allowed = (e: ExerciseDef) => !input.equipment.length || input.equipment.includes(e.equipment) || e.equipment === 'bodyweight';
  const pool = library.filter((e) => e.category === 'strength' && e.measure === 'reps');
  const usedCount = new Map<string, number>();
  const pick = (muscle: Muscle, kind: Slot[1], inDay: Set<string>): ExerciseDef | undefined => {
    const fits = (e: ExerciseDef, strictKind: boolean, strictEq: boolean) => e.primary === muscle && !inDay.has(e.id) && (!strictKind || kind === 'any' || e.type === kind) && (!strictEq || allowed(e));
    // Se relaja primero el tipo y después el equipo: siempre es mejor un ejercicio parecido que un hueco.
    for (const [k, q] of [[true, true], [false, true], [true, false], [false, false]] as const) {
      const c = pool.filter((e) => fits(e, k, q));
      // Entre los que sirven, el menos repetido en el plan: así los días A y B no son iguales.
      if (c.length) return c.sort((a, b) => (usedCount.get(a.id) ?? 0) - (usedCount.get(b.id) ?? 0))[0];
    }
    return undefined;
  };
  const routines = plan.days.map(([name, slots, days]) => {
    const inDay = new Set<string>();
    const exercises: [string, Partial<Target>][] = [];
    const add = (muscle: Muscle, kind: Slot[1]) => {
      const e = pick(muscle, kind, inDay);
      if (!e) return;
      inDay.add(e.id); usedCount.set(e.id, (usedCount.get(e.id) ?? 0) + 1);
      const base = defaultTarget(e);
      const sets = Math.min(6, Math.max(2, base.sets + (input.experience === 'beginner' ? -1 : input.experience === 'advanced' ? 1 : 0) + (input.priority.includes(muscle) ? 1 : 0)));
      exercises.push([e.id, { sets }]);
    };
    for (const [m, k] of slots) add(m, k);
    // Un ejercicio extra para cada músculo prioritario que el día ya trabaja.
    for (const m of input.priority) if (slots.some(([sm]) => sm === m) && exercises.length < 8) add(m, 'any');
    return { name, days, exercises };
  });
  return { split: plan.split, routines };
}
