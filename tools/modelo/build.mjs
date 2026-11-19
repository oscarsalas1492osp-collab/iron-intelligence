// Convierte body.glb (Z-Anatomy, vía hpfrei/body-anatomy-3d-viewer, CC BY-SA 4.0) en un modelo liviano:
// una malla por grupo muscular de la app + una malla base (resto de músculos y esqueleto).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, join, weld, simplify, prune, dedup, meshopt, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';

const [,, input, output, ratioArg] = process.argv;
const ratio = Number(ratioArg ?? 0.6);
// El orden importa: el primer grupo cuyo patrón coincide se queda con la malla.
const G = {
  chest: [/^Pectoralis Major/],
  neck: [/^Sternocleidomastoid/, /^Splenius/, /^Scalene/, /^Levator Scapulae/, /^Semispinalis/, /Longissimus Capitis/],
  traps: [/^Trapezius/],
  lowerback: [/^Iliocostalis/, /^Longissimus/, /^Spinalis/, /^Multifidus/, /^Quadratus Lumborum/],
  back: [/^Latissimus Dorsi/, /^Rhomboid/, /^Teres/, /^Infraspinatus/, /^Supraspinatus/],
  shoulders: [/^Deltoid/],
  biceps: [/^Biceps$/, /Biceps Brachii/, /^Brachialis/, /^Coracobrachialis/],
  triceps: [/^Triceps/, /^Anconeus/],
  forearms: [/^Brachioradialis/, /Extensor Carpi/, /Flexor Carpi/, /^Flexor Digitorum (Superficialis|Profundus)/, /Flexor Digitorum Superficialis/, /^Extensor Digitorum$/, /^Extensor Digiti Minimi/, /^Extensor Indicis/, /^Extensor Pollicis/, /^Abductor Pollicis Longus/, /^Flexor Pollicis Longus/, /^Palmaris Longus/, /Pronator/, /^Supinator/],
  quads: [/^Quadriceps Femoris/],
  hamstrings: [/Biceps Femoris/, /^Semitendinosus/, /^Semimembranosus/],
  abductors: [/^Gluteus (Medius|Minimus)/],
  glutes: [/^Gluteus/],
  adductors: [/^Adductor (Brevis|Longus|Magnus)/, /^Gracilis/, /^Pectineus/],
  calves: [/^Gastrocnemius/, /^Soleus/, /^Plantaris/],
  tibialis: [/^Tibialis Anterior/, /^Extensor Digitorum Longus/, /^Extensor Hallucis Longus/],
  obliques: [/^Abdominal (External|Internal) Oblique/],
  abs: [/^Rectus Abdominis/, /^Pyramidalis/],
};
// Estructuras internas que no aportan a la silueta y solo suman peso.
const DROP = [/Arytenoid/, /Pharyng/, /Thyro/, /Cricothyroid/, /Genio/, /Hyoglossus/, /Stylo/, /Palato/, /Diaphragm/, /Transversus Thoracis/, /Innermost Intercostal/, /^(Inferior|Superior|Lateral|Medial) Rectus$/, /^(Inferior|Superior) Oblique$/, /Levator Palpebrae/, /Tarsus/, /Common Tendinous Ring/, /Psoas/, /Iliacus/, /Transverse Abdominal/, /Longus (Colli|Capitis)/, /Rotatores/, /Interspinales/, /Intertransversarii/, /Levatores/, /Obturator/, /Gemelli/, /Quadratus Femoris/, /Piriformis/, /Subscapularis/, /Pterygoid/];
const groupOf = (name) => { for (const [g, rs] of Object.entries(G)) if (rs.some((r) => r.test(name))) return g; return 'base'; };

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(), 'meshopt.encoder': MeshoptEncoder,
});
const doc = await io.read(input);
const root = doc.getRoot();
const mats = {};
[...Object.keys(G), 'base', 'bone'].forEach((g, i) => { mats[g] = doc.createMaterial(g).setBaseColorFactor([0.2 + i * 0.05, 0.5, 0.5, 1]).setRoughnessFactor(0.6).setMetallicFactor(0.2); });
const count = {};
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  const ex = node.getExtras() || {};
  node.setExtras({});
  if (!mesh) continue;
  const name = String(ex.name || '');
  let g = ex.type === 'muscle' ? groupOf(name) : ex.type === 'bone' ? 'bone' : null;
  if (g === 'base' && DROP.some((r) => r.test(name))) g = null;
  if (!g) { node.setMesh(null); continue; }
  count[g] = (count[g] || 0) + 1;
  for (const p of mesh.listPrimitives()) {
    p.setMaterial(mats[g]);
    for (const sem of p.listSemantics()) if (!['POSITION', 'NORMAL'].includes(sem)) p.setAttribute(sem, null);
  }
}
for (const s of root.listScenes()) s.setExtras({});
root.listMeshes().forEach((m) => m.setExtras({}));
await MeshoptSimplifier.ready;
await doc.transform(
  prune(), dedup(), flatten(), join({ keepNamed: false }), weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio, error: Number(process.argv[5] ?? 0.0008), lockBorder: true }),
  prune(),
);
// Nombra cada nodo por su grupo (material) para que el visor lo encuentre.
for (const node of root.listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const names = [...new Set(mesh.listPrimitives().map((p) => p.getMaterial()?.getName()))];
  node.setName(names.join('+')); mesh.setName(names.join('+'));
}
root.getAsset().copyright = 'Z-Anatomy (CC BY-SA 4.0), adaptado por hpfrei/body-anatomy-3d-viewer y por Iron Intelligence';
for (const e of root.listExtensionsUsed()) if (e.extensionName === 'KHR_draco_mesh_compression') e.dispose();
await doc.transform(quantize({ quantizePosition: 14, quantizeNormal: 8 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await io.write(output, doc);
let tris = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3;
console.log(JSON.stringify({ count, nodes: root.listNodes().filter((n) => n.getMesh()).map((n) => n.getName() + ':' + n.getMesh().listPrimitives().length), tris }));
