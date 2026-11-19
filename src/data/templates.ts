// Plantillas de rutina. Son puntos de partida editables, no prescripciones.
import { LIBRARY } from '../domain/exerciseLibrary';
import { DEFAULT_TARGET, type Target } from '../domain/types';

export interface TemplateDay { name: string; days: number[]; exercises: (string | [string, Partial<Target>])[] }
export interface Template { id: string; name: string; split: string; description: string; routines: TemplateDay[] }

export const TEMPLATES: Template[] = [
  {
    id: 'ppl', name: 'Push / Pull / Legs', split: 'Push/Pull/Legs', description: '3 rutinas. Repite el ciclo 1 o 2 veces por semana según tus días disponibles.',
    routines: [
      { name: 'Push (empuje)', days: [1, 4], exercises: ['chest_press_machine', 'incline_db_press', 'shoulder_press_machine', 'lateral_raise_db', 'triceps_pushdown', 'overhead_triceps_cable'] },
      { name: 'Pull (tirón)', days: [2, 5], exercises: ['lat_pulldown', 'machine_row', 'seated_cable_row', 'reverse_pec_deck', 'preacher_curl_machine', 'hammer_curl'] },
      { name: 'Legs (piernas)', days: [3, 6], exercises: ['hack_squat', 'leg_press', 'seated_leg_curl', 'leg_extension', 'standing_calf_raise', 'cable_crunch'] },
    ],
  },
  {
    id: 'ul', name: 'Torso / Pierna', split: 'Torso/Pierna', description: '2 rutinas alternadas, 4 días por semana.',
    routines: [
      { name: 'Torso', days: [1, 4], exercises: ['chest_press_machine', 'lat_pulldown', 'shoulder_press_machine', 'machine_row', 'lateral_raise_db', 'triceps_pushdown', 'cable_curl'] },
      { name: 'Pierna', days: [2, 5], exercises: ['leg_press', 'romanian_deadlift', 'leg_extension', 'seated_leg_curl', 'hip_thrust_machine', 'standing_calf_raise', 'cable_crunch'] },
    ],
  },
  {
    id: 'fb', name: 'Full Body', split: 'Full Body', description: '2 rutinas de cuerpo completo alternadas, 3 días por semana.',
    routines: [
      { name: 'Full Body A', days: [1, 5], exercises: ['leg_press', 'chest_press_machine', 'lat_pulldown', 'seated_leg_curl', 'lateral_raise_db', 'triceps_pushdown', 'cable_curl'] },
      { name: 'Full Body B', days: [3], exercises: ['hack_squat', 'incline_db_press', 'machine_row', 'romanian_deadlift', 'shoulder_press_machine', 'preacher_curl_machine', 'cable_crunch'] },
    ],
  },
];

export function targetFor(exerciseId: string, over: Partial<Target> = {}): Target {
  const e = LIBRARY.find((x) => x.id === exerciseId);
  return { ...DEFAULT_TARGET[e?.type ?? 'compound'], ...over };
}
