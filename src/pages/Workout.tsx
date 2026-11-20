// REGISTRO DE ENTRENAMIENTO — funcionalidad principal.
// Cada cambio se escribe de inmediato en la base local: si la app se cierra, la sesión se recupera tal cual.
import { ADJ_KEY } from '../domain/feedback';
import { ToolsButton } from '../ui/extras';
import { beep, clearRestNotice, notifyRestEnd, primeAudio } from '../ui/alerts';
import { isRecord } from '../domain/insights';
import { DELOAD_TAG } from '../domain/cycle';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addExerciseToSession, addExtension, addSet, completeSet, groupInSession, ungroupInSession, copyLastSession, deleteSet, elapsedMs, finishSession, getSessionSets, pauseSession, removeExerciseFromSession, resumeSession, startSession, uncompleteSet, updateSessionTarget, updateSet } from '../data/repo';
import { fmtDate, fmtDuration, fmtKg, intensityOf } from '../domain/calc';
import { MEASURE_UNIT, MUSCLE_LABEL, unitText } from '../domain/muscles';
import { recommend, type Recommendation } from '../domain/progression';
import { recentReadiness } from '../domain/recovery';
import { groupLabel, MAX_GROUP, unitsOf } from '../domain/superset';
import { SUPERSET_INFO, TECHNIQUE, TECHNIQUES } from '../domain/techniques';
import { defaultTarget, type EndReason, type ExerciseDef, type Measure, type Session, type SetLog, type Target, type Technique } from '../domain/types';
import { sessionsOf, type ASet } from '../domain/volume';
import { db } from '../data/db';
import { useActiveSession, useAllItems, useDoneSets, useExMap, useNow, useProfile, useRoutines, useUserId } from '../hooks';
import { Bar, Btn, Card, Chip, cx, Empty, Field, Icon, Seg, Sheet, Stepper, Title, useAction, useUi } from '../ui/components';
import { ExerciseThumb } from '../ui/EquipmentArt';
import { ExerciseDetail, ExercisePicker } from './Library';
import { useHoldDrag } from '../ui/useHoldDrag';
import { TargetEditor } from './RoutineEditor';

const REST_KEY = 'ii_rest';
const CUR_KEY = 'ii_cur_ex';
const HINT_KEY = 'ii_hint_gestures';
interface Rest { end: number; total: number }
const loadRest = (): Rest | null => { try { const r = JSON.parse(localStorage.getItem(REST_KEY) || 'null'); return r && r.end > Date.now() ? r : null; } catch { return null; } };
const storeRest = (r: Rest | null) => { try { r ? localStorage.setItem(REST_KEY, JSON.stringify(r)) : localStorage.removeItem(REST_KEY); } catch { /* sin almacenamiento */ } };

const ACTION_COLOR: Record<Recommendation['action'], string> = { increase: '#34e0a1', hold: '#58c7ff', hold_add_reps: '#58c7ff', decrease: '#ff9f45', deload: '#ff9f45', review_technique: '#f5c542' };

