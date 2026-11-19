import { useEffect, useMemo, useState } from 'react';
import { deleteExercise, saveExercise } from '../data/repo';
import { CATEGORIES, CATEGORY_LABEL, EQUIPMENT, EQUIPMENT_LABEL, MEASURE_LABEL, MUSCLES, MUSCLE_LABEL, norm } from '../domain/muscles';
import { isLibraryId } from '../domain/exerciseLibrary';
import { BRANDS, LOAD_LABEL, MACHINES, ZONES, ZONE_LABEL, type Machine, type Zone } from '../domain/catalog/machines';
import type { Category, Equipment, ExerciseDef, Measure, Muscle } from '../domain/types';
import { useExercises } from '../hooks';
import { exerciseTones } from '../domain/heat';
import { BodyFigure } from '../ui/BodyFigure';
import { Btn, Chip, Empty, Field, H2, Seg, Sheet, Stepper, Title, useAction, useUi } from '../ui/components';
import { EquipmentArt, ExerciseThumb } from '../ui/EquipmentArt';

interface Filter { q: string; muscle: Muscle | null; eq: Equipment | null; cat: Category | null }
const NO_FILTER: Filter = { q: '', muscle: null, eq: null, cat: null };
const PAGE = 40;

/** Texto sobre el que se busca: nombre, otros nombres, énfasis, máquina, músculo e implemento. */
const haystack = (e: ExerciseDef) => norm(`${e.name} ${e.aka} ${e.focus} ${e.machine} ${MUSCLE_LABEL[e.primary]} ${EQUIPMENT_LABEL[e.equipment]}`);

function useFiltered(list: ExerciseDef[], f: Filter) {
  const index = useMemo(() => new Map(list.map((e) => [e.id, haystack(e)])), [list]);
  return useMemo(() => {
    const words = norm(f.q.trim()).split(/\s+/).filter(Boolean);
    return list.filter((e) => (!f.muscle || e.primary === f.muscle || e.secondary.includes(f.muscle)) && (!f.eq || e.equipment === f.eq) && (!f.cat || e.category === f.cat)
      && words.every((w) => index.get(e.id)!.includes(w)))
      // Con filtro de músculo, primero los ejercicios donde es el principal.
      .sort((a, b) => (f.muscle ? Number(b.primary === f.muscle) - Number(a.primary === f.muscle) : 0));
  }, [list, index, f]);
}

function Filters({ f, set }: { f: Filter; set: (f: Filter) => void }) {
  return (
    <div className="space-y-2 mb-3">
      <input placeholder="Buscar por nombre, músculo o máquina…" value={f.q} onChange={(e) => set({ ...f, q: e.target.value })} aria-label="Buscar ejercicio" />
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1" role="group" aria-label="Filtrar por músculo">
        <Chip active={!f.muscle} onClick={() => set({ ...f, muscle: null })}>Todos</Chip>
        {MUSCLES.map((m) => <Chip key={m} active={f.muscle === m} onClick={() => set({ ...f, muscle: f.muscle === m ? null : m })} color="#ff6a1a">{MUSCLE_LABEL[m]}</Chip>)}
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1" role="group" aria-label="Filtrar por implemento">
        <Chip active={!f.eq} onClick={() => set({ ...f, eq: null })}>Todo el equipo</Chip>
        {EQUIPMENT.map((m) => <Chip key={m} active={f.eq === m} onClick={() => set({ ...f, eq: f.eq === m ? null : m })} color="#5aa9ff">{EQUIPMENT_LABEL[m]}</Chip>)}
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1" role="group" aria-label="Filtrar por tipo de entrenamiento">
        <Chip active={!f.cat} onClick={() => set({ ...f, cat: null })}>Todo tipo</Chip>
        {CATEGORIES.map((c) => <Chip key={c} active={f.cat === c} onClick={() => set({ ...f, cat: f.cat === c ? null : c })} color="#3ddc84">{CATEGORY_LABEL[c]}</Chip>)}
      </div>
    </div>
  );
}

function Row({ ex, onClick, right }: { ex: ExerciseDef; onClick: () => void; right?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-panel bg-card p-2.5 text-left transition hover:border-mute/40 active:scale-[.99]">
      <ExerciseThumb ex={ex} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold leading-tight truncate">{ex.name}</div>
        <div className="wd-c text-sm text-mute truncate">{ex.focus || MUSCLE_LABEL[ex.primary]}, {EQUIPMENT_LABEL[ex.equipment].toLowerCase()}{ex.custom ? ', propio' : ''}</div>
      </div>
      {right}
    </button>
  );
}

