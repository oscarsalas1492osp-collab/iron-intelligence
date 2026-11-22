import { describe, expect, it } from 'vitest';
import { answer, makeCtx } from '../domain/assistant';
import { DAY, weekStart } from '../domain/calc';
import { LIBRARY, mergeExercises } from '../domain/exerciseLibrary';
import { fatigueStatus, readinessOf, recentReadiness } from '../domain/recovery';
import type { RecoveryLog } from '../domain/types';
import { exerciseSeries, muscleVolume, personalRecords, rirDistribution, tonnage, topContributors, type ASet } from '../domain/volume';

const ex = new Map(LIBRARY.map((e) => [e.id, e]));
const NOW = new Date(2026, 10, 19, 18).getTime();
let n = 0;
const mk = (exerciseId: string, daysAgo: number, weight: number, reps: number, rir: number | null, sessionId?: string): ASet => ({
  sessionId: sessionId ?? `s${daysAgo}`, exerciseId, date: NOW - daysAgo * DAY, order: n++, weight, reps, rir, failure: rir === 0, endReason: 'none',
});
const log = (date: string, v: Partial<RecoveryLog>): RecoveryLog => ({ id: date, userId: 'local', updatedAt: 0, deleted: 0, dirty: 0, date, sleepHours: 8, sleepQuality: 5, fatigue: 1, soreness: 1, motivation: 5, stress: 1, ...v });

describe('volumen por grupo muscular', () => {
  const sets = [mk('bench_press', 0, 80, 8, 1), mk('bench_press', 0, 80, 8, 1), mk('bench_press', 0, 80, 7, 0), mk('triceps_pushdown', 0, 30, 12, 2)];

  it('cuenta series directas e indirectas por separado y aplica el coeficiente', () => {
    const v = muscleVolume(sets, ex, 0.5);
    const chest = v.find((m) => m.muscle === 'chest')!, tri = v.find((m) => m.muscle === 'triceps')!;
    expect(chest).toMatchObject({ direct: 3, indirect: 0, fractional: 3 });
    expect(tri).toMatchObject({ direct: 1, indirect: 3, fractional: 2.5 });
    expect(v.find((m) => m.muscle === 'quads')!.fractional).toBe(0);
  });
  it('el coeficiente es configurable: 0 ignora las indirectas, 1 las cuenta completas', () => {
    expect(muscleVolume(sets, ex, 0).find((m) => m.muscle === 'triceps')!.fractional).toBe(1);
    expect(muscleVolume(sets, ex, 1).find((m) => m.muscle === 'triceps')!.fractional).toBe(4);
  });
  it('distribución por RIR, tonelaje y contribuyentes', () => {
    const d = rirDistribution([...sets, mk('db_curl', 0, 12, 12, null)]);
    expect(d.find((b) => b.bucket === '0 (fallo)')!.count).toBe(1);
    expect(d.find((b) => b.bucket === '1')!.count).toBe(2);
    expect(d.find((b) => b.bucket === 'Sin RIR')!.count).toBe(1);
    expect(tonnage(sets)).toBe(80 * 23 + 360);
    expect(topContributors(sets, ex, 0.5, 'triceps')[0]).toMatchObject({ id: 'bench_press', sets: 1.5 });
  });
  it('récords y serie temporal por ejercicio', () => {
    const h = [mk('leg_press', 14, 150, 10, 2), mk('leg_press', 7, 160, 10, 2), mk('leg_press', 0, 160, 12, 1)];
    const pr = personalRecords(h, ex)[0];
    expect(pr).toMatchObject({ weight: 160, reps: 12 });
    const series = exerciseSeries(h, 'leg_press');
    expect(series.map((p) => p.maxWeight)).toEqual([150, 160, 160]);
    expect(series[2].e1rm).toBeGreaterThan(series[1].e1rm!);
  });
  it('los ajustes del usuario sobre la biblioteca conservan el id original', () => {
    const merged = mergeExercises([{ ...LIBRARY[0], id: 'row1', baseId: LIBRARY[0].id, increment: 7.5, userId: 'local', updatedAt: 0, deleted: 0, dirty: 0 }]);
    expect(merged.find((e) => e.id === LIBRARY[0].id)!.increment).toBe(7.5);
    expect(merged.length).toBe(LIBRARY.length);
  });
});

