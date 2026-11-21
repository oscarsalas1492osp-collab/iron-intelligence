# Construye una piel continua sobre el modelo anatómico: voxeliza los músculos, cierra los surcos entre ellos y
# extrae la superficie por partes (tronco, cabeza, brazos, piernas) para que al doblar no aparezcan membranas.
import os
TMP = os.environ.get('PIEL_TMP', '/tmp/piel'); os.makedirs(TMP, exist_ok=True)
import sys, time, json, struct, numpy as np, scipy.ndimage as ndi
from scipy.spatial import cKDTree
from skimage import measure
import fast_simplification
fig = sys.argv[1]; VOX = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0025
T0 = time.time(); log = lambda *a: print(f'[{time.time()-T0:5.1f}s]', *a, flush=True)
d = np.load(f'{TMP}/src_{fig}.npz'); names = sorted({k[:-2] for k in d.files})
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
# Partes: tronco (con cuello y cabeza, una sola piel sin costura bajo el mentón), brazo+x, brazo-x, pierna+x, pierna-x.
# La columna 1 queda vacía: los índices de parte se conservan para el sombreador de la app.
PARTW = np.stack([SW[:, 0] + SW[:, 1], np.zeros(len(SW), np.float32), SW[:, 2:5].sum(1), SW[:, 8:11].sum(1), SW[:, 5:8].sum(1), SW[:, 11:14].sum(1)], 1)
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
# cuánto se cierra cada parte (m): el tronco medio, las extremidades menos; la cabeza y las manos, aparte
RC = {'tronco': 0.014, 'brazoA': 0.009, 'brazoB': 0.009, 'piernaA': 0.011, 'piernaB': 0.011}
THR = 0.3; CTX = 0.12
NET = float(sys.argv[4]) if len(sys.argv) > 4 else 0.004
HAND = float(os.environ.get('PIEL_MANO', '0.005'))
Y = lo[1] + (np.arange(shape[1]) + 0.5) * VOX
ss = lambda a, b, x: (lambda t: t * t * (3 - 2 * t))(np.clip((x - a) / (b - a), 0, 1))
# La piel es una sola pieza. Cada parte (tronco con cabeza, brazos, piernas) se cierra por separado, junto con un
# margen de su vecina, para que un brazo no quede unido al costado ni un muslo al otro por una membrana; después
# se unen todas y la unión se alisa: donde dos partes se encuentran queda un pliegue suave, no una costura.
U = np.zeros(shape, bool); ARM = np.zeros(shape, np.float32); TIGHT = np.zeros(shape, bool)
for pi, pn in enumerate(PARTS):
    if pn == 'cabeza': continue
    WP = ndi.gaussian_filter(PARTW[:, pi][near], 2.0)
    if pn.startswith('brazo'): ARM += WP
    S = solid & (WP >= CTX)
    nz = np.argwhere(S); m = int(np.ceil((0.06 if pn == 'tronco' else 0.034) / VOX)); a = np.maximum(nz.min(0) - m, 0); b = np.minimum(nz.max(0) + m + 1, shape)
    sl = tuple(slice(a[i], b[i]) for i in range(3)); Sc = S[sl]; wp = WP[sl]; yy = Y[sl[1]][None, :, None]
    C = close(Sc, RC[pn], NET)
    if pn == 'tronco':
        # Del mentón hacia arriba se cierra mucho más: cuencas, nariz y boca quedan cubiertas, como en un maniquí.
        C |= close(Sc & (yy > 1.515), 0.04, NET)
        C = close(C, 0.014, R0)            # redondea el paso del mentón al cuello
    else:
        # Cerca del tronco la extremidad se cierra igual que él, para que las dos pieles sean la misma.
        C |= close(Sc, RC['tronco'], NET) & (wp < 0.8)
    if pn.startswith('brazo'):
        # La mano se cierra muy poco: los dedos y el pulgar quedan separados.
        hand = yy < 0.835
        C = (C & ~hand) | (close(Sc & (yy < 0.85), HAND, NET + 0.0015) & hand)     # dedos algo más gruesos que el hueso
    C &= wp >= THR
    U[sl] |= C; log(pn, C.sum() / 1e6, 'M vóxeles')
    # El volumen ceñido de la parte (sin margen de piel): sirve para saber dónde dos partes se tocan de verdad.
    if not pn.startswith('pierna'): TIGHT[sl] |= close(solid[sl] & (wp >= 0.5), 0.004, 0.0)
