"""Escena de estudio: luz de marca, cámaras, animación, render y exportación."""
from __future__ import annotations

import math
import os
import shutil
import subprocess

import bpy
import numpy as np
from mathutils import Matrix, Vector

import biomecanica as b
import modelo as mo

FONDO = (0.024, 0.035, 0.078)      # #060914 en sRGB, se convierte a lineal
LLAVE = (1.0, 0.86, 0.74)          # blanco cálido
CONTRA = (0.157, 0.373, 1.0)       # #285fff
RELLENO = (0.70, 0.78, 1.0)

# Vistas: objetivo, azimut (0° = de frente al cuerpo, +90° = lado izquierdo),
# altura de cámara, distancia y lente.
VISTAS = {
    'squat': {
        'frente': dict(objetivo=(0.05, 0, 0.88), az=14, alto=1.15, dist=3.5, lente=40),
        'lado': dict(objetivo=(0.02, 0, 0.88), az=62, alto=1.30, dist=3.4, lente=40, ocultar=['rack']),
    },
    'bench_press': {
        'frente': dict(objetivo=(0.12, 0, 0.68), az=38, alto=1.70, dist=3.0, lente=40),
        'lado': dict(objetivo=(0.15, 0, 0.72), az=88, alto=1.20, dist=3.2, lente=40),
    },
    'leg_press': {
        'frente': dict(objetivo=(0.10, 0, 0.80), az=128, alto=2.10, dist=3.6, lente=36),
        'lado': dict(objetivo=(0.10, 0, 0.86), az=90, alto=1.20, dist=4.3, lente=36),
    },
}
# El frente del cuerpo: hacia +X en sentadilla; en banca y prensa la cámara se
# ubica hacia los pies (+X) igual.


def limpiar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'


def mundo(mats, z_suelo=0.0):
    sc = bpy.context.scene
    w = bpy.data.worlds.new('mundo')
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (*mo.srgb(FONDO), 1)
    bg.inputs['Strength'].default_value = 0.35
    suelo = mo.caja('suelo', (0, 0, z_suelo - 0.01), (40, 40, 0.02), mats['suelo'], bisel=0)
    return suelo


def luz(nombre, pos, objetivo, color, potencia, tam):
    ld = bpy.data.lights.new(nombre, 'AREA')
    ld.energy = potencia
    ld.color = color
    ld.shape = 'DISK'
    ld.size = tam
    ob = bpy.data.objects.new(nombre, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = pos
    d = Vector(objetivo) - Vector(pos)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return ob


def esfera_dir(objetivo, az, elev, dist):
    a, e = math.radians(az), math.radians(elev)
    o = Vector(objetivo)
    return o + Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e))) * dist


def luces(objetivo, az_cam):
    luz('llave', esfera_dir(objetivo, az_cam + 42, 50, 3.6), objetivo, LLAVE, 300, 2.0)
    luz('relleno', esfera_dir(objetivo, az_cam - 70, 14, 4.2), objetivo, RELLENO, 45, 3.5)
    luz('contra', esfera_dir(objetivo, az_cam + 160, 30, 3.4), objetivo, CONTRA, 420, 1.4)
    luz('contra_2', esfera_dir(objetivo, az_cam - 155, 22, 3.6), objetivo, CONTRA, 200, 1.2)


def camara(nombre, v, ancho, alto):
    cd = bpy.data.cameras.new(nombre)
    cd.lens = v['lente']
    cd.sensor_fit = 'AUTO'
    cd.sensor_width = 36
    ob = bpy.data.objects.new(nombre, cd)
    bpy.context.scene.collection.objects.link(ob)
    o = Vector(v['objetivo'])
    a = math.radians(v['az'])
    plano = math.sqrt(max(v['dist'] ** 2 - (v['alto'] - o.z) ** 2, 0.1))
    ob.location = (o.x + math.cos(a) * plano, o.y + math.sin(a) * plano, v['alto'])
    ob.rotation_euler = (o - ob.location).to_track_quat('-Z', 'Y').to_euler()
    return ob


def construir(e, mats):
    """Arma el maniquí y los equipos del ejercicio; devuelve lo que se anima."""
    piezas, estado = mo.maniqui(mats, e.principal, e.secundarios)
    extra = {}
    if e.clave == 'squat':
        zs = [c.equipo['barra'][2] for c in e.cuadros]
        mo.rack(mats, -0.58, 0.64, 0.60, max(zs) - 0.07, min(zs) - 0.075)
        extra['barra'] = mo.barra(mats, 1)
    elif e.clave == 'bench_press':
        mo.banco(mats)
        extra['barra'] = mo.barra(mats, 1)
    elif e.clave == 'leg_press':
        _, extra['trineo'] = mo.prensa(mats, e.datos)
    return piezas, estado, extra


