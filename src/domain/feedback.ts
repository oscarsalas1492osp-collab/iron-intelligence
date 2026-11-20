// Valoración tras la sesión: cuánto trabajo sintió cada músculo. Con ella la sesión siguiente suma o quita una serie.
// La regla (dos «poco» seguidos suman una serie; un «demasiado» quita una) es una convención práctica de
// autorregulación del volumen, no un valor derivado de un estudio.
import { DAY } from './calc';
import type { Settings } from './types';

export const RATINGS: { value: number; label: string }[] = [{ value: 1, label: 'Poco' }, { value: 2, label: 'Justo' }, { value: 3, label: 'Demasiado' }];
export const ADJ_KEY = 'ii_adj';
type Ratings = NonNullable<Settings['ratings']>;

/** +1, −1 o 0 series para un músculo según sus valoraciones de las últimas 4 semanas. */
export function volumeDelta(muscle: string, ratings: Ratings | undefined, now = Date.now()): -1 | 0 | 1 {
  const xs = Object.values(ratings ?? {}).filter((r) => r.m[muscle] != null && now - r.at < 28 * DAY).sort((a, b) => b.at - a.at);
  if (!xs.length) return 0;
  if (xs[0].m[muscle] === 3) return -1;
  return xs.length >= 2 && xs[0].m[muscle] === 1 && xs[1].m[muscle] === 1 ? 1 : 0;
}

/** Conserva solo las valoraciones más recientes, para que los ajustes no crezcan sin límite. */
export function pruneRatings(r: Ratings, keep = 40): Ratings {
  return Object.fromEntries(Object.entries(r).sort((a, b) => b[1].at - a[1].at).slice(0, keep));
}
