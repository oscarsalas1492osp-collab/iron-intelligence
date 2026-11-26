// Mapa corporal 2D (frente y espalda) con regiones anatómicas facetadas.
// Geometría: paquete `body-muscles` (Apache-2.0, Ivan Vulović). Se usa como respaldo del modelo 3D
// (mientras carga, sin WebGL o sin conexión en la primera apertura) y en vistas pequeñas.
import { BACK_MUSCLES, FRONT_MUSCLES } from 'body-muscles';
import { COLD, exerciseTones, type Tones } from '../domain/heat';
import { MUSCLE_LABEL } from '../domain/muscles';
import type { Muscle } from '../domain/types';

const RULES: [RegExp, Muscle][] = [
  [/^chest-/, 'chest'],
  [/^lats-/, 'back'],
  [/^traps-/, 'traps'],
  [/^lower-back-/, 'lowerback'],
  [/^(shoulder-(front|side)|deltoid-rear)-/, 'shoulders'],
  [/^biceps-/, 'biceps'],
  [/^triceps-/, 'triceps'],
  [/^forearm/, 'forearms'],
  [/^abs-/, 'abs'],
  [/^obliques-/, 'obliques'],
  [/^gluteus-maximus-/, 'glutes'],
  [/^gluteus-medius-/, 'abductors'],
  [/^adductors-/, 'adductors'],
  [/^quads-/, 'quads'],
  [/^hamstrings-/, 'hamstrings'],
  [/^calves-/, 'calves'],
  [/^tibialis-anterior-/, 'tibialis'],
  [/^(neck-|nape)/, 'neck'],
];
const groupOf = (id: string): Muscle | null => RULES.find(([r]) => r.test(id))?.[1] ?? null;
const REGIONS = [...FRONT_MUSCLES, ...BACK_MUSCLES].map((m) => ({ id: m.id as string, d: m.path, group: groupOf(m.id as string) }));

export interface BodyProps {
  tones: Tones; selected?: Muscle | null; onSelect?: (m: Muscle) => void; className?: string;
  /** Color de los grupos sin tono y de las zonas sin grupo; en vistas pequeñas conviene más oscuro para que resalte lo trabajado. */
  base?: string; skin?: string; label?: string;
}

export function BodyMap({ tones, selected, onSelect, className, base, skin, label }: BodyProps) {
  return (
    <svg viewBox="-1 -1 74 95" className={className} role="img" aria-label={label ?? 'Mapa de grupos musculares, frente y espalda'}>
      {REGIONS.map((r) => {
        const tone = r.group ? tones[r.group] ?? (base ? { color: base, glow: 0 } : COLD) : null;
        const isSel = r.group && r.group === selected;
        return (
          <path key={r.id} d={r.d} fill={tone ? tone.color : skin ?? '#30343b'} stroke={isSel ? '#f3f1ec' : '#16181b'} strokeWidth={isSel ? 0.45 : 0.22} strokeLinejoin="round"
            style={{ transition: 'fill .4s', cursor: r.group && onSelect ? 'pointer' : undefined }} onClick={r.group && onSelect ? () => onSelect(r.group as Muscle) : undefined}>
            {r.group && <title>{MUSCLE_LABEL[r.group]}</title>}
          </path>
        );
      })}
    </svg>
  );
}

/** Mapa reducido de un ejercicio. */
export function ExerciseMuscles({ primary, secondary, className }: { primary: Muscle; secondary: Muscle[]; className?: string }) {
  return <BodyMap tones={exerciseTones(primary, secondary)} className={className} />;
}
