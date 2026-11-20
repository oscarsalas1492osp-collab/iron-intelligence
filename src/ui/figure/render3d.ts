// Figura de ejercicio renderizada en 3D (carga diferida, comparte three.js con el mapa muscular).
//
// Toma la misma postura que el pictograma 2D (rig.ts + scenes.ts) y la levanta a tres dimensiones: un maniquí de
// arcilla con volumen, iluminado, con los músculos que trabajan encendidos y el implemento con su profundidad real
// (la barra cruza de lado a lado, el banco tiene ancho, las mancuernas van una en cada mano).
// Las miniaturas se renderizan una vez y se guardan como imagen; la ficha anima el movimiento en vivo.
import {
  ACESFilmicToneMapping, Box3, BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DirectionalLight, DoubleSide, Float32BufferAttribute, Group,
  HemisphereLight, Mesh, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Quaternion,
  Scene as Stage3, ShadowMaterial, Sphere, SphereGeometry, SRGBColorSpace, Vector3, WebGLRenderer, type Material,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Equipment, ExerciseDef, Muscle } from '../../domain/types';
import { DIM, sameLimb, solve, type Joints, type V } from './rig';
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
const CLAY = new Color('#aeb3bd'), HOT = new Color('#ff4a00'), WARM = new Color('#e58a4c');
const skin = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.03, side: DoubleSide, shadowSide: DoubleSide });
// Los músculos encendidos emiten algo de luz propia: se leen aunque queden en sombra.
skin.onBeforeCompile = (sh) => {
  sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>',
    '#include <emissivemap_fragment>\n float hot = clamp((vColor.r - vColor.b) * 1.6, 0.0, 1.0);\n totalEmissiveRadiance += vColor.rgb * hot * 0.5;');
};
const mat = (color: string, roughness: number, metalness: number, emissive = 0) => {
  const m = new MeshStandardMaterial({ color, roughness, metalness });
  if (emissive) { m.emissive = new Color(color); m.emissiveIntensity = emissive; }
  return m;
};
const M = {
  clay: mat('#aeb3bd', 0.58, 0.04), hot: mat('#ff4a00', 0.5, 0.05, 0.5), warm: mat('#e58a4c', 0.55, 0.05, 0.2),
  steel: mat('#d5d9e0', 0.24, 0.92), iron: mat('#25272c', 0.42, 0.7), pad: mat('#2b2d35', 0.78, 0.05), frame: mat('#565b66', 0.38, 0.75),
  cable: mat('#eceef2', 0.5, 0.2), band: mat('#ffb054', 0.6, 0), rope: mat('#d8c7a4', 0.9, 0),
};
const CYL = new CylinderGeometry(1, 1, 1, 20), BALL = new SphereGeometry(1, 24, 16), BOX = new BoxGeometry(1, 1, 1);
const UP = new Vector3(0, 1, 0);

type Zone = (u: number, nx: number, nz: number) => Partial<Record<Muscle, number>>;
const ZONES: Record<'upperArm' | 'forearm' | 'thigh' | 'shin' | 'torso', Zone> = {
  upperArm: (u, nx, nz) => ({ shoulders: (1 - ss(0.14, 0.36, u)) * (0.55 + 0.45 * ss(-0.6, 0.3, nz)), biceps: band(u, 0.2, 0.95) * ss(0.05, 0.5, nx), triceps: band(u, 0.2, 0.95) * ss(0.05, 0.5, -nx) }),
  forearm: (u) => ({ forearms: band(u, 0.06, 0.86) }),
  thigh: (u, nx, nz) => ({
    quads: band(u, 0.1, 0.98) * ss(0, 0.45, nx), hamstrings: band(u, 0.16, 0.96) * ss(0.05, 0.5, -nx),
    adductors: band(u, 0, 0.62) * ss(0.45, 0.85, -nz), abductors: (1 - ss(0.2, 0.36, u)) * ss(0.45, 0.85, nz), glutes: (1 - ss(0.08, 0.22, u)) * ss(0.1, 0.6, -nx),
  }),
  shin: (u, nx) => ({ calves: band(u, 0.02, 0.64) * ss(0, 0.45, -nx), tibialis: band(u, 0.08, 0.82) * ss(0.35, 0.8, nx) }),
  torso: (u, nx, nz) => ({
    chest: band(u, 0.6, 0.97) * ss(0.05, 0.5, nx), abs: band(u, 0.05, 0.56) * ss(0.1, 0.55, nx) * (1 - ss(0.5, 0.8, Math.abs(nz))),
    obliques: band(u, 0.1, 0.54) * ss(0.45, 0.8, Math.abs(nz)), back: band(u, 0.34, 0.86) * ss(0.05, 0.5, -nx), traps: ss(0.84, 0.93, u) * ss(-0.1, 0.4, -nx),
    lowerback: band(u, 0.02, 0.36) * ss(0.1, 0.5, -nx) * (1 - ss(0.55, 0.85, Math.abs(nz))), glutes: (1 - ss(-0.03, 0.08, u)) * ss(0, 0.5, -nx),
    abductors: (1 - ss(0, 0.1, u)) * ss(0.6, 0.9, Math.abs(nz)),
  }),
};

