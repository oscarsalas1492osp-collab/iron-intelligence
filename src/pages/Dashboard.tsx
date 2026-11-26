import { IosInstallHint, WeekExtras } from '../ui/extras';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../data/db';
import { elapsedMs, mine, startSession, updateSettings } from '../data/repo';
import { ago, DAY, fmtDate, fmtDuration, fmtKg, weekStart } from '../domain/calc';
import { LEGEND, weekHeat } from '../domain/heat';
import { MAIN_MUSCLES, MUSCLE_LABEL } from '../domain/muscles';
import { fatigueStatus, LEVEL_COLOR } from '../domain/recovery';
import type { Muscle } from '../domain/types';
import { inWeek, mainSets, muscleVolume, personalRecords, tonnage } from '../domain/volume';
import { useActiveSession, useAllItems, useDoneSets, useExMap, useNow, useProfile, useRoutines, useSessions, useUserId } from '../hooks';
import { BodyFigure } from '../ui/BodyFigure';
import { RoutineFigure, useRoutineSummary } from '../ui/routinePreview';
import { Btn, Icon, Ring, Spark, useAction } from '../ui/components';
import { ExerciseThumb } from '../ui/EquipmentArt';
import { Logo } from '../ui/Layout';
import { Welcome } from '../ui/welcome';
import { locale } from '../i18n';

const hello = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'; };
const pctDelta = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
const signed = (n: number) => `${n > 0 ? '+' : ''}${n} %`;

/** Acceso rápido: un panel de vidrio con su icono, el dato y a dónde lleva. */
function Tile({ icon, tone, label, children, right, onClick }: { icon: string; tone: string; label: string; children: ReactNode; right?: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className="flex min-h-[132px] w-full flex-col rounded-panel bg-card p-4 text-left transition active:scale-[.98]">
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ background: `${tone}24`, color: tone }}><Icon name={icon} size={20} /></span>
        {right}
      </div>
      <div className="label mt-auto pt-3">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold leading-snug">{children}</div>
    </Tag>
  );
}

function RingStat({ value, max, color, figure, label, note, good }: { value: number; max: number; color: string; figure: ReactNode; label: string; note?: string; good?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <Ring value={value} max={max} color={color}><span className="num text-[1.35rem] leading-none">{figure}</span></Ring>
      <div className="label mt-2">{label}</div>
      {note && <div className="wd-c truncate text-xs" style={{ color: good ? '#34e0a1' : '#93a4ab' }}>{note}</div>}
    </div>
  );
}

