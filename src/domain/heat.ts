// Color de cada grupo muscular en el mapa corporal, como hierro en la forja:
//  - entrenado en las últimas 48 h → incandescente (rojo cereza → naranja → ámbar según el volumen)
//  - entrenado antes en la semana  → ya frío, azul de acero templado (más claro = más volumen)
//  - pendiente esta semana         → hierro sin calentar
import { DAY } from './calc';
import { MUSCLES } from './muscles';
import type { Muscle } from './types';
import { muscleVolume, type ASet, type ExMap } from './volume';

export interface Tone { color: string; glow: number }
export type MuscleState = 'reciente' | 'semana' | 'pendiente';
export type Tones = Partial<Record<Muscle, Tone>>;

export const COLD: Tone = { color: '#5d646f', glow: 0 };

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
function mix(a: string, b: string, t: number): string {
  const [x, y] = [hex(a), hex(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function ramp(stops: string[], t: number): string {
  const k = Math.min(0.9999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(k);
  return mix(stops[i], stops[i + 1], k - i);
}

const HOT = ['#9a3a26', '#ff6a1a', '#ffb347'];
const TEMPERED = ['#3f6a9c', '#74b8ff'];

/** t = 0–1 (proporción respecto del grupo con más volumen). */
export const hotTone = (t: number): Tone => ({ color: ramp(HOT, t), glow: 0.35 + 0.65 * t });
export const temperedTone = (t: number): Tone => ({ color: ramp(TEMPERED, t), glow: 0.12 });
export const LEGEND = { reciente: ramp(HOT, 0.6), semana: ramp(TEMPERED, 0.6), pendiente: COLD.color };

export interface WeekHeat { tones: Tones; state: Record<Muscle, MuscleState>; }

/** `week` = series de la semana en curso; `now` para saber cuáles siguen "calientes". */
export function weekHeat(week: ASet[], ex: ExMap, coef: number, now: number): WeekHeat {
  const vol = muscleVolume(week, ex, coef);
  const max = Math.max(1, ...vol.map((v) => v.fractional));
  const recent = new Set<Muscle>();
  for (const s of week) if (now - s.date < 2 * DAY) { const e = ex.get(s.exerciseId); if (e) { recent.add(e.primary); e.secondary.forEach((m) => recent.add(m)); } }
  const tones: Tones = {};
  const state = Object.fromEntries(MUSCLES.map((m) => [m, 'pendiente'])) as Record<Muscle, MuscleState>;
  for (const v of vol) {
    if (v.fractional <= 0) continue;
    const t = v.fractional / max;
    if (recent.has(v.muscle)) { tones[v.muscle] = hotTone(t); state[v.muscle] = 'reciente'; }
    else { tones[v.muscle] = temperedTone(t); state[v.muscle] = 'semana'; }
  }
  return { tones, state };
}

/** Mapa de un ejercicio: músculo principal incandescente, secundarios en rojo oscuro. */
export function exerciseTones(primary: Muscle, secondary: Muscle[]): Tones {
  const tones: Tones = {};
  for (const m of secondary) tones[m] = { color: '#8a3a28', glow: 0.18 };
  tones[primary] = hotTone(0.75);
  return tones;
}