// ---------- cuerpo: superficies continuas ----------
// Cada extremidad es una sola malla barrida a lo largo de sus dos huesos, con la articulación redondeada y el
// grosor de cada músculo (deltoides, bíceps, cuádriceps, gemelo). No hay esferas ni uniones a la vista.
type Prof = [number, number][];
const along = (p: Prof, s: number) => {
  if (s <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) if (s <= p[i][0]) { const t = (s - p[i - 1][0]) / (p[i][0] - p[i - 1][0]); return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * (t * t * (3 - 2 * t)); }
  return p[p.length - 1][1];
};
/** Abultamiento: entre s0 y s1, hacia el ángulo `th` (0 frente, π atrás, π/2 fuera, −π/2 dentro). */
interface Bulge { s0: number; s1: number; th: number; amt: number; pow?: number }
const ARM: { prof: Prof; bulges: Bulge[] } = {
  prof: [[0, 2.5], [0.22, 2.42], [0.5, 2.18], [0.86, 1.82], [1, 1.76], [1.2, 1.95], [1.5, 1.72], [1.8, 1.3], [2, 1.12]],
  bulges: [{ s0: -0.1, s1: 0.34, th: Math.PI / 2, amt: 0.2 }, { s0: 0.28, s1: 0.86, th: 0, amt: 0.17, pow: 1.4 }, { s0: 0.22, s1: 0.8, th: Math.PI, amt: 0.14, pow: 1.4 }, { s0: 1.05, s1: 1.5, th: 0.9, amt: 0.1 }],
};
const LEG: { prof: Prof; bulges: Bulge[] } = {
  prof: [[0, 3.2], [0.28, 3.3], [0.62, 2.85], [0.9, 2.3], [1, 2.25], [1.12, 2.15], [1.32, 2.35], [1.62, 1.85], [1.86, 1.36], [2, 1.3]],
  bulges: [{ s0: 0.12, s1: 0.82, th: 0.2, amt: 0.13, pow: 1.3 }, { s0: 0.2, s1: 0.8, th: Math.PI, amt: 0.1, pow: 1.3 }, { s0: -0.1, s1: 0.26, th: Math.PI, amt: 0.16 }, { s0: -0.1, s1: 0.3, th: Math.PI / 2, amt: 0.06 },
    { s0: 1.06, s1: 1.6, th: Math.PI, amt: 0.3, pow: 1.5 }, { s0: 0.88, s1: 1.1, th: 0, amt: 0.1, pow: 2 }],
};
const CAP = [0.5, 0.86, 0.99];   // seno de los anillos que cierran un extremo en media esfera

