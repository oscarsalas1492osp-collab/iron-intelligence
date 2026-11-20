// Figura de ejercicio renderizada en 3D (carga diferida, comparte three.js con el mapa muscular).
//
// Toma la misma postura que el pictograma 2D (rig.ts + scenes.ts) y la levanta a tres dimensiones: un maniquí de
// arcilla con volumen, iluminado, con los músculos que trabajan encendidos y el implemento con su profundidad real
// (la barra cruza de lado a lado, el banco tiene ancho, las mancuernas van una en cada mano).
// Las miniaturas se renderizan una vez y se guardan como imagen; la ficha anima el movimiento en vivo.
import {
  ACESFilmicToneMapping, Bone, Box3, BoxGeometry, BufferGeometry, Color, CylinderGeometry, DirectionalLight, Float32BufferAttribute, Group, Matrix4,
  HemisphereLight, Mesh, Skeleton, SkinnedMesh, Uint16BufferAttribute, type Object3D, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Quaternion,
  Scene as Stage3, ShadowMaterial, Sphere, SphereGeometry, SRGBColorSpace, Vector3, WebGLRenderer, type Material,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Equipment, ExerciseDef, Muscle } from '../../domain/types';
import { ANAT, DIM, sameLimb, solve, type Joints, type Pose, type V } from './rig';
import { loadFigure, type Figure } from '../bodyModel';
import type { Prop, Scene } from './scenes';

export type FigureEx = Pick<ExerciseDef, 'id' | 'primary' | 'secondary' | 'type' | 'equipment'>;
const FLOOR = 67.4;
const PLATES: Equipment[] = ['barbell', 'smith', 'ez_bar', 'trap_bar'];
const MACH: Equipment[] = ['machine', 'convergent', 'lever', 'isolation_machine'];
const BACK: Muscle[] = ['back', 'traps', 'lowerback', 'glutes', 'hamstrings', 'calves', 'triceps'];

// ---------- utilidades 2D (mismas reglas que el pictograma) ----------
const add2 = (p: V, q: V, k = 1): V => [p[0] + q[0] * k, p[1] + q[1] * k];
const mix2 = (p: V, q: V, t: number): V => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
const unit2 = (p: V, q: V): V => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [(q[0] - p[0]) / d, (q[1] - p[1]) / d]; };
const front2 = (p: V, q: V, trunk = false): V => { const u = unit2(p, q); return trunk ? [-u[1], u[0]] : [u[1], -u[0]]; };
const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const band = (u: number, a: number, b: number, s = 0.07) => ss(a - s, a + s, u) * (1 - ss(b - s, b + s, u));

// ---------- materiales y geometrías compartidas ----------
// Todo es arcilla clara, como una maqueta anatómica; solo los músculos que trabajan llevan color y luz propia.
const mat = (color: string, roughness: number, metalness: number, emissive = 0) => {
  const m = new MeshStandardMaterial({ color, roughness, metalness });
  if (emissive) { m.emissive = new Color(color); m.emissiveIntensity = emissive; }
  return m;
};
const M = {
  clay: mat('#d3d5da', 0.66, 0.02), bone: mat('#c2c3c6', 0.7, 0.02), hot: mat('#ff2e12', 0.5, 0.02, 0.62), warm: mat('#ff8f5a', 0.55, 0.02, 0.2),
  steel: mat('#e4e6ea', 0.38, 0.25), iron: mat('#c9ccd2', 0.55, 0.1), pad: mat('#b4b7be', 0.75, 0.02), frame: mat('#d5d7dc', 0.5, 0.15),
  cable: mat('#f1f2f4', 0.5, 0.1), band: mat('#ffb054', 0.6, 0), rope: mat('#e0d3b6', 0.9, 0),
};
const CYL = new CylinderGeometry(1, 1, 1, 20), BALL = new SphereGeometry(1, 24, 16), BOX = new BoxGeometry(1, 1, 1);
const UP = new Vector3(0, 1, 0);

// ---------- postura en 3D ----------
interface Limb3 { a: Vector3; b: Vector3; c: Vector3; d?: Vector3 }
interface Pose3 { hip: Vector3; sh: Vector3; head: Vector3; arms: Limb3[]; legs: Limb3[]; right: Vector3; fwd: Vector3; side: boolean; j: Joints; w: (p: V, z?: number) => Vector3 }
const ZS = ANAT.SW, ZH = ANAT.HW, K3 = ANAT.SW / 6.5;   // K3: las pistas de profundidad se escribieron para hombros de 6,5

/** Articulación intermedia en 3D: conserva el largo de los huesos y se abre hacia donde apunta `pole`. */
function ik3(S: Vector3, H: Vector3, l1: number, l2: number, pole: Vector3): [Vector3, Vector3] {
  const dir = H.clone().sub(S); let d = dir.length() || 0.01; dir.divideScalar(d);
  d = Math.min(l1 + l2 - 0.02, Math.max(Math.abs(l1 - l2) + 0.02, d));
  const end = S.clone().addScaledVector(dir, d);
  const al = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - al * al));
  const side = pole.clone().sub(S); side.addScaledVector(dir, -side.dot(dir));
  if (side.lengthSq() < 1e-4) side.set(0, 0, 1).addScaledVector(dir, -dir.z);
  return [S.clone().addScaledVector(dir, al).addScaledVector(side.normalize(), h), end];
}

