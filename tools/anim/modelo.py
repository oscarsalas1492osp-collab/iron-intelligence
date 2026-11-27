"""Maniquí de placas y equipos, construidos con código en Blender.

El maniquí no imita un cuerpo real: es un cuerpo de acero con placas por grupo
muscular (los mismos 18 grupos de la app). Las placas de los músculos que
trabaja el ejercicio se encienden en brasa; las secundarias, en un tono más
bajo. Los equipos son genéricos, con medidas reales y sin marca.
"""
from __future__ import annotations

import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import biomecanica as b

# ---------------------------------------------------------------- materiales

PALETA = dict(
    cuerpo=((0.150, 0.185, 0.285), 0.35, 0.42),
    articulacion=((0.050, 0.062, 0.100), 0.75, 0.30),
    placa=((0.110, 0.135, 0.215), 0.45, 0.42),
    visor=((0.015, 0.020, 0.040), 0.10, 0.08),
    cromo=((0.800, 0.815, 0.850), 1.00, 0.16),
    moleteado=((0.620, 0.640, 0.680), 1.00, 0.45),
    marco=((0.060, 0.075, 0.120), 0.65, 0.38),
    tapiz=((0.022, 0.026, 0.042), 0.00, 0.72),
    disco=((0.026, 0.029, 0.036), 0.25, 0.55),
    goma=((0.018, 0.020, 0.026), 0.00, 0.85),
    suelo=((0.012, 0.016, 0.030), 0.00, 0.55),
    tarima=((0.020, 0.024, 0.040), 0.00, 0.80),
)
BRASA = (1.0, 0.416, 0.102)       # #ff6a1a
BRASA_BAJA = (0.42, 0.20, 0.14)   # #6b3324, el tono secundario de la app


def srgb(c):
    """Color sRGB a lineal (Blender trabaja en lineal)."""
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def material(nombre, color, metal, rugosidad, emision=None, fuerza=0.0):
    m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1.0)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rugosidad
    if emision:
        p.inputs['Emission Color'].default_value = (*emision, 1.0)
        p.inputs['Emission Strength'].default_value = fuerza
    m.diffuse_color = (*color, 1.0)   # color en vista sólida
    return m


def materiales():
    out = {k: material(k, c, mt, r) for k, (c, mt, r) in PALETA.items()}
    out['principal'] = material('musculo_principal', srgb(BRASA), 0.1, 0.35, srgb(BRASA), 3.0)
    out['secundario'] = material('musculo_secundario', srgb(BRASA_BAJA), 0.3, 0.45, srgb(BRASA_BAJA), 0.6)
    out['principal'].diffuse_color = (*srgb(BRASA), 1)
    out['secundario'].diffuse_color = (*srgb(BRASA_BAJA), 1)
    return out


# ---------------------------------------------------------------- mallas

def objeto(nombre, verts, caras, mat=None, suave=True, padre=None):
    me = bpy.data.meshes.new(nombre)
    me.from_pydata([tuple(map(float, v)) for v in verts], [], caras)
    me.validate()
    me.update()
    if suave:
        me.shade_smooth()
    ob = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(ob)
    if mat is not None:
        me.materials.append(mat)
    if padre is not None:
        ob.parent = padre
    return ob


def _interp(secciones, z):
    zs = [s[0] for s in secciones]
    return [float(np.interp(z, zs, [s[k] for s in secciones])) for k in (1, 2, 3)]


def _punto(xmin, xmax, yh, th, n, extra=0.0):
    c, s = math.cos(th), math.sin(th)
    cx, rx = 0.5 * (xmin + xmax), 0.5 * (xmax - xmin)
    x = math.copysign(abs(c) ** (2 / n), c) * rx
    y = math.copysign(abs(s) ** (2 / n), s) * yh
    if extra:
        r = math.hypot(x, y) or 1.0
        x, y = x * (1 + extra / r), y * (1 + extra / r)
    return cx + x, y


