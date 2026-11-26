import { PlanButton } from '../ui/extras';
import { dayInitials } from '../i18n';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { needsPro } from '../domain/plan';
import { openPlans, usePlan } from '../ui/plan';
import { createFromTemplate, createRoutine } from '../data/repo';
import { TEMPLATES } from '../data/templates';
import { useAllItems, useRoutines } from '../hooks';
import { Btn, Card, cx, Empty, Field, Icon, Sheet, Title, useAction } from '../ui/components';
import { daysText, RoutineFigure, useRoutineSummary } from '../ui/routinePreview';
import type { Routine, RoutineItem } from '../domain/types';

export const DAY_LABEL = dayInitials();   // la app se carga después de elegir el idioma
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function Routines() {
  const routines = useRoutines(); const items = useAllItems();
  const nav = useNavigate(); const run = useAction();
  const [creating, setCreating] = useState(false); const [tpl, setTpl] = useState(false); const [name, setName] = useState('');
  // Plan gratis: un número acotado de rutinas propias. Al llegar al tope se ofrece Pro en vez de crear otra.
  const plan = usePlan(), full = !plan.pro && (routines?.length ?? 0) >= plan.freeRoutines;
  const guard = (go: () => void) => () => (full ? openPlans() : go());
  // Las plantillas crean varias rutinas de una vez: son parte de Pro.
  const tplGuard = (go: () => void) => () => (full || needsPro(plan, 'templates') ? openPlans() : go());
  const create = async () => { const r = await run(() => createRoutine(name)); if (r) { setCreating(false); setName(''); nav(`/rutinas/${r.id}`); } };
  return (
    <div>
      <Title sub="Crea tus rutinas o parte de una plantilla" right={<Btn variant="primary" icon="plus" onClick={guard(() => setCreating(true))}>Nueva</Btn>}>Rutinas</Title>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {routines?.map((r) => <RoutineCard key={r.id} routine={r} items={items?.filter((i) => i.routineId === r.id) ?? []} onOpen={() => nav(`/rutinas/${r.id}`)} />)}
      </div>
      {routines && !routines.length && (
        <Empty icon="list" title="Aún no tienes rutinas" text="Crea una desde cero o usa una plantilla y ajústala a tu gimnasio.">
          <Btn variant="primary" icon="plus" onClick={guard(() => setCreating(true))}>Crear rutina</Btn>
          <Btn onClick={tplGuard(() => setTpl(true))}>Usar plantilla</Btn>
        </Empty>
      )}
      {full && <p className="mt-4 text-center text-xs text-mute">El plan gratis incluye hasta {plan.freeRoutines} rutinas. Con Pro no hay límite.</p>}
      {!!routines?.length && <Btn className="mt-4 w-full" onClick={tplGuard(() => setTpl(true))}>Añadir desde plantilla</Btn>}
      <PlanButton className="mt-2 w-full" />

      <Sheet open={creating} onClose={() => setCreating(false)} title="Nueva rutina">
        <Field label="Nombre"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Pecho y tríceps" onKeyDown={(e) => e.key === 'Enter' && create()} /></Field>
        <Btn variant="primary" className="mt-4 w-full" onClick={create}>Crear y añadir ejercicios</Btn>
      </Sheet>
      <Sheet open={tpl} onClose={() => setTpl(false)} title="Plantillas">
        <p className="mb-3 text-xs text-mute">Son puntos de partida. Podrás cambiar ejercicios, series, rangos, RIR y descansos.</p>
        <div className="space-y-2">
          {TEMPLATES.map((t) => (
            <Card key={t.id} onClick={async () => { if (await run(() => createFromTemplate(t.id), `Rutinas de “${t.name}” creadas`)) setTpl(false); }}>
              <div className="font-bold">{t.name}</div>
              <div className="text-xs text-mute">{t.description}</div>
              <div className="mt-1 text-xs text-data">{t.routines.map((r) => r.name).join(' · ')}</div>
            </Card>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

/** Tarjeta de una rutina: qué trabaja (figura y foco), cuánto dura y qué días toca. */
function RoutineCard({ routine: r, items, onOpen }: { routine: Routine; items: RoutineItem[]; onOpen: () => void }) {
  const sum = useRoutineSummary(items);
  const today = r.days.includes(new Date().getDay());
  return (
    <Card onClick={onOpen} className="!py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 py-1">
          <div className="wd-w truncate text-lg font-bold leading-tight">{r.name}</div>
          {sum.focus && <div className="wd-c mt-1 text-[15px] font-semibold leading-snug text-chalk">{sum.focus}</div>}
          <div className="wd-c mt-0.5 text-sm text-mute">{sum.meta}</div>
          <div className={cx('wd-c mt-2 flex items-center gap-1.5 text-sm font-semibold', today ? 'text-amber' : 'text-mute')}>
            <Icon name="calendar" size={15} className="shrink-0" /><span>{today ? `${daysText(r.days)}, hoy` : daysText(r.days)}</span>
          </div>
        </div>
        <RoutineFigure summary={sum} className="-mr-1 h-[124px] w-[96px] shrink-0" />
      </div>
    </Card>
  );
}
