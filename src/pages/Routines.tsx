import { PlanButton } from '../ui/extras';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createFromTemplate, createRoutine } from '../data/repo';
import { TEMPLATES } from '../data/templates';
import { useAllItems, useRoutines } from '../hooks';
import { Btn, Card, Empty, Field, Icon, Sheet, Title, useAction } from '../ui/components';

export const DAY_LABEL = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function Routines() {
  const routines = useRoutines(); const items = useAllItems();
  const nav = useNavigate(); const run = useAction();
  const [creating, setCreating] = useState(false); const [tpl, setTpl] = useState(false); const [name, setName] = useState('');
  const create = async () => { const r = await run(() => createRoutine(name)); if (r) { setCreating(false); setName(''); nav(`/rutinas/${r.id}`); } };
  return (
    <div>
      <Title sub="Crea tus rutinas o parte de una plantilla" right={<Btn variant="primary" icon="plus" onClick={() => setCreating(true)}>Nueva</Btn>}>Rutinas</Title>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {routines?.map((r) => {
          const its = items?.filter((i) => i.routineId === r.id) ?? [];
          return (
            <Card key={r.id} onClick={() => nav(`/rutinas/${r.id}`)}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="wd-w font-bold text-lg leading-tight truncate">{r.name}</div>
                  <div className="wd-c text-sm text-mute">{r.split}: {its.length} ejercicios, {its.reduce((a, i) => a + i.sets, 0)} series</div>
                </div>
                <Icon name="right" className="text-mute shrink-0" />
              </div>
              <div className="mt-3 flex gap-1.5">
                {DAY_ORDER.map((d) => <span key={d} className={`wd-c grid h-7 w-7 place-items-center rounded-full text-[13px] font-bold ${r.days.includes(d) ? 'bg-fire text-ink' : 'bg-card2 text-mute'}`}>{DAY_LABEL[d]}</span>)}
              </div>
            </Card>
          );
        })}
      </div>
      {routines && !routines.length && (
        <Empty icon="list" title="Aún no tienes rutinas" text="Crea una desde cero o usa una plantilla y ajústala a tu gimnasio.">
          <Btn variant="primary" icon="plus" onClick={() => setCreating(true)}>Crear rutina</Btn>
          <Btn onClick={() => setTpl(true)}>Usar plantilla</Btn>
        </Empty>
      )}
      {!!routines?.length && <Btn className="mt-4 w-full" onClick={() => setTpl(true)}>Añadir desde plantilla</Btn>}
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