function lift(sc: Scene, j: Joints): Pose3 {
  const side = j.view === 'side', d3 = sc.d3 ?? {};
  const w = (p: V, z = 0) => new Vector3(p[0], sc.flip ? p[1] - 5.4 : FLOOR - p[1], z);
  const arms: Limb3[] = [], legs: Limb3[] = [];
  if (side) {
    // De lado, la postura 2D da el plano del movimiento; el agarre, la apertura de codos y la separación de pies
    // le dan la profundidad que tiene el ejercicio real.
    const sameA = sameLimb(j.arms[0], j.arms[1]), sameL = sameLimb(j.legs[0], j.legs[1]);
    const grip = d3.grip != null ? d3.grip * K3 : ZS + 0.3, flare = (d3.flare ?? 0.9) * K3, stance = d3.stance != null ? d3.stance * K3 : ZH + 0.5, knee = (d3.knee ?? 0.5) * K3;
    for (const i of [0, 1]) {
      const s = i ? -1 : 1, a = sameA ? j.arms[0] : j.arms[i], l = sameL ? j.legs[0] : j.legs[i];
      const S = w(a.a, s * ZS), [E, H] = ik3(S, w(a.c, s * grip), ANAT.UA, ANAT.FA, w(a.b, s * (ZS + flare + Math.max(0, grip - ZS) * 0.35)));
      arms.push({ a: S, b: E, c: H });
      const Hp = w(l.a, s * ZH), [K, A] = ik3(Hp, w(l.c, s * stance), ANAT.TH, ANAT.SH, w(l.b, s * (stance + knee)));
      const toe = l.d ?? l.c;
      legs.push({ a: Hp, b: K, c: A, d: w(toe, s * (stance + 0.9)).add(A).sub(w(l.c, s * stance)) });
    }
  } else {
    for (const i of [0, 1]) {
      const a = j.arms[i], l = j.legs[i], s = i ? -1 : 1;
      // De frente, lo que le falta de largo a un hueso es profundidad: los codos y las manos quedan algo por delante.
      const dzA = Math.sqrt(Math.max(0, ANAT.UA * ANAT.UA - ((a.b[0] - a.a[0]) ** 2 + (a.b[1] - a.a[1]) ** 2)));
      arms.push({ a: w(a.a), b: w(a.b, 0.6 + dzA), c: w(a.c, 1.4 + dzA * 0.5) });
      const dz = Math.sqrt(Math.max(0, ANAT.TH * ANAT.TH - ((l.b[0] - l.a[0]) ** 2 + (l.b[1] - l.a[1]) ** 2)));
      const c = w(l.c, dz + 0.2);
      legs.push({ a: w(l.a), b: w(l.b, dz), c, d: new Vector3(c.x + s * 0.9, c.y - 0.2, c.z + ANAT.FT) });
    }
  }
  const right = side ? new Vector3(0, 0, 1) : arms[1].a.clone().sub(arms[0].a).normalize();
  return { hip: w(j.hip), sh: w(j.sh), head: w(j.head), arms, legs, right, fwd: side ? new Vector3(1, 0, 0) : new Vector3(0, 0, 1), side, j, w };
}

const perp = (v: Vector3, axis: Vector3) => v.clone().addScaledVector(axis, -v.dot(axis));
/** Dirección "de frente" de un hueso: hacia donde no se pliega la articulación; si va recto, el frente del cuerpo. */
function frontOf(axis: Vector3, fold: Vector3 | null, sign: number, fallback: Vector3, last: Vector3): Vector3 {
  if (fold) { const p = perp(fold, axis); if (p.length() > 0.3 * fold.length()) return p.normalize().multiplyScalar(sign); }
  const f = perp(fallback, axis);
  if (f.length() > 0.25) return f.normalize();
  return perp(last, axis).normalize();
}

