// Maniquí articulado en 2D para los iconos de ejercicio. Una postura se describe con la cadera, la inclinación
// del tronco y, para cada extremidad, un punto de apoyo (mano o pie) o un par de ángulos. Las extremidades con
// punto de apoyo se resuelven por cinemática inversa, así la mano no se despega de la barra mientras el cuerpo se mueve.
export type V = [number, number];
export type View = 'side' | 'front';

export const DIM = { T: 17, NECK: 6.3, HEAD: 3.9, UA: 8.6, FA: 8.1, TH: 12.2, SH: 11.8, FT: 4.4, SW: 7, HW: 3.6 };
export type Dims = typeof DIM;
/** Proporciones del modelo anatómico (el render 3D), a la escala en que la pierna mide lo mismo que la del pictograma. */
export const ANAT: Dims = { T: 13.27, NECK: 6.2, HEAD: 3.9, UA: 8.9, FA: 7.1, TH: 13.17, SH: 10.83, FT: 4.6, SW: 4.97, HW: 2.56 };
let D: Dims = DIM;

/** Ángulos en grados: 0 = hacia abajo, 90 = hacia delante (lado: a la derecha; frente: hacia fuera), 180 = arriba. */
export interface Pose {
  hip: V;
  /** Lado: inclinación del tronco hacia delante (0 erguido, 90 boca abajo, −90 boca arriba). Frente: inclinación lateral. */
  lean: number;
  hand?: V; arm?: V; hr?: V; hh?: V;
  hand2?: V; arm2?: V;
  foot?: V; leg?: V;
  foot2?: V; leg2?: V;
  /** Sentido de flexión de codo y rodilla (±1). */
  e?: number; e2?: number; k?: number; k2?: number;
  /** Ángulo del pie y de la mano. */
  ft?: number; ft2?: number; w?: number;
  /** Inclinación de la cabeza respecto del tronco y elevación de hombros. */
  hd?: number; lift?: number;
  /** Frente, sentado: los muslos apuntan al observador y se ven acortados. `kT` fija esa proporción (0–1). */
  sit?: boolean; kT?: number;
}

export interface Limb { a: V; b: V; c: V; d?: V }
export interface Joints { hip: V; sh: V; head: V; arms: Limb[]; legs: Limb[]; lean: number; view: View }

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
export const dir = (a: number): V => [Math.sin(rad(a)), Math.cos(rad(a))];
export const add = (p: V, q: V, k = 1): V => [p[0] + q[0] * k, p[1] + q[1] * k];
export const mix = (p: V, q: V, t: number): V => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
const angOf = (p: V, q: V) => deg(Math.atan2(q[0] - p[0], q[1] - p[1]));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Interpola ángulos por el camino corto. */
const lerpAng = (a: number, b: number, t: number) => a + ((((b - a) % 360) + 540) % 360 - 180) * t;

/** Cinemática inversa de dos segmentos. Devuelve la articulación intermedia y el extremo (recortado al alcance). */
function ik(root: V, target: V, l1: number, l2: number, bend: number): [V, V] {
  const dx = target[0] - root[0], dy = target[1] - root[1];
  const d = Math.min(l1 + l2 - 0.02, Math.max(Math.abs(l1 - l2) + 0.02, Math.hypot(dx, dy) || 0.02));
  const phi = Math.atan2(dy, dx);
  const a = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const mid: V = [root[0] + l1 * Math.cos(phi + bend * a), root[1] + l1 * Math.sin(phi + bend * a)];
  return [mid, [root[0] + d * Math.cos(phi), root[1] + d * Math.sin(phi)]];
}

type Spec = { kind: 'abs' | 'sh' | 'hip'; p: V } | { kind: 'ang'; p: V };
function armSpec(p: Pose, far: boolean): Spec {
  if (far) { if (p.hand2) return { kind: 'abs', p: p.hand2 }; if (p.arm2) return { kind: 'ang', p: p.arm2 }; }
  if (p.hand) return { kind: 'abs', p: p.hand };
  if (p.hr) return { kind: 'sh', p: p.hr };
  if (p.hh) return { kind: 'hip', p: p.hh };
  return { kind: 'ang', p: p.arm ?? [4, 8] };
}
function legSpec(p: Pose, far: boolean): Spec {
  if (far) { if (p.foot2) return { kind: 'abs', p: p.foot2 }; if (p.leg2) return { kind: 'ang', p: p.leg2 }; }
  if (p.foot) return { kind: 'abs', p: p.foot };
  return { kind: 'ang', p: p.leg ?? [0, 0] };
}

/** Resuelve una extremidad a (raíz, articulación, extremo). `s` = +1 lado derecho de la pantalla, −1 izquierdo (vista de frente). */
function limb(root: V, sp: Spec, l1: number, l2: number, bend: number, shoulder: V, hip: V, s: number, cx: number): [V, V] {
  if (sp.kind === 'ang') {
    const d1 = dir(sp.p[0]), d2 = dir(sp.p[1]);
    const mid: V = [root[0] + s * d1[0] * l1, root[1] + d1[1] * l1];
    return [mid, [mid[0] + s * d2[0] * l2, mid[1] + d2[1] * l2]];
  }
  const base = sp.kind === 'sh' ? shoulder : sp.kind === 'hip' ? hip : null;
  // En la vista de frente los puntos se dan para el lado derecho, relativos al eje del cuerpo, y se reflejan.
  const t: V = base ? [base[0] + s * sp.p[0], base[1] + sp.p[1]] : cx ? [cx + s * sp.p[0], sp.p[1]] : sp.p;
  return ik(root, t, l1, l2, bend * s);
}

