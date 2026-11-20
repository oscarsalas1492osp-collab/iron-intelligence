// Escenas de los iconos de ejercicio: postura inicial (a) y postura característica (b) de cada patrón de movimiento.
// La clave es el patrón; el sufijo indica la variante según el implemento: @m máquina, @c polea o banda, @b peso corporal o suspensión.
import type { Equipment, ExType, Muscle } from '../../domain/types';
import type { Pose, V, View } from './rig';

export type Prop = ['l', number, number, number, number, number?] | ['r', number, number, number, number] | ['c', number, number, number];
export interface Scene {
  view: View; a: Pose; b: Pose;
  props?: Prop[];
  /** Respaldo o banco tras la espalda; asiento bajo la cadera; línea de suelo. */
  bench?: boolean; seat?: boolean; floor?: boolean;
  /** Dónde va la carga. Por defecto, en las manos. */
  load?: 'hand' | 'ankle' | 'feet' | 'hip' | 'knee' | 'wheel' | 'rope' | 'none';
  /** Origen del cable o de la banda, eje de la palanca y posición de las placas. */
  anchor?: V; pivot?: V; stack?: V;
  /** Barra recta entre las manos (jalones); figura invertida (parada de manos); sin movimiento (isométricos). */
  bar?: boolean; flip?: boolean; still?: boolean;
  /** Profundidad para el render 3D (vista lateral): medio ancho del agarre, apertura de codos, medio ancho de pies y apertura de rodillas. */
  d3?: { grip?: number; flare?: number; stance?: number; knee?: number };
}

const P = (x: number, y: number, lean: number, o: Partial<Pose> = {}): Pose => ({ hip: [x, y], lean, ...o });
const F: V = [34, 65];
const st = (o: Partial<Pose> = {}) => P(34, 41, 0, { foot: F, ...o });
const fr = (o: Partial<Pose> = {}, lean = 0) => P(36, 41, lean, o);
const still = (view: View, p: Pose, extra: Partial<Scene> = {}): Scene => ({ view, a: p, b: p, still: true, ...extra });
const BENCH_FEET: V = [57, 65];
const DIP_BARS: Prop[] = [['l', 28, 43.2, 44, 43.2, 2.2], ['l', 36, 43.2, 36, 67, 2]];
const HANG: Pose = fr({ hand: [11, 9], leg: [2, 4] }); HANG.hip = [36, 42.5];
const PUSH_A = P(31, 53, 77, { hand: [44.5, 65], foot: [9, 63], ft: 20 });
const JUMP_B = P(36, 37.5, 4, { leg: [6, -8], arm: [158, 168] });