// ---------- cuerpo: el modelo anatómico, articulado ----------
// El mismo modelo del mapa muscular (músculos reales, uno por uno) se dobla por sus articulaciones: cada vértice sigue
// a uno o dos huesos según dónde está. El músculo principal y los secundarios cambian de material.
const S_M = 28.4;                         // unidades de escena por metro del modelo
type P3 = [number, number, number];
// Articulaciones del modelo en reposo (metros; lado +x). El modelo mira hacia +z con los brazos algo separados.
const REST = {
  hip: [0, 0.925, -0.012] as P3, sh: [0, 1.392, -0.03] as P3, head: [0, 1.61, -0.012] as P3,
  S: [0.178, 1.392, -0.03] as P3, E: [0.238, 1.085, -0.035] as P3, W: [0.29, 0.845, 0.012] as P3, F: [0.305, 0.72, 0.06] as P3,
  H: [0.09, 0.925, -0.012] as P3, K: [0.072, 0.462, -0.004] as P3, A: [0.066, 0.082, -0.035] as P3, T: [0.085, 0.02, 0.11] as P3,
};
const v3 = (p: P3, sg = 1) => new Vector3(p[0] * sg, p[1], p[2]);
/** Base ortonormal de un hueso: Y a lo largo, X hacia el frente, Z = X × Y. */
function frame(o: Vector3, y: Vector3, xHint: Vector3, sx = 1, sy = 1): Matrix4 {
  const Y = y.clone().normalize(), X = xHint.clone().addScaledVector(Y, -xHint.dot(Y));
  if (X.lengthSq() < 1e-5) X.set(1, 0, 0).addScaledVector(Y, -Y.x);
  X.normalize(); const Z = new Vector3().crossVectors(X, Y);
  return new Matrix4().makeBasis(X.multiplyScalar(sx), Y.multiplyScalar(sy), Z.multiplyScalar(sx)).setPosition(o);
}
// Huesos: 0 tronco, 1 cabeza; por lado (0: +x del modelo, 1: −x): brazo, antebrazo, mano, muslo, pierna, pie.
const B = { torso: 0, head: 1, arm: 2, fore: 3, hand: 4, thigh: 5, shin: 6, foot: 7, per: 6 };
const seg = (p: Vector3, a: Vector3, b: Vector3): [number, number] => {
  const ab = b.clone().sub(a), t = p.clone().sub(a).dot(ab) / ab.lengthSq(), c = a.clone().addScaledVector(ab, Math.min(1, Math.max(0, t)));
  return [t, p.distanceTo(c)];
};
const R = { S: v3(REST.S), E: v3(REST.E), W: v3(REST.W), F: v3(REST.F), H: v3(REST.H), K: v3(REST.K), A: v3(REST.A) };
const ARMG = new Set(['biceps', 'triceps', 'forearms']), LEGG = new Set(['quads', 'hamstrings', 'adductors', 'calves', 'tibialis']);

/** A qué huesos sigue un vértice del modelo y cuánto. */
function weightsOf(group: string, x: number, y: number, z: number, out: number[]): void {
  const sd = x >= 0 ? 0 : 1, ax = Math.abs(x), p = new Vector3(ax, y, z), o = sd * B.per;
  const w = new Map<number, number>(); let torso = 1;
  const [tu, du] = seg(p, R.S, R.E), [tf, df] = seg(p, R.E, R.W), [, dh] = seg(p, R.W, R.F.clone().lerp(R.W, -0.4));
  const body = group === 'bone' || group === 'base';
  // Brazo: cuánto sigue al brazo en vez de al tronco, y dentro del brazo, a qué hueso.
  let wa = 0;
  if (ARMG.has(group)) wa = group === 'forearms' ? 1 : ss(-0.12, 0.12, tu);
  else if (group === 'shoulders') wa = ss(-0.22, 0.3, tu);
  else if (group === 'chest') wa = 0.75 * ss(0.11, 0.19, ax) * ss(1.24, 1.32, y);
  else if (group === 'back') wa = 0.6 * ss(0.12, 0.2, ax) * ss(1.2, 1.34, y);
  else if (body && Math.min(du, df, dh) < (y > 1.2 ? 0.064 : 0.078) && ax > (y > 1.3 ? 0.15 : y > 0.95 ? 0.185 : 0.215)) wa = ss(-0.04, 0.14, tu);
  const [tt] = seg(p, R.H, R.K), [ts] = seg(p, R.K, R.A);
  let wl = 0;
  if (wa === 0) {
    if (LEGG.has(group)) wl = group === 'calves' || group === 'tibialis' ? 1 : ss(-0.12, 0.16, tt);
    else if (group === 'glutes') wl = 0.7 * ss(-0.2, 0.3, tt);
    else if (group === 'abductors') wl = 0.5 * ss(-0.15, 0.2, tt);
    else if (body && y < 0.95) wl = ss(-0.06, 0.1, tt);
    if (wl > 0 && y > 0.76) wl *= ss(0.012, 0.055, ax);        // la línea media de la pelvis no se va con ninguna pierna
  }
  if (wa > 0) {
    const fore = ss(0.9, 1.1, tu), hand = ss(0.93, 1.07, tf) * fore;
    w.set(B.arm + o, wa * (1 - fore)); w.set(B.fore + o, wa * (fore - hand)); w.set(B.hand + o, wa * hand); torso -= wa;
  } else if (wl > 0) {
    const shin = ss(0.9, 1.1, tt), foot = ss(0.9, 1.03, ts) * shin;
    w.set(B.thigh + o, wl * (1 - shin)); w.set(B.shin + o, wl * (shin - foot)); w.set(B.foot + o, wl * foot); torso -= wl;
  } else {
    const k = group === 'neck' ? 0.9 * ss(1.47, 1.56, y) : group === 'traps' ? 0.5 * ss(1.5, 1.58, y) : group === 'lowerback' ? 0.7 * ss(1.5, 1.58, y) : body && ax < 0.13 ? ss(1.46, 1.54, y) : 0;
    w.set(B.head, k); torso -= k;
  }
  w.set(B.torso, Math.max(0, torso));
  const top = [...w.entries()].filter(([, k]) => k > 1e-4).sort((p1, p2) => p2[1] - p1[1]).slice(0, 4), sum = top.reduce((acc, [, k]) => acc + k, 0) || 1;
  for (let i = 0; i < 4; i++) { out[i] = top[i]?.[0] ?? 0; out[4 + i] = top[i] ? top[i][1] / sum : 0; }
}