def animar(e, piezas, extra, mats):
    sc = bpy.context.scene
    sc.render.fps = 30
    sc.frame_start, sc.frame_end = 1, len(e.cuadros)
    for ob in piezas.values():
        ob.rotation_mode = 'QUATERNION'
    previo = {}
    em = mats['principal'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength']
    em2 = mats['secundario'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength']
    for k, c in enumerate(e.cuadros, start=1):
        for nombre, (o, R) in b.poses(c).items():
            ob = piezas[nombre]
            q = Matrix(R.tolist()).to_quaternion()
            if nombre in previo and previo[nombre].dot(q) < 0:
                q.negate()
            previo[nombre] = q
            ob.location = Vector(o)
            ob.rotation_quaternion = q
            ob.keyframe_insert('location', frame=k)
            ob.keyframe_insert('rotation_quaternion', frame=k)
        if 'barra' in extra:
            extra['barra'].location = Vector(c.equipo['barra'])
            extra['barra'].keyframe_insert('location', frame=k)
        if 'trineo' in extra:
            extra['trineo'].location = Vector(c.equipo['plataforma'])
            extra['trineo'].keyframe_insert('location', frame=k)
        em.default_value = 1.6 + 4.4 * c.esfuerzo
        em.keyframe_insert('default_value', frame=k)
        em2.default_value = 0.3 + 0.7 * c.esfuerzo
        em2.keyframe_insert('default_value', frame=k)


def ajustes_render(calidad, ancho=1080, alto=1920, gpu=False):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    r = sc.render
    cy = sc.cycles
    if calidad == 'final':
        r.resolution_x, r.resolution_y, r.resolution_percentage = ancho, alto, 100
        cy.samples = 256
        cy.adaptive_threshold = 0.01
        r.use_motion_blur = True
        r.motion_blur_shutter = 0.4
    else:
        r.resolution_x, r.resolution_y = ancho, alto
        r.resolution_percentage = 50
        cy.samples = 24 if calidad == 'prueba' else 10
        cy.adaptive_threshold = 0.05
        r.use_motion_blur = False
    cy.use_denoising = True
    cy.denoiser = 'OPENIMAGEDENOISE'
    cy.max_bounces = 6
    cy.glossy_bounces = 3
    cy.transparent_max_bounces = 4
    r.use_persistent_data = True
    cy.device = 'GPU' if gpu else 'CPU'
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Punchy'
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_depth = '8'
    r.film_transparent = False


def activar_gpu():
    """En el PC con RTX: usa OptiX con todas las tarjetas disponibles."""
    try:
        pref = bpy.context.preferences.addons['cycles'].preferences
    except KeyError:
        return False
    for tipo in ('OPTIX', 'CUDA'):
        try:
            pref.compute_device_type = tipo
        except TypeError:
            continue
        pref.get_devices()
        gpus = [d for d in pref.devices if d.type == tipo]
        if gpus:
            for d in pref.devices:
                d.use = d.type == tipo
            bpy.context.scene.cycles.device = 'GPU'
            bpy.context.scene.cycles.denoising_use_gpu = True
            print('Render con', tipo, ':', ', '.join(d.name for d in gpus))
            return True
    print('Sin GPU compatible: render con CPU')
    return False


def render_cuadro(ruta, cuadro):
    sc = bpy.context.scene
    sc.frame_set(cuadro)
    sc.render.filepath = ruta
    bpy.ops.render.render(write_still=True)


def render_animacion(carpeta, mp4, paso=1):
    """Renderiza los cuadros como PNG y, si hay ffmpeg, arma el MP4."""
    sc = bpy.context.scene
    if os.path.isdir(carpeta):
        shutil.rmtree(carpeta)
    os.makedirs(carpeta)
    sc.frame_step = paso
    sc.render.filepath = os.path.join(carpeta, '')
    bpy.ops.render.render(animation=True)
    sc.frame_step = 1
    # numeración continua (sirve también en Windows, donde ffmpeg no acepta comodines)
    pngs = sorted(f for f in os.listdir(carpeta) if f.endswith('.png'))
    for i, f in enumerate(pngs, start=1):
        os.replace(os.path.join(carpeta, f), os.path.join(carpeta, f'f_{i:04d}.png'))
    if not shutil.which('ffmpeg'):
        print('  sin ffmpeg: quedan los cuadros PNG en', carpeta)
        return None
    tmp = mp4[:-4] + '.tmp.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(sc.render.fps / paso),
                    '-i', os.path.join(carpeta, 'f_%04d.png'), '-c:v', 'libx264', '-preset', 'veryfast',
                    '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmp], check=True)
    os.replace(tmp, mp4)
    return mp4


def exportar_glb(ruta):
    bpy.ops.export_scene.gltf(filepath=ruta, export_format='GLB', export_animations=True,
                              export_apply=True, export_cameras=False, export_lights=False,
                              export_force_sampling=True, export_animation_mode='SCENE')


def guardar_blend(ruta):
    sc = bpy.context.scene
    previo = sc.render.filepath
    sc.render.filepath = '//cuadros/'    # al renderizar desde Blender, junto al .blend
    bpy.ops.wm.save_as_mainfile(filepath=ruta, compress=True, copy=True)
    sc.render.filepath = previo
