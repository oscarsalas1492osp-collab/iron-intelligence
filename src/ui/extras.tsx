// Funciones añadidas alrededor del registro: ayudas de gimnasio, compartir, ciclo, plan, importación,
// medidas y paneles de constancia, equilibrio y fuerza. Cada componente busca sus propios datos.
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../data/db';
import { createFromPlan, elapsedMs, importSessions, importSharedRoutine, mine, rateSession, saveMeasures, shareableRoutine, softDelete, updateSettings } from '../data/repo';
import { DAY, fmtDate, fmtDuration, fmtKg, weekStart, ymd } from '../domain/calc';
import { cycleInfo } from '../domain/cycle';
import { RATINGS } from '../domain/feedback';
import { generatePlan } from '../domain/generator';
import { parseWorkouts } from '../domain/importers';
import { adherence, balance, LEVELS, strengthLevels, weekStreak } from '../domain/insights';
import { MUSCLE_LABEL } from '../domain/muscles';
import { decodeRoutine, encodeRoutine } from '../domain/share';
import { BARS, PLATES, platesPerSide, warmupSets } from '../domain/tools';
import type { ExerciseDef, Session, SetLog, Settings } from '../domain/types';
import { inWeek, mainSets, muscleVolume, tonnage } from '../domain/volume';
import { useDoneSets, useExercises, useExMap, useProfile, useSessions, useUserId } from '../hooks';
import { askNotify, canNotify, primeAudio } from './alerts';
import { Bar, Btn, Card, Empty, Field, H2, Icon, Seg, Sheet, Stepper, Title, useAction, useUi } from './components';
import { drawCard, shareBlob, shareLink, type CardData } from './shareCard';

const PLATE_LOADED = ['barbell', 'ez_bar', 'trap_bar', 'smith', 'landmine', 'lever', 'plate', 'sled'];

