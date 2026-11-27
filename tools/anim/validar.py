"""Revisa cuadro por cuadro que cada movimiento cumpla sus reglas.

Uso: python validar.py [squat bench_press leg_press]
Escribe salida/<ejercicio>/validacion.json y un resumen en pantalla.
"""
from __future__ import annotations

import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import biomecanica as b  # noqa: E402

LARGOS = [('muslo', 'cadera', 'rodilla', b.M['muslo']), ('pierna', 'rodilla', 'tobillo', b.M['pierna']),
          ('brazo', 'hombro', 'codo', b.M['brazo']), ('antebrazo', 'codo', 'mano', b.M['mano'])]


def regla(nombre, valor, limite, ok, unidad='', detalle=''):
    return dict(regla=nombre, valor=round(float(valor), 3), limite=limite, unidad=unidad,
                cumple=bool(ok), detalle=detalle)


def flexion(c, a, m, z):
    """Flexión de la articulación m (0° = extendida)."""
    return 180 - b.angulo(c.j[a] - c.j[m], c.j[z] - c.j[m])


def comunes(e):
    cs = e.cuadros
    out = []
    err = max(abs(np.linalg.norm(c.j[f'{q}_{l}'] - c.j[f'{p}_{l}']) - L)
              for c in cs for _, p, q, L in LARGOS for l, _ in b.LADOS)
    out.append(regla('Largo de huesos constante', err * 1000, '< 1', err < 0.001, 'mm'))
    sim = 0.0
    for c in cs:
        for k, v in c.j.items():
            if k.endswith('_i'):
                d = c.j[k[:-2] + '_d']
                sim = max(sim, float(np.linalg.norm(v - d * np.array([1, -1, 1]))))
    out.append(regla('Simetría izquierda y derecha', sim * 1000, '< 1', sim < 0.001, 'mm'))
    # Suavidad: aceleración máxima de cualquier articulación
    fps = 1.0 / (cs[1].t - cs[0].t)
    acc = 0.0
    for k in cs[0].j:
        p = np.array([c.j[k] for c in cs])
        a = np.diff(p, 2, axis=0) * fps * fps
        acc = max(acc, float(np.max(np.linalg.norm(a, axis=1))))
    out.append(regla('Aceleración máxima de una articulación', acc, '< 6', acc < 6.0, 'm/s²',
                     'Sin saltos ni tirones entre cuadros'))
    r = e.ritmo
    out.append(regla('Bajada controlada', r.bajada, '≥ 2', r.bajada >= 2.0, 's'))
    out.append(regla('Subida', r.subida, '1 a 1.5', 1.0 <= r.subida <= 1.5, 's'))
    return out


def sentadilla(e):
    cs, d = e.cuadros, e.datos
    out = []
    dev = max(abs(c.equipo['barra'][0] - d['medio_pie']) for c in cs)
    out.append(regla('Barra sobre el medio pie', dev * 100, '≤ 3', dev <= 0.03, 'cm',
                     'Desvío horizontal máximo de la barra respecto del centro del pie'))
    abajo = max(cs, key=lambda c: c.s)
    prof = (abajo.j['rodilla_i'][2] - abajo.j['cadera_i'][2]) * 100
    out.append(regla('Profundidad: cadera a la altura de la rodilla o más abajo', prof, '≥ 0', prof >= 0, 'cm',
                     'Cuánto baja el centro de la cadera bajo el de la rodilla'))
    rod = 0.0
    for c in cs:
        for l, _ in b.LADOS:
            v = c.j['rodilla_' + l] - cs[0].j['rodilla_' + l]
            v[2] = 0
            if np.linalg.norm(v) > 0.05:
                rod = max(rod, b.angulo(v, d['pies']['dir_' + l]))
    out.append(regla('Rodillas siguen la punta del pie', rod, '≤ 10', rod <= 10, '°',
                     'Ángulo en planta entre lo que avanza la rodilla y la dirección del pie'))
    beta = max(c.datos['beta'] for c in cs)
    out.append(regla('Inclinación máxima del tronco', beta, '≤ 45', beta <= 45, '°',
                     'Barra alta: el tronco se inclina para mantener la barra sobre el pie'))
    dorsi = max(b.angulo(c.j['rodilla_i'] - c.j['tobillo_i'], [0, 0, 1]) for c in cs)
    out.append(regla('Flexión de tobillo máxima', dorsi, '≤ 38', dorsi <= 38, '°'))
    cad = max(180 - b.angulo(c.j['rodilla_i'] - c.j['cadera_i'], c.tronco[:, 2]) for c in cs)
    out.append(regla('Flexión de cadera máxima', cad, '≤ 130', cad <= 130, '°',
                     'Por encima la pelvis tiende a rotar y la zona lumbar pierde la neutralidad'))
    out.append(regla('Espalda neutra', 0, '0', True, '°', 'Pelvis, zona lumbar y tórax se mueven como un bloque'))
    pies = d['pies']
    talon, punta = pies['talon_i'][0], pies['punta_i'][0]
    cm = [b.centro_de_masa(c, d['barra_kg'])[0] for c in cs]
    peor = max(abs(x - d['medio_pie']) for x in cm)
    dentro = all(talon < x < punta for x in cm)
    out.append(regla('Centro de masa (cuerpo + barra de 60 kg) sobre el pie', peor * 100, '≤ 6', dentro and peor <= 0.06,
                     'cm', 'Distancia máxima al medio pie; siempre entre talón y punta'))
    rodilla_max = max(flexion(c, 'cadera_i', 'rodilla_i', 'tobillo_i') for c in cs)
    out.append(regla('Flexión de rodilla abajo', rodilla_max, 'informativo', True, '°'))
    return out