export const SCENES: Record<string, Scene | string> = {
  // ---- Empujes ----
  press_h: { view: 'side', bench: true, a: P(46, 48, -90, { hand: [29.5, 31.5], foot: BENCH_FEET }), b: P(46, 48, -90, { hand: [34, 43.5], foot: BENCH_FEET }) },
  'press_h@m': { view: 'side', bench: true, seat: true, a: P(24, 51, -6, { hand: [29, 36.5], foot: [38, 65] }), b: P(24, 51, -6, { hand: [38.6, 35], foot: [38, 65] }) },
  'press_h@c': { view: 'side', anchor: [5, 27], a: P(30, 42.5, 8, { hand: [35, 28], foot: [23, 65], foot2: [38, 65] }), b: P(30, 42.5, 8, { hand: [48.6, 27], foot: [23, 65], foot2: [38, 65] }) },
  press_incline: { view: 'side', bench: true, a: P(46, 51, -55, { hand: [33, 25], foot: [58, 65] }), b: P(46, 51, -55, { hand: [39, 36.5], foot: [58, 65] }) },
  'press_incline@m': { view: 'side', bench: true, seat: true, a: P(24, 51, -22, { hand: [27, 34], foot: [38, 65] }), b: P(24, 51, -22, { hand: [31, 20], foot: [38, 65] }) },
  press_decline: { view: 'side', bench: true, a: P(45, 45, -103, { hand: [30, 32.5], foot: [56, 58] }), b: P(45, 45, -103, { hand: [34.5, 44.5], foot: [56, 58] }) },
  'press_decline@m': { view: 'side', bench: true, seat: true, a: P(24, 51, -6, { hand: [29, 39], foot: [38, 65] }), b: P(24, 51, -6, { hand: [37, 43.5], foot: [38, 65] }) },
  press_close: 'press_h',
  fly: { view: 'front', anchor: [33, 22], a: fr({ arm: [92, 84] }), b: fr({ hand: [2.6, 27], e: -1 }) },
  pushup: { view: 'side', a: PUSH_A, b: P(31, 58.5, 87, { hand: [44.5, 65], foot: [9, 63], ft: 20 }) },
  dip: { view: 'side', props: DIP_BARS, a: P(34, 42, 6, { hand: [36, 41.5], leg: [-8, -50] }), b: P(33, 48.5, 22, { hand: [36, 41.5], leg: [-20, -82] }) },
  'dip@m': { view: 'side', bench: true, seat: true, pivot: [12, 44], a: P(26, 51, 2, { hand: [32, 40.5], foot: [40, 65] }), b: P(26, 51, 2, { hand: [31.5, 49.5], foot: [40, 65] }) },
  press_oh: { view: 'side', a: st({ hand: [37.5, 25] }), b: st({ hand: [35, 7.8] }) },
  'press_oh@m': { view: 'side', bench: true, seat: true, a: P(26, 51, -4, { hand: [29, 33.5], foot: [40, 65] }), b: P(26, 51, -4, { hand: [26.6, 17.8], foot: [40, 65] }) },
  // ---- Hombros ----
  raise_lat: { view: 'front', anchor: [32, 62], a: fr({ arm: [4, 6] }), b: fr({ arm: [84, 88] }) },
  raise_front: { view: 'side', anchor: [8, 62], a: st({ arm: [3, 6] }), b: st({ arm: [88, 92] }) },
  raise_rear: { view: 'front', anchor: [33, 22], a: fr({ hand: [2.6, 29], e: -1 }), b: fr({ arm: [86, 90] }) },
  facepull: { view: 'side', anchor: [65, 14], a: st({ arm: [86, 95] }), b: st({ arm: [70, 150] }) },
  upright_row: { view: 'front', anchor: [0, 66], a: fr({ arm: [2, -8] }), b: fr({ arm: [112, -55] }) },
  rot_ext: { view: 'front', anchor: [-33, 34], a: fr({ arm: [4, -72] }), b: fr({ arm: [4, 76] }) },
  rot_int: { view: 'front', anchor: [33, 34], a: fr({ arm: [4, 76] }), b: fr({ arm: [4, -72] }) },
  shrug: { view: 'front', a: fr({ arm: [5, 5] }), b: fr({ arm: [5, 5], lift: 3.2 }) },
  // ---- Tirones ----
  pulldown: { view: 'front', bar: true, anchor: [0, 3], props: [['l', 26, 53.5, 46, 53.5, 3]], a: P(36, 49.5, 0, { hand: [15, 17.5], sit: true, leg: [14, 2] }), b: P(36, 49.5, 0, { hand: [13, 30.5], sit: true, leg: [14, 2] }) },
  pullup: { view: 'front', floor: false, props: [['l', 14, 9, 58, 9, 2.6]], a: P(36, 42.5, 0, { hand: [11, 9], leg: [2, 4] }), b: P(36, 31, 0, { hand: [11, 9], leg: [2, 12] }) },
  row: { view: 'side', anchor: [62, 64], a: P(30, 42, 60, { hand: [46, 49.5], foot: [31, 65] }), b: P(30, 42, 60, { hand: [40, 40], foot: [31, 65] }) },
  'row@m': { view: 'side', seat: true, anchor: [65, 41], stack: [62, 30], pivot: [50, 62], props: [['l', 44, 58, 44, 67, 2]], a: P(22, 51, 5, { hand: [39.6, 37], foot: [41.5, 60], ft: 150 }), b: P(22, 51, -5, { hand: [28.5, 39], foot: [41.5, 60], ft: 150 }) },
  'row@c': 'row@m',
  'row@b': { view: 'side', props: [['l', 25, 35, 25, 67, 1.8], ['c', 25, 36, 1.9]], anchor: [25, 3], a: P(36, 61, -50, { hand: [25, 36], foot: [58, 65], ft: 170 }), b: P(38, 51.5, -62, { hand: [25, 36], foot: [58, 65], ft: 170 }) },
  pullover: { view: 'side', bench: true, a: P(46, 48, -90, { hand: [13.5, 45], foot: BENCH_FEET }), b: P(46, 48, -90, { hand: [29.5, 31.5], foot: BENCH_FEET }) },
  'pullover@c': { view: 'side', anchor: [65, 6], a: P(30, 41, 18, { hand: [50, 17.5], foot: [31, 65] }), b: P(30, 41, 22, { hand: [41, 41], foot: [31, 65] }) },
  'pullover@m': { view: 'side', bench: true, seat: true, a: P(26, 51, -4, { hand: [21, 18.5], foot: [40, 65] }), b: P(26, 51, -4, { hand: [35, 47], foot: [40, 65] }) },
  scap: { view: 'front', floor: false, props: [['l', 14, 9, 58, 9, 2.6]], a: P(36, 43.5, 0, { hand: [11, 9], leg: [2, 4], lift: 3 }), b: P(36, 41, 0, { hand: [11, 9], leg: [2, 4] }) },
  hang: still('front', HANG, { floor: false, props: [['l', 14, 9, 58, 9, 2.6]] }),
  // ---- Brazos ----
  curl: { view: 'side', anchor: [50, 66], a: st({ arm: [2, 10] }), b: st({ arm: [6, 152] }) },
  'curl@m': { view: 'side', seat: true, props: [['l', 29.5, 39, 37, 45, 3.2], ['l', 35, 46, 35, 67, 2]], a: P(24, 51, 10, { arm: [52, 60], foot: [38, 65] }), b: P(24, 51, 10, { arm: [52, 172], foot: [38, 65] }) },
  curl_rev: 'curl',
  tri_down: { view: 'side', anchor: [47, 5], a: P(33, 41, 8, { arm: [8, 118], foot: [33, 65] }), b: P(33, 41, 8, { arm: [8, 10], foot: [33, 65] }) },
  tri_oh: { view: 'side', anchor: [8, 62], a: st({ arm: [176, -28] }), b: st({ arm: [176, 180] }) },
  tri_lying: { view: 'side', bench: true, a: P(46, 48, -90, { arm: [172, -110], foot: BENCH_FEET }), b: P(46, 48, -90, { arm: [172, 178], foot: BENCH_FEET }) },
  tri_kick: { view: 'side', anchor: [62, 64], a: P(30, 42, 68, { arm: [-82, 0], foot: [31, 65] }), b: P(30, 42, 68, { arm: [-82, -86], foot: [31, 65] }) },
  wrist_flex: { view: 'side', seat: true, a: P(24, 51, 28, { arm: [40, 88], foot: [38, 65], w: 40 }), b: P(24, 51, 28, { arm: [40, 88], foot: [38, 65], w: 150 }) },
  wrist_ext: 'wrist_flex',
  grip: still('side', st({ arm: [3, 3] })),
  'grip@b': 'hang',
  // ---- Piernas ----
  squat: { view: 'side', a: P(34, 41, 3, { foot: F, hr: [1.5, 1] }), b: P(27, 55.5, 32, { foot: F, hr: [1.5, 1] }) },
  'squat@m': { view: 'side', bench: true, props: [['l', 34, 66.5, 47, 58.5, 2.6]], a: P(27, 41, -22, { foot: [38.5, 62], hr: [3, 2], ft: 120 }), b: P(33, 55, -22, { foot: [38.5, 62], hr: [3, 2], ft: 120 }) },
  legpress: { view: 'side', bench: true, seat: true, load: 'feet', a: P(26, 57, -50, { foot: [45, 41], hh: [3, 2], ft: -140 }), b: P(26, 57, -50, { foot: [37, 47.5], hh: [3, 2], ft: -140 }) },
  lunge: { view: 'side', a: P(33, 41, 2, { foot: [36, 65], foot2: [30, 65], arm: [0, 5] }), b: P(32, 50, 4, { foot: [44, 65], foot2: [14, 63], ft2: 30, arm: [0, 5] }) },
  stepup: { view: 'side', props: [['r', 40, 59, 24, 8]], a: P(36, 42, 8, { foot: [46, 57], foot2: [31, 65], arm: [0, 5] }), b: P(45, 33, 2, { foot: [46, 57], foot2: [43.5, 57], arm: [0, 5] }) },
  hinge: { view: 'side', a: P(34, 41, 3, { foot: F, arm: [4, 4] }), b: P(29, 42, 72, { foot: F, arm: [2, 2] }) },
  deadlift: { view: 'side', a: P(34, 41, 2, { foot: [35, 65], arm: [3, 3] }), b: P(26, 50, 55, { foot: [35, 65], hand: [40, 56] }) },
  hipthrust: { view: 'side', load: 'hip', props: [['r', 5, 53.5, 15, 13.5]], a: P(33, 61, -50, { foot: [48.2, 65], hh: [1.5, -3.2], hd: 25 }), b: P(36, 53, -83, { foot: [48.2, 65], hh: [1.5, -3.2], hd: 40 }) },
  kickback: { view: 'side', anchor: [62, 64], load: 'ankle', props: [['l', 51, 30, 51, 67, 2]], a: P(32, 41, 35, { hand: [50, 31], foot2: [33, 65], foot: [31, 64.5] }), b: P(32, 41, 38, { hand: [50, 31], foot2: [33, 65], foot: [13, 53], ft: 10 }) },
  backext: { view: 'side', props: [['l', 11, 66, 28, 49, 2.4], ['l', 25, 50, 33.5, 42.5, 4.4], ['l', 6, 67, 40, 67, 2]], a: P(29, 45, 120, { leg: [-45, -45], hr: [2, 3], ft: 45 }), b: P(29, 45, 45, { leg: [-45, -45], hr: [2, 3], ft: 45 }) },
  legext: { view: 'side', bench: true, seat: true, load: 'ankle', a: P(24, 50, -12, { leg: [86, -6], hh: [4, 1.5] }), b: P(24, 50, -12, { leg: [86, 84], hh: [4, 1.5] }) },
  legcurl: { view: 'side', load: 'ankle', stack: [62, 30], props: [['r', 15, 55.6, 36, 3], ['l', 20, 58.6, 20, 67, 2], ['l', 46, 58.6, 46, 67, 2]], a: P(31, 52.5, 88, { leg: [-90, -88], arm: [60, 100] }), b: P(31, 52.5, 88, { leg: [-90, 165], arm: [60, 100] }) },
  'legcurl@m': { view: 'side', bench: true, seat: true, load: 'ankle', a: P(24, 50, -12, { leg: [86, 80], hh: [4, 1.5] }), b: P(24, 50, -12, { leg: [86, -28], hh: [4, 1.5] }) },
  'legcurl@s': { view: 'side', load: 'ankle', props: [['l', 49, 29, 49, 67, 2]], a: P(33, 41, 8, { hand: [48, 30], foot2: [33, 65], leg: [2, 2] }), b: P(33, 41, 8, { hand: [48, 30], foot2: [33, 65], leg: [2, -105] }) },
  nordic: { view: 'side', props: [['c', 18, 60.4, 2.4], ['l', 13, 66.8, 24, 66.8, 2]], a: P(30, 50.8, 0, { leg: [0, -90], arm: [30, 120] }), b: P(39.3, 55.2, 50, { leg: [-50, -90], arm: [60, 110] }) },
  abduction: { view: 'front', load: 'knee', props: [['l', 25, 53.6, 47, 53.6, 3]], a: P(36, 49.5, 0, { leg: [30, 2], kT: 0.42, arm: [8, 12] }), b: P(36, 49.5, 0, { leg: [80, 4], kT: 0.9, arm: [8, 12] }) },
  adduction: { view: 'front', load: 'knee', props: [['l', 25, 53.6, 47, 53.6, 3]], a: P(36, 49.5, 0, { leg: [80, 4], kT: 0.9, arm: [8, 12] }), b: P(36, 49.5, 0, { leg: [30, 2], kT: 0.42, arm: [8, 12] }) },
  calf: { view: 'side', props: [['r', 33, 66.4, 10, 3]], a: P(33, 41.6, 0, { foot: [32.5, 65.6], ft: 78, arm: [2, 4] }), b: P(33, 38.4, 0, { foot: [33.5, 62.4], ft: 38, arm: [2, 4] }) },
  tibia: { view: 'side', bench: true, seat: true, load: 'none', a: P(24, 50, -8, { leg: [86, 4], ft: 125, hh: [4, 1.5] }), b: P(24, 50, -8, { leg: [86, 4], ft: 62, hh: [4, 1.5] }) },
  // ---- Zona media ----
  // Crunch en polea: de rodillas frente a la polea alta, la cuerda junto a la cabeza y el tronco se enrolla hacia el suelo.
  'crunch@c': { view: 'side', anchor: [56, 6], a: P(30, 51.6, 10, { leg: [10, -88], hr: [2.6, -3.4] }), b: P(30, 51.6, 74, { leg: [10, -88], hr: [2.6, -3.4], hd: 18 }) },
  // Crunch en máquina: sentado, el tronco se flexiona hacia delante contra la resistencia.
  'crunch@m': { view: 'side', seat: true, load: 'none', a: P(26, 51, -10, { foot: [40, 65], hr: [3.4, -1.6] }), b: P(26, 51, 30, { foot: [40, 65], hr: [3.4, -1.6], hd: 10 }) },
  // Gemelo sentado: rodillas a 90° bajo la almohadilla; solo se mueve el tobillo.
  calf_seated: { view: 'side', seat: true, load: 'none', props: [['c', 37.6, 47.4, 2.3], ['r', 36, 66.2, 9, 2.4]], d3: { stance: 3.6 },
    a: P(26, 51, 2, { foot: [39, 65.4], ft: 80, hh: [10.5, -1.2] }), b: P(26, 50.4, 2, { foot: [39.6, 62.8], ft: 42, hh: [10.5, -1.6] }) },
  crunch: { view: 'side', a: P(38, 62, -90, { foot: [52, 65], hr: [-1, -2.5] }), b: P(38, 62, -58, { foot: [52, 65], hr: [-1, -2.5] }) },
  situp: { view: 'side', a: P(38, 62, -90, { foot: [52, 65], hr: [-1, -2.5] }), b: P(38, 62, -18, { foot: [52, 65], hr: [-1, -2.5] }) },
  legraise: { view: 'side', floor: false, props: [['l', 26, 9.6, 42, 9.6, 2.6]], a: P(34, 43.2, 0, { hand: [34, 10], leg: [2, 2] }), b: P(34, 43.2, -6, { hand: [34, 10], leg: [84, 80] }) },
  rollout: { view: 'side', load: 'wheel', a: P(22, 51, 74, { leg: [-10, -93], hand: [41, 62] }), b: P(30, 56, 82, { leg: [-55, -93], hand: [62, 61.5] }) },
  plank: still('side', P(30, 58, 85, { arm: [0, 88], foot: [7.5, 63.5], ft: 15 })),
  rotation: { view: 'front', anchor: [33, 8], a: fr({ hand: [10, 19], hand2: [-9, 20], e2: -1 }, -8), b: fr({ hand: [-6, 37], hand2: [7, 37], e: -1 }, 8) },
  antirot: 'press_h@c',
  sidebend: { view: 'front', anchor: [-33, 62], a: fr({ arm: [3, 3] }), b: fr({ arm: [3, 3] }, 17) },
  neck: { view: 'side', a: st({ arm: [3, 5] }), b: st({ arm: [3, 5], hd: 34 }) },
  // ---- Funcional y potencia ----
  carry: { view: 'side', a: P(34, 41.8, 2, { foot: [41, 65], foot2: [27, 65], ft2: 60, arm: [2, 5] }), b: P(34, 41.8, 2, { foot: [27, 65], foot2: [41, 65], ft: 60, arm: [2, 5] }) },
  sled: { view: 'side', load: 'none', props: [['l', 55.5, 31, 55.5, 63, 2.4], ['l', 50, 65.7, 69, 65.7, 2.6], ['r', 58.5, 53, 7.5, 10]], a: P(26, 46, 55, { hand: [55, 40.5], foot: [31, 65], foot2: [9, 62], ft2: 35 }), b: P(26, 46, 55, { hand: [55, 40.5], foot: [9, 62], foot2: [31, 65], ft: 35 }) },
  swing: { view: 'side', a: P(28, 44, 62, { hand: [33, 50.5], foot: F }), b: P(34, 41, -3, { hand: [50.5, 26], foot: F }) },
  oly: { view: 'side', a: P(26, 50, 55, { hand: [40, 56], foot: [35, 65] }), b: P(34, 41, 0, { hand: [38.5, 25], foot: [35, 65] }) },
  thruster: { view: 'side', a: P(27, 55.5, 30, { foot: F, hr: [3, 0.5] }), b: P(34, 41, 0, { foot: F, hand: [35, 7.8] }) },
  throw: { view: 'side', a: st({ hand: [35, 7.8] }), b: P(30, 46, 45, { foot: F, hand: [46, 52] }) },
  jump: { view: 'side', load: 'none', a: P(28, 52, 35, { foot: F, arm: [-45, -30] }), b: JUMP_B },
  getup: { view: 'side', a: P(32, 50, 4, { foot: [43, 65], foot2: [15, 63], ft2: 30, arm: [178, 178], arm2: [5, 10] }), b: P(34, 41, 0, { foot: [36, 65], foot2: [32, 65], arm: [178, 178], arm2: [5, 10] }) },
  crawl: { view: 'side', load: 'none', a: P(26, 51, 82, { hand: [46, 65], hand2: [40, 65], foot: [23, 65], foot2: [9, 64], ft: 20, ft2: 20 }), b: P(26, 51, 82, { hand: [40, 65], hand2: [46, 65], foot: [9, 64], foot2: [23, 65], ft: 20, ft2: 20 }) },
  ropes: { view: 'side', load: 'rope', a: P(30, 46, 20, { foot: [35, 65], hand: [49, 31], hand2: [48, 40] }), b: P(30, 46, 20, { foot: [35, 65], hand: [48, 40], hand2: [49, 31] }) },
  conditioning: { view: 'side', load: 'none', a: PUSH_A, b: JUMP_B },
  hold: 'plank',
  // ---- Posturas propias de algunos ejercicios ----
  wallsit: still('side', P(24.5, 52, 0, { leg: [88, 2], arm: [20, 62] }), { props: [['l', 19.6, 10, 19.6, 67, 2.6]] }),
  support: still('side', P(34, 42, 4, { hand: [36, 41.5], leg: [-4, -20] }), { props: DIP_BARS }),
  lsit: still('side', P(34, 42, -4, { hand: [36, 41.5], leg: [88, 88] }), { props: DIP_BARS }),
  hollow: still('side', P(34, 60, -78, { leg: [102, 104], arm: [-105, -110] })),
  handstand: still('side', P(34, 41, 0, { hand: [35, 7.8], leg: [0, 0] }), { flip: true }),
  hspu: { view: 'side', flip: true, load: 'none', a: P(34, 41, 0, { hand: [35, 7.8], leg: [0, 0] }), b: P(34, 33.5, 0, { hand: [35, 7.8], leg: [0, 0] }) },
  frontlever: still('side', P(43, 25.5, -90, { hand: [26, 9.6], leg: [90, 90] }), { floor: false, props: [['l', 18, 9.6, 34, 9.6, 2.6]] }),
};

