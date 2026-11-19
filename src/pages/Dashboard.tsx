import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../data/db';
import { elapsedMs, mine, startSession } from '../data/repo';
import { ago, DAY, fmtDate, fmtDuration, fmtKg, weekStart } from '../domain/calc';
import { LEGEND, weekHeat } from '../domain/heat';
import { MAIN_MUSCLES, MUSCLE_LABEL } from '../domain/muscles';
import { fatigueStatus, LEVEL_COLOR } from '../domain/recovery';
import type { Muscle } from '../domain/types';
import { inWeek, mainSets, muscleVolume, personalRecords, tonnage } from '../domain/volume';
import { useActiveSession, useAllItems, useDoneSets, useExMap, useNow, useProfile, useRoutines, useSessions, useUserId } from '../hooks';
import { BodyFigure } from '../ui/BodyFigure';
import { Btn, Icon, Spark, useAction } from '../ui/components';
import { Logo } from '../ui/Layout';

const hello = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'; };
const pctDelta = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
const signed = (n: number) => `${n > 0 ? '+' : ''}${n} %`;

/** Fila de una lista con filetes: rótulo, valor y un dato a la derecha. */
function Row({ label, children, right, onClick }: { label: string; children: ReactNode; right?: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className="flex w-full items-center gap-4 py-3.5 text-left">
      <div className="min-w-0 flex-1">
        <div className="label">{label}</div>
        <div className="mt-0.5 truncate font-semibold">{children}</div>
      </div>
      {right}
      {onClick && <Icon name="right" size={16} className="shrink-0 text-mute" />}
    </Tag>
  );
}

function WeekFigure({ label, value, note, good }: { label: string; value: ReactNode; note?: string; good?: boolean }) {
  return (
    <div>
      <div className="num text-[1.6rem] leading-none">{value}</div>
      <div className="label mt-1">{label}</div>
      {note && <div className="wd-c text-xs" style={{ color: good ? '#3ddc84' : '#9299a3' }}>{note}</div>}
    </div>
  );
}

