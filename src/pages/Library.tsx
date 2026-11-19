import { useMemo, useState } from 'react';
import { deleteExercise, saveExercise } from '../data/repo';
import { EQUIPMENT, EQUIPMENT_LABEL, MUSCLES, MUSCLE_LABEL, norm } from '../domain/muscles';
import { LIBRARY } from '../domain/exerciseLibrary';
import type { Equipment, ExerciseDef, Muscle } from '../domain/types';
import { useExercises } from '../hooks';
import { ExerciseMuscles } from '../ui/BodyMap';
import { Btn, Chip, Empty, Field, Seg, Sheet, Stepper, Title, useAction, useUi } from '../ui/components';
import { ExerciseThumb } from '../ui/EquipmentArt';

function useFiltered(list: ExerciseDef[], q: string, muscle: Muscle | null, eq: Equipment | null) {
  return useMemo(() => {
    const n = norm(q.trim());
    return list.filter((e) => (!muscle || e.primary === muscle) && (!eq || e.equipment === eq) && (!n || norm(e.name + ' ' + e.machine).includes(n)));
  }, [list, q, muscle, eq]);
}

function Filters({ q, setQ, muscle, setMuscle, eq, setEq }: { q: string; setQ: (s: string) => void; muscle: Muscle | null; setMuscle: (m: Muscle | null) => void; eq: Equipment | null; setEq: (e: Equipment | null) => void }) {
  return (
    <div className="space-y-2 mb-3">
      <input placeholder="Buscar ejercicio o máquina…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ejercicio" />
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        <Chip active={!muscle} onClick={() => setMuscle(null)}>Todos</Chip>
        {MUSCLES.map((m) => <Chip key={m} active={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)} color="#ff6a1a">{MUSCLE_LABEL[m]}</Chip>)}
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        <Chip active={!eq} onClick={() => setEq(null)}>Todo el equipo</Chip>
        {EQUIPMENT.map((m) => <Chip key={m} active={eq === m} onClick={() => setEq(eq === m ? null : m)} color="#3b9dff">{EQUIPMENT_LABEL[m]}</Chip>)}
      </div>
    </div>
  );
}

function Row({ ex, onClick, right }: { ex: ExerciseDef; onClick: () => void; right?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-2.5 text-left transition hover:border-mute/40 active:scale-[.99]">
      <ExerciseThumb ex={ex} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold leading-tight truncate">{ex.name}</div>
        <div className="text-xs text-mute truncate">{MUSCLE_LABEL[ex.primary]} · {EQUIPMENT_LABEL[ex.equipment]}{ex.custom ? ' · Propio' : ''}</div>
      </div>
      {right}
    </button>
  );
}

/** Selector de ejercicio reutilizado por el constructor de rutinas y la sesión en curso. */
export function ExercisePicker({ open, onClose, onPick, exclude = [] }: { open: boolean; onClose: () => void; onPick: (ex: ExerciseDef) => void; exclude?: string[] }) {
  const all = useExercises();
  const [q, setQ] = useState(''); const [muscle, setMuscle] = useState<Muscle | null>(null); const [eq, setEq] = useState<Equipment | null>(null);
  const list = useFiltered(all, q, muscle, eq).filter((e) => !exclude.includes(e.id));
  return (
    <Sheet open={open} onClose={onClose} title="Elegir ejercicio" wide>
      <Filters {...{ q, setQ, muscle, setMuscle, eq, setEq }} />
      <div className="space-y-2 max-h-[55vh] overflow-y-auto">
        {list.map((e) => <Row key={e.id} ex={e} onClick={() => { onPick(e); onClose(); }} />)}
        {!list.length && <p className="py-6 text-center text-sm text-mute">Ningún ejercicio coincide con el filtro.</p>}
      </div>
    </Sheet>
  );
}

const List = ({ title, items }: { title: string; items: string[] }) => items.length ? (
  <div><div className="text-xs font-bold uppercase tracking-widest text-mute mb-1">{title}</div><ul className="space-y-1 text-sm">{items.map((c, i) => <li key={i} className="flex gap-2"><span className="text-fire">•</span>{c}</li>)}</ul></div>
) : null;
const Para = ({ title, text }: { title: string; text: string }) => text ? (<div><div className="text-xs font-bold uppercase tracking-widest text-mute mb-1">{title}</div><p className="text-sm">{text}</p></div>) : null;