// ---------- Calentamiento y discos ----------
export function ToolsButton({ ex, weight, className }: { ex: ExerciseDef; weight: number; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Btn className={className} aria-label="Calentamiento y calculadora de discos" onClick={() => setOpen(true)}>Calentar y discos</Btn>
      {open && <ToolsSheet ex={ex} weight={weight} onClose={() => setOpen(false)} />}
    </>
  );
}
function ToolsSheet({ ex, weight, onClose }: { ex: ExerciseDef; weight: number; onClose: () => void }) {
  const st = useProfile().settings ?? {}; const run = useAction();
  const loaded = PLATE_LOADED.includes(ex.equipment);
  const [tab, setTab] = useState<'warm' | 'plates'>('warm');
  const [w, setW] = useState(weight);
  const [doneIdx, setDoneIdx] = useState<number[]>([]);
  const bar = st.bar ?? (ex.equipment === 'barbell' || ex.equipment === 'smith' ? 20 : ex.equipment === 'ez_bar' ? 10 : 0);
  const warm = warmupSets(w, ex.increment, ex.equipment === 'barbell' ? bar : 0);
  const pl = platesPerSide(w, bar, st.plates?.length ? st.plates : PLATES);
  return (
    <Sheet open onClose={onClose} title={ex.name}>
      <div className="space-y-4">
        <Seg options={[{ value: 'warm', label: 'Calentamiento' }, { value: 'plates', label: 'Discos' }]} value={tab} onChange={setTab} />
        <Stepper label="Peso de trabajo (kg)" value={w} step={ex.increment || 2.5} max={1000} onChange={setW} />
        {tab === 'warm' ? (
          <div>
            {warm.length ? (
              <div className="space-y-1.5">
                {warm.map((s, i) => {
                  const on = doneIdx.includes(i);
                  return (
                    <button type="button" key={i} aria-pressed={on} onClick={() => setDoneIdx(on ? doneIdx.filter((x) => x !== i) : [...doneIdx, i])} className="flex w-full items-center gap-3 rounded-ctl bg-card2 px-3 py-2.5 text-left">
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${on ? 'bg-go text-ink' : 'border border-line'}`}>{on && <Icon name="check" size={13} />}</span>
                      <span className="num flex-1 text-lg">{fmtKg(s.weight)} kg × {s.reps}</span>
                      <span className="wd-c text-sm text-mute">{Math.round(s.pct * 100)} %</span>
                    </button>
                  );
                })}
              </div>
            ) : <p className="text-sm text-mute">Indica el peso de trabajo para calcular las series de aproximación.</p>}
            <p className="mt-3 text-xs text-mute">Series de aproximación, lejos del fallo, solo antes de la primera serie de trabajo. No se registran ni cuentan en el volumen. Los porcentajes son una convención práctica.</p>
          </div>
        ) : (
          <div>
            <div className="label mb-1.5">Barra</div>
            <Seg options={BARS.map((b) => ({ value: b, label: b ? `${fmtKg(b)} kg` : 'Sin barra' }))} value={bar} onChange={(b) => run(() => updateSettings({ bar: b }))} />
            <div className="mt-4 rounded-panel bg-card2 p-4 text-center">
              <div className="label">Por cada lado</div>
              {pl.side.length ? (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                  {pl.side.map((p, i) => <span key={i} className="num grid place-items-center rounded-lg bg-fire/90 px-2 text-ink" style={{ height: 34 + Math.min(30, p * 1.2), minWidth: 44 }}>{fmtKg(p)}</span>)}
                </div>
              ) : <div className="mt-2 text-sm text-mute">{w <= bar ? 'Solo la barra.' : 'Indica un peso mayor que la barra.'}</div>}
              {pl.rest > 0 && <div className="mt-2 text-sm text-[#ffb054]">Faltan {fmtKg(pl.rest)} kg que no se pueden cargar con estos discos.</div>}
            </div>
            {!loaded && <p className="mt-3 text-xs text-mute">Este ejercicio no suele cargarse con discos; la calculadora sirve igual si tu máquina los usa.</p>}
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ---------- Panel de inicio: racha, ciclo y compartir la semana ----------
export function WeekExtras() {
  const profile = useProfile(); const ex = useExMap(); const { toast } = useUi(); const nav = useNavigate();
  const sessions = (useSessions() ?? []).filter((s) => s.status === 'done');
  const sets = useDoneSets() ?? [];
  const streak = useMemo(() => weekStreak(sessions.map((s) => s.startedAt)), [sessions]);
  const info = cycleInfo(profile.settings?.cycle);
  const [busy, setBusy] = useState(false);
  const share = async () => {
    setBusy(true);
    try {
      const ws = weekStart(Date.now()); const wk = inWeek(sets, ws);
      const vol = muscleVolume(wk, ex, profile.indirectCoef).filter((v) => v.direct > 0).sort((a, b) => b.direct - a.direct);
      const card: CardData = {
        kicker: 'Mi semana de entrenamiento', title: `${sessions.filter((s) => s.startedAt >= ws).length} sesiones, ${mainSets(wk).length} series`,
        subtitle: `Semana del ${fmtDate(ws)}`,
        stats: [{ value: String(mainSets(wk).length), label: 'series' }, { value: (tonnage(wk) / 1000).toFixed(1).replace('.', ','), label: 'toneladas' }, { value: String(streak), label: 'racha semanal' }],
        lines: vol.slice(0, 7).map((v) => ({ left: MUSCLE_LABEL[v.muscle], right: `${v.direct} series` })),
      };
      const how = await shareBlob(await drawCard(card), 'mi-semana-iron-intelligence.png', 'Mi semana en Iron Intelligence');
      if (how === 'downloaded') toast('Imagen descargada');
    } catch (e) { toast(e instanceof Error ? e.message : 'No se pudo crear la imagen', 'error'); }
    setBusy(false);
  };
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
      <span className="wd-c inline-flex items-center gap-1.5 rounded-full bg-card2 px-3 py-1.5 text-sm font-semibold"><Icon name="trophy" size={15} className="text-amber" />{streak ? `Racha: ${streak} ${streak === 1 ? 'semana' : 'semanas'}` : 'Sin racha todavía'}</span>
      <button type="button" onClick={() => nav('/perfil')} className="wd-c inline-flex items-center gap-1.5 rounded-full bg-card2 px-3 py-1.5 text-sm font-semibold"><Icon name="rotate" size={15} className="text-data" />{info ? info.label : 'Sin ciclo'}</button>
      <button type="button" disabled={busy || !sessions.length} onClick={share} className="wd-c ml-auto inline-flex items-center gap-1.5 rounded-full bg-fire/15 px-3 py-1.5 text-sm font-semibold text-amber disabled:opacity-40"><Icon name="up" size={15} />Compartir semana</button>
    </div>
  );
}

// ---------- Compartir una sesión ----------
export function ShareSessionButton({ session, sets }: { session: Session; sets: SetLog[] }) {
  const ex = useExMap(); const { toast } = useUi(); const [busy, setBusy] = useState(false);
  const share = async () => {
    setBusy(true);
    try {
      const done = sets.filter((s) => s.done), main = done.filter((s) => !s.sub);
      const lines = session.exerciseIds.map((id) => {
        const xs = main.filter((s) => s.exerciseId === id);
        if (!xs.length) return null;
        const top = xs.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a));
        return { left: ex.get(id)?.name ?? 'Ejercicio', right: `${fmtKg(top.weight)} kg × ${top.reps}` };
      }).filter((l): l is { left: string; right: string } => !!l);
      const kg = Math.round(done.reduce((a, s) => a + s.weight * s.reps, 0));
      const card: CardData = {
        kicker: 'Entrenamiento completado', title: session.name, subtitle: `${fmtDate(session.startedAt)}, ${fmtDuration(elapsedMs(session))}`,
        stats: [{ value: String(main.length), label: 'series' }, { value: kg >= 10000 ? `${(kg / 1000).toFixed(1).replace('.', ',')} t` : `${kg.toLocaleString('es-CL')}`, label: kg >= 10000 ? 'de volumen' : 'kg de volumen' }, { value: String(lines.length), label: 'ejercicios' }],
        lines,
      };
      const how = await shareBlob(await drawCard(card), 'entrenamiento-iron-intelligence.png', `${session.name} en Iron Intelligence`);
      if (how === 'downloaded') toast('Imagen descargada');
    } catch (e) { toast(e instanceof Error ? e.message : 'No se pudo crear la imagen', 'error'); }
    setBusy(false);
  };
  return <Btn variant="primary" icon="up" className="mt-4 w-full" disabled={busy} onClick={share}>Compartir este entrenamiento</Btn>;
}

// ---------- Valoración tras la sesión ----------
export function SessionFeedback({ session, sets }: { session: Session; sets: SetLog[] }) {
  const ex = useExMap(); const p = useProfile(); const run = useAction();
  // Solo los músculos que de verdad se trabajaron en la sesión.
  const muscles = [...new Set(session.exerciseIds.filter((id) => sets.some((s) => s.exerciseId === id && s.done)).map((id) => ex.get(id)?.primary).filter((m): m is NonNullable<typeof m> => !!m))].slice(0, 8);
  const mine_ = p.settings?.ratings?.[session.id]?.m ?? {};
  if (session.status !== 'done' || !muscles.length) return null;
  return (
    <div className="mt-4 rounded-panel bg-card2 p-3">
      <div className="font-semibold">¿Cuánto trabajo sintió cada músculo?</div>
      <p className="mb-2 mt-0.5 text-xs text-mute">Con dos «Poco» seguidos, la próxima sesión suma una serie a ese músculo; con un «Demasiado», quita una. Es una regla práctica y siempre puedes cambiar el objetivo a mano.</p>
      <div className="space-y-2">
        {muscles.map((m) => (
          <div key={m} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2">
            <span className="truncate text-sm font-semibold">{MUSCLE_LABEL[m]}</span>
            <div className="flex rounded-[14px] bg-ink/40 p-1" role="group" aria-label={`Trabajo de ${MUSCLE_LABEL[m]}`}>
              {RATINGS.map((r) => {
                const on = mine_[m] === r.value;
                return <button type="button" key={r.value} aria-pressed={on} onClick={() => run(() => rateSession(session.id, session.startedAt, m, on ? null : r.value))} className={`wd-c h-9 min-w-0 flex-1 truncate rounded-xl px-1 text-sm font-semibold ${on ? 'bg-chalk text-ink' : 'text-mute'}`}>{r.label}</button>;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Compartir y recibir rutinas ----------
export function ShareRoutineButton({ routineId }: { routineId: string }) {
  const { toast } = useUi();
  const share = async () => {
    const sr = await shareableRoutine(routineId);
    if (!sr || !sr.items.length) { toast('Añade ejercicios antes de compartir la rutina', 'error'); return; }
    const url = `${window.location.origin}${window.location.pathname}#/importar?r=${encodeRoutine(sr)}`;
    const how = await shareLink(url, `Rutina ${sr.name}, Iron Intelligence`);
    if (how === 'copied') toast('Enlace copiado: pégalo donde quieras compartirlo');
  };
  return <Btn icon="up" onClick={share}>Compartir rutina</Btn>;
}
export function ImportRoutinePage() {
  const [params] = useSearchParams(); const ex = useExMap(); const nav = useNavigate(); const run = useAction();
  const sr = useMemo(() => decodeRoutine(params.get('r') ?? ''), [params]);
  if (!sr) return <div><Title>Rutina compartida</Title><Empty icon="info" title="El enlace no es válido" text="Puede estar incompleto. Pide que te lo envíen de nuevo."><Btn variant="primary" onClick={() => nav('/rutinas')}>Ir a mis rutinas</Btn></Empty></div>;
  const nameOf = (id: string) => ex.get(id)?.name ?? sr.custom.find((c) => c.id === id)?.name;
  const items = sr.items.filter((i) => nameOf(i.exerciseId));
  return (
    <div>
      <Title sub="Te compartieron esta rutina">{sr.name}</Title>
      <Card className="space-y-2">
        {items.map((i, k) => (
          <div key={k} className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0">
            <span className="min-w-0 font-semibold leading-tight">{nameOf(i.exerciseId)}{i.group != null && <span className="wd-c ml-2 text-sm text-fire">biserie</span>}</span>
            <span className="wd-c shrink-0 text-sm text-mute tnum">{i.target.sets} × {i.target.repMin}–{i.target.repMax}</span>
          </div>
        ))}
        {!items.length && <p className="text-sm text-mute">La rutina no trae ejercicios reconocibles.</p>}
      </Card>
      {sr.custom.length > 0 && <p className="mt-3 text-sm text-mute">Incluye {sr.custom.length} {sr.custom.length === 1 ? 'ejercicio propio' : 'ejercicios propios'} de quien la compartió; se crearán en tu biblioteca.</p>}
      <Btn variant="primary" size="lg" className="mt-4 w-full" icon="plus" disabled={!items.length} onClick={async () => { const r = await run(() => importSharedRoutine(sr), 'Rutina añadida'); if (r) nav(`/rutinas/${r.id}`); }}>Añadir a mis rutinas</Btn>
    </div>
  );
}

// ---------- Generador de plan ----------
export function PlanButton({ className }: { className?: string }) {
  const p = useProfile(); const lib = useExercises(); const ex = useExMap(); const run = useAction();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(Math.min(6, Math.max(2, p.daysAvailable)));
  const plan = useMemo(() => (open ? generatePlan({ days, equipment: p.equipment, priority: p.priorityMuscles, experience: p.experience }, lib) : null), [open, days, p.equipment, p.priorityMuscles, p.experience, lib]);
  return (
    <>
      <Btn className={className} icon="star" onClick={() => { setDays(Math.min(6, Math.max(2, p.daysAvailable))); setOpen(true); }}>Generar plan según mi perfil</Btn>
      <Sheet open={open} onClose={() => setOpen(false)} title="Plan a tu medida" wide>
        <div className="space-y-4">
          <div>
            <div className="label mb-1.5">Días por semana</div>
            <Seg options={[2, 3, 4, 5, 6].map((d) => ({ value: d, label: String(d) }))} value={days} onChange={setDays} />
          </div>
          <p className="text-sm text-mute">Usa tu equipo disponible, tu experiencia y tus músculos prioritarios (se cambian en Perfil). Después puedes editar cada rutina.</p>
          {plan?.routines.map((r) => (
            <div key={r.name} className="rounded-panel bg-card2 p-3">
              <div className="wd-w font-bold">{r.name}</div>
              <div className="mt-1 text-sm text-chalk/85">{r.exercises.map(([id, t]) => `${ex.get(id)?.name ?? id} (${t.sets})`).join(', ')}</div>
            </div>
          ))}
          <Btn variant="primary" size="lg" className="w-full" onClick={async () => { if (plan && (await run(() => createFromPlan(plan.split, plan.routines), `${plan.routines.length} rutinas creadas`))) setOpen(false); }}>Crear estas rutinas</Btn>
        </div>
      </Sheet>
    </>
  );
}

// ---------- Perfil: ciclo, avisos e importación ----------
export function TrainingSettings() {
  const p = useProfile(); const st: Settings = p.settings ?? {}; const run = useAction(); const { toast } = useUi();
  const set = (patch: Partial<Settings>) => run(() => updateSettings(patch));
  const info = cycleInfo(st.cycle);
  const thisWeek = () => ymd(weekStart(Date.now()));
  return (
    <>
      <H2>Ciclo de entrenamiento</H2>
      <Card className="space-y-3">
        <label className="flex items-center justify-between gap-3">
          <span><span className="font-semibold">Entrenar por ciclos</span><span className="block text-sm text-mute">Cada semana se apunta un poco más cerca del fallo y la última puede ser de descarga.</span></span>
          <input type="checkbox" aria-label="Entrenar por ciclos" checked={!!st.cycle} onChange={(e) => set({ cycle: e.target.checked ? { start: thisWeek(), weeks: 5, deload: true } : null })} />
        </label>
        {st.cycle && (
          <>
            <Stepper label="Semanas del ciclo" value={st.cycle.weeks} min={3} max={12} onChange={(v) => set({ cycle: { ...st.cycle!, weeks: Math.round(v) } })} />
            <label className="flex items-center justify-between gap-3"><span className="font-semibold">Última semana de descarga</span><input type="checkbox" aria-label="Última semana de descarga" checked={st.cycle.deload} onChange={(e) => set({ cycle: { ...st.cycle!, deload: e.target.checked } })} /></label>
            <p className="text-sm">{info ? `${info.label}, ciclo ${info.round}.` : 'El ciclo empieza la próxima semana.'} <button type="button" className="text-data underline" onClick={() => set({ cycle: { ...st.cycle!, start: thisWeek() } })}>Empezar de nuevo esta semana</button></p>
            <p className="text-xs text-mute">En la descarga cada ejercicio parte con la mitad de las series, un 10 % menos de carga y 2 repeticiones más en reserva, y esa sesión no se usa como referencia para subir peso. Son convenciones prácticas de programación, no valores medidos.</p>
          </>
        )}
      </Card>
      <H2>Avisos del descanso</H2>
      <Card className="space-y-3">
        <label className="flex items-center justify-between gap-3">
          <span><span className="font-semibold">Sonido al terminar el descanso</span></span>
          <input type="checkbox" aria-label="Sonido al terminar el descanso" checked={st.restSound !== false} onChange={(e) => { if (e.target.checked) primeAudio(); void set({ restSound: e.target.checked }); }} />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span><span className="font-semibold">Notificación con la app en segundo plano</span><span className="block text-sm text-mute">{canNotify() ? 'También llega al reloj enlazado con el teléfono.' : 'Este navegador no admite notificaciones. En iPhone, instala la app en la pantalla de inicio.'}</span></span>
          <input type="checkbox" aria-label="Notificación al terminar el descanso" disabled={!canNotify()} checked={!!st.restAlert} onChange={async (e) => {
            if (!e.target.checked) { void set({ restAlert: false }); return; }
            if (await askNotify()) void set({ restAlert: true }); else toast('Las notificaciones están bloqueadas: permítelas en los ajustes del navegador para esta app', 'error');
          }} />
        </label>
      </Card>
    </>
  );
}
export function ImportCard() {
  const file = useRef<HTMLInputElement>(null); const { toast, confirm } = useUi(); const [lb, setLb] = useState(false); const [busy, setBusy] = useState(false);
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const list = parseWorkouts(await f.text(), lb);
      if (!list.length) throw new Error('El archivo no trae entrenamientos');
      if (await confirm(`Se importarán ${list.length} entrenamientos, del ${fmtDate(list[0].start)} al ${fmtDate(list[list.length - 1].start)}. Los que ya tengas no se duplican.`, { confirmLabel: 'Importar' })) {
        const r = await importSessions(list);
        toast(`${r.sessions} entrenamientos y ${r.sets} series importados${r.created ? `; ${r.created} ejercicios nuevos creados` : ''}`);
      }
    } catch (e) { toast(e instanceof Error ? e.message : 'No se pudo leer el archivo', 'error'); }
    setBusy(false);
    if (file.current) file.current.value = '';
  };
  return (
    <>
      <H2>Traer mi historial de otra app</H2>
      <Card className="space-y-3">
        <p className="text-sm text-mute">Exporta tus entrenamientos desde Strong o Hevy (archivo CSV) y cárgalo aquí. Los ejercicios se emparejan con la biblioteca; los que no existan se crean como propios para que los revises.</p>
        <Seg options={[{ value: 'kg', label: 'Pesos en kg' }, { value: 'lb', label: 'Pesos en libras' }]} value={lb ? 'lb' : 'kg'} onChange={(v) => setLb(v === 'lb')} />
        <Btn className="w-full" icon="plus" disabled={busy} onClick={() => file.current?.click()}>{busy ? 'Importando…' : 'Elegir archivo CSV'}</Btn>
        <input ref={file} type="file" accept=".csv,text/csv" className="hidden" aria-label="Archivo CSV de otra app" onChange={(e) => void onFile(e.target.files?.[0])} />
      </Card>
    </>
  );
}

// ---------- Análisis: constancia, equilibrio y niveles de fuerza ----------
export function InsightCards() {
  const uid = useUserId(); const p = useProfile(); const ex = useExMap();
  const sessions = (useSessions() ?? []).filter((s) => s.status === 'done');
  const sets = useDoneSets() ?? [];
  const weights = useLiveQuery(async () => mine(await db.bodyWeights.toArray()).sort((a, b) => a.date.localeCompare(b.date)), [uid]) ?? [];
  const ad = useMemo(() => adherence(sessions.map((s) => s.startedAt), p.daysAvailable, 8), [sessions, p.daysAvailable]);
  const bal = useMemo(() => balance(sets.filter((s) => s.date >= Date.now() - 28 * DAY), ex), [sets, ex]);
  const kg = weights[weights.length - 1]?.kg ?? 0;
  const levels = useMemo(() => strengthLevels(sets, kg, p.sex === 'f'), [sets, kg, p.sex]);
  const pair = (a: number, b: number, la: string, lb: string) => {
    const off = a + b >= 8 && (a < b * 0.6 || b < a * 0.6);
    return (
      <div>
        <div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{la} <span className="tnum text-mute">{a}</span></span><span className="font-semibold"><span className="tnum text-mute">{b}</span> {lb}</span></div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-card2"><div style={{ width: `${a + b ? (a / (a + b)) * 100 : 50}%`, background: '#ff6a1a' }} /><div className="flex-1" style={{ background: '#58c7ff' }} /></div>
        {off && <p className="mt-1.5 text-sm text-[#ffb054]">{a < b ? la : lb} recibe bastante menos trabajo que {a < b ? lb.toLowerCase() : la.toLowerCase()}.</p>}
      </div>
    );
  };
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      <div>
        <H2>Constancia</H2>
        <Card>
          <div className="flex items-end justify-between gap-3"><div><div className="num text-3xl">{ad.pct} %</div><div className="label">del plan en 7 semanas</div></div>
            <div className="flex h-14 items-end gap-1" aria-hidden>{ad.weeks.map((w) => <div key={w.start} className="w-3 rounded-sm" style={{ height: `${Math.max(8, Math.min(100, (w.done / Math.max(1, w.planned)) * 100))}%`, background: w.done >= w.planned ? '#34e0a1' : w.done ? '#ffb054' : 'rgba(185,232,242,.18)' }} />)}</div>
          </div>
          <p className="mt-2 text-xs text-mute">Sesiones hechas contra tus {p.daysAvailable} días planificados por semana. La semana en curso se muestra, pero no cuenta en el porcentaje.</p>
        </Card>
      </div>
      <div>
        <H2>Equilibrio (4 semanas)</H2>
        <Card className="space-y-4">
          {pair(bal.push, bal.pull, 'Empuje', 'Tirón')}
          {pair(bal.front, bal.back, 'Cuádriceps', 'Femoral y glúteo')}
          <p className="text-xs text-mute">Series directas. Un reparto parecido entre lados opuestos es una guía práctica de programación, no una regla demostrada.</p>
        </Card>
      </div>
      <div>
        <H2>Niveles de fuerza</H2>
        <Card className="space-y-3">
          {!kg && <p className="text-sm text-mute">Registra tu peso corporal en Recuperación para ver tus niveles.</p>}
          {!!kg && !levels.length && <p className="text-sm text-mute">Aparecen al registrar sentadilla, press de banca, peso muerto, press militar o remo con barra.</p>}
          {levels.map((l) => (
            <div key={l.key}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm"><span className="font-semibold">{l.name}</span><span className="wd-c text-mute tnum">{LEVELS[l.level]}, 1RM est. {l.e1rm} kg ({String(l.ratio).replace('.', ',')}× tu peso)</span></div>
              <Bar value={l.level + 1} max={LEVELS.length} color="#34e0a1" height={6} />
              {l.next && <div className="wd-c mt-1 text-xs text-mute">Siguiente nivel: {l.next} kg</div>}
            </div>
          ))}
          {!!levels.length && <p className="text-xs text-mute">Según tu mejor 1RM estimado y tu peso corporal. Las marcas son referencias de uso común, no normas oficiales.</p>}
        </Card>
      </div>
    </div>
  );
}

// ---------- Medidas corporales ----------
const MEASURES: [string, string, string][] = [['waist', 'Cintura', 'cm'], ['chest', 'Pecho', 'cm'], ['hips', 'Cadera', 'cm'], ['shoulders', 'Hombros', 'cm'], ['arm', 'Brazo', 'cm'], ['thigh', 'Muslo', 'cm'], ['calf', 'Gemelo', 'cm'], ['fat', 'Grasa corporal', '%']];
export function MeasuresCard() {
  const uid = useUserId(); const run = useAction();
  const rows = useLiveQuery(async () => mine(await db.measures.toArray()).sort((a, b) => a.date.localeCompare(b.date)), [uid]) ?? [];
  const [vals, setVals] = useState<Record<string, string>>({});
  const latest = (k: string) => [...rows].reverse().find((r) => r.values[k] != null);
  const first = (k: string) => rows.find((r) => r.values[k] != null);
  const save = async () => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(vals)) { const n = parseFloat(v.replace(',', '.')); if (Number.isFinite(n) && n > 0) out[k] = Math.round(n * 10) / 10; }
    if (!Object.keys(out).length) return;
    if (await run(() => saveMeasures(out), 'Medidas guardadas')) setVals({});
  };
  return (
    <div>
      <H2>Medidas corporales</H2>
      <Card>
        <div className="grid grid-cols-2 gap-3">
          {MEASURES.map(([k, label, unit]) => {
            const l = latest(k), f = first(k); const d = l && f && l.id !== f.id ? Math.round((l.values[k] - f.values[k]) * 10) / 10 : null;
            return (
              <Field key={k} label={`${label} (${unit})`} hint={l ? `${fmtKg(l.values[k])} ${unit}${d != null ? `, ${d > 0 ? '+' : ''}${String(d).replace('.', ',')} desde ${f!.date}` : `, ${l.date}`}` : undefined}>
                <input inputMode="decimal" aria-label={label} value={vals[k] ?? ''} placeholder={l ? fmtKg(l.values[k]) : '—'} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
              </Field>
            );
          })}
        </div>
        <Btn variant="primary" className="mt-3 w-full" disabled={!Object.values(vals).some((v) => v.trim())} onClick={save}>Guardar medidas de hoy</Btn>
        {rows.length > 0 && (
          <div className="mt-3 space-y-1">
            {[...rows].reverse().slice(0, 4).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm"><span className="text-mute">{r.date}</span><span className="flex min-w-0 items-center gap-2"><span className="truncate tnum">{MEASURES.filter(([k]) => r.values[k] != null).map(([k, label]) => `${label} ${fmtKg(r.values[k])}`).join(', ')}</span><button type="button" aria-label={`Eliminar medidas del ${r.date}`} className="shrink-0 text-mute" onClick={() => run(() => softDelete('measures', r.id))}><Icon name="x" size={14} /></button></span></div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- iPhone: cómo instalar la app ----------
export function IosInstallHint() {
  const [hide, setHide] = useState(() => { try { return !!localStorage.getItem('ii_ios_hint'); } catch { return true; } });
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = typeof window !== 'undefined' && ((navigator as Navigator & { standalone?: boolean }).standalone || window.matchMedia?.('(display-mode: standalone)').matches);
  if (!ios || standalone || hide) return null;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-panel bg-card p-4">
      <Icon name="info" size={20} className="mt-0.5 shrink-0 text-data" />
      <p className="flex-1 text-sm">Para usarla como app en tu iPhone: en Safari, toca <b>Compartir</b> y luego <b>Añadir a pantalla de inicio</b>. Así abre a pantalla completa, funciona sin conexión y puede enviarte avisos.</p>
      <button type="button" aria-label="Cerrar aviso de instalación" className="shrink-0 text-mute" onClick={() => { setHide(true); try { localStorage.setItem('ii_ios_hint', '1'); } catch { /* sin almacenamiento */ } }}><Icon name="x" size={18} /></button>
    </div>
  );
}