class Anatomy {
  group = new Group();
  private bones: Bone[] = []; private meshes: SkinnedMesh[] = [];
  private constructor(model: Object3D) {
    const sides = [1, -1], rest: Matrix4[] = [], front = new Vector3(0, 0, 1), up = new Vector3(0, 1, 0);
    rest[B.torso] = frame(v3(REST.hip), v3(REST.sh).sub(v3(REST.hip)), front);
    rest[B.head] = frame(v3(REST.sh), v3(REST.head).sub(v3(REST.sh)), front);
    sides.forEach((sg, i) => { const o = i * B.per;
      rest[B.arm + o] = frame(v3(REST.S, sg), v3(REST.E, sg).sub(v3(REST.S, sg)), front); rest[B.fore + o] = frame(v3(REST.E, sg), v3(REST.W, sg).sub(v3(REST.E, sg)), front);
      rest[B.hand + o] = frame(v3(REST.W, sg), v3(REST.F, sg).sub(v3(REST.W, sg)), front);
      rest[B.thigh + o] = frame(v3(REST.H, sg), v3(REST.K, sg).sub(v3(REST.H, sg)), front); rest[B.shin + o] = frame(v3(REST.K, sg), v3(REST.A, sg).sub(v3(REST.K, sg)), front);
      rest[B.foot + o] = frame(v3(REST.A, sg), v3(REST.T, sg).sub(v3(REST.A, sg)), up);
    });
    for (let i = 0; i < rest.length; i++) { const b = new Bone(); b.matrixAutoUpdate = false; this.bones.push(b); }
    const skeleton = new Skeleton(this.bones, rest.map((m) => m.clone().invert()));
    const tmp: number[] = [];
    model.traverse((src) => {
      if (!(src instanceof Mesh)) return;
      const g = (src.geometry as BufferGeometry).clone(), pos = g.getAttribute('position');
      const si = new Uint16Array(pos.count * 4), sw = new Float32Array(pos.count * 4);
      for (let i = 0; i < pos.count; i++) { weightsOf(src.name, pos.getX(i), pos.getY(i), pos.getZ(i), tmp); for (let k = 0; k < 4; k++) { si[i * 4 + k] = tmp[k]; sw[i * 4 + k] = tmp[4 + k]; } }
      g.setAttribute('skinIndex', new Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new Float32BufferAttribute(sw, 4));
      const m = new SkinnedMesh(g, M.clay); m.name = src.name; m.bind(skeleton, new Matrix4()); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false;
      this.meshes.push(m); this.group.add(m);
    });
  }
  private static cache = new Map<Figure, Promise<Anatomy>>();
  private static ready = new Map<Figure, Anatomy>();
  static load(figure: Figure): Promise<Anatomy> {
    let p = Anatomy.cache.get(figure);
    if (!p) { p = loadFigure(figure).then((m) => { const a = new Anatomy(m); Anatomy.ready.set(figure, a); return a; }); p.catch(() => Anatomy.cache.delete(figure)); Anatomy.cache.set(figure, p); }
    return p;
  }
  static get(figure: Figure): Anatomy { const a = Anatomy.ready.get(figure); if (!a) throw new Error('El modelo anatómico no está cargado'); return a; }

  /** Enciende el músculo principal y los secundarios del ejercicio. */
  roles(ex: FigureEx): void {
    for (const m of this.meshes) m.material = m.name === ex.primary ? M.hot : ex.secondary.includes(m.name as Muscle) ? M.warm : m.name === 'bone' ? M.bone : M.clay;
  }
  private set(i: number, o: Vector3, to: Vector3 | null, dirv: Vector3, xHint: Vector3, restLen: number, thick = 1.13) {
    const len = to ? to.distanceTo(o) : restLen * S_M;
    // Algo más de grosor alrededor de cada hueso: una figura atlética, no un atlas de anatomía.
    this.bones[i].matrixWorld.copy(frame(o, dirv, xHint, S_M * thick, S_M * (len / (restLen * S_M))));
  }
  pose(p: Pose3): void {
    const y = p.sh.clone().sub(p.hip).normalize(), x = new Vector3().crossVectors(y, p.right).normalize();
    const L = (a: P3, b: P3) => v3(a).distanceTo(v3(b));
    this.set(B.torso, p.hip, p.sh, y, x, L(REST.hip, REST.sh), 1.07);
    this.set(B.head, p.sh, p.head, p.head.clone().sub(p.sh), x, L(REST.sh, REST.head), 1.02);
    p.arms.forEach((l, i) => {
      const o = ((i === 0) === p.side ? 1 : 0) * B.per;             // derecha del cuerpo = lado −x del modelo
      const ax = l.b.clone().sub(l.a), f = l.c.clone().sub(l.b);
      const fr = frontOf(ax.clone().normalize(), f, 1, x, p.fwd);
      this.set(B.arm + o, l.a, l.b, ax, fr, L(REST.S, REST.E)); this.set(B.fore + o, l.b, l.c, f, fr, L(REST.E, REST.W)); this.set(B.hand + o, l.c, null, f, fr, L(REST.W, REST.F));
    });
    p.legs.forEach((l, i) => {
      const o = ((i === 0) === p.side ? 1 : 0) * B.per;
      const ax = l.b.clone().sub(l.a), bx = l.c.clone().sub(l.b);
      const f1 = frontOf(ax.clone().normalize(), bx, -1, p.side ? x.clone().lerp(p.fwd, 0.5) : p.fwd, x), f2 = frontOf(bx.clone().normalize(), l.a.clone().sub(l.b), -1, p.fwd, x);
      this.set(B.thigh + o, l.a, l.b, ax, f1, L(REST.H, REST.K)); this.set(B.shin + o, l.b, l.c, bx, f2, L(REST.K, REST.A));
      const fx = l.d!.clone().sub(l.c); if (fx.lengthSq() < 0.01) fx.copy(p.fwd);
      // El pie en reposo baja del tobillo a la punta: se conserva esa caída respecto de la planta.
      const upv = perp(bx.clone().negate(), fx.clone().normalize()); if (upv.lengthSq() < 0.01) upv.copy(UP);
      const drop = fx.clone().normalize().addScaledVector(upv.normalize(), -0.42);
      this.set(B.foot + o, l.c, null, drop, upv, L(REST.A, REST.T));
    });
  }
}