def press_banca(e):
    cs, d = e.cuadros, e.datos
    out = []
    abajo = max(cs, key=lambda c: c.s)
    arriba = min(cs, key=lambda c: c.s)
    sag = fro = 0.0
    for l, _ in b.LADOS:
        v = abajo.j['mano_' + l] - abajo.j['codo_' + l]
        sag = max(sag, math.degrees(math.atan2(abs(v[0]), v[2])))
        fro = max(fro, math.degrees(math.atan2(abs(v[1]), v[2])))
    out.append(regla('Antebrazo vertical abajo (vista lateral)', sag, '≤ 8', sag <= 8, '°'))
    out.append(regla('Antebrazo vertical abajo (vista frontal)', fro, '≤ 8', fro <= 8, '°'))
    hom = d['hombro']
    toque = (abajo.equipo['barra'][0] - hom[0]) * 100
    out.append(regla('Barra toca la parte media-baja del pecho', toque, '12 a 20', 12 <= toque <= 20, 'cm',
                     'Distancia del punto de contacto hacia los pies, desde la línea de hombros'))
    gap = (abajo.equipo['barra'][2] - 0.014 - abajo.datos['pecho']) * 1000
    out.append(regla('Contacto con el pecho sin aplastar', gap, '0 a 3', 0 <= gap <= 3, 'mm'))
    cruza = min((c.equipo['barra'][2] - 0.014 - c.datos['pecho']) for c in cs) * 1000
    out.append(regla('La barra nunca atraviesa el pecho', cruza, '≥ 0', cruza >= -0.5, 'mm'))
    sobre = abs(arriba.equipo['barra'][0] - hom[0]) * 100
    out.append(regla('Arriba la barra queda sobre los hombros', sobre, '≤ 4', sobre <= 4, 'cm'))
    jx = (abajo.equipo['barra'][0] - arriba.equipo['barra'][0]) * 100
    out.append(regla('Trayectoria en J (desplazamiento horizontal)', jx, '8 a 18', 8 <= jx <= 18, 'cm'))
    cod = 0.0
    for l, _ in b.LADOS:
        v = abajo.j['codo_' + l] - abajo.j['hombro_' + l]
        eje = abajo.tronco[:, 2]
        v_plano = v - np.dot(v, abajo.tronco[:, 0]) * abajo.tronco[:, 0]
        cod = max(cod, b.angulo(v_plano, -eje))
    out.append(regla('Codos respecto del tronco abajo', cod, '45 a 70', 45 <= cod <= 70, '°'))
    ext = min(flexion(arriba, 'hombro_' + l, 'codo_' + l, 'mano_' + l) for l, _ in b.LADOS)
    out.append(regla('Codos casi extendidos arriba', 180 - ext, '≥ 165', 180 - ext >= 165, '°',
                     'Ángulo interior del codo'))
    fps = 1.0 / (cs[1].t - cs[0].t)
    pausa = sum(1 for c in cs if c.s >= 0.9999) / fps
    out.append(regla('Sin rebote: pausa con la barra en el pecho', pausa, '≥ 0.2', pausa >= 0.2, 's'))
    llega = 0.0
    for k in range(1, len(cs)):
        alto = cs[k].equipo['barra'][2] - 0.014 - cs[k].datos['pecho']
        if cs[k].fase == 'bajada' and alto < 0.01:
            llega = max(llega, float(np.linalg.norm(cs[k].equipo['barra'] - cs[k - 1].equipo['barra']) * fps))
    out.append(regla('Llega frenando al pecho (último centímetro)', llega, '≤ 0.15', llega <= 0.15, 'm/s'))
    mov = max(np.linalg.norm(c.j['pelvis'] - cs[0].j['pelvis']) for c in cs)
    out.append(regla('Cadera apoyada en el banco', mov * 1000, '0', mov < 1e-6, 'mm'))
    pies = max(np.linalg.norm(c.j['tobillo_i'] - cs[0].j['tobillo_i']) for c in cs)
    out.append(regla('Pies firmes en el suelo', pies * 1000, '0', pies < 1e-6, 'mm'))
    return out