function blend(a: Spec, b: Spec, t: number): Spec | null {
  if (a.kind !== b.kind) return null;
  return a.kind === 'ang' ? { kind: 'ang', p: [lerpAng(a.p[0], b.p[0], t), lerpAng(a.p[1], b.p[1], t)] } : { kind: a.kind, p: mix(a.p, b.p, t) } as Spec;
}

interface Solved { hip: V; sh: V; shs: V[]; hips: V[]; head: V; lean: number }
function trunk(view: View, hip: V, lean: number, lift: number, hd: number): Solved {
  const up: V = [Math.sin(rad(lean)), -Math.cos(rad(lean))];
  const sh = add(hip, up, D.T);
  const hu = view === 'side' ? [Math.sin(rad(lean + hd)), -Math.cos(rad(lean + hd))] as V : [Math.sin(rad(lean * 1.4 + hd)), -Math.cos(rad(lean * 1.4 + hd))] as V;
  const head = add(sh, hu, D.NECK);
  if (view === 'side') return { hip, sh, shs: [sh, sh], hips: [hip, hip], head, lean };
  const across: V = [Math.cos(rad(lean)), Math.sin(rad(lean))];
  return { hip, sh, head, lean, shs: [add(add(sh, across, D.SW), [0, -lift]), add(add(sh, across, -D.SW), [0, -lift])], hips: [add(hip, across, D.HW), add(hip, across, -D.HW)] };
}

/** Postura intermedia entre `a` y `b` (t de 0 a 1), ya resuelta a posiciones de articulaciones. */
export function solve(view: View, a: Pose, b: Pose, t: number, dims: Dims = DIM): Joints {
  D = dims;
  const hip = mix(a.hip, b.hip, t);
  const lean = lerp(a.lean, b.lean, t);
  const tr = trunk(view, hip, lean, lerp(a.lift ?? 0, b.lift ?? 0, t), lerp(a.hd ?? 0, b.hd ?? 0, t));
  const ta = trunk(view, a.hip, a.lean, a.lift ?? 0, a.hd ?? 0), tb = trunk(view, b.hip, b.lean, b.lift ?? 0, b.hd ?? 0);
  const cx = view === 'front' ? hip[0] : 0;
  const sit = view === 'front' && (a.sit || b.sit);
  const pick = (v: number | undefined, d: number) => (v == null ? d : v);

  const one = (i: number, arm: boolean): Limb => {
    const far = i === 1;
    const s = view === 'front' ? (far ? -1 : 1) : 1;
    const kT = lerp(a.kT ?? (sit ? 0.34 : 1), b.kT ?? (sit ? 0.34 : 1), t);
    const [l1, l2] = arm ? [D.UA, D.FA] : [D.TH * kT, D.SH];
    const bendOf = (p: Pose) => (arm ? pick(far ? p.e2 ?? p.e : p.e, 1) : pick(far ? p.k2 ?? p.k : p.k, view === 'front' ? 1 : -1));
    const sa = arm ? armSpec(a, far) : legSpec(a, far), sb = arm ? armSpec(b, far) : legSpec(b, far);
    const root = arm ? tr.shs[i] : tr.hips[i];
    const mixed = blend(sa, sb, t);
    let mid: V, end: V;
    if (mixed) [mid, end] = limb(root, mixed, l1, l2, t < 0.5 ? bendOf(a) : bendOf(b), tr.sh, tr.hip, s, cx);
    else {
      // Un extremo por punto de apoyo y el otro por ángulos: se interpolan los ángulos de ambas soluciones.
      const [ma, ea] = limb(arm ? ta.shs[i] : ta.hips[i], sa, l1, l2, bendOf(a), ta.sh, ta.hip, s, view === 'front' ? a.hip[0] : 0);
      const [mb, eb] = limb(arm ? tb.shs[i] : tb.hips[i], sb, l1, l2, bendOf(b), tb.sh, tb.hip, s, view === 'front' ? b.hip[0] : 0);
      const u = lerpAng(angOf(arm ? ta.shs[i] : ta.hips[i], ma), angOf(arm ? tb.shs[i] : tb.hips[i], mb), t);
      const f = lerpAng(angOf(ma, ea), angOf(mb, eb), t);
      mid = add(root, dir(u), l1); end = add(mid, dir(f), l2);
    }
    const out: Limb = { a: root, b: mid, c: end };
    if (arm) {
      const w = a.w != null || b.w != null ? lerpAng(a.w ?? angOf(mid, end), b.w ?? angOf(mid, end), t) : null;
      if (w != null) out.d = add(end, dir(w), 3.2);
    } else {
      const fa = far ? a.ft2 ?? a.ft : a.ft, fb = far ? b.ft2 ?? b.ft : b.ft;
      // Con punto de apoyo el pie va plano; con ángulos sigue a la tibia.
      const shin = angOf(mid, end);
      const defOf = (sp: Spec) => (view === 'front' ? 12 : sp.kind === 'ang' ? shin + 90 : 90);
      const f = lerpAng(pick(fa, defOf(sa)), pick(fb, defOf(sb)), t);
      const d = dir(f);
      out.d = [end[0] + s * d[0] * D.FT, end[1] + d[1] * D.FT];
    }
    return out;
  };
  return { hip, sh: tr.sh, head: tr.head, lean, view, arms: [one(0, true), one(1, true)], legs: [one(0, false), one(1, false)] };
}

/** ¿La extremidad lejana coincide con la cercana? (vista lateral: entonces no se dibuja). */
export const sameLimb = (p: Limb, q: Limb) => Math.hypot(p.b[0] - q.b[0], p.b[1] - q.b[1]) + Math.hypot(p.c[0] - q.c[0], p.c[1] - q.c[1]) < 0.6;
