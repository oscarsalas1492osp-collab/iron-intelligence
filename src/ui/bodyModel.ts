// Carga del modelo anatómico y sus dos variantes de figura. El archivo trae una sola anatomía (Z-Anatomy, masculina);
// aquí se engrosa cada grupo muscular para darle relieve y se deforma toda la malla hacia las proporciones de cada figura.
// La femenina es una adaptación de proporciones sobre la misma anatomía, no un segundo modelo escaneado.
import { BufferAttribute, BufferGeometry, Group, Mesh, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export type Figure = 'male' | 'female';

const MODEL_URL = `${import.meta.env.BASE_URL}models/musculos.glb`;
let source: Promise<Object3D> | null = null;
const variants = new Map<Figure, Promise<Object3D>>();

function loadSource(): Promise<Object3D> {
  if (!source) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    source = loader.loadAsync(MODEL_URL).then((g) => g.scene).catch((e) => { source = null; throw e; });
  }
  return source;
}

/** Cuánto se engrosa cada grupo a lo largo de su normal, en metros (el modelo mide 1,71 m). */
export const RELIEF: Record<string, number> = {
  chest: 0.01, shoulders: 0.01, back: 0.0085, traps: 0.007, biceps: 0.0085, triceps: 0.0085, forearms: 0.004,
  abs: 0.0045, obliques: 0.003, lowerback: 0.004, glutes: 0.008, abductors: 0.005, adductors: 0.005,
  quads: 0.0095, hamstrings: 0.008, calves: 0.008, tibialis: 0.004, neck: 0.003,
};
/** En la figura femenina el relieve del tren superior es menor; el de glúteos y piernas se mantiene casi igual. */
const FEMALE_RELIEF: Record<string, number> = { chest: 0.35, shoulders: 0.55, back: 0.55, traps: 0.3, biceps: 0.55, triceps: 0.55, forearms: 0.5, neck: 0.3, abs: 0.8, obliques: 0.7 };

type Curve = [number, number][];
/** Interpolación suave de una curva (altura → valor), con las alturas en orden descendente. */
function at(c: Curve, y: number): number {
  if (y >= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    if (y >= c[i][0]) { const t = (y - c[i][0]) / (c[i - 1][0] - c[i][0]); const s = t * t * (3 - 2 * t); return c[i][1] + (c[i - 1][1] - c[i][1]) * s; }
  }
  return c[c.length - 1][1];
}
// Alturas en metros desde el suelo: 1,40 hombros · 1,08 cintura · 0,90 cadera · 0,80 entrepierna · 0,45 rodilla.
interface Shape { width: Curve; depth: Curve; legShift: Curve; legThick: Curve; arm: number; bust: number }
/** Femenina: hombros y tórax más estrechos, cintura marcada, cadera ancha, cuello y brazos finos, busto. */
const FEMALE: Shape = {
  width: [[1.7, 0.96], [1.52, 0.93], [1.45, 0.82], [1.38, 0.82], [1.25, 0.84], [1.08, 0.76], [0.98, 0.99], [0.9, 1.13], [0.8, 1.11]],
  depth: [[1.7, 0.97], [1.5, 0.92], [1.44, 0.88], [1.3, 0.9], [1.08, 0.84], [0.93, 1.1], [0.8, 1.08], [0.45, 0.95], [0.25, 0.92], [0, 1]],
  legShift: [[0.8, 1.11], [0.45, 1.04], [0, 1.01]],
  legThick: [[0.8, 1.11], [0.66, 1.07], [0.45, 0.95], [0.3, 0.91], [0.05, 0.94]],
  arm: 0.82, bust: 0.03,
};
/** Masculina: algo más de espalda, tórax, brazos y piernas sobre la anatomía original, con la cintura intacta. */
const MALE: Shape = {
  width: [[1.7, 1], [1.52, 1.02], [1.45, 1.06], [1.38, 1.07], [1.25, 1.06], [1.08, 1], [0.8, 1]],
  depth: [[1.7, 1], [1.5, 1.02], [1.44, 1.05], [1.3, 1.07], [1.08, 1], [0.93, 1.03], [0.8, 1.03], [0.45, 1], [0.3, 1.05], [0, 1]],
  legShift: [[0.8, 1], [0, 1]],
  legThick: [[0.8, 1.04], [0.66, 1.07], [0.45, 1], [0.3, 1.06], [0.05, 1]],
  arm: 1.12, bust: 0,
};
const SHAPE: Record<Figure, Shape> = { male: MALE, female: FEMALE };
const CROTCH = 0.8, LEG_X = 0.085, Z0 = -0.01;
const ARM_A = new Vector3(0.185, 1.39, -0.03), ARM_B = new Vector3(0.31, 0.76, 0.02);
const BUST = { x: 0.082, y: 1.262, r: 0.062 };
const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

