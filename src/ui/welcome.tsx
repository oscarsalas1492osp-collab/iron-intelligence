// Bienvenida: tres preguntas y la persona sale con sus rutinas creadas. Aparece solo mientras no hay
// rutinas ni sesiones, y se puede saltar para armar la rutina a mano.
import { useMemo, useState } from 'react';
import { createFromPlan, updateProfile } from '../data/repo';
import { generatePlan, type PlanDay } from '../domain/generator';
import type { Equipment, ExerciseDef, Experience, Goal, Target } from '../domain/types';
import { useExercises, useExMap, useProfile } from '../hooks';
import { Btn, cx, Seg, Sheet, useAction } from './components';

const OBJETIVOS: { value: Goal; titulo: string; nota: string }[] = [
  { value: 'hypertrophy', titulo: 'Ganar músculo', nota: 'Series de 8 a 15 repeticiones, cerca del fallo.' },
  { value: 'strength', titulo: 'Ganar fuerza', nota: 'Los ejercicios grandes van más pesados, de 4 a 6 repeticiones.' },
  { value: 'recomposition', titulo: 'Bajar grasa sin perder músculo', nota: 'El mismo trabajo de fuerza; la diferencia la hace la comida.' },
  { value: 'maintenance', titulo: 'Mantenerme', nota: 'Lo justo para conservar lo que tienes.' },
];
const NIVELES: { value: Experience; label: string }[] = [
  { value: 'beginner', label: 'Menos de 1 año' },
  { value: 'intermediate', label: '1 a 3 años' },
  { value: 'advanced', label: 'Más de 3 años' },
];
type Lugar = 'gym' | 'casa' | 'cuerpo';
// Gimnasio completo deja el equipo sin restringir: el generador usa todo el catálogo.
const LUGARES: { value: Lugar; titulo: string; nota: string; equipo: Equipment[] }[] = [
  { value: 'gym', titulo: 'Gimnasio completo', nota: 'Máquinas, poleas, barras y mancuernas.', equipo: [] },
  { value: 'casa', titulo: 'En casa con mancuernas', nota: 'Mancuernas, bandas y el peso del cuerpo.', equipo: ['dumbbell', 'band', 'bodyweight'] },
  { value: 'cuerpo', titulo: 'Solo peso corporal', nota: 'Barra de dominadas, suelo y bandas.', equipo: ['bodyweight', 'band', 'suspension'] },
];
// Con objetivo de fuerza, los ejercicios compuestos bajan las repeticiones y alargan el descanso.
const FUERZA: Partial<Target> = { repMin: 4, repMax: 6, rirMin: 1, rirMax: 3, restSec: 180 };

export function planDeBienvenida(a: { goal: Goal; days: number; experience: Experience; equipment: Equipment[] }, lib: ExerciseDef[]): { split: string; routines: PlanDay[] } {
  const plan = generatePlan({ days: a.days, equipment: a.equipment, priority: [], experience: a.experience }, lib);
  if (a.goal !== 'strength') return plan;
  const tipo = new Map(lib.map((e) => [e.id, e.type]));
  return { split: plan.split, routines: plan.routines.map((r) => ({ ...r, exercises: r.exercises.map(([id, t]) => [id, tipo.get(id) === 'compound' ? { ...t, ...FUERZA } : t] as [string, Partial<Target>]) })) };
}

function Opcion({ activo, titulo, nota, onClick }: { activo: boolean; titulo: string; nota: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={activo} onClick={onClick}
      className={cx('block min-h-[3.25rem] w-full rounded-panel px-4 py-3 text-left transition-colors', activo ? 'bg-chalk text-ink' : 'bg-card2 text-chalk')}>
      <span className="block font-bold">{titulo}</span>
      <span className={cx('block text-sm', activo ? 'text-ink/75' : 'text-mute')}>{nota}</span>
    </button>
  );
}