// Profundidad de cada patrón, según su ejecución: agarre algo más ancho que los hombros y codos abiertos en los
// empujes horizontales, pies al ancho de hombros con las rodillas siguiendo la punta del pie en la sentadilla,
// agarre cerrado en las extensiones de tríceps, pies en línea en la zancada.
const D3: Record<string, NonNullable<Scene['d3']>> = {
  press_h: { grip: 10, flare: 5.5 }, 'press_h@m': { grip: 8.5, flare: 5 }, 'press_h@c': { grip: 7, flare: 3 }, press_incline: { grip: 10, flare: 5.5 }, 'press_incline@m': { grip: 8.5, flare: 5 },
  press_decline: { grip: 10, flare: 5.5 }, 'press_decline@m': { grip: 8.5, flare: 5 }, pushup: { grip: 8.5, flare: 4, stance: 2.6 }, dip: { grip: 6.9, flare: 1.6, stance: 2.4 }, 'dip@m': { grip: 7, flare: 2 },
  press_oh: { grip: 8.2, flare: 4.5, stance: 4.6 }, 'press_oh@m': { grip: 8.5, flare: 5 }, raise_front: { grip: 6 }, facepull: { grip: 4.6, flare: 7 },
  row: { grip: 7.6, flare: 2.6, stance: 4.6 }, 'row@m': { grip: 6.2, flare: 2 }, 'row@c': { grip: 3.2, flare: 1.4 }, 'row@b': { grip: 7.6, flare: 3 }, pullover: { grip: 3.4, flare: 1.5 },
  curl: { grip: 6, flare: 0.3 }, 'curl@m': { grip: 5, flare: 0.6 }, curl_rev: { grip: 6, flare: 0.5 }, tri_down: { grip: 3, flare: 0.5 }, tri_oh: { grip: 3, flare: 1.6 }, tri_lying: { grip: 4, flare: 1 },
  tri_kick: { flare: 0.4 }, wrist_flex: { grip: 4.6, stance: 5 }, wrist_ext: { grip: 4.6, stance: 5 },
  squat: { stance: 6.4, knee: 1.8, grip: 9.5, flare: 3 }, 'squat@m': { stance: 5.6, knee: 1.2 }, legpress: { stance: 5.2, knee: 1.2 }, lunge: { stance: 3 }, stepup: { stance: 3.2 },
  hinge: { stance: 4.4, grip: 7.4 }, deadlift: { stance: 4.6, grip: 7.6, knee: 0.8 }, hipthrust: { stance: 5.6, knee: 1 }, calf: { stance: 3.6 }, legext: { stance: 4 }, legcurl: { stance: 3.6 },
  swing: { stance: 6.6, knee: 1.5, grip: 2.2 }, oly: { stance: 5.6, grip: 9.5, flare: 3 }, thruster: { stance: 6, knee: 1.6, grip: 8.5, flare: 3 }, jump: { stance: 5 }, carry: { grip: 7.4 },
  situp: { stance: 3.6 }, crunch: { stance: 3.6 }, rollout: { grip: 6 }, plank: { grip: 6, stance: 3 }, sled: { grip: 6 },
};
// El press cerrado comparte postura con el de banca, pero con las manos al ancho de los hombros y los codos pegados.
SCENES.press_close = { ...(SCENES.press_h as Scene), d3: { grip: 4.8, flare: 1.2 } };
for (const k in D3) { const sc = SCENES[k]; if (sc && typeof sc !== 'string' && !sc.d3) sc.d3 = D3[k]; }

