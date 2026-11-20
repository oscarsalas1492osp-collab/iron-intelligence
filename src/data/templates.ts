// Plantillas de rutina. Son puntos de partida editables, no prescripciones.
import { LIBRARY } from '../domain/exerciseLibrary';
import { defaultTarget, type Target } from '../domain/types';

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
  {
    id: 'fuerza', name: 'Fuerza con barra (4 días)', split: 'Torso/Pierna', description: 'Básicos pesados con barra en rangos bajos y accesorios en rangos medios.',
    routines: [
      { name: 'Torso fuerza', days: [1], exercises: [['bench_press', { sets: 4, repMin: 4, repMax: 6, restSec: 180 }], ['barbell_row', { sets: 4, repMin: 5, repMax: 8, restSec: 150 }], ['overhead_press', { sets: 3, repMin: 5, repMax: 8, restSec: 150 }], 'lat_pulldown', 'skullcrusher', 'barbell_curl'] },
      { name: 'Pierna fuerza', days: [2], exercises: [['squat', { sets: 4, repMin: 4, repMax: 6, restSec: 180 }], ['romanian_deadlift', { sets: 3, repMin: 6, repMax: 8, restSec: 150 }], 'leg_press', 'lying_leg_curl', 'standing_calf_raise', 'hanging_leg_raise'] },
      { name: 'Torso volumen', days: [4], exercises: ['incline_bench_press', 'pull_up', 'db_shoulder_press', 'seated_cable_row', 'lateral_raise_db', 'triceps_pushdown', 'db_curl'] },
      { name: 'Pierna volumen', days: [5], exercises: ['hack_squat', 'hip_thrust', 'leg_extension', 'seated_leg_curl', 'seated_calf_raise', 'cable_crunch'] },
    ],
  },
  {
    id: 'ppl-barra', name: 'Push / Pull / Legs con peso libre', split: 'Push/Pull/Legs', description: '3 rutinas con barra y mancuernas, para gimnasios con poco equipo guiado.',
    routines: [
      { name: 'Empuje libre', days: [1, 4], exercises: ['bench_press', 'db_shoulder_press', 'incline_db_press', 'lateral_raise_db', 'skullcrusher', 'dips'] },
      { name: 'Tirón libre', days: [2, 5], exercises: ['pull_up', 'barbell_row', 'db_row', 'face_pull', 'barbell_curl', 'hammer_curl'] },
      { name: 'Pierna libre', days: [3, 6], exercises: ['squat', 'romanian_deadlift', 'bulgarian_split_squat', 'hip_thrust', 'standing_calf_raise', 'hanging_leg_raise'] },
    ],
  },
  {
    id: 'gluteo', name: 'Énfasis en glúteo y pierna (4 días)', split: 'Torso/Pierna', description: 'Dos días de pierna con prioridad en glúteo y dos de torso de mantenimiento.',
    routines: [
      { name: 'Glúteo y femoral', days: [1], exercises: [['hip_thrust', { sets: 4 }], 'romanian_deadlift', 'glute_kickback_cable', 'seated_leg_curl', 'hip_abduction_machine', 'cable_crunch'] },
      { name: 'Torso A', days: [2], exercises: ['lat_pulldown', 'chest_press_machine', 'machine_row', 'lateral_raise_db', 'triceps_pushdown', 'cable_curl'] },
      { name: 'Glúteo y cuádriceps', days: [4], exercises: [['hip_thrust_machine', { sets: 4 }], 'bulgarian_split_squat', 'leg_press', 'leg_extension', 'hip_abduction_machine', 'standing_calf_raise'] },
      { name: 'Torso B', days: [5], exercises: ['seated_cable_row', 'incline_db_press', 'shoulder_press_machine', 'reverse_pec_deck', 'overhead_triceps_cable', 'hammer_curl'] },
    ],
  },
  {
    id: 'mancuernas', name: 'Cuerpo completo con mancuernas', split: 'Full Body', description: '2 rutinas para entrenar en casa o con poco equipo, 3 días por semana.',
    routines: [
      { name: 'Mancuernas A', days: [1, 5], exercises: ['bulgarian_split_squat', 'db_bench_press', 'db_row', 'db_shoulder_press', 'db_curl', 'plank'] },
      { name: 'Mancuernas B', days: [3], exercises: ['romanian_deadlift', 'incline_db_press', 'pull_up', 'lateral_raise_db', 'hammer_curl', 'push_up'] },
    ],
  },
  {
    id: 'brazos', name: 'Especialización de brazos y hombros (5 días)', split: 'Especialización', description: 'Torso y pierna de base, con un día extra para brazos y hombros.',
    routines: [
      { name: 'Torso', days: [1], exercises: ['chest_press_machine', 'lat_pulldown', 'machine_row', 'incline_db_press', 'lateral_raise_cable', 'face_pull'] },
      { name: 'Pierna', days: [2], exercises: ['hack_squat', 'seated_leg_curl', 'leg_extension', 'hip_thrust_machine', 'standing_calf_raise', 'ab_crunch_machine'] },
      { name: 'Brazos y hombros', days: [3], exercises: [['lateral_raise_db', { sets: 4 }], 'incline_db_curl', 'overhead_triceps_cable', 'preacher_curl_machine', 'triceps_pushdown', 'reverse_curl'] },
      { name: 'Torso 2', days: [5], exercises: ['incline_bench_press', 'seated_cable_row', 'shoulder_press_machine', 'pec_deck', 'cable_curl', 'triceps_machine'] },
      { name: 'Pierna 2', days: [6], exercises: ['leg_press', 'romanian_deadlift', 'lying_leg_curl', 'bulgarian_split_squat', 'seated_calf_raise', 'cable_crunch'] },
    ],
  },
  {
    id: 'principiante', name: 'Principiante en máquinas (3 días)', split: 'Full Body', description: 'Una sola rutina guiada, fácil de aprender, tres veces por semana.',
    routines: [
      { name: 'Cuerpo completo guiado', days: [1, 3, 5], exercises: [['leg_press', { sets: 3 }], ['chest_press_machine', { sets: 3 }], ['lat_pulldown', { sets: 3 }], ['seated_leg_curl', { sets: 2 }], ['shoulder_press_machine', { sets: 2 }], ['machine_row', { sets: 2 }], ['ab_crunch_machine', { sets: 2 }]] },
    ],
  },
];

export function targetFor(exerciseId: string, over: Partial<Target> = {}): Target {
  const e = LIBRARY.find((x) => x.id === exerciseId);
  return { ...defaultTarget(e), ...over };
}