// ---------- implementos ----------
class Gear {
  group = new Group();
  /** Profundidad de lo que va detrás de la figura en vista de frente: siempre del lado contrario a la cámara. */
  farZ = -2.5;
  private add(geo: BufferGeometry, m: Material) { const x = new Mesh(geo, m); x.castShadow = true; x.receiveShadow = true; this.group.add(x); return x; }
  tube(a: Vector3, b: Vector3, r: number, m: Material) {
    const d = b.clone().sub(a), len = d.length(); if (len < 0.01) return;
    const x = this.add(CYL, m); x.position.copy(a).add(b).multiplyScalar(0.5); x.quaternion.setFromUnitVectors(UP, d.divideScalar(len)); x.scale.set(r, len, r);
  }
  ball(c: Vector3, r: number, m: Material) { const x = this.add(BALL, m); x.position.copy(c); x.scale.setScalar(r); }
  /** Disco con su eje en la dirección dada (placas, poleas, rodillos). */
  disc(c: Vector3, r: number, th: number, axis: Vector3, m: Material) { const x = this.add(CYL, m); x.position.copy(c); x.quaternion.setFromUnitVectors(UP, axis.clone().normalize()); x.scale.set(r, th, r); }
  /** Tabla entre dos puntos del plano de la figura, con grosor y con fondo hacia los lados. */
  slab(w: Pose3['w'], p: V, q: V, th: number, depth: number, z: number, m: Material) {
    const a = w(p, z), b = w(q, z), d = b.clone().sub(a), x = this.add(BOX, m);
    x.position.copy(a).add(b).multiplyScalar(0.5); x.rotation.z = Math.atan2(d.y, d.x); x.scale.set(d.length() + th * 0.4, th, depth);
  }
  plates(c: Vector3, axis: Vector3, half: number) {
    const a = axis.clone().normalize();
    this.tube(c.clone().addScaledVector(a, -half), c.clone().addScaledVector(a, half), 0.55, M.steel);
    for (const s of [-1, 1]) {
      this.disc(c.clone().addScaledVector(a, s * (half - 3.4)), 4.3, 1.5, a, M.iron); this.disc(c.clone().addScaledVector(a, s * (half - 1.8)), 3.3, 1.2, a, M.iron);
      this.disc(c.clone().addScaledVector(a, s * (half - 3.6)), 1.5, 1.7, a, M.steel);
    }
  }
  dumbbell(c: Vector3, axis: Vector3) {
    const a = axis.clone().normalize();
    this.tube(c.clone().addScaledVector(a, -2.6), c.clone().addScaledVector(a, 2.6), 0.5, M.steel);
    for (const s of [-1, 1]) this.disc(c.clone().addScaledVector(a, s * 2.7), 2.15, 1.7, a, M.iron);
  }

