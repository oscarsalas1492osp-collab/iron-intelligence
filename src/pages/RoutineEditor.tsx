import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../data/db';
import { addItem, deleteItem, deleteRoutine, groupItems, moveItem, saveItem, saveRoutine, startSession, ungroupItem } from '../data/repo';
import { groupLabel, MAX_GROUP, unitsOf } from '../domain/superset';
import { useHoldDrag } from '../ui/useHoldDrag';
import { MEASURE_UNIT, MUSCLE_LABEL } from '../domain/muscles';
import type { Measure, RoutineItem, Target } from '../domain/types';
import { useActiveSession, useAllItems, useExMap } from '../hooks';
import { Btn, cx, Empty, Field, Icon, Sheet, Stepper, Title, useAction, useUi } from '../ui/components';
import { ExerciseThumb } from '../ui/EquipmentArt';
import { ExercisePicker } from './Library';
import { DAY_LABEL, DAY_ORDER } from './Routines';

/** Editor de objetivos (series, rango, RIR, descanso). Se usa en rutinas y durante la sesión. */
export function TargetEditor({ value, onChange, measure = 'reps' }: { value: Target; onChange: (t: Target) => void; measure?: Measure }) {
  const [lo, hi] = measure === 'reps' ? ['Reps mínimas', 'Reps máximas'] : measure === 'time' ? ['Segundos mínimos', 'Segundos máximos'] : ['Metros mínimos', 'Metros máximos'];
  const step = measure === 'reps' ? 1 : 5;
  const set = (p: Partial<Target>) => {
    const t = { ...value, ...p };
    if (t.repMin > t.repMax) { if ('repMin' in p) t.repMax = t.repMin; else t.repMin = t.repMax; }
    if (t.rirMin > t.rirMax) { if ('rirMin' in p) t.rirMax = t.rirMin; else t.rirMin = t.rirMax; }
    onChange(t);
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      <Stepper label="Series" value={value.sets} min={1} max={12} onChange={(v) => set({ sets: Math.round(v) })} />
      <Stepper label="Descanso (s)" value={value.restSec} step={15} min={0} max={900} onChange={(v) => set({ restSec: Math.round(v) })} />
      <Stepper label={lo} value={value.repMin} step={step} min={1} max={100} onChange={(v) => set({ repMin: Math.round(v) })} />
      <Stepper label={hi} value={value.repMax} step={step} min={1} max={100} onChange={(v) => set({ repMax: Math.round(v) })} />
      <Stepper label="RIR mínimo" value={value.rirMin} min={0} max={10} onChange={(v) => set({ rirMin: Math.round(v) })} />
      <Stepper label="RIR máximo" value={value.rirMax} min={0} max={10} onChange={(v) => set({ rirMax: Math.round(v) })} />
    </div>
  );
}