/** Ejercicios cuya postura no es la general de su patrón. */
const BY_ID: Record<string, string> = {
  seated_calf_raise: 'calf_seated', seated_calf_raise_machine: 'calf_seated', suspension_pike: 'plank', fitball_pike: 'plank',
  wall_sit: 'wallsit', handstand_hold: 'handstand', handstand_push_up: 'hspu', l_sit: 'lsit', hollow_hold: 'hollow', front_lever: 'frontlever',
  ring_support_hold: 'support', dead_hang: 'hang', lying_leg_curl: 'legcurl', leg_curl_lever: 'legcurl', kneeling_leg_curl: 'legcurl@s',
  standing_leg_curl: 'legcurl@s', assisted_dip_machine: 'dip', assisted_pull_up_machine: 'pullup', glute_ham_raise: 'nordic',
  incline_push_up: 'pushup', pike_push_up: 'pushup', toes_to_bar: 'legraise', copenhagen_plank: 'plank', side_plank: 'plank',
};

const CLASS: Partial<Record<Equipment, string>> = { machine: '@m', convergent: '@m', lever: '@m', isolation_machine: '@m', cable: '@c', band: '@c', bodyweight: '@b', suspension: '@b' };

/** Patrón por defecto de un ejercicio propio, según su músculo principal y si es multiarticular. */
const GUESS: Record<Muscle, [string, string]> = {
  chest: ['press_h', 'fly'], back: ['row', 'pullover'], traps: ['shrug', 'shrug'], shoulders: ['press_oh', 'raise_lat'], biceps: ['curl', 'curl'],
  triceps: ['press_close', 'tri_down'], forearms: ['carry', 'wrist_flex'], abs: ['situp', 'crunch'], obliques: ['rotation', 'sidebend'],
  lowerback: ['deadlift', 'backext'], glutes: ['hipthrust', 'kickback'], abductors: ['abduction', 'abduction'], adductors: ['adduction', 'adduction'],
  quads: ['squat', 'legext'], hamstrings: ['hinge', 'legcurl'], calves: ['calf', 'calf'], tibialis: ['tibia', 'tibia'], neck: ['neck', 'neck'],
};

function byKey(key: string): Scene | null {
  let s = SCENES[key];
  for (let i = 0; typeof s === 'string' && i < 4; i++) s = SCENES[s];
  return s && typeof s !== 'string' ? s : null;
}

export function sceneFor(ex: { id: string; primary: Muscle; type: ExType; equipment: Equipment }, pattern: string | undefined): Scene {
  const pat = pattern ?? GUESS[ex.primary][ex.type === 'compound' ? 0 : 1];
  return (BY_ID[ex.id] && byKey(BY_ID[ex.id])) || byKey(pat + (CLASS[ex.equipment] ?? '')) || byKey(pat) || byKey('squat')!;
}
