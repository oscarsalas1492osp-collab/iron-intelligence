import type { Equipment, Muscle } from './types';

export const MUSCLES: Muscle[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs',
];

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Pecho', back: 'Espalda', shoulders: 'Hombros', biceps: 'Bíceps', triceps: 'Tríceps',
  forearms: 'Antebrazos', quads: 'Cuádriceps', hamstrings: 'Isquiotibiales', glutes: 'Glúteos',
  calves: 'Gemelos', abs: 'Abdominales',
};

export const EQUIPMENT: Equipment[] = [
  'machine', 'cable', 'dumbbell', 'barbell', 'smith', 'bodyweight', 'lever', 'convergent', 'isolation_machine',
];

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  machine: 'Máquina guiada', cable: 'Polea', dumbbell: 'Mancuernas', barbell: 'Barra', smith: 'Smith',
  bodyweight: 'Peso corporal', lever: 'Máquina de palanca', convergent: 'Máquina convergente',
  isolation_machine: 'Máquina de aislamiento',
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Reconoce un grupo muscular mencionado en texto libre (para el asistente). */
export function findMuscle(text: string): Muscle | null {
  const t = norm(text);
  const alias: [Muscle, string[]][] = [
    ['chest', ['pecho', 'pectoral']], ['back', ['espalda', 'dorsal']], ['shoulders', ['hombro', 'deltoides']],
    ['biceps', ['biceps']], ['triceps', ['triceps']], ['forearms', ['antebrazo']],
    ['quads', ['cuadriceps', 'cuadri']], ['hamstrings', ['isquio', 'femoral']], ['glutes', ['gluteo']],
    ['calves', ['gemelo', 'pantorrilla']], ['abs', ['abdominal', 'abdomen', 'core']],
  ];
  for (const [m, words] of alias) if (words.some((w) => t.includes(w))) return m;
  return null;
}

export { norm };