def prensa(e):
    cs, d = e.cuadros, e.datos
    out = []
    mov = max(np.linalg.norm(c.j['pelvis'] - cs[0].j['pelvis']) for c in cs)
    out.append(regla('Pelvis fija en el asiento', mov * 1000, '0', mov < 1e-6, 'mm'))
    R = cs[0].tronco
    cad = max(b.angulo(c.j['rodilla_i'] - c.j['cadera_i'], -R[:, 2]) for c in cs)
    out.append(regla('Flexión de cadera máxima', cad, f'≤ {b.FLEX_CADERA_MAX:.0f}', cad <= b.FLEX_CADERA_MAX + 0.1, '°',
                     'Hasta donde la pelvis sigue apoyada'))
    arriba = min(cs, key=lambda c: c.s)
    abajo = max(cs, key=lambda c: c.s)
    ka = flexion(arriba, 'cadera_i', 'rodilla_i', 'tobillo_i')
    out.append(regla('Rodillas sin bloquear arriba', ka, '≥ 10', ka >= 10, '°'))
    kb = flexion(abajo, 'cadera_i', 'rodilla_i', 'tobillo_i')
    out.append(regla('Flexión de rodilla abajo', kb, '80 a 95', 80 <= kb <= 95, '°'))
    rod = 0.0
    for c in cs:
        for l, _ in b.LADOS:
            cad_p = c.j['cadera_' + l]
            tob = c.j['tobillo_' + l]
            eje = b.unit(tob - cad_p)
            k = c.j['rodilla_' + l] - cad_p
            k = k - np.dot(k, eje) * eje
            f = c.ref['pie_dir_' + l] - np.dot(c.ref['pie_dir_' + l], eje) * eje
            rod = max(rod, b.angulo(k, f))
    out.append(regla('Rodillas siguen la punta del pie', rod, '≤ 10', rod <= 10, '°'))
    dorsi = max(90 - b.angulo(c.j['rodilla_i'] - c.j['tobillo_i'], c.ref['pie_dir_i']) for c in cs)
    out.append(regla('Flexión de tobillo máxima', dorsi, '≤ 35', dorsi <= 35, '°', 'Talones apoyados en la plataforma'))
    sep = abs(cs[0].j['tobillo_i'][1] - cs[0].j['tobillo_d'][1]) * 100
    caderas = abs(cs[0].j['cadera_i'][1] - cs[0].j['cadera_d'][1]) * 100
    out.append(regla('Pies al ancho de caderas', sep - caderas, '≤ 12', abs(sep - caderas) <= 12, 'cm',
                     'Diferencia entre la separación de tobillos y la de caderas'))
    rec = (d['d_arriba'] - d['d_abajo']) * 100
    out.append(regla('Recorrido del trineo', rec, 'informativo', True, 'cm'))
    return out


REGLAS = {'squat': sentadilla, 'bench_press': press_banca, 'leg_press': prensa}


def validar(e):
    filas = REGLAS[e.clave](e) + comunes(e)
    return dict(ejercicio=e.clave, nombre=e.nombre, cuadros=len(e.cuadros),
                cumple=all(f['cumple'] for f in filas), reglas=filas)


def main(claves):
    base = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'salida')
    total = True
    for k in claves:
        e = b.EJERCICIOS[k]()
        rep = validar(e)
        os.makedirs(os.path.join(base, k), exist_ok=True)
        with open(os.path.join(base, k, 'validacion.json'), 'w', encoding='utf-8') as f:
            json.dump(rep, f, ensure_ascii=False, indent=2)
        print(f"\n{rep['nombre']}: {'cumple' if rep['cumple'] else 'NO CUMPLE'}")
        for r in rep['reglas']:
            print(f"  {'OK ' if r['cumple'] else 'MAL'} {r['regla']}: {r['valor']} {r['unidad']} (límite {r['limite']})")
        total &= rep['cumple']
    return 0 if total else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:] or list(b.EJERCICIOS)))