export default function Dashboard() {
  const uid = useUserId(); const nav = useNavigate(); const run = useAction();
  const profile = useProfile(); const routines = useRoutines() ?? []; const items = useAllItems() ?? [];
  const active = useActiveSession(); const sessions = (useSessions() ?? []).filter((s) => s.status === 'done');
  const sets = useDoneSets() ?? []; const ex = useExMap();
  const weights = useLiveQuery(async () => mine(await db.bodyWeights.toArray()).sort((a, b) => a.date.localeCompare(b.date)), [uid]) ?? [];
  const logs = useLiveQuery(async () => mine(await db.recovery.toArray()), [uid]) ?? [];
  const now = useNow(60000);
  const [sel, setSel] = useState<Muscle | null>(null);

  const dow = new Date(now).getDay();
  const todayRoutine = routines.find((r) => r.days.includes(dow));
  const todayItems = todayRoutine ? items.filter((i) => i.routineId === todayRoutine.id) : [];
  const last = sessions[0];
  const start = weekStart(now);
  const week = useMemo(() => inWeek(sets, start), [sets, start]);
  const prevWeek = useMemo(() => inWeek(sets, start - 7 * DAY), [sets, start]);
  const vol = useMemo(() => muscleVolume(week, ex, profile.indirectCoef), [week, ex, profile.indirectCoef]);
  const heat = useMemo(() => weekHeat(week, ex, profile.indirectCoef, now), [week, ex, profile.indirectCoef, now]);
  const prs = useMemo(() => personalRecords(sets, ex).filter((p) => now - p.date < 30 * DAY).slice(0, 3), [sets, ex, now]);
  const fatigue = useMemo(() => fatigueStatus(sets, logs, now), [sets, logs, now]);

  const trained = vol.filter((v) => v.direct > 0);
  const pending = vol.filter((v) => v.fractional === 0 && MAIN_MUSCLES.includes(v.muscle));
  const bw = weights[weights.length - 1];
  const nWeek = mainSets(week).length;
  const dSets = pctDelta(nWeek, mainSets(prevWeek).length), dTon = pctDelta(tonnage(week), tonnage(prevWeek));
  const selVol = sel ? vol.find((v) => v.muscle === sel) : null;

  const begin = async () => {
    if (active) return nav('/entrenar');
    if (todayRoutine && todayItems.length) { if (await run(() => startSession(todayRoutine.id))) nav('/entrenar'); } else nav('/entrenar');
  };

  const heading = active ? active.name : todayRoutine ? todayRoutine.name : routines.length ? 'Hoy no hay rutina programada' : 'Crea tu primera rutina';
  const detail = active ? `Entrenamiento en curso, ${fmtDuration(elapsedMs(active, now))} transcurridos. Tu sesión está guardada.`
    : todayRoutine ? `Programada para hoy: ${todayItems.length} ejercicios, ${todayItems.reduce((a, i) => a + i.sets, 0)} series.`
    : routines.length ? 'Puedes iniciar cualquier rutina o un entrenamiento libre.' : 'Parte de una plantilla o arma la tuya.';

  return (
    <div>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-4 md:hidden"><Logo /></div>
          <p className="wd-c text-[15px] text-mute first-letter:uppercase">{new Date(now).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="wd-x text-[1.6rem] font-extrabold leading-[1.1] tracking-tight md:text-[1.9rem]" style={{ textWrap: 'balance' }}>{hello()}{profile.name ? `, ${profile.name}` : ''}</h1>
        </div>
        <Link to="/perfil" aria-label="Perfil" className="wd-x grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card2 text-lg font-extrabold">{profile.name ? profile.name[0].toUpperCase() : <Icon name="user" />}</Link>
      </header>

      <div className="grid grid-cols-1 gap-x-12 gap-y-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:[grid-template-areas:'today_figure''list_figure'] md:[grid-template-rows:auto_1fr]">
        <section className="rounded-panel bg-card p-5 md:[grid-area:today]">
          <h2 className="wd-x text-2xl font-extrabold leading-tight">{heading}</h2>
          <p className="mt-1 text-[15px] text-mute">{detail}</p>
          <Btn variant="primary" size="lg" className="mt-5 w-full" onClick={() => (routines.length || active ? begin() : nav('/rutinas'))}>
            {active ? 'CONTINUAR ENTRENAMIENTO' : routines.length ? 'INICIAR ENTRENAMIENTO' : 'CREAR RUTINA'}
          </Btn>
        </section>

        <section className="md:[grid-area:figure]" aria-label="Grupos musculares de la semana">
          <div className="relative h-[360px] md:h-[600px]">
            <BodyFigure tones={heat.tones} selected={sel} onSelect={(m) => setSel(sel === m ? null : m)} className="absolute inset-0" />
            <div className="pointer-events-none absolute left-0 top-1 space-y-4">
              <WeekFigure label="sesiones" value={new Set(week.map((s) => s.sessionId)).size} note={`de ${profile.daysAvailable} días`} />
              <WeekFigure label="series" value={nWeek} note={dSets != null ? `${signed(dSets)} vs. anterior` : undefined} good={dSets != null && dSets > 0} />
              <WeekFigure label="toneladas" value={(tonnage(week) / 1000).toFixed(1).replace('.', ',')} note={dTon != null ? `${signed(dTon)} vs. anterior` : undefined} good={dTon != null && dTon > 0} />
            </div>
            <ul className="wd-c pointer-events-none absolute right-0 top-1 space-y-1.5 text-xs text-mute">
              {([['reciente', 'Últimas 48 h'], ['semana', 'Esta semana'], ['pendiente', 'Pendiente']] as const).map(([k, t]) => (
                <li key={k} className="flex items-center justify-end gap-2">{t}<span className="h-2.5 w-2.5 rounded-full" style={{ background: LEGEND[k] }} /></li>
              ))}
            </ul>
          </div>
          <p className="mt-2 min-h-[2.5rem] text-sm text-mute" aria-live="polite">
            {selVol ? <><b className="text-chalk">{MUSCLE_LABEL[selVol.muscle]}:</b> {selVol.direct} series directas y {selVol.indirect} indirectas esta semana, en {selVol.days} día{selVol.days === 1 ? '' : 's'}. <Link to="/analisis" className="text-data underline">Ver análisis</Link></>
              : trained.length ? <><b className="text-chalk">Trabajados:</b> {trained.map((v) => `${MUSCLE_LABEL[v.muscle]} (${v.direct})`).join(', ')}. <b className="text-chalk">Pendientes:</b> {pending.length ? pending.map((v) => MUSCLE_LABEL[v.muscle]).join(', ') : 'ninguno'}.</>
              : 'Aún no hay grupos trabajados esta semana. El color muestra qué entrenaste: más claro, más series.'}
          </p>
        </section>

        <section className="md:[grid-area:list]">
          <div className="ruled border-t border-line">
            <Row label="Última sesión" onClick={last ? () => nav(`/historial?s=${last.id}`) : undefined}
              right={last && <span className="wd-c shrink-0 text-sm text-fire">{ago(last.endedAt ?? last.startedAt, now)}</span>}>
              {last ? <>{last.name} <span className="wd-c font-normal text-mute">{fmtDate(last.startedAt)}, {fmtDuration(elapsedMs(last))}</span></> : <span className="font-normal text-mute">Aún no has completado ninguna sesión.</span>}
            </Row>
            <Row label="Fatiga y recuperación" onClick={() => nav('/recuperacion')}
              right={<span className="num shrink-0 text-xl" style={{ color: LEVEL_COLOR[fatigue.level] }}>{fatigue.readiness ?? '–'}</span>}>
              <span style={{ color: LEVEL_COLOR[fatigue.level] }}>{fatigue.label}</span>
            </Row>
            <Row label="Peso corporal" onClick={() => nav('/recuperacion')} right={<Spark values={weights.slice(-20).map((w) => w.kg)} width={84} height={28} />}>
              {bw ? <>{fmtKg(bw.kg)} kg <span className="wd-c font-normal text-mute">{weights.length > 1 ? `${bw.kg - weights[0].kg >= 0 ? '+' : ''}${(bw.kg - weights[0].kg).toFixed(1)} kg desde ${weights[0].date}` : bw.date}</span></> : <span className="font-normal text-mute">Sin registros. Toca para añadir tu peso.</span>}
            </Row>
            <Row label="Asistente" onClick={() => nav('/asistente')}>¿Qué peso uso hoy? ¿Qué está estancado?</Row>
          </div>

          <div className="mb-3 flex items-baseline justify-between gap-3 border-t border-line pt-5">
            <h2 className="wd-w text-[15px] font-bold">Récords de los últimos 30 días</h2>
            <Link to="/historial" className="wd-c text-sm text-data">Ver historial</Link>
          </div>
          {prs.length ? (
            <ul className="space-y-2.5">
              {prs.map((p) => (
                <li key={p.exerciseId} className="flex items-baseline gap-3">
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="num shrink-0 text-go">{fmtKg(p.weight)} kg × {p.reps}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-mute">Tus mejores marcas aparecerán aquí.</p>}
        </section>
      </div>
    </div>
  );
}