class Sweep {
  geo = new BufferGeometry(); mesh: Mesh;
  private pos: Float32Array; private ring: { s: number; k: number; off: number }[] = []; private rad: Float32Array;
  constructor(def: { prof: Prof; bulges: Bulge[] }, private n: number, private seg: number, zones: (s: number) => Zone, w: Weights, material: Material) {
    for (const c of [...CAP].reverse()) this.ring.push({ s: 0, k: Math.sqrt(1 - c * c), off: -c });
    for (let i = 0; i < n; i++) this.ring.push({ s: (i / (n - 1)) * 2, k: 1, off: 0 });
    for (const c of CAP) this.ring.push({ s: 2, k: Math.sqrt(1 - c * c), off: c });
    const R = this.ring.length;
    this.pos = new Float32Array(R * seg * 3); this.rad = new Float32Array(R * seg);
    const col = new Float32Array(R * seg * 3), c = new Color(), idx: number[] = [];
    this.ring.forEach((r, i) => { for (let k = 0; k < seg; k++) {
      const th = (k / seg) * Math.PI * 2;
      let m = 1; for (const b of def.bulges) m += b.amt * band(r.s, b.s0, b.s1, 0.09) * Math.pow(Math.max(0, Math.cos(th - b.th)), b.pow ?? 1);
      this.rad[i * seg + k] = along(def.prof, r.s) * m * r.k;
      // Color: la zona muscular según la altura en el hueso y la orientación (frente, atrás, fuera, dentro).
      c.copy(CLAY);
      if (r.k === 1 || r.s === 0) { const z = zones(r.s)(r.s <= 1 ? r.s : r.s - 1, Math.cos(th), Math.sin(th));
        for (const pass of [0, 1]) for (const mk in z) { const hit = w.get(mk as Muscle); if (hit && (hit[1] === 1) === (pass === 1)) c.lerp(hit[0], Math.min(1, z[mk as Muscle]!) * (pass ? 1 : 0.85)); } }
      col.set([c.r, c.g, c.b], (i * seg + k) * 3);
    } });
    for (let i = 0; i < R - 1; i++) for (let k = 0; k < seg; k++) { const p0 = i * seg + k, p1 = i * seg + ((k + 1) % seg), q0 = p0 + seg, q1 = p1 + seg; idx.push(p0, q0, p1, p1, q0, q1); }
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3)); this.geo.setAttribute('color', new BufferAttribute(col, 3)); this.geo.setIndex(idx);
    this.mesh = new Mesh(this.geo, material); this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
  }
  /** Coloca la malla sobre los huesos a→b→c. `x1`/`x2`: frente de cada hueso; `out`: hacia fuera del cuerpo. */
  update(a: Vector3, b: Vector3, c: Vector3, x1: Vector3, x2: Vector3, out: Vector3): void {
    const F = 0.2, P0 = a.clone().lerp(b, 1 - F), P2 = b.clone().lerp(c, F);
    const d1 = b.clone().sub(a).normalize(), d2 = c.clone().sub(b).normalize();
    const cen = new Vector3(), T = new Vector3(), X = new Vector3(), Z = new Vector3(), v = new Vector3();
    this.ring.forEach((r, i) => {
      const s = r.s;
      if (s <= 1 - F) { cen.copy(a).lerp(b, s); T.copy(d1); }
      else if (s >= 1 + F) { cen.copy(b).lerp(c, s - 1); T.copy(d2); }
      else { const t = (s - (1 - F)) / (2 * F); cen.copy(P0).multiplyScalar((1 - t) * (1 - t)).addScaledVector(b, 2 * t * (1 - t)).addScaledVector(P2, t * t); T.copy(d1).lerp(d2, t).normalize(); }
      const mixX = ss(1 - F, 1 + F, s);
      X.copy(x1).lerp(x2, mixX); X.addScaledVector(T, -X.dot(T)); if (X.lengthSq() < 1e-4) X.copy(x1); X.normalize();
      Z.copy(out).addScaledVector(T, -out.dot(T)).addScaledVector(X, -out.dot(X));
      if (Z.lengthSq() < 0.02) Z.crossVectors(X, T); Z.normalize();
      const base = along(this.def.prof, s);
      cen.addScaledVector(T, r.off * base);
      for (let k = 0; k < this.seg; k++) {
        const th = (k / this.seg) * Math.PI * 2, rr = this.rad[i * this.seg + k];
        v.copy(cen).addScaledVector(X, Math.cos(th) * rr).addScaledVector(Z, Math.sin(th) * rr);
        this.pos.set([v.x, v.y, v.z], (i * this.seg + k) * 3);
      }
    });
    this.geo.getAttribute('position').needsUpdate = true; this.geo.computeVertexNormals();
  }
  private def!: { prof: Prof; bulges: Bulge[] };
  setDef(d: { prof: Prof; bulges: Bulge[] }) { this.def = d; return this; }
}

