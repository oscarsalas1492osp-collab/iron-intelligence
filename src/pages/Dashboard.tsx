import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../data/db';
import { elapsedMs, mine, startSession } from '../data/repo';
import { ago, DAY, fmtDate, fmtDuration, fmtKg, weekStart } from '../domain/calc';
import { MUSCLE_LABEL } from '../domain/muscles';
import { fatigueStatus, LEVEL_COLOR } from '../domain/recovery';
import type { Muscle } from '../domain/types';
import { inWeek, muscleVolume, personalRecords, tonnage } from '../domain/volume';
import { useActiveSession, useAllItems, useDoneSets, useExMap, useNow, useProfile, useRoutines, useSessions, useUserId } from '../hooks';
import { BodyMap } from '../ui/BodyMap';
import { Btn, Card, H2, Icon, Spark, Stat, useAction } from '../ui/components';
import { Logo } from '../ui/Layout';

const hello = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'; };
const pctDelta = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

export default function Dashboard() {
  const uid = useUserId(); const nav = useNavigate(); const run = useAction();
  const profile = useProfile(); const routines = useRoutines() ?? []; const items = useAllItems() ?? [];
  const active = useActiveSession(); const sessions = (useSessions() ?? []).filter((s) => s.status === 'done');
  const sets = useDoneSets() ?? []; const ex = useExMap();
  const weights = useLiveQuery(async () => mine(await db.bodyWeights.toArray()).sort((a, b) => a.date.localeCompare(b.date)), [uid]) ?? [];
  const logs = useLiveQuery(async () => mine(await db.recovery.toArray()), [uid]) ?? [];
  const now = useNow(60000);

  const dow = new Date(now).getDay();
  const todayRoutine = routines.find((r) => r.days.includes(dow));
  const last = sessions[0];
  const start = weekStart(now);
  const week = useMemo(() => inWeek(sets, start), [sets, start]);
  const prevWeek = useMemo(() => inWeek(sets, start - 7 * DAY), [sets, start]);
  const vol = useMemo(() => muscleVolume(week, ex, profile.indirectCoef), [week, ex, profile.indirectCoef]);
  const prs = useMemo(() => personalRecords(sets, ex).filter((p) => now - p.date < 30 * DAY).slice(0, 3), [sets, ex, now]);
  const fatigue = useMemo(() => fatigueStatus(sets, logs, now), [sets, logs, now]);

  // Mapa corporal: naranja = entrenado en las últimas 48 h; azul = entrenado esta semana (más intenso = más volumen); gris = pendiente.
  const colors = useMemo(() => {
    const recent = new Set<Muscle>();
    for (const s of sets) if (now - s.date < 2 * DAY) { const e = ex.get(s.exerciseId); if (e) recent.add(e.primary); }
    const max = Math.max(1, ...vol.map((v) => v.fractional));
    const c: Partial<Record<Muscle, string>> = {};
    for (const v of vol) {
      if (recent.has(v.muscle)) c[v.muscle] = '#ff6a1a';
      else if (v.fractional > 0) c[v.muscle] = `rgba(59,157,255,${(0.35 + 0.65 * (v.fractional / max)).toFixed(2)})`;
    }
    return c;
  }, [sets, vol, ex, now]);
  const trained = vol.filter((v) => v.direct > 0);
  const pending = vol.filter((v) => v.fractional === 0);
  const bw = weights[weights.length - 1];
  const dSets = pctDelta(week.length, prevWeek.length), dTon = pctDelta(tonnage(week), tonnage(prevWeek));

  const begin = async () => {
    if (active) return nav('/entrenar');
    if (todayRoutine && items.some((i) => i.routineId === todayRoutine.id)) { if (await run(() => startSession(todayRoutine.id))) nav('/entrenar'); } else nav('/entrenar');
  };

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="md:hidden mb-3"><Logo /></div>
          <p className="text-sm text-mute first-letter:uppercase">{new Date(now).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="text-3xl font-extrabold tracking-tight truncate">{hello()}{profile.name ? `, ${profile.name}` : ''}</h1>
        </div>
        <Link to="/perfil" aria-label="Perfil" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card2 border border-line text-lg font-bold">{profile.name ? profile.name[0].toUpperCase() : <Icon name="user" />}</Link>
      </div>

      <div className="rounded-3xl border border-fire/30 bg-gradient-to-br from-fire/20 via-card to-card p-5 mb-4">
        <div className="text-[10px] font-extrabold tracking-[.2em] text-fire">{active ? 'ENTRENAMIENTO EN CURSO' : todayRoutine ? 'RUTINA PROGRAMADA PARA HOY' : 'HOY'}</div>
        <div className="mt-1 text-2xl font-extrabold leading-tight">{active ? active.name : todayRoutine ? todayRoutine.name : routines.length ? 'Día sin rutina programada' : 'Crea tu primera rutina'}</div>
        <div className="text-sm text-mute">
          {active ? `${fmtDuration(elapsedMs(active, now))} transcurridos · tu sesión está guardada` : todayRoutine ? `${items.filter((i) => i.routineId === todayRoutine.id).length} ejercicios · ${items.filter((i) => i.routineId === todayRoutine.id).reduce((a, i) => a + i.sets, 0)} series` : routines.length ? 'Puedes iniciar cualquier rutina o un entrenamiento libre.' : 'Parte de una plantilla o arma la tuya.'}
        </div>
        <Btn variant="primary" size="lg" icon="play" className="mt-4 w-full" onClick={() => (routines.length || active ? begin() : nav('/rutinas'))}>
          {active ? 'CONTINUAR ENTRENAMIENTO' : routines.length ? 'INICIAR ENTRENAMIENTO' : 'CREAR RUTINA'}
        </Btn>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Card onClick={last ? () => nav(`/historial?s=${last.id}`) : undefined}>
            <H2>Última sesión</H2>
            {last ? <div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="font-bold truncate">{last.name}</div><div className="text-xs text-mute">{fmtDate(last.startedAt)} · {fmtDuration(elapsedMs(last))}</div></div><div className="shrink-0 text-right"><div className="text-lg font-extrabold text-fire">{ago(last.endedAt ?? last.startedAt, now)}</div><div className="text-xs text-mute">desde el último entrenamiento</div></div></div>
              : <p className="text-sm text-mute">Aún no has completado ninguna sesión.</p>}
          </Card>

          <Card>
            <H2 right={<Link to="/analisis" className="text-xs text-data">Ver análisis</Link>}>Esta semana</H2>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Sesiones" value={new Set(week.map((s) => s.sessionId)).size} sub={`de ${profile.daysAvailable} disponibles`} />
              <Stat label="Series" value={week.length} sub={dSets != null ? `${dSets > 0 ? '+' : ''}${dSets} % vs. anterior` : 'sin semana previa'} color={dSets != null && dSets > 0 ? '#2fd17a' : undefined} />
              <Stat label="Volumen" value={`${(tonnage(week) / 1000).toFixed(1)} t`} sub={dTon != null ? `${dTon > 0 ? '+' : ''}${dTon} % vs. anterior` : 'kg × reps'} color="#3b9dff" />
            </div>
          </Card>

          <Card onClick={() => nav('/recuperacion')}>
            <H2>Fatiga y recuperación</H2>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-[3px] font-extrabold tnum" style={{ borderColor: LEVEL_COLOR[fatigue.level], color: LEVEL_COLOR[fatigue.level] }}>{fatigue.readiness ?? '—'}</div>
              <div className="min-w-0"><div className="font-bold" style={{ color: LEVEL_COLOR[fatigue.level] }}>{fatigue.label}</div><div className="text-xs text-mute truncate">{fatigue.reasons[0]}</div></div>
            </div>
          </Card>

          <Card onClick={() => nav('/recuperacion')}>
            <H2>Peso corporal</H2>
            <div className="flex items-end justify-between gap-3">
              {bw ? <Stat label={bw.date} value={`${fmtKg(bw.kg)} kg`} sub={weights.length > 1 ? `${bw.kg - weights[0].kg >= 0 ? '+' : ''}${(bw.kg - weights[0].kg).toFixed(1)} kg desde ${weights[0].date}` : 'primer registro'} /> : <p className="text-sm text-mute">Sin registros. Toca para añadir tu peso.</p>}
              <Spark values={weights.slice(-20).map((w) => w.kg)} />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <H2>Grupos musculares</H2>
            <div className="flex items-center gap-4">
              <BodyMap colors={colors} className="h-56 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2 text-xs">
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-fire" />Entrenado en las últimas 48 h</div>
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-data" />Entrenado esta semana (más intenso = más series)</div>
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#343840]" />Pendiente esta semana</div>
                <div className="pt-1 text-mute"><b className="text-white">Trabajados:</b> {trained.length ? trained.map((v) => `${MUSCLE_LABEL[v.muscle]} (${v.direct})`).join(', ') : 'ninguno aún'}</div>
                <div className="text-mute"><b className="text-white">Pendientes:</b> {pending.length ? pending.map((v) => MUSCLE_LABEL[v.muscle]).join(', ') : 'ninguno'}</div>
              </div>
            </div>
          </Card>

          <Card>
            <H2 right={<Link to="/historial" className="text-xs text-data">Ver historial</Link>}>Récords recientes</H2>
            {prs.length ? <div className="space-y-2">{prs.map((p) => (
              <div key={p.exerciseId} className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-go/15 text-go"><Icon name="trophy" size={15} /></span><span className="min-w-0 flex-1 truncate text-sm">{p.name}</span><b className="tnum text-go">{fmtKg(p.weight)} kg × {p.reps}</b></div>
            ))}</div> : <p className="text-sm text-mute">Tus mejores marcas de los últimos 30 días aparecerán aquí.</p>}
          </Card>

          <Card onClick={() => nav('/asistente')}>
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-data/15 text-data"><Icon name="chat" /></span><div className="min-w-0 flex-1"><div className="font-bold">Pregúntale a tu historial</div><div className="text-xs text-mute truncate">¿Qué peso uso hoy? ¿Qué está estancado?</div></div><Icon name="right" className="text-mute" size={18} /></div>
          </Card>
        </div>
      </div>
      <p className="mt-8 text-center text-[10px] font-bold tracking-[.4em] text-mute">REGISTRA · ANALIZA · PROGRESA</p>
    </div>
  );
}
