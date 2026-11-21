// Corrige el sentido de los triángulos de musculos.glb.
// La mitad del modelo con x positiva es un reflejo de la otra y venía con los triángulos enrollados al revés: sus
// normales apuntaban hacia dentro y el relieve que aplica la app hundía esos músculos en vez de engrosarlos.
// Se separa cada malla en parches de orientación coherente (triángulos vecinos que recorren su arista común en
// sentidos opuestos) y se le da la vuelta a los parches que quedan del lado x positivo, aunque rocen la línea media
// (trapecio, romboides). Las piezas propias de la línea media (columna, esternón, cráneo) se reparten a ambos lados
// del eje y no se tocan. No cambia ningún vértice. El archivo queda marcado para no corregirlo dos veces.
//   node tools/modelo/orientar.mjs public/models/musculos.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const file = process.argv[2];
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(file);
if (doc.getRoot().getExtras().orientado) { console.log('El archivo ya está corregido; no se toca.'); process.exit(0); }
const report = {};
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const M = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION'), idx = prim.getIndices(), n = pos.getCount(), I = idx.getArray(), T = I.length / 3;
    const X = new Float64Array(n), el = [];
    for (let i = 0; i < n; i++) { pos.getElement(i, el); X[i] = M[0] * el[0] + M[4] * el[1] + M[8] * el[2] + M[12]; }
    const parent = new Int32Array(T); for (let t = 0; t < T; t++) parent[t] = t;
    const find = (t) => { while (parent[t] !== t) { parent[t] = parent[parent[t]]; t = parent[t]; } return t; };
    const edge = new Map();
    for (let t = 0; t < T; t++) for (let k = 0; k < 3; k++) edge.set(I[t * 3 + k] * n + I[t * 3 + (k + 1) % 3], t);
    for (let t = 0; t < T; t++) for (let k = 0; k < 3; k++) {
      const o = edge.get(I[t * 3 + (k + 1) % 3] * n + I[t * 3 + k]);
      if (o !== undefined) parent[find(o)] = find(t);
    }
    const lo = new Float64Array(T).fill(Infinity), hi = new Float64Array(T).fill(-Infinity);
    for (let t = 0; t < T; t++) { const r = find(t); for (let k = 0; k < 3; k++) { const x = X[I[t * 3 + k]]; if (x < lo[r]) lo[r] = x; if (x > hi[r]) hi[r] = x; } }
    const out = I.slice(); let flipped = 0;
    for (let t = 0; t < T; t++) { const r = find(t); if (hi[r] > 0.0005 && lo[r] > -0.25 * hi[r]) { out[t * 3 + 1] = I[t * 3 + 2]; out[t * 3 + 2] = I[t * 3 + 1]; flipped++; } }
    idx.setArray(out);
    report[mesh.getName()] = `${flipped}/${T}`;
  }
}
doc.getRoot().setExtras({ ...doc.getRoot().getExtras(), orientado: true });
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(file, doc);
console.log(JSON.stringify(report));