  build(sc: Scene, p: Pose3, eq: Equipment): void {
    this.group.clear();
    const { j, w, side } = p, Z = new Vector3(0, 0, 1), X = new Vector3(1, 0, 0);
    const across = side ? Z : X;                       // eje que cruza el cuerpo de lado a lado
    const hands = p.arms.map((l) => l.c), mid = hands[0].clone().add(hands[1]).multiplyScalar(0.5);
    const cx = j.hip[0];

    // ---- Mobiliario ----
    if (side && sc.bench) {
      const n = front2(j.hip, j.sh, true), u = unit2(j.hip, j.sh);
      const a = add2(add2(j.hip, u, -2.5), n, -4.7), b = add2(add2(j.sh, u, ANAT.NECK * 1.15), n, -4.7);
      this.slab(w, a, b, 2.8, 10.5, 0, M.pad);
      const feet = Math.abs(u[0]) > 0.55 ? [mix2(a, b, 0.12), mix2(a, b, 0.85)] : [a];
      for (const f of feet) for (const z of [-3.8, 3.8]) this.tube(w(f, z), w([f[0], FLOOR], z), 0.75, M.frame);
    }
    if (side && sc.seat) {
      const y = j.hip[1] + 4.6;
      this.slab(w, [j.hip[0] - 4, y], [j.hip[0] + 9, y], 2.8, 10.5, 0, M.pad);
      this.tube(w([j.hip[0] + 2.5, y]), w([j.hip[0] + 2.5, FLOOR]), 1.2, M.frame);
    }
    for (const pr of sc.props ?? []) this.prop(pr, p);
    if (eq === 'cable' && sc.anchor) {
      const xs = side || sc.anchor[0] === 0 ? [(side ? 0 : cx) + sc.anchor[0]] : [cx + sc.anchor[0], cx - sc.anchor[0]];
      for (const x of xs) { const z = side ? 0 : this.farZ; this.tube(w([x, 4], z), w([x, FLOOR], z), 1.15, M.frame); this.disc(w([x, sc.anchor[1]], z), 2.1, 1, across, M.steel); }
    }
    if (eq === 'smith' && side) for (const z of [-15, 15]) this.tube(w([j.arms[0].c[0], 3], z), w([j.arms[0].c[0], FLOOR], z), 0.6, M.frame);
    if (MACH.includes(eq) && side) {
      const s = sc.stack ?? [3.4, 36];
      if (sc.pivot) {
        this.tube(w(sc.pivot, -ZS - 1.5), w(sc.pivot, ZS + 1.5), 0.9, M.frame);
        p.arms.forEach((l, i) => this.tube(w(sc.pivot!, (i ? -1 : 1) * (ZS + 0.6)), l.c, 0.7, M.frame));
      }
      if (eq === 'lever') { this.tube(w([s[0] + 3.3, s[1] + 12]), w([s[0] + 3.3, FLOOR]), 1.1, M.frame); this.disc(w([s[0] + 3.3, s[1] + 14]), 4.5, 1.5, Z, M.iron); this.disc(w([s[0] + 3.3, s[1] + 14]), 1.3, 1.8, Z, M.steel); }
      else { const b = this.add(BOX, M.frame); b.position.copy(w([s[0] + 3.3, s[1] + 12])); b.scale.set(6.6, 24, 7.5);
        for (const t of [0.25, 0.5, 0.75]) { const l = this.add(BOX, M.iron); l.position.copy(w([s[0] + 3.3, s[1] + 24 * t])); l.scale.set(6.9, 0.45, 7.8); } }
    }

    // ---- Carga ----
    const load = sc.load ?? 'hand';
    if (load === 'none') return;
    if (load === 'wheel') { const c = w(j.arms[0].c); this.disc(c, 3.7, 1.6, Z, M.iron); this.tube(c.clone().addScaledVector(Z, -ZS - 1), c.clone().addScaledVector(Z, ZS + 1), 0.5, M.steel); return; }
    if (load === 'rope') { hands.forEach((h, i) => { const k = side ? h.z : 0, a: V = [h.x, FLOOR - h.y]; const m1 = add2(a, [10, 4 + i * 2]), m2: V = [a[0] + 19, FLOOR - 2 - i];
      this.tube(h, w(m1, k), 0.5, M.rope); this.tube(w(m1, k), w(m2, k), 0.5, M.rope); this.ball(w(m1, k), 0.5, M.rope); }); return; }
    if (load === 'ankle') {
      const l = j.legs[0], n = front2(l.b, l.c), mach = MACH.includes(eq), at = add2(mix2(l.b, l.c, 0.9), n, mach ? 3 : 0);
      if (mach) { for (const z of [-ZH - 2.2, ZH + 2.2]) this.tube(w(l.b, z), w(at, z), 0.6, M.frame); this.tube(w(at, -ZH - 2.4), w(at, ZH + 2.4), 1.9, M.pad); }
      else this.ball(w(at, ZH + 0.9), 1.6, M.iron);
      if (eq === 'cable' && sc.anchor) this.tube(w(at, ZH + 0.9), w(sc.anchor), 0.3, M.cable);
      return;
    }
    if (load === 'feet') {
      const l = j.legs[0], u = unit2(l.c, l.d!), push = unit2(j.hip, l.c), c = add2(mix2(l.c, l.d!, 0.5), push, 2.8);
      this.slab(w, add2(c, u, -6.5), add2(c, u, 6.5), 1.8, 19, 0, M.frame);
      for (const z of [-11, 11]) { this.disc(w(add2(add2(c, u, 5), push, 4.4), z), 3.7, 1.4, Z, M.iron); this.disc(w(add2(add2(c, u, 5), push, 4.4), z), 1.1, 1.7, Z, M.steel); }
      return;
    }
    if (load === 'knee') {
      const out = (sc.b.kT ?? 0) > (sc.a.kT ?? 0) ? 1 : -1;
      p.legs.forEach((l, i) => { const x = this.add(BOX, M.pad); x.position.set(l.b.x + (i ? -1 : 1) * out * 3.6, l.b.y + 0.2, l.b.z - 1); x.scale.set(1.7, 5.6, 4.4); });
      return;
    }
    if (load === 'hip') {
      if (eq === 'bodyweight' || eq === 'band') return;
      const c = w(add2(j.hip, front2(j.hip, j.sh, true), 5.6));
      if (PLATES.includes(eq) || eq === 'lever') this.plates(c, across, 15.5);
      else if (eq === 'dumbbell') this.dumbbell(c, across);
      else if (eq === 'kettlebell' || eq === 'plate') this.disc(c, 3.6, 1.4, side ? new Vector3(0, 1, 0) : Z, M.iron);
      else this.tube(c.clone().addScaledVector(across, -8), c.clone().addScaledVector(across, 8), 1.4, M.pad);
      return;
    }
    // ---- En las manos ----
    const anchorOf = (h: Vector3): Vector3 | null => {
      if (!sc.anchor) return null;
      if (side) return w(sc.anchor);
      if (sc.anchor[0] === 0) return w([cx, sc.anchor[1]], this.farZ);
      return w([cx + (h.x >= cx ? 1 : -1) * sc.anchor[0], sc.anchor[1]], this.farZ);
    };
    if (sc.bar && !side) this.tube(hands[1].clone().add(new Vector3(-3.6, 0, 0)), hands[0].clone().add(new Vector3(3.6, 0, 0)), 0.55, M.steel);
    if (PLATES.includes(eq)) {
      if (side) this.plates(new Vector3(mid.x, mid.y, 0), Z, 15.5);
      else if (!sc.bar) this.plates(new Vector3(mid.x, mid.y, mid.z), X, Math.abs(hands[0].x - hands[1].x) / 2 + 9.5);
    } else if (eq === 'dumbbell') {
      for (const h of hands) this.dumbbell(h, across);
    } else if (eq === 'kettlebell') {
      for (const h of hands) { this.ball(h.clone().add(new Vector3(0, -3.9, 0)), 2.9, M.iron); this.tube(h.clone().add(new Vector3(0, -1.6, 0)), h, 0.45, M.iron); }
    } else if (eq === 'plate' || eq === 'medball') {
      const close = hands[0].distanceTo(hands[1]) < (side ? 2 * ZS + 4 : 9);
      for (const c of close ? [mid] : hands) { if (eq === 'plate') { this.disc(c, 4.1, 1.3, side ? X : Z, M.iron); this.disc(c, 1, 1.5, side ? X : Z, M.steel); } else this.ball(c, 4.2, M.iron); }
    } else if (eq === 'cable' || eq === 'band') {
      for (const h of sc.bar && !side ? [mid] : hands) {
        const a = anchorOf(h) ?? (eq === 'band' ? new Vector3(h.x, 0.6, h.z) : null);
        if (a) this.tube(a, h, eq === 'band' ? 0.42 : 0.3, eq === 'band' ? M.band : M.cable);
      }
    } else if (eq === 'landmine') {
      const base = w([64, FLOOR - 1]), dir = mid.clone().sub(base).normalize();
      this.tube(base, mid, 0.6, M.steel); this.disc(base.clone().lerp(mid, 0.84), 3.6, 1.4, dir, M.iron); this.ball(base, 1.7, M.frame);
    } else if (eq === 'suspension') {
      for (const h of hands) this.tube(sc.anchor && side ? w(sc.anchor) : new Vector3(side ? h.x : cx + (h.x >= cx ? 5 : -5), FLOOR - 3, side ? 0 : -1), h, 0.32, M.band);
    } else if (MACH.includes(eq)) {
      if (sc.seat || sc.bench || sc.bar) for (const h of hands) this.tube(h.clone().addScaledVector(across, -1.9), h.clone().addScaledVector(across, 1.9), 0.55, M.steel);
      if (sc.bar && !side && sc.anchor) this.tube(w([cx, sc.anchor[1]], 0.5), mid, 0.3, M.cable);
    }
  }

