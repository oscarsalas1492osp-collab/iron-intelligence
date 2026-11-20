import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { deleteSession, deleteSet, elapsedMs, getSessionSets, updateSet } from '../data/repo';
import { e1rm, fmtDate, fmtDuration, fmtKg, intensityOf, ymd } from '../domain/calc';
import { TECHNIQUE } from '../domain/techniques';
import type { Session, SetLog, Technique } from '../domain/types';
import { exerciseSeries, personalRecords } from '../domain/volume';
import { useDoneSets, useExMap, useSessions } from '../hooks';
import { LineC } from '../ui/charts';
import { Btn, Card, Empty, Field, Icon, Seg, Sheet, Stat, Stepper, Title, useAction, useUi } from '../ui/components';
import { ExerciseThumb } from '../ui/EquipmentArt';

function SetEditor({ s, onClose }: { s: SetLog; onClose: () => void }) {
  const run = useAction(); const { confirm } = useUi();
  const [v, setV] = useState({ weight: s.weight, reps: s.reps, rir: s.rir });
  return (
    <Sheet open onClose={onClose} title="Editar serie">
      <div className="grid grid-cols-3 gap-2">
        <Stepper label="Peso (kg)" value={v.weight} step={0.5} max={1000} onChange={(weight) => setV({ ...v, weight })} />
        <Stepper label="Reps" value={v.reps} max={200} onChange={(reps) => setV({ ...v, reps: Math.round(reps) })} />
        <Stepper label="RIR" value={v.rir ?? 0} step={0.5} max={10} onChange={(rir) => setV({ ...v, rir })} />
      </div>
      {s.note && <p className="mt-3 text-xs text-mute">Nota: {s.note}</p>}
      <div className="mt-4 flex gap-2">
        <Btn variant="danger" icon="trash" onClick={async () => { if (await confirm('Se eliminará esta serie del historial.', { confirmLabel: 'Eliminar', danger: true })) { await run(() => deleteSet(s.id)); onClose(); } }}>Eliminar</Btn>
        <Btn variant="primary" className="flex-1" onClick={async () => { if (await run(() => updateSet(s.id, v), 'Serie actualizada')) onClose(); }}>Guardar</Btn>
      </div>
    </Sheet>
  );
}

