# Construye una piel continua sobre el modelo anatómico: voxeliza los músculos, cierra los surcos entre ellos y
# extrae la superficie por partes (tronco, cabeza, brazos, piernas) para que al doblar no aparezcan membranas.
import os
W = os.environ.get('PIEL_TMP', '/tmp/piel'); os.makedirs(W, exist_ok=True)
import sys, time, json, struct, numpy as np, scipy.ndimage as ndi
from scipy.spatial import cKDTree
from skimage import measure
import fast_simplification
fig = sys.argv[1]; VOX = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0025
T0 = time.time(); log = lambda *a: print(f'[{time.time()-T0:5.1f}s]', *a, flush=True)
d = np.load(f'{W}/src_{fig}.npz'); names = sorted({k[:-2] for k in d.files})
MUSCLES = [n for n in names if n not in ('bone', 'base')]
rng = np.random.default_rng(7)
# ---- muestras densas de la superficie, con sus pesos de hueso y su grupo ----
SP, SW, SG = [], [], []
for gi, n in enumerate(names):
    P, W, I = d[n + '_P'].astype(np.float64), d[n + '_W'], d[n + '_I']
    a, b, c = P[I[:, 0]], P[I[:, 1]], P[I[:, 2]]
    area = 0.5 * np.linalg.norm(np.cross(b - a, c - a), axis=1)
    k = np.ceil(area / (VOX * 0.55) ** 2).astype(int) + 1
    t = np.repeat(np.arange(len(I)), k); u = rng.random(len(t)); v = rng.random(len(t)); f = u + v > 1; u[f] = 1 - u[f]; v[f] = 1 - v[f]; w = 1 - u - v
    SP.append(np.concatenate([P, a[t] * w[:, None] + b[t] * u[:, None] + c[t] * v[:, None]]))
    Wa, Wb, Wc = W[I[:, 0]][t], W[I[:, 1]][t], W[I[:, 2]][t]
    SW.append(np.concatenate([W, Wa * w[:, None] + Wb * u[:, None] + Wc * v[:, None]]).astype(np.float32))
    SG.append(np.full(len(P) + len(t), gi, np.int16))
SP = np.concatenate(SP); SW = np.concatenate(SW); SG = np.concatenate(SG)
# La piel se hace simétrica: cada muestra se refleja al otro lado (con sus huesos cambiados de lado), así una pieza
# que el modelo solo trae en una mitad queda cubierta en las dos.
SPm = SP * np.array([-1, 1, 1]); SWm = SW[:, [0, 1, 8, 9, 10, 11, 12, 13, 2, 3, 4, 5, 6, 7]]
SP = np.concatenate([SP, SPm]); SW = np.concatenate([SW, SWm]); SG = np.concatenate([SG, SG]); log('muestras', len(SP))
# partes: tronco, cabeza, brazo+x, brazo-x, pierna+x, pierna-x
PARTW = np.stack([SW[:, 0], SW[:, 1], SW[:, 2:5].sum(1), SW[:, 8:11].sum(1), SW[:, 5:8].sum(1), SW[:, 11:14].sum(1)], 1)
PARTS = ['tronco', 'cabeza', 'brazoA', 'brazoB', 'piernaA', 'piernaB']
lo = SP.min(0) - 0.065; shape = np.ceil((SP.max(0) + 0.065 - lo) / VOX).astype(int); log('rejilla', shape, shape.prod() / 1e6, 'M')
ijk = np.floor((SP - lo) / VOX).astype(np.int32)
sid = np.full(shape, -1, np.int32); sid[ijk[:, 0], ijk[:, 1], ijk[:, 2]] = np.arange(len(SP))
D, IDX = ndi.distance_transform_edt(sid < 0, return_indices=True); log('distancias')
near = sid[IDX[0], IDX[1], IDX[2]]; del IDX
R0 = 0.003
thick = D * VOX <= R0; del D
solid = thick; log('cáscara', solid.sum() / 1e6, 'M vóxeles')
edt = lambda m: ndi.distance_transform_edt(m) * VOX
def close(S, rc, net):
    """Cierra surcos de hasta 2·rc, rellena el interior y deja la superficie `net` metros por fuera de los músculos."""
    dil = edt(~S) <= rc
    # El modelo es hueco por dentro (tórax, abdomen) y cada parte queda abierta por donde se corta: se rellena
    # rebanada a rebanada, donde la pared sí forma un anillo cerrado, y luego en volumen.
    for y in range(dil.shape[1]): dil[:, y, :] = ndi.binary_fill_holes(dil[:, y, :])
    dil = ndi.binary_fill_holes(dil)
    return edt(dil) > rc + (R0 - net)
