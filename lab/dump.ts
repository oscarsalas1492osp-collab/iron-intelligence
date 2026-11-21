// Vuelca el modelo anatómico sin deformar (con el relieve de cada músculo) y los pesos de hueso de cada vértice,
// para construir la piel con tools/modelo/piel.
import { BufferAttribute, BufferGeometry, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RELIEF } from '../src/ui/bodyModel';
import { weightsOf } from '../src/ui/figure/render3d';
const b64 = (a: ArrayBufferView) => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s); };
(window as any).dump = async () => {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const scene = (await loader.loadAsync('/models/musculos.glb')).scene, out: any[] = [], tmp: number[] = [], v = new Vector3(), nv = new Vector3();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const name = o.name || o.parent?.name || '', src = o.geometry as BufferGeometry, sp = src.getAttribute('position');
    // Las posiciones del archivo vienen cuantizadas: se pasan a metros en un arreglo propio antes de calcular normales.
    const M = new Float32Array(sp.count * 3);
    for (let i = 0; i < sp.count; i++) { v.fromBufferAttribute(sp, i).applyMatrix4(o.matrixWorld); M[i * 3] = v.x; M[i * 3 + 1] = v.y; M[i * 3 + 2] = v.z; }
    const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(M, 3)); g.setIndex(src.index); g.computeVertexNormals();
    const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), n = pos.count, relief = RELIEF[name] ?? 0;
    const P = new Float32Array(n * 3), W = new Float32Array(n * 14);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i).addScaledVector(nv.fromBufferAttribute(nor, i), relief);
      P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
      weightsOf(name, v.x, v.y, v.z, tmp);
      for (let k = 0; k < 4; k++) W[i * 14 + tmp[k]] += tmp[4 + k];
    }
    out.push({ name, n, P: b64(P), W: b64(W), I: b64(new Uint32Array(g.index!.array)) });
  });
  return out;
};
(window as any).ready = true;
