// Lo que trabaja una rutina, para mostrarlo antes de entrar: músculos con sus series, el color de cada uno
// en la figura y cuánto dura más o menos. Se calcula con los objetivos de la rutina, no con lo ya entrenado.
import { hotTone, type Tones } from './heat';
import { MUSCLE_LABEL, MUSCLES } from './muscles';
import type { ExerciseDef, Muscle, RoutineItem, Target } from './types';

export interface RoutineMuscle { muscle: Muscle; direct: number; indirect: number; score: number }
type Item = Pick<RoutineItem, 'exerciseId' | 'sets' | 'superset'> & Partial<Pick<Target, 'repMin' | 'repMax' | 'restSec'>>;

/** Series por músculo: directas si es el principal del ejercicio, indirectas si es secundario. De más a menos trabajado. */
export function routineMuscles(items: Item[], ex: Map<string, ExerciseDef>, coef = 0.5): RoutineMuscle[] {
  const acc = new Map<Muscle, { direct: number; indirect: number }>();
  for (const it of items) {
    const e = ex.get(it.exerciseId);
    if (!e || it.sets <= 0) continue;
    const p = acc.get(e.primary) ?? { direct: 0, indirect: 0 };
    p.direct += it.sets; acc.set(e.primary, p);
    for (const m of e.secondary) {
      if (m === e.primary) continue;
      const s = acc.get(m) ?? { direct: 0, indirect: 0 };
      s.indirect += it.sets; acc.set(m, s);
    }
  }
  return MUSCLES.filter((m) => acc.has(m))
    .map((m) => { const a = acc.get(m)!; return { muscle: m, ...a, score: Math.round((a.direct + a.indirect * coef) * 10) / 10 }; })
    .sort((a, b) => b.direct - a.direct || b.score - a.score);
}

export const SECONDARY_TONE = { color: '#6b3324', glow: 0.12 };

/** Color de la figura: lo trabajado directo en brasa (más claro cuanto más series), lo secundario en rojo apagado. */
export function routineTones(list: RoutineMuscle[]): Tones {
  const max = Math.max(1, ...list.map((m) => m.score));
  const tones: Tones = {};
  for (const m of list) tones[m.muscle] = m.direct > 0 ? hotTone(0.2 + 0.8 * (m.score / max)) : SECONDARY_TONE;
  return tones;
}

/** «Pecho, espalda y hombros»: los músculos con más series directas. */
export function focusText(list: RoutineMuscle[], n = 3): string {
  const names = list.filter((m) => m.direct > 0).slice(0, n).map((m, i) => (i ? MUSCLE_LABEL[m.muscle].toLowerCase() : MUSCLE_LABEL[m.muscle]));
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

const DEFAULT_REST = 120;
/** Segundos de trabajo de una serie: unos 3 s por repetición; en ejercicios por tiempo, el tiempo objetivo. */
function workSec(it: Item, e: ExerciseDef | undefined): number {
  const avg = ((it.repMin ?? 8) + (it.repMax ?? it.repMin ?? 12)) / 2;
  if (e?.measure === 'time') return Math.max(15, avg);
  if (e?.measure === 'distance') return 60;
  return Math.max(20, avg * 3);
}

/**
 * Duración aproximada en minutos, redondeada a 5: trabajo de cada serie, el descanso después de cada una
 * y un minuto para preparar cada ejercicio. En una biserie o triserie se descansa una vez por vuelta.
 */
export function routineMinutes(items: Item[], ex: Map<string, ExerciseDef>): number {
  if (!items.length) return 0;
  let sec = 0;
  const groups = new Map<string, Item[]>();
  for (const it of items) {
    if (it.sets <= 0) continue;
    if (it.superset) { groups.set(it.superset, [...(groups.get(it.superset) ?? []), it]); continue; }
    sec += 60 + it.sets * (workSec(it, ex.get(it.exerciseId)) + (it.restSec ?? DEFAULT_REST));
  }
  for (const g of groups.values()) {
    const rounds = Math.max(...g.map((i) => i.sets));
    const rest = Math.max(...g.map((i) => i.restSec ?? DEFAULT_REST));
    sec += 60 * g.length + g.reduce((a, i) => a + i.sets * (workSec(i, ex.get(i.exerciseId)) + 15), 0) + rounds * rest;
  }
  return sec ? Math.max(5, Math.round(sec / 300) * 5) : 0;
}