# cuánto se cierra cada parte (m): la cabeza mucho (cuencas, mandíbula), el tronco medio, las extremidades menos
RC = {'tronco': 0.014, 'cabeza': 0.022, 'brazoA': 0.009, 'brazoB': 0.009, 'piernaA': 0.011, 'piernaB': 0.011}
THR = {'tronco': 0.3, 'cabeza': 0.38, 'brazoA': 0.3, 'brazoB': 0.3, 'piernaA': 0.3, 'piernaB': 0.3}
NET = float(sys.argv[4]) if len(sys.argv) > 4 else 0.004
SIG = {'tronco': 1.9, 'cabeza': 3.0, 'brazoA': 1.6, 'brazoB': 1.6, 'piernaA': 1.7, 'piernaB': 1.7}
closed = {}; meshes = []
Y = lo[1] + (np.arange(shape[1]) + 0.5) * VOX
for pi, pn in enumerate(PARTS):
    # El reparto entre partes se suaviza antes de cortar: los bordes de cada parte quedan limpios, no en escalera.
    WP = ndi.gaussian_filter(PARTW[:, pi][near], 2.0)
    S = solid & (WP >= THR[pn])
    nz = np.argwhere(S); m = int(np.ceil((0.06 if pn == 'cabeza' else RC[pn] + 0.02) / VOX)); a = np.maximum(nz.min(0) - m, 0); b = np.minimum(nz.max(0) + m + 1, shape)
    sl = tuple(slice(a[i], b[i]) for i in range(3)); C = close(S[sl], RC[pn], NET)
    if pn == 'cabeza':
        # Del mentón hacia arriba se cierra mucho más: cuencas, nariz y boca quedan cubiertas, como en un maniquí.
        up = (Y[sl[1]] > 1.515)[None, :, None]
        C |= close(S[sl] & up, 0.04, NET)
        C = close(C, 0.014, R0)            # redondea el escalón entre el mentón y el cuello
    if pn.startswith('brazo'):
        # Las manos se cierran más: quedan lisas, sin dedos sueltos, y al empuñar se leen como un puño.
        C |= close(S[sl] & (Y[sl[1]] < 0.84)[None, :, None], 0.017, NET)
    # Donde otra parte manda más (peso menor que 0,5) esta se retira unos milímetros: en los solapes siempre queda
    # una sola piel arriba y no se entretejen dos superficies casi iguales; hacia su borde se hunde del todo.
    wp = WP[sl]
    C &= ~((wp < 0.5) & (edt(C) <= 0.0035 + 0.012 * np.clip((0.5 - wp) / 0.2, 0, 1)))
    # componente mayor: descarta islas sueltas
    L, n = ndi.label(C)
    if n > 1: C = L == (np.bincount(L.ravel())[1:].argmax() + 1)
    sdf = ndi.gaussian_filter((edt(~C) - edt(C)) / VOX, SIG[pn] * 0.0025 / VOX)
    closed[pn] = (sl, sdf)
    V, F, _, _ = measure.marching_cubes(sdf, 0.0)
    V = (V + a) * VOX + lo + VOX * 0.5
    meshes.append((pn, V, F)); log(pn, C.sum() / 1e6, 'M', len(V), 'vértices', len(F), 'caras')
