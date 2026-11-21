# Pesos de hueso y mapa de músculos para cada vértice de la piel; escribe el .glb que carga la app.
import os
W = os.environ.get('PIEL_TMP', '/tmp/piel'); os.makedirs(W, exist_ok=True)
import sys, json, struct, numpy as np
from scipy.spatial import cKDTree
fig = sys.argv[1]; dst = sys.argv[2]
s = np.load(f'{W}/skin_{fig}.npz'); m = np.load(f'{W}/samples_{fig}.npz')
SP, SW, SG, names = m['SP'].astype(np.float64), m['SW'], m['SG'], [str(n) for n in m['names']]
MUSCLES = [n for n in names if n not in ('bone', 'base')]
PARTW = np.stack([SW[:, 0], SW[:, 1], SW[:, 2:5].sum(1), SW[:, 8:11].sum(1), SW[:, 5:8].sum(1), SW[:, 11:14].sum(1)], 1)
PARTS = ['tronco', 'cabeza', 'brazoA', 'brazoB', 'piernaA', 'piernaB']
gtree = {n: cKDTree(SP[SG == names.index(n)]) for n in MUSCLES}
ss = lambda a, b, x: (lambda t: t * t * (3 - 2 * t))(np.clip((x - a) / (b - a), 0, 1))
VV, FF, JJ, WW, MM, PP, AA = [], [], [], [], [], [], []; off = 0
for pi, pn in enumerate(PARTS):
    V, F = s[pn + '_V'], s[pn + '_F']; AA.append(np.stack([np.round(s[pn + '_A'] * 255)] + [np.zeros(len(V))] * 3, 1))
    # Pesos: promedio gaussiano de las muestras vecinas de esta parte y del tronco. En los solapes las dos partes
    # ven las mismas muestras, así sus pieles se mueven juntas y no se atraviesan al doblar.
    sel = np.ones(len(SP), bool) if pn == 'tronco' else (PARTW[:, pi] + PARTW[:, 0] + (PARTW[:, 1] if pn == 'cabeza' else 0) >= 0.9)
    tree = cKDTree(SP[sel]); dist, idx = tree.query(V, k=64)
    w = np.exp(-0.5 * (dist / 0.008) ** 2) + 1e-9; W = (SW[sel][idx] * w[:, :, None]).sum(1) / w.sum(1)[:, None]
    top = np.argsort(-W, 1)[:, :4]; tw = np.take_along_axis(W, top, 1); tw /= tw.sum(1)[:, None]
    q = np.round(tw * 255).astype(int); q[:, 0] += 255 - q.sum(1)
    # músculos: los dos grupos más cercanos, la mezcla entre ambos y cuánto se apaga con la distancia
    Dg = np.stack([gtree[n].query(V)[0] for n in MUSCLES], 1); o = np.argsort(Dg, 1); d1 = np.take_along_axis(Dg, o[:, :1], 1)[:, 0]; d2 = np.take_along_axis(Dg, o[:, 1:2], 1)[:, 0]
    b = 0.5 * (1 - ss(0.0, 0.007, d2 - d1)); f = 1 - ss(0.009, 0.022, d1)
    VV.append(V); FF.append(F + off); off += len(V); JJ.append(top); WW.append(q)
    MM.append(np.stack([o[:, 0] + 32 * pi, o[:, 1], np.round(b * 255), np.round(f * 255)], 1)); PP.append(np.full(len(V), pi))
V = np.concatenate(VV).astype(np.float32); F = np.concatenate(FF).astype(np.uint32); J = np.concatenate(JJ).astype(np.uint8); W = np.concatenate(WW).astype(np.uint8); M = np.concatenate(MM).astype(np.uint8); A = np.concatenate(AA).astype(np.uint8)
def pad(b): return b + b'\0' * (-len(b) % 4)
chunks = [V.tobytes(), J.tobytes(), W.tobytes(), M.tobytes(), F.tobytes(), A.tobytes()]; views = []; acc = []; pos = 0
for i, c in enumerate(chunks):
    views.append({'buffer': 0, 'byteOffset': pos, 'byteLength': len(c), 'target': 34963 if i == 4 else 34962}); c = pad(c); acc.append(c); pos += len(c)
n = len(V)
accessors = [
    {'bufferView': 0, 'componentType': 5126, 'count': n, 'type': 'VEC3', 'min': V.min(0).tolist(), 'max': V.max(0).tolist()},
    {'bufferView': 1, 'componentType': 5121, 'count': n, 'type': 'VEC4'},
    {'bufferView': 2, 'componentType': 5121, 'count': n, 'type': 'VEC4', 'normalized': True},
    {'bufferView': 3, 'componentType': 5121, 'count': n, 'type': 'VEC4'},
    {'bufferView': 4, 'componentType': 5125, 'count': int(F.size), 'type': 'SCALAR'},
    {'bufferView': 5, 'componentType': 5121, 'count': n, 'type': 'VEC4', 'normalized': True},
]
g = {'asset': {'version': '2.0', 'generator': 'iron-intelligence tools/modelo/piel', 'copyright': 'Derivado de Z-Anatomy, CC BY-SA 4.0'},
     'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': 'piel'}],
     'meshes': [{'name': 'piel', 'extras': {'grupos': MUSCLES}, 'primitives': [{'attributes': {'POSITION': 0, 'JOINTS_0': 1, 'WEIGHTS_0': 2, '_MUSCULO': 3, '_OCLUSION': 5}, 'indices': 4}]}],
     'buffers': [{'byteLength': pos}], 'bufferViews': views, 'accessors': accessors}
js = json.dumps(g, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4); bin_ = b''.join(acc)
open(dst, 'wb').write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(bin_), 0x004E4942) + bin_)
print(fig, n, 'vértices', len(F), 'caras', round((12 + 16 + len(js) + len(bin_)) / 1024), 'KB', MUSCLES)
