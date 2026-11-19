// ASISTENTE DE ENTRENAMIENTO.
//
// Es un motor de análisis determinista: reconoce la intención de la pregunta y responde
// EXCLUSIVAMENTE con cálculos sobre el historial real del usuario. No es un modelo generativo:
// no inventa datos y, cuando no hay información suficiente, lo dice.
import { DAY, e1rm, fmtKg, mean, weekStart } from './calc';
import { MUSCLE_LABEL, findMuscle, norm } from './muscles';
import { ACTION_LABEL, recommend, trendOf, type Trend } from './progression';
import { recentReadiness } from './recovery';
import { DEFAULT_TARGET, type ExerciseDef, type RecoveryLog, type Routine, type RoutineItem, type Target } from './types';
import { inWeek, muscleVolume, sessionsOf, type ASet } from './volume';

export interface AssistantCtx {
  sets: ASet[];
  exercises: ExerciseDef[];
  exMap: Map<string, ExerciseDef>;
  routines: Routine[];
  items: RoutineItem[];
  recovery: RecoveryLog[];
  indirectCoef: number;
  now: number;
}
export interface Answer { title: string; lines: string[]; basis: string }

export const QUICK_QUESTIONS = [
  '¿Qué peso debería utilizar hoy?',
  '¿Qué ejercicios están estancados?',
  '¿Qué ejercicios están mejorando?',
  '¿En qué grupo muscular tengo menos volumen?',
  '¿Estoy entrenando demasiado cerca del fallo?',
  '¿Cuándo debería aumentar la carga?',
  '¿Cómo ha evolucionado mi fuerza durante el último mes?',
  '¿Estoy progresando en pecho?',
];

interface ExTrend { ex: ExerciseDef; trend: Trend; pct: number; sessions: number; lastDate: number }

function trends(ctx: AssistantCtx): ExTrend[] {
  const ids = [...new Set(ctx.sets.map((s) => s.exerciseId))];
  return ids.flatMap((id) => {
    const ex = ctx.exercises.find((e) => e.id === id);
    if (!ex) return [];
    const ss = sessionsOf(ctx.sets, id);
    const best = ss.map((s) => Math.max(0, ...s.sets.map((x) => e1rm(x.weight, x.reps, x.rir) ?? 0)));
    return [{ ex, ...trendOf(best), sessions: ss.length, lastDate: ss[0].date }];
  });
}