  private prop(pr: Prop, p: Pose3): void {
    const { w, side } = p, Z = new Vector3(0, 0, 1);
    if (pr[0] === 'c') { if (side) this.disc(w([pr[1], pr[2]]), pr[3], 10.5, Z, M.pad); else this.ball(w([pr[1], pr[2]]), pr[3], M.pad); return; }
    if (pr[0] === 'r') { const b = this.add(BOX, M.pad); b.position.copy(w([pr[1] + pr[3] / 2, pr[2] + pr[4] / 2])); b.scale.set(pr[3], pr[4], side ? 11 : 6); return; }
    const a: V = [pr[1], pr[2]], b: V = [pr[3], pr[4]], th = pr[5] ?? 2, flat = Math.abs(a[1] - b[1]) < 0.01, upright = Math.abs(a[0] - b[0]) < 0.01;
    if (!side) { if (th >= 2.9) this.slab(w, a, b, th, 5.5, 2, M.pad); else this.tube(w(a), w(b), th * 0.42, M.steel); return; }
    if (upright) this.tube(w(a), w(b), th * 0.45, M.frame);
    else if (flat && a[1] < 22) this.tube(w(mix2(a, b, 0.5), -13), w(mix2(a, b, 0.5), 13), th * 0.4, M.steel);      // barra alta: cruza de lado a lado
    else if (flat && th < 2.4) for (const z of [-ZS - 0.4, ZS + 0.4]) this.tube(w(a, z), w(b, z), th * 0.42, M.steel); // barras paralelas
    else this.slab(w, a, b, th, 10.5, 0, M.pad);
  }
}