def loft(nombre, secciones, n=2.4, lados=36, mat=None, padre=None, pasos=None):
    """Sólido de secciones superelípticas a lo largo de z.

    secciones: lista de (z, x mínimo, x máximo, medio ancho en y).
    """
    zs = [s[0] for s in secciones]
    if pasos:
        zs = list(np.linspace(zs[0], zs[-1], pasos))
    verts, caras = [], []
    for z in zs:
        xmin, xmax, yh = _interp(secciones, z)
        for k in range(lados):
            x, y = _punto(xmin, xmax, yh, 2 * math.pi * k / lados, n)
            verts.append((x, y, z))
    for i in range(len(zs) - 1):
        for k in range(lados):
            a, bb = i * lados + k, i * lados + (k + 1) % lados
            caras.append((a, bb, bb + lados, a + lados))
    for extremo, sentido in ((0, -1), (len(zs) - 1, 1)):
        xmin, xmax, _ = _interp(secciones, zs[extremo])
        verts.append((0.5 * (xmin + xmax), 0.0, zs[extremo]))
        c = len(verts) - 1
        base = extremo * lados
        for k in range(lados):
            a, bb = base + k, base + (k + 1) % lados
            caras.append((a, bb, c) if sentido > 0 else (bb, a, c))
    return objeto(nombre, verts, caras, mat, padre=padre)


def placa(nombre, secciones, z0, z1, a0, a1, n=2.4, mat=None, padre=None, grosor=0.007):
    """Placa muscular: una porción de la superficie, separada 3 mm."""
    zs = np.linspace(z0, z1, max(4, int((z1 - z0) / 0.012)))
    ths = np.radians(np.linspace(a0, a1, max(4, int(abs(a1 - a0) / 6))))
    verts, caras = [], []
    for z in zs:
        xmin, xmax, yh = _interp(secciones, z)
        for th in ths:
            x, y = _punto(xmin, xmax, yh, th, n, extra=0.003)
            verts.append((x, y, z))
    m = len(ths)
    for i in range(len(zs) - 1):
        for k in range(m - 1):
            a = i * m + k
            caras.append((a, a + 1, a + 1 + m, a + m))
    ob = objeto(nombre, verts, caras, mat, padre=padre)
    s = ob.modifiers.new('grosor', 'SOLIDIFY')
    s.thickness = grosor
    s.offset = 1.0
    s.use_even_offset = True
    bv = ob.modifiers.new('borde', 'BEVEL')
    bv.width = 0.002
    bv.segments = 2
    bv.limit_method = 'ANGLE'
    return ob


def esfera(nombre, centro, radios, mat=None, padre=None, seg=28):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1.0)
    bmesh.ops.scale(bm, vec=Vector(radios), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(centro), verts=bm.verts)
    return _de_bmesh(nombre, bm, mat, padre)


def cilindro(nombre, p0, p1, r, mat=None, padre=None, seg=40, r2=None, tapas=True):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=tapas, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=d.length)
    rot = d.normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((p0 + p1) / 2) @ rot, verts=bm.verts)
    return _de_bmesh(nombre, bm, mat, padre)


def caja(nombre, centro, tam, mat=None, padre=None, rot=None, bisel=0.006):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(tam), verts=bm.verts)
    m = Matrix.Translation(Vector(centro))
    if rot is not None:
        m = m @ rot.to_4x4()
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    ob = _de_bmesh(nombre, bm, mat, padre, suave=False)
    if bisel:
        bv = ob.modifiers.new('bisel', 'BEVEL')
        bv.width = bisel
        bv.segments = 3
    return ob


def _de_bmesh(nombre, bm, mat, padre, suave=True):
    me = bpy.data.meshes.new(nombre)
    bm.to_mesh(me)
    bm.free()
    if suave:
        me.shade_smooth()
    ob = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(ob)
    if mat is not None:
        me.materials.append(mat)
    if padre is not None:
        ob.parent = padre
    return ob