export default function Dashboard() {
  const uid = useUserId(); const nav = useNavigate(); const run = useAction();
  const profile = useProfile(); const routinesRaw = useRoutines(); const routines = routinesRaw ?? []; const items = useAllItems() ?? [];
  const active = useActiveSession(); const sessionsRaw = useSessions(); const sessions = (sessionsRaw ?? []).filter((s) => s.status === 'done');
  // Bienvenida: solo con la app recién abierta, sin rutinas ni sesiones, y hasta que se usa o se salta.
  const nueva = !!routinesRaw && !!sessionsRaw && !routinesRaw.length && !sessionsRaw.length && !active && !profile.settings?.welcomed;
  const sets = useDoneSets() ?? []; const ex = useExMap();
  const weights = useLiveQuery(async () => mine(await db.bodyWeights.toArray()).sort((a, b) => a.date.localeCompare(b.date)), [uid]) ?? [];
  const logs = useLiveQuery(async () => mine(await db.recovery.toArray()), [uid]) ?? [];
  const now = useNow(60000);
  const [sel, setSel] = useState<Muscle | null>(null);

  const dow = new Date(now).getDay();
  const todayRoutine = routines.find((r) => r.days.includes(dow));
  const todayItems = todayRoutine ? items.filter((i) => i.routineId === todayRoutine.id) : [];
  const todaySum = useRoutineSummary(todayItems);
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
    : todayRoutine ? `${todaySum.meta}.`
    : routines.length ? 'Puedes iniciar cualquier rutina o un entrenamiento libre.' : 'Parte de una plantilla o arma la tuya.';

  const nSessions = new Set(week.map((x) => x.sessionId)).size;
  const prevSets = mainSets(prevWeek).length, ton = tonnage(week), prevTon = tonnage(prevWeek);
  const todayEx = todayItems.slice().sort((a, b) => a.order - b.order).map((i) => ex.get(i.exerciseId)).filter((e): e is NonNullable<typeof e> => !!e);

  return (
    <div>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-5 md:hidden"><Logo /></div>
          <p className="wd-c text-[15px] text-mute first-letter:uppercase">{new Date(now).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="wd-x text-[1.75rem] font-extrabold leading-[1.08] tracking-tight md:text-[2rem]" style={{ textWrap: 'balance' }}>{hello()}{profile.name ? `, ${profile.name}` : ''}</h1>
        </div>
        <Link to="/perfil" aria-label="Perfil" className="wd-x grid h-12 w-12 shrink-0 place-items-center rounded-full bg-card2 text-lg font-extrabold">{profile.name ? profile.name[0].toUpperCase() : <Icon name="user" />}</Link>
      </header>

      <IosInstallHint />
      {nueva && <Welcome onSkip={() => { void updateSettings({ welcomed: true }); nav('/rutinas'); }} />}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-x-8 md:[grid-template-areas:'today_figure''week_figure''list_figure'] md:[grid-template-rows:auto_auto_1fr]">
        <section className="hero rounded-[28px] p-5 md:[grid-area:today]">
          <div className="relative z-[1]">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="wd-c text-sm font-semibold text-amber">{active ? 'En curso' : todayRoutine ? 'Rutina de hoy' : routines.length ? 'Día libre' : 'Para empezar'}</p>
                <h2 className="wd-x mt-1 text-[1.7rem] font-extrabold leading-[1.05]">{heading}</h2>
                {!active && todaySum.focus && <p className="wd-c mt-1.5 text-[15px] font-semibold text-chalk">{todaySum.focus}</p>}
                <p className="mt-1 text-[15px] text-chalk/75">{detail}</p>
              </div>
              {!active && todayRoutine && todaySum.focus && <RoutineFigure summary={todaySum} className="-mr-1 mt-1 h-[112px] w-[88px] shrink-0" />}
            </div>
            {!active && todayEx.length > 0 && (
              <div className="mt-4 flex items-center" aria-hidden>
                {todayEx.slice(0, 5).map((e, i) => <span key={e.id} className="rounded-2xl ring-2 ring-[#2b1a10]" style={{ marginLeft: i ? -10 : 0, zIndex: 9 - i }}><ExerciseThumb ex={e} size={46} /></span>)}
                {todayEx.length > 5 && <span className="wd-c ml-2 text-sm font-semibold text-chalk/75">+{todayEx.length - 5}</span>}
              </div>
            )}
            <Btn variant={nueva ? 'soft' : 'primary'} size="lg" className="mt-5 w-full" icon={active || routines.length ? 'play' : 'plus'} onClick={() => (routines.length || active ? begin() : nav('/rutinas'))}>
              {active ? 'CONTINUAR ENTRENAMIENTO' : routines.length ? 'INICIAR ENTRENAMIENTO' : 'CREAR RUTINA'}
            </Btn>
          </div>
        </section>

        <section className="rounded-panel bg-card p-4 md:[grid-area:week]" aria-label="Resumen de la semana">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="wd-w text-[15px] font-bold">Esta semana</h2>
            <Link to="/analisis" className="hit wd-c inline-block text-sm text-data">Ver análisis</Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <RingStat value={nSessions} max={profile.daysAvailable} color="#ff6a1a" figure={nSessions} label="sesiones" note={`de ${profile.daysAvailable} días`} />
            <RingStat value={nWeek} max={prevSets || nWeek || 1} color="#ffb054" figure={nWeek} label="series" note={dSets != null ? `${signed(dSets)} vs. anterior` : undefined} good={dSets != null && dSets > 0} />
            <RingStat value={ton} max={prevTon || ton || 1} color="#58c7ff" figure={(ton / 1000).toFixed(1).replace('.', ',')} label="toneladas" note={dTon != null ? `${signed(dTon)} vs. anterior` : undefined} good={dTon != null && dTon > 0} />
          </div>
          <WeekExtras />
        </section>

        <section className="rounded-panel bg-card p-4 md:[grid-area:figure]" aria-label="Grupos musculares de la semana">
          <h2 className="wd-w text-[15px] font-bold">Mapa muscular</h2>
          <ul className="wd-c mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
            {([['reciente', 'Últimas 48 h'], ['semana', 'Esta semana'], ['pendiente', 'Pendiente']] as const).map(([k, t]) => (
              <li key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: LEGEND[k] }} />{t}</li>
            ))}
          </ul>
          <div className="relative mt-2 h-[340px] md:h-[560px]">
            <BodyFigure tones={heat.tones} selected={sel} onSelect={(m) => setSel(sel === m ? null : m)} className="absolute inset-0" />
          </div>
          <p className="mt-2 min-h-[2.5rem] text-sm text-mute" aria-live="polite">
            {selVol ? <><b className="text-chalk">{MUSCLE_LABEL[selVol.muscle]}:</b> {selVol.direct} series directas y {selVol.indirect} indirectas esta semana, en {selVol.days} día{selVol.days === 1 ? '' : 's'}. <Link to="/analisis" className="text-data underline">Ver análisis</Link></>
              : trained.length ? <><b className="text-chalk">Trabajados:</b> {trained.map((v) => `${MUSCLE_LABEL[v.muscle]} (${v.direct})`).join(', ')}. <b className="text-chalk">Pendientes:</b> {pending.length ? pending.map((v) => MUSCLE_LABEL[v.muscle]).join(', ') : 'ninguno'}.</>
              : 'Aún no hay grupos trabajados esta semana. El color muestra qué entrenaste: más claro, más series.'}
          </p>
        </section>

        <section className="space-y-4 md:[grid-area:list]">
          <div className="grid grid-cols-2 gap-3">
            <Tile icon="calendar" tone="#ff6a1a" label="Última sesión" onClick={last ? () => nav(`/historial?s=${last.id}`) : undefined}
              right={last && <span className="wd-c shrink-0 text-xs font-semibold text-fire">{ago(last.endedAt ?? last.startedAt, now)}</span>}>
              {last ? <>{last.name} <span className="wd-c block text-sm font-normal text-mute">{fmtDate(last.startedAt)}, {fmtDuration(elapsedMs(last))}</span></> : <span className="text-sm font-normal text-mute">Aún no has completado ninguna sesión.</span>}
            </Tile>
            <Tile icon="heart" tone={LEVEL_COLOR[fatigue.level]} label="Fatiga y recuperación" onClick={() => nav('/recuperacion')}
              right={<span className="num shrink-0 text-2xl leading-none" style={{ color: LEVEL_COLOR[fatigue.level] }}>{fatigue.readiness ?? '–'}</span>}>
              <span style={{ color: LEVEL_COLOR[fatigue.level] }}>{fatigue.label}</span>
            </Tile>
            <Tile icon="chart" tone="#58c7ff" label="Peso corporal" onClick={() => nav('/recuperacion')} right={<Spark values={weights.slice(-20).map((w) => w.kg)} width={64} height={26} color="#58c7ff" />}>
              {bw ? <>{fmtKg(bw.kg)} kg <span className="wd-c block text-sm font-normal text-mute">{weights.length > 1 ? `${bw.kg - weights[0].kg >= 0 ? '+' : ''}${(bw.kg - weights[0].kg).toFixed(1)} kg desde ${weights[0].date}` : bw.date}</span></> : <span className="text-sm font-normal text-mute">Sin registros. Toca para añadir tu peso.</span>}
            </Tile>
            <Tile icon="chat" tone="#ffb054" label="Asistente" onClick={() => nav('/asistente')}>¿Qué peso uso hoy? ¿Qué está estancado?</Tile>
          </div>

          <div className="rounded-panel bg-card p-4">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="wd-w text-[15px] font-bold">Récords de los últimos 30 días</h2>
              <Link to="/historial" className="hit wd-c inline-block shrink-0 whitespace-nowrap text-sm text-data">Ver historial</Link>
            </div>
            {prs.length ? (
              <ul className="ruled">
                {prs.map((p) => (
                  <li key={p.exerciseId} className="flex items-center gap-3 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-go/15 text-go"><Icon name="trophy" size={16} /></span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="num shrink-0 text-go">{fmtKg(p.weight)} kg × {p.reps}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-mute">Tus mejores marcas aparecerán aquí.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