/** Lista paginada: con cientos de ejercicios solo se dibujan los primeros y se amplía a pedido. */
function Rows({ list, onPick, cols }: { list: ExerciseDef[]; onPick: (e: ExerciseDef) => void; cols?: boolean }) {
  const [shown, setShown] = useState(PAGE);
  useEffect(() => { setShown(PAGE); }, [list]);
  return (
    <>
      <div className={cols ? 'grid grid-cols-1 gap-2 md:grid-cols-2' : 'space-y-2'}>
        {list.slice(0, shown).map((e) => <Row key={e.id} ex={e} onClick={() => onPick(e)} />)}
      </div>
      {list.length > shown && <Btn className="mt-3 w-full" onClick={() => setShown(shown + PAGE * 2)}>Mostrar más ({list.length - shown} restantes)</Btn>}
    </>
  );
}

/** Selector de ejercicio reutilizado por el constructor de rutinas y la sesión en curso. */
export function ExercisePicker({ open, onClose, onPick, exclude = [] }: { open: boolean; onClose: () => void; onPick: (ex: ExerciseDef) => void; exclude?: string[] }) {
  const all = useExercises();
  const [f, setF] = useState<Filter>(NO_FILTER);
  const filtered = useFiltered(all, f);
  const list = useMemo(() => filtered.filter((e) => !exclude.includes(e.id)), [filtered, exclude.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Sheet open={open} onClose={onClose} title="Elegir ejercicio" wide>
      <Filters f={f} set={setF} />
      <p className="label mb-2" aria-live="polite">{list.length} ejercicios</p>
      <div className="max-h-[50vh] overflow-y-auto">
        <Rows list={list} onPick={(e) => { onPick(e); onClose(); }} />
        {!list.length && <p className="py-6 text-center text-sm text-mute">Ningún ejercicio coincide con el filtro.</p>}
      </div>
    </Sheet>
  );
}

const List = ({ title, items }: { title: string; items: string[] }) => items.length ? (
  <div><div className="label mb-1">{title}</div><ul className="space-y-1 text-sm">{items.map((c, i) => <li key={i} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-[1px] bg-fire" aria-hidden />{c}</li>)}</ul></div>
) : null;
const Para = ({ title, text }: { title: string; text: string }) => text ? (<div><div className="label mb-1">{title}</div><p className="text-sm">{text}</p></div>) : null;

export function ExerciseDetail({ ex, onClose, onEdit }: { ex: ExerciseDef | null; onClose: () => void; onEdit?: (ex: ExerciseDef) => void }) {
  if (!ex) return null;
  return (
    <Sheet open onClose={onClose} title={ex.name} wide>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr]">
        <div className="relative h-72 md:h-80">
          <BodyFigure tones={exerciseTones(ex.primary, ex.secondary)} className="absolute inset-0" />
          <div className="absolute left-0 top-0"><ExerciseThumb ex={ex} size={68} /></div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-ctl bg-card2 p-2.5"><div className="label !text-xs">Principal</div><div className="font-semibold text-fire">{MUSCLE_LABEL[ex.primary]}</div></div>
            <div className="rounded-ctl bg-card2 p-2.5"><div className="label !text-xs">Secundarios</div><div className="font-semibold">{ex.secondary.map((m) => MUSCLE_LABEL[m]).join(', ') || '—'}</div></div>
            <div className="rounded-ctl bg-card2 p-2.5"><div className="label !text-xs">Tipo</div><div className="font-semibold">{ex.type === 'compound' ? 'Multiarticular' : 'Monoarticular'}</div></div>
            <div className="rounded-ctl bg-card2 p-2.5"><div className="label !text-xs">Equipamiento</div><div className="font-semibold">{EQUIPMENT_LABEL[ex.equipment]}</div></div>
            {ex.focus && <div className="rounded-ctl bg-card2 p-2.5"><div className="label !text-xs">Énfasis</div><div className="font-semibold">{ex.focus}</div></div>}
            {ex.machine && <div className="rounded-ctl bg-card2 p-2.5"><div className="label !text-xs">Máquina</div><div className="font-semibold">{ex.machine}</div></div>}
            {ex.category !== 'strength' && <div className="rounded-ctl bg-card2 p-2.5"><div className="label !text-xs">Familia</div><div className="font-semibold">{CATEGORY_LABEL[ex.category]}</div></div>}
            {ex.measure !== 'reps' && <div className="rounded-ctl bg-card2 p-2.5"><div className="label !text-xs">Se anota en</div><div className="font-semibold">{ex.measure === 'time' ? 'Segundos' : 'Metros'}</div></div>}
            <div className="rounded-ctl bg-card2 p-2.5"><div className="label !text-xs">Incremento mínimo</div><div className="font-semibold">{ex.increment} kg</div></div>
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

const BLANK: ExerciseDef = { id: '', name: '', primary: 'chest', secondary: [], type: 'compound', equipment: 'machine', machine: '', focus: '', aka: '', measure: 'reps', category: 'strength', cues: [], mistakes: [], rom: '', execution: '', safety: '', increment: 2.5, photo: null, custom: true };

export function ExerciseForm({ initial, onClose }: { initial: ExerciseDef | null; onClose: () => void }) {
  const [ex, setEx] = useState<ExerciseDef>(initial ?? BLANK);
  const run = useAction(); const { confirm } = useUi();
  const isBase = isLibraryId(ex.id);
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Qué se anota en cada serie"><select value={ex.measure} onChange={(e) => set('measure', e.target.value as Measure)}>{(['reps', 'time', 'distance'] as Measure[]).map((m) => <option key={m} value={m}>{MEASURE_LABEL[m]}</option>)}</select></Field>
            <Field label="Familia"><select value={ex.category} onChange={(e) => set('category', e.target.value as Category)}>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select></Field>
          </div>
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

// ---------- Equipamiento ----------
const LOAD_ART: Record<Machine['load'], Equipment> = { stack: 'machine', plates: 'lever', cable: 'cable', free: 'barbell', body: 'bodyweight', electronic: 'isolation_machine', cardio: 'other' };
const artOf = (m: Machine): Equipment => m.eq ?? LOAD_ART[m.load];
const musclesOf = (m: Machine) => (m.muscles.length ? m.muscles.map((x) => MUSCLE_LABEL[x]).join(', ') : 'Según el ejercicio');

function MachineDetail({ m, all, onClose, onExercise, onEquipment }: { m: Machine | null; all: ExerciseDef[]; onClose: () => void; onExercise: (e: ExerciseDef) => void; onEquipment: (eq: Equipment) => void }) {
  if (!m) return null;
  const exs = m.ex.map((id) => all.find((e) => e.id === id)).filter((e): e is ExerciseDef => !!e);
  const withEq = m.eq ? all.filter((e) => e.equipment === m.eq).length : 0;
  return (
    <Sheet open onClose={onClose} title={m.name} wide>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr]">
        {m.muscles.length > 0 && (
          <div className="relative h-64 md:h-80"><BodyFigure tones={exerciseTones(m.muscles[0], m.muscles.slice(1))} className="absolute inset-0" /></div>
        )}
        <div className={m.muscles.length ? 'space-y-3' : 'space-y-3 md:col-span-2'}>
          <p className="wd-c text-[15px] text-mute">También: {m.aka}</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-ctl bg-card2 p-2.5"><div className="label !text-xs">Tipo de carga</div><div className="font-semibold">{LOAD_LABEL[m.load]}</div></div>
            <div className="rounded-ctl bg-card2 p-2.5"><div className="label !text-xs">Músculo principal</div><div className="font-semibold text-fire">{m.muscles.length ? MUSCLE_LABEL[m.muscles[0]] : 'Según el ejercicio'}</div></div>
            {m.muscles.length > 1 && <div className="col-span-2 rounded-ctl bg-card2 p-2.5"><div className="label !text-xs">También trabaja</div><div className="font-semibold">{m.muscles.slice(1).map((x) => MUSCLE_LABEL[x]).join(', ')}</div></div>}
          </div>
          <Para title="Cómo es" text={m.note} />
          <List title="Modelos actuales en el mercado" items={m.models} />
          {exs.length > 0 && (
            <div><div className="label mb-1">Ejercicios en la biblioteca</div>
              <div className="space-y-2">{exs.map((e) => <Row key={e.id} ex={e} onClick={() => onExercise(e)} />)}</div>
            </div>
          )}
          {m.eq && withEq > 0 && <Btn className="w-full" icon="book" onClick={() => onEquipment(m.eq!)}>Ver los {withEq} ejercicios con {EQUIPMENT_LABEL[m.eq].toLowerCase()}</Btn>}
        </div>
      </div>
    </Sheet>
  );
}

function Machines({ all, onExercise, onEquipment }: { all: ExerciseDef[]; onExercise: (e: ExerciseDef) => void; onEquipment: (eq: Equipment) => void }) {
  const [q, setQ] = useState(''); const [zone, setZone] = useState<Zone | null>(null); const [open, setOpen] = useState<Machine | null>(null);
  const list = useMemo(() => {
    const words = norm(q.trim()).split(/\s+/).filter(Boolean);
    return MACHINES.filter((m) => (!zone || m.zone === zone) && words.every((w) => norm(`${m.name} ${m.aka} ${m.models.join(' ')} ${musclesOf(m)} ${LOAD_LABEL[m.load]}`).includes(w)));
  }, [q, zone]);
  return (
    <div>
      <div className="space-y-2 mb-3">
        <input placeholder="Buscar máquina, marca o músculo…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar equipamiento" />
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1" role="group" aria-label="Filtrar por zona">
          <Chip active={!zone} onClick={() => setZone(null)}>Todo</Chip>
          {ZONES.map((z) => <Chip key={z} active={zone === z} onClick={() => setZone(zone === z ? null : z)} color="#ff6a1a">{ZONE_LABEL[z]}</Chip>)}
        </div>
      </div>
      {ZONES.filter((z) => list.some((m) => m.zone === z)).map((z) => (
        <section key={z} className="mb-5">
          <H2>{ZONE_LABEL[z]}</H2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {list.filter((m) => m.zone === z).map((m) => (
              <button key={m.id} type="button" onClick={() => setOpen(m)} className="flex w-full items-center gap-3 rounded-panel bg-card p-2.5 text-left transition active:scale-[.99]">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-ctl bg-card2"><EquipmentArt equipment={artOf(m)} size={44} /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-tight truncate">{m.name}</div>
                  <div className="wd-c text-sm text-mute truncate">{musclesOf(m)}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
      {!list.length && <Empty icon="book" title="Sin resultados" text="Prueba con otro nombre, marca o músculo." />}
      {!q && !zone && (
        <section>
          <H2>Fabricantes y líneas vigentes</H2>
          <dl className="ruled text-sm">
            {BRANDS.map((b) => <div key={b.brand} className="grid grid-cols-[8.5rem_1fr] gap-3 py-2"><dt className="font-semibold">{b.brand}</dt><dd className="text-mute">{b.lines}</dd></div>)}
          </dl>
          <p className="mt-3 text-xs text-mute">Los modelos son ejemplos tomados de los catálogos públicos de cada fabricante. El gimnasio puede tener otra marca con la misma función.</p>
        </section>
      )}
      <MachineDetail m={open} all={all} onClose={() => setOpen(null)} onExercise={(e) => { setOpen(null); onExercise(e); }} onEquipment={(eq) => { setOpen(null); onEquipment(eq); }} />
    </div>
  );
}

export default function Library() {
  const all = useExercises();
  const [tab, setTab] = useState<'ex' | 'eq'>('ex');
  const [f, setF] = useState<Filter>(NO_FILTER);
  const [detail, setDetail] = useState<ExerciseDef | null>(null);
  const [form, setForm] = useState<{ ex: ExerciseDef | null } | null>(null);
  const list = useFiltered(all, f);
  const own = all.filter((e) => e.custom).length;
  return (
    <div>
      <Title sub={`${all.length} ejercicios${own ? `, ${own} propios` : ''} y ${MACHINES.length} equipos`} right={<Btn variant="primary" icon="plus" onClick={() => setForm({ ex: null })}>Nuevo</Btn>}>Biblioteca</Title>
      <div className="mb-3"><Seg value={tab} onChange={setTab} options={[{ value: 'ex', label: 'Ejercicios' }, { value: 'eq', label: 'Equipamiento' }]} /></div>
      {tab === 'ex' ? (
        <>
          <Filters f={f} set={setF} />
          <p className="label mb-2" aria-live="polite">{list.length === all.length ? `${all.length} ejercicios` : `${list.length} de ${all.length} ejercicios`}</p>
          <Rows list={list} onPick={setDetail} cols />
          {!list.length && <Empty icon="book" title="Sin resultados" text="Cambia el filtro o crea un ejercicio propio."><Btn variant="primary" icon="plus" onClick={() => setForm({ ex: null })}>Crear ejercicio</Btn></Empty>}
        </>
      ) : (
        <Machines all={all} onExercise={setDetail} onEquipment={(eq) => { setF({ ...NO_FILTER, eq }); setTab('ex'); }} />
      )}
      <ExerciseDetail ex={detail} onClose={() => setDetail(null)} onEdit={(ex) => { setDetail(null); setForm({ ex }); }} />
      {form && <ExerciseForm initial={form.ex} onClose={() => setForm(null)} />}
    </div>
  );
}