export function ExerciseDetail({ ex, onClose, onEdit }: { ex: ExerciseDef | null; onClose: () => void; onEdit?: (ex: ExerciseDef) => void }) {
  if (!ex) return null;
  return (
    <Sheet open onClose={onClose} title={ex.name} wide>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr]">
        <div className="flex md:flex-col items-center gap-3">
          <ExerciseThumb ex={ex} size={120} />
          <ExerciseMuscles primary={ex.primary} secondary={ex.secondary} className="h-40 md:h-52" />
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-card2 p-2.5"><div className="text-[10px] uppercase tracking-wider text-mute">Principal</div><div className="font-semibold text-fire">{MUSCLE_LABEL[ex.primary]}</div></div>
            <div className="rounded-xl bg-card2 p-2.5"><div className="text-[10px] uppercase tracking-wider text-mute">Secundarios</div><div className="font-semibold">{ex.secondary.map((m) => MUSCLE_LABEL[m]).join(', ') || '—'}</div></div>
            <div className="rounded-xl bg-card2 p-2.5"><div className="text-[10px] uppercase tracking-wider text-mute">Tipo</div><div className="font-semibold">{ex.type === 'compound' ? 'Multiarticular' : 'Monoarticular'}</div></div>
            <div className="rounded-xl bg-card2 p-2.5"><div className="text-[10px] uppercase tracking-wider text-mute">Equipamiento</div><div className="font-semibold">{EQUIPMENT_LABEL[ex.equipment]}</div></div>
            {ex.machine && <div className="rounded-xl bg-card2 p-2.5"><div className="text-[10px] uppercase tracking-wider text-mute">Máquina</div><div className="font-semibold">{ex.machine}</div></div>}
            <div className="rounded-xl bg-card2 p-2.5"><div className="text-[10px] uppercase tracking-wider text-mute">Incremento mínimo</div><div className="font-semibold">{ex.increment} kg</div></div>
          </div>
          <List title="Indicaciones técnicas" items={ex.cues} />
          <List title="Errores frecuentes" items={ex.mistakes} />
          <Para title="Rango de movimiento recomendado" text={ex.rom} />
          <Para title="Tipo de ejecución" text={ex.execution} />
          <Para title="Seguridad" text={ex.safety} />
          {onEdit && <Btn icon="edit" className="w-full" onClick={() => onEdit(ex)}>{ex.custom ? 'Editar ejercicio' : 'Ajustar máquina, incremento o foto'}</Btn>}
        </div>
      </div>
    </Sheet>
  );
}

/** Reduce la foto a 640 px para guardarla sin ocupar espacio excesivo. */
function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 640 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

const BLANK: ExerciseDef = { id: '', name: '', primary: 'chest', secondary: [], type: 'compound', equipment: 'machine', machine: '', cues: [], mistakes: [], rom: '', execution: '', safety: '', increment: 2.5, photo: null, custom: true };