export function RecommendationCard({ rec, compact, measure = 'reps' }: { rec: Recommendation; compact?: boolean; measure?: Measure }) {
  const [open, setOpen] = useState(false);
  const color = ACTION_COLOR[rec.action];
  return (
    <div className="cursor-pointer rounded-panel p-4" style={{ background: color + '17' }} onClick={() => setOpen(!open)}>
      <button type="button" className="flex w-full items-start justify-between gap-3 text-left" aria-expanded={open}>
        <div className="min-w-0">
          <div className="wd-x text-[13px] font-extrabold leading-tight" style={{ color }}>{unitText(rec.title, measure)}</div>
          <div className="mt-0.5 font-semibold">{rec.weight != null ? `Peso sugerido: ${fmtKg(rec.weight)} kg` : 'Sin peso sugerido todavía'}</div>
        </div>
        <div className="wd-c shrink-0 text-right text-sm text-mute">Confianza {rec.confidenceLabel}<br /><span className="tnum text-chalk">{Math.round(rec.confidence * 100)} %</span></div>
      </button>
      {(open || !compact) && <p className="mt-2.5 text-sm text-chalk/90">{unitText(rec.reason, measure)}</p>}
      {open && (
        <div className="mt-3 border-t border-chalk/10 pt-3">
          <div className="label mb-1">Datos considerados</div>
          <ul className="space-y-0.5 text-sm text-mute">{rec.factors.map((f, i) => <li key={i}>{unitText(f, measure)}</li>)}</ul>
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

/** Nombre de una serie para los lectores de pantalla y los títulos: «serie 2» o «bajada 1 de la serie 2». */
const setName = (s: SetLog, n: number) => (s.sub ? `${TECHNIQUE[s.technique as Exclude<Technique, ''>]?.tag.toLowerCase() ?? 'tramo'} ${s.sub} de la serie ${n}` : `serie ${n}`);

/**
 * Al completar una serie la lista se reacomoda (la serie se pliega y se abre la siguiente). Durante ese instante
 * se ignoran los toques sobre las series: un segundo toque en el mismo lugar caería sobre otra fila.
 */
let tapLock = 0;
const tapLocked = () => Date.now() < tapLock;

/**
 * Lleva la serie recién completada justo bajo la cabecera. Debajo quedan a la vista la pregunta del RIR y la
 * serie siguiente, en vez de quedar tapadas por el descanso y la barra de navegación.
 */
function revealSet(id: string) {
  setTimeout(() => {
    const el = document.querySelector<HTMLElement>(`[data-set="${id}"]`);
    if (!el) return;
    const head = document.querySelector<HTMLElement>('[data-session-head]')?.getBoundingClientRect().bottom ?? 0;
    const top = el.getBoundingClientRect().top - head - 10;
    if (Math.abs(top) > 24) window.scrollBy({ top, behavior: 'smooth' });
  }, 60);
}

/** Escala de incandescencia: de hierro frío (lejos del fallo) a blanco (fallo). */
function RirScale({ rir, halfRir, onPick, small, of = '' }: { rir: number | null; halfRir: boolean; onPick: (r: number | null) => void; small?: boolean; of?: string }) {
  return (
    <div className="grid grid-cols-6 gap-px overflow-hidden rounded-ctl bg-ink" data-noswipe>
      {RIR_OPTS.map((r) => {
        const on = rir != null && (r === 5 ? rir >= 5 : Math.floor(rir) === r);
        const heat = intensityOf(r);
        return (
          <button type="button" key={r} aria-label={`RIR ${r === 5 ? '5 o más' : r}${of}`} aria-pressed={on} onClick={() => { if (!tapLocked()) onPick(on && !halfRir ? null : r); }}
            className={cx('num relative text-lg transition-colors', small ? 'h-11' : 'h-12', on ? 'text-ink' : 'bg-card2 text-mute hover:text-chalk')} style={on ? { background: heat.color, color: r >= 3 ? '#f3f1ec' : '#16181b' } : undefined}>
            {r === 5 ? '5+' : r}
            {!on && <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: heat.color }} />}
          </button>
        );
      })}
    </div>
  );
}

function SetRow({ s, n, step, measure, open, prev, halfRir, title, ask, onAsked, onOpen, onDone, onExtend }: { s: SetLog; n: number; step: number; measure: Measure; open: boolean; prev?: SetLog; halfRir: boolean; title?: string; ask?: boolean; onAsked?: () => void; onOpen: () => void; onDone: (saved: SetLog) => void; onExtend?: (added: SetLog, pause: number) => void }) {
  const unit = MEASURE_UNIT[measure];
  const run = useAction();
  const [more, setMore] = useState(false); const [tech, setTech] = useState(false);
  const info = intensityOf(s.rir);
  // En una biserie hay una «serie 1» por ejercicio: el nombre accesible incluye cuál.
  const name = setName(s, n) + (title ? ` de ${title}` : '');
  const tag = s.sub ? `${TECHNIQUE[s.technique as Exclude<Technique, ''>]?.tag ?? 'Tramo'} ${s.sub}` : null;
  const patch = (p: Partial<SetLog>) => run(() => updateSet(s.id, p));

  const label = tag ?? `Serie ${n}`;
  const Name = `${name[0].toUpperCase()}${name.slice(1)}`;
  const sum = `${fmtKg(s.weight)} kg × ${s.reps}${measure !== 'reps' ? ` ${unit}` : ''}`;
  const repsLabel = `${measure === 'reps' ? 'Repeticiones' : measure === 'time' ? 'Segundos' : 'Metros'} ${name}`;
  // Cada serie es una tarjeta propia con su estado a la vista: hecha, ahora o pendiente.
  // Una serie hecha nunca se despliega en la lista: se corrige en una hoja aparte, para que no parezca la serie en curso.
  const state: 'done' | 'active' | 'pending' = s.done ? 'done' : open ? 'active' : 'pending';
  const complete = async () => {
    if (tapLocked()) return;
    primeAudio();
    tapLock = Date.now() + 5000;
    try {
      // Se usa la serie tal como quedó guardada: si el peso se acababa de cambiar, la fila aún muestra el anterior.
      const saved = await run(() => completeSet(s.id));
      if (saved) { onDone(saved); revealSet(s.id); }
    } finally { tapLock = Date.now() + 500; }
  };
  const sheets = (
    <>
      <Sheet open={tech} onClose={() => setTech(false)} title="Alargar la serie" wide>
        <div className="space-y-2.5">
          {TECHNIQUES.map((t) => (
            <div key={t.id} className="rounded-panel bg-card2 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="wd-w font-bold">{t.name}</div>
                  <p className="mt-0.5 text-sm text-chalk/90">{t.how}</p>
                </div>
                <Btn size="sm" variant="primary" aria-label={`Añadir ${t.name}`} onClick={async () => { const x = await run(() => addExtension(s.id, t.id, step)); if (x) { setTech(false); onExtend?.(x, t.pause); } }}>Añadir</Btn>
              </div>
              <p className="mt-1.5 text-xs text-mute">{t.when} {t.evidence} <a href={t.source} target="_blank" rel="noreferrer" className="text-data underline">Fuente</a></p>
            </div>
          ))}
          <p className="text-xs text-mute">Cada tramo se anota con su carga y sus repeticiones. Suma tonelaje, pero en el volumen semanal cuenta como parte de la misma serie: es una convención práctica, no un valor medido.</p>
        </div>
      </Sheet>
      <Sheet open={more} onClose={() => setMore(false)} title={`${name[0].toUpperCase()}${name.slice(1)}, detalle`}>
        <div className="space-y-3">
          {s.done && (
            <div className="grid grid-cols-2 gap-3">
              <Stepper label={`Peso ${name}`} unit="kg" value={s.weight} step={step} max={1000} onChange={(v) => patch({ weight: v })} />
              <Stepper label={repsLabel} unit={unit} value={s.reps} step={measure === 'reps' ? 1 : 5} max={200} onChange={(v) => patch({ reps: Math.round(v) })} />
            </div>
          )}
          <Field label="¿Cómo terminó la serie?">
            <select value={s.endReason} onChange={(e) => patch({ endReason: e.target.value as EndReason })}>{REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Stepper label="RIR" value={s.rir ?? 0} step={halfRir ? 0.5 : 1} min={0} max={10} onChange={(v) => patch({ rir: v })} />
            <Stepper label="RPE (1–10)" value={s.rpe ?? 10 - (s.rir ?? 2)} step={0.5} min={1} max={10} onChange={(v) => patch({ rpe: v })} />
          </div>
          <p className="text-xs text-mute">El RPE se calcula como 10 − RIR; puedes ajustarlo si tu percepción difiere. Llegó al fallo: <b className="text-chalk">{s.failure ? 'sí' : 'no'}</b>.</p>
          <Field label="Observaciones"><textarea rows={2} defaultValue={s.note} onBlur={(e) => e.target.value !== s.note && patch({ note: e.target.value })} placeholder="Molestias, ajustes de la máquina, sensaciones…" /></Field>
          {s.done && s.restSec != null && <p className="text-xs text-mute">Descanso antes de esta serie: {s.restSec} s.</p>}
          {s.done && onExtend && !s.sub && <Btn className="w-full" icon="plus" onClick={() => { setMore(false); setTech(true); }}>Alargar con una técnica</Btn>}
          {s.done && <Btn className="w-full" aria-label={`Desmarcar ${name}`} onClick={async () => { if (tapLocked()) return; await run(() => uncompleteSet(s.id)); setMore(false); }}>Marcar como no hecha</Btn>}
          <Btn variant="danger" icon="trash" className="w-full" onClick={async () => { await run(() => deleteSet(s.id)); setMore(false); }}>{s.sub ? 'Eliminar tramo' : 'Eliminar serie'}</Btn>
        </div>
      </Sheet>
    </>
  );

  return (
    <div data-set={s.id} data-state={state} data-sum={`${s.weight}x${s.reps}`}
      // Mientras la lista se reacomoda tras completar una serie, ningún toque sobre las tarjetas tiene efecto:
      // un toque repetido caería sobre otro control (otra serie, un botón de peso, una técnica).
      onClickCapture={(e) => { if (tapLocked()) { e.stopPropagation(); e.preventDefault(); } }}
      className={cx('rounded-panel border transition-colors', state === 'active' ? 'border-fire/70 bg-card shadow-[0_0_0_3px_rgba(255,106,26,.12)]' : state === 'done' ? 'border-go/25 bg-go/[.05]' : 'border-line bg-white/[.02]', tag && 'ml-5')}>
      {state === 'done' && (
        <>
          <button type="button" onClick={() => { if (!tapLocked()) setMore(true); }} className="flex w-full items-center gap-3 px-3 py-2.5 text-left" aria-label={`${Name} completada, tocar para editar`}>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-go text-ink"><Icon name="check" size={15} /></span>
            <span className="min-w-0 flex-1">
              <span className="wd-c block truncate text-sm font-semibold text-go">{[label, title].filter(Boolean).join(', ')}, hecha</span>
              <span className="num block text-lg leading-tight">{sum}</span>
            </span>
            {!s.metTarget && <span className="wd-c text-sm font-semibold text-[#ff7a70]">bajo el rango</span>}
            <span className="wd-c flex shrink-0 items-center gap-1.5 text-[15px] font-semibold tnum" style={{ color: info.text }}><span className="h-2.5 w-2.5 rounded-full" style={{ background: info.color }} />{s.rir != null ? `RIR ${s.rir}` : 'sin RIR'}</span>
            <Icon name="edit" size={15} className="shrink-0 text-mute" />
          </button>
          {/* La serie ya quedó guardada: el RIR se puede marcar ahora, sin volver a abrirla. */}
          {ask && s.rir == null && (
            <div className="px-3 pb-3 animate-rise" role="group" aria-label={`RIR de la ${name}`}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold">¿Cuántas repeticiones te quedaban?</span>
                <button type="button" className="wd-c shrink-0 text-sm text-mute underline" onClick={() => { if (!tapLocked()) onAsked?.(); }}>Sin RIR</button>
              </div>
              <RirScale small of={` para la ${name}`} rir={s.rir} halfRir={halfRir} onPick={(r) => { void patch({ rir: r }); onAsked?.(); }} />
            </div>
          )}
        </>
      )}
      {state === 'pending' && (
        <button type="button" onClick={() => { if (!tapLocked()) onOpen(); }} className="flex w-full items-center gap-3 px-3 py-2.5 text-left" aria-label={`${Name} pendiente, tocar para hacerla ahora`}>
          <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-sm text-mute">{tag ? '+' : n}</span>
          <span className="min-w-0 flex-1">
            <span className="wd-c block truncate text-sm font-semibold text-mute">{[label, title].filter(Boolean).join(', ')}, pendiente</span>
            <span className="num block text-lg leading-tight text-chalk/55">{sum}</span>
          </span>
          <span className="wd-c shrink-0 text-sm text-mute">Hacer ahora</span>
        </button>
      )}
      {state === 'active' && (
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="wd-c min-w-0 truncate text-[15px] font-bold text-fire">{[label, title].filter(Boolean).join(', ')}</span>
            <span className="wd-c shrink-0 rounded-full bg-fire px-2.5 py-0.5 text-xs font-bold text-ink">Ahora</span>
          </div>
          <div className="flex items-center gap-2" data-noswipe>
            {/* El peso recibe más ancho: debe mostrar completas cifras como 122,5 o 247,5. */}
            <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-2">
              <Stepper compact label={`Peso ${name}`} unit="kg" value={s.weight} step={step} max={1000} onChange={(v) => patch({ weight: v })} />
              <Stepper compact label={repsLabel} unit={unit} value={s.reps} step={measure === 'reps' ? 1 : 5} max={200} onChange={(v) => patch({ reps: Math.round(v) })} />
            </div>
            <button type="button" aria-label={`Completar ${name}`} onClick={(e) => { e.stopPropagation(); void complete(); }}
              className="grid h-12 w-14 shrink-0 place-items-center rounded-ctl bg-fire text-ink transition active:scale-95">
              <Icon name="check" size={22} />
            </button>
          </div>
          <WeightWheel label={`Rueda de peso ${name}`} value={s.weight} step={step} onChange={(v) => patch({ weight: v })} />
          <div className="mt-3">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="label">Repeticiones en reserva (RIR)</span>
              <span className="wd-c text-sm font-semibold" style={{ color: info.text }}>{info.label}</span>
            </div>
            <RirScale rir={s.rir} halfRir={halfRir} onPick={(r) => patch({ rir: r })} />
            {halfRir && s.rir != null && s.rir < 5 && (
              <button type="button" className="wd-c mt-2 text-sm text-data" onClick={() => patch({ rir: Number.isInteger(s.rir) ? (s.rir as number) + 0.5 : Math.floor(s.rir as number) })}>
                {Number.isInteger(s.rir) ? `Marcar ${s.rir}.5 (medio punto)` : `RIR ${s.rir} · quitar medio punto`}
              </button>
            )}
            <div className={cx('mt-3 grid gap-1.5 [&>button]:whitespace-nowrap [&>button]:!px-2', prev && !s.sub && onExtend ? 'grid-cols-3' : 'grid-cols-2')}>
              {prev && !s.sub && <Btn size="sm" aria-label={`Igual que la serie ${n - 1}`} onClick={() => patch({ weight: prev.weight, reps: prev.reps })}>Igual a la {n - 1}</Btn>}
              <Btn size="sm" onClick={() => setMore(true)}>Detalle</Btn>
              {onExtend && <Btn size="sm" onClick={() => setTech(true)}>Técnica</Btn>}
            </div>
            {s.rpe != null && <div className="wd-c mt-2 text-sm text-mute tnum">RPE {s.rpe}</div>}
          </div>
        </div>
      )}
      {sheets}
    </div>
  );
}

/**
 * Rueda de peso: una cinta horizontal que se desliza con el pulgar y se detiene en cada carga posible.
 * Complementa a los botones; el valor se guarda cuando la cinta se queda quieta.
 */
function WeightWheel({ value, step, onChange, label }: { value: number; step: number; onChange: (v: number) => void; label: string }) {
  const W = 60;
  const ref = useRef<HTMLDivElement>(null);
  const inc = step > 0 ? step : 2.5;
  const top = Math.max(300, Math.ceil((value + 100) / 100) * 100);
  const onGrid = Math.abs(value / inc - Math.round(value / inc)) < 1e-6;
  const extra = onGrid ? null : value;
  const vals = useMemo(() => {
    const xs: number[] = [];
    for (let i = 0; i * inc <= top + 1e-9; i++) xs.push(Math.round(i * inc * 100) / 100);
    if (extra != null) { xs.push(extra); xs.sort((a, b) => a - b); }
    return xs;
  }, [inc, top, extra]);
  const idx = Math.max(0, vals.indexOf(value));
  const [mid, setMid] = useState(idx);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef({ value, vals, onChange }); latest.current = { value, vals, onChange };
  // Si el peso cambia por los botones o por otra serie, la cinta se coloca sola en ese valor.
  useEffect(() => {
    const el = ref.current;
    if (el && Math.abs(el.scrollLeft - idx * W) > 2) el.scrollLeft = idx * W;
    setMid(idx);
  }, [idx]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onScroll = () => {
    const el = ref.current; if (!el) return;
    const i = Math.min(vals.length - 1, Math.max(0, Math.round(el.scrollLeft / W)));
    setMid(i);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { const l = latest.current; const v = l.vals[Math.min(l.vals.length - 1, Math.max(0, Math.round((ref.current?.scrollLeft ?? 0) / W)))]; if (v != null && v !== l.value) l.onChange(v); }, 160);
  };
  return (
    <div className="mt-2.5" data-noswipe>
      <div className="relative">
        <div ref={ref} onScroll={onScroll} role="group" aria-label={label} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-ctl bg-ink/50" style={{ paddingInline: `calc(50% - ${W / 2}px)`, touchAction: 'pan-x pan-y' }}>
          {vals.map((v, i) => (
            <button type="button" key={v} tabIndex={-1} aria-hidden onClick={() => ref.current?.scrollTo({ left: i * W, behavior: 'smooth' })}
              className={cx('num shrink-0 snap-center text-center transition-colors', i === mid ? 'text-xl text-chalk' : Math.abs(i - mid) === 1 ? 'text-base text-chalk/55' : 'text-sm text-chalk/25')} style={{ width: W, height: 46 }}>
              {fmtKg(v)}
            </button>
          ))}
        </div>
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-[60px] -translate-x-1/2 rounded-ctl border-2 border-fire/70" />
      </div>
      <div className="wd-c mt-1 text-center text-xs text-mute">Desliza para cambiar el peso</div>
    </div>
  );
}

// ---------- Cabecera de un ejercicio: objetivo, última sesión y recomendación ----------
function useExerciseCtx(session: Session, ex: ExerciseDef, history: ASet[], readiness: number | null) {
  const target: Target = session.targets[ex.id] ?? defaultTarget(ex);
  const past = useMemo(() => sessionsOf(history, ex.id), [history, ex.id]);
  const rec = useMemo(() => recommend({ exType: ex.type, increment: ex.increment, target, history: past, readiness }), [ex, target, past, readiness]);
  return { target, past, rec, last: past[0] };
}

function ExerciseHead({ session, ex, history, readiness, compact, extra }: { session: Session; ex: ExerciseDef; history: ASet[]; readiness: number | null; compact?: boolean; extra?: React.ReactNode }) {
  const run = useAction();
  const { target, rec, last } = useExerciseCtx(session, ex, history, readiness);
  const [editTarget, setEditTarget] = useState(false); const [detail, setDetail] = useState(false); const [more, setMore] = useState(false);
  const unit = ex.measure === 'reps' ? 'Repeticiones' : ex.measure === 'time' ? 'Segundos' : 'Metros';
  // Ajuste de series que se aplicó al iniciar esta sesión por la valoración de las anteriores.
  const adjust = useMemo(() => { try { const a = JSON.parse(localStorage.getItem(ADJ_KEY) ?? 'null'); return a?.id === session.id ? Number(a.adj?.[ex.id] ?? 0) : 0; } catch { return 0; } }, [session.id, ex.id]);
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setDetail(true)} aria-label={`Ver técnica de ${ex.name}`}><ExerciseThumb ex={ex} size={compact ? 48 : 60} /></button>
          <div className="min-w-0 flex-1">
            <h2 className={cx('wd-w font-extrabold leading-tight', compact ? 'text-base' : 'text-xl')}>{ex.name}</h2>
            <div className="wd-c text-[15px]"><span className="font-semibold text-fire">{MUSCLE_LABEL[ex.primary]}</span>{!compact && ex.secondary.length > 0 && <span className="text-mute">, con {ex.secondary.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(' y ')}</span>}</div>
            {ex.machine && !compact && <div className="wd-c truncate text-sm text-mute">{ex.machine}</div>}
          </div>
          {extra}
        </div>
        <button type="button" onClick={() => setEditTarget(true)} aria-label={`Objetivo: ${target.sets} × ${target.repMin}–${target.repMax}, RIR ${target.rirMin}–${target.rirMax}. Editar`} className={cx('grid w-full grid-cols-4 divide-x divide-line rounded-ctl bg-card text-center transition-colors hover:bg-card2', compact ? 'mt-2.5 py-1.5' : 'mt-4 py-2.5')}>
          {[['Series', target.sets], [unit, `${target.repMin}–${target.repMax}`], ['RIR', target.rirMin === target.rirMax ? target.rirMin : `${target.rirMin}–${target.rirMax}`], ['Descanso', `${target.restSec} s`]].map(([k, v]) => (
            <span key={k} className="px-1"><span className="num block text-base leading-tight">{v}</span><span className="label block !text-xs">{k}</span></span>
          ))}
        </button>
        {adjust !== 0 && <p className="wd-c mt-2 text-sm text-data">{adjust > 0 ? 'Hoy una serie más: valoraste «Poco» este músculo dos veces seguidas.' : 'Hoy una serie menos: la última vez valoraste «Demasiado» este músculo.'}</p>}
        {(!compact || more) && (
          <p className={cx('text-[15px]', compact ? 'mt-2' : 'mt-3')}>
            <span className="text-mute">Última sesión: </span>
            {last ? <><b className="tnum">{[...new Set(last.sets.map((s) => s.weight))].map((w) => `${fmtKg(w)} kg × ${last.sets.filter((s) => s.weight === w).map((s) => s.reps).join(', ')}`).join(' y ')}</b>
              <span className="wd-c text-mute"> con RIR {last.sets.map((s) => s.rir ?? '–').join(', ')}, {fmtDate(last.date)}</span></> : <span className="text-mute">sin registros previos</span>}
          </p>
        )}
        {/* En una biserie la cabecera es breve: la recomendación completa se abre a pedido para llegar antes a las series. */}
        {compact && !more && (
          <button type="button" onClick={() => setMore(true)} aria-expanded={false} className="wd-c mt-2 block w-full truncate text-left text-sm text-mute">
            <span className="font-semibold text-data">{rec.weight != null ? `Sugerido: ${fmtKg(rec.weight)} kg` : 'Sin peso sugerido'}</span>. Ver recomendación y última sesión
          </button>
        )}
      </div>
      {(!compact || more) && <RecommendationCard rec={rec} compact measure={ex.measure} />}
      <Sheet open={editTarget} onClose={() => setEditTarget(false)} title="Objetivo de hoy">
        <TargetEditor value={target} measure={ex.measure} onChange={(t) => run(() => updateSessionTarget(session.id, ex.id, t))} />
        <p className="mt-3 text-xs text-mute">Cambia solo esta sesión. Para cambiarlo de forma permanente, edita la rutina.</p>
      </Sheet>
      <ExerciseDetail ex={detail ? ex : null} onClose={() => setDetail(false)} />
    </div>
  );
}

/** Series principales de un ejercicio con sus tramos de técnica a continuación. */
/** Aviso de récord al completar una serie: se compara con el historial y con lo ya hecho hoy. */
function recordText(history: ASet[], today: SetLog[], s: SetLog): string | null {
  if (s.sub) return null;
  const before: ASet[] = [...history, ...today.filter((x) => x.done && x.id !== s.id && x.exerciseId === s.exerciseId && !x.sub).map((x) => ({ sessionId: x.sessionId, exerciseId: x.exerciseId, date: 0, order: x.order, weight: x.weight, reps: x.reps, rir: x.rir, failure: x.failure, endReason: x.endReason }))];
  const r = isRecord(before, s.exerciseId, s.weight, s.reps, s.rir);
  return r === 'weight' ? `Nuevo récord de carga: ${fmtKg(s.weight)} kg` : r === 'e1rm' ? 'Nuevo récord: tu mejor 1RM estimado en este ejercicio' : null;
}

const familiesOf = (sets: SetLog[]) => sets.filter((s) => !s.sub).map((m) => ({ main: m, ext: sets.filter((x) => x.sub > 0 && x.order === m.order) }));

/** Lista de ejercicios con los que se puede formar o ampliar una biserie. */
function JoinSheet({ open, onClose, session, units, ex, title, onPick }: { open: boolean; onClose: () => void; session: Session; units: string[][]; ex: Map<string, ExerciseDef>; title: string; onPick: (unit: string[]) => void }) {
  void session;
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="mb-3 text-sm text-chalk/90">{SUPERSET_INFO.how}</p>
      <div className="space-y-2">
        {units.map((u) => (
          <button type="button" key={u[0]} onClick={() => { onPick(u); onClose(); }} className="flex w-full items-center gap-3 rounded-panel bg-card2 p-2.5 text-left">
            {ex.get(u[0]) && <ExerciseThumb ex={ex.get(u[0])!} size={44} />}
            <span className="min-w-0 flex-1 font-semibold leading-tight">{u.map((id) => ex.get(id)?.name ?? 'Ejercicio').join(' + ')}</span>
          </button>
        ))}
        {!units.length && <p className="py-4 text-center text-sm text-mute">No hay otro ejercicio en la sesión con el que unirlo. Añade uno primero.</p>}
      </div>
      <p className="mt-3 text-xs text-mute">{SUPERSET_INFO.evidence} <a href={SUPERSET_INFO.source} target="_blank" rel="noreferrer" className="text-data underline">Fuente</a></p>
    </Sheet>
  );
}

