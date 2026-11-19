import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { LIBRARY, patternOf } from '../domain/exerciseLibrary';
import { reshape } from '../ui/bodyModel';
import { figureFor } from '../ui/figurePref';
import { solve } from '../ui/figure/rig';
import { sceneFor, SCENES } from '../ui/figure/scenes';

describe('iconos de ejercicio', () => {
  it('cada ejercicio de la biblioteca tiene patrón y una postura dibujable dentro del icono', () => {
    for (const ex of LIBRARY) {
      expect(patternOf(ex.id), ex.id).toBeTruthy();
      const sc = sceneFor(ex, patternOf(ex.id));
      for (const t of [0, 0.5, 1]) {
        const j = solve(sc.view, sc.a, sc.b, t);
        const pts = [j.hip, j.sh, j.head, ...[...j.arms, ...j.legs].flatMap((l) => [l.a, l.b, l.c])];
        for (const p of pts) {
          expect(Number.isFinite(p[0]) && Number.isFinite(p[1]), `${ex.id} t=${t}`).toBe(true);
          expect(p[0], `${ex.id} t=${t} x`).toBeGreaterThan(1);
          expect(p[0], `${ex.id} t=${t} x`).toBeLessThan(71);
          expect(p[1], `${ex.id} t=${t} y`).toBeGreaterThan(1);
          expect(p[1], `${ex.id} t=${t} y`).toBeLessThan(69);
        }
      }
    }
  });

  it('los patrones más usados tienen postura propia y no caen en la genérica', () => {
    for (const k of ['press_h', 'row', 'squat', 'curl', 'pulldown', 'pullup', 'hinge', 'deadlift', 'legext', 'legcurl', 'hipthrust', 'raise_lat', 'crunch', 'plank', 'carry', 'sled', 'swing']) expect(SCENES[k], k).toBeTruthy();
    const bench = LIBRARY.find((e) => e.id === 'bench_press')!, machine = LIBRARY.find((e) => e.id === 'chest_press_machine')!;
    expect(sceneFor(bench, patternOf(bench.id))).not.toBe(sceneFor(machine, patternOf(machine.id)));
  });

  it('un ejercicio propio recibe una postura según su músculo principal', () => {
    const own = { id: 'x1', primary: 'hamstrings' as const, type: 'isolation' as const, equipment: 'isolation_machine' as const };
    expect(sceneFor(own, undefined)).toBe(SCENES['legcurl@m']);
  });

  it('con las manos fijas en la barra, la mano no se mueve aunque el cuerpo suba', () => {
    const sc = sceneFor(LIBRARY.find((e) => e.id === 'pull_up')!, 'pullup');
    const a = solve(sc.view, sc.a, sc.b, 0).arms[0].c, m = solve(sc.view, sc.a, sc.b, 0.5).arms[0].c, b = solve(sc.view, sc.a, sc.b, 1).arms[0].c;
    expect(Math.hypot(m[0] - b[0], m[1] - b[1])).toBeLessThan(0.2);
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(1.2);
  });
});

describe('figura corporal', () => {
  const at = (x: number, y: number, z: number, f: 'male' | 'female') => reshape(new Vector3(x, y, z), f);
  it('la femenina estrecha hombros y cintura y ensancha la cadera; la masculina ensancha hombros', () => {
    expect(at(0.19, 1.38, 0, 'female').x).toBeLessThan(0.19 * 0.9);
    expect(at(0.12, 1.08, 0, 'female').x).toBeLessThan(0.12 * 0.85);
    expect(at(0.14, 0.9, 0, 'female').x).toBeGreaterThan(0.14 * 1.08);
    expect(at(0.19, 1.38, 0, 'male').x).toBeGreaterThan(0.19 * 1.03);
    expect(at(0.12, 1.08, 0, 'male').x).toBeCloseTo(0.12, 3);
  });
  it('es simétrica y continua en la entrepierna', () => {
    for (const f of ['male', 'female'] as const) {
      const r = at(0.1, 1.2, 0.05, f), l = at(-0.1, 1.2, 0.05, f);
      expect(l.x).toBeCloseTo(-r.x, 6); expect(l.z).toBeCloseTo(r.z, 6);
      expect(at(0.1, 0.8001, 0, f).x - at(0.1, 0.7999, 0, f).x).toBeLessThan(0.002);
    }
  });
  it('sigue al sexo del perfil salvo que se elija a mano', () => {
    expect(figureFor('auto', 'f')).toBe('female');
    expect(figureFor('auto', 'm')).toBe('male');
    expect(figureFor('auto', '')).toBe('male');
    expect(figureFor('auto', 'x')).toBe('male');
    expect(figureFor('female', 'm')).toBe('female');
    expect(figureFor('male', 'f')).toBe('male');
  });
});