/** Tronco: de la pelvis a la base del cráneo, con pectorales, dorsales, glúteos, trapecio y cuello en una sola pieza. */
function torsoGeo(hipHalf: number, shHalf: number): BufferGeometry {
  // [altura, medio ancho, medio fondo, adelanto]
  const rings: [number, number, number, number][] = [
    [-0.2, 0.3 * hipHalf, 1.4, 0], [-0.14, 0.72 * hipHalf, 2.4, -0.1], [-0.04, 0.97 * hipHalf, 2.9, -0.15], [0.07, hipHalf, 2.95, -0.1], [0.2, 0.9 * hipHalf, 2.7, 0],
    [0.34, 0.5 * (0.8 * hipHalf + 0.66 * shHalf), 2.4, 0.1], [0.48, 0.76 * shHalf, 2.65, 0.2], [0.62, 0.9 * shHalf, 3.1, 0.3], [0.76, 0.99 * shHalf, 3.45, 0.42], [0.88, 1.02 * shHalf, 3.3, 0.3],
    [0.96, 0.95 * shHalf, 2.8, 0.1], [1.02, 0.7 * shHalf, 2.3, -0.1], [1.07, 0.4 * shHalf, 1.95, -0.2], [1.12, 2.1, 2.0, -0.1], [1.2, 1.95, 1.9, 0], [1.3, 1.95, 1.9, 0.1],
  ];
  const N = 28, pos: number[] = [], meta: number[] = [], idx: number[] = [], pw = 2 / 2.5;
  for (const [u, zh, xh, xo] of rings) for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
    // Pectorales (dos lóbulos al frente), dorsal ancho a los lados de la espalda y glúteos.
    const pec = 0.55 * band(u, 0.66, 0.9, 0.05) * Math.pow(Math.max(0, Math.cos(Math.abs(a > Math.PI ? a - 2 * Math.PI : a) - 0.55)), 3);
    const lat = 0.5 * band(u, 0.46, 0.84, 0.08) * Math.pow(Math.max(0, Math.cos(Math.abs(a - Math.PI) - 0.95)), 3);
    const glu = 0.62 * band(u, -0.16, 0.1, 0.06) * Math.pow(Math.max(0, Math.cos(Math.abs(a - Math.PI) - 0.5)), 3);
    const m = 1 + (pec + lat + glu) / Math.max(xh, 1);
    pos.push(xo + xh * Math.sign(cs) * Math.pow(Math.abs(cs), pw) * m, u * DIM.T, zh * Math.sign(sn) * Math.pow(Math.abs(sn), pw) * (1 + lat / Math.max(zh, 1)));
    meta.push(u, cs, sn);
  }
  for (let r = 0; r < rings.length - 1; r++) for (let k = 0; k < N; k++) { const a = r * N + k, b = r * N + ((k + 1) % N), c = a + N, d = b + N; idx.push(a, c, b, b, c, d); }
  const bottom = pos.length / 3; pos.push(0, rings[0][0] * DIM.T - 0.5, 0); meta.push(rings[0][0], 0, 0);
  for (let k = 0; k < N; k++) idx.push(bottom, k, (k + 1) % N);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  g.userData.meta = meta;
  return g;
}