# En reposo hay partes que se rozan sin estar unidas: la mano con el muslo, un muslo con el otro, el brazo con el
# costado por debajo de la axila. Si quedaran pegadas, al moverse se estiraría una membrana entre ellas. Se abre un
# surco de un centímetro donde se tocan; las uniones de verdad (hombro, cadera, cuello) no se tocan.
lab = PARTW.argmax(1).astype(np.uint8)[near]; del solid, near
low = (Y < 1.30)[None, :, None]
armA, armB, legA, legB, trunk = lab == 2, lab == 3, lab == 4, lab == 5, lab == 0
arms, legs = armA | armB, legA | legB
grow = lambda m: ndi.binary_dilation(m, iterations=2)
# Entre el brazo y el tronco, por delante, el surco se abre solo donde hay aire (el hueco de la axila): donde el
# pectoral se apoya sobre el brazo la piel sigue unida y lo acompaña, como el pliegue real. Por detrás se abre entero:
# el dorsal y el brazo quedan sueltos y al subir el brazo no se estira un abanico entre los dos.
front = ((lo[2] + (np.arange(shape[2]) + 0.5) * VOX) > -0.03)[None, None, :]
cut = (arms & grow(legs)) | (legs & grow(arms)) | (legA & grow(legB)) | (legB & grow(legA)) | (((arms & low & grow(trunk & low)) | (trunk & low & grow(arms & low))) & ~(TIGHT & front & (os.environ.get('PIEL_AXILA', 'surco') == 'delante')))
U &= ~cut; log('surcos', cut.sum() / 1e6, 'M vóxeles'); del lab, armA, armB, legA, legB, trunk, arms, legs, cut, TIGHT
# Rellena cavidades internas y descarta islas sueltas.
U = ndi.binary_fill_holes(U)
# Del pecho hacia arriba se quitan las láminas finas (menos de un centímetro) que deja el surco de la axila, como el
# borde del pectoral que quedaba volando sobre el brazo. Las manos, más abajo, no se tocan.
ro = float(os.environ.get('PIEL_ABRIR', '0.005'))
if ro > 0:
    y0 = int((1.0 - lo[1]) / VOX); y1 = int((1.47 - lo[1]) / VOX); sub = U[:, y0:y1, :]
    opened = edt(~(edt(sub) > ro)) <= ro
    U[:, y0:y1, :] = sub & opened
L, n = ndi.label(U)
if n > 1: U = L == (np.bincount(L.ravel())[1:].argmax() + 1)
del L
raw = ((edt(~U) - edt(U)) / VOX).astype(np.float32); k = 0.0025 / VOX; del U
sdf = ndi.gaussian_filter(raw, 1.8 * k)
yy = Y[None, :, None]
t = (ss(1.47, 1.54, yy) * np.ones(shape, np.float32)); sdf = sdf * (1 - t) + ndi.gaussian_filter(raw, 3.0 * k) * t           # la cabeza, más lisa
t = ((1 - ss(0.80, 0.85, yy)) * ss(0.4, 0.6, ARM)).astype(np.float32); sdf = sdf * (1 - t) + ndi.gaussian_filter(raw, 0.9 * k) * t   # las manos, con más detalle
del raw, t
V, F, _, _ = measure.marching_cubes(sdf, 0.0)
V = V * VOX + lo + VOX * 0.5; log('superficie', len(V), 'vértices', len(F), 'caras')
TARGET = int(sys.argv[3]) if len(sys.argv) > 3 else 64000
V3, F3 = fast_simplification.simplify(V.astype(np.float32), F.astype(np.int32), target_count=TARGET)
# Suavizado de Taubin: quita el facetado de la simplificación sin encoger la figura.
V3 = V3.astype(np.float64); E = np.concatenate([F3[:, [0, 1]], F3[:, [1, 2]], F3[:, [2, 0]]]); E = np.concatenate([E, E[:, ::-1]]); deg = np.bincount(E[:, 0], minlength=len(V3))[:, None].clip(1)
for it in range(10):
    acc = np.zeros_like(V3); np.add.at(acc, E[:, 0], V3[E[:, 1]]); V3 = V3 + (0.5 if it % 2 == 0 else -0.53) * (acc / deg - V3)
def at(Q):
    """Distancia (m, negativa por dentro) a la piel en los puntos Q."""
    q = (Q - lo - VOX * 0.5) / VOX
    return ndi.map_coordinates(sdf, q.T, order=1, mode='nearest') * VOX
# Oclusión: cuánto cielo ve cada punto. Oscurece los surcos entre músculos y da volumen sin costo al dibujar.
a, b, c = V3[F3[:, 0]], V3[F3[:, 1]], V3[F3[:, 2]]; fn = np.cross(b - a, c - a); N = np.zeros_like(V3)
for kk in range(3): np.add.at(N, F3[:, kk], fn)
N /= np.linalg.norm(N, axis=1)[:, None].clip(1e-12)
base = at(V3); ao = np.mean([np.clip((at(V3 + N * dd) - base) / dd, 0, 1) for dd in (0.005, 0.012, 0.025)], 0)
q = np.clip(np.round((V3 - lo - VOX * 0.5) / VOX).astype(int), 0, shape - 1); arm = ARM[q[:, 0], q[:, 1], q[:, 2]]
ao = np.where((V3[:, 1] < 0.84) & (arm > 0.5), np.maximum(ao, 0.8), ao)      # entre los dedos no se oscurece
np.savez_compressed(f'{TMP}/skin_{fig}.npz', V=V3, F=F3.astype(np.int64), A=ao)
log('listo', len(V3), 'vértices', len(F3), 'caras, oclusión media', ao.mean().round(2))
np.savez_compressed(f'{TMP}/samples_{fig}.npz', SP=SP[::3].astype(np.float32), SW=SW[::3], SG=SG[::3], names=np.array(names))
