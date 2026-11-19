// Técnicas avanzadas que alargan una serie. Cada una añade tramos (mini-series) pegados a la serie principal.
// Lo que dice la evidencia: igualando volumen y esfuerzo, rinden parecido a las series tradicionales; su ventaja es el tiempo.
import type { Technique } from './types';

export interface TechniqueInfo {
  id: Exclude<Technique, ''>;
  name: string;
  /** Rótulo de cada tramo en la lista de series. */
  tag: string;
  how: string;
  when: string;
  /** Carga del tramo respecto de la serie principal, repeticiones iniciales y pausa sugerida en segundos. */
  weight: number; reps: (parent: number) => number; pause: number;
  evidence: string; source: string;
}

export const TECHNIQUES: TechniqueInfo[] = [
  {
    id: 'drop', name: 'Dropset', tag: 'Bajada',
    how: 'Al terminar la serie cerca del fallo, baja la carga un 20–25 % y sigue de inmediato. Una a tres bajadas.',
    when: 'Máquinas, poleas y mancuernas, donde cambiar la carga toma segundos. Mejor en la última serie del ejercicio.',
    weight: 0.8, reps: (p) => Math.max(1, Math.round(p * 0.7)), pause: 0,
    evidence: 'Dos metaanálisis no hallaron diferencias de hipertrofia frente a series tradicionales; las sesiones duraron entre la mitad y un tercio. Genera más fatiga y esfuerzo percibido.',
    source: 'https://doi.org/10.1186/s40798-023-00620-5',
  },
  {
    id: 'restpause', name: 'Descanso-pausa', tag: 'Pausa',
    how: 'Lleva la serie cerca del fallo, descansa 15–20 s y saca más repeticiones con la misma carga. Dos o tres pausas.',
    when: 'Ejercicios estables en los que fallar es seguro. Permite sumar repeticiones con cargas altas en poco tiempo.',
    weight: 1, reps: (p) => Math.max(1, Math.round(p * 0.4)), pause: 20,
    evidence: 'En un estudio de seis semanas dio fuerza similar a las series múltiples tradicionales. Un metaanálisis de 2026 le atribuye una ventaja pequeña en hipertrofia.',
    source: 'https://pubmed.ncbi.nlm.nih.gov/28617715/',
  },
  {
    id: 'myo', name: 'Myo-reps', tag: 'Mini',
    how: 'Una serie de activación de 12–20 repeticiones cerca del fallo y luego mini-series de 3–5 con la misma carga, separadas por unas pocas respiraciones (10–15 s).',
    when: 'Aislamientos con cargas ligeras o moderadas. Se detiene cuando ya no salen las repeticiones de la mini-serie.',
    weight: 1, reps: () => 4, pause: 15,
    evidence: 'Es una variante del descanso-pausa con pausas fijas. No tiene estudios propios que la comparen: los parámetros son una estimación práctica.',
    source: 'https://www.mdpi.com/2411-5142/11/1/80',
  },
  {
    id: 'cluster', name: 'Cluster', tag: 'Bloque',
    how: 'Divide la serie en bloques de pocas repeticiones con 15–30 s de pausa entre ellos, sin llegar al fallo en cada bloque.',
    when: 'Básicos pesados, cuando interesa mantener la velocidad y la técnica con cargas altas.',
    weight: 1, reps: (p) => Math.max(1, p), pause: 20,
    evidence: 'Atenúa la pérdida de velocidad y potencia dentro de la serie. Con el mismo número de series y el esfuerzo igualado, la hipertrofia fue similar a la de las series tradicionales.',
    source: 'https://doi.org/10.1007/s00421-025-05712-6',
  },
];

export const TECHNIQUE: Record<Exclude<Technique, ''>, TechniqueInfo> = Object.fromEntries(TECHNIQUES.map((t) => [t.id, t])) as Record<Exclude<Technique, ''>, TechniqueInfo>;

export const SUPERSET_INFO = {
  how: 'Dos o tres ejercicios seguidos, sin descanso entre ellos. Una serie es la ronda completa; el descanso va al terminar la ronda.',
  evidence: 'Un metaanálisis de 2025 encontró repeticiones, volumen y adaptaciones a largo plazo similares a las series tradicionales con sesiones más cortas, a cambio de más esfuerzo percibido. Emparejar músculos opuestos (por ejemplo pecho y espalda) es lo que menos resta rendimiento.',
  source: 'https://doi.org/10.1007/s40279-025-02176-8',
};