/** Cabeza: cráneo ancho arriba, mandíbula más estrecha y adelantada, para que se lea hacia dónde mira. */
const HEAD = (() => {
  const g = new SphereGeometry(1, 28, 20), p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < 0) { const k = 1 - 0.3 * Math.pow(-y, 1.4); x = x * k + 0.14 * -y; z *= k - 0.06 * -y; }
    if (x > 0) x *= 0.93;
    p.setXYZ(i, x * 1.02, y * 1.12, z * 0.88);
  }
  g.computeVertexNormals();
  return g;
})();
/** Pie: talón en el tobillo y punta hacia delante, con la planta plana. */
const FOOT = (() => {
  const g = new SphereGeometry(1, 20, 14), p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x, Math.max(-0.62, y * (x > 0 ? 1 - 0.45 * x : 1)), z * (1 + 0.12 * x)); }
  g.computeVertexNormals();
  return g;
})();

type Weights = Map<Muscle, [Color, number]>;
/** Pinta el tronco según sus zonas musculares. */
function paint(g: BufferGeometry, zone: Zone, w: Weights): void {
  const p = g.getAttribute('position'), meta = g.userData.meta as number[];
  const col = new Float32Array(p.count * 3), c = new Color();
  for (let i = 0; i < p.count; i++) {
    c.copy(CLAY);
    const z = zone(meta[i * 3], meta[i * 3 + 1], meta[i * 3 + 2]);
    for (const pass of [0, 1]) for (const m in z) { const hit = w.get(m as Muscle); if (hit && (hit[1] === 1) === (pass === 1)) c.lerp(hit[0], Math.min(1, z[m as Muscle]!) * (pass ? 1 : 0.85)); }
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(col, 3));
}

