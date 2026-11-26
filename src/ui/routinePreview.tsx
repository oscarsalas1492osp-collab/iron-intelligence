// Vista previa de una rutina: la figura con los músculos que trabaja, el foco en palabras y cuánto dura.
// Se usa en las tarjetas de Rutinas y Entrenar, en la rutina de hoy del inicio y en el editor.
import { useMemo } from 'react';
import { ago } from '../domain/calc';
import { MUSCLE_LABEL } from '../domain/muscles';
import { focusText, routineMinutes, routineMuscles, routineTones } from '../domain/routineMap';
import type { RoutineItem, Session } from '../domain/types';
import { useExMap, useProfile } from '../hooks';
import { BodyMap } from './BodyMap';
import { cx } from './components';
import { locale } from '../i18n';

export function useRoutineSummary(items: RoutineItem[]) {
  const ex = useExMap(); const coef = useProfile().indirectCoef;
  const key = items.map((i) => `${i.exerciseId}:${i.sets}:${i.superset ?? ''}:${i.restSec}:${i.repMin}:${i.repMax}`).join('|');
  return useMemo(() => {
    const muscles = routineMuscles(items, ex, coef);
    const sets = items.reduce((a, i) => a + i.sets, 0);
    const minutes = routineMinutes(items, ex);
    const n = items.length;
    const meta = !n ? 'Sin ejercicios todavía' : minutes ? `${n} ejercicios, ${sets} series, unos ${minutes} min` : `${n} ejercicios, ${sets} series`;
    const short = !n ? 'Sin ejercicios todavía' : minutes ? `${n} ejercicios, unos ${minutes} min` : `${n} ejercicios`;
    return { muscles, tones: routineTones(muscles), focus: focusText(muscles), minutes, sets, meta, short };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ex, coef]);
}

/** Figura de frente y espalda con lo que trabaja la rutina. Lo no trabajado queda en petróleo oscuro. */
export function RoutineFigure({ summary, className }: { summary: ReturnType<typeof useRoutineSummary>; className?: string }) {
  return (
    <BodyMap tones={summary.tones} base="#26313a" skin="#1b242a" className={className}
      label={summary.focus ? `Músculos que trabaja: ${summary.focus.toLowerCase()}` : 'Rutina sin ejercicios'} />
  );
}

/** Última vez que se terminó esta rutina, si alguna vez se hizo. */
export function lastDone(sessions: Session[] | undefined, routineId: string, now = Date.now()): string | null {
  const s = sessions?.find((x) => x.routineId === routineId && x.status === 'done' && !x.deleted);
  return s ? `Última vez ${ago(s.startedAt, now)}` : null;
}

/** «Lunes y jueves», «Lun, mié y vie» o «Sin día fijo», en el idioma de la app. */
export function daysText(days: number[]): string {
  const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d));
  if (!order.length) return 'Sin día fijo';
  const f = new Intl.DateTimeFormat(locale(), { weekday: order.length <= 2 ? 'long' : 'short' });
  const names = order.map((d) => f.format(new Date(2026, 0, 4 + d)).replace(/\.$/, ''));   // el 4 de enero de 2026 fue domingo
  const t = new Intl.ListFormat(locale(), { type: 'conjunction' }).format(names);
  return t[0].toUpperCase() + t.slice(1);
}

/** Barras de series por músculo, para el editor. Tramo naranja: series directas; tramo apagado: indirectas con su coeficiente. */
export function MuscleBars({ summary, limit = 6 }: { summary: ReturnType<typeof useRoutineSummary>; limit?: number }) {
  const list = summary.muscles.filter((m) => m.score > 0).slice(0, limit);
  const max = Math.max(1, ...list.map((m) => m.score));
  return (
    <ul className="space-y-2">
      {list.map((m) => (
        <li key={m.muscle}>
          <div className="wd-c flex items-baseline justify-between gap-2 text-sm">
            <span className={cx('font-semibold', m.direct ? 'text-chalk' : 'text-mute')}>{MUSCLE_LABEL[m.muscle]}</span>
            <span className="tabular-nums text-mute">{m.direct ? `${m.direct} directas` : `${m.indirect} indirectas`}</span>
          </div>
          <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-card2">
            <div className="h-full bg-fire" style={{ width: `${(m.direct / max) * 100}%` }} />
            <div className="h-full bg-[#7a3a26]" style={{ width: `${((m.score - m.direct) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