const ab = new Vector3(), ap = new Vector3(), onAxis = new Vector3(), body = new Vector3(), arm = new Vector3();
/** Lleva un punto del modelo (en metros) a las proporciones de la figura. */
export function reshape(p: Vector3, figure: Figure): Vector3 {
  const sh = SHAPE[figure];
  const sign = p.x < 0 ? -1 : 1; const ax = Math.abs(p.x);
  // Tronco y piernas: ancho y fondo según la altura.
  let z = Z0 + (p.z - Z0) * at(sh.depth, p.y);
  if (sh.bust && p.z > 0.02) {
    const d = Math.hypot(ax - BUST.x, (p.y - BUST.y) * 1.15) / BUST.r;
    if (d < 1) z += sh.bust * (1 - d * d) ** 2 * smooth(0.02, 0.07, p.z);
  }
  const x = p.y >= CROTCH ? ax * at(sh.width, p.y) : LEG_X * at(sh.legShift, p.y) + (ax - LEG_X) * at(sh.legThick, p.y);
  body.set(sign * x, p.y, z);
  // Brazos: acompañan al hombro y cambian de grosor alrededor de su eje.
  ab.subVectors(ARM_B, ARM_A); ap.set(ax, p.y, p.z).sub(ARM_A);
  const t = Math.min(1.3, Math.max(0, ap.dot(ab) / ab.lengthSq()));
  onAxis.copy(ARM_A).addScaledVector(ab, t);
  const dist = Math.hypot(ax - onAxis.x, p.y - onAxis.y, p.z - onAxis.z);
  const w = (1 - smooth(0.07, 0.115, dist)) * smooth(-0.02, 0.12, t);
  if (w > 0) {
    const shift = ARM_A.x * (at(sh.width, ARM_A.y) - 1);
    // Las manos conservan casi su tamaño: el grosor se aplica sobre todo al brazo y al antebrazo.
    const k = 1 + (sh.arm - 1) * (1 - smooth(0.85, 1.1, t) * 0.6);
    arm.set(onAxis.x + (ax - onAxis.x) * k + shift, p.y, onAxis.z + (p.z - onAxis.z) * k);
    arm.x *= sign;
    body.lerp(arm, w);
  }
  return p.copy(body);
}

function build(src: Object3D, figure: Figure): Object3D {
  src.updateMatrixWorld(true);
  const out = new Group();
  const v = new Vector3(), n = new Vector3();
  src.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const name = o.name || o.parent?.name || '';
    const g = o.geometry as BufferGeometry;
    const pos = g.getAttribute('position');
    const P = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; }
    const geo = new BufferGeometry();
    const attr = new BufferAttribute(P, 3);
    geo.setAttribute('position', attr);
    if (g.index) geo.setIndex(g.index);
    // Las normales se recalculan desde los triángulos (el archivo ya trae todos enrollados hacia fuera: tools/modelo/orientar.mjs).
    geo.computeVertexNormals();
    const N = geo.getAttribute('normal');
    const relief = (RELIEF[name] ?? 0) * (figure === 'female' ? FEMALE_RELIEF[name] ?? 0.9 : 1);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(attr, i);
      if (relief) v.addScaledVector(n.fromBufferAttribute(N, i), relief);
      reshape(v, figure);
      attr.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const mesh = new Mesh(geo);
    mesh.name = name;
    out.add(mesh);
  });
  return out;
}

/** El modelo se descarga una vez; cada variante se construye una sola vez y las vistas comparten su geometría. */
export function loadFigure(figure: Figure): Promise<Object3D> {
  let p = variants.get(figure);
  if (!p) { p = loadSource().then((src) => build(src, figure)); p.catch(() => variants.delete(figure)); variants.set(figure, p); }
  return p;
}

/**
 * Piel continua sobre la misma anatomía: una sola malla, construida sobre el modelo sin deformar (tools/modelo/piel),
 * con sus pesos de hueso, el mapa de músculos y la sombra propia por vértice. Cada figura la lleva a sus proporciones
 * con la misma deformación que usan los músculos.
 */
export interface SkinSource { geometry: BufferGeometry; groups: string[] }
let skinSource: Promise<SkinSource> | null = null;
const skins = new Map<Figure, Promise<SkinSource>>();
function loadSkinSource(): Promise<SkinSource> {
  if (!skinSource) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    skinSource = loader.loadAsync(`${import.meta.env.BASE_URL}models/piel.glb`).then((g) => {
      let found: Mesh | null = null;
      g.scene.traverse((o) => { if (o instanceof Mesh && !found) found = o; });
      if (!found) throw new Error('La piel no trae malla');
      const mesh = found as Mesh;
      mesh.updateMatrixWorld(true);
      // Posiciones en metros en un arreglo propio: el archivo las trae cuantizadas, con la escala en el nodo.
      const geometry = (mesh.geometry as BufferGeometry).clone(), pos = geometry.getAttribute('position'), v = new Vector3();
      const P = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; }
      geometry.setAttribute('position', new BufferAttribute(P, 3));
      return { geometry, groups: (mesh.userData.grupos as string[]) ?? [] };
    }).catch((e) => { skinSource = null; throw e; });
  }
  return skinSource;
}
export function loadSkin(figure: Figure): Promise<SkinSource> {
  let p = skins.get(figure);
  if (!p) {
    p = loadSkinSource().then((src) => {
      const geometry = src.geometry.clone(), pos = geometry.getAttribute('position'), v = new Vector3();
      const P = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { reshape(v.fromBufferAttribute(pos, i), figure); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; }
      geometry.setAttribute('position', new BufferAttribute(P, 3));
      return { geometry, groups: src.groups };
    });
    p.catch(() => skins.delete(figure));
    skins.set(figure, p);
  }
  return p;
}