// ---------- postura en 3D ----------
interface Limb3 { a: Vector3; b: Vector3; c: Vector3; d?: Vector3 }
interface Pose3 { hip: Vector3; sh: Vector3; head: Vector3; arms: Limb3[]; legs: Limb3[]; right: Vector3; fwd: Vector3; side: boolean; j: Joints; w: (p: V, z?: number) => Vector3 }
const ZS = 6.5, ZH = 3.5;

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
    const grip = d3.grip ?? ZS + 0.2, flare = d3.flare ?? 0.9, stance = d3.stance ?? ZH + 0.9, knee = d3.knee ?? 0.6;
    for (const i of [0, 1]) {
      const s = i ? -1 : 1, a = sameA ? j.arms[0] : j.arms[i], l = sameL ? j.legs[0] : j.legs[i];
      const S = w(a.a, s * ZS), [E, H] = ik3(S, w(a.c, s * grip), DIM.UA, DIM.FA, w(a.b, s * (ZS + flare + Math.max(0, grip - ZS) * 0.35)));
      arms.push({ a: S, b: E, c: H });
      const Hp = w(l.a, s * ZH), [K, A] = ik3(Hp, w(l.c, s * stance), DIM.TH, DIM.SH, w(l.b, s * (stance + knee)));
      const toe = l.d ?? l.c;
      legs.push({ a: Hp, b: K, c: A, d: w(toe, s * (stance + 0.9)).add(A).sub(w(l.c, s * stance)) });
    }
  } else {
    for (const i of [0, 1]) {
      const a = j.arms[i], l = j.legs[i], s = i ? -1 : 1;
      // De frente, lo que le falta de largo a un hueso es profundidad: los codos y las manos quedan algo por delante.
      const dzA = Math.sqrt(Math.max(0, DIM.UA * DIM.UA - ((a.b[0] - a.a[0]) ** 2 + (a.b[1] - a.a[1]) ** 2)));
      arms.push({ a: w(a.a), b: w(a.b, 0.6 + dzA), c: w(a.c, 1.4 + dzA * 0.5) });
      const dz = Math.sqrt(Math.max(0, DIM.TH * DIM.TH - ((l.b[0] - l.a[0]) ** 2 + (l.b[1] - l.a[1]) ** 2)));
      const c = w(l.c, dz + 0.2);
      legs.push({ a: w(l.a), b: w(l.b, dz), c, d: new Vector3(c.x + s * 0.9, c.y - 0.2, c.z + DIM.FT) });
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

class Body {
  group = new Group();
  private torso: Mesh; private head: Mesh; private limbs: Sweep[] = []; private hands: Mesh[] = []; private feet: Mesh[] = []; private tg: BufferGeometry;

  constructor(ex: FigureEx, side: boolean) {
    const w: Weights = new Map();
    for (const m of ex.secondary) w.set(m, [WARM, 0.5]);
    w.set(ex.primary, [HOT, 1]);
    const mk = (geo: BufferGeometry, material: Material = skin) => { const m = new Mesh(geo, material); m.matrixAutoUpdate = false; m.castShadow = true; m.receiveShadow = true; this.group.add(m); return m; };
    this.tg = torsoGeo((side ? ZH : DIM.HW) + 1.15, (side ? ZS : DIM.SW) + 0.1); paint(this.tg, (u, nx, nz) => (u > 1.1 ? { neck: 1, traps: (1 - ss(1.1, 1.2, u)) * ss(-0.1, 0.4, -nx) } : ZONES.torso(u, nx, nz)), w);
    this.torso = mk(this.tg);
    this.head = mk(HEAD, M.clay);
    for (const arm of [true, true, false, false]) {
      const def = arm ? ARM : LEG;
      const sw = new Sweep(def, 30, 18, (s) => (arm ? (s <= 1 ? ZONES.upperArm : ZONES.forearm) : s <= 1 ? ZONES.thigh : ZONES.shin), w, skin).setDef(def);
      this.limbs.push(sw); this.group.add(sw.mesh);
      if (arm) this.hands.push(mk(BALL, M.clay)); else this.feet.push(mk(FOOT, M.clay));
    }
  }

  pose(p: Pose3): void {
    const y = p.sh.clone().sub(p.hip).normalize();
    const x = new Vector3().crossVectors(y, p.right).normalize(), z = new Vector3().crossVectors(x, y);
    this.torso.matrix.makeBasis(x, y, z).setPosition(p.hip);
    // La cabeza sigue la inclinación que da la postura respecto del tronco.
    const hy = p.head.clone().sub(p.sh).normalize(), hx = new Vector3().crossVectors(hy, z).normalize(), hz = new Vector3().crossVectors(hx, hy);
    this.head.matrix.makeBasis(hx, hy, hz).scale(new Vector3(DIM.HEAD * 0.98, DIM.HEAD * 0.98, DIM.HEAD * 0.98)).setPosition(p.head.clone().addScaledVector(hy, 0.5));
    p.arms.forEach((l, i) => {
      const s = (i === 0) === p.side ? 1 : -1;                   // +1: lado derecho del cuerpo
      const out = p.right.clone().multiplyScalar(s).addScaledVector(y, 0.7);
      const ax = l.b.clone().sub(l.a).normalize();
      const fr = frontOf(ax, l.c.clone().sub(l.b), 1, x, p.fwd);
      this.limbs[i].update(l.a, l.b, l.c, fr, fr, out);
      const f = l.c.clone().sub(l.b).normalize(), hxv = perp(fr, f).lengthSq() > 0.01 ? perp(fr, f).normalize() : perp(x, f).normalize(), hzv = new Vector3().crossVectors(hxv, f);
      this.hands[i].matrix.makeBasis(hxv, f, hzv).scale(new Vector3(1.05, 1.75, 1.45)).setPosition(l.c.clone().addScaledVector(f, 1.15));
    });
    p.legs.forEach((l, i) => {
      const s = (i === 0) === p.side ? 1 : -1;
      const out = p.right.clone().multiplyScalar(s);
      const ax = l.b.clone().sub(l.a).normalize(), bx = l.c.clone().sub(l.b).normalize();
      const f1 = frontOf(ax, l.c.clone().sub(l.b), -1, p.side ? x.clone().lerp(p.fwd, 0.5) : p.fwd, x), f2 = frontOf(bx, l.a.clone().sub(l.b), -1, p.fwd, x);
      this.limbs[2 + i].update(l.a, l.b, l.c, f1, f2, out);
      // El pie apunta del talón a la punta; su "arriba" es la tibia.
      const fx = l.d!.clone().sub(l.c); const len = Math.max(2.6, fx.length()); fx.normalize();
      const up = perp(bx.clone().negate(), fx); if (up.lengthSq() < 0.01) up.copy(perp(UP, fx)); up.normalize();
      this.feet[i].matrix.makeBasis(fx, up, new Vector3().crossVectors(fx, up)).scale(new Vector3(len * 0.72 + 0.9, 1.7, 1.55)).setPosition(l.c.clone().addScaledVector(fx, len * 0.42).addScaledVector(up, -0.25));
    });
  }
  dispose() { this.tg.dispose(); for (const l of this.limbs) l.geo.dispose(); }
}

// ---------- implementos ----------
class Gear {
  group = new Group();
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
      this.disc(c.clone().addScaledVector(a, s * (half - 3.6)), 4.7, 1.5, a, M.iron); this.disc(c.clone().addScaledVector(a, s * (half - 1.9)), 3.7, 1.2, a, M.iron);
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
      const a = add2(add2(j.hip, u, -1.5), n, -5.6), b = add2(add2(j.sh, u, DIM.NECK * 0.9), n, -5.6);
      this.slab(w, a, b, 2.8, 10.5, 0, M.pad);
      const feet = Math.abs(u[0]) > 0.55 ? [mix2(a, b, 0.12), mix2(a, b, 0.85)] : [a];
      for (const f of feet) for (const z of [-3.8, 3.8]) this.tube(w(f, z), w([f[0], FLOOR], z), 0.75, M.frame);
    }
    if (side && sc.seat) {
      const y = j.hip[1] + 4.8;
      this.slab(w, [j.hip[0] - 4, y], [j.hip[0] + 9, y], 2.8, 10.5, 0, M.pad);
      this.tube(w([j.hip[0] + 2.5, y]), w([j.hip[0] + 2.5, FLOOR]), 1.2, M.frame);
    }
    for (const pr of sc.props ?? []) this.prop(pr, p);
    if (eq === 'cable' && sc.anchor) {
      const xs = side || sc.anchor[0] === 0 ? [(side ? 0 : cx) + sc.anchor[0]] : [cx + sc.anchor[0], cx - sc.anchor[0]];
      for (const x of xs) { const z = side ? 0 : -2.5; this.tube(w([x, 4], z), w([x, FLOOR], z), 1.15, M.frame); this.disc(w([x, sc.anchor[1]], z), 2.1, 1, across, M.steel); }
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
      if (PLATES.includes(eq) || eq === 'lever') this.plates(c, across, 17);
      else if (eq === 'dumbbell') this.dumbbell(c, across);
      else if (eq === 'kettlebell' || eq === 'plate') this.disc(c, 3.6, 1.4, side ? new Vector3(0, 1, 0) : Z, M.iron);
      else this.tube(c.clone().addScaledVector(across, -8), c.clone().addScaledVector(across, 8), 1.4, M.pad);
      return;
    }
    // ---- En las manos ----
    const anchorOf = (h: Vector3): Vector3 | null => {
      if (!sc.anchor) return null;
      if (side) return w(sc.anchor);
      if (sc.anchor[0] === 0) return w([cx, sc.anchor[1]], -2.5);
      return w([cx + (h.x >= cx ? 1 : -1) * sc.anchor[0], sc.anchor[1]], -2.5);
    };
    if (sc.bar && !side) this.tube(hands[1].clone().add(new Vector3(-3.6, 0, 0)), hands[0].clone().add(new Vector3(3.6, 0, 0)), 0.55, M.steel);
    if (PLATES.includes(eq)) {
      if (side) this.plates(new Vector3(mid.x, mid.y, 0), Z, 17.5);
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
  renderer.setPixelRatio(1); renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap; renderer.setClearColor(0x000000, 0);
  const scene = new Stage3();
  const pm = new PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.3; pm.dispose();
  scene.add(new HemisphereLight(0xcfdcff, 0x24160e, 0.42));
  const key = new DirectionalLight(0xfff1e2, 1.75); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0008; key.shadow.normalBias = 0.5; key.shadow.radius = 5;
  const rim = new DirectionalLight(0xff9a52, 2.2);
  scene.add(key, key.target, rim, rim.target);
  const floor = new Mesh(new PlaneGeometry(400, 400), new ShadowMaterial({ opacity: 0.42 })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.95; floor.receiveShadow = true; scene.add(floor);
  rig = { renderer, scene, camera: new PerspectiveCamera(22, 1, 1, 2000), key, rim, floor, size: 0 };
  return rig;
}

/** Una figura lista para dibujarse en cualquier punto del movimiento. */
export class Figure3D {
  private body: Body; private gear = new Gear(); private root = new Group();
  private center = new Vector3(); private radius = 40;
  constructor(private ex: FigureEx, private sc: Scene, both: boolean) {
    this.body = new Body(ex, sc.view === 'side');
    this.root.add(this.body.group, this.gear.group);
    // Encuadre fijo: lo que ocupa la figura en la postura final (y en la inicial si se va a animar).
    const box = new Box3();
    for (const t of both ? [0, 1] : [1]) { this.set(t); this.root.updateMatrixWorld(true); const body = new Box3().setFromObject(this.body.group); box.union(body).union(this.gearBox(body)); }
    const s = box.getBoundingSphere(new Sphere()); this.center.copy(s.center); this.radius = s.radius;
  }
  /** Los implementos amplían el encuadre, pero con tope: una torre de placas lejana no debe encoger la figura. */
  private gearBox(body: Box3): Box3 {
    const g = new Box3().setFromObject(this.gear.group);
    if (g.isEmpty()) return body;
    const lim = body.clone().expandByScalar(9);
    g.min.max(lim.min); g.max.min(lim.max);
    return g;
  }
  private set(t: number) { const p = lift(this.sc, solve(this.sc.view, this.sc.a, this.sc.b, t)); this.body.pose(p); this.gear.build(this.sc, p, this.ex.equipment); }

  /** Dibuja el instante `t` (0 inicio, 1 final) y devuelve el lienzo WebGL, del tamaño pedido. */
  draw(t: number, px: number): HTMLCanvasElement {
    const r = stage();
    if (r.size !== px) { r.renderer.setSize(px, px, false); r.size = px; }
    this.set(t);
    // Si el músculo principal está en la cara posterior, la cámara rodea la figura para mostrarlo.
    const side = this.sc.view === 'side', back = BACK.includes(this.ex.primary);
    const az = side ? (back ? -0.66 : 0.56) : (back ? Math.PI + 0.34 : -0.34), el = side ? 0.2 : 0.15;
    const dir = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const dist = (this.radius * 0.88) / Math.sin((r.camera.fov * Math.PI) / 360);
    r.camera.position.copy(this.center).addScaledVector(dir, dist); r.camera.lookAt(this.center); r.camera.near = Math.max(1, dist - this.radius * 3); r.camera.far = dist + this.radius * 3; r.camera.updateProjectionMatrix();
    const left = new Vector3().crossVectors(UP, dir).normalize();
    r.key.position.copy(this.center).addScaledVector(dir, 60).addScaledVector(left, 46).addScaledVector(UP, 95); r.key.target.position.copy(this.center);
    const sc = r.key.shadow.camera; sc.left = sc.bottom = -this.radius * 1.5; sc.right = sc.top = this.radius * 1.5; sc.near = 10; sc.far = 400; sc.updateProjectionMatrix();
    r.rim.position.copy(this.center).addScaledVector(dir, -70).addScaledVector(left, -50).addScaledVector(UP, 40); r.rim.target.position.copy(this.center);
    r.floor.visible = this.sc.floor !== false;
    r.scene.add(this.root); r.renderer.render(r.scene, r.camera); r.scene.remove(this.root);
    return r.renderer.domElement;
  }
  dispose() { this.body.dispose(); }
}

/** Miniatura: la postura característica, como imagen con fondo transparente. */
export function renderThumb(ex: FigureEx, sc: Scene, px = 192): string {
  const f = new Figure3D(ex, sc, false);
  try { const c = f.draw(1, px); return c.toDataURL('image/webp', 0.92); } finally { f.dispose(); }
}