def vacio(nombre, padre=None):
    ob = bpy.data.objects.new(nombre, None)
    ob.empty_display_size = 0.1
    bpy.context.scene.collection.objects.link(ob)
    if padre is not None:
        ob.parent = padre
    return ob


# ---------------------------------------------------------------- maniquí

TRONCO = [(z, -esp, fr, ancho) for z, ancho, fr, esp in b.PERFIL_TRONCO]
MUSLO = [(0.0, -0.088, 0.085, 0.085), (0.06, -0.090, 0.088, 0.082), (0.20, -0.080, 0.078, 0.072),
         (0.34, -0.064, 0.064, 0.060), (b.M['muslo'], -0.050, 0.052, 0.052)]
PIERNA = [(0.0, -0.052, 0.050, 0.050), (0.08, -0.064, 0.048, 0.050), (0.16, -0.062, 0.044, 0.046),
          (0.30, -0.042, 0.036, 0.036), (b.M['pierna'], -0.030, 0.030, 0.030)]
BRAZO = [(0.0, -0.052, 0.052, 0.050), (0.10, -0.050, 0.050, 0.044), (0.22, -0.044, 0.046, 0.040),
         (b.M['brazo'], -0.036, 0.036, 0.038)]
ANTEBRAZO = [(0.0, -0.040, 0.040, 0.040), (0.07, -0.044, 0.044, 0.042), (0.18, -0.032, 0.032, 0.034),
             (b.M['antebrazo'], -0.022, 0.022, 0.030)]
PIE = [(-b.M['talon'], -b.M['tobillo'], -0.012, 0.032), (0.0, -b.M['tobillo'], 0.022, 0.040),
       (0.09, -b.M['tobillo'], -0.020, 0.047), (0.18, -b.M['tobillo'], -0.048, 0.046),
       (b.M['punta'], -b.M['tobillo'], -0.058, 0.030)]
CUELLO = [(0.53, -0.105, 0.010, 0.052), (0.58, -0.085, 0.015, 0.048), (0.64, -0.070, 0.035, 0.050)]

# Placas: segmento, grupo de la app, z inicial y final, ángulo inicial y final.
# Ángulo 0 = frente, +90 = hacia la línea media del cuerpo, 180 = atrás.
# En el tronco +90 es la izquierda.
PLACAS = [
    ('tronco', 'chest', 0.365, 0.485, 10, 70), ('tronco', 'chest', 0.365, 0.485, -70, -10),
    ('tronco', 'abs', 0.215, 0.315, -28, -3), ('tronco', 'abs', 0.215, 0.315, 3, 28),
    ('tronco', 'abs', 0.11, 0.205, -28, -3), ('tronco', 'abs', 0.11, 0.205, 3, 28),
    ('tronco', 'abs', 0.02, 0.10, -26, -3), ('tronco', 'abs', 0.02, 0.10, 3, 26),
    ('tronco', 'obliques', 0.05, 0.30, 38, 82), ('tronco', 'obliques', 0.05, 0.30, -82, -38),
    ('tronco', 'lowerback', 0.10, 0.27, 155, 205),
    ('tronco', 'back', 0.27, 0.44, 112, 172), ('tronco', 'back', 0.27, 0.44, 188, 248),
    ('tronco', 'traps', 0.445, 0.545, 140, 220),
    ('tronco', 'glutes', -0.055, 0.085, 118, 176), ('tronco', 'glutes', -0.055, 0.085, 184, 242),
    ('tronco', 'abductors', -0.03, 0.09, 82, 112), ('tronco', 'abductors', -0.03, 0.09, -112, -82),
    ('muslo', 'quads', 0.07, 0.37, -62, 52), ('muslo', 'hamstrings', 0.08, 0.36, 128, 238),
    ('muslo', 'adductors', 0.04, 0.26, 62, 118),
    ('pierna', 'tibialis', 0.05, 0.30, -58, -8), ('pierna', 'calves', 0.04, 0.24, 118, 242),
    ('brazo', 'shoulders', -0.005, 0.12, -195, 45), ('brazo', 'biceps', 0.13, 0.29, -48, 48),
    ('brazo', 'triceps', 0.07, 0.29, 132, 228),
    ('antebrazo', 'forearms', 0.02, 0.19, -70, 70), ('antebrazo', 'forearms', 0.02, 0.19, 110, 250),
    ('cuello', 'neck', 0.545, 0.62, -60, 60),
]
SECCIONES = dict(tronco=TRONCO, muslo=MUSLO, pierna=PIERNA, brazo=BRAZO, antebrazo=ANTEBRAZO, cuello=CUELLO)
FORMA = dict(tronco=2.7, muslo=2.3, pierna=2.3, brazo=2.2, antebrazo=2.2, cuello=2.2)