// ---------- escenario ----------
let rig: { renderer: WebGLRenderer; scene: Stage3; camera: PerspectiveCamera; key: DirectionalLight; rim: DirectionalLight; floor: Mesh; size: number } | null = null;
function stage() {
  if (rig) return rig;
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1); renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 0.86;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap; renderer.setClearColor(0x000000, 0);
  const scene = new Stage3();
  const pm = new PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.16; pm.dispose();
  scene.add(new HemisphereLight(0xd6e0ff, 0x1c120c, 0.3));
  const key = new DirectionalLight(0xfff4ea, 2.5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0008; key.shadow.normalBias = 0.5; key.shadow.radius = 5;
  const rim = new DirectionalLight(0xffb27a, 1.6);
  scene.add(key, key.target, rim, rim.target);
  const floor = new Mesh(new PlaneGeometry(400, 400), new ShadowMaterial({ opacity: 0.42 })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.25; floor.receiveShadow = true; scene.add(floor);
  rig = { renderer, scene, camera: new PerspectiveCamera(22, 1, 1, 2000), key, rim, floor, size: 0 };
  return rig;
}

/** Carga el modelo anatómico de la figura. Hay que esperarlo antes de crear o dibujar figuras. */
export const prepare = (figure: Figure): Promise<unknown> => Anatomy.load(figure);

/** Una figura lista para dibujarse en cualquier punto del movimiento. */
export class Figure3D {
  private gear = new Gear(); private body: Anatomy;
  private center = new Vector3(); private radius = 40;
  private a: Pose; private b: Pose;
  constructor(private ex: FigureEx, private sc: Scene, both: boolean, figure: Figure = 'male') {
    this.body = Anatomy.get(figure);
    // El tronco anatómico es más corto que el del pictograma. Colgado de una barra se conserva la altura de los
    // hombros; apoyado en el suelo o en un asiento, la de la cadera.
    const hang = sc.floor === false, k = DIM.T - ANAT.T;
    const fix = (p: Pose): Pose => (hang ? { ...p, hip: [p.hip[0] + Math.sin((p.lean * Math.PI) / 180) * k, p.hip[1] - Math.cos((p.lean * Math.PI) / 180) * k] } : p);
    this.a = fix(sc.a); this.b = fix(sc.b);
    // Encuadre fijo: lo que ocupa la figura en la postura final (y en la inicial si se va a animar).
    const box = new Box3();
    for (const t of both ? [0, 1] : [1]) {
      const p = this.set(t), body = new Box3();
      for (const q of [p.hip, p.sh, p.head, ...p.arms.flatMap((l) => [l.a, l.b, l.c]), ...p.legs.flatMap((l) => [l.a, l.b, l.c, l.d!])]) body.expandByPoint(q);
      body.expandByPoint(p.head.clone().addScaledVector(p.head.clone().sub(p.sh).normalize(), 3.4)); body.expandByScalar(3.2);
      this.gear.group.updateMatrixWorld(true);
      const g = new Box3().setFromObject(this.gear.group);
      // Los implementos amplían el encuadre, pero con tope: una torre de placas lejana no debe encoger la figura.
      if (!g.isEmpty()) { const lim = body.clone().expandByScalar(8); g.min.max(lim.min); g.max.min(lim.max); body.union(g); }
      box.union(body);
    }
    const s = box.getBoundingSphere(new Sphere()); this.center.copy(s.center); this.radius = s.radius;
  }
  private set(t: number): Pose3 { this.gear.farZ = BACK.includes(this.ex.primary) ? 3.2 : -2.8; const p = lift(this.sc, solve(this.sc.view, this.a, this.b, t, ANAT)); this.body.roles(this.ex); this.body.pose(p); this.gear.build(this.sc, p, this.ex.equipment); return p; }

  /** Dibuja el instante `t` (0 inicio, 1 final) y devuelve el lienzo WebGL, del tamaño pedido. */
  draw(t: number, px: number): HTMLCanvasElement {
    const r = stage();
    if (r.size !== px) { r.renderer.setSize(px, px, false); r.size = px; }
    this.set(t);
    // Si el músculo principal está en la cara posterior, la cámara rodea la figura para mostrarlo.
    const side = this.sc.view === 'side', back = BACK.includes(this.ex.primary);
    const az = side ? (back ? -0.66 : 0.56) : (back ? Math.PI + 0.34 : -0.34), el = side ? 0.22 : 0.16;
    const dir = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const dist = (this.radius * 0.9) / Math.sin((r.camera.fov * Math.PI) / 360);
    r.camera.position.copy(this.center).addScaledVector(dir, dist); r.camera.lookAt(this.center); r.camera.near = Math.max(1, dist - this.radius * 3); r.camera.far = dist + this.radius * 3; r.camera.updateProjectionMatrix();
    const left = new Vector3().crossVectors(UP, dir).normalize();
    r.key.position.copy(this.center).addScaledVector(dir, 60).addScaledVector(left, 46).addScaledVector(UP, 95); r.key.target.position.copy(this.center);
    const sc = r.key.shadow.camera; sc.left = sc.bottom = -this.radius * 1.5; sc.right = sc.top = this.radius * 1.5; sc.near = 10; sc.far = 400; sc.updateProjectionMatrix();
    r.rim.position.copy(this.center).addScaledVector(dir, -70).addScaledVector(left, -50).addScaledVector(UP, 40); r.rim.target.position.copy(this.center);
    r.floor.visible = this.sc.floor !== false;
    r.scene.add(this.body.group, this.gear.group); r.renderer.render(r.scene, r.camera); r.scene.remove(this.body.group, this.gear.group);
    return r.renderer.domElement;
  }
  dispose() { /* la geometría del cuerpo es compartida */ }
}

/** Miniatura: la postura característica, como imagen con fondo transparente. */
export function renderThumb(ex: FigureEx, sc: Scene, px = 192, figure: Figure = 'male'): string {
  return new Figure3D(ex, sc, false, figure).draw(1, px).toDataURL('image/webp', 0.92);
}