// ---------- Panel del ejercicio actual ----------
function ExercisePanel({ session, ex, sets, history, readiness, halfRir, onRest, onNext, hasNext, joinable, exMap }: { session: Session; ex: ExerciseDef; sets: SetLog[]; history: ASet[]; readiness: number | null; halfRir: boolean; onRest: (sec: number) => void; onNext: () => void; hasNext: boolean; joinable: string[][]; exMap: Map<string, ExerciseDef> }) {
  const run = useAction(); const { confirm, toast } = useUi();
  const { target, last } = useExerciseCtx(session, ex, history, readiness);
  const firstOpen = sets.find((s) => !s.done)?.id ?? null;
  const [openId, setOpenId] = useState<string | null>(firstOpen);
  useEffect(() => { setOpenId(firstOpen); }, [ex.id, firstOpen]);
  // La serie en curso es siempre una pendiente: si la elegida ya se completó, pasa a ser la primera sin hacer.
  const activeId = sets.some((x) => x.id === openId && !x.done) ? openId : firstOpen;
  const [join, setJoin] = useState(false);
  // Serie recién completada sin RIR: se pregunta debajo de ella en vez de obligar a marcarlo antes.
  const [askId, setAskId] = useState<string | null>(null);
  const fams = familiesOf(sets);
  const allDone = sets.length > 0 && sets.every((s) => s.done);
  const done = (s: SetLog) => {
    onRest(target.restSec); setAskId(s.rir == null ? s.id : null);
    const nx = sets.find((x) => !x.done && x.id !== s.id); setOpenId(nx?.id ?? null);
    const rec = recordText(history, sets, s);
    if (rec) toast(rec); else if (!nx) toast('Ejercicio completado');
  };
  const extend = (x: SetLog, pause: number) => { setOpenId(x.id); onRest(pause); };

  return (
    <div className="space-y-3">
      <ExerciseHead session={session} ex={ex} history={history} readiness={readiness} />

      <div className="space-y-2.5">
        {fams.map((f, i) => [f.main, ...f.ext].map((s) => (
          <SetRow key={s.id} s={s} n={i + 1} step={ex.increment} measure={ex.measure} open={activeId === s.id} prev={fams[i - 1]?.main} halfRir={halfRir} ask={askId === s.id} onAsked={() => setAskId(null)}
            onOpen={() => setOpenId(s.id)} onDone={done} onExtend={extend} />
        )))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Btn icon="plus" className="whitespace-nowrap" onClick={async () => { const s = await run(() => addSet(session.id, ex.id)); if (s) setOpenId(s.id); }}>Añadir serie</Btn>
        <Btn icon="copy" className="whitespace-nowrap" disabled={!last} aria-label="Copiar la sesión anterior" onClick={() => run(async () => { await copyLastSession(session.id, ex.id); }, 'Series copiadas de la sesión anterior')}>Copiar anterior</Btn>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Btn icon="plus" className="whitespace-nowrap !px-2" aria-label="Unir en biserie con otro ejercicio" onClick={() => setJoin(true)}>Unir en biserie</Btn>
        <ToolsButton ex={ex} weight={sets.find((s) => !s.done)?.weight ?? sets[sets.length - 1]?.weight ?? 0} className="whitespace-nowrap !px-2" />
      </div>
      {allDone && hasNext && <Btn variant="primary" size="lg" className="w-full" icon="right" onClick={onNext}>Siguiente ejercicio</Btn>}
      <button type="button" className="wd-c w-full py-2 text-sm text-mute underline" onClick={async () => { if (await confirm(`Se quitará “${ex.name}” de esta sesión junto con sus series.`, { confirmLabel: 'Quitar', danger: true })) await run(() => removeExerciseFromSession(session.id, ex.id)); }}>Quitar este ejercicio de la sesión</button>

      <JoinSheet open={join} onClose={() => setJoin(false)} session={session} units={joinable} ex={exMap} title="Unir en biserie"
        onPick={(u) => run(() => groupInSession(session.id, ex.id, u[0]), u.length >= 2 ? 'Triserie creada' : 'Biserie creada')} />
    </div>
  );
}

// ---------- Panel de una biserie o triserie ----------
function GroupPanel({ session, exs, sets, history, readiness, halfRir, onRest, onNext, hasNext, joinable, exMap }: { session: Session; exs: ExerciseDef[]; sets: SetLog[]; history: ASet[]; readiness: number | null; halfRir: boolean; onRest: (sec: number) => void; onNext: () => void; hasNext: boolean; joinable: string[][]; exMap: Map<string, ExerciseDef> }) {
  const run = useAction(); const { toast } = useUi();
  const label = groupLabel(exs.length);
  const byEx = exs.map((e) => ({ ex: e, fams: familiesOf(sets.filter((s) => s.exerciseId === e.id)) }));
  const rounds = Math.max(0, ...byEx.map((b) => b.fams.length));
  // Orden de trabajo: ronda a ronda, y dentro de cada ronda, ejercicio tras ejercicio.
  const sequence = Array.from({ length: rounds }, (_, r) => byEx.flatMap((b) => (b.fams[r] ? [b.fams[r].main, ...b.fams[r].ext] : []))).flat();
  const firstOpen = sequence.find((s) => !s.done)?.id ?? null;
  const [openId, setOpenId] = useState<string | null>(firstOpen);
  useEffect(() => { setOpenId(firstOpen); }, [firstOpen]);
  const activeId = sequence.some((x) => x.id === openId && !x.done) ? openId : firstOpen;
  const [join, setJoin] = useState(false);
  const [askId, setAskId] = useState<string | null>(null);
  const rest = Math.max(0, ...exs.map((e) => (session.targets[e.id] ?? defaultTarget(e)).restSec));
  const allDone = sets.length > 0 && sets.every((s) => s.done);

  const done = (s: SetLog, round: number) => {
    const roundSets = byEx.flatMap((b) => (b.fams[round] ? [b.fams[round].main] : []));
    const pendingInRound = roundSets.some((x) => !x.done && x.id !== s.id);
    const nx = sequence.find((x) => !x.done && x.id !== s.id);
    setOpenId(nx?.id ?? null);
    setAskId(s.rir == null ? s.id : null);
    // Dentro de la ronda no hay descanso: se pasa de inmediato al siguiente ejercicio.
    onRest(pendingInRound ? 0 : rest);
    const rec = recordText(history, sets, s);
    if (rec) toast(rec); else if (!nx) toast(`${label} completada`);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-panel bg-fire/10 p-3">
        <div className="wd-x text-[13px] font-extrabold text-fire">{label.toUpperCase()}</div>
        <p className="mt-0.5 text-sm text-chalk/90">Haz los {exs.length} ejercicios seguidos, sin descanso. Una serie es la ronda completa; el descanso de {rest} s empieza al terminarla.</p>
      </div>

      {byEx.map(({ ex }) => (
        <ExerciseHead key={ex.id} session={session} ex={ex} history={history} readiness={readiness} compact
          extra={<Btn size="sm" aria-label={`Separar ${ex.name} de la ${label.toLowerCase()}`} onClick={() => run(() => ungroupInSession(session.id, ex.id), 'Ejercicio separado')}>Separar</Btn>} />
      ))}

      {Array.from({ length: rounds }, (_, r) => (
        <section key={r} aria-label={`Ronda ${r + 1}`}>
          <div className="label mb-1.5">Ronda {r + 1} de {rounds}</div>
          <div className="space-y-2.5">
            {byEx.flatMap(({ ex, fams }) => (fams[r] ? [fams[r].main, ...fams[r].ext] : []).map((s) => (
              <SetRow key={s.id} s={s} n={r + 1} step={ex.increment} measure={ex.measure} open={activeId === s.id} prev={fams[r - 1]?.main} halfRir={halfRir} title={ex.name} ask={askId === s.id} onAsked={() => setAskId(null)}
                onOpen={() => setOpenId(s.id)} onDone={(x) => done(x, r)} onExtend={(x, pause) => { setOpenId(x.id); onRest(pause); }} />
            )))}
          </div>
        </section>
      ))}

      <div className="grid grid-cols-2 gap-2">
        <Btn icon="plus" className="whitespace-nowrap" onClick={() => run(async () => { for (const e of exs) await addSet(session.id, e.id); }, 'Ronda añadida')}>Añadir ronda</Btn>
        <Btn icon="plus" className="whitespace-nowrap" disabled={exs.length >= MAX_GROUP} aria-label="Sumar un ejercicio" onClick={() => setJoin(true)}>Sumar ejercicio</Btn>
      </div>
      {allDone && hasNext && <Btn variant="primary" size="lg" className="w-full" icon="right" onClick={onNext}>Siguiente ejercicio</Btn>}

      <JoinSheet open={join} onClose={() => setJoin(false)} session={session} units={joinable.filter((u) => u.length === 1)} ex={exMap} title="Pasar a triserie"
        onPick={(u) => run(() => groupInSession(session.id, u[0], exs[0].id), 'Triserie creada')} />
    </div>
  );
}

// ---------- Temporizador de descanso ----------
function RestBar({ rest, now, onChange }: { rest: Rest; now: number; onChange: (r: Rest | null) => void }) {
  const left = Math.max(0, rest.end - now);
  const pct = rest.total > 0 ? left / (rest.total * 1000) : 0;
  return (
    <div className="fixed inset-x-0 bottom-[108px] z-30 px-3 md:bottom-4 md:left-60" role="timer" aria-label="Descanso">
      <div className="mx-auto flex max-w-xl items-center gap-2 glass-bar rounded-panel p-3 animate-rise [&>button]:shrink-0">
        <svg width="46" height="46" viewBox="0 0 46 46" className="shrink-0 -rotate-90"><circle cx="23" cy="23" r="19" stroke="rgba(255,255,255,.12)" strokeWidth="5" fill="none" /><circle cx="23" cy="23" r="19" stroke="#58c7ff" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={119.4} strokeDashoffset={119.4 * (1 - Math.min(1, pct))} /></svg>
        <div className="min-w-0 flex-1">
          <div className="num text-2xl leading-none">{fmtDuration(left)}</div>
          <div className="label mt-0.5 whitespace-nowrap !text-data">descanso</div>
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
  const loaded = useLiveQuery(() => getSessionSets(session.id), [session.id]);
  const sets = useMemo(() => loaded ?? [], [loaded]);
  const logs = useLiveQuery(() => db.recovery.where('userId').equals(uid).toArray(), [uid]) ?? [];
  const readiness = useMemo(() => recentReadiness(logs.filter((l) => !l.deleted), Date.now()), [logs]);
  // El ejercicio elegido se recuerda por sesión: una sesión nueva no hereda el de la anterior.
  const [cur, setCur] = useState<string | null>(() => { try { const [sid, id] = (localStorage.getItem(CUR_KEY) ?? '').split('|'); return sid === session.id && id ? id : null; } catch { return null; } });
  const [rest, setRestState] = useState<Rest | null>(loadRest);
  const [picker, setPicker] = useState(false);
  const paused = session.status === 'paused';
  const now = useNow(rest ? 250 : 1000, !paused || !!rest);

  const ids = session.exerciseIds;
  const units = useMemo(() => unitsOf(ids, session.supersets), [ids, session.supersets]);
  const current = cur && ids.includes(cur) ? cur : ids.find((id) => sets.some((s) => s.exerciseId === id && !s.done)) ?? ids[0] ?? null;
  const unitIdx = current ? units.findIndex((u) => u.includes(current)) : -1;
  const unit = unitIdx >= 0 ? units[unitIdx] : null;
  const [slide, setSlide] = useState<'l' | 'r' | null>(null);
  const pin = (id: string) => { setCur(id); try { localStorage.setItem(CUR_KEY, `${session.id}|${id}`); } catch { /* sin almacenamiento */ } };
  const select = (id: string) => { pin(id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  // El ejercicio en pantalla no cambia solo: al completar su última serie se queda ahí (para marcar el RIR
  // o añadir otra serie) hasta que se elige el siguiente.
  useEffect(() => { if (loaded && current && current !== cur) pin(current); }, [loaded, current, cur]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Pasa a la unidad anterior o siguiente (un ejercicio suelto o una biserie completa). */
  const step = (dir: -1 | 1) => { const nx = units[unitIdx + dir]; if (!nx) return false; setSlide(dir > 0 ? 'l' : 'r'); select(nx[0]); return true; };
  const [hint, setHint] = useState(() => { try { return !localStorage.getItem(HINT_KEY); } catch { return false; } });
  const learned = () => { setHint(false); try { localStorage.setItem(HINT_KEY, '1'); } catch { /* sin almacenamiento */ } };

  // Unir ejercicios: mantener presionado uno y soltarlo sobre otro.
  const unitOf = (id: string) => units.find((u) => u.includes(id)) ?? [id];
  const drag = useHoldDrag(
    (dragId, targetId) => { void run(() => groupInSession(session.id, dragId, targetId), unitOf(targetId).length >= 2 ? 'Triserie creada' : 'Biserie creada').then(() => select(targetId)); learned(); },
    (dragId, targetId) => unitOf(dragId).length === 1 && !unitOf(targetId).includes(dragId),
  );

  // Deslizar a los lados para cambiar de ejercicio.
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const el = e.target as HTMLElement;
    touch.current = e.touches.length === 1 && !el.closest('input, textarea, select, canvas, [data-noswipe], [role=dialog]') ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current; touch.current = null;
    if (!s || drag.dragging) return;
    const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.8 && Date.now() - s.t < 800 && step(dx < 0 ? 1 : -1)) learned();
  };
  const setRest = (r: Rest | null) => { storeRest(r && r.end > Date.now() ? r : null); setRestState(r && r.end > Date.now() ? r : null); };
  /** Inicia el descanso; con 0 segundos lo cancela (paso inmediato al siguiente ejercicio de una biserie o a una bajada). */
  const restFor = (sec: number) => { void clearRestNotice(); setRest(sec > 0 ? { end: Date.now() + sec * 1000, total: sec } : null); };

  useEffect(() => {
    if (rest && now >= rest.end) {
      setRest(null); try { navigator.vibrate?.([250, 120, 250]); } catch { /* sin vibración */ } toast('Descanso terminado');
      if (profile.settings?.restSound !== false) beep();
      if (profile.settings?.restAlert) {
        const nx = sets.find((s) => !s.done && (!current || s.exerciseId === current)) ?? sets.find((s) => !s.done);
        void notifyRestEnd(nx ? `Sigue: ${ex.get(nx.exerciseId)?.name ?? 'siguiente serie'}, ${fmtKg(nx.weight)} kg × ${nx.reps}` : 'Vuelve cuando quieras a tu entrenamiento');
      }
    }
  }, [now, rest]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al entrar, la sesión se muestra desde arriba aunque la pantalla anterior quedara desplazada.
  useEffect(() => { window.scrollTo(0, 0); }, []);

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

  // El avance cuenta series principales; los tramos de técnica son parte de su serie.
  const mains = sets.filter((s) => !s.sub);
  const done = mains.filter((s) => s.done).length;
  const curEx = current ? ex.get(current) : undefined;
  const joinable = units.filter((u) => u !== unit && u.length < MAX_GROUP);

  const finish = async () => {
    const pending = mains.length - done;
    const msg = done === 0 ? 'No completaste ninguna serie: la sesión se descartará.' : pending > 0 ? `Quedan ${pending} series sin completar; se descartarán. ¿Finalizar el entrenamiento?` : '¿Finalizar y guardar el entrenamiento?';
    if (!(await confirm(msg, { confirmLabel: done === 0 ? 'Descartar' : 'Finalizar', danger: done === 0 }))) return;
    const res = await run(() => finishSession(session.id));
    setRest(null); try { localStorage.removeItem(CUR_KEY); } catch { /* sin almacenamiento */ }
    if (res) { toast('Entrenamiento guardado'); nav(`/historial?s=${res.id}`); } else { toast('Sesión descartada'); nav('/'); }
  };

  return (
    <div className={rest ? 'pb-24' : ''}>
      <div data-session-head className="sticky top-0 z-20 -mx-4 mb-3 border-b border-line bg-ink/70 px-4 pb-3 pt-2 backdrop-blur-xl md:-mx-8 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="wd-w truncate font-bold leading-tight">{session.name}</div>
            <div className="wd-c truncate text-sm font-semibold text-fire">{paused ? 'En pausa' : 'Entrenamiento en curso'}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="num text-xl" aria-label="Tiempo transcurrido">{fmtDuration(elapsedMs(session, now))}</span>
            <Btn size="sm" icon={paused ? 'play' : 'pause'} aria-label={paused ? 'Reanudar' : 'Pausar'} onClick={() => run(() => (paused ? resumeSession(session.id) : pauseSession(session.id)))} />
            <Btn size="sm" variant="go" onClick={finish}>Finalizar</Btn>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Bar value={done} max={mains.length || 1} color="#34e0a1" height={5} />
          <span className="wd-c shrink-0 text-sm font-semibold tnum text-mute">{done}/{mains.length} series</span>
        </div>
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1" data-drop-scroll data-noswipe>
        {units.map((u, i) => {
          const xs = mains.filter((s) => u.includes(s.exerciseId)); const d = xs.filter((s) => s.done).length;
          const name = u.map((id) => ex.get(id)?.name ?? 'Ejercicio').join(' + ');
          const isCur = u === unit; const single = u.length === 1;
          return (
            <span key={u[0]} data-drop-id={u[0]} {...(single ? drag.bind(u[0], name) : {})}
              className={cx('shrink-0 rounded-full transition', drag.over === u[0] && 'ring-2 ring-fire ring-offset-2 ring-offset-ink', drag.dragging === u[0] && 'opacity-40')}>
              <Chip active={isCur} color={d === xs.length && xs.length ? '#34e0a1' : '#ff6a1a'} onClick={drag.guard(() => select(u[0]))}>
                {/* Nombres largos se recortan para que quepan varios ejercicios en la fila. */}
                <span className="inline-block max-w-[12.5rem] truncate align-bottom">{i + 1}. {single ? name : `${groupLabel(u.length)}: ${name}`}</span> <span className="tnum opacity-60">{d}/{xs.length}</span>
              </Chip>
            </span>
          );
        })}
        <Chip onClick={() => setPicker(true)}>+ Ejercicio</Chip>
      </div>
      {hint && units.length > 1 && <p className="wd-c -mt-1 mb-3 text-sm text-mute">Desliza a los lados para cambiar de ejercicio. Mantén presionado uno y arrástralo sobre otro para unirlos en biserie.</p>}
      {drag.ghost}
      {/* En el teléfono caben pocos ejercicios en la fila: al arrastrar se muestran todos los destinos en una lista. */}
      {drag.dragging && (
        <div className="fixed inset-x-0 bottom-[112px] z-50 px-3 md:bottom-4 md:left-60" data-drop-zone aria-hidden>
          <div className="glass-bar mx-auto max-w-xl rounded-panel p-2 animate-rise">
            <div className="label px-2 pb-1.5">Suelta sobre un ejercicio para unirlos</div>
            <div className="space-y-1.5">
              {units.filter((u) => !u.includes(drag.dragging!) && u.length < MAX_GROUP).map((u) => (
                <div key={u[0]} data-drop-id={u[0]} className={cx('truncate rounded-ctl px-3 py-3 font-semibold transition-colors', drag.over === u[0] ? 'bg-fire text-ink' : 'bg-card')}>
                  {u.length >= 2 ? `${groupLabel(u.length)}: ` : ''}{u.map((id) => ex.get(id)?.name ?? 'Ejercicio').join(' + ')}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {session.notes?.includes(DELOAD_TAG) && <div className="mb-3 rounded-ctl bg-data/10 p-3 text-sm"><b className="text-data">Semana de descarga.</b> Menos series, menos carga y lejos del fallo: hoy toca recuperar.</div>}
      {paused && <div className="mb-3 rounded-ctl bg-card2 p-3 text-sm text-mute">Sesión en pausa: el cronómetro está detenido. Puedes seguir registrando o reanudar.</div>}

      {/* pan-y: el desplazamiento vertical sigue siendo del navegador; el horizontal queda para cambiar de ejercicio. */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={() => { touch.current = null; }} className="min-h-[50vh]" style={{ touchAction: 'pan-y' }}>
        <div key={unit?.join('+') ?? 'none'} className={slide === 'l' ? 'animate-slidel' : slide === 'r' ? 'animate-slider' : undefined}>
          {unit && unit.length >= 2 ? (
            <GroupPanel session={session} exs={unit.map((id) => ex.get(id)).filter((e): e is ExerciseDef => !!e)} sets={sets.filter((s) => unit.includes(s.exerciseId))} history={history} readiness={readiness} halfRir={profile.halfRir}
              onRest={restFor} hasNext={unitIdx < units.length - 1} onNext={() => step(1)} joinable={joinable} exMap={ex} />
          ) : curEx ? (
            <ExercisePanel session={session} ex={curEx} sets={sets.filter((s) => s.exerciseId === curEx.id)} history={history} readiness={readiness} halfRir={profile.halfRir}
              onRest={restFor} hasNext={unitIdx < units.length - 1} onNext={() => step(1)} joinable={joinable} exMap={ex} />
          ) : (
            <Empty icon="dumbbell" title="Añade tu primer ejercicio" text="Elige un ejercicio de la biblioteca para empezar a registrar series."><Btn variant="primary" icon="plus" onClick={() => setPicker(true)}>Añadir ejercicio</Btn></Empty>
          )}
        </div>
      </div>

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
