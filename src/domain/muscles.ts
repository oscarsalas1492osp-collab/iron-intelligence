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
  const alias: [Muscle, string[]][] = [
    ['traps', ['trapecio']], ['lowerback', ['lumbar', 'espalda baja', 'erector']], ['obliques', ['oblicuo']],
    ['abductors', ['abductor', 'gluteo medio']], ['adductors', ['aductor']], ['tibialis', ['tibial']], ['neck', ['cuello']],
    ['chest', ['pecho', 'pectoral']], ['back', ['espalda', 'dorsal']], ['shoulders', ['hombro', 'deltoides']],
    ['biceps', ['biceps']], ['triceps', ['triceps']], ['forearms', ['antebrazo']],
    ['quads', ['cuadriceps', 'cuadri']], ['hamstrings', ['isquio', 'femoral']], ['glutes', ['gluteo']],
    ['calves', ['gemelo', 'pantorrilla']], ['abs', ['abdominal', 'abdomen', 'core']],
  ];
  for (const [m, words] of alias) if (words.some((w) => t.includes(w))) return m;
  return null;
}

export { norm };