np.savez_compressed(f'{W}/raw_{fig}.npz', **{f'{pn}_V': V for pn, V, F in meshes}, **{f'{pn}_F': F for pn, V, F in meshes}, lo=lo, vox=VOX)
# sdf de cada parte, para poder descartar lo que queda enterrado dentro de otra
def inside_other(pn, V, depth):
    hid = np.zeros(len(V), bool)
    for qn, (sl, sdf) in closed.items():
        if qn == pn: continue
        a = np.array([s.start for s in sl]); q = (V - lo - VOX * 0.5) / VOX - a
        ok = np.all((q >= 0) & (q <= np.array(sdf.shape) - 1), 1)
        val = ndi.map_coordinates(sdf, q[ok].T, order=1); h = np.zeros(len(V), bool); h[ok] = val < -depth / VOX; hid |= h
    return hid
out = {}
TARGET = int(sys.argv[3]) if len(sys.argv) > 3 else 64000
total = sum(len(F) for _, _, F in meshes)
def union_sdf(Q):
    """Distancia (m, negativa por dentro) a la unión de todas las partes."""
    val = np.full(len(Q), 1.0)
    for qn, (sl, sdf) in closed.items():
        a = np.array([s.start for s in sl]); q = (Q - lo - VOX * 0.5) / VOX - a
        ok = np.all((q >= 0) & (q <= np.array(sdf.shape) - 1), 1)
        v = np.full(len(Q), 1.0); v[ok] = ndi.map_coordinates(sdf, q[ok].T, order=1) * VOX; val = np.minimum(val, v)
    return val
for pn, V, F in meshes:
    # Primero se simplifica y se suaviza la parte entera, todavía cerrada; después se quita lo que queda enterrado
    # dentro de otra parte, así los bordes del recorte no se mueven y quedan siempre ocultos.
    goal = max(800, int(TARGET * len(F) / total))
    V3, F3 = fast_simplification.simplify(V.astype(np.float32), F.astype(np.int32), target_count=goal)
    V3 = V3.astype(np.float64); E = np.concatenate([F3[:, [0, 1]], F3[:, [1, 2]], F3[:, [2, 0]]]); E = np.concatenate([E, E[:, ::-1]]); deg = np.bincount(E[:, 0], minlength=len(V3))[:, None].clip(1)
    for it in range(10):
        acc = np.zeros_like(V3); np.add.at(acc, E[:, 0], V3[E[:, 1]]); V3 = V3 + (0.5 if it % 2 == 0 else -0.53) * (acc / deg - V3)
    V4, F4 = V3, F3       # las partes se dejan cerradas: aunque una articulación se doble mucho, nunca se ve un hueco
    # Oclusión: cuánto cielo ve cada punto. Oscurece los surcos entre músculos y da volumen sin costo al dibujar.
    a, b, c = V4[F4[:, 0]], V4[F4[:, 1]], V4[F4[:, 2]]; fn = np.cross(b - a, c - a); N = np.zeros_like(V4)
    for k in range(3): np.add.at(N, F4[:, k], fn)
    N /= np.linalg.norm(N, axis=1)[:, None].clip(1e-12)
    ao = np.mean([np.clip(union_sdf(V4 + N * dd) / dd, 0, 1) for dd in (0.005, 0.012, 0.025)], 0)
    out[pn] = (V4, F4.astype(np.int64), ao); log(pn, len(F4), 'caras, oclusión media', ao.mean().round(2))
np.savez_compressed(f'{W}/skin_{fig}.npz', **{f'{pn}_V': v for pn, (v, f, ao) in out.items()}, **{f'{pn}_F': f for pn, (v, f, ao) in out.items()}, **{f'{pn}_A': ao for pn, (v, f, ao) in out.items()})
np.savez_compressed(f'{W}/samples_{fig}.npz', SP=SP[::3].astype(np.float32), SW=SW[::3], SG=SG[::3], names=np.array(names))
log('listo', sum(len(v) for v, f, ao in out.values()), 'vértices', sum(len(f) for v, f, ao in out.values()), 'caras')