export function Welcome({ onSkip }: { onSkip: () => void }) {
  const p = useProfile(); const lib = useExercises(); const ex = useExMap(); const run = useAction();
  const [open, setOpen] = useState(false), [paso, setPaso] = useState(0);
  const [goal, setGoal] = useState<Goal>(p.goal), [days, setDays] = useState(Math.min(6, Math.max(2, p.daysAvailable)));
  const [exp, setExp] = useState<Experience>(p.experience), [lugar, setLugar] = useState<Lugar>('gym');
  const equipo = LUGARES.find((l) => l.value === lugar)!.equipo;
  const plan = useMemo(() => (open && paso === 3 ? planDeBienvenida({ goal, days, experience: exp, equipment: equipo }, lib) : null), [open, paso, goal, days, exp, equipo, lib]);
  const crear = async () => {
    if (!plan) return;
    const ok = await run(async () => {
      await updateProfile({ goal, daysAvailable: days, experience: exp, equipment: equipo });
      return createFromPlan(plan.split, plan.routines);
    }, plan.routines.length === 1 ? 'Rutina creada' : `${plan.routines.length} rutinas creadas`);
    if (ok) setOpen(false);
  };
  const TITULOS = ['¿Qué buscas?', '¿Cuánto entrenas?', '¿Dónde entrenas?', 'Tu plan'];

  return (
    <section className="mb-4 rounded-panel bg-card p-4" aria-label="Bienvenida">
      <h2 className="wd-w text-[17px] font-bold">Tres preguntas y sales con tu rutina lista</h2>
      <p className="mt-1 text-[15px] text-mute">Eliges tu objetivo, tus días y tu equipo. Después puedes cambiar cada ejercicio.</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Btn variant="primary" onClick={() => { setPaso(0); setOpen(true); }}>Armar mi plan</Btn>
        <button type="button" className="hit text-sm text-mute underline" onClick={onSkip}>Prefiero crear mi rutina a mano</button>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={TITULOS[paso]} wide>
        <div className="space-y-4">
          <p className="wd-c text-sm text-mute" aria-live="polite">{paso < 3 ? `Paso ${paso + 1} de 3` : 'Revisa y crea tus rutinas'}</p>
          {paso === 0 && <div className="space-y-2">{OBJETIVOS.map((o) => <Opcion key={o.value} activo={goal === o.value} titulo={o.titulo} nota={o.nota} onClick={() => setGoal(o.value)} />)}</div>}
          {paso === 1 && (
            <div className="space-y-4">
              <div><div className="label mb-1.5">Días por semana</div><Seg options={[2, 3, 4, 5, 6].map((d) => ({ value: d, label: String(d) }))} value={days} onChange={setDays} /></div>
              <div><div className="label mb-1.5">Tiempo entrenando con pesas</div><Seg options={NIVELES} value={exp} onChange={setExp} /></div>
            </div>
          )}
          {paso === 2 && <div className="space-y-2">{LUGARES.map((l) => <Opcion key={l.value} activo={lugar === l.value} titulo={l.titulo} nota={l.nota} onClick={() => setLugar(l.value)} />)}</div>}
          {paso === 3 && plan && (
            <div className="space-y-2.5">
              {plan.routines.map((r) => (
                <div key={r.name} className="rounded-panel bg-card2 p-3">
                  <div className="wd-w font-bold">{r.name}</div>
                  <div className="mt-1 text-sm text-chalk/85">{r.exercises.map(([id]) => ex.get(id)?.name ?? id).join(', ')}</div>
                </div>
              ))}
              <p className="text-sm text-mute">Es un punto de partida. Puedes cambiar ejercicios, series y días en cada rutina.</p>
            </div>
          )}
          <div className="flex gap-3">
            {paso > 0 && <Btn className="flex-1" onClick={() => setPaso(paso - 1)}>Atrás</Btn>}
            {paso < 3 ? <Btn variant="primary" className="flex-1" onClick={() => setPaso(paso + 1)}>{paso === 2 ? 'Ver mi plan' : 'Siguiente'}</Btn>
              : <Btn variant="primary" className="flex-1" onClick={() => void crear()}>Crear mis rutinas</Btn>}
          </div>
        </div>
      </Sheet>
    </section>
  );
}
