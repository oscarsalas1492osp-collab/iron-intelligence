// Comprime la piel (public/models/piel.glb) con Meshopt. Solo se cuantizan las posiciones (14 bits, ~0,1 mm);
// los pesos de hueso, el mapa de músculos y la oclusión ya vienen en bytes y se guardan sin pérdida.
//   node tools/modelo/piel/comprimir.mjs public/models/piel.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { quantize, reorder } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const file = process.argv[2];
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(file);
await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize({ pattern: /^POSITION$/, quantizePosition: 14 }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(file, doc);