export default function RoutineEditor() {
  const { id = '' } = useParams();
  const nav = useNavigate(); const run = useAction(); const { confirm, toast } = useUi();
  const routine = useLiveQuery(() => db.routines.get(id), [id]);
  const items = (useAllItems() ?? []).filter((i) => i.routineId === id);
  const ex = useExMap(); const active = useActiveSession();
  const [picker, setPicker] = useState(false);
  const [edit, setEdit] = useState<RoutineItem | null>(null);
  // Unidades en orden: un ejercicio suelto o los 2–3 de una biserie o triserie.
  const units = unitsOf(items.map((i) => i.id), [...new Set(items.map((i) => i.superset).filter(Boolean))].map((k) => items.filter((i) => i.superset === k).map((i) => i.id)))
    .map((u) => u.map((itemId) => items.find((i) => i.id === itemId)!));
  const unitOfItem = (itemId: string) => units.find((u) => u.some((i) => i.id === itemId)) ?? [];
  const joinTargets = (itemId: string) => units.filter((u) => u.length < MAX_GROUP && !u.some((i) => i.id === itemId));
  const drag = useHoldDrag(
    (dragId, targetId) => void run(() => groupItems(id, dragId, targetId), unitOfItem(targetId).length >= 2 ? 'Triserie creada' : 'Biserie creada'),
    (dragId, targetId) => unitOfItem(dragId).length === 1 && !unitOfItem(targetId).some((i) => i.id === dragId),
  );

  if (routine === undefined) return null;
  if (!routine || routine.deleted) return <Empty title="Rutina no encontrada"><Btn onClick={() => nav('/rutinas')}>Volver</Btn></Empty>;

  const toggleDay = (d: number) => run(() => saveRoutine({ ...routine, days: routine.days.includes(d) ? routine.days.filter((x) => x !== d) : [...routine.days, d] }));
  const begin = async () => {
    if (active) { toast('Ya hay un entrenamiento en curso'); nav('/entrenar'); return; }
    if (await run(() => startSession(routine.id))) nav('/entrenar');
  };

  return (
    <div>
      <button type="button" onClick={() => nav('/rutinas')} className="mb-3 flex items-center gap-1 text-sm text-mute"><Icon name="left" size={16} />Rutinas</button>
      <Title sub={`${items.length} ejercicios, ${items.reduce((a, i) => a + i.sets, 0)} series`}>{routine.name}</Title>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 mb-4">
        <Field label="Nombre"><input defaultValue={routine.name} key={routine.id} onBlur={(e) => e.target.value !== routine.name && run(() => saveRoutine({ ...routine, name: e.target.value }))} /></Field>
        <Field label="División"><input defaultValue={routine.split} placeholder="Push/Pull/Legs, Torso/Pierna…" onBlur={(e) => e.target.value !== routine.split && run(() => saveRoutine({ ...routine, split: e.target.value }))} /></Field>
      </div>
      <Field label={`Días programados: ${routine.days.length} por semana`}>
        <div className="flex gap-2">{DAY_ORDER.map((d) => (
          <button type="button" key={d} aria-pressed={routine.days.includes(d)} onClick={() => toggleDay(d)} className={`h-10 flex-1 rounded-xl text-sm font-bold transition ${routine.days.includes(d) ? 'bg-fire text-ink' : 'bg-card2 text-mute'}`}>{DAY_LABEL[d]}</button>
        ))}</div>
      </Field>

      <div className="mt-5 space-y-2">
        {units.map((u, ui) => {
          const grouped = u.length >= 2;
          const rows = u.map((it) => {
            const e = ex.get(it.exerciseId);
            return (
              <div key={it.id} data-drop-id={it.id} {...(grouped ? {} : drag.bind(it.id, e?.name ?? 'Ejercicio'))}
                className={cx('flex items-center gap-2 rounded-panel bg-card p-2.5 transition', drag.over === it.id && 'ring-2 ring-fire', drag.dragging === it.id && 'opacity-40')}>
                {!grouped && (
                  <div className="flex flex-col">
                    <button type="button" aria-label="Subir" disabled={ui === 0} onClick={() => run(() => moveItem(id, it.id, -1))} className="grid h-7 w-7 place-items-center text-mute disabled:opacity-20"><Icon name="up" size={16} /></button>
                    <button type="button" aria-label="Bajar" disabled={ui === units.length - 1} onClick={() => run(() => moveItem(id, it.id, 1))} className="grid h-7 w-7 place-items-center text-mute disabled:opacity-20"><Icon name="down" size={16} /></button>
                  </div>
                )}
                {e && <ExerciseThumb ex={e} size={48} />}
                <button type="button" className="min-w-0 flex-1 text-left" onClick={drag.guard(() => setEdit(it))}>
                  <div className="font-semibold leading-tight truncate">{e?.name ?? 'Ejercicio eliminado'}</div>
                  <div className="wd-c text-sm text-mute truncate">{e ? MUSCLE_LABEL[e.primary] : ''}</div>
                  <div className="wd-c mt-0.5 text-sm tnum"><span className="text-chalk font-semibold">{it.sets} × {it.repMin}–{it.repMax}{e && e.measure !== 'reps' ? ` ${MEASURE_UNIT[e.measure]}` : ''}</span><span className="text-fire"> RIR {it.rirMin}–{it.rirMax}</span>{!grouped && <span className="text-mute">, {it.restSec} s</span>}</div>
                </button>
                {grouped
                  ? <Btn size="sm" aria-label={`Separar ${e?.name ?? 'ejercicio'} de la ${groupLabel(u.length).toLowerCase()}`} onClick={() => run(() => ungroupItem(id, it.id), 'Ejercicio separado')}>Separar</Btn>
                  : <button type="button" aria-label="Editar objetivos" onClick={() => setEdit(it)} className="grid h-9 w-9 place-items-center rounded-full bg-card2 text-mute"><Icon name="edit" size={16} /></button>}
              </div>
            );
          });
          if (!grouped) return rows[0];
          return (
            <section key={u[0].id} aria-label={groupLabel(u.length)} className="rounded-panel bg-fire/10 p-2">
              <div className="mb-2 flex items-center gap-2 px-1">
                <div className="flex">
                  <button type="button" aria-label={`Subir ${groupLabel(u.length).toLowerCase()}`} disabled={ui === 0} onClick={() => run(() => moveItem(id, u[0].id, -1))} className="grid h-7 w-7 place-items-center text-mute disabled:opacity-20"><Icon name="up" size={16} /></button>
                  <button type="button" aria-label={`Bajar ${groupLabel(u.length).toLowerCase()}`} disabled={ui === units.length - 1} onClick={() => run(() => moveItem(id, u[0].id, 1))} className="grid h-7 w-7 place-items-center text-mute disabled:opacity-20"><Icon name="down" size={16} /></button>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="wd-x text-[13px] font-extrabold text-fire">{groupLabel(u.length).toUpperCase()}</span>
                  <span className="wd-c block text-sm text-mute">Seguidos, sin descanso. Descanso al terminar la ronda: {Math.max(...u.map((it) => it.restSec))} s</span>
                </div>
              </div>
              <div className="space-y-2">{rows}</div>
            </section>
          );
        })}
        {!items.length && <Empty icon="dumbbell" title="Rutina vacía" text="Añade ejercicios desde la biblioteca." />}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
        <Btn icon="plus" onClick={() => setPicker(true)}>Añadir ejercicio</Btn>
        <Btn variant="primary" icon="play" disabled={!items.length} onClick={begin}>Iniciar esta rutina</Btn>
        <Btn variant="danger" icon="trash" onClick={async () => { if (await confirm(`Se eliminará la rutina “${routine.name}”. Las sesiones ya registradas se conservan.`, { confirmLabel: 'Eliminar', danger: true })) { await run(() => deleteRoutine(id)); nav('/rutinas'); } }}>Eliminar rutina</Btn>
      </div>

      {items.length > 1 && <p className="wd-c mt-3 text-sm text-mute">Para armar una biserie o triserie, mantén presionado un ejercicio y arrástralo sobre otro, o ábrelo y elige «Unir en biserie con».</p>}
      {drag.ghost}
      <ExercisePicker open={picker} onClose={() => setPicker(false)} exclude={items.map((i) => i.exerciseId)} onPick={(e) => run(() => addItem(id, e.id))} />
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit ? ex.get(edit.exerciseId)?.name : ''}>
        {edit && <>
          <TargetEditor value={edit} measure={ex.get(edit.exerciseId)?.measure} onChange={(t) => setEdit({ ...edit, ...t })} />
          {unitOfItem(edit.id).length === 1 && joinTargets(edit.id).length > 0 && (
            <Field label="Unir en biserie con" hint="Se hacen seguidos, sin descanso; una serie es la ronda completa. También puedes mantener presionado un ejercicio y arrastrarlo sobre otro.">
              <select value="" aria-label="Unir en biserie con" onChange={async (e) => { const t = e.target.value; if (t && (await run(async () => { await groupItems(id, edit.id, t); return true; }, unitOfItem(t).length >= 2 ? 'Triserie creada' : 'Biserie creada'))) setEdit(null); }}>
                <option value="">Elegir ejercicio…</option>
                {joinTargets(edit.id).map((u) => <option key={u[0].id} value={u[0].id}>{u.map((i) => ex.get(i.exerciseId)?.name ?? 'Ejercicio').join(' + ')}</option>)}
              </select>
            </Field>
          )}
          <p className="mt-3 text-xs text-mute">Los cambios aplican desde la próxima sesión; el historial conserva los objetivos con los que se entrenó.</p>
          <div className="mt-4 flex gap-2">
            <Btn variant="danger" icon="trash" onClick={async () => { await run(() => deleteItem(edit.id)); setEdit(null); }}>Quitar</Btn>
            <Btn variant="primary" className="flex-1" onClick={async () => { if (await run(() => saveItem(edit), 'Objetivos guardados')) setEdit(null); }}>Guardar</Btn>
          </div>
        </>}
      </Sheet>
    </div>
  );
}
