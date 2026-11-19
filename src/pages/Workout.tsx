// REGISTRO DE ENTRENAMIENTO — funcionalidad principal.
// Cada cambio se escribe de inmediato en la base local: si la app se cierra, la sesión se recupera tal cual.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addExerciseToSession, addSet, completeSet, copyLastSession, deleteSet, elapsedMs, finishSession, getSessionSets, pauseSession, removeExerciseFromSession, resumeSession, startSession, uncompleteSet, updateSessionTarget, updateSet } from '../data/repo';
import { fmtDate, fmtDuration, fmtKg, intensityOf } from '../domain/calc';
import { MUSCLE_LABEL } from '../domain/muscles';
import { recommend, type Recommendation } from '../domain/progression';
import { recentReadiness } from '../domain/recovery';
import { DEFAULT_TARGET, type EndReason, type ExerciseDef, type Session, type SetLog, type Target } from '../domain/types';
import { sessionsOf, type ASet } from '../domain/volume';
import { db } from '../data/db';
import { useActiveSession, useAllItems, useDoneSets, useExMap, useNow, useProfile, useRoutines, useUserId } from '../hooks';
import { Bar, Btn, Card, Chip, cx, Empty, Field, Icon, Seg, Sheet, Stepper, Title, useAction, useUi } from '../ui/components';
import { ExerciseThumb } from '../ui/EquipmentArt';
import { ExerciseDetail, ExercisePicker } from './Library';
import { TargetEditor } from './RoutineEditor';

const REST_KEY = 'ii_rest';
const CUR_KEY = 'ii_cur_ex';
interface Rest { end: number; total: number }
const loadRest = (): Rest | null => { try { const r = JSON.parse(localStorage.getItem(REST_KEY) || 'null'); return r && r.end > Date.now() ? r : null; } catch { return null; } };
const storeRest = (r: Rest | null) => { try { r ? localStorage.setItem(REST_KEY, JSON.stringify(r)) : localStorage.removeItem(REST_KEY); } catch { /* sin almacenamiento */ } };

const ACTION_COLOR: Record<Recommendation['action'], string> = { increase: '#3ddc84', hold: '#5aa9ff', hold_add_reps: '#5aa9ff', decrease: '#ff9f45', deload: '#ff9f45', review_technique: '#f5c542' };