describe('recuperación y fatiga', () => {
  it('puntaje alto con buenos registros y bajo con malos', () => {
    expect(readinessOf(log('2026-11-19', {}))).toBe(100);
    expect(readinessOf(log('2026-11-19', { sleepHours: 5, sleepQuality: 1, fatigue: 5, soreness: 5, motivation: 1, stress: 5 }))).toBe(0);
  });
  it('ignora registros antiguos y devuelve null sin datos', () => {
    expect(recentReadiness([log('2026-10-01', {})], NOW)).toBeNull();
    expect(recentReadiness([log('2026-11-18', { fatigue: 5, sleepHours: 5 })], NOW)).toBeLessThan(70);
  });
  it('sin datos no afirma nada; con caída y mala recuperación avisa sin diagnosticar', () => {
    expect(fatigueStatus([], [], NOW).level).toBe('sin_datos');
    const down = [0, 3, 7, 10, 14].flatMap((d, i) => [mk('bench_press', d, 80, 5 + i, 0, `b${d}`), mk('leg_press', d, 150, 6 + i, 0, `l${d}`)]);
    const f = fatigueStatus(down, [log('2026-11-19', { sleepHours: 5, sleepQuality: 1, fatigue: 5, soreness: 5, stress: 5, motivation: 1 })], NOW);
    expect(f.level).toBe('alta');
    expect(f.label).not.toMatch(/sobreentrenamiento/i);
  });
});

describe('asistente', () => {
  const exercises = LIBRARY;
  const ctx = (sets: ASet[]) => makeCtx({ sets, exercises, routines: [], items: [], recovery: [], indirectCoef: 0.5, now: NOW });

  it('sin historial lo dice y no inventa datos', () => {
    expect(answer('¿Estoy progresando en pecho?', ctx([])).title).toMatch(/no hay datos/i);
  });
  it('detecta ejercicios que mejoran y estancados a partir del historial', () => {
    const up = [21, 14, 7, 0].map((d, i) => mk('bench_press', d, 70 + i * 5, 8, 1));
    const flat = [21, 14, 7, 0].map((d) => mk('lat_pulldown', d, 60, 10, 1));
    const c = ctx([...up, ...flat]);
    expect(answer('¿Qué ejercicios están mejorando?', c).lines.join(' ')).toMatch(/Press de banca/);
    const st = answer('¿Qué ejercicios están estancados?', c).lines.join(' ');
    expect(st).toMatch(/Jalón al pecho/);
    expect(st).not.toMatch(/Press de banca con barra: /);
    expect(answer('¿Estoy progresando en pecho?', c).lines[0]).toMatch(/1 de 1/);
  });
  it('responde por volumen, fallo y peso sugerido', () => {
    const sets = [0, 1, 2].flatMap((d) => [mk('bench_press', d, 80, 12, 0), mk('bench_press', d, 80, 12, 0), mk('bench_press', d, 80, 12, 0)]);
    const c = ctx(sets);
    expect(answer('¿En qué grupo muscular tengo menos volumen?', c).lines.length).toBeGreaterThan(2);
    expect(answer('¿Estoy entrenando demasiado cerca del fallo?', c).lines.join(' ')).toMatch(/100 %/);
    // Las mismas preguntas escritas en inglés y en portugués llegan a la misma respuesta.
    const same = (es: string, en: string, pt: string) => { const t = answer(es, c).title; expect([en, answer(en, c).title]).toEqual([en, t]); expect([pt, answer(pt, c).title]).toEqual([pt, t]); };
    same('¿Qué peso debería utilizar hoy?', 'What weight should I use today?', 'Que peso devo usar hoje?');
    same('¿Qué ejercicios están estancados?', 'Which exercises are stalled?', 'Quais exercícios estão estagnados?');
    same('¿Qué ejercicios están mejorando?', 'Which exercises are improving?', 'Quais exercícios estão melhorando?');
    same('¿En qué grupo muscular tengo menos volumen?', 'Which muscle group has my lowest volume?', 'Em que grupo muscular tenho menos volume?');
    same('¿Estoy entrenando demasiado cerca del fallo?', 'Am I training too close to failure?', 'Estou treinando perto demais da falha?');
    same('¿Cuándo debería aumentar la carga?', 'When should I increase the load?', 'Quando devo aumentar a carga?');
    same('¿Cómo ha evolucionado mi fuerza durante el último mes?', 'How has my strength changed over the last month?', 'Como minha força evoluiu no último mês?');
    same('¿Estoy progresando en pecho?', 'Am I progressing on chest?', 'Estou progredindo no peito?');
    expect(answer('¿Qué peso debería utilizar hoy?', c).lines.join(' ')).toMatch(/Press de banca con barra: 80 kg/);
    expect(answer('¿Cuándo debería aumentar la carga?', c).lines[0]).toMatch(/doble progresión/);
    expect(weekStart(NOW)).toBeLessThanOrEqual(NOW);
  });
  it('una pregunta no reconocida ofrece las preguntas disponibles', () => {
    expect(answer('hola', ctx([mk('bench_press', 0, 80, 8, 1)])).lines.length).toBeGreaterThan(3);
  });
});
