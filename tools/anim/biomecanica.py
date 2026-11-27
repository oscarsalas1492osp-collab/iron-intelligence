"""Movimientos generados desde reglas biomecánicas, sin captura de movimiento.

Cada ejercicio se resuelve cuadro por cuadro: las posiciones de las
articulaciones salen de restricciones (pies fijos, barra sobre el medio pie,
antebrazo vertical, pelvis apoyada) y de cinemática inversa de dos segmentos
para rodillas y codos. No usa Blender: se puede correr y revisar con Python
y numpy solos.

Ejes: X adelante, Y izquierda, Z arriba. Suelo en z = 0. Metros y segundos.
Proporciones: Winter, Biomechanics and Motor Control of Human Movement,
4.ª ed., tabla 4.1 (largo y masa de segmentos como fracción de estatura y peso).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

H = 1.78          # estatura del maniquí
PESO = 78.0       # kg, solo para el centro de masa

M = dict(
    tobillo=0.039 * H,      # altura del tobillo sobre la planta
    pierna=0.246 * H,       # tobillo a rodilla
    muslo=0.245 * H,        # rodilla a cadera
    brazo=0.186 * H,        # hombro a codo
    antebrazo=0.146 * H,    # codo a muñeca
    agarre=0.08,            # muñeca al centro de la mano cerrada
    cadera=0.09,            # media distancia entre centros de cadera
    talon=0.05,             # tobillo a talón, hacia atrás
    punta=0.22,             # tobillo a punta del pie (pie de 0.152 H)
)
M['mano'] = M['antebrazo'] + M['agarre']

# Puntos fijos al tronco, en el sistema del tronco: origen en el centro de las
# caderas, z hacia el cuello, x hacia el pecho, y hacia la izquierda.
TRONCO = dict(
    hombro=np.array([0.0, 0.19, 0.50]),
    hombro_retraido=np.array([-0.012, 0.175, 0.488]),  # escápulas atrás y abajo
    cuello=np.array([-0.035, 0.0, 0.55]),
    cabeza=np.array([0.01, 0.0, 0.715]),
    barra_alta=np.array([-0.065, 0.0, 0.535]),  # barra sobre el trapecio
)

# Sección del tronco a lo largo de su eje: (z, medio ancho, frente, espalda).
# El modelo 3D usa esta misma tabla, así el contacto barra-pecho y
# espalda-banco que se valida es el que se ve.
PERFIL_TRONCO = [
    (-0.06, 0.150, 0.085, 0.100),
    (0.00, 0.172, 0.100, 0.122),
    (0.08, 0.165, 0.098, 0.110),
    (0.18, 0.138, 0.098, 0.088),
    (0.27, 0.150, 0.110, 0.090),
    (0.35, 0.165, 0.126, 0.097),
    (0.43, 0.178, 0.122, 0.101),
    (0.49, 0.185, 0.095, 0.098),
    (0.535, 0.120, 0.060, 0.075),
    (0.56, 0.062, 0.045, 0.058),
]

# Masa por segmento (fracción del peso) y ubicación del centro de masa desde
# el extremo proximal (Winter, tabla 4.1).
MASAS = dict(muslo=(0.100, 0.433), pierna=(0.0465, 0.433), pie=(0.0145, 0.5),
             brazo=(0.028, 0.436), antebrazo=(0.022, 0.53),
             tronco=(0.497, 0.5), cabeza=(0.081, 1.0))

LADOS = (('i', 1.0), ('d', -1.0))


def unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-12 else v


def perfil(z):
    """Medio ancho, frente y espalda del tronco a la altura z (interpolado)."""
    zs = [p[0] for p in PERFIL_TRONCO]
    z = min(max(z, zs[0]), zs[-1])
    return tuple(float(np.interp(z, zs, [p[k] for p in PERFIL_TRONCO])) for k in (1, 2, 3))


def ik2(a, c, l1, l2, polo):
    """Punto intermedio b (rodilla o codo) con |b-a| = l1 y |c-b| = l2.

    De las soluciones posibles elige la que queda del lado del punto polo:
    así la rodilla sigue la punta del pie o el codo apunta hacia donde debe.
    """
    d = c - a
    dist = float(np.linalg.norm(d))
    if dist > l1 + l2 - 1e-6 or dist < abs(l1 - l2) + 1e-6:
        raise ValueError(f'fuera de alcance: {dist:.3f} m para {l1:.3f}+{l2:.3f}')
    u = d / dist
    x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(l1 * l1 - x * x, 0.0))
    p = polo - a
    w = unit(p - np.dot(p, u) * u)
    return a + u * x + w * h


def angulo(a, b):
    """Ángulo en grados entre dos vectores."""
    c = np.dot(unit(a), unit(b))
    return math.degrees(math.acos(max(-1.0, min(1.0, c))))


def bisecar(f, a, b, n=60):
    """Raíz de una función monótona en [a, b]."""
    fa = f(a)
    for _ in range(n):
        m = 0.5 * (a + b)
        fm = f(m)
        if (fm > 0) == (fa > 0):
            a, fa = m, fm
        else:
            b = m
    return 0.5 * (a + b)


def rot_tronco(z_dir, x_ref):
    """Matriz con columnas x (pecho), y (izquierda), z (hacia el cuello)."""
    z = unit(np.asarray(z_dir, float))
    x = unit(x_ref - np.dot(x_ref, z) * z)
    y = np.cross(z, x)
    return np.column_stack([x, y, z])


def suave(t):
    """Arranque y frenado suaves, sin saltos de aceleración (smootherstep)."""
    t = min(max(t, 0.0), 1.0)
    return t * t * t * (t * (6 * t - 15) + 10)


# ---------------------------------------------------------------- ritmo

@dataclass
class Ritmo:
    """Una repetición: espera arriba, baja, pausa, sube, espera."""
    arriba: float = 0.4
    bajada: float = 2.0
    pausa: float = 0.3
    subida: float = 1.2
    final: float = 0.4

    @property
    def total(self):
        return self.arriba + self.bajada + self.pausa + self.subida + self.final

    def avance(self, t):
        """Profundidad s en [0, 1] y fase en el instante t."""
        a = self.arriba
        if t < a:
            return 0.0, 'arriba'
        t -= a
        if t < self.bajada:
            return suave(t / self.bajada), 'bajada'
        t -= self.bajada
        if t < self.pausa:
            return 1.0, 'pausa'
        t -= self.pausa
        if t < self.subida:
            return 1.0 - suave(t / self.subida), 'subida'
        return 0.0, 'arriba'


@dataclass
class Cuadro:
    t: float
    s: float
    fase: str
    j: dict = field(default_factory=dict)        # articulaciones
    ref: dict = field(default_factory=dict)      # lado anterior de cada segmento
    tronco: np.ndarray = None                    # rotación del tronco
    equipo: dict = field(default_factory=dict)   # posiciones de barra o trineo
    esfuerzo: float = 0.0


@dataclass
class Ejercicio:
    clave: str
    nombre: str
    principal: list
    secundarios: list
    ritmo: Ritmo
    cuadros: list
    datos: dict = field(default_factory=dict)    # medidas fijas para validar


def esfuerzo(s, fase):
    return 0.35 + 0.5 * s + (0.15 if fase in ('subida', 'pausa') else 0.0)


def cuadros(ritmo, fps, pose):
    n = int(round(ritmo.total * fps))
    out = []
    for k in range(n):
        t = k / fps
        s, fase = ritmo.avance(t)
        c = pose(s)
        c.t, c.s, c.fase = t, s, fase
        c.esfuerzo = esfuerzo(s, fase)
        out.append(c)
    return out


def brazos(c, polo_local):
    """Codos por cinemática inversa hacia un polo fijo al tronco."""
    R = c.tronco
    for lado, sg in LADOS:
        h, m = c.j['hombro_' + lado], c.j['mano_' + lado]
        p = polo_local * np.array([1, sg, 1])
        polo = h + R @ p
        e = ik2(h, m, M['brazo'], M['mano'], polo)
        c.j['codo_' + lado] = e
        ant = -unit(polo - h)
        c.ref['brazo_' + lado] = ant
        c.ref['antebrazo_' + lado] = ant


def piernas(c, pies, polo_extra=None):
    """Rodillas por cinemática inversa: siguen la dirección del pie."""
    for lado, sg in LADOS:
        cad, tob = c.j['cadera_' + lado], pies['tobillo_' + lado]
        f = pies['dir_' + lado]
        polo = 0.5 * (cad + tob) + f
        if polo_extra is not None:
            polo = polo + polo_extra * np.array([1, sg, 1])
        c.j['rodilla_' + lado] = ik2(cad, tob, M['muslo'], M['pierna'], polo)
        c.j['tobillo_' + lado] = tob
        c.j['talon_' + lado] = pies['talon_' + lado]
        c.j['punta_' + lado] = pies['punta_' + lado]
        c.ref['muslo_' + lado] = f
        c.ref['pierna_' + lado] = f
        c.ref['pie_' + lado] = pies['dorso']
        c.ref['pie_dir_' + lado] = f


def colocar_tronco(c, pelvis, R, hombro='hombro'):
    c.tronco = R
    c.j['pelvis'] = pelvis
    for lado, sg in LADOS:
        c.j['cadera_' + lado] = pelvis + R @ np.array([0, sg * M['cadera'], 0])
        c.j['hombro_' + lado] = pelvis + R @ (TRONCO[hombro] * np.array([1, sg, 1]))
    c.j['cuello'] = pelvis + R @ TRONCO['cuello']
    c.j['cabeza'] = pelvis + R @ TRONCO['cabeza']
    c.ref['tronco'] = R[:, 0]


def pies_en_suelo(ancho, giro_deg, x=0.0):
    p = {'dorso': np.array([0.0, 0.0, 1.0])}
    for lado, sg in LADOS:
        g = math.radians(giro_deg) * sg
        f = np.array([math.cos(g), math.sin(g), 0.0])
        tob = np.array([x, sg * ancho, M['tobillo']])
        p['dir_' + lado] = f
        p['tobillo_' + lado] = tob
        p['talon_' + lado] = np.array([*(tob - f * M['talon'])[:2], 0.0])
        p['punta_' + lado] = np.array([*(tob + f * M['punta'])[:2], 0.0])
    return p


# ---------------------------------------------------------------- sentadilla

def sentadilla(fps=30, barra_kg=60.0):
    """Sentadilla con barra alta.

    Reglas: pies fijos al ancho de hombros con las puntas 20° afuera, rodillas
    en la dirección del pie, espalda neutra (tronco rígido), barra siempre
    sobre el medio pie. Arriba la rodilla queda 5° flexionada; abajo la cadera
    baja 3 cm bajo la rodilla con la pierna a 32° de la vertical.
    """
    pies = pies_en_suelo(0.19, 20.0)
    medio = 0.5 * (pies['talon_i'][0] + pies['punta_i'][0])
    alfa_abajo, alfa_arriba = 32.0, 2.0

    def tronco_beta(b):
        b = math.radians(b)
        return rot_tronco([math.sin(b), 0, math.cos(b)], np.array([math.cos(b), 0, -math.sin(b)]))

    def legs(x, z):
        c = Cuadro(0, 0, '')
        colocar_tronco(c, np.array([x, 0.0, z]), tronco_beta(0))
        piernas(c, pies)
        return c

    def alfa(x, z):
        # inclinación de la pierna hacia la punta del pie (con signo)
        v = legs(x, z).j['rodilla_i'] - pies['tobillo_i']
        return math.degrees(math.atan2(float(np.dot(v, pies['dir_i'])), float(v[2])))

    def alcanzable(x, z):
        cad = np.array([x, M['cadera'], z])
        return np.linalg.norm(cad - pies['tobillo_i']) < M['muslo'] + M['pierna'] - 1e-4

    def x_para(z, a):
        # x mínima y máxima alcanzables a esta altura
        xs = [x for x in np.linspace(-0.6, 0.4, 401) if alcanzable(x, z)]
        lo, hi = xs[0], xs[-1]
        return bisecar(lambda x: alfa(x, z) - a, lo, hi)

    def flexion_rodilla(x, z):
        c = legs(x, z)
        return 180 - angulo(c.j['cadera_i'] - c.j['rodilla_i'], pies['tobillo_i'] - c.j['rodilla_i'])

    # De pie: rodillas 5° flexionadas, pierna casi vertical.
    def f_arriba(z):
        return flexion_rodilla(x_para(z, alfa_arriba), z) - 5.0
    z_max = M['tobillo'] + math.sqrt((M['muslo'] + M['pierna']) ** 2 - (0.19 - M['cadera']) ** 2) - 0.002
    z0 = bisecar(f_arriba, 0.75, z_max)

    # Abajo: cadera 3 cm bajo la rodilla.
    def f_abajo(z):
        c = legs(x_para(z, alfa_abajo), z)
        return z - (c.j['rodilla_i'][2] - 0.03)
    zb = bisecar(f_abajo, 0.30, 0.70)

    x0, xb = x_para(z0, alfa_arriba), x_para(zb, alfa_abajo)

    def pose(s):
        # La cadera baja y va hacia atrás a la vez; el retroceso se adelanta un
        # poco (75 % a media bajada) y abajo el movimiento es casi vertical.
        z = z0 + (zb - z0) * s
        x = x0 + (xb - x0) * (2 * s - s * s)
        pel = np.array([x, 0.0, z])

        def bar_x(b):
            return (pel + tronco_beta(b) @ TRONCO['barra_alta'])[0] - medio
        b = bisecar(bar_x, -5.0, 70.0)
        c = Cuadro(0, 0, '')
        colocar_tronco(c, pel, tronco_beta(b))
        piernas(c, pies)
        barra = pel + c.tronco @ TRONCO['barra_alta']
        c.equipo['barra'] = barra
        for lado, sg in LADOS:
            c.j['mano_' + lado] = barra + np.array([0, sg * 0.45, 0])
        brazos(c, np.array([-0.4, 0.25, -1.0]))
        c.datos = dict(beta=b)
        return c

    ritmo = Ritmo(arriba=0.4, bajada=2.0, pausa=0.3, subida=1.2, final=0.4)
    cs = cuadros(ritmo, fps, pose)
    return Ejercicio('squat', 'Sentadilla con barra', ['quads'], ['glutes', 'hamstrings', 'abs'],
                     ritmo, cs, dict(pies=pies, medio_pie=medio, barra_kg=barra_kg, z_arriba=z0, z_abajo=zb))


# ---------------------------------------------------------------- press de banca

BANCO_ALTO = 0.43     # altura de la colchoneta
AGARRE_BANCA = 0.41   # media distancia entre manos


def press_banca(fps=30, barra_kg=60.0):
    """Press de banca con barra.

    Reglas: glúteos y espalda alta apoyados, escápulas retraídas, pies fijos;
    abajo la barra toca la parte media-baja del pecho con el antebrazo
    vertical; arriba la barra queda sobre los hombros con los codos
    extendidos; trayectoria en J (más diagonal cerca del pecho).
    """
    # Tronco acostado: cabeza hacia -X, pecho hacia +Z. Se apoya en dos puntos:
    # glúteos (z del tronco 0.0) y espalda alta (0.43).
    def tronco_con(gam):
        g = math.radians(gam)
        z_dir = np.array([-math.cos(g), 0, -math.sin(g)])   # gam > 0: hombros más bajos que la cadera
        return rot_tronco(z_dir, np.array([0, 0, 1.0]))

    def apoyo(gam):
        R = tronco_con(gam)
        _, _, esp_g = perfil(0.0)
        _, _, esp_e = perfil(0.43)
        g = R @ np.array([-esp_g, 0, 0.0])
        e = R @ np.array([-esp_e, 0, 0.43])
        return R, g, e

    # Inclinación que deja ambos apoyos a la misma altura (colchoneta plana).
    gam = bisecar(lambda gm: (apoyo(gm)[1][2] - apoyo(gm)[2][2]), -10, 10)
    R, g, _ = apoyo(gam)
    pel = np.array([0.50, 0.0, BANCO_ALTO + 0.004 - g[2]])  # 4 mm de hundimiento de la colchoneta

    base = Cuadro(0, 0, '')
    colocar_tronco(base, pel, R, hombro='hombro_retraido')
    hom = base.j['hombro_i']
    Lu, Lf = M['brazo'], M['mano']
    dy = AGARRE_BANCA - hom[1]

    def pecho_z(x):
        """Altura de la superficie del pecho bajo la barra, en x."""
        zt = float(np.dot(np.array([x, 0, 0]) - pel, R[:, 2]))
        _, frente, _ = perfil(zt)
        return (pel + R @ np.array([frente, 0, zt]))[2]

    # Abajo: antebrazo vertical y barra apoyada en el pecho.
    xb = hom[0] + 0.15
    for _ in range(40):
        zb = pecho_z(xb) + 0.014
        dz = (zb - Lf) - hom[2]
        xb = hom[0] + math.sqrt(max(Lu * Lu - dy * dy - dz * dz, 0.0))
    zb = pecho_z(xb) + 0.014
    # Arriba: barra sobre la articulación del hombro, codo casi extendido (172°).
    largo = math.sqrt(Lu * Lu + Lf * Lf - 2 * Lu * Lf * math.cos(math.radians(172)))
    xt = hom[0] + 0.02
    zt = hom[2] + math.sqrt(largo * largo - dy * dy - (xt - hom[0]) ** 2)

    pies = {'dorso': np.array([0.0, 0.0, 1.0])}
    for lado, sg in LADOS:
        g15 = math.radians(15) * sg
        f = np.array([math.cos(g15), math.sin(g15), 0])
        tob = np.array([pel[0] + 0.34, sg * 0.25, M['tobillo']])
        pies.update({'dir_' + lado: f, 'tobillo_' + lado: tob,
                     'talon_' + lado: np.array([*(tob - f * M['talon'])[:2], 0]),
                     'punta_' + lado: np.array([*(tob + f * M['punta'])[:2], 0])})

    def pose(s):
        c = Cuadro(0, 0, '')
        colocar_tronco(c, pel, R, hombro='hombro_retraido')
        piernas(c, pies, polo_extra=np.array([0, 0.3, 1.2]))
        x = xt + (xb - xt) * s * s
        z = zt + (zb - zt) * s
        barra = np.array([x, 0.0, z])
        c.equipo['barra'] = barra
        for lado, sg in LADOS:
            m = barra + np.array([0, sg * AGARRE_BANCA, 0])
            c.j['mano_' + lado] = m
            polo = m + np.array([0.0, 0.0, -1.0])
            h = c.j['hombro_' + lado]
            e = ik2(h, m, Lu, Lf, polo)
            c.j['codo_' + lado] = e
            ant = -unit(np.array([0.3, sg * 0.4, -1.0]))
            c.ref['brazo_' + lado] = ant
            c.ref['antebrazo_' + lado] = ant
        c.datos = dict(pecho=pecho_z(x))
        return c

    ritmo = Ritmo(arriba=0.4, bajada=2.0, pausa=0.3, subida=1.2, final=0.4)
    cs = cuadros(ritmo, fps, pose)
    return Ejercicio('bench_press', 'Press de banca con barra', ['chest'], ['triceps', 'shoulders'],
                     ritmo, cs, dict(pelvis=pel, inclinacion=gam, barra_kg=barra_kg,
                                     abajo=(xb, zb), arriba=(xt, zt), hombro=hom))


# ---------------------------------------------------------------- prensa 45°

RIEL = math.radians(45)
RESPALDO = math.radians(22)     # respaldo a 22° del suelo
FLEX_CADERA_MAX = 115.0         # más allá la pelvis tiende a despegarse del asiento
FLEX_RODILLA_ABAJO = 90.0
FLEX_RODILLA_ARRIBA = 12.0
PIE_ALTO = 0.17               # centro de la plataforma respecto de la cadera, a lo largo de la plataforma


def prensa(fps=30):
    """Prensa de piernas 45°.

    Reglas: pelvis y espalda fijas al asiento, pies al ancho de caderas en el
    tercio alto de la plataforma, rodillas en la dirección del pie, arriba sin
    bloquear (12° de flexión) y abajo hasta 90° de rodilla siempre que la
    cadera no pase de 115° de flexión.
    """
    pel = np.array([0.0, 0.0, 0.55])
    R = rot_tronco([-math.cos(RESPALDO), 0, math.sin(RESPALDO)],
                   np.array([math.sin(RESPALDO), 0, math.cos(RESPALDO)]))
    r = np.array([math.cos(RIEL), 0, math.sin(RIEL)])    # dirección del riel
    u = np.array([-math.sin(RIEL), 0, math.cos(RIEL)])   # hacia arriba en la plataforma
    y = np.array([0, 1.0, 0])
    centro0 = pel + u * PIE_ALTO

    def pies_a(d):
        plat = centro0 + r * d
        p = {'dorso': -r, 'plataforma': plat}
        for lado, sg in LADOS:
            g = math.radians(10) * sg
            f = u * math.cos(g) + y * math.sin(g)
            medio = plat + y * sg * 0.14
            tob = medio - f * 0.085 - r * M['tobillo']
            p.update({'dir_' + lado: f, 'tobillo_' + lado: tob,
                      'talon_' + lado: tob - f * M['talon'] + r * M['tobillo'],
                      'punta_' + lado: tob + f * M['punta'] + r * M['tobillo']})
        return p

    def armar(d):
        c = Cuadro(0, 0, '')
        colocar_tronco(c, pel, R)
        p = pies_a(d)
        piernas(c, p, polo_extra=np.array([0, 0.15, 0]))
        c.equipo['plataforma'] = p['plataforma']
        c.equipo['trineo'] = d
        return c

    def flex_rodilla(d):
        c = armar(d)
        return 180 - angulo(c.j['cadera_i'] - c.j['rodilla_i'], c.j['tobillo_i'] - c.j['rodilla_i'])

    def flex_cadera(c):
        return angulo(c.j['rodilla_i'] - c.j['cadera_i'], -R[:, 2])

    def d_max():
        # el más lejano que todavía alcanza la pierna
        return max(d for d in np.linspace(0.3, 1.3, 1001)
                   if np.linalg.norm(pies_a(d)['tobillo_i'] - np.array([pel[0], M['cadera'], pel[2]]))
                   < M['muslo'] + M['pierna'] - 1e-4)

    dmx = d_max()
    d_arriba = bisecar(lambda d: flex_rodilla(d) - FLEX_RODILLA_ARRIBA, 0.35, dmx)
    d_abajo = bisecar(lambda d: flex_rodilla(d) - FLEX_RODILLA_ABAJO, 0.20, d_arriba)
    limitado = False
    if flex_cadera(armar(d_abajo)) > FLEX_CADERA_MAX:
        d_abajo = bisecar(lambda d: flex_cadera(armar(d)) - FLEX_CADERA_MAX, d_abajo, d_arriba)
        limitado = True

    manos = {lado: np.array([0.02, sg * 0.31, 0.50]) for lado, sg in LADOS}

    def pose(s):
        d = d_arriba + (d_abajo - d_arriba) * s
        c = armar(d)
        for lado, _ in LADOS:
            c.j['mano_' + lado] = manos[lado]
        brazos(c, np.array([-0.5, 0.3, -1.0]))
        return c

    ritmo = Ritmo(arriba=0.4, bajada=2.0, pausa=0.3, subida=1.2, final=0.4)
    cs = cuadros(ritmo, fps, pose)
    return Ejercicio('leg_press', 'Prensa de piernas 45°', ['quads'], ['glutes', 'hamstrings'],
                     ritmo, cs, dict(pelvis=pel, riel=r, d_arriba=d_arriba, d_abajo=d_abajo,
                                     limitado_por_cadera=limitado, centro0=centro0))


EJERCICIOS = {'squat': sentadilla, 'bench_press': press_banca, 'leg_press': prensa}


# ---------------------------------------------------------------- utilidades

def matriz_segmento(origen, destino, ref):
    """Rotación con z a lo largo del segmento y x hacia su lado anterior."""
    z = unit(destino - origen)
    x = unit(ref - np.dot(ref, z) * z)
    if np.linalg.norm(ref - np.dot(ref, z) * z) < 1e-6:
        x = unit(np.cross(z, [0, 1, 0]))
    return np.column_stack([x, np.cross(z, x), z])


SEGMENTOS = [
    # nombre, articulación de origen, articulación destino
    ('muslo_i', 'cadera_i', 'rodilla_i'), ('muslo_d', 'cadera_d', 'rodilla_d'),
    ('pierna_i', 'rodilla_i', 'tobillo_i'), ('pierna_d', 'rodilla_d', 'tobillo_d'),
    ('brazo_i', 'hombro_i', 'codo_i'), ('brazo_d', 'hombro_d', 'codo_d'),
    ('antebrazo_i', 'codo_i', 'mano_i'), ('antebrazo_d', 'codo_d', 'mano_d'),
]


def poses(c):
    """Origen y rotación de cada pieza rígida del maniquí en un cuadro."""
    out = {'tronco': (c.j['pelvis'], c.tronco)}
    for nombre, a, b in SEGMENTOS:
        out[nombre] = (c.j[a], matriz_segmento(c.j[a], c.j[b], c.ref[nombre]))
    for lado, _ in LADOS:
        f = c.ref['pie_dir_' + lado]
        dorso = c.ref['pie_' + lado]
        z = unit(f)
        x = unit(dorso - np.dot(dorso, z) * z)
        out['pie_' + lado] = (c.j['tobillo_' + lado], np.column_stack([x, np.cross(z, x), z]))
    return out


def centro_de_masa(c, barra_kg=0.0):
    """Centro de masa del cuerpo (y de la barra si se indica)."""
    tot, acc = 0.0, np.zeros(3)

    def add(m, p):
        nonlocal tot, acc
        tot += m
        acc = acc + m * p
    for lado, _ in LADOS:
        for seg, a, b in (('muslo', 'cadera', 'rodilla'), ('pierna', 'rodilla', 'tobillo'),
                          ('brazo', 'hombro', 'codo'), ('antebrazo', 'codo', 'mano')):
            fr, pos = MASAS[seg]
            pa, pb = c.j[f'{a}_{lado}'], c.j[f'{b}_{lado}']
            add(fr * PESO, pa + (pb - pa) * pos)
        fr, pos = MASAS['pie']
        add(fr * PESO, 0.5 * (c.j['talon_' + lado] + c.j['punta_' + lado]) * 0.5 + c.j['tobillo_' + lado] * 0.5)
    fr, _ = MASAS['tronco']
    add(fr * PESO, 0.5 * (c.j['pelvis'] + 0.5 * (c.j['hombro_i'] + c.j['hombro_d'])))
    add(MASAS['cabeza'][0] * PESO, c.j['cabeza'])
    if barra_kg and 'barra' in c.equipo:
        add(barra_kg, c.equipo['barra'])
    return acc / tot


if __name__ == '__main__':
    import sys
    for k in sys.argv[1:] or EJERCICIOS:
        e = EJERCICIOS[k]()
        print(e.nombre, len(e.cuadros), 'cuadros', {a: (np.round(b, 3).tolist() if isinstance(b, np.ndarray) else b)
                                                   for a, b in e.datos.items() if a != 'pies'})
