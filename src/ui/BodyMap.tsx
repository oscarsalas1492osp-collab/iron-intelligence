// Mapa corporal esquemático (vista frontal y posterior). Cada región se colorea desde fuera.
import type { Muscle } from '../domain/types';
import { MUSCLE_LABEL } from '../domain/muscles';

type Shape = { m: Muscle; d: 'e' | 'r'; x: number; y: number; w: number; h: number; r?: number };
const mirror = (s: Shape, cx: number): Shape => ({ ...s, x: 2 * cx - s.x });
const pair = (s: Shape, cx: number): Shape[] => [s, mirror(s, cx)];

function shapes(cx: number, back: boolean): Shape[] {
  const arms = [
    ...pair({ m: 'shoulders', d: 'e', x: cx - 37, y: 74, w: 15, h: 12 }, cx),
    ...pair({ m: back ? 'triceps' : 'biceps', d: 'e', x: cx - 45, y: 106, w: 9.5, h: 21 }, cx),
    ...pair({ m: 'forearms', d: 'e', x: cx - 52, y: 152, w: 8, h: 23 }, cx),
  ];
  const calves = pair({ m: 'calves', d: 'e', x: cx - 17, y: 300, w: back ? 11 : 8.5, h: 30 }, cx);
  if (back) {
    return [
      { m: 'back', d: 'r', x: cx, y: 100, w: 54, h: 74, r: 16 },
      ...arms,
      ...pair({ m: 'glutes', d: 'e', x: cx - 14, y: 172, w: 14.5, h: 16 }, cx),
      ...pair({ m: 'hamstrings', d: 'e', x: cx - 16, y: 228, w: 13.5, h: 34 }, cx),
      ...calves,
    ];
  }
  return [
    ...pair({ m: 'chest', d: 'r', x: cx - 13.5, y: 84, w: 25, h: 28, r: 9 }, cx),
    { m: 'abs', d: 'r', x: cx, y: 130, w: 34, h: 54, r: 9 },
    ...arms,
    ...pair({ m: 'quads', d: 'e', x: cx - 16, y: 222, w: 14.5, h: 40 }, cx),
    ...calves,
  ];
}

function Figure({ cx, back, fill, label }: { cx: number; back: boolean; fill: (m: Muscle) => string; label: string }) {
  const base = '#23262c';
  return (
    <g>
      <circle cx={cx} cy={34} r={15} fill={base} />
      <rect x={cx - 6} y={47} width={12} height={12} fill={base} />
      <rect x={cx - 32} y={60} width={64} height={110} rx={20} fill={base} />
      <rect x={cx - 30} y={150} width={60} height={46} rx={16} fill={base} />
      {[-1, 1].map((s) => (
        <g key={s}>
          <rect x={cx + s * 44 - 11} y={66} width={22} height={66} rx={11} fill={base} />
          <rect x={cx + s * 52 - 9} y={126} width={18} height={56} rx={9} fill={base} />
          <rect x={cx + s * 16 - 15} y={180} width={30} height={96} rx={14} fill={base} />
          <rect x={cx + s * 17 - 11} y={266} width={22} height={74} rx={10} fill={base} />
        </g>
      ))}
      {shapes(cx, back).map((s, i) =>
        s.d === 'e'
          ? <ellipse key={i} cx={s.x} cy={s.y} rx={s.w} ry={s.h} fill={fill(s.m)} style={{ transition: 'fill .4s' }}><title>{MUSCLE_LABEL[s.m]}</title></ellipse>
          : <rect key={i} x={s.x - s.w / 2} y={s.y - s.h / 2} width={s.w} height={s.h} rx={s.r} fill={fill(s.m)} style={{ transition: 'fill .4s' }}><title>{MUSCLE_LABEL[s.m]}</title></rect>,
      )}
      <text x={cx} y={360} textAnchor="middle" fontSize="10" fill="#8b919c" letterSpacing="1.5">{label}</text>
    </g>
  );
}

export function BodyMap({ colors, className }: { colors: Partial<Record<Muscle, string>>; className?: string }) {
  const fill = (m: Muscle) => colors[m] ?? '#343840';
  return (
    <svg viewBox="0 0 260 366" className={className} role="img" aria-label="Mapa de grupos musculares">
      <Figure cx={66} back={false} fill={fill} label="FRENTE" />
      <Figure cx={194} back fill={fill} label="ESPALDA" />
    </svg>
  );
}

/** Mapa reducido para un ejercicio: principal en naranja, secundarios atenuados. */
export function ExerciseMuscles({ primary, secondary, className }: { primary: Muscle; secondary: Muscle[]; className?: string }) {
  const colors: Partial<Record<Muscle, string>> = {};
  for (const m of secondary) colors[m] = '#8a4a26';
  colors[primary] = '#ff6a1a';
  return <BodyMap colors={colors} className={className} />;
}
