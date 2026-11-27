"""Genera la escena 3D de cada ejercicio: modelo, movimiento, archivos y renders.

Aquí (sin pantalla) o en el PC:
    python generar.py --ejercicio squat --cuadro 70           # foto de prueba
    python generar.py --ejercicio squat --animacion           # video de prueba
    blender -b -P generar.py -- --ejercicio squat --final --gpu --animacion

Sin --ejercicio hace los tres. Siempre guarda el .blend, el .glb y la
validación en salida/<ejercicio>/.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)

import bpy  # noqa: E402

import biomecanica as b  # noqa: E402
import escena as es  # noqa: E402
import modelo as mo  # noqa: E402
import validar as va  # noqa: E402


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser()
    p.add_argument('--ejercicio', action='append', choices=list(b.EJERCICIOS))
    p.add_argument('--vista', default='frente', choices=['frente', 'lado'])
    p.add_argument('--formato', default='vertical', choices=['vertical', 'horizontal'])
    p.add_argument('--cuadro', type=int, action='append', help='renderiza ese cuadro como imagen')
    p.add_argument('--animacion', action='store_true', help='renderiza el video completo')
    p.add_argument('--paso', type=int, default=1, help='renderiza uno de cada N cuadros')
    p.add_argument('--final', action='store_true', help='calidad final (1080 x 1920, 256 muestras)')
    p.add_argument('--borrador', action='store_true', help='más rápido que prueba, para revisar movimiento')
    p.add_argument('--gpu', action='store_true', help='usa la tarjeta gráfica (OptiX o CUDA)')
    p.add_argument('--sin-archivos', action='store_true', help='no guarda .blend ni .glb')
    return p.parse_args(argv)


def uno(clave, a):
    t0 = time.time()
    salida = os.path.join(AQUI, 'salida', clave)
    os.makedirs(salida, exist_ok=True)
    e = b.EJERCICIOS[clave]()
    rep = va.validar(e)
    with open(os.path.join(salida, 'validacion.json'), 'w', encoding='utf-8') as f:
        json.dump(rep, f, ensure_ascii=False, indent=2)
    print(f"{e.nombre}: validación {'OK' if rep['cumple'] else 'CON FALLAS'}")

    es.limpiar()
    sc = bpy.context.scene
    sc.name = clave
    mats = mo.materiales()
    es.mundo(mats, -0.008 if clave == 'squat' else 0.0)
    piezas, estado, extra = es.construir(e, mats)
    es.animar(e, piezas, extra, mats)

    ancho, alto = (1080, 1920) if a.formato == 'vertical' else (1920, 1080)
    camaras = {}
    for nombre, v in es.VISTAS[clave].items():
        v = dict(v)
        if a.formato == 'horizontal':
            v['lente'] *= 0.62
        camaras[nombre] = es.camara('camara_' + nombre, v, ancho, alto)
    sc.camera = camaras[a.vista]
    for nombre in es.VISTAS[clave][a.vista].get('ocultar', []):
        raiz = bpy.data.objects[nombre]
        for ob in [raiz] + list(raiz.children_recursive):
            ob.hide_render = True
    v = es.VISTAS[clave]['frente']
    es.luces(v['objetivo'], v['az'])

    calidad = 'final' if a.final else ('borrador' if a.borrador else 'prueba')
    es.ajustes_render(calidad, ancho, alto, gpu=False)
    if a.gpu:
        es.activar_gpu()

    if not a.sin_archivos:
        # El .blend queda listo para render final en la RTX: 1080 x 1920, 256 muestras, GPU.
        es.ajustes_render('final', ancho, alto, gpu=True)
        es.guardar_blend(os.path.join(salida, f'{clave}.blend'))
        es.exportar_glb(os.path.join(salida, f'{clave}.glb'))
        es.ajustes_render(calidad, ancho, alto, gpu=a.gpu)
        if a.gpu:
            es.activar_gpu()

    sufijo = f"{a.vista}{'' if a.formato == 'vertical' else '_h'}"
    for cuadro in a.cuadro or []:
        t = time.time()
        ruta = os.path.join(salida, f'{clave}_{sufijo}_{cuadro:03d}.png')
        es.render_cuadro(ruta, cuadro)
        print('  imagen', ruta, f'{time.time() - t:.1f} s')
    if a.animacion:
        t = time.time()
        mp4 = es.render_animacion(os.path.join(salida, f'cuadros_{sufijo}'),
                                  os.path.join(salida, f'{clave}_{sufijo}{"_final" if a.final else ""}.mp4'), a.paso)
        print('  video', mp4, f'{time.time() - t:.0f} s')
    print(f'  listo en {time.time() - t0:.0f} s; músculos: {estado}')


def main():
    a = args()
    for clave in a.ejercicio or list(b.EJERCICIOS):
        uno(clave, a)


if __name__ == '__main__':
    main()