function SessionDetail({ session, onClose }: { session: Session; onClose: () => void }) {
  const ex = useExMap(); const run = useAction(); const { confirm } = useUi();
  const sets = (useLiveQuery(() => getSessionSets(session.id), [session.id]) ?? []).filter((s) => s.done);
  const [edit, setEdit] = useState<SetLog | null>(null);
  const ids = [...new Set([...session.exerciseIds, ...sets.map((s) => s.exerciseId)])].filter((id) => sets.some((s) => s.exerciseId === id));
  return (
    <Sheet open onClose={onClose} title={session.name} wide>
      <div className="mb-4 grid grid-cols-4 gap-2">
        <Stat label="Fecha" value={<span className="text-base">{fmtDate(session.startedAt)}</span>} />
        <Stat label="Duración" value={<span className="text-base">{fmtDuration(elapsedMs(session))}</span>} />
        <Stat label="Series" value={<span className="text-base">{sets.filter((x) => !x.sub).length}</span>} />
        <Stat label="Volumen" value={<span className="text-base">{Math.round(sets.reduce((a, s) => a + s.weight * s.reps, 0)).toLocaleString('es-CL')} kg</span>} />
      </div>
      <div className="space-y-3">
        {ids.map((id) => {
          const e = ex.get(id); const t = session.targets[id];
          return (
            <div key={id} className="rounded-panel bg-card p-3">
              <div className="mb-2 flex items-center gap-2.5">
                {e && <ExerciseThumb ex={e} size={40} />}
                <div className="min-w-0"><div className="font-semibold leading-tight truncate">{e?.name ?? 'Ejercicio eliminado'}</div>{t && <div className="text-xs text-mute tnum">Objetivo: {t.sets} × {t.repMin}–{t.repMax} con RIR {t.rirMin}–{t.rirMax}</div>}</div>
              </div>
              <div className="space-y-1">
                {sets.filter((s) => s.exerciseId === id).map((s, _i, all) => {
                  const n = all.filter((x) => !x.sub && x.order <= s.order).length;
                  const tag = s.sub ? `${TECHNIQUE[s.technique as Exclude<Technique, ''>]?.tag ?? 'Tramo'} ${s.sub}` : null;
                  return (
                    <button type="button" key={s.id} onClick={() => setEdit(s)} className={`flex w-full items-center gap-3 rounded-xl bg-card2 px-3 py-2 text-left text-sm ${tag ? 'ml-5 w-[calc(100%-1.25rem)] border-l-2 border-fire/50' : ''}`} aria-label={tag ? `Editar ${tag.toLowerCase()} de la serie ${n}` : `Editar serie ${n}`}>
                      <span className={tag ? 'wd-c text-xs font-semibold text-fire' : 'w-5 text-xs text-mute'}>{tag ?? n}</span>
                      <span className="flex-1 font-bold tnum">{fmtKg(s.weight)} kg × {s.reps}</span>
                      <span className="text-xs font-semibold tnum" style={{ color: intensityOf(s.rir).color }}>{s.rir != null ? `RIR ${s.rir}` : 'sin RIR'}</span>
                      {s.failure && <span className="text-[10px] font-bold text-ember">FALLO</span>}
                      <Icon name="edit" size={14} className="text-mute" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {session.notes && <p className="mt-3 text-sm text-mute">{session.notes}</p>}
      <Btn variant="danger" icon="trash" className="mt-4 w-full" onClick={async () => { if (await confirm('Se eliminará la sesión completa con todas sus series. Esta acción no se puede deshacer.', { confirmLabel: 'Eliminar sesión', danger: true })) { await run(() => deleteSession(session.id), 'Sesión eliminada'); onClose(); } }}>Eliminar sesión</Btn>
      {edit && <SetEditor s={edit} onClose={() => setEdit(null)} />}
    </Sheet>
  );
}

function Calendar({ sessions, month, setMonth, onPick }: { sessions: Session[]; month: Date; setMonth: (d: Date) => void; onPick: (s: Session) => void }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const byDay = new Map<string, Session[]>();
  for (const s of sessions) { const k = ymd(s.startedAt); byDay.set(k, [...(byDay.get(k) ?? []), s]); }
  const today = ymd(Date.now());
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <Btn size="sm" icon="left" aria-label="Mes anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
        <div className="wd-w font-bold first-letter:uppercase">{month.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}</div>
        <Btn size="sm" icon="right" aria-label="Mes siguiente" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-mute mb-1">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <div key={d}>{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => <div key={`o${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const k = ymd(new Date(month.getFullYear(), month.getMonth(), i + 1));
          const ss = byDay.get(k);
          return (
            <button type="button" key={k} disabled={!ss} onClick={() => ss && onPick(ss[0])} aria-label={`${i + 1}${ss ? `, ${ss.length} entrenamiento(s)` : ''}`}
              className={`num aspect-square rounded-ctl text-[15px] transition ${ss ? 'bg-fire text-ink' : 'text-mute'} ${k === today ? 'ring-2 ring-chalk/80' : ''}`}>
              {i + 1}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

const METRICS = [
  { value: 'maxWeight', label: 'Peso', unit: ' kg', color: '#ff6a1a' },
  { value: 'totalReps', label: 'Reps', unit: ' reps', color: '#58c7ff' },
  { value: 'volume', label: 'Volumen', unit: ' kg', color: '#58c7ff' },
  { value: 'avgRir', label: 'RIR', unit: ' RIR', color: '#f5c542' },
  { value: 'e1rm', label: '1RM est.', unit: ' kg', color: '#34e0a1' },
] as const;

export default function History() {
  const sessions = (useSessions() ?? []).filter((s) => s.status === 'done');
  const sets = useDoneSets() ?? []; const ex = useExMap();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'cal' | 'prog' | 'pr'>('cal');
  const [month, setMonth] = useState(() => new Date());
  const [open, setOpen] = useState<Session | null>(null);
  const [exId, setExId] = useState(''); const [metric, setMetric] = useState<(typeof METRICS)[number]['value']>('maxWeight');

  useEffect(() => {
    const id = params.get('s');
    if (id && sessions.length) { const s = sessions.find((x) => x.id === id); if (s) { setOpen(s); setParams({}, { replace: true }); } }
  }, [params, sessions, setParams]);

  const withHistory = useMemo(() => [...new Set(sets.map((s) => s.exerciseId))].map((id) => ex.get(id)).filter((e): e is NonNullable<typeof e> => !!e).sort((a, b) => a.name.localeCompare(b.name)), [sets, ex]);
  const selected = exId && withHistory.some((e) => e.id === exId) ? exId : withHistory[0]?.id ?? '';
  const series = useMemo(() => (selected ? exerciseSeries(sets, selected) : []), [sets, selected]);
  const prs = useMemo(() => personalRecords(sets, ex), [sets, ex]);
  const m = METRICS.find((x) => x.value === metric)!;
  const inMonth = sessions.filter((s) => { const d = new Date(s.startedAt); return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear(); });

  return (
    <div>
      <Title sub={`${sessions.length} sesiones registradas`}>Historial</Title>
      <div className="mb-4"><Seg value={tab} onChange={setTab} options={[{ value: 'cal', label: 'Calendario' }, { value: 'prog', label: 'Progresión' }, { value: 'pr', label: 'Récords' }]} /></div>

      {tab === 'cal' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Calendar sessions={sessions} month={month} setMonth={setMonth} onPick={setOpen} />
          <div className="space-y-2">
            {inMonth.map((s) => {
              const ss = sets.filter((x) => x.sessionId === s.id);
              return (
                <Card key={s.id} onClick={() => setOpen(s)}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0"><div className="font-bold truncate">{s.name}</div><div className="text-xs text-mute">{fmtDate(s.startedAt)}, {fmtDuration(elapsedMs(s))}</div></div>
                    <div className="shrink-0 text-right text-xs text-mute tnum"><div className="text-sm font-bold text-chalk">{ss.length} series</div>{Math.round(ss.reduce((a, x) => a + x.weight * x.reps, 0)).toLocaleString('es-CL')} kg</div>
                  </div>
                </Card>
              );
            })}
            {!inMonth.length && <Empty icon="calendar" title="Sin entrenamientos este mes" text="Las sesiones que finalices aparecerán aquí." />}
          </div>
        </div>
      )}

      {tab === 'prog' && (withHistory.length ? (
        <div className="space-y-3">
          <Field label="Ejercicio"><select value={selected} onChange={(e) => setExId(e.target.value)}>{withHistory.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
          <Seg value={metric} onChange={setMetric} options={METRICS.map((x) => ({ value: x.value, label: x.label }))} />
          <Card>
            {series.length >= 2 ? <LineC data={series as unknown as Record<string, unknown>[]} x="label" y={metric} unit={m.unit} color={m.color} /> : <p className="py-10 text-center text-sm text-mute">Se necesitan al menos 2 sesiones de este ejercicio para dibujar la progresión.</p>}
            {metric === 'e1rm' && <p className="mt-2 text-xs text-mute">1RM estimado con la fórmula de Epley a partir de peso, repeticiones y RIR. Es una estimación, no una prueba real de fuerza máxima.</p>}
            {metric === 'avgRir' && <p className="mt-2 text-xs text-mute">Intensidad percibida: RIR medio declarado por sesión (menor = más cerca del fallo).</p>}
          </Card>
          <div className="space-y-1">
            {[...series].reverse().slice(0, 8).map((p) => (
              <div key={p.date} className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm border border-line">
                <span className="text-mute">{fmtDate(p.date)}</span>
                <span className="tnum font-semibold">{fmtKg(p.maxWeight)} kg, {p.totalReps} reps{p.avgRir != null ? `, RIR ${p.avgRir}` : ''}{p.e1rm != null ? `, 1RM est. ${fmtKg(p.e1rm)}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      ) : <Empty icon="chart" title="Aún no hay progresión" text="Completa sesiones para ver la evolución de cada ejercicio." />)}

      {tab === 'pr' && (prs.length ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {prs.map((p) => (
            <Card key={p.exerciseId}>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-go/15 text-go"><Icon name="trophy" size={18} /></span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-xs text-mute">Mayor carga, {fmtDate(p.date)}{p.e1rm != null ? `. 1RM estimado: ${fmtKg(p.e1rm)} kg` : ''}</div>
                </div>
                <div className="text-right font-extrabold tnum text-go">{fmtKg(p.weight)} kg<span className="text-xs text-mute font-semibold"> × {p.reps}</span></div>
              </div>
            </Card>
          ))}
        </div>
      ) : <Empty icon="trophy" title="Sin récords todavía" text="Tus mejores marcas por ejercicio aparecerán aquí." />)}

      {open && <SessionDetail session={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