def maniqui(mats, principal, secundarios):
    """Devuelve las piezas rígidas que se animan: tronco, muslos, piernas, pies, brazos y antebrazos."""
    piezas = {}
    estado = {}

    def mat_de(grupo):
        if grupo in principal:
            estado[grupo] = 'principal'
            return mats['principal']
        if grupo in secundarios:
            estado[grupo] = 'secundario'
            return mats['secundario']
        return mats['placa']

    t = loft('tronco', TRONCO, n=FORMA['tronco'], lados=48, mat=mats['cuerpo'], pasos=40)
    piezas['tronco'] = t
    loft('cuello', CUELLO, n=2.2, mat=mats['cuerpo'], padre=t)
    cab = b.TRONCO['cabeza']
    esfera('cabeza', cab, (0.098, 0.080, 0.112), mats['cuerpo'], t)
    # visor: franja oscura al frente, da dirección a la mirada
    esfera('visor', cab + np.array([0.022, 0, 0.012]), (0.084, 0.070, 0.045), mats['visor'], t)
    for lado, sg in b.LADOS:
        esfera('cadera_' + lado, (0, sg * b.M['cadera'], 0), (0.072, 0.072, 0.072), mats['articulacion'], t)

    for nombre, sec in (('muslo', MUSLO), ('pierna', PIERNA), ('brazo', BRAZO), ('antebrazo', ANTEBRAZO)):
        for lado, _ in b.LADOS:
            piezas[f'{nombre}_{lado}'] = loft(f'{nombre}_{lado}', sec, n=FORMA[nombre], mat=mats['cuerpo'], pasos=24)
    for lado, _ in b.LADOS:
        pie = loft('pie_' + lado, PIE, n=3.0, lados=32, mat=mats['articulacion'], pasos=20)
        piezas['pie_' + lado] = pie
        esfera('tobillo_art_' + lado, (0, 0, 0), (0.036,) * 3, mats['articulacion'], pie)
        esfera('rodilla_art_' + lado, (0, 0, 0), (0.054,) * 3, mats['articulacion'], piezas['pierna_' + lado])
        esfera('hombro_art_' + lado, (0, 0, 0), (0.060,) * 3, mats['articulacion'], piezas['brazo_' + lado])
        esfera('codo_art_' + lado, (0, 0, 0), (0.043,) * 3, mats['articulacion'], piezas['antebrazo_' + lado])
        ab = piezas['antebrazo_' + lado]
        esfera('muneca_' + lado, (0, 0, b.M['antebrazo']), (0.028,) * 3, mats['articulacion'], ab)
        esfera('mano_' + lado, (0.004, 0, b.M['antebrazo'] + 0.045), (0.046, 0.052, 0.058), mats['cuerpo'], ab)

    for seg, grupo, z0, z1, a0, a1 in PLACAS:
        sec, n = SECCIONES[seg], FORMA[seg]
        if seg in ('tronco', 'cuello'):
            placa(f'{grupo}_{seg}_{a0}', sec, z0, z1, a0, a1, n, mat_de(grupo), piezas['tronco'])
            continue
        for lado, sg in b.LADOS:
            # En las extremidades el eje y local apunta a la línea media en la
            # izquierda y hacia afuera en la derecha: se espeja el ángulo.
            aa, bb = (a0, a1) if sg > 0 else (-a1, -a0)
            placa(f'{grupo}_{seg}_{lado}_{a0}', sec, z0, z1, aa, bb, n, mat_de(grupo), piezas[f'{seg}_{lado}'])
    return piezas, estado