const pct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)} %`;
const targetOf = (ctx: AssistantCtx, ex: ExerciseDef): Target => {
  const it = ctx.items.find((i) => i.exerciseId === ex.id);
  return it ? { sets: it.sets, repMin: it.repMin, repMax: it.repMax, rirMin: it.rirMin, rirMax: it.rirMax, restSec: it.restSec } : DEFAULT_TARGET[ex.type];
};
const recFor = (ctx: AssistantCtx, ex: ExerciseDef) =>
  recommend({ exType: ex.type, increment: ex.increment, target: targetOf(ctx, ex), history: sessionsOf(ctx.sets, ex.id), readiness: recentReadiness(ctx.recovery, ctx.now) });

const NO_DATA: Answer = { title: 'Aún no hay datos suficientes', lines: ['Todavía no tienes sesiones completadas. Registra tus entrenamientos y podré responder con tu historial real.'], basis: '0 sesiones registradas' };

export function answer(question: string, ctx: AssistantCtx): Answer {
  const q = norm(question);
  const nSessions = new Set(ctx.sets.map((s) => s.sessionId)).size;
  const basis = `${nSessions} sesiones · ${ctx.sets.length} series registradas`;
  if (ctx.sets.length === 0) return NO_DATA;
  const muscle = findMuscle(q);
  const tr = trends(ctx);

  // ¿Qué peso debería utilizar hoy? / peso para un ejercicio concreto
  if (/(que|cuanto) peso|peso (deberia|uso|usar|hoy)|carga (hoy|uso)/.test(q)) {
    const named = ctx.exercises.find((e) => q.includes(norm(e.name)));
    let list: ExerciseDef[] = [];
    let title = 'Pesos sugeridos';
    if (named) list = [named];
    else {
      const dow = new Date(ctx.now).getDay();
      const routine = ctx.routines.find((r) => r.days.includes(dow)) ?? ctx.routines[0];
      if (routine) {
        title = `Pesos sugeridos · ${routine.name}`;
        list = ctx.items.filter((i) => i.routineId === routine.id).sort((a, b) => a.order - b.order).flatMap((i) => ctx.exercises.find((e) => e.id === i.exerciseId) ?? []);
      } else list = tr.sort((a, b) => b.lastDate - a.lastDate).slice(0, 6).map((t) => t.ex);
    }
    const lines = list.map((ex) => {
      const r = recFor(ctx, ex);
      return r.weight == null ? `${ex.name}: sin historial; empieza con una carga que permita el rango con el RIR objetivo.` : `${ex.name}: ${fmtKg(r.weight)} kg — ${ACTION_LABEL[r.action].toLowerCase()} (confianza ${r.confidenceLabel}).`;
    });
    return { title, lines: lines.length ? lines : ['No hay una rutina con ejercicios para hoy.'], basis };
  }

  // ¿Qué ejercicios están estancados?
  if (/estancad|no progres|no avanz/.test(q)) {
    const st = tr.filter((t) => t.trend === 'stalled' || t.trend === 'declining');
    if (!st.length) return { title: 'Sin estancamientos detectados', lines: [tr.some((t) => t.trend !== 'insufficient') ? 'Ningún ejercicio con 3 o más sesiones muestra estancamiento en su rendimiento estimado.' : 'Se necesitan al menos 3 sesiones por ejercicio para evaluar estancamiento.'], basis };
    return { title: 'Ejercicios estancados o a la baja', lines: st.map((t) => `${t.ex.name}: ${t.trend === 'declining' ? 'a la baja' : 'estancado'} (${pct(t.pct)} en 1RM estimado, ${t.sessions} sesiones). ${recFor(ctx, t.ex).reason}`), basis };
  }

  // ¿Qué ejercicios están mejorando?
  if (/mejorando|mejoran|progresando en que|mejor(es)? ejercicio/.test(q) && !muscle) {
    const up = tr.filter((t) => t.trend === 'improving').sort((a, b) => b.pct - a.pct);
    if (!up.length) return { title: 'Sin mejoras claras todavía', lines: ['Ningún ejercicio con 3 o más sesiones muestra una mejora superior al 2 % en su 1RM estimado.'], basis };
    return { title: 'Ejercicios que están mejorando', lines: up.map((t) => `${t.ex.name}: ${pct(t.pct)} en 1RM estimado (últimas 2 sesiones frente a las anteriores).`), basis };
  }

  // ¿En qué grupo muscular tengo menos volumen?
  if (/menos volumen|poco volumen|menos series|descuidad/.test(q)) {
    const cur = weekStart(ctx.now);
    const weeks = [0, 1, 2, 3].map((i) => muscleVolume(inWeek(ctx.sets, cur - i * 7 * DAY), ctx.exMap, ctx.indirectCoef));
    const avg = weeks[0].map((m, i) => ({ muscle: m.muscle, avg: mean(weeks.map((w) => w[i].fractional)), now: m.fractional }));
    const sorted = [...avg].sort((a, b) => a.avg - b.avg);
    const low = sorted.slice(0, 3);
    return {
      title: 'Grupos con menos volumen',
      lines: [
        ...low.map((m) => `${MUSCLE_LABEL[m.muscle]}: ${m.avg.toFixed(1)} series/semana de media (4 semanas); ${m.now} esta semana.`),
        'Menos volumen no es necesariamente un problema: depende de tus prioridades. Si quieres priorizar alguno, súbelo de forma gradual.',
      ],
      basis: `${basis} · series fraccionales (indirectas × ${ctx.indirectCoef})`,
    };
  }

  // ¿Estoy entrenando demasiado cerca del fallo?
  if (/fallo|rir|demasiado cerca|muy cerca/.test(q)) {
    const recent = ctx.sets.filter((s) => ctx.now - s.date < 28 * DAY && s.rir != null);
    if (recent.length < 6) return { title: 'Faltan registros de RIR', lines: ['Hay menos de 6 series con RIR en las últimas 4 semanas. Registra el RIR de cada serie para poder evaluarlo.'], basis };
    const share = (xs: ASet[]) => (xs.length ? Math.round((xs.filter((s) => (s.rir as number) < 0.75).length / xs.length) * 100) : 0);
    const type = (id: string) => ctx.exercises.find((e) => e.id === id)?.type;
    const comp = recent.filter((s) => type(s.exerciseId) === 'compound');
    const iso = recent.filter((s) => type(s.exerciseId) === 'isolation');
    const avgRir = mean(recent.map((s) => s.rir as number));
    const down = tr.filter((t) => t.trend === 'declining').length;
    const lines = [
      `RIR medio declarado (4 semanas): ${avgRir.toFixed(1)}.`,
      `Series al fallo (RIR 0): ${share(recent)} % en total · ${share(comp)} % en multiarticulares · ${share(iso)} % en monoarticulares.`,
    ];
    if (share(comp) >= 50 && down > 0) lines.push(`Llegas al fallo en la mayoría de las series multiarticulares y ${down} ejercicio(s) van a la baja: es razonable dejar 1–2 RIR en esos ejercicios durante unas semanas.`);
    else if (share(recent) >= 50) lines.push('Más de la mitad de tus series llegan al fallo. La evidencia no muestra que el fallo sea superior a quedarse cerca (1–2 RIR) y sí genera más fatiga; si tu rendimiento se mantiene, no es un problema en sí mismo.');
    else if (avgRir > 3.5) lines.push('En promedio terminas lejos del fallo. Para hipertrofia suele rendir más acercarse (en torno a 0–3 RIR), sobre todo en ejercicios de aislamiento.');
    else lines.push('Tu proximidad al fallo está en una zona razonable para hipertrofia y no hay señales de que esté afectando tu rendimiento.');
    lines.push('Recuerda que el RIR es una estimación: la gente suele equivocarse en torno a 1 repetición.');
    return { title: 'Proximidad al fallo', lines, basis: `${recent.length} series con RIR en 28 días` };
  }

  // ¿Cuándo debería aumentar la carga?
  if (/cuando.*(aument|sub)|subir (la )?carga|aumentar (la )?carga|subir peso/.test(q)) {
    const ready = tr.map((t) => ({ t, r: recFor(ctx, t.ex) })).filter((x) => x.r.action === 'increase');
    return {
      title: 'Cuándo subir la carga',
      lines: [
        'Regla de doble progresión: sube cuando completes el tope del rango de repeticiones en todas las series manteniendo tu RIR objetivo. Si el salto mínimo disponible supera ~10 % de la carga, primero supera el tope en 2 repeticiones.',
        ready.length ? 'Listos para subir en la próxima sesión:' : 'Ahora mismo ningún ejercicio cumple el criterio; sigue sumando repeticiones.',
        ...ready.map((x) => `${x.t.ex.name}: sube a ${fmtKg(x.r.weight ?? 0)} kg.`),
      ],
      basis,
    };
  }

  // ¿Cómo ha evolucionado mi fuerza durante el último mes?
  if (/fuerza|ultimo mes|evolucion/.test(q) && !muscle) {
    const rows = [...new Set(ctx.sets.map((s) => s.exerciseId))].flatMap((id) => {
      const ex = ctx.exercises.find((e) => e.id === id);
      const ss = sessionsOf(ctx.sets, id).filter((s) => ctx.now - s.date < 60 * DAY);
      const best = (xs: typeof ss) => Math.max(0, ...xs.flatMap((s) => s.sets.map((x) => e1rm(x.weight, x.reps, x.rir) ?? 0)));
      const last = best(ss.filter((s) => ctx.now - s.date < 30 * DAY));
      const before = best(ss.filter((s) => ctx.now - s.date >= 30 * DAY));
      return ex && last && before ? [{ name: ex.name, last, before, pct: ((last - before) / before) * 100 }] : [];
    }).sort((a, b) => b.pct - a.pct);
    if (!rows.length) return { title: 'Evolución de fuerza', lines: ['Para comparar se necesitan sesiones del mismo ejercicio en los últimos 30 días y en los 30 anteriores.'], basis };
    return { title: 'Evolución de fuerza (últimos 30 días frente a los 30 anteriores)', lines: [...rows.map((r) => `${r.name}: ${fmtKg(r.before)} → ${fmtKg(r.last)} kg de 1RM estimado (${pct(r.pct)}).`), 'Son estimaciones a partir de peso, repeticiones y RIR; no equivalen a una prueba real de 1RM.'], basis };
  }

  // ¿Estoy progresando en <músculo>?
  if (muscle) {
    const mine = tr.filter((t) => t.ex.primary === muscle);
    if (!mine.length) return { title: `Progreso en ${MUSCLE_LABEL[muscle]}`, lines: [`No hay series registradas de ejercicios cuyo músculo principal sea ${MUSCLE_LABEL[muscle].toLowerCase()}.`], basis };
    const word: Record<Trend, string> = { improving: 'mejorando', stalled: 'estable', declining: 'a la baja', insufficient: 'sin datos suficientes (menos de 3 sesiones)' };
    const cur = weekStart(ctx.now);
    const vol = muscleVolume(inWeek(ctx.sets, cur), ctx.exMap, ctx.indirectCoef).find((m) => m.muscle === muscle)!;
    const up = mine.filter((t) => t.trend === 'improving').length, valid = mine.filter((t) => t.trend !== 'insufficient').length;
    return {
      title: `Progreso en ${MUSCLE_LABEL[muscle]}`,
      lines: [
        valid ? `${up} de ${valid} ejercicios evaluables están mejorando.` : 'Aún no hay ejercicios con 3 o más sesiones para evaluar tendencia.',
        ...mine.map((t) => `${t.ex.name}: ${word[t.trend]}${t.trend !== 'insufficient' ? ` (${pct(t.pct)} en 1RM estimado)` : ''}.`),
        `Volumen esta semana: ${vol.direct} series directas y ${vol.indirect} indirectas, en ${vol.days} día(s).`,
      ],
      basis,
    };
  }

  return { title: 'Puedo responder sobre tu historial', lines: ['Prueba con alguna de estas preguntas:', ...QUICK_QUESTIONS], basis };
}

export function makeCtx(c: Omit<AssistantCtx, 'exMap'>): AssistantCtx {
  return { ...c, exMap: new Map(c.exercises.map((e) => [e.id, e])) };
}
