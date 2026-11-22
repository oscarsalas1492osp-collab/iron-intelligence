import type { Category, Equipment, Measure, Muscle } from './types';

export const MUSCLES: Muscle[] = [
  'chest', 'back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'lowerback',
  'glutes', 'abductors', 'adductors', 'quads', 'hamstrings', 'calves', 'tibialis', 'neck',
];

/** Grupos que se avisan como «pendientes» si no se entrenan en la semana. El resto solo aparece cuando se trabaja. */
export const MAIN_MUSCLES: Muscle[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'glutes', 'quads', 'hamstrings', 'calves'];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Pecho', back: 'Espalda', traps: 'Trapecio', shoulders: 'Hombros', biceps: 'Bíceps', triceps: 'Tríceps',
  forearms: 'Antebrazos', abs: 'Abdominales', obliques: 'Oblicuos', lowerback: 'Lumbares', glutes: 'Glúteos',
  abductors: 'Abductores', adductors: 'Aductores', quads: 'Cuádriceps', hamstrings: 'Isquiotibiales',
  calves: 'Gemelos', tibialis: 'Tibial', neck: 'Cuello',
};

export const EQUIPMENT: Equipment[] = [
  'machine', 'isolation_machine', 'convergent', 'lever', 'cable', 'smith', 'barbell', 'ez_bar', 'trap_bar', 'landmine',
  'dumbbell', 'kettlebell', 'plate', 'band', 'bodyweight', 'suspension', 'medball', 'sled', 'other',
];

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  machine: 'Máquina guiada', isolation_machine: 'Máquina de aislamiento', convergent: 'Máquina convergente',
  lever: 'Máquina de discos', cable: 'Polea', smith: 'Smith', barbell: 'Barra', ez_bar: 'Barra Z', trap_bar: 'Barra hexagonal',
  landmine: 'Landmine', dumbbell: 'Mancuernas', kettlebell: 'Pesa rusa', plate: 'Disco', band: 'Banda elástica',
  bodyweight: 'Peso corporal', suspension: 'Suspensión', medball: 'Balón medicinal', sled: 'Trineo', other: 'Otros implementos',
};

export const CATEGORIES: Category[] = ['strength', 'functional', 'power', 'calisthenics'];
export const CATEGORY_LABEL: Record<Category, string> = { strength: 'Fuerza', functional: 'Funcional', power: 'Potencia', calisthenics: 'Calistenia' };

export const MEASURE_LABEL: Record<Measure, string> = { reps: 'Repeticiones', time: 'Tiempo (segundos)', distance: 'Distancia (metros)' };
/** Unidad corta que acompaña al número anotado en cada serie. */
export const MEASURE_UNIT: Record<Measure, string> = { reps: 'reps', time: 's', distance: 'm' };

/** Adapta un texto escrito para repeticiones a ejercicios que se miden en segundos o metros. */
export function unitText(text: string, measure: Measure): string {
  if (measure === 'reps') return text;
  const [one, many, short] = measure === 'time' ? ['segundo', 'segundos', 's'] : ['metro', 'metros', 'm'];
  return text.replace(/REPETICIONES/g, many.toUpperCase()).replace(/repeticiones/g, many).replace(/repetición/g, one).replace(/(\d) reps\b/g, `$1 ${short}`);
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Reconoce un grupo muscular mencionado en texto libre (para el asistente). */
export function findMuscle(text: string): Muscle | null {
  const t = norm(text);
  // Alias en español, inglés y portugués, ya sin tildes: el asistente recibe preguntas en los tres idiomas.
  const alias: [Muscle, string[]][] = [
    ['traps', ['trapecio', 'trapezio', 'trap']], ['lowerback', ['lumbar', 'espalda baja', 'erector', 'lower back', 'lombar']], ['obliques', ['oblicuo', 'oblique', 'obliquo']],
    ['abductors', ['abductor', 'gluteo medio', 'abdutor']], ['adductors', ['aductor', 'adductor', 'adutor']], ['tibialis', ['tibial']], ['neck', ['cuello', 'neck', 'pescoco']],
    ['chest', ['pecho', 'pectoral', 'chest', 'peito']], ['back', ['espalda', 'dorsal', 'back', 'costas', 'lats']], ['shoulders', ['hombro', 'deltoides', 'shoulder', 'delt', 'ombro']],
    ['biceps', ['bicep']], ['triceps', ['tricep']], ['forearms', ['antebrazo', 'forearm', 'antebraco']],
    ['quads', ['cuadriceps', 'cuadri', 'quad']], ['hamstrings', ['isquio', 'femoral', 'hamstring', 'posterior de coxa']], ['glutes', ['gluteo', 'glute']],
    ['calves', ['gemelo', 'pantorrilla', 'calf', 'calves', 'panturrilha']], ['abs', ['abdomin', 'abdomen', 'core', 'abs']],
  ];
  // Los alias cortos deben empezar palabra, para que «abs» no aparezca dentro de otra.
  for (const [m, words] of alias) if (words.some((w) => (w.length <= 4 ? new RegExp(`\\b${w}`).test(t) : t.includes(w)))) return m;
  return null;
}

export { norm };
