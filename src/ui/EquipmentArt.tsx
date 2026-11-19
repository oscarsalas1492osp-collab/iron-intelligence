// Ilustraciones vectoriales por tipo de equipamiento. Si el usuario subió una foto propia, se muestra la foto.
import type { Equipment, ExerciseDef } from '../domain/types';
import { EQUIPMENT_LABEL } from '../domain/muscles';

const S = { stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
const A = { ...S, stroke: '#ff6a1a' };
const plate = (x: number, y: number, h = 22) => <rect x={x - 3} y={y - h / 2} width={6} height={h} rx={2} fill="#ff6a1a" />;

const ART: Record<Equipment, JSX.Element> = {
  machine: (<g>
    <path {...S} d="M14 10v52M14 62h40M14 10h16" /><rect x={8} y={20} width={12} height={26} rx={2} fill="#ff6a1a" opacity={0.9} />
    <path {...S} d="M8 26h12M8 32h12M8 38h12" stroke="#16181b" strokeWidth={1.4} />
    <path {...S} d="M44 26v24M36 50h18M44 62V50" /><path {...A} d="M30 10v12l12 8M42 30h10" />
  </g>),
  cable: (<g>
    <path {...S} d="M16 8v54M10 62h34M16 8h26" /><circle cx={42} cy={10} r={4} {...S} />
    <path {...A} d="M42 14v22" /><path {...A} d="M34 36h16" strokeWidth={3.4} />
    <rect x={10} y={30} width={12} height={22} rx={2} fill="#ff6a1a" opacity={0.9} /><path d="M10 37h12M10 44h12" stroke="#16181b" strokeWidth={1.4} />
  </g>),
  dumbbell: (<g>
    <path {...S} d="M22 36h28" strokeWidth={4} />{plate(18, 36, 26)}{plate(11, 36, 16)}{plate(54, 36, 26)}{plate(61, 36, 16)}
  </g>),
  barbell: (<g>
    <path {...S} d="M4 36h64" strokeWidth={3} />{plate(16, 36, 34)}{plate(23, 36, 24)}{plate(56, 36, 34)}{plate(49, 36, 24)}
  </g>),
  smith: (<g>
    <path {...S} d="M14 6v58M58 6v58M8 64h56M14 6h44" /><path {...A} d="M8 34h56" strokeWidth={3} />{plate(8, 34, 20)}{plate(64, 34, 20)}
    <path {...S} d="M14 20h4M14 48h4M58 20h-4M58 48h-4" />
  </g>),
  bodyweight: (<g>
    <path {...S} d="M10 12h52M14 12v52M58 12v52" /><circle cx={36} cy={26} r={6} {...A} /><path {...A} d="M28 12l4 22h8l4-22M32 34v14l-4 12M40 34v14l4 12" />
  </g>),
  lever: (<g>
    <path {...S} d="M12 62h48M18 62V30M18 30l34-14" /><circle cx={18} cy={30} r={3.5} fill="currentColor" />{plate(52, 16, 26)}{plate(59, 14, 18)}
    <path {...A} d="M34 23v16M26 46h22M36 62V46" />
  </g>),
  convergent: (<g>
    <path {...S} d="M36 8v20M36 62V46M24 46h24" /><circle cx={36} cy={10} r={3.5} fill="currentColor" />
    <path {...A} d="M36 12L14 34M36 12l22 22" strokeWidth={3} /><path {...A} d="M14 34l8 6M58 34l-8 6" />
    <path {...S} d="M20 54l8-8M52 54l-8-8" strokeDasharray="2 5" />
  </g>),
  isolation_machine: (<g>
    <path {...S} d="M12 62h48M20 62V40h22v22M20 40V22" /><circle cx={42} cy={40} r={4} fill="currentColor" />
    <path {...A} d="M42 40l16 12" strokeWidth={3} /><rect x={53} y={48} width={12} height={8} rx={4} fill="#ff6a1a" />
    <path {...S} d="M48 30a14 14 0 0110 8" strokeDasharray="2 5" />
  </g>),
  ez_bar: (<g>
    <path {...S} d="M4 36h12l5-5 9 10 6-10 6 10 9-10 5 5h12" strokeWidth={3} />{plate(11, 36, 26)}{plate(61, 36, 26)}
  </g>),
  trap_bar: (<g>
    <path {...S} d="M24 20h24l12 16-12 16H24L12 36z" /><path {...S} d="M2 36h10M60 36h10" strokeWidth={3} />{plate(6, 36, 24)}{plate(66, 36, 24)}
    <path {...A} d="M29 30v12M43 30v12" strokeWidth={3.4} />
  </g>),
  landmine: (<g>
    <path {...S} d="M8 62h56" /><path {...S} d="M10 62l6-10 6 10" /><circle cx={16} cy={52} r={3.5} fill="currentColor" />
    <path {...S} d="M16 52L58 14" strokeWidth={3} /><circle cx={50} cy={21} r={9} {...A} strokeWidth={3} /><circle cx={50} cy={21} r={2} fill="#ff6a1a" />
  </g>),
  kettlebell: (<g>
    <path {...S} d="M25 32c-5-13 2-22 11-22s16 9 11 22" strokeWidth={3.4} /><circle cx={36} cy={44} r={18} fill="#ff6a1a" />
    <path d="M28 40a10 10 0 0116 0" stroke="#16181b" strokeWidth={1.6} fill="none" strokeLinecap="round" />
  </g>),
  plate: (<g>
    <circle cx={36} cy={36} r={27} {...S} /><circle cx={36} cy={36} r={17} {...A} strokeWidth={5} /><circle cx={36} cy={36} r={4.5} fill="currentColor" />
  </g>),
  band: (<g>
    <path {...A} d="M10 36c0-16 52-16 52 0S10 52 10 36z" strokeWidth={4} /><path {...S} d="M24 36c4-5 8 5 12 0s8 5 12 0" />
  </g>),
  suspension: (<g>
    <path {...S} d="M12 8h48" strokeWidth={3} /><path {...S} d="M36 8L20 46M36 8l16 38" />
    <path {...A} d="M12 46h16l-8 14zM44 46h16l-8 14z" strokeWidth={3} />
  </g>),
  medball: (<g>
    <circle cx={36} cy={36} r={25} {...S} /><path {...A} d="M12 30c14 10 34 10 48 0M30 12c-8 16-8 32 0 48" />
  </g>),
  sled: (<g>
    <path {...S} d="M8 58h50l8-8" strokeWidth={3} /><path {...A} d="M20 58V16M48 58V16" strokeWidth={3.4} />
    <rect x={28} y={44} width={12} height={12} rx={2} fill="#ff6a1a" /><rect x={30} y={34} width={8} height={9} rx={2} fill="#ff6a1a" opacity={0.7} />
  </g>),
  other: (<g>
    <path {...S} d="M12 30h36v32H12zM12 30l8-8h36l-8 8M56 22v32l-8 8" /><path {...A} d="M22 46c4-6 8 6 12 0s8 6 12 0" /><circle cx={54} cy={12} r={5} {...A} />
  </g>),
};

export function EquipmentArt({ equipment, size = 56, className }: { equipment: Equipment; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" className={className} role="img" aria-label={EQUIPMENT_LABEL[equipment]} style={{ color: '#d7dbe2' }}>
      {ART[equipment]}
    </svg>
  );
}

/** Miniatura de un ejercicio: foto del usuario si existe; si no, ilustración del equipamiento. */
export function ExerciseThumb({ ex, size = 56 }: { ex: Pick<ExerciseDef, 'equipment' | 'photo' | 'name'>; size?: number }) {
  return (
    <div className="shrink-0 grid place-items-center overflow-hidden rounded-ctl bg-card2" style={{ width: size, height: size }}>
      {ex.photo ? <img src={ex.photo} alt={ex.name} className="h-full w-full object-cover" /> : <EquipmentArt equipment={ex.equipment} size={size * 0.78} />}
    </div>
  );
}
