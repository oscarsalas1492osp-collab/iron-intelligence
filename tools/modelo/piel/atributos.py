# Pesos de hueso y mapa de músculos para cada vértice de la piel; escribe el .glb que carga la app.
import os
TMP = os.environ.get('PIEL_TMP', '/tmp/piel'); os.makedirs(TMP, exist_ok=True)
import sys, json, struct, numpy as np
from scipy.spatial import cKDTree
fig = sys.argv[1]; dst = sys.argv[2]
s = np.load(f'{TMP}/skin_{fig}.npz'); m = np.load(f'{TMP}/samples_{fig}.npz')
SP, SW, SG, names = m['SP'].astype(np.float64), m['SW'], m['SG'], [str(n) for n in m['names']]
MUSCLES = [n for n in names if n not in ('bone', 'base')]
PARTW = np.stack([SW[:, 0] + SW[:, 1], np.zeros(len(SW), np.float32), SW[:, 2:5].sum(1), SW[:, 8:11].sum(1), SW[:, 5:8].sum(1), SW[:, 11:14].sum(1)], 1)
PARTS = ['tronco', 'cabeza', 'brazoA', 'brazoB', 'piernaA', 'piernaB']
gtree = {n: cKDTree(SP[SG == names.index(n)]) for n in MUSCLES}
ss = lambda a, b, x: (lambda t: t * t * (3 - 2 * t))(np.clip((x - a) / (b - a), 0, 1))
V, F, AO = s['V'], s['F'], s['A']
# Parte a la que pertenece cada vértice: la de la muestra más cercana.
part = PARTW[cKDTree(SP).query(V)[1]].argmax(1)
Wall = np.zeros((len(V), 20))
for pi, pn in enumerate(PARTS):
    m = part == pi
    if pn == 'cabeza' or not m.any(): continue
    # Pesos: promedio gaussiano de las muestras vecinas de esta parte y del tronco.
    sel = np.ones(len(SP), bool) if pn == 'tronco' else (PARTW[:, pi] + PARTW[:, 0] >= 0.9)
    tree = cKDTree(SP[sel]); dist, idx = tree.query(V[m], k=64)
    w = np.exp(-0.5 * (dist / 0.008) ** 2) + 1e-9; Wall[m, :14] = (SW[sel][idx] * w[:, :, None]).sum(1) / w.sum(1)[:, None]
# Se suavizan sobre la malla: en la axila y la ingle, donde la piel pasa de una parte a otra en pocos milímetros,
# el estiramiento se reparte en vez de concentrarse en unas pocas caras.
E = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]); E = np.concatenate([E, E[:, ::-1]]); deg = np.bincount(E[:, 0], minlength=len(V))[:, None].clip(1)
for _ in range(int(os.environ.get('PIEL_SUAVE', '8'))):
    acc = np.zeros_like(Wall); np.add.at(acc, E[:, 0], Wall[E[:, 1]]); Wall = 0.5 * Wall + 0.5 * acc / deg
# El reparto entre el tronco y cada extremidad se hace más decidido: la franja de piel que gira «a medias» con el
# brazo o la pierna se estrecha, y con ella los pliegues falsos sobre el pecho y la espalda cuando el brazo rota.
lo_, hi_ = [float(x) for x in os.environ.get('PIEL_FRANJA', '0.3,0.7').split(',')]
for cols in ([2, 3, 4], [8, 9, 10], [5, 6, 7], [11, 12, 13]):
    wl = Wall[:, cols].sum(1); k = np.where(wl > 1e-6, ss(lo_, hi_, wl) / np.maximum(wl, 1e-6), 0.0)
    rest = 1 - wl; others = [c for c in range(14) if c not in cols]
    new_wl = wl * k; scale = np.where(rest > 1e-6, (1 - new_wl) / np.maximum(rest, 1e-6), 0.0)
    Wall[:, cols] *= k[:, None]; Wall[:, others] *= scale[:, None]
# Hombro: cerca del hombro el peso del brazo pasa a un hueso gemelo que no gira con él (18 brazo +x, 19 brazo −x);
# el giro se reparte a lo largo del brazo y no retuerce la piel del pecho ni de la espalda.
Sh = np.array([0.178, 1.392, -0.03]); El = np.array([0.238, 1.085, -0.035]); dA = El - Sh; lA = np.linalg.norm(dA); dA /= lA
for sd in (0, 1):
    arm = 2 + 6 * sd; tu = ((V * np.array([1 - 2 * sd, 1, 1]) - Sh) @ dA) / lA; k = ss(0.25, 0.9, tu); wa = Wall[:, arm].copy()
    Wall[:, arm] = wa * k; Wall[:, 18 + sd] = wa * (1 - k)
# Dedos: más allá de los nudillos el peso de la mano pasa a dos huesos propios (14-15 mano +x, 16-17 mano −x),
# que la app gira para empuñar. Las medidas van a lo largo de la mano en reposo, desde la muñeca.
Wr = np.array([0.29, 0.845, 0.012]); ax = np.array([0.305, 0.72, 0.06]) - Wr; ax /= np.linalg.norm(ax)
for sd in (0, 1):
    hand = 4 + 6 * sd; u = (V * np.array([1 - 2 * sd, 1, 1]) - Wr) @ ax; f1 = ss(0.079, 0.093, u); f2 = ss(0.117, 0.131, u); wh = Wall[:, hand].copy()
    Wall[:, hand] = wh * (1 - f1); Wall[:, 14 + 2 * sd] = wh * (f1 - f2); Wall[:, 15 + 2 * sd] = wh * f2
top = np.argsort(-Wall, 1)[:, :4]; tw = np.take_along_axis(Wall, top, 1); tw /= tw.sum(1)[:, None]
q = np.round(tw * 255).astype(int); q[:, 0] += 255 - q.sum(1)
J = top.astype(np.uint8); Wq = q.astype(np.uint8)
# Músculos: los dos grupos más cercanos, la mezcla entre ambos y cuánto se apaga con la distancia.
Dg = np.stack([gtree[n].query(V)[0] for n in MUSCLES], 1); o = np.argsort(Dg, 1); d1 = np.take_along_axis(Dg, o[:, :1], 1)[:, 0]; d2 = np.take_along_axis(Dg, o[:, 1:2], 1)[:, 0]
bl = 0.5 * (1 - ss(0.0, 0.007, d2 - d1)); fd = 1 - ss(0.009, 0.022, d1)
# El primer byte lleva el grupo (5 bits) y, en el bit 5, si el vértice es de un brazo (para el corte del pantalón).
arm = (part == 2) | (part == 3)
M = np.stack([o[:, 0] + 32 * arm, o[:, 1], np.round(bl * 255), np.round(fd * 255)], 1).astype(np.uint8)
A = np.stack([np.round(AO * 255)] + [np.zeros(len(V))] * 3, 1).astype(np.uint8)
V = V.astype(np.float32); F = F.astype(np.uint32); W = Wq
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