export function RecommendationCard({ rec, compact }: { rec: Recommendation; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const color = ACTION_COLOR[rec.action];
  return (
    <div className="cursor-pointer rounded-panel p-4" style={{ background: color + '17' }} onClick={() => setOpen(!open)}>
      <button type="button" className="flex w-full items-start justify-between gap-3 text-left" aria-expanded={open}>
        <div className="min-w-0">
          <div className="wd-x text-[13px] font-extrabold leading-tight" style={{ color }}>{rec.title}</div>
          <div className="mt-0.5 font-semibold">{rec.weight != null ? `Peso sugerido: ${fmtKg(rec.weight)} kg` : 'Sin peso sugerido todavía'}</div>
        </div>
        <div className="wd-c shrink-0 text-right text-sm text-mute">Confianza {rec.confidenceLabel}<br /><span className="tnum text-chalk">{Math.round(rec.confidence * 100)} %</span></div>
      </button>
      {(open || !compact) && <p className="mt-2.5 text-sm text-chalk/90">{rec.reason}</p>}
      {open && (
        <div className="mt-3 border-t border-chalk/10 pt-3">
          <div className="label mb-1">Datos considerados</div>
          <ul className="space-y-0.5 text-sm text-mute">{rec.factors.map((f, i) => <li key={i}>{f}</li>)}</ul>
          <p className="mt-2 text-xs text-mute">{rec.practical ? 'El umbral aplicado es una estimación práctica de entrenamiento, no un valor científico exacto. ' : ''}El RIR es tu estimación; la app no mide el estímulo muscular real.</p>
        </div>
      )}
      {compact && !open && <div className="wd-c mt-1.5 text-sm text-mute">Toca para ver el motivo</div>}
    </div>
  );
}

// ---------- Pantalla de inicio de sesión de entrenamiento ----------
function StartScreen() {
  const routines = useRoutines(); const items = useAllItems(); const ex = useExMap();
  const nav = useNavigate(); const run = useAction();
  const dow = new Date().getDay();
  const sorted = [...(routines ?? [])].sort((a, b) => Number(b.days.includes(dow)) - Number(a.days.includes(dow)));
  return (
    <div>
      <Title sub={fmtDate(Date.now())}>Entrenar</Title>
      <div className="space-y-3">
        {sorted.map((r) => {
          const its = items?.filter((i) => i.routineId === r.id) ?? [];
          const today = r.days.includes(dow);
          return (
            <Card key={r.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="wd-w truncate text-lg font-bold leading-tight">{r.name}</div>
                  {today && <div className="wd-c text-sm font-semibold text-fire">Programada para hoy</div>}
                  <div className="wd-c truncate text-sm text-mute">{its.map((i) => ex.get(i.exerciseId)?.name).filter(Boolean).slice(0, 3).join(', ')}{its.length > 3 ? ` y ${its.length - 3} más` : ''}</div>
                </div>
                <Btn variant={today ? 'primary' : 'soft'} icon="play" disabled={!its.length} onClick={() => run(() => startSession(r.id))}>Iniciar</Btn>
              </div>
            </Card>
          );
        })}
        {routines && !routines.length && <Empty icon="list" title="No tienes rutinas" text="Crea una rutina para que la app prepare tus series y pesos, o entrena libre."><Btn variant="primary" onClick={() => nav('/rutinas')}>Crear rutina</Btn></Empty>}
        <Btn className="w-full" icon="plus" onClick={() => run(() => startSession(null))}>Entrenamiento libre (sin rutina)</Btn>
      </div>
    </div>
  );
}

// ---------- Fila de una serie ----------
const RIR_OPTS = [0, 1, 2, 3, 4, 5];
const REASONS: { value: EndReason; label: string }[] = [
  { value: 'none', label: 'Dentro de lo planificado' },
  { value: 'momentary', label: 'Fallo muscular momentáneo (no salió la repetición)' },
  { value: 'technical', label: 'Fallo técnico (la técnica se degradó)' },
  { value: 'voluntary', label: 'Interrupción voluntaria' },
  { value: 'fatigue', label: 'Fatiga general (no del músculo objetivo)' },
];

function SetRow({ s, n, step, open, prev, halfRir, onOpen, onDone }: { s: SetLog; n: number; step: number; open: boolean; prev?: SetLog; halfRir: boolean; onOpen: () => void; onDone: () => void }) {
  const run = useAction();
  const [more, setMore] = useState(false);
  const info = intensityOf(s.rir);
  const patch = (p: Partial<SetLog>) => run(() => updateSet(s.id, p));

  if (s.done && !open) {
    return (
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-1 py-3 text-left" aria-label={`Serie ${n} completada, tocar para editar`}>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-go text-ink"><Icon name="check" size={15} /></span>
        <span className="num flex-1 text-lg">{fmtKg(s.weight)} kg × {s.reps}</span>
        {!s.metTarget && <span className="wd-c text-sm font-semibold text-[#ff7a70]">bajo el rango</span>}
        <span className="hidden text-sm text-mute sm:inline">{info.short}</span>
        <span className="wd-c flex items-center gap-1.5 text-[15px] font-semibold tnum" style={{ color: info.text }}><span className="h-2.5 w-2.5 rounded-full" style={{ background: info.color }} />{s.rir != null ? `RIR ${s.rir}` : 'sin RIR'}</span>
      </button>
    );
  }

  return (
    <div className={cx('rounded-panel p-3 transition-colors', open ? 'bg-card' : 'bg-card/45')} onClick={() => !open && onOpen()}>
      <div className="flex items-center gap-2">
        <span className="num grid h-7 w-7 shrink-0 place-items-center text-base text-mute">{n}</span>
        <div className="grid flex-1 grid-cols-2 gap-2">
          <Stepper compact label={`Peso serie ${n}`} unit="kg" value={s.weight} step={step} max={1000} onChange={(v) => patch({ weight: v })} />
          <Stepper compact label={`Repeticiones serie ${n}`} unit="reps" value={s.reps} step={1} max={200} onChange={(v) => patch({ reps: Math.round(v) })} />
        </div>
        <button type="button" aria-label={s.done ? `Desmarcar serie ${n}` : `Completar serie ${n}`}
          onClick={async (e) => { e.stopPropagation(); if (s.done) { await run(() => uncompleteSet(s.id)); } else if (await run(() => completeSet(s.id))) onDone(); }}
          className={cx('grid h-12 w-14 shrink-0 place-items-center rounded-ctl transition active:scale-95', s.done ? 'bg-go text-ink' : 'bg-fire text-ink')}>
          <Icon name="check" size={20} />
        </button>
      </div>
      {open && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="label">Repeticiones en reserva (RIR)</span>
            <span className="wd-c text-sm font-semibold" style={{ color: info.text }}>{info.label}</span>
          </div>
          {/* Escala de incandescencia: de hierro frío (lejos del fallo) a blanco (fallo). */}
          <div className="grid grid-cols-6 gap-px overflow-hidden rounded-ctl bg-ink">
            {RIR_OPTS.map((r) => {
              const on = s.rir != null && (r === 5 ? s.rir >= 5 : Math.floor(s.rir) === r);
              const heat = intensityOf(r);
              return (
                <button type="button" key={r} aria-label={`RIR ${r === 5 ? '5 o más' : r}`} aria-pressed={on} onClick={() => patch({ rir: on && !halfRir ? null : r })}
                  className={cx('num relative h-12 text-lg transition-colors', on ? 'text-ink' : 'bg-card2 text-mute hover:text-chalk')} style={on ? { background: heat.color, color: r >= 3 ? '#f3f1ec' : '#16181b' } : undefined}>
                  {r === 5 ? '5+' : r}
                  {!on && <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: heat.color }} />}
                </button>
              );
            })}
          </div>
          {halfRir && s.rir != null && s.rir < 5 && (
            <button type="button" className="wd-c mt-2 text-sm text-data" onClick={() => patch({ rir: Number.isInteger(s.rir) ? (s.rir as number) + 0.5 : Math.floor(s.rir as number) })}>
              {Number.isInteger(s.rir) ? `Marcar ${s.rir}.5 (medio punto)` : `RIR ${s.rir} · quitar medio punto`}
            </button>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {prev && <Btn size="sm" icon="copy" onClick={() => patch({ weight: prev.weight, reps: prev.reps })}>= serie {n - 1}</Btn>}
              <Btn size="sm" icon="more" onClick={() => setMore(true)}>Detalle</Btn>
            </div>
            <span className="wd-c text-sm text-mute tnum">{s.rpe != null ? `RPE ${s.rpe}` : ''}{s.done && s.restSec != null ? `, descanso ${s.restSec} s` : ''}</span>
          </div>
        </div>
      )}
      <Sheet open={more} onClose={() => setMore(false)} title={`Serie ${n} · detalle`}>
        <div className="space-y-3">
          <Field label="¿Cómo terminó la serie?">
            <select value={s.endReason} onChange={(e) => patch({ endReason: e.target.value as EndReason })}>{REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Stepper label="RIR" value={s.rir ?? 0} step={halfRir ? 0.5 : 1} min={0} max={10} onChange={(v) => patch({ rir: v })} />
            <Stepper label="RPE (1–10)" value={s.rpe ?? 10 - (s.rir ?? 2)} step={0.5} min={1} max={10} onChange={(v) => patch({ rpe: v })} />
          </div>
          <p className="text-xs text-mute">El RPE se calcula como 10 − RIR; puedes ajustarlo si tu percepción difiere. Llegó al fallo: <b className="text-chalk">{s.failure ? 'sí' : 'no'}</b>.</p>
          <Field label="Observaciones"><textarea rows={2} defaultValue={s.note} onBlur={(e) => e.target.value !== s.note && patch({ note: e.target.value })} placeholder="Molestias, ajustes de la máquina, sensaciones…" /></Field>
          <Btn variant="danger" icon="trash" className="w-full" onClick={async () => { await run(() => deleteSet(s.id)); setMore(false); }}>Eliminar serie</Btn>
        </div>
      </Sheet>
    </div>
  );
}

// ---------- Panel del ejercicio actual ----------
function ExercisePanel({ session, ex, sets, history, readiness, halfRir, onRest, onNext, hasNext }: { session: Session; ex: ExerciseDef; sets: SetLog[]; history: ASet[]; readiness: number | null; halfRir: boolean; onRest: (sec: number) => void; onNext: () => void; hasNext: boolean }) {
  const run = useAction(); const { confirm, toast } = useUi();
  const target: Target = session.targets[ex.id] ?? DEFAULT_TARGET[ex.type];
  const past = useMemo(() => sessionsOf(history, ex.id), [history, ex.id]);
  const rec = useMemo(() => recommend({ exType: ex.type, increment: ex.increment, target, history: past, readiness }), [ex, target, past, readiness]);
  const last = past[0];
  const firstOpen = sets.find((s) => !s.done)?.id ?? null;
  const [openId, setOpenId] = useState<string | null>(firstOpen);
  useEffect(() => { setOpenId(firstOpen); }, [ex.id, firstOpen]);
  const [editTarget, setEditTarget] = useState(false); const [detail, setDetail] = useState(false);
  const allDone = sets.length > 0 && sets.every((s) => s.done);

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setDetail(true)} aria-label="Ver técnica del ejercicio"><ExerciseThumb ex={ex} size={60} /></button>
          <div className="min-w-0 flex-1">
            <h2 className="wd-w text-xl font-extrabold leading-tight">{ex.name}</h2>
            <div className="wd-c text-[15px]"><span className="font-semibold text-fire">{MUSCLE_LABEL[ex.primary]}</span>{ex.secondary.length > 0 && <span className="text-mute">, con {ex.secondary.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(' y ')}</span>}</div>
            {ex.machine && <div className="wd-c truncate text-sm text-mute">{ex.machine}</div>}
          </div>
        </div>
        <button type="button" onClick={() => setEditTarget(true)} aria-label={`Objetivo: ${target.sets} × ${target.repMin}–${target.repMax}, RIR ${target.rirMin}–${target.rirMax}. Editar`} className="mt-4 grid w-full grid-cols-4 divide-x divide-line rounded-ctl bg-card py-2.5 text-center transition-colors hover:bg-card2">
          {[['Series', target.sets], ['Repeticiones', `${target.repMin}–${target.repMax}`], ['RIR', target.rirMin === target.rirMax ? target.rirMin : `${target.rirMin}–${target.rirMax}`], ['Descanso', `${target.restSec} s`]].map(([k, v]) => (
            <span key={k} className="px-1"><span className="num block text-base leading-tight">{v}</span><span className="label block !text-xs">{k}</span></span>
          ))}
        </button>
        <p className="mt-3 text-[15px]">
          <span className="text-mute">Última sesión: </span>
          {last ? <><b className="tnum">{[...new Set(last.sets.map((s) => s.weight))].map((w) => `${fmtKg(w)} kg × ${last.sets.filter((s) => s.weight === w).map((s) => s.reps).join(', ')}`).join(' y ')}</b>
            <span className="wd-c text-mute"> con RIR {last.sets.map((s) => s.rir ?? '–').join(', ')}, {fmtDate(last.date)}</span></> : <span className="text-mute">sin registros previos</span>}
        </p>
      </div>

      <RecommendationCard rec={rec} compact />

      <div className="space-y-1.5">
        {sets.map((s, i) => (
          <SetRow key={s.id} s={s} n={i + 1} step={ex.increment} open={openId === s.id} prev={sets[i - 1]} halfRir={halfRir}
            onOpen={() => setOpenId(s.id)}
            onDone={() => { onRest(target.restSec); const nx = sets.find((x) => !x.done && x.id !== s.id); setOpenId(nx?.id ?? null); if (!nx) toast('Ejercicio completado'); }} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Btn icon="plus" onClick={async () => { const s = await run(() => addSet(session.id, ex.id)); if (s) setOpenId(s.id); }}>Añadir serie</Btn>
        <Btn icon="copy" disabled={!last} onClick={() => run(async () => { await copyLastSession(session.id, ex.id); }, 'Series copiadas de la sesión anterior')}>Copiar sesión anterior</Btn>
      </div>
      {allDone && hasNext && <Btn variant="primary" size="lg" className="w-full" icon="right" onClick={onNext}>Siguiente ejercicio</Btn>}
      <button type="button" className="wd-c w-full py-2 text-sm text-mute underline" onClick={async () => { if (await confirm(`Se quitará “${ex.name}” de esta sesión junto con sus series.`, { confirmLabel: 'Quitar', danger: true })) await run(() => removeExerciseFromSession(session.id, ex.id)); }}>Quitar este ejercicio de la sesión</button>

      <Sheet open={editTarget} onClose={() => setEditTarget(false)} title="Objetivo de hoy">
        <TargetEditor value={target} onChange={(t) => run(() => updateSessionTarget(session.id, ex.id, t))} />
        <p className="mt-3 text-xs text-mute">Cambia solo esta sesión. Para cambiarlo de forma permanente, edita la rutina.</p>
      </Sheet>
      <ExerciseDetail ex={detail ? ex : null} onClose={() => setDetail(false)} />
    </div>
  );
}

// ---------- Temporizador de descanso ----------
function RestBar({ rest, now, onChange }: { rest: Rest; now: number; onChange: (r: Rest | null) => void }) {
  const left = Math.max(0, rest.end - now);
  const pct = rest.total > 0 ? left / (rest.total * 1000) : 0;
  return (
    <div className="fixed inset-x-0 bottom-[84px] z-30 px-3 md:bottom-4 md:left-60" role="timer" aria-label="Descanso">
      <div className="mx-auto flex max-w-xl items-center gap-3 rounded-panel bg-card2 p-3 shadow-[0_10px_30px_rgba(0,0,0,.55)] animate-rise">
        <svg width="46" height="46" viewBox="0 0 46 46" className="shrink-0 -rotate-90"><circle cx="23" cy="23" r="19" stroke="#16181b" strokeWidth="5" fill="none" /><circle cx="23" cy="23" r="19" stroke="#5aa9ff" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={119.4} strokeDashoffset={119.4 * (1 - Math.min(1, pct))} /></svg>
        <div className="flex-1">
          <div className="num text-2xl leading-none">{fmtDuration(left)}</div>
          <div className="label mt-0.5 !text-data">de descanso</div>
        </div>
        <Btn size="sm" aria-label="Restar 15 segundos" onClick={() => onChange({ ...rest, end: rest.end - 15000 })}>−15</Btn>
        <Btn size="sm" aria-label="Sumar 15 segundos" onClick={() => onChange({ end: rest.end + 15000, total: rest.total + 15 })}>+15</Btn>
        <Btn size="sm" variant="primary" onClick={() => onChange(null)}>Omitir</Btn>
      </div>
    </div>
  );
}

// ---------- Sesión en curso ----------
function Active({ session }: { session: Session }) {
  const nav = useNavigate(); const run = useAction(); const { confirm, toast } = useUi();
  const uid = useUserId();
  const ex = useExMap(); const profile = useProfile();
  const history = useDoneSets() ?? [];
  const sets = useLiveQuery(() => getSessionSets(session.id), [session.id]) ?? [];
  const logs = useLiveQuery(() => db.recovery.where('userId').equals(uid).toArray(), [uid]) ?? [];
  const readiness = useMemo(() => recentReadiness(logs.filter((l) => !l.deleted), Date.now()), [logs]);
  const [cur, setCur] = useState<string | null>(() => { try { return localStorage.getItem(CUR_KEY); } catch { return null; } });
  const [rest, setRestState] = useState<Rest | null>(loadRest);
  const [picker, setPicker] = useState(false);
  const paused = session.status === 'paused';
  const now = useNow(rest ? 250 : 1000, !paused || !!rest);

  const ids = session.exerciseIds;
  const current = cur && ids.includes(cur) ? cur : ids.find((id) => sets.some((s) => s.exerciseId === id && !s.done)) ?? ids[0] ?? null;
  const select = (id: string) => { setCur(id); try { localStorage.setItem(CUR_KEY, id); } catch { /* sin almacenamiento */ } window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const setRest = (r: Rest | null) => { storeRest(r && r.end > Date.now() ? r : null); setRestState(r && r.end > Date.now() ? r : null); };

  useEffect(() => {
    if (rest && now >= rest.end) { setRest(null); try { navigator.vibrate?.([250, 120, 250]); } catch { /* sin vibración */ } toast('Descanso terminado'); }
  }, [now, rest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mantiene la pantalla encendida durante el entrenamiento (si el navegador lo permite).
  useEffect(() => {
    if (paused) return;
    type Lock = { release(): Promise<void> };
    const wl = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<Lock> } }).wakeLock;
    if (!wl) return;
    let lock: Lock | null = null; let cancelled = false;
    const acquire = () => { wl.request('screen').then((l) => { if (cancelled) void l.release().catch(() => undefined); else lock = l; }).catch(() => undefined); };
    const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible); void lock?.release().catch(() => undefined); };
  }, [paused]);

  const done = sets.filter((s) => s.done).length;
  const curEx = current ? ex.get(current) : undefined;
  const idx = current ? ids.indexOf(current) : -1;

  const finish = async () => {
    const pending = sets.length - done;
    const msg = done === 0 ? 'No completaste ninguna serie: la sesión se descartará.' : pending > 0 ? `Quedan ${pending} series sin completar; se descartarán. ¿Finalizar el entrenamiento?` : '¿Finalizar y guardar el entrenamiento?';
    if (!(await confirm(msg, { confirmLabel: done === 0 ? 'Descartar' : 'Finalizar', danger: done === 0 }))) return;
    const res = await run(() => finishSession(session.id));
    setRest(null); try { localStorage.removeItem(CUR_KEY); } catch { /* sin almacenamiento */ }
    if (res) { toast('Entrenamiento guardado'); nav(`/historial?s=${res.id}`); } else { toast('Sesión descartada'); nav('/'); }
  };

  return (
    <div className={rest ? 'pb-24' : ''}>
      <div className="sticky top-0 z-20 -mx-4 mb-3 border-b border-line bg-ink/95 px-4 pb-3 pt-2 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="wd-w truncate font-bold leading-tight">{session.name}</div>
            <div className="wd-c text-sm font-semibold text-fire">{paused ? 'En pausa' : 'Entrenamiento en curso'}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="num text-xl" aria-label="Tiempo transcurrido">{fmtDuration(elapsedMs(session, now))}</span>
            <Btn size="sm" icon={paused ? 'play' : 'pause'} aria-label={paused ? 'Reanudar' : 'Pausar'} onClick={() => run(() => (paused ? resumeSession(session.id) : pauseSession(session.id)))} />
            <Btn size="sm" variant="go" onClick={finish}>Finalizar</Btn>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Bar value={done} max={sets.length || 1} color="#3ddc84" height={5} />
          <span className="wd-c shrink-0 text-sm font-semibold tnum text-mute">{done}/{sets.length} series</span>
        </div>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {ids.map((id, i) => {
          const xs = sets.filter((s) => s.exerciseId === id); const d = xs.filter((s) => s.done).length;
          return <Chip key={id} active={id === current} color={d === xs.length && xs.length ? '#3ddc84' : '#ff6a1a'} onClick={() => select(id)}>{i + 1}. {ex.get(id)?.name ?? 'Ejercicio'} <span className="tnum opacity-60">{d}/{xs.length}</span></Chip>;
        })}
        <Chip onClick={() => setPicker(true)}>+ Ejercicio</Chip>
      </div>

      {paused && <div className="mb-3 rounded-ctl bg-card2 p-3 text-sm text-mute">Sesión en pausa: el cronómetro está detenido. Puedes seguir registrando o reanudar.</div>}

      {curEx ? (
        <ExercisePanel key={curEx.id} session={session} ex={curEx} sets={sets.filter((s) => s.exerciseId === curEx.id)} history={history} readiness={readiness} halfRir={profile.halfRir}
          onRest={(sec) => sec > 0 && setRest({ end: Date.now() + sec * 1000, total: sec })} hasNext={idx < ids.length - 1} onNext={() => select(ids[idx + 1])} />
      ) : (
        <Empty icon="dumbbell" title="Añade tu primer ejercicio" text="Elige un ejercicio de la biblioteca para empezar a registrar series."><Btn variant="primary" icon="plus" onClick={() => setPicker(true)}>Añadir ejercicio</Btn></Empty>
      )}

      <ExercisePicker open={picker} onClose={() => setPicker(false)} exclude={ids} onPick={(e) => run(async () => { await addExerciseToSession(session.id, e.id); select(e.id); })} />
      {rest && <RestBar rest={rest} now={now} onChange={setRest} />}
    </div>
  );
}

export default function Workout() {
  const session = useActiveSession();
  if (session === undefined) return <p className="py-10 text-center text-sm text-mute">Cargando…</p>;
  return session ? <Active session={session} /> : <StartScreen />;
}