export function ExerciseForm({ initial, onClose }: { initial: ExerciseDef | null; onClose: () => void }) {
  const [ex, setEx] = useState<ExerciseDef>(initial ?? BLANK);
  const run = useAction(); const { confirm } = useUi();
  const isBase = LIBRARY.some((b) => b.id === ex.id);
  const set = <K extends keyof ExerciseDef>(k: K, v: ExerciseDef[K]) => setEx((e) => ({ ...e, [k]: v }));
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);
  const submit = async () => { if (await run(() => saveExercise(ex), 'Ejercicio guardado')) onClose(); };
  return (
    <Sheet open onClose={onClose} title={initial ? (isBase ? 'Ajustar ejercicio' : 'Editar ejercicio') : 'Nuevo ejercicio'} wide>
      <div className="space-y-3">
        {isBase && <p className="text-xs text-mute">Ejercicio de la biblioteca: puedes registrar la máquina de tu gimnasio, su incremento mínimo y una foto propia.</p>}
        {!isBase && <>
          <Field label="Nombre"><input value={ex.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej.: Press de pecho Hammer" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Músculo principal"><select value={ex.primary} onChange={(e) => set('primary', e.target.value as Muscle)}>{MUSCLES.map((m) => <option key={m} value={m}>{MUSCLE_LABEL[m]}</option>)}</select></Field>
            <Field label="Equipamiento"><select value={ex.equipment} onChange={(e) => set('equipment', e.target.value as Equipment)}>{EQUIPMENT.map((m) => <option key={m} value={m}>{EQUIPMENT_LABEL[m]}</option>)}</select></Field>
          </div>
          <Field label="Músculos secundarios">
            <div className="flex flex-wrap gap-2">{MUSCLES.filter((m) => m !== ex.primary).map((m) => <Chip key={m} active={ex.secondary.includes(m)} onClick={() => set('secondary', ex.secondary.includes(m) ? ex.secondary.filter((x) => x !== m) : [...ex.secondary, m])}>{MUSCLE_LABEL[m]}</Chip>)}</div>
          </Field>
          <Field label="Tipo de ejercicio"><Seg value={ex.type} onChange={(v) => set('type', v)} options={[{ value: 'compound', label: 'Multiarticular' }, { value: 'isolation', label: 'Monoarticular' }]} /></Field>
        </>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Máquina de tu gimnasio"><input value={ex.machine} onChange={(e) => set('machine', e.target.value)} placeholder="Marca, modelo o ubicación" /></Field>
          <Stepper label="Incremento mínimo (kg)" value={ex.increment} step={0.25} min={0.25} max={25} onChange={(v) => set('increment', v)} />
        </div>
        {!isBase && <>
          <Field label="Indicaciones técnicas" hint="Una por línea"><textarea rows={2} value={ex.cues.join('\n')} onChange={(e) => set('cues', lines(e.target.value))} /></Field>
          <Field label="Errores frecuentes" hint="Uno por línea"><textarea rows={2} value={ex.mistakes.join('\n')} onChange={(e) => set('mistakes', lines(e.target.value))} /></Field>
          <Field label="Rango de movimiento"><input value={ex.rom} onChange={(e) => set('rom', e.target.value)} /></Field>
          <Field label="Seguridad"><input value={ex.safety} onChange={(e) => set('safety', e.target.value)} /></Field>
        </>}
        <Field label="Fotografía propia">
          <div className="flex items-center gap-3">
            <ExerciseThumb ex={ex} size={64} />
            <input type="file" accept="image/*" aria-label="Subir fotografía" onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(async () => set('photo', await readPhoto(f))); }} />
            {ex.photo && <Btn size="sm" onClick={() => set('photo', null)}>Quitar</Btn>}
          </div>
        </Field>
        <div className="flex gap-2 pt-1">
          {initial && (ex.custom || isBase) && (
            <Btn variant="danger" icon="trash" onClick={async () => {
              if (await confirm(isBase ? 'Se quitarán tus ajustes y el ejercicio volverá a los valores de la biblioteca.' : 'Se eliminará el ejercicio de tu biblioteca. El historial ya registrado se conserva.', { confirmLabel: isBase ? 'Restablecer' : 'Eliminar', danger: true })) { await run(() => deleteExercise(ex.id)); onClose(); }
            }}>{isBase ? 'Restablecer' : 'Eliminar'}</Btn>
          )}
          <Btn variant="primary" className="flex-1" onClick={submit}>Guardar</Btn>
        </div>
      </div>
    </Sheet>
  );
}

export default function Library() {
  const all = useExercises();
  const [q, setQ] = useState(''); const [muscle, setMuscle] = useState<Muscle | null>(null); const [eq, setEq] = useState<Equipment | null>(null);
  const [detail, setDetail] = useState<ExerciseDef | null>(null);
  const [form, setForm] = useState<{ ex: ExerciseDef | null } | null>(null);
  const list = useFiltered(all, q, muscle, eq);
  return (
    <div>
      <Title sub={`${all.length} ejercicios · ${all.filter((e) => e.custom).length} propios`} right={<Btn variant="primary" icon="plus" onClick={() => setForm({ ex: null })}>Nuevo</Btn>}>Ejercicios</Title>
      <Filters {...{ q, setQ, muscle, setMuscle, eq, setEq }} />
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {list.map((e) => <Row key={e.id} ex={e} onClick={() => setDetail(e)} />)}
      </div>
      {!list.length && <Empty icon="book" title="Sin resultados" text="Cambia el filtro o crea un ejercicio propio."><Btn variant="primary" icon="plus" onClick={() => setForm({ ex: null })}>Crear ejercicio</Btn></Empty>}
      <ExerciseDetail ex={detail} onClose={() => setDetail(null)} onEdit={(ex) => { setDetail(null); setForm({ ex }); }} />
      {form && <ExerciseForm initial={form.ex} onClose={() => setForm(null)} />}
    </div>
  );
}