# ---------------------------------------------------------------- equipos

def disco_malla(radio=0.225, grosor=0.045):
    """Disco de hierro con tres agarres, como el ícono de la marca."""
    if 'disco_20' in bpy.data.meshes:
        return bpy.data.meshes['disco_20']
    h = grosor / 2
    perfil = [(0.026, -h + 0.004), (0.026, h - 0.004), (0.055, h - 0.004), (0.062, h), (0.078, h),
              (0.084, h - 0.012), (0.185, h - 0.012), (0.196, h), (radio - 0.004, h), (radio, h - 0.004),
              (radio, -h + 0.004), (radio - 0.004, -h), (0.196, -h), (0.185, -h + 0.012),
              (0.084, -h + 0.012), (0.078, -h), (0.062, -h), (0.055, -h + 0.004)]
    bm = bmesh.new()
    vs = [bm.verts.new((r, 0.0, z)) for r, z in perfil]
    es = [bm.edges.new((vs[i], vs[(i + 1) % len(vs)])) for i in range(len(vs))]
    bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 0, 1), angle=2 * math.pi, steps=96,
                   use_merge=True, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    me = bpy.data.meshes.new('disco_base')
    bm.to_mesh(me)
    bm.free()
    base = bpy.data.objects.new('disco_base', me)
    bpy.context.scene.collection.objects.link(base)
    # tres agarres: ranuras redondeadas restadas con booleanos
    cortes = []
    for k in range(3):
        a = math.radians(90 + 120 * k)
        c = cilindro(f'corte_{k}', (0, 0, -0.05), (0, 0, 0.05), 0.028, seg=32)
        c.scale = (1.0, 2.1, 1.0)
        c.rotation_euler = (0, 0, a)
        c.location = (0.135 * math.cos(a), 0.135 * math.sin(a), 0)
        cortes.append(c)
        mod = base.modifiers.new(f'agarre_{k}', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.object = c
        mod.solver = 'EXACT'
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    malla = bpy.data.meshes.new_from_object(base.evaluated_get(dg))
    malla.name = 'disco_20'
    malla.shade_smooth()
    if hasattr(malla, 'set_sharp_from_angle'):
        malla.set_sharp_from_angle(angle=math.radians(40))
    for ob in [base] + cortes:
        bpy.data.objects.remove(ob)
    return malla


def disco(nombre, centro, eje, mats, padre=None):
    """eje: 'x' o 'y', dirección del agujero."""
    me = disco_malla()
    if len(me.materials) == 0:
        me.materials.append(mats['disco'])
    elif me.materials[0] is None:
        me.materials[0] = mats['disco']
    ob = bpy.data.objects.new(nombre, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = centro
    ob.rotation_euler = (math.pi / 2, 0, 0) if eje == 'y' else (0, math.pi / 2, 0)
    if padre is not None:
        ob.parent = padre
    return ob


def barra(mats, discos_por_lado=1):
    """Barra olímpica de 2,2 m y 20 kg, a lo largo de y, con origen en su centro."""
    raiz = vacio('barra')
    cilindro('barra_eje', (0, -0.655, 0), (0, 0.655, 0), 0.014, mats['cromo'], raiz)
    for sg in (1, -1):
        cilindro(f'moleteado_{sg}', (0, sg * 0.06, 0), (0, sg * 0.43, 0), 0.0143, mats['moleteado'], raiz)
        cilindro(f'collar_{sg}', (0, sg * 0.655, 0), (0, sg * 0.685, 0), 0.036, mats['cromo'], raiz)
        cilindro(f'manga_{sg}', (0, sg * 0.685, 0), (0, sg * 1.10, 0), 0.025, mats['cromo'], raiz)
        y = 0.69
        for k in range(discos_por_lado):
            disco(f'disco_{sg}_{k}', (0, sg * (y + 0.0225), 0), 'y', mats, raiz)
            y += 0.047
        cilindro(f'seguro_{sg}', (0, sg * y, 0), (0, sg * (y + 0.035), 0), 0.034, mats['marco'], raiz)
    return raiz


def tubo(nombre, p0, p1, mats, lado=0.075, padre=None):
    """Tubo cuadrado entre dos puntos."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    rot = d.normalized().to_track_quat('Z', 'Y').to_matrix()
    return caja(nombre, (p0 + p1) / 2, (lado, lado, d.length), mats['marco'], padre, rot, bisel=0.008)


def rack(mats, x_atras, x_frente, ancho, alto_ganchos, alto_seguros):
    """Jaula de sentadilla genérica: cuatro parantes, ganchos y barras de seguridad."""
    raiz = vacio('rack')
    alto = 2.25
    for x in (x_atras, x_frente):
        for sg in (1, -1):
            tubo(f'parante_{x:.2f}_{sg}', (x, sg * ancho, 0.0), (x, sg * ancho, alto), mats, padre=raiz)
            for k in range(int(alto / 0.08)):   # perforaciones
                z = 0.30 + k * 0.05
                if z > alto - 0.1:
                    break
                caja('perf', (x - 0.038, sg * ancho, z), (0.004, 0.02, 0.02), mats['goma'], raiz, bisel=0)
    for sg in (1, -1):
        tubo(f'base_{sg}', (x_atras, sg * ancho, 0.04), (x_frente, sg * ancho, 0.04), mats, padre=raiz)
        tubo(f'techo_{sg}', (x_atras, sg * ancho, alto), (x_frente, sg * ancho, alto), mats, padre=raiz)
        # barra de seguridad por dentro de los parantes
        tubo(f'seguro_{sg}', (x_atras - 0.04, sg * (ancho - 0.07), alto_seguros),
             (x_frente + 0.04, sg * (ancho - 0.07), alto_seguros), mats, lado=0.05, padre=raiz)
        # gancho J en los parantes delanteros
        caja(f'gancho_{sg}', (x_frente - 0.06, sg * (ancho - 0.06), alto_ganchos), (0.12, 0.05, 0.03),
             mats['marco'], raiz)
        caja(f'gancho_tope_{sg}', (x_frente - 0.115, sg * (ancho - 0.06), alto_ganchos + 0.03), (0.02, 0.05, 0.05),
             mats['goma'], raiz)
    for x in (x_atras, x_frente):
        tubo(f'travesano_{x:.2f}', (x, -ancho, alto), (x, ancho, alto), mats, padre=raiz)
    tubo('base_atras', (x_atras, -ancho, 0.04), (x_atras, ancho, 0.04), mats, padre=raiz)
    caja('tarima', (0.5 * (x_atras + x_frente), 0, -0.004), (2.6, 2.4, 0.008), mats['tarima'], raiz, bisel=0.003)
    return raiz


def banco(mats, x0=-0.42, x1=0.78, alto=b.BANCO_ALTO, soportes=True, gancho_z=1.04):
    """Banco plano con soportes para press."""
    raiz = vacio('banco')
    caja('colchoneta', ((x0 + x1) / 2, 0, alto - 0.03), (x1 - x0, 0.29, 0.06), mats['tapiz'], raiz, bisel=0.018)
    caja('base_colchoneta', ((x0 + x1) / 2, 0, alto - 0.075), (x1 - x0 - 0.06, 0.20, 0.03), mats['marco'], raiz)
    tubo('viga', (x0 + 0.08, 0, alto - 0.11), (x1 - 0.08, 0, alto - 0.11), mats, lado=0.07, padre=raiz)
    for x in (x0 + 0.14, x1 - 0.12):
        tubo(f'pata_{x:.2f}', (x, 0, 0.04), (x, 0, alto - 0.11), mats, lado=0.07, padre=raiz)
        tubo(f'pie_{x:.2f}', (x, -0.25, 0.035), (x, 0.25, 0.035), mats, lado=0.07, padre=raiz)
        for sg in (1, -1):
            caja(f'taco_{x:.2f}_{sg}', (x, sg * 0.25, 0.01), (0.08, 0.06, 0.02), mats['goma'], raiz, bisel=0.004)
    if soportes:
        xs = -0.20
        for sg in (1, -1):
            tubo(f'soporte_{sg}', (xs, sg * 0.56, 0.03), (xs, sg * 0.56, 1.30), mats, padre=raiz)
            tubo(f'soporte_pie_{sg}', (xs - 0.30, sg * 0.56, 0.035), (xs + 0.30, sg * 0.56, 0.035), mats, padre=raiz)
            caja(f'soporte_gancho_{sg}', (xs + 0.06, sg * 0.56, gancho_z), (0.12, 0.05, 0.03), mats['marco'], raiz)
            caja(f'soporte_tope_{sg}', (xs + 0.115, sg * 0.56, gancho_z + 0.03), (0.02, 0.05, 0.05), mats['goma'], raiz)
        tubo('soporte_union', (xs - 0.06, -0.56, 0.035), (xs - 0.06, 0.56, 0.035), mats, padre=raiz)
        tubo('soporte_banco', (xs + 0.04, 0, 0.035), (x0 + 0.14, 0, 0.035), mats, lado=0.07, padre=raiz)
    return raiz


def prensa(mats, datos):
    """Prensa 45°: base, rieles, asiento reclinado y trineo con plataforma."""
    raiz = vacio('prensa')
    pel = datos['pelvis']
    r = Vector(datos['riel'])
    u = Vector((-r.z, 0, r.x))
    c0 = Vector(datos['centro0'])
    R = Matrix(b.rot_tronco([-math.cos(b.RESPALDO), 0, math.sin(b.RESPALDO)],
                            np.array([math.sin(b.RESPALDO), 0, math.cos(b.RESPALDO)])).tolist())
    P = Vector(pel)

    def en_tronco(x, y, z):
        return P + R @ Vector((x, y, z))

    # respaldo y cabezal (apoyados en la espalda del maniquí)
    esp = max(p[3] for p in b.PERFIL_TRONCO[1:8])
    caja('respaldo', en_tronco(-esp - 0.035, 0, 0.36), (0.07, 0.40, 0.86), mats['tapiz'], raiz, R, bisel=0.02)
    caja('cabezal', en_tronco(-0.13, 0, 0.74), (0.07, 0.26, 0.20), mats['tapiz'], raiz, R, bisel=0.02)
    caja('respaldo_base', en_tronco(-esp - 0.09, 0, 0.36), (0.04, 0.30, 0.80), mats['marco'], raiz, R)
    # asiento bajo los glúteos
    asiento = R @ Matrix.Rotation(math.radians(-60), 3, 'Y')
    caja('asiento', en_tronco(-0.04, 0, -0.15), (0.07, 0.40, 0.30), mats['tapiz'], raiz, asiento, bisel=0.02)
    # base al suelo
    for sg in (1, -1):
        tubo(f'base_{sg}', (-1.05, sg * 0.42, 0.04), (1.55, sg * 0.42, 0.04), mats, padre=raiz)
    for x in (-1.05, -0.2, 0.7, 1.55):
        tubo(f'base_x_{x}', (x, -0.42, 0.04), (x, 0.42, 0.04), mats, padre=raiz)
    # patas del asiento
    pie_resp = en_tronco(-esp - 0.09, 0, 0.70)
    for sg in (1, -1):
        tubo(f'pata_resp_{sg}', (pie_resp.x, sg * 0.15, 0.04), (pie_resp.x, sg * 0.15, pie_resp.z), mats, padre=raiz)
        tubo(f'pata_asiento_{sg}', (P.x - 0.05, sg * 0.15, 0.04), (P.x - 0.05, sg * 0.15, P.z - 0.18), mats, padre=raiz)
        # agarraderas
        mano = Vector((0.02, sg * 0.31, 0.50))
        cilindro(f'manilla_{sg}', mano - Vector((0.08, 0, 0)), mano + Vector((0.08, 0, 0)), 0.016, mats['goma'], raiz)
        tubo(f'manilla_pata_{sg}', (0.10, sg * 0.31, 0.04), (0.10, sg * 0.31, 0.50), mats, lado=0.045, padre=raiz)
    # rieles: pasan bajo el trineo
    off = -u * 0.40 + r * 0.10
    for sg in (1, -1):
        a = c0 + r * 0.30 + off + Vector((0, sg * 0.30, 0))
        bb = c0 + r * 1.55 + off + Vector((0, sg * 0.30, 0))
        cilindro(f'riel_{sg}', a, bb, 0.022, mats['cromo'], raiz)
        tubo(f'riel_base_{sg}', a + Vector((0, 0, -0.06)), bb + Vector((0, 0, -0.06)), mats, lado=0.08, padre=raiz)
        # postes del riel
        for t in (0.45, 1.5):
            p = c0 + r * t + off + Vector((0, sg * 0.30, -0.06))
            tubo(f'poste_{t}_{sg}', (p.x, p.y, 0.04), (p.x, p.y, p.z), mats, padre=raiz)
        # topes de seguridad
        tope = c0 + r * (datos['d_abajo'] - 0.08) + off + Vector((0, sg * 0.30, 0.04))
        caja(f'tope_{sg}', tope, (0.06, 0.06, 0.06), mats['goma'], raiz)
    # trineo: se mueve a lo largo de r; origen en el centro de la plataforma
    tri = vacio('trineo')
    rot_pl = Matrix((u, Vector((0, 1, 0)), r)).transposed()   # columnas: u, y, r
    caja('plataforma', (0, 0, 0.0), (0.62, 0.70, 0.03), mats['marco'], tri, rot_pl, bisel=0.008)
    caja('plataforma_goma', -r * 0.017, (0.58, 0.66, 0.006), mats['goma'], tri, rot_pl, bisel=0.002)
    caja('trineo_cuerpo', r * 0.10 - u * 0.30, (0.42, 0.66, 0.16), mats['marco'], tri, rot_pl, bisel=0.01)
    for sg in (1, -1):
        for k, t in enumerate((-0.32, 0.05)):
            # bloques que corren por el riel
            p = off + r * (0.10 + t * 0) + u * 0.0 + Vector((0, sg * 0.30, 0)) + r * t
            caja(f'carro_{sg}_{k}', p, (0.08, 0.07, 0.12), mats['marco'], tri, rot_pl)
        # cuernos para discos, horizontales hacia afuera
        base_c = r * 0.12 - u * 0.46
        cilindro(f'cuerno_{sg}', base_c + Vector((0, sg * 0.33, 0)), base_c + Vector((0, sg * 0.62, 0)), 0.025,
                 mats['cromo'], tri)
        for k in range(2):
            disco(f'disco_prensa_{sg}_{k}', base_c + Vector((0, sg * (0.37 + k * 0.047), 0)), 'y', mats, tri)
    tri.parent = raiz
    return raiz, tri
